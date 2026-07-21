// POST /api/sync/ghl-email
//
// Puxa a estatística por campanha de email do GoHighLevel (API v3) e faz UPSERT
// na tabela `email_campaign_stats`. Chamado por um cron externo (ver
// docs/ghl-email-sync.md). O dashboard lê `email_campaign_stats` direto pelo
// /api/email-campaigns — nunca bate neste endpoint no caminho da requisição.
//
// Auth:  header `x-sync-secret: <env.SYNC_SECRET>` (mesmo padrão de meta-ads).
// Env:   SYNC_SECRET, TOKEN_GHL (pit- do GHL), LOCAL_ID (locationId).
//
// Sem TOKEN_GHL/LOCAL_ID → 200 com skipped:true (o cron não marca como falha).

const GHL_API = 'https://services.leadconnectorhq.com';

function ghlV3(path, env) {
  return fetch(`${GHL_API}${path}`, {
    headers: {
      Authorization: `Bearer ${env.TOKEN_GHL}`,
      Version: 'v3',
      Accept: 'application/json',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const sentSecret = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || sentSecret !== env.SYNC_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (!env.TOKEN_GHL || !env.LOCAL_ID) {
    return json({ ok: true, skipped: true, reason: 'configure TOKEN_GHL + LOCAL_ID para habilitar o sync de email' });
  }

  const loc = env.LOCAL_ID;
  const agora = Math.floor(Date.now() / 1000);
  // Teto de campanhas por execução: cada campanha = 1 subrequisição de stats, e
  // o Worker tem limite de subrequisições por invocação. As gravações no D1 vão
  // num batch único (1 subrequisição). Sincroniza as MAIS RECENTES — campanhas
  // antigas já têm stats estabilizado. Override via body {limit}.
  let body = {};
  try { body = await request.json(); } catch (_) { body = {}; }
  const limitCampanhas = Math.max(1, Math.min(45, parseInt(body.limit, 10) || 40));

  const erros = [];
  try {
    // 1) Lista as campanhas enviadas (1 subrequisição) e pega as mais recentes.
    const res = await ghlV3(`/emails/locations/${loc}/campaigns/emails?status=sent&limit=100`, env);
    if (!res.ok) {
      const corpo = await res.text().catch(() => '');
      return json({ error: `list campaigns HTTP ${res.status}`, corpo: corpo.slice(0, 300) }, 502);
    }
    const todas = ((await res.json().catch(() => ({}))).campaigns || [])
      .filter((c) => c.sourceId) // rascunho/sem envio real não tem sourceId
      .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
      .slice(0, limitCampanhas);

    // 2) Puxa o stats de cada (subrequisições) e monta os upserts.
    const stmt = env.DB.prepare(
      `INSERT INTO email_campaign_stats
         (source_id, campaign_id, name, subject, from_email, status, sent_at,
          sent, delivered, opened, clicked, bounced, unsubscribed, complained, failed, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(source_id) DO UPDATE SET
         campaign_id=excluded.campaign_id, name=excluded.name, subject=excluded.subject,
         from_email=excluded.from_email, status=excluded.status, sent_at=excluded.sent_at,
         sent=excluded.sent, delivered=excluded.delivered, opened=excluded.opened,
         clicked=excluded.clicked, bounced=excluded.bounced, unsubscribed=excluded.unsubscribed,
         complained=excluded.complained, failed=excluded.failed, synced_at=excluded.synced_at`
    );
    const batch = [];
    for (const c of todas) {
      try {
        const sres = await ghlV3(`/emails/locations/${loc}/campaigns/stats/email-campaigns/${c.sourceId}`, env);
        if (!sres.ok) { console.error(`GHL stats ${c.sourceId} HTTP ${sres.status}`); erros.push(c.sourceId); continue; }
        const s = (await sres.json().catch(() => ({}))).stats || {};
        const bounced = Number(s.permanentFail || 0) + Number(s.temporaryFail || 0);
        batch.push(stmt.bind(
          c.sourceId, c.id || '', c.name || '', c.subject || '', c.fromEmail || '', c.status || '',
          c.updatedAt || c.createdAt || '',
          Number(s.sent || 0), Number(s.delivered || 0), Number(s.opened || 0), Number(s.clicked || 0),
          bounced, Number(s.unsubscribed || 0), Number(s.complained || 0), Number(s.failed || 0), agora
        ));
      } catch (e) {
        console.error(`GHL sync campanha ${c.sourceId} erro:`, e.message);
        erros.push(c.sourceId);
      }
    }

    // 3) Grava tudo num batch único (1 subrequisição ao D1).
    if (batch.length) await env.DB.batch(batch);

    return json({ ok: true, sincronizadas: batch.length, com_erro: erros.length });
  } catch (e) {
    console.error('GHL email sync erro:', e.message);
    return json({ error: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
