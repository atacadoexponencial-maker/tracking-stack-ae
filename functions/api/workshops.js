// GET /api/workshops?key=...
//
// Presença nos workshops para a aba "Workshops" do dash. Lê SÓ do D1
// (workshops / workshop_registrants / workshop_participants), alimentado por
// /api/sync/workshops. Métricas (taxa de presença, tempo médio) são derivadas
// aqui. Grupos: Presentes (compareceu+inscrito), Faltaram (inscrito sem
// participante), Sem inscrição (participante sem inscrição).

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const { results: ws } = await env.DB.prepare(
    `SELECT id, title, started_at FROM workshops ORDER BY started_at DESC LIMIT 60`
  ).all();

  const { results: regs } = await env.DB.prepare(
    `SELECT workshop_id, name, email FROM workshop_registrants`
  ).all();

  const { results: parts } = await env.DB.prepare(
    `SELECT workshop_id, google_user_id, display_name, total_minutes, registrant_email
     FROM workshop_participants`
  ).all();

  // recorrência: nº de workshops distintos em que cada google_user_id apareceu
  const recorrencia = {};
  for (const p of parts) {
    recorrencia[p.google_user_id] = (recorrencia[p.google_user_id] || 0) + 1;
  }

  const regsByW = groupBy(regs, 'workshop_id');
  const partsByW = groupBy(parts, 'workshop_id');

  const rows = (ws || []).map((w) => {
    const wRegs = regsByW[w.id] || [];
    const wParts = partsByW[w.id] || [];
    const matchedEmails = new Set(wParts.filter((p) => p.registrant_email).map((p) => p.registrant_email));

    const presentes = wParts
      .filter((p) => p.registrant_email)
      .map((p) => ({
        name: nameFor(p.registrant_email, wRegs) || p.display_name,
        email: p.registrant_email,
        minutes: p.total_minutes || 0,
        recorrencia: recorrencia[p.google_user_id] || 1,
      }));
    const faltaram = wRegs
      .filter((r) => !matchedEmails.has(r.email))
      .map((r) => ({ name: r.name, email: r.email }));
    const sem_inscricao = wParts
      .filter((p) => !p.registrant_email)
      .map((p) => ({ display_name: p.display_name, minutes: p.total_minutes || 0 }));

    const registered = wRegs.length;
    const attended = presentes.length;
    const allMinutes = wParts.map((p) => p.total_minutes || 0);
    const avg_minutes = allMinutes.length
      ? Math.round(allMinutes.reduce((a, b) => a + b, 0) / allMinutes.length) : 0;

    return {
      id: w.id, title: w.title, started_at: w.started_at,
      registered, attended,
      attendance_rate: registered ? (attended / registered) * 100 : null,
      avg_minutes,
      presentes, faltaram, sem_inscricao,
    };
  });

  const last = await env.DB.prepare(`SELECT MAX(synced_at) AS ultimo FROM workshops`).first();
  return json({ rows, last_synced_at: last?.ultimo || null });
}

function groupBy(arr, key) {
  const out = {};
  for (const item of arr) (out[item[key]] = out[item[key]] || []).push(item);
  return out;
}
function nameFor(email, regs) {
  const r = regs.find((x) => x.email === email);
  return r ? r.name : null;
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
