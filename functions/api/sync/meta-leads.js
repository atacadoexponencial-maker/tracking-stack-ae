// POST /api/sync/meta-leads
//
// Recebe leads do formulário NATIVO do Meta (Instant Form, funil Sessão
// Estratégica) coletados da planilha pelo script da VPS, e os injeta no MESMO
// pipeline dos leads do site: cria/atualiza o card no ClickUp (com a tag
// `formulario-meta`), faz upsert no GoHighLevel, e registra no D1 para o lead
// aparecer no /dash — SEM disparar Meta CAPI (o lead já nasceu no Meta;
// reenviar contaria a conversão duas vezes).
//
// Auth: header `x-sync-secret: <env.SYNC_SECRET>` (mesmo secret dos outros syncs).
// Idempotente: cada lead traz o `meta_id` do Meta; se já existe event_log com
// `event_id = metaform:<meta_id>`, o lead é ignorado (nada é reprocessado).
//
// Reusa as funções já testadas do tracker.js — a lógica de dedup por
// telefone/email, retry, lead_dispatch e notificação ao comercial vive lá.

import { sendToClickUp, sendToGHL, isInternalTestEmail } from '../../tracker.js';

const FUNNEL = 'sessao-estrategica'; // conta junto com os leads de SE do site
const ORIGIN = 'meta_form';          // "tag própria" no dashboard
const CLICKUP_TAG = 'formulario-meta';

export async function onRequestPost(context) {
  const { request, env } = context;

  const sent = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || sent !== env.SYNC_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (!env.DB) return json({ error: 'DB unavailable' }, 500);

  let body;
  try { body = await request.json(); } catch (_) {
    return json({ error: 'invalid JSON' }, 400);
  }
  const leads = Array.isArray(body.leads) ? body.leads : [];

  const started = Date.now();
  let created = 0, skipped = 0, failed = 0;

  for (const lead of leads) {
    const metaId = (lead.meta_id || '').toString().trim();
    if (!metaId) { failed++; continue; }
    const eventId = `metaform:${metaId}`;
    const sessionId = eventId; // 1 sessão sintética por lead → JOIN traz a atribuição

    try {
      // 1. Idempotência: já processado? pula sem tocar em ClickUp/GHL.
      const seen = await env.DB.prepare(
        'SELECT 1 FROM event_log WHERE event_id = ? LIMIT 1'
      ).bind(eventId).first();
      if (seen) { skipped++; continue; }

      const email = (lead.email || '').toString().trim();
      const telefone = (lead.telefone || '').toString().trim();
      const nome = (lead.nome || '').toString().trim();
      const createdTs = Number.isFinite(lead.created_ts) ? lead.created_ts : Math.floor(Date.now() / 1000);

      const sessionData = {
        utm_source: lead.utm_source || '',
        utm_medium: lead.utm_medium || '',
        utm_campaign: lead.utm_campaign || '',
        utm_content: lead.utm_content || '',
      };

      // 2. Sessão sintética: o dashboard lê a atribuição via JOIN event_log→sessions.
      //    external_id é NOT NULL (schema 0001) → string vazia. INSERT OR IGNORE:
      //    a idempotência acima já barra reprocesso; isto é só cinto de segurança.
      await env.DB.prepare(
        `INSERT OR IGNORE INTO sessions
           (session_id, external_id, utm_source, utm_medium, utm_campaign, utm_content,
            funnel, landing_url, referrer, created_at, updated_at)
         VALUES (?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        sessionId, sessionData.utm_source, sessionData.utm_medium,
        sessionData.utm_campaign, sessionData.utm_content, FUNNEL,
        lead.form_name || '', 'meta:' + (lead.platform || 'form'), createdTs, createdTs
      ).run();

      const leadData = {
        nome, email, telefone,
        instagram: lead.instagram || '',
        faturamento: lead.faturamento || '',
        justificativa: lead.justificativa || '',
        objetivo: lead.objetivo || '',
        funnel: FUNNEL,
      };

      // 3. ClickUp (card + dedup + lead_dispatch + notif comercial) com a tag própria.
      await sendToClickUp({ leadData, sessionData, env, eventId, tag: CLICKUP_TAG });

      // 4. GoHighLevel (contato + tag de funil). Best-effort dentro da própria função.
      await sendToGHL({ leadData, env });

      // 5. Dashboard: mesma estrutura do event_log do tracker.js, com valores
      //    neutros (sem navegador/pixel), SEM CAPI (sent_to_meta=0) e origin=meta_form.
      const isJunk = isInternalTestEmail(email) ? 1 : 0;
      await env.DB.prepare(`
        INSERT INTO event_log (
          session_id, event_name, event_id, timestamp,
          browser, browser_version, os, is_mobile,
          pixel_was_blocked, fbp_source, fbc_source, fbclid_source,
          ga_cookie_present, ga_client_id_fallback, itp_cookie_extended,
          is_bot, bot_reason, consent_status,
          sent_to_meta, meta_status_code, meta_response_ok, meta_response_body, meta_payload_sent,
          sent_to_ga4, ga4_status_code, ga4_response_ok, ga4_response_body, ga4_payload_sent,
          has_email, has_phone, has_name,
          raw_email, funnel, is_junk, origin
        ) VALUES (?, 'Lead', ?, ?, '', '', '', 0, 0, 'none', 'none', 'none', 0, 0, 0, 0, '', 'n/a', 0, 0, 0, ?, NULL, 0, 0, 0, '', NULL, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        sessionId, eventId, createdTs,
        'skipped: meta form lead (no CAPI)',
        email ? 1 : 0, telefone ? 1 : 0, nome ? 1 : 0,
        email, FUNNEL, isJunk, ORIGIN
      ).run();

      created++;
    } catch (e) {
      console.error('meta-leads process error:', metaId, e.message);
      failed++;
    }
  }

  // sync_log: mesma tabela dos outros syncs (run_at é unix seconds).
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT INTO sync_log (platform, status, rows_upserted, date_from, date_to, error_message, duration_ms, run_at)
     VALUES ('meta_leads', ?, ?, NULL, NULL, ?, ?, ?)`
  ).bind(
    failed ? 'error' : 'ok', created,
    failed ? `${failed} lead(s) falharam` : null,
    Date.now() - started, now
  ).run();

  return json({ ok: true, received: leads.length, created, skipped, failed });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
