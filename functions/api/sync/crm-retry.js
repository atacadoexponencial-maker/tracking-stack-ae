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

  // Varredor (revisão 2026-09-13): 'pendente' SEM lead_json é um estado que
  // não sai sozinho — o payload já foi descartado (sucesso limpa o JSON) mas o
  // resultado não foi atualizado (worker morreu entre uma coisa e outra), ou a
  // linha nasceu sem payload. Este retry filtra `lead_json IS NOT NULL`, então
  // essas linhas nunca eram tocadas e ficavam "pendentes" para sempre no funil
  // do CRM (os 49 pendentes invisíveis do check-up de 2026-09-04). Uma hora de
  // tolerância cobre uma tentativa legitimamente em andamento.
  const varridas = await env.DB.prepare(
    `UPDATE lead_dispatch SET resultado = 'falha', erro = 'pendente sem payload'
      WHERE resultado = 'pendente' AND lead_json IS NULL
        AND criado_em < strftime('%s','now') - 3600`
  ).run();

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

    // O mesmo lead (event_id) já tem card? Acontece quando a tentativa
    // original criou a task e morreu antes de gravar o desfecho, ou quando o
    // lead ganhou uma segunda linha de dispatch. Reenviar ao ClickUp acharia a
    // task no dedup e COMENTARIA "Lead voltou ao CRM" num lead que nunca saiu —
    // ruído para o comercial e um 'comentado' falso no funil. Copia o desfecho
    // da linha que já tem a task e encerra sem tocar no ClickUp.
    if (row.event_id) {
      const irma = await env.DB.prepare(
        `SELECT resultado, task_id, task_url FROM lead_dispatch
          WHERE event_id = ? AND id <> ? AND task_id IS NOT NULL AND task_id <> ''
          ORDER BY id LIMIT 1`
      ).bind(row.event_id, row.id).first();
      if (irma) {
        const resultado = irma.resultado === 'comentado' ? 'comentado' : 'criado';
        await env.DB.prepare(
          `UPDATE lead_dispatch
              SET resultado = ?, task_id = ?, task_url = ?, erro = NULL, lead_json = NULL
            WHERE id = ?`
        ).bind(resultado, irma.task_id, irma.task_url, row.id).run();
        saida.push({ id: row.id, resultado, ja_tinha_task: true });
        continue;
      }
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

  return json({
    ok: true,
    reprocessados: saida.length,
    varridas_sem_payload: (varridas && varridas.meta && varridas.meta.changes) || 0,
    detalhes: saida,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
