// GET /api/workshops?key=...
//
// Presença nos workshops para a aba "Workshops" do dash. Lê SÓ do D1
// (workshops / workshop_registrants / workshop_participants), alimentado por
// /api/sync/workshops. Métrica por CONTAGEM (sem casamento por nome):
//   inscritos = nº de inscritos no Calendly
//   presentes = nº de participantes no Meet (equipe interna já excluída na coleta)
//   taxa      = presentes / inscritos
// O detalhe é a lista de quem esteve presente (nome do Meet + tempo + recorrência).

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const { results: ws } = await env.DB.prepare(
    `SELECT id, title, started_at FROM workshops ORDER BY started_at DESC LIMIT 60`
  ).all();

  const { results: regCounts } = await env.DB.prepare(
    `SELECT workshop_id, COUNT(*) AS n FROM workshop_registrants GROUP BY workshop_id`
  ).all();

  const { results: parts } = await env.DB.prepare(
    `SELECT workshop_id, google_user_id, display_name, total_minutes
     FROM workshop_participants`
  ).all();

  // recorrência: nº de workshops distintos em que cada google_user_id apareceu
  const recorrencia = {};
  for (const p of parts) {
    recorrencia[p.google_user_id] = (recorrencia[p.google_user_id] || 0) + 1;
  }

  const regByW = {};
  for (const r of regCounts) regByW[r.workshop_id] = r.n;
  const partsByW = groupBy(parts, 'workshop_id');

  const rows = (ws || []).map((w) => {
    const wParts = partsByW[w.id] || [];
    const registered = regByW[w.id] || 0;
    const attended = wParts.length;
    const allMinutes = wParts.map((p) => p.total_minutes || 0);
    const avg_minutes = allMinutes.length
      ? Math.round(allMinutes.reduce((a, b) => a + b, 0) / allMinutes.length) : 0;

    const presentes = wParts
      .map((p) => ({
        display_name: p.display_name,
        minutes: p.total_minutes || 0,
        recorrencia: recorrencia[p.google_user_id] || 1,
      }))
      .sort((a, b) => b.minutes - a.minutes);

    return {
      id: w.id, title: w.title, started_at: w.started_at,
      registered, attended,
      attendance_rate: registered ? (attended / registered) * 100 : null,
      avg_minutes,
      presentes,
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
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
