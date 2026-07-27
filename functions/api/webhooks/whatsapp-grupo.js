// POST /api/webhooks/whatsapp-grupo
//
// Recebe uma CÓPIA do evento cru da Evolution, repassada por um nó HTTP do
// workflow do n8n que já recebe o webhook ("Evolution -> Postgres | Grupos
// clientes read-only"). A Evolution só aceita uma URL de webhook por instância,
// e ela já aponta para o n8n — repontar quebraria aquele fluxo.
//
// Auth: header `x-grupos-secret: <env.GRUPOS_WEBHOOK_SECRET>`. É um segredo
// PRÓPRIO, não o SYNC_SECRET: aquele abre quatro endpoints de sync, e colá-lo no
// n8n daria poder de escrita em todos eles a quem tem acesso ao n8n.
//
// Responde 200 rápido mesmo quando ignora o evento — a resposta do n8n para a
// Evolution não pode ficar pendurada por causa daqui.

import { classificarEvento } from './_classificar.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  // Este endpoint é a ÚNICA porta de entrada e a Evolution não reentrega evento
  // nenhum — falha aqui é perda definitiva. Os console.error abaixo (401, JSON
  // inválido, evento ignorado) existem para diferenciar "semana parada" de
  // "ingestão quebrada" nos logs do Pages. Nunca logar o valor do segredo.
  const enviado = request.headers.get('x-grupos-secret') || '';
  if (!env.GRUPOS_WEBHOOK_SECRET || enviado !== env.GRUPOS_WEBHOOK_SECRET) {
    console.error('whatsapp-grupo — segredo divergente ou ausente (401)');
    return json({ error: 'Unauthorized' }, 401);
  }

  let body;
  try { body = await request.json(); } catch (e) {
    console.error('whatsapp-grupo — JSON inválido no corpo da requisição:', e?.message || e);
    return json({ ok: true, status: 'ignorado', motivo: 'json_invalido' });
  }

  const evento = classificarEvento(body, Date.now());
  if (!evento) {
    // Nunca o corpo cru no log: ele carrega os JIDs (telefones) dos
    // participantes, inclusive de grupos de terceiros que a feature
    // deliberadamente não persiste no banco (decisão de privacidade da spec).
    // Só o suficiente para diagnosticar por que o evento foi descartado.
    console.error('whatsapp-grupo — evento ignorado (não é GROUP_PARTICIPANTS_UPDATE de grupo válido):', {
      event: body?.event,
      action: body?.data?.action,
      groupJid: body?.data?.id,
      participantes: Array.isArray(body?.data?.participants) ? body.data.participants.length : 0,
    });
    return json({ ok: true, status: 'ignorado' });
  }

  const agora = Math.floor(Date.now() / 1000);

  // Todo grupo que gera evento é registrado — sem participantes. É assim que uma
  // Comunidade nova aparece no dash em vez de sumir calada.
  const stmts = [
    env.DB.prepare(
      `INSERT INTO whatsapp_groups_seen (group_jid, group_name, events, last_event_at)
       VALUES (?, NULL, 1, ?)
       ON CONFLICT(group_jid) DO UPDATE SET
         events = whatsapp_groups_seen.events + 1,
         last_event_at = excluded.last_event_at`
    ).bind(evento.groupJid, evento.occurredAt),
  ];

  const monitorado = await env.DB.prepare(
    `SELECT label FROM whatsapp_groups_tracked WHERE group_jid = ? AND enabled = 1`
  ).bind(evento.groupJid).first();

  if (!monitorado) {
    await env.DB.batch(stmts);
    return json({ ok: true, status: 'nao_monitorado', group_jid: evento.groupJid });
  }

  // Payload truncado: serve para depurar um caso estranho, não para virar acervo.
  const cru = JSON.stringify(body).slice(0, 2000);
  const ins = env.DB.prepare(
    `INSERT OR IGNORE INTO whatsapp_group_events
       (group_jid, participant_jid, action, actor_jid, occurred_at, day_local, received_at, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const l of evento.linhas) {
    stmts.push(ins.bind(
      evento.groupJid, l.participantJid, l.action, l.actorJid,
      evento.occurredAt, evento.dayLocal, agora, cru));
  }

  await env.DB.batch(stmts);
  return json({ ok: true, status: 'gravado', linhas: evento.linhas.length });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
