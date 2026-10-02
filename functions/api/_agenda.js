// Agenda própria: operações que juntam D1, Google e CRM (spec-agenda-propria.md).
// As regras puras ficam em _agenda-regras.js; aqui só se lê, chama e grava.
// Usado pelas rotas do dash (/api/agenda/*), da página pública
// (/api/agenda/publico/*) e pelo sync (/api/sync/agenda).
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

import {
  tipoDaLinha, horariosLivres, tituloDoEvento, SITUACOES_ATIVAS,
} from './_agenda-regras.js';
import {
  horariosOcupados, criarEvento, moverEvento, cancelarEvento, descreverEvento,
} from './_google-agenda.js';
import { ymdBrt, inicioDoDiaBrt } from './_data-brt.js';
import {
  CU_FIELD, clickupFetch, clickupWrite, searchClickUpTask, searchClickUpTaskPorTelefone,
} from './_clickup.js';
import { onRequestPost as tracker } from '../tracker.js';
import { isInternalTestEmail } from '../tracker.js';
import { tokenAleatorio } from './_agenda-convite.js';

export const agora = () => Math.floor(Date.now() / 1000);
export const SITE = 'https://atacadoexponencial.com';
// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export async function lerTipo(env, { id, slug }) {
  const l = id != null
    ? await env.DB.prepare('SELECT * FROM agenda_tipos WHERE id = ?').bind(Number(id)).first()
    : await env.DB.prepare('SELECT * FROM agenda_tipos WHERE slug = ?').bind(String(slug || '')).first();
  return tipoDaLinha(l);
}

export async function lerGrade(env, id) {
  const l = await env.DB.prepare('SELECT * FROM agenda_grades WHERE id = ?').bind(Number(id)).first();
  if (!l) return null;
  return { ...l, faixas: JSON.parse(l.faixas_json || '{}'), datas: JSON.parse(l.datas_json || '{}') };
}

/** calId → conta dona (o "subject" com que se fala com o Google). */
export async function contasDasAgendas(env) {
  const r = await env.DB.prepare('SELECT id, conta_email FROM agenda_calendarios').all();
  return new Map((r.results || []).map((c) => [c.id, c.conta_email]));
}

export async function lerReuniao(env, { id, tokenGestao }) {
  const l = id
    ? await env.DB.prepare('SELECT * FROM agenda_reunioes WHERE id = ?').bind(id).first()
    : await env.DB.prepare('SELECT * FROM agenda_reunioes WHERE token_gestao = ?').bind(String(tokenGestao || '')).first();
  if (!l) return null;
  return { ...l, respostas: JSON.parse(l.respostas_json || '[]') };
}

export async function historico(env, reuniaoId, acao, detalhe, por) {
  await env.DB.prepare(
    'INSERT INTO agenda_historico (reuniao_id, acao, detalhe, por, criado_em) VALUES (?, ?, ?, ?, ?)',
  ).bind(reuniaoId, acao, detalhe || null, por, agora()).run();
}

async function marcarSaudeAgenda(env, calId, erro) {
  if (erro) {
    await env.DB.prepare('UPDATE agenda_calendarios SET ultimo_erro = ?, ultimo_erro_em = ? WHERE id = ?')
      .bind(String(erro).slice(0, 300), agora(), calId).run();
  } else {
    await env.DB.prepare('UPDATE agenda_calendarios SET ultima_leitura_ok = ?, ultimo_erro = NULL WHERE id = ?')
      .bind(agora(), calId).run();
  }
}

// ---------------------------------------------------------------------------
// Horários livres
// ---------------------------------------------------------------------------

/**
 * Horários livres de um tipo entre os dias de/ate (YYYY-MM-DD, Brasília).
 * Agenda de conflito que não pôde ser lida NÃO é ignorada: sem ela não dá
 * para garantir que o horário está livre, então nada é oferecido.
 * Devolve { dias } ou { erro }.
 */
export async function calcularHorarios(env, tipo, { de, ate, ignorar = null }, fetchImpl = fetch) {
  const grade = await lerGrade(env, tipo.grade_id);
  if (!grade) return { erro: 'Tipo sem grade de disponibilidade.' };
  const contas = await contasDasAgendas(env);
  const t = agora();
  const hoje = ymdBrt(t);
  const fimJanela = ymdBrt(t + tipo.janela_dias * 86400);
  const deDia = de && de > hoje ? de : hoje;
  const ateDia = ate && ate < fimJanela ? ate : fimJanela;
  if (deDia > ateDia) return { dias: {} };
  const iniUnix = inicioDoDiaBrt(deDia);
  const fimUnix = inicioDoDiaBrt(ateDia) + 86400;

  // Uma consulta de freeBusy por conta dona (o Google só responde pelas
  // agendas que aquela conta enxerga).
  const porConta = new Map();
  for (const cal of new Set([...(tipo.conflito_cals || []), tipo.destino_cal])) {
    const conta = contas.get(cal);
    if (!conta) return { erro: 'Uma agenda do tipo não está mais conectada.' };
    if (!porConta.has(conta)) porConta.set(conta, []);
    porConta.get(conta).push(cal);
  }
  const ocupados = [];
  for (const [conta, cals] of porConta) {
    let r;
    try {
      r = await horariosOcupados(env, conta, cals, iniUnix, fimUnix, fetchImpl);
    } catch (e) {
      for (const c of cals) await marcarSaudeAgenda(env, c, e.message);
      return { erro: 'Não foi possível ler a agenda agora.' };
    }
    for (const c of cals) await marcarSaudeAgenda(env, c, r.erros[c] || null);
    if (Object.keys(r.erros).length) return { erro: 'Não foi possível ler a agenda agora.' };
    ocupados.push(...r.ocupados);
  }

  let reunioesNoDia = {};
  if (tipo.limite_dia) {
    const rs = await env.DB.prepare(
      `SELECT inicio FROM agenda_reunioes WHERE tipo_id = ? AND inicio >= ? AND inicio < ?
         AND situacao IN ('marcada','remarcada','realizada','faltou','sem_info')`,
    ).bind(tipo.id, iniUnix, fimUnix).all();
    for (const x of rs.results || []) {
      if (ignorar && x.inicio === ignorar.ini) continue;
      const d = ymdBrt(x.inicio);
      reunioesNoDia[d] = (reunioesNoDia[d] || 0) + 1;
    }
  }
  return { dias: horariosLivres({ tipo, grade, ocupados, reunioesNoDia, agora: t, de: deDia, ate: ateDia, ignorar }) };
}

/** Confere se um horário específico continua livre (reconsulta o Google). */
export async function horarioContinuaLivre(env, tipo, inicio, ignorar = null, fetchImpl = fetch) {
  const dia = ymdBrt(inicio);
  const r = await calcularHorarios(env, tipo, { de: dia, ate: dia, ignorar }, fetchImpl);
  if (r.erro) return { erro: r.erro };
  return { livre: (r.dias[dia] || []).includes(inicio) };
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

export const linkGestao = (token) => `${SITE}/reuniao/${token}`;

function descricaoDoEvento(tipo, reuniao) {
  const linhas = [
    `${tipo.nome} · ${tipo.duracao_min} min`,
    '',
    `Nome: ${reuniao.nome}`,
    `E-mail: ${reuniao.email}`,
    reuniao.telefone ? `WhatsApp: +${reuniao.telefone}` : '',
    ...(reuniao.respostas || []).filter((r) => r.resposta).map((r) => `${r.pergunta}: ${r.resposta}`),
    '',
    `Precisa remarcar ou cancelar? ${linkGestao(reuniao.token_gestao)}`,
  ];
  return linhas.filter((l, i) => l !== '' || linhas[i - 1] !== '').join('\n');
}

// ---------------------------------------------------------------------------
// Reservar
// ---------------------------------------------------------------------------

/**
 * Cria a reunião: reconfere o horário, cria o evento com Meet, grava.
 * `origem`: { convite, sessionId, ip }. Devolve { reuniao } ou { erro, codigo }.
 */
export async function reservar(env, tipo, inicio, dados, origem, fetchImpl = fetch) {
  const conf = await horarioContinuaLivre(env, tipo, inicio, null, fetchImpl);
  if (conf.erro) return { erro: conf.erro, codigo: 'agenda_indisponivel' };
  if (!conf.livre) return { erro: 'Esse horário acabou de ser ocupado. Escolha outro.', codigo: 'horario_ocupado' };

  const contas = await contasDasAgendas(env);
  const conta = contas.get(tipo.destino_cal);
  const fim = inicio + tipo.duracao_min * 60;
  const t = agora();
  const reuniao = {
    id: crypto.randomUUID(),
    tipo_id: tipo.id, inicio, fim,
    fuso_lead: dados.fuso || null,
    nome: dados.nome, email: dados.email, telefone: dados.telefone,
    respostas: dados.respostas,
    situacao: 'marcada',
    google_cal_id: tipo.destino_cal,
    comercial: tipo.comercial ? 1 : 0,
    funil: tipo.comercial ? (origem.convite?.funil || tipo.funil) : null,
    lead_event_id: origem.convite?.lead_event_id || null,
    session_id: origem.convite?.session_id || origem.sessionId || null,
    convite_token: origem.convite?.token || null,
    token_gestao: tokenAleatorio(),
    is_teste: isInternalTestEmail(dados.email) ? 1 : 0,
    ip: origem.ip || null,
  };

  let evento;
  try {
    evento = await criarEvento(env, conta, tipo.destino_cal, {
      titulo: tituloDoEvento(tipo.titulo_modelo, dados.nome),
      descricao: descricaoDoEvento(tipo, reuniao),
      ini: inicio, fim,
      convidado: { email: dados.email, nome: dados.nome },
    }, fetchImpl);
  } catch (e) {
    console.error('agenda: criar evento falhou', e.message);
    await marcarSaudeAgenda(env, tipo.destino_cal, e.message);
    return { erro: 'Não foi possível criar a reunião agora. Tente de novo em instantes.', codigo: 'google' };
  }
  reuniao.google_event_id = evento.id;
  reuniao.meet_link = evento.meet;

  await env.DB.prepare(
    `INSERT INTO agenda_reunioes (id, tipo_id, inicio, fim, fuso_lead, nome, email, telefone, respostas_json,
       situacao, google_cal_id, google_event_id, meet_link, comercial, funil, lead_event_id, session_id,
       convite_token, token_gestao, is_teste, ip, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    reuniao.id, reuniao.tipo_id, inicio, fim, reuniao.fuso_lead, reuniao.nome, reuniao.email, reuniao.telefone,
    JSON.stringify(reuniao.respostas), 'marcada', reuniao.google_cal_id, reuniao.google_event_id, reuniao.meet_link,
    reuniao.comercial, reuniao.funil, reuniao.lead_event_id, reuniao.session_id, reuniao.convite_token,
    reuniao.token_gestao, reuniao.is_teste, reuniao.ip, t, t,
  ).run();
  await historico(env, reuniao.id, 'agendou', `${tipo.nome} · ${fmtQuando(inicio)}`, 'lead');
  return { reuniao };
}

export function fmtQuando(unix) {
  return new Date(unix * 1000).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Cancelar / remarcar
// ---------------------------------------------------------------------------

export async function cancelar(env, reuniao, { por, motivo }, fetchImpl = fetch) {
  if (!SITUACOES_ATIVAS.includes(reuniao.situacao)) return { erro: 'Esta reunião não está mais marcada.' };
  const contas = await contasDasAgendas(env);
  try {
    await cancelarEvento(env, contas.get(reuniao.google_cal_id), reuniao.google_cal_id, reuniao.google_event_id, fetchImpl);
  } catch (e) {
    console.error('agenda: cancelar evento falhou', e.message);
    return { erro: 'Não foi possível cancelar na agenda agora. Tente de novo em instantes.' };
  }
  const m = String(motivo || '').trim().slice(0, 500) || null;
  await env.DB.prepare(
    "UPDATE agenda_reunioes SET situacao = 'cancelada', motivo_cancel = ?, atualizado_em = ? WHERE id = ?",
  ).bind(m, agora(), reuniao.id).run();
  await historico(env, reuniao.id, 'cancelou', m, por);
  return { ok: true };
}

export async function remarcar(env, reuniao, tipo, novoInicio, { por }, fetchImpl = fetch) {
  if (!SITUACOES_ATIVAS.includes(reuniao.situacao)) return { erro: 'Esta reunião não está mais marcada.' };
  const ignorar = { ini: reuniao.inicio, fim: reuniao.fim };
  const conf = await horarioContinuaLivre(env, tipo, novoInicio, ignorar, fetchImpl);
  if (conf.erro) return { erro: conf.erro };
  if (!conf.livre) return { erro: 'Esse horário acabou de ser ocupado. Escolha outro.', codigo: 'horario_ocupado' };
  const novoFim = novoInicio + (reuniao.fim - reuniao.inicio);
  const contas = await contasDasAgendas(env);
  try {
    await moverEvento(env, contas.get(reuniao.google_cal_id), reuniao.google_cal_id, reuniao.google_event_id, novoInicio, novoFim, fetchImpl);
  } catch (e) {
    console.error('agenda: mover evento falhou', e.message);
    return { erro: 'Não foi possível mudar na agenda agora. Tente de novo em instantes.' };
  }
  await env.DB.prepare(
    "UPDATE agenda_reunioes SET inicio = ?, fim = ?, situacao = 'remarcada', atualizado_em = ? WHERE id = ?",
  ).bind(novoInicio, novoFim, agora(), reuniao.id).run();
  await historico(env, reuniao.id, 'remarcou', `${fmtQuando(reuniao.inicio)} → ${fmtQuando(novoInicio)}`, por);
  return { ok: true, inicio: novoInicio, fim: novoFim };
}

/** Grava o link de remarcar/cancelar na descrição do evento (depois de criar). */
export async function atualizarDescricao(env, tipo, reuniao, fetchImpl = fetch) {
  const contas = await contasDasAgendas(env);
  try {
    await descreverEvento(env, contas.get(reuniao.google_cal_id), reuniao.google_cal_id, reuniao.google_event_id,
      descricaoDoEvento(tipo, reuniao), fetchImpl);
  } catch (e) {
    console.error('agenda: descrição do evento', e.message);
  }
}

// ---------------------------------------------------------------------------
// CRM (só reuniões comerciais)
// ---------------------------------------------------------------------------

/**
 * Registra a reunião no card do lead no ClickUp (o card nasceu no formulário).
 * Procura por e-mail e depois por telefone. Nunca cria card: agendar não é
 * lead (decisão de 02/10). Devolve a situação gravada na reunião.
 */
export async function registrarNoCrm(env, reuniao, texto) {
  if (!reuniao.comercial) return null;
  if (!env.CLICKUP_API_TOKEN) return gravarCrm(env, reuniao.id, 'sem_credencial');
  let card = null;
  try {
    card = await searchClickUpTask(CU_FIELD.email, reuniao.email, env)
      || (reuniao.telefone ? await searchClickUpTaskPorTelefone(CU_FIELD.whatsapp, reuniao.telefone, env) : null);
  } catch (e) {
    return gravarCrm(env, reuniao.id, 'erro: ' + e.message);
  }
  if (!card) return gravarCrm(env, reuniao.id, 'sem_card');
  try {
    await clickupWrite(() => clickupFetch(`/task/${card.id}/comment`, {
      method: 'POST',
      body: JSON.stringify({ comment_text: texto, notify_all: false }),
    }, env));
  } catch (e) {
    return gravarCrm(env, reuniao.id, 'erro: ' + e.message);
  }
  return gravarCrm(env, reuniao.id, 'ok:' + card.id);
}

async function gravarCrm(env, id, situacao) {
  await env.DB.prepare('UPDATE agenda_reunioes SET crm_situacao = ? WHERE id = ?').bind(situacao, id).run();
  return situacao;
}

export function textoCrm(acao, tipo, reuniao, extra = '') {
  const quando = fmtQuando(reuniao.inicio);
  const base = {
    agendou: `📅 Reunião agendada: ${tipo.nome} · ${quando}\nMeet: ${reuniao.meet_link || '—'}`,
    remarcou: `🔁 Reunião remarcada: ${tipo.nome} · agora ${quando}`,
    cancelou: `❌ Reunião cancelada: ${tipo.nome} · ${quando}`,
    realizada: `✅ Compareceu à reunião: ${tipo.nome} · ${quando}`,
    faltou: `⚠️ Faltou à reunião: ${tipo.nome} · ${quando}`,
  }[acao] || acao;
  const respostas = acao === 'agendou'
    ? (reuniao.respostas || []).filter((r) => r.resposta).map((r) => `${r.pergunta}: ${r.resposta}`).join('\n')
    : '';
  return [base, respostas, extra].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// Conversão Schedule (só reuniões comerciais)
// ---------------------------------------------------------------------------

/**
 * Manda o Schedule pelo MESMO caminho dos outros eventos: o /tracker (pixel
 * atual, GA4, fila de reenvio do Meta, event_log, bloqueios). Chamado do
 * servidor, com os cookies e o IP do lead, para a conversão não depender do
 * navegador. O navegador espelha com fbq e o mesmo event_id (dedup do Meta).
 */
export async function enviarSchedule(context, reuniao, eventId) {
  const { request, env } = context;
  if (!reuniao.comercial) return null;
  const headers = new Headers();
  for (const h of ['cookie', 'user-agent', 'cf-connecting-ip', 'x-forwarded-for']) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set('content-type', 'application/json');
  const corpo = {
    event_name: 'Schedule',
    event_id: eventId,
    event_time: agora(),
    event_source_url: request.headers.get('referer') || `${SITE}/agendar`,
    user_data: { em: reuniao.email, ph: reuniao.telefone, fn: reuniao.nome },
    lead_data: { funnel: reuniao.funil || '' },
  };
  let situacao;
  try {
    const r = await tracker({
      request: new Request(`${SITE}/tracker`, { method: 'POST', headers, body: JSON.stringify(corpo) }),
      env,
      waitUntil: context.waitUntil ? context.waitUntil.bind(context) : () => {},
    });
    situacao = r.ok ? 'enviado' : 'erro: HTTP ' + r.status;
  } catch (e) {
    situacao = 'erro: ' + e.message;
  }
  await env.DB.prepare('UPDATE agenda_reunioes SET conversao_situacao = ? WHERE id = ?').bind(situacao, reuniao.id).run();
  return situacao;
}
