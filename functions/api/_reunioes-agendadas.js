// Reuniões agendadas do período: agenda própria + consultorias do Calendly
// (spec-reunioes-calendly.md, issue S2-02). Fonte única do card "Reuniões
// agendadas" e do custo por reunião (/api/cpl) e do MQL → RA (/api/agenda/taxas).
//
// Regras:
//   - conta pela data em que a pessoa agendou;
//   - agenda própria: comercial, sem teste e sem tipo de teste (SUP-S2-09);
//   - Calendly: só consultoria ativa e agendada pelo próprio lead (a equipe
//     marcando em nome do lead não conta; remarcação conta a nova, SUP-S2-07);
//   - a mesma pessoa (e-mail) no Calendly e na agenda própria conta uma vez;
//   - funil da reunião = o do lead com o mesmo e-mail, pela regra única de
//     _funil-lead.js (spec-funil-pela-utm.md: nas portas da SE a origem
//     decide). Sem lead: o funil gravado na agenda própria (porta vira o funil
//     de verdade) ou, no Calendly, SE.
//
// Calendly com erro (tabela ausente, etc.) não derruba nada: devolve só a
// agenda própria. Erro da agenda própria sobe, como antes.

import { listarFunisConhecidos } from './_funil-campanha.js';
import { funilDoLead, carregarMapaCampanhas, normalizarFunil } from './_funil-lead.js';
import { CORTE_CALENDLY, DURACAO_CALENDLY } from './_agenda-regras.js';

export const FUNIL_SEM_LEAD = 'sessao-estrategica';
// D1 limita parâmetros por consulta; `IN (?, …)` explícito é o que usa o
// índice idx_event_log_lead_email (ver _feedback-marketing-greenn.js).
const LOTE = 50;

const normalizar = (email) => String(email || '').trim().toLowerCase();

/**
 * Funil de uma consultoria. `leads`: [{ funil, timestamp }] do mesmo e-mail.
 * Vale o lead mais recente até a hora do agendamento; sem nenhum antes, o mais
 * recente de todos (SUP-S2-04). Sem lead, SE.
 */
export function funilDaReuniao(agendouEm, leads) {
  const comFunil = (leads || []).filter((l) => l.funil);
  if (!comFunil.length) return FUNIL_SEM_LEAD;
  const antes = comFunil.filter((l) => l.timestamp <= agendouEm);
  const base = antes.length ? antes : comFunil;
  return base.reduce((a, b) => (b.timestamp > a.timestamp ? b : a)).funil;
}

/** { email: [{ funil, timestamp }] } dos leads com esses e-mails (exatos, em minúsculas, SUP-S2-08). */
async function leadsPorEmail(DB, emails) {
  const porEmail = new Map();
  if (!emails.length) return porEmail;
  const funisConhecidos = await listarFunisConhecidos(DB);
  const mapa = await carregarMapaCampanhas(DB, funisConhecidos);
  for (let i = 0; i < emails.length; i += LOTE) {
    const lote = emails.slice(i, i + LOTE);
    const { results } = await DB.prepare(`
      SELECT e.raw_email AS email, COALESCE(NULLIF(e.funnel, ''), s.funnel) AS funnel, e.material,
             s.utm_source, s.utm_campaign, e.timestamp
        FROM event_log e
        LEFT JOIN sessions s ON e.session_id = s.session_id
       WHERE e.event_name = 'Lead' AND e.raw_email IN (${lote.map(() => '?').join(', ')})
         AND e.is_bot = 0 AND COALESCE(e.is_junk, 0) = 0`,
    ).bind(...lote).all();
    for (const r of results || []) {
      if (!porEmail.has(r.email)) porEmail.set(r.email, []);
      porEmail.get(r.email).push({ funil: funilDoLead(r, mapa, funisConhecidos), timestamp: r.timestamp });
    }
  }
  return porEmail;
}

async function consultoriasDoCalendly(DB, de, ate) {
  try {
    const { results } = await DB.prepare(`
      SELECT email, agendou_em FROM calendly_consultorias
       WHERE situacao = 'ativa' AND marcada_pela_equipe = 0 AND agendou_em >= ? AND agendou_em <= ?`,
    ).bind(de, ate).all();
    return results || [];
  } catch (e) {
    console.error('reuniões agendadas: Calendly', e.message);
    return [];
  }
}

/**
 * Quais destes e-mails têm reunião agendada pelo próprio lead a partir de `desde`
 * (sem limite no fim): consultoria ativa do Calendly ou reunião não cancelada da
 * agenda própria. É o numerador do MQL → RA por coorte. Calendly com erro conta
 * só a agenda própria.
 */
export async function emailsComReuniao(DB, emails, desde) {
  const lista = [...new Set((emails || []).map(normalizar).filter(Boolean))];
  const com = new Set();
  if (!lista.length) return com;
  const { results: agenda } = await DB.prepare(`
    SELECT email FROM agenda_reunioes
     WHERE comercial = 1 AND is_teste = 0 AND situacao != 'cancelada' AND criado_em >= ?
       AND tipo_id NOT IN (SELECT id FROM agenda_tipos WHERE teste = 1)`,
  ).bind(desde).all();
  const procurados = new Set(lista);
  for (const r of agenda || []) if (procurados.has(normalizar(r.email))) com.add(normalizar(r.email));
  try {
    for (let i = 0; i < lista.length; i += LOTE) {
      const lote = lista.slice(i, i + LOTE);
      const { results } = await DB.prepare(`
        SELECT DISTINCT email FROM calendly_consultorias
         WHERE situacao = 'ativa' AND marcada_pela_equipe = 0 AND agendou_em >= ?
           AND email IN (${lote.map(() => '?').join(', ')})`,
      ).bind(desde, ...lote).all();
      for (const r of results || []) com.add(r.email);
    }
  } catch (e) {
    console.error('reuniões agendadas: Calendly (coorte)', e.message);
  }
  return com;
}

/**
 * Funil de cada reunião pelo lead do mesmo e-mail. `itens` = [{ email, quando,
 * funil }] (`funil` = o gravado, usado só quando não há lead). Sem a busca dos
 * leads, vale o gravado.
 */
export async function funisDasReunioes(DB, itens) {
  let leads = new Map();
  try {
    leads = await leadsPorEmail(DB, [...new Set((itens || []).map((i) => normalizar(i.email)).filter(Boolean))]);
  } catch (e) {
    console.error('reuniões: funil por e-mail', e.message);
  }
  return (itens || []).map((i) => {
    const doLead = leads.get(normalizar(i.email));
    if (doLead && doLead.some((l) => l.funil)) return { funil: funilDaReuniao(i.quando, doLead) };
    return { funil: normalizarFunil(i.funil) || FUNIL_SEM_LEAD };
  });
}

/** [{ funil }] das reuniões agendadas entre `de` e `ate` (unix, inclusivo). */
export async function reunioesAgendadas(DB, de, ate) {
  const { results: agenda } = await DB.prepare(`
    SELECT COALESCE(funil, '') AS funil, email, criado_em FROM agenda_reunioes
     WHERE comercial = 1 AND is_teste = 0 AND criado_em >= ? AND criado_em <= ?
       AND tipo_id NOT IN (SELECT id FROM agenda_tipos WHERE teste = 1)`,
  ).bind(de, ate).all();
  const naAgenda = new Set((agenda || []).map((r) => normalizar(r.email)));

  const calendly = (await consultoriasDoCalendly(DB, de, ate))
    .filter((c) => !naAgenda.has(normalizar(c.email)));
  // Sem a busca do funil, a reunião ainda conta (agenda: o funil gravado;
  // Calendly: SE).
  return funisDasReunioes(DB, [
    ...(agenda || []).map((r) => ({ email: r.email, quando: r.criado_em, funil: r.funil })),
    ...calendly.map((c) => ({ email: c.email, quando: c.agendou_em, funil: FUNIL_SEM_LEAD })),
  ]);
}

/**
 * [{ funil }] das reuniões REALIZADAS entre `de` e `ate` (unix, inclusivo),
 * pela data da reunião: agenda própria comercial com situação realizada + as
 * consultorias do Calendly com presença "realizada" marcada no dash (só a
 * partir de 19/10/2026, quando a presença passou a ser marcada; série S4).
 * Funil pelo lead do mesmo e-mail, como nas agendadas. Calendly com erro conta
 * só a agenda própria.
 */
export async function reunioesRealizadas(DB, de, ate) {
  const { results: agenda } = await DB.prepare(`
    SELECT COALESCE(funil, '') AS funil, email, criado_em FROM agenda_reunioes
     WHERE comercial = 1 AND is_teste = 0 AND situacao = 'realizada' AND inicio >= ? AND inicio <= ?`,
  ).bind(de, ate).all();
  const itens = (agenda || []).map((x) => ({ email: x.email, quando: x.criado_em, funil: x.funil }));
  try {
    const { results } = await DB.prepare(`
      SELECT email, agendou_em FROM calendly_consultorias
       WHERE situacao = 'ativa' AND presenca = 'realizada' AND inicio >= ? AND inicio >= ? AND inicio <= ?`,
    ).bind(CORTE_CALENDLY, de, ate).all();
    for (const c of results || []) itens.push({ email: c.email, quando: c.agendou_em, funil: '' });
  } catch (e) {
    console.error('reuniões realizadas: Calendly', e.message);
  }
  return funisDasReunioes(DB, itens);
}

// ---------------------------------------------------------------------------
// Coorte de agendamento (Visão geral, ajuste de 26/10): as reuniões agendadas
// no período (a mesma seleção de reunioesAgendadas) e o que aconteceu com
// cada uma ATÉ AGORA, em qualquer data. Assim RA → RR fala dos mesmos leads
// que agendaram, em vez de misturar reuniões de outras semanas.
//   status: realizada | faltou | cancelada | a_acontecer | sem_presenca | fora_do_registro
//   (sem_presenca = já passou e ninguém marcou; sem_info conta aqui.
//   fora_do_registro = consultoria do Calendly de antes de 19/10/2026, quando a
//   presença do Calendly ainda não era marcada no dash; decisão dela em 26/10:
//   não marcar as antigas, e elas ficam fora do RA → RR)
// ---------------------------------------------------------------------------
export const STATUS_COORTE = ['realizada', 'faltou', 'cancelada', 'a_acontecer', 'sem_presenca', 'fora_do_registro'];

export function statusNaCoorte({ situacao, presenca, inicio, fim, origem }, agora) {
  if (origem === 'calendly') {
    if (presenca === 'realizada' || presenca === 'faltou') return presenca;
    if (presenca === 'sem_info') return 'sem_presenca';
    if (fim > agora) return 'a_acontecer';
    return inicio < CORTE_CALENDLY ? 'fora_do_registro' : 'sem_presenca';
  }
  if (situacao === 'cancelada') return 'cancelada';
  if (situacao === 'realizada' || situacao === 'faltou') return situacao;
  if (situacao === 'sem_info') return 'sem_presenca';
  return fim > agora ? 'a_acontecer' : 'sem_presenca';
}

/** [{ funil, status }] das reuniões agendadas entre `de` e `ate` (unix, inclusivo). */
export async function coorteDasAgendadas(DB, de, ate, agora) {
  const { results: agenda } = await DB.prepare(`
    SELECT COALESCE(funil, '') AS funil, email, criado_em, situacao, fim FROM agenda_reunioes
     WHERE comercial = 1 AND is_teste = 0 AND criado_em >= ? AND criado_em <= ?
       AND tipo_id NOT IN (SELECT id FROM agenda_tipos WHERE teste = 1)`,
  ).bind(de, ate).all();
  const naAgenda = new Set((agenda || []).map((r) => normalizar(r.email)));
  let calendly = [];
  try {
    const { results } = await DB.prepare(`
      SELECT email, agendou_em, presenca, inicio, COALESCE(fim, inicio + ?) AS fim FROM calendly_consultorias
       WHERE situacao = 'ativa' AND marcada_pela_equipe = 0 AND agendou_em >= ? AND agendou_em <= ?`,
    ).bind(DURACAO_CALENDLY, de, ate).all();
    calendly = (results || []).filter((c) => !naAgenda.has(normalizar(c.email)));
  } catch (e) {
    console.error('coorte: Calendly', e.message);
  }
  const itens = [
    ...(agenda || []).map((r) => ({ email: r.email, quando: r.criado_em, funil: r.funil, status: statusNaCoorte(r, agora) })),
    ...calendly.map((c) => ({ email: c.email, quando: c.agendou_em, funil: FUNIL_SEM_LEAD, status: statusNaCoorte({ ...c, origem: 'calendly' }, agora) })),
  ];
  const funis = await funisDasReunioes(DB, itens);
  return itens.map((x, i) => ({ funil: funis[i].funil, status: x.status }));
}

/** { total, por_funil } com { agendadas, realizada, faltou, cancelada, a_acontecer, sem_presenca, fora_do_registro }. */
export function resumirCoorte(lista) {
  const zero = () => Object.fromEntries([['agendadas', 0], ...STATUS_COORTE.map((s) => [s, 0])]);
  const total = zero();
  const por_funil = {};
  for (const { funil, status } of lista || []) {
    const f = funil || 'sem-funil';
    por_funil[f] = por_funil[f] || zero();
    for (const alvo of [total, por_funil[f]]) { alvo.agendadas += 1; alvo[status] += 1; }
  }
  return { total, por_funil };
}
