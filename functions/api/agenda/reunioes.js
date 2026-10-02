// GET  /api/agenda/reunioes?key=...&from=&to=[&tipo=&situacao=]
//        → reuniões cujo HORÁRIO cai no período + números do período
// GET  /api/agenda/reunioes?key=...&id=<id>      → detalhe com histórico
// GET  /api/agenda/reunioes?key=...&por=funil&from=&to=
//        → Reuniões agendadas por funil (painel da Visão geral): reuniões
//          comerciais MARCADAS no período (data em que o lead agendou), sem
//          e-mails de teste. Cancelar depois não tira da contagem: o número
//          mede quantos agendaram.
// POST /api/agenda/reunioes?key=...  → { acao: 'cancelar', id, motivo? }
//                                      { acao: 'remarcar', id, inicio }
//                                      { acao: 'presenca', id, situacao: 'realizada'|'faltou'|'sem_info' }
//
// Spec spec-agenda-propria.md, módulos 5 e 8 (issues 361 e 362).
import { numerosDoPeriodo, SITUACOES } from '../_agenda-regras.js';
import {
  lerReuniao, lerTipo, cancelar, remarcar, registrarNoCrm, textoCrm, historico, agora,
} from '../_agenda.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;

function linkCrm(situacao) {
  const m = /^ok:(.+)$/.exec(situacao || '');
  return m ? `https://app.clickup.com/t/${m[1]}` : null;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!autorizado(url, env)) return json({ error: 'Unauthorized' }, 401);
  const p = url.searchParams;

  if (p.get('id')) {
    const r = await lerReuniao(env, { id: p.get('id') });
    if (!r) return json({ error: 'Reunião não encontrada.' }, 404);
    const tipo = await lerTipo(env, { id: r.tipo_id });
    const hist = (await env.DB.prepare('SELECT acao, detalhe, por, criado_em FROM agenda_historico WHERE reuniao_id = ? ORDER BY criado_em, id').bind(r.id).all()).results || [];
    const { token_gestao, ip, ...publico } = r;
    return json({ reuniao: { ...publico, tipo_nome: tipo?.nome, crm_link: linkCrm(r.crm_situacao) }, historico: hist });
  }

  const de = Number(p.get('from')) || agora() - 30 * 86400;
  const ate = Number(p.get('to')) || agora() + 30 * 86400;

  if (p.get('por') === 'funil') {
    const rs = (await env.DB.prepare(
      `SELECT COALESCE(funil, '') AS funil, COUNT(*) AS n FROM agenda_reunioes
        WHERE comercial = 1 AND is_teste = 0 AND criado_em >= ? AND criado_em < ? GROUP BY funil`,
    ).bind(de, ate).all()).results || [];
    const por_funil = Object.fromEntries(rs.map((x) => [x.funil, x.n]));
    return json({ total: rs.reduce((s, x) => s + x.n, 0), por_funil });
  }

  const filtros = ['r.inicio >= ?', 'r.inicio < ?'];
  const binds = [de, ate];
  if (p.get('tipo')) { filtros.push('r.tipo_id = ?'); binds.push(Number(p.get('tipo'))); }
  if (SITUACOES.includes(p.get('situacao'))) { filtros.push('r.situacao = ?'); binds.push(p.get('situacao')); }
  const rows = (await env.DB.prepare(
    `SELECT r.id, r.inicio, r.fim, r.nome, r.email, r.telefone, r.situacao, r.funil, r.comercial, r.is_teste,
            r.meet_link, r.crm_situacao, r.presenca_origem, r.session_id, t.nome AS tipo_nome, t.id AS tipo_id,
            s.utm_source, s.utm_medium, s.utm_campaign
       FROM agenda_reunioes r
       JOIN agenda_tipos t ON t.id = r.tipo_id
       LEFT JOIN sessions s ON s.session_id = r.session_id
      WHERE ${filtros.join(' AND ')}
      ORDER BY r.inicio`,
  ).bind(...binds).all()).results || [];
  const tipos = (await env.DB.prepare('SELECT id, nome, ativo FROM agenda_tipos ORDER BY nome').all()).results || [];
  return json({
    rows: rows.map(({ session_id, ...r }) => ({ ...r, crm_link: linkCrm(r.crm_situacao) })),
    numeros: numerosDoPeriodo(rows),
    tipos,
  });
}

export async function onRequestPost({ request, env }) {
  if (!autorizado(new URL(request.url), env)) return json({ error: 'Unauthorized' }, 401);
  const corpo = await request.json().catch(() => ({}));
  const reuniao = await lerReuniao(env, { id: String(corpo.id || '') });
  if (!reuniao) return json({ error: 'Reunião não encontrada.' }, 404);
  const tipo = await lerTipo(env, { id: reuniao.tipo_id });

  if (corpo.acao === 'cancelar') {
    const r = await cancelar(env, reuniao, { por: 'equipe', motivo: corpo.motivo });
    if (r.erro) return json({ error: r.erro }, 409);
    await registrarNoCrm(env, reuniao, textoCrm('cancelou', tipo, reuniao, corpo.motivo ? `Motivo: ${corpo.motivo}` : 'Cancelada pela equipe.'));
    return json({ ok: true });
  }

  if (corpo.acao === 'remarcar') {
    const r = await remarcar(env, reuniao, tipo, Number(corpo.inicio), { por: 'equipe' });
    if (r.erro) return json({ error: r.erro }, 409);
    await registrarNoCrm(env, reuniao, textoCrm('remarcou', tipo, { ...reuniao, inicio: r.inicio }));
    return json({ ok: true });
  }

  if (corpo.acao === 'presenca') {
    if (!['realizada', 'faltou', 'sem_info'].includes(corpo.situacao)) return json({ error: 'Situação inválida.' }, 400);
    if (reuniao.situacao === 'cancelada') return json({ error: 'Reunião cancelada não tem presença.' }, 409);
    if (reuniao.inicio > agora()) return json({ error: 'A reunião ainda não aconteceu.' }, 409);
    await env.DB.prepare("UPDATE agenda_reunioes SET situacao = ?, presenca_origem = 'manual', atualizado_em = ? WHERE id = ?")
      .bind(corpo.situacao, agora(), reuniao.id).run();
    await historico(env, reuniao.id, 'presenca', `marcada à mão: ${corpo.situacao}`, 'equipe');
    if (corpo.situacao !== 'sem_info') await registrarNoCrm(env, reuniao, textoCrm(corpo.situacao, tipo, reuniao, '(corrigido pela equipe)'));
    return json({ ok: true });
  }

  return json({ error: 'Ação desconhecida.' }, 400);
}
