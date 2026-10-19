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
//   - funil da consultoria = o do lead com o mesmo e-mail; sem lead, SE.
//
// Calendly com erro (tabela ausente, etc.) não derruba nada: devolve só a
// agenda própria. Erro da agenda própria sobe, como antes.

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
  for (let i = 0; i < emails.length; i += LOTE) {
    const lote = emails.slice(i, i + LOTE);
    const { results } = await DB.prepare(`
      SELECT e.raw_email AS email, COALESCE(NULLIF(e.funnel, ''), s.funnel) AS funil, e.timestamp
        FROM event_log e
        LEFT JOIN sessions s ON e.session_id = s.session_id
       WHERE e.event_name = 'Lead' AND e.raw_email IN (${lote.map(() => '?').join(', ')})
         AND e.is_bot = 0 AND COALESCE(e.is_junk, 0) = 0`,
    ).bind(...lote).all();
    for (const r of results || []) {
      if (!porEmail.has(r.email)) porEmail.set(r.email, []);
      porEmail.get(r.email).push({ funil: r.funil, timestamp: r.timestamp });
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

/** [{ funil }] das reuniões agendadas entre `de` e `ate` (unix, inclusivo). */
export async function reunioesAgendadas(DB, de, ate) {
  const { results: agenda } = await DB.prepare(`
    SELECT COALESCE(funil, '') AS funil, email FROM agenda_reunioes
     WHERE comercial = 1 AND is_teste = 0 AND criado_em >= ? AND criado_em <= ?
       AND tipo_id NOT IN (SELECT id FROM agenda_tipos WHERE teste = 1)`,
  ).bind(de, ate).all();
  const naAgenda = new Set((agenda || []).map((r) => normalizar(r.email)));

  const calendly = (await consultoriasDoCalendly(DB, de, ate))
    .filter((c) => !naAgenda.has(normalizar(c.email)));
  let leads = new Map();
  if (calendly.length) {
    try {
      leads = await leadsPorEmail(DB, [...new Set(calendly.map((c) => normalizar(c.email)))]);
    } catch (e) {
      // Sem a busca do funil, a consultoria ainda conta (cai na SE).
      console.error('reuniões agendadas: funil por e-mail', e.message);
    }
  }
  return [
    ...(agenda || []).map((r) => ({ funil: r.funil })),
    ...calendly.map((c) => ({ funil: funilDaReuniao(c.agendou_em, leads.get(normalizar(c.email))) })),
  ];
}
