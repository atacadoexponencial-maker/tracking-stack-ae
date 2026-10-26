// GET  /api/agenda/reunioes?key=...&from=&to=[&tipo=&situacao=]
//        → reuniões cujo HORÁRIO cai no período + números do período
//          (+ consultorias do Calendly desde 19/10, origem 'calendly'; presença à mão)
// GET  /api/agenda/reunioes?key=...&id=<id>      → detalhe com histórico, e-mails e comentários da reunião
//                                                  (id do Calendly = invitee_uri: só dados do Calendly + comentários)
// GET  /api/agenda/reunioes?key=...&por=funil&from=&to=
//        → Reuniões agendadas por funil (painel da Visão geral): reuniões
//          comerciais MARCADAS no período (data em que o lead agendou), sem
//          e-mails de teste. Cancelar depois não tira da contagem: o número
//          mede quantos agendaram.
// POST /api/agenda/reunioes?key=...  → { acao: 'cancelar', id, motivo? }
//                                      { acao: 'remarcar', id, inicio }
//                                      { acao: 'presenca', id, situacao: 'realizada'|'faltou'|'sem_info' }
//                                        (id do Calendly = invitee_uri)
//                                      { acao: 'comentar', id, texto }  (qualquer situação; vai ao ClickUp)
//
// Spec spec-agenda-propria.md, módulos 5 e 8 (issues 361 e 362).
import {
  numerosDoPeriodo, SITUACOES, VISTAS_REUNIOES, recorteDaVista, recorteDoCalendly, CORTE_CALENDLY,
  DURACAO_CALENDLY, linhaDoCalendly, resumoDaAgenda,
} from '../_agenda-regras.js';
import { funisDasReunioes } from '../_reunioes-agendadas.js';
import { isInternalTestEmail } from '../../tracker.js';
import { ymdBrt, inicioDoDiaBrt } from '../_data-brt.js';
import {
  lerReuniao, lerTipo, cancelar, remarcar, registrarNoCrm, textoCrm, historico, agora, enviarRealizada,
  comentar, lerComentarios,
} from '../_agenda.js';
import { emailsDaMudanca, emailsDaReuniao } from '../_email-agenda.js';

const json = (dados, status = 200) => Response.json(dados, { status });
// E-mails da agenda (issue 379) sem segurar a resposta quando há waitUntil.
const depois = (waitUntil, promessa) => (waitUntil ? waitUntil(promessa) : promessa);
const autorizado = (url, env) => !!env.DASH_KEY && url.searchParams.get('key') === env.DASH_KEY;

function linkCrm(situacao) {
  const m = /^ok:(.+)$/.exec(situacao || '');
  return m ? `https://app.clickup.com/t/${m[1]}` : null;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!autorizado(url, env)) return json({ error: 'Unauthorized' }, 401);
  const p = url.searchParams;

  if (p.get('id') && p.get('id').startsWith(ID_CALENDLY)) return detalheCalendly(env, p.get('id'));
  if (p.get('id')) {
    const r = await lerReuniao(env, { id: p.get('id') });
    if (!r) return json({ error: 'Reunião não encontrada.' }, 404);
    const tipo = await lerTipo(env, { id: r.tipo_id });
    const hist = (await env.DB.prepare('SELECT acao, detalhe, por, criado_em FROM agenda_historico WHERE reuniao_id = ? ORDER BY criado_em, id').bind(r.id).all()).results || [];
    const sessao = r.session_id
      ? await env.DB.prepare('SELECT utm_source, utm_medium, utm_campaign FROM sessions WHERE session_id = ?').bind(r.session_id).first()
      : null;
    const { token_gestao, ip, session_id, ...publico } = r;
    return json({ reuniao: { ...publico, tipo_nome: tipo?.nome, crm_link: linkCrm(r.crm_situacao), origem: sessao || null }, historico: hist, emails: await emailsDaReuniao(env, r.id), comentarios: await lerComentarios(env, r.id) });
  }

  const de = Number(p.get('from')) || agora() - 30 * 86400;
  const ate = Number(p.get('to')) || agora() + 30 * 86400;

  if (p.get('por') === 'funil') {
    const rs = (await env.DB.prepare(
      `SELECT COALESCE(funil, '') AS funil, COUNT(*) AS n FROM agenda_reunioes
        WHERE comercial = 1 AND is_teste = 0 AND criado_em >= ? AND criado_em < ?
          AND tipo_id NOT IN (SELECT id FROM agenda_tipos WHERE teste = 1) GROUP BY funil`,
    ).bind(de, ate).all()).results || [];
    const por_funil = Object.fromEntries(rs.map((x) => [x.funil, x.n]));
    return json({ total: rs.reduce((s, x) => s + x.n, 0), por_funil });
  }

  // Vista: hoje (padrão), proximas, pendentes (aguardando presença) ou todas
  // (o período do topo). As contagens das três primeiras vão para as pílulas.
  const t = agora();
  const hoje0 = inicioDoDiaBrt(ymdBrt(t));
  const vista = VISTAS_REUNIOES.includes(p.get('vista')) ? p.get('vista') : 'hoje';
  const recorte = recorteDaVista(vista, { agora: t, hoje0, de, ate: Number(p.get('to')) || t });
  const filtros = [...recorte.where];
  const binds = [...recorte.binds];
  // Testes (convite da equipe ou tipo marcado como teste) só com ?testes=1.
  const comTestes = p.get('testes') === '1';
  const SEM_TESTE = 'is_teste = 0 AND tipo_id NOT IN (SELECT id FROM agenda_tipos WHERE teste = 1)';
  if (!comTestes) filtros.push('r.is_teste = 0 AND r.tipo_id NOT IN (SELECT id FROM agenda_tipos WHERE teste = 1)');
  if (p.get('tipo')) { filtros.push('r.tipo_id = ?'); binds.push(Number(p.get('tipo'))); }
  if (vista === 'todas' && SITUACOES.includes(p.get('situacao'))) { filtros.push('r.situacao = ?'); binds.push(p.get('situacao')); }
  const rows = (await env.DB.prepare(
    `SELECT r.id, r.inicio, r.fim, r.nome, r.email, r.telefone, r.situacao, r.funil, r.comercial, r.is_teste,
            r.meet_link, r.presenca_origem, t.nome AS tipo_nome, t.id AS tipo_id
       FROM agenda_reunioes r
       JOIN agenda_tipos t ON t.id = r.tipo_id
      WHERE ${filtros.join(' AND ')}
      ORDER BY ${recorte.ordem}
      LIMIT 500`,
  ).bind(...binds).all()).results || [];
  const c = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN inicio >= ?1 AND inicio < ?2 THEN 1 ELSE 0 END) AS hoje,
       SUM(CASE WHEN inicio > ?3 AND situacao IN ('marcada','remarcada') THEN 1 ELSE 0 END) AS proximas,
       SUM(CASE WHEN fim < ?3 AND situacao IN ('marcada','remarcada') THEN 1 ELSE 0 END) AS pendentes
     FROM agenda_reunioes${comTestes ? '' : ` WHERE ${SEM_TESTE}`}`,
  ).bind(hoje0, hoje0 + 86400, t).first();
  const tipos = (await env.DB.prepare(`SELECT id, nome, ativo FROM agenda_tipos${comTestes ? '' : ' WHERE teste = 0'} ORDER BY nome`).all()).results || [];
  // Consultorias do Calendly (nome, WhatsApp, Meet e presença à mão): fora com
  // filtro de tipo; nos números do período só entram faltas e realizadas.
  const cal = p.get('tipo')
    ? { rows: [], hoje: 0, proximas: 0, pendentes: 0 }
    : await doCalendly(env, vista, { agora: t, hoje0, de, ate: Number(p.get('to')) || t, situacao: vista === 'todas' ? p.get('situacao') || '' : '' });
  const lista = [
    ...rows.map((r) => ({ ...r, aguardando_presenca: ['marcada', 'remarcada'].includes(r.situacao) && r.fim < t })),
    ...cal.rows,
  ];
  if (cal.rows.length) lista.sort((a, b) => (recorte.ordem.endsWith('DESC') ? b.inicio - a.inicio : a.inicio - b.inicio));
  return json({
    vista,
    rows: lista,
    contagens: {
      hoje: (c?.hoje || 0) + cal.hoje,
      proximas: (c?.proximas || 0) + cal.proximas,
      pendentes: (c?.pendentes || 0) + cal.pendentes,
    },
    numeros: vista === 'todas' ? numerosComCalendly(rows, cal.rows) : null,
    resumo: vista === 'todas' ? await resumoDoPeriodo(env, lista, { de, ate: Number(p.get('to')) || t, agora: t, comTestes }) : null,
    tipos,
  });
}

// Cards de "Todas do período" (pedido de 26/10): por situação, por dia e por
// funil, pela data da reunião. Funil do Calendly pelo e-mail do lead; agenda
// própria, o gravado. `agendadas_anterior`: total do período anterior de mesmo
// tamanho, para o carimbo de variação.
async function resumoDoPeriodo(env, lista, { de, ate, agora, comTestes }) {
  const cal = lista.filter((r) => r.origem === 'calendly');
  const funisCal = cal.length ? await funisDasReunioes(env.DB, cal.map((r) => ({ email: r.email, quando: r.agendou_em, funil: '' }))) : [];
  const funilDe = new Map(cal.map((r, i) => [r.id, funisCal[i].funil]));
  const linhas = lista.map((r) => ({ ...r, funil: r.origem === 'calendly' ? funilDe.get(r.id) : r.funil }));
  const resumo = resumoDaAgenda(linhas, { de, ate, agora });
  const antAte = de - 1, antDe = antAte - (ate - de);
  const semTeste = comTestes ? '' : 'AND is_teste = 0 AND tipo_id NOT IN (SELECT id FROM agenda_tipos WHERE teste = 1)';
  const proprias = await env.DB.prepare(`SELECT COUNT(*) AS n FROM agenda_reunioes WHERE inicio >= ? AND inicio <= ? ${semTeste}`).bind(antDe, antAte).first();
  let doCal = { n: 0 };
  try {
    doCal = await env.DB.prepare(`SELECT COUNT(*) AS n FROM calendly_consultorias WHERE situacao = 'ativa' AND inicio >= ? AND inicio >= ? AND inicio <= ?`)
      .bind(CORTE_CALENDLY, antDe, antAte).first();
  } catch { /* sem Calendly, conta só a agenda própria */ }
  return { ...resumo, agendadas_anterior: (proprias?.n || 0) + (doCal?.n || 0) };
}

// Agendados e cancelados seguem só da agenda própria; faltas e realizadas
// marcadas no Calendly entram no comparecimento.
function numerosComCalendly(rows, calendly) {
  const n = numerosDoPeriodo(rows);
  for (const r of calendly) {
    if (r.situacao === 'faltou') n.faltas++;
    else if (r.situacao === 'realizada') n.realizadas++;
  }
  const conhecidas = n.realizadas + n.faltas;
  n.taxa_comparecimento = conhecidas ? n.realizadas / conhecidas : null;
  return n;
}

// Calendly com erro (tabela ausente, etc.) não derruba a lista.
async function doCalendly(env, vista, janela) {
  try {
    const rc = recorteDoCalendly(vista, janela);
    const rows = rc ? (await env.DB.prepare(
      `SELECT c.invitee_uri, c.inicio, c.fim, c.email, c.nome, c.telefone, c.meet_link, c.presenca, c.agendou_em
         FROM calendly_consultorias c WHERE ${rc.where.join(' AND ')} LIMIT 200`,
    ).bind(...rc.binds).all()).results || [] : [];
    const n = await env.DB.prepare(
      `SELECT SUM(CASE WHEN inicio >= ?2 AND inicio < ?3 THEN 1 ELSE 0 END) AS hoje,
              SUM(CASE WHEN inicio > ?4 THEN 1 ELSE 0 END) AS proximas,
              SUM(CASE WHEN presenca IS NULL AND COALESCE(fim, inicio + ?5) < ?4 THEN 1 ELSE 0 END) AS pendentes
         FROM calendly_consultorias WHERE situacao = 'ativa' AND inicio >= ?1`,
    ).bind(CORTE_CALENDLY, janela.hoje0, janela.hoje0 + 86400, janela.agora, DURACAO_CALENDLY).first();
    return {
      rows: rows.map((r) => linhaDoCalendly(r, janela.agora)),
      hoje: n?.hoje || 0,
      proximas: n?.proximas || 0,
      pendentes: n?.pendentes || 0,
    };
  } catch (e) {
    console.error('agenda: Calendly', e.message);
    return { rows: [], hoje: 0, proximas: 0, pendentes: 0 };
  }
}

const ID_CALENDLY = 'https://api.calendly.com/';
const TIPO_CALENDLY = { nome: 'Consultoria Individual (Calendly)' };

const lerCalendly = (env, id) => env.DB.prepare('SELECT * FROM calendly_consultorias WHERE invitee_uri = ?').bind(String(id)).first();

/** Consultoria do Calendly no formato de reunião que registrarNoCrm e enviarRealizada esperam. */
async function reuniaoDoCalendly(env, c) {
  const [{ funil }] = await funisDasReunioes(env.DB, [{ email: c.email, quando: c.agendou_em, funil: '' }]);
  return {
    id: c.invitee_uri, comercial: 1, is_teste: isInternalTestEmail(c.email) ? 1 : 0, inicio: c.inicio,
    fim: c.fim || c.inicio + DURACAO_CALENDLY, nome: c.nome || '', email: c.email, telefone: c.telefone, funil,
  };
}

// Detalhe de uma consultoria do Calendly para a gaveta do dash: o que o
// Calendly tem (sem respostas, histórico nem e-mails) e os comentários.
async function detalheCalendly(env, id) {
  const c = await lerCalendly(env, id);
  if (!c) return json({ error: 'Reunião não encontrada.' }, 404);
  const r = await reuniaoDoCalendly(env, c);
  const linha = linhaDoCalendly(c, agora());
  const comentarios = await lerComentarios(env, c.invitee_uri);
  // O card só é procurado na presença ou num comentário: vale o último resultado.
  const crm = [c.crm_situacao, ...comentarios.map((x) => x.crm_situacao)].filter(Boolean).pop() || null;
  return json({
    reuniao: {
      ...linha, situacao: c.situacao === 'cancelada' ? 'cancelada' : linha.situacao, comercial: 1, funil: r.funil,
      tipo_nome: TIPO_CALENDLY.nome, crm_link: linkCrm(crm), crm_situacao: crm || 'calendly_sem_registro', conversao_realizada: c.conversao_realizada,
      presenca_origem: c.presenca ? 'manual' : null, respostas: [],
    },
    historico: [], emails: [], comentarios,
  });
}

// Presença de uma consultoria do Calendly, marcada à mão: grava na própria
// linha, comenta no card do ClickUp e manda "reunião realizada" ao Meta/GA4
// (mesmas regras da agenda própria, inclusive o prazo de 7 dias).
async function presencaCalendly(env, corpo, waitUntil) {
  if (!['realizada', 'faltou', 'sem_info'].includes(corpo.situacao)) return json({ error: 'Situação inválida.' }, 400);
  const c = await lerCalendly(env, corpo.id);
  if (!c) return json({ error: 'Reunião não encontrada.' }, 404);
  if (c.situacao !== 'ativa') return json({ error: 'Reunião cancelada não tem presença.' }, 409);
  if (c.inicio > agora()) return json({ error: 'A reunião ainda não aconteceu.' }, 409);
  await env.DB.prepare('UPDATE calendly_consultorias SET presenca = ?, presenca_em = ? WHERE invitee_uri = ?')
    .bind(corpo.situacao, agora(), c.invitee_uri).run();
  if (corpo.situacao === 'sem_info') return json({ ok: true });
  const reuniao = await reuniaoDoCalendly(env, c);
  await registrarNoCrm(env, reuniao, textoCrm(corpo.situacao, TIPO_CALENDLY, reuniao, '(marcado pela equipe no dash)'),
    (situacao) => env.DB.prepare('UPDATE calendly_consultorias SET crm_situacao = ? WHERE invitee_uri = ?').bind(situacao, c.invitee_uri).run().then(() => situacao));
  if (corpo.situacao === 'realizada') {
    await enviarRealizada(env, reuniao, waitUntil || (() => {}), {
      tabela: 'calendly_consultorias', chave: 'invitee_uri', eventId: `realizada-calendly-${c.invitee_uri.split('/').pop()}`,
    });
  }
  return json({ ok: true });
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!autorizado(new URL(request.url), env)) return json({ error: 'Unauthorized' }, 401);
  const corpo = await request.json().catch(() => ({}));
  if (corpo.acao === 'presenca' && String(corpo.id || '').startsWith(ID_CALENDLY)) return presencaCalendly(env, corpo, waitUntil);
  if (corpo.acao === 'comentar' && String(corpo.id || '').startsWith(ID_CALENDLY)) {
    const c = await lerCalendly(env, corpo.id);
    if (!c) return json({ error: 'Reunião não encontrada.' }, 404);
    const r = await comentar(env, await reuniaoDoCalendly(env, c), TIPO_CALENDLY, corpo.texto);
    return r.erro ? json({ error: r.erro }, 400) : json({ ok: true, comentarios: await lerComentarios(env, c.invitee_uri) });
  }
  const reuniao = await lerReuniao(env, { id: String(corpo.id || '') });
  if (!reuniao) return json({ error: 'Reunião não encontrada.' }, 404);
  const tipo = await lerTipo(env, { id: reuniao.tipo_id });

  if (corpo.acao === 'cancelar') {
    const r = await cancelar(env, reuniao, { por: 'equipe', motivo: corpo.motivo });
    if (r.erro) return json({ error: r.erro }, 409);
    await registrarNoCrm(env, reuniao, textoCrm('cancelou', tipo, reuniao, corpo.motivo ? `Motivo: ${corpo.motivo}` : 'Cancelada pela equipe.'));
    await depois(waitUntil, emailsDaMudanca(env, reuniao.id, 'cancelou'));
    return json({ ok: true });
  }

  if (corpo.acao === 'remarcar') {
    const r = await remarcar(env, reuniao, tipo, Number(corpo.inicio), { por: 'equipe' });
    if (r.erro) return json({ error: r.erro }, 409);
    await registrarNoCrm(env, reuniao, textoCrm('remarcou', tipo, { ...reuniao, inicio: r.inicio }));
    await depois(waitUntil, emailsDaMudanca(env, reuniao.id, 'remarcou'));
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
    if (corpo.situacao === 'realizada') await enviarRealizada(env, reuniao, waitUntil || (() => {}));
    return json({ ok: true });
  }

  if (corpo.acao === 'comentar') {
    const r = await comentar(env, reuniao, tipo, corpo.texto);
    return r.erro ? json({ error: r.erro }, 400) : json({ ok: true, comentarios: await lerComentarios(env, reuniao.id) });
  }

  return json({ error: 'Ação desconhecida.' }, 400);
}
