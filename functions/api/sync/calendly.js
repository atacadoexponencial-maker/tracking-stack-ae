// POST /api/sync/calendly — cópia diária das consultorias do Calendly
// (spec-reunioes-calendly.md, issue S2-01).
//
// Recebe o que o coletor da VPS (scripts/calendly-sync) leu do Calendly e grava
// em calendly_consultorias. NÃO chama o Calendly: a busca é na VPS, porque a
// carga pede uma chamada por agendamento e o plano Free do Pages limita as
// subrequisições por chamada.
//
// Corpo: { eventos: [{ uri, status, start_time, convidados: [{ uri, email,
//   created_at, status, invitee_scheduled_by, rescheduled }] }] }
// (o coletor já filtrou só as "Consultoria Individual").
//
// Gravação numa consulta só (INSERT … SELECT FROM json_each): o plano Free
// também limita as consultas ao D1 por chamada. Nunca apaga linha.
//
// Auth: header `x-sync-secret: <env.SYNC_SECRET>` (mesmo secret dos outros syncs).

const json = (dados, status = 200) => Response.json(dados, { status });
const unix = (iso) => {
  const ms = Date.parse(iso || '');
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
};

/** Uma linha por convidado. Convidado sem uri ou sem data de agendamento fica de fora. */
export function linhasDasConsultorias(eventos, agora) {
  const linhas = [];
  for (const ev of eventos) {
    for (const c of ev.convidados || []) {
      const agendou = unix(c.created_at);
      if (!c.uri || agendou === null) continue;
      linhas.push({
        invitee_uri: c.uri,
        event_uri: ev.uri || '',
        email: String(c.email || '').trim().toLowerCase(),
        agendou_em: agendou,
        inicio: unix(ev.start_time),
        // Evento cancelado inteiro (pela equipe) cancela todos os convidados.
        situacao: c.status === 'canceled' || ev.status === 'canceled' ? 'cancelada' : 'ativa',
        marcada_pela_equipe: c.invitee_scheduled_by ? 1 : 0,
        remarcada: c.rescheduled ? 1 : 0,
        atualizado_em: agora,
      });
    }
  }
  return linhas;
}

export async function onRequestPost({ request, env }) {
  const sent = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || sent !== env.SYNC_SECRET) return json({ error: 'Unauthorized' }, 401);
  if (!env.DB) return json({ error: 'DB unavailable' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400); }
  if (!body || !Array.isArray(body.eventos)) return json({ error: 'eventos ausente' }, 400);

  const linhas = linhasDasConsultorias(body.eventos, Math.floor(Date.now() / 1000));
  if (linhas.length) {
    // `WHERE true`: sem ele o SQLite lê o ON CONFLICT como parte do SELECT.
    await env.DB.prepare(`
      INSERT INTO calendly_consultorias
        (invitee_uri, event_uri, email, agendou_em, inicio, situacao, marcada_pela_equipe, remarcada, atualizado_em)
      SELECT json_extract(value, '$.invitee_uri'), json_extract(value, '$.event_uri'), json_extract(value, '$.email'),
             json_extract(value, '$.agendou_em'), json_extract(value, '$.inicio'), json_extract(value, '$.situacao'),
             json_extract(value, '$.marcada_pela_equipe'), json_extract(value, '$.remarcada'), json_extract(value, '$.atualizado_em')
        FROM json_each(?) WHERE true
      ON CONFLICT(invitee_uri) DO UPDATE SET
        event_uri = excluded.event_uri, email = excluded.email, agendou_em = excluded.agendou_em,
        inicio = excluded.inicio, situacao = excluded.situacao, marcada_pela_equipe = excluded.marcada_pela_equipe,
        remarcada = excluded.remarcada, atualizado_em = excluded.atualizado_em`,
    ).bind(JSON.stringify(linhas)).run();
  }
  return json({
    ok: true,
    consultorias: linhas.length,
    ativas: linhas.filter((l) => l.situacao === 'ativa').length,
  });
}
