// GET  /api/agenda/agendas?key=...  → contas conectadas e as agendas de cada uma
// POST /api/agenda/agendas?key=...  → { acao: 'adicionar_conta', email }
//                                     { acao: 'remover_conta', email }
//                                     { acao: 'conflito', id, conflito: true|false }
//                                     { acao: 'reler', email }
//
// Spec spec-agenda-propria.md, módulo 1 (issue 359).
import { listarAgendas, contaDoWorkspace, DOMINIO_WORKSPACE } from '../_google-agenda.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;
const agora = () => Math.floor(Date.now() / 1000);

async function montar(env) {
  const contas = (await env.DB.prepare('SELECT email, criado_em FROM agenda_contas ORDER BY criado_em').all()).results || [];
  const cals = (await env.DB.prepare('SELECT * FROM agenda_calendarios ORDER BY nome').all()).results || [];
  const usos = (await env.DB.prepare(
    'SELECT destino_cal, conflito_cals_json, ativo, nome FROM agenda_tipos',
  ).all()).results || [];
  return {
    contas: contas.map((c) => ({
      ...c,
      agendas: cals.filter((a) => a.conta_email === c.email).map((a) => ({
        id: a.id, nome: a.nome, conflito: !!a.conflito,
        ultima_leitura_ok: a.ultima_leitura_ok, ultimo_erro: a.ultimo_erro, ultimo_erro_em: a.ultimo_erro_em,
        destino_de: usos.filter((t) => t.destino_cal === a.id).map((t) => t.nome),
        conflito_de: usos.filter((t) => JSON.parse(t.conflito_cals_json || '[]').includes(a.id)).map((t) => t.nome),
      })),
    })),
  };
}

async function reler(env, email) {
  const lista = await listarAgendas(env, email);
  const t = agora();
  for (const a of lista) {
    await env.DB.prepare(
      `INSERT INTO agenda_calendarios (id, conta_email, nome, conflito, ultima_leitura_ok) VALUES (?, ?, ?, 0, ?)
       ON CONFLICT(id) DO UPDATE SET nome = excluded.nome, ultima_leitura_ok = excluded.ultima_leitura_ok, ultimo_erro = NULL`,
    ).bind(a.id, email, a.nome, t).run();
  }
  return lista.length;
}

export async function onRequestGet({ request, env }) {
  if (!autorizado(new URL(request.url), env)) return json({ error: 'Unauthorized' }, 401);
  return json(await montar(env));
}

export async function onRequestPost({ request, env }) {
  if (!autorizado(new URL(request.url), env)) return json({ error: 'Unauthorized' }, 401);
  const corpo = await request.json().catch(() => ({}));
  const email = String(corpo.email || '').trim().toLowerCase();

  if (corpo.acao === 'adicionar_conta' || corpo.acao === 'reler') {
    if (!contaDoWorkspace(email)) {
      return json({ error: `Nesta versão só entram contas do Workspace (@${DOMINIO_WORKSPACE}). Contas de Gmail pessoal exigiriam login do Google por pessoa.` }, 400);
    }
    if (corpo.acao === 'adicionar_conta') {
      await env.DB.prepare('INSERT OR IGNORE INTO agenda_contas (email, criado_em) VALUES (?, ?)').bind(email, agora()).run();
    }
    try {
      await reler(env, email);
    } catch (e) {
      if (corpo.acao === 'adicionar_conta') {
        await env.DB.prepare('DELETE FROM agenda_contas WHERE email = ? AND NOT EXISTS (SELECT 1 FROM agenda_calendarios WHERE conta_email = ?)').bind(email, email).run();
      } else {
        await env.DB.prepare('UPDATE agenda_calendarios SET ultimo_erro = ?, ultimo_erro_em = ? WHERE conta_email = ?')
          .bind(e.message.slice(0, 300), agora(), email).run();
      }
      return json({ error: `Não foi possível ler as agendas de ${email}: ${e.message}` }, 502);
    }
    return json(await montar(env));
  }

  if (corpo.acao === 'remover_conta') {
    const emUso = await env.DB.prepare(
      `SELECT t.nome FROM agenda_tipos t JOIN agenda_calendarios c ON c.id = t.destino_cal
        WHERE c.conta_email = ? AND t.ativo = 1 LIMIT 1`,
    ).bind(email).first();
    if (emUso) return json({ error: `Uma agenda desta conta recebe as reuniões do tipo ativo "${emUso.nome}". Troque o destino do tipo antes de remover.` }, 409);
    await env.DB.prepare('DELETE FROM agenda_calendarios WHERE conta_email = ?').bind(email).run();
    await env.DB.prepare('DELETE FROM agenda_contas WHERE email = ?').bind(email).run();
    return json(await montar(env));
  }

  if (corpo.acao === 'conflito') {
    const r = await env.DB.prepare('UPDATE agenda_calendarios SET conflito = ? WHERE id = ?')
      .bind(corpo.conflito ? 1 : 0, String(corpo.id || '')).run();
    if (!r.meta.changes) return json({ error: 'Agenda não encontrada.' }, 404);
    return json(await montar(env));
  }

  return json({ error: 'Ação desconhecida.' }, 400);
}
