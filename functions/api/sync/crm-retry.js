// POST /api/sync/crm-retry — varredor de envios ao ClickUp (issue 126).
//
// Re-tenta linhas de lead_dispatch em 'pendente' (worker morreu no meio) ou
// 'falha' com mais de 15 minutos, usando o lead_json guardado. Máx. 5
// tentativas por lead; até 10 leads por execução. Disparado pelo cron externo
// (mesmo padrão dos demais syncs: header x-sync-secret = env.SYNC_SECRET).
//
// Nota: se a tentativa original chegou a criar a tarefa antes de morrer, o
// retry encontra a tarefa no dedup (busca por tel/email) e vira 'comentado' —
// sem duplicar card.
import { sendToClickUp } from '../../tracker.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const secret = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || secret !== env.SYNC_SECRET) {
    return json({ error: 'unauthorized' }, 401);
  }

  const { results } = await env.DB.prepare(
    `SELECT id, event_id, lead_json, tentativas FROM lead_dispatch
     WHERE resultado IN ('pendente', 'falha')
       AND lead_json IS NOT NULL
       AND criado_em < strftime('%s','now') - 900
       AND tentativas < 5
     ORDER BY id LIMIT 10`
  ).all();

  const saida = [];
  for (const row of results) {
    let payload;
    try { payload = JSON.parse(row.lead_json); } catch { payload = null; }
    if (!payload || !payload.leadData) {
      await env.DB.prepare('UPDATE lead_dispatch SET tentativas = 5, erro = ? WHERE id = ?')
        .bind('retry: lead_json ilegível', row.id).run();
      saida.push({ id: row.id, resultado: 'descartado' });
      continue;
    }
    await env.DB.prepare('UPDATE lead_dispatch SET tentativas = tentativas + 1 WHERE id = ?').bind(row.id).run();
    await sendToClickUp({
      leadData: payload.leadData,
      sessionData: payload.sessionData || {},
      env,
      eventId: row.event_id || '',
      dispatchId: row.id,
    });
    const depois = await env.DB.prepare('SELECT resultado FROM lead_dispatch WHERE id = ?').bind(row.id).first();
    saida.push({ id: row.id, resultado: depois ? depois.resultado : '?' });
  }

  return json({ ok: true, reprocessados: saida.length, detalhes: saida });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
