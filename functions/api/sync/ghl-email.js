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
  let sincronizadas = 0;
  const erros = [];

  try {
    // 1) Lista as campanhas enviadas (paginando).
    const campanhas = [];
    let offset = 0;
    const limit = 100;
    for (let pagina = 0; pagina < 20; pagina++) { // teto de segurança: 2000 campanhas
      const res = await ghlV3(`/emails/locations/${loc}/campaigns/emails?status=sent&limit=${limit}&offset=${offset}`, env);
      if (!res.ok) {
        const corpo = await res.text().catch(() => '');
        return json({ error: `list campaigns HTTP ${res.status}`, corpo: corpo.slice(0, 300) }, 502);
      }
      const data = await res.json().catch(() => ({}));
      const lote = data.campaigns || [];
      campanhas.push(...lote);
      if (lote.length < limit) break;
      offset += limit;
    }

    // 2) Pra cada campanha enviada com sourceId, puxa o stats e faz upsert.
    for (const c of campanhas) {
      const sourceId = c.sourceId;
      if (!sourceId) continue; // rascunho/sem envio real
      try {
        const sres = await ghlV3(`/emails/locations/${loc}/campaigns/stats/email-campaigns/${sourceId}`, env);
        if (!sres.ok) {
          const corpo = await sres.text().catch(() => '');
          console.error(`GHL stats ${sourceId} HTTP ${sres.status}: ${corpo.slice(0, 200)}`);
          erros.push(sourceId);
          continue;
        }
        const s = (await sres.json().catch(() => ({}))).stats || {};
        const bounced = Number(s.permanentFail || 0) + Number(s.temporaryFail || 0);
        await env.DB.prepare(
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
        ).bind(
          sourceId, c.id || '', c.name || '', c.subject || '', c.fromEmail || '', c.status || '',
          c.updatedAt || c.createdAt || '',
          Number(s.sent || 0), Number(s.delivered || 0), Number(s.opened || 0), Number(s.clicked || 0),
          bounced, Number(s.unsubscribed || 0), Number(s.complained || 0), Number(s.failed || 0), agora
        ).run();
        sincronizadas++;
      } catch (e) {
        console.error(`GHL sync campanha ${sourceId} erro:`, e.message);
        erros.push(sourceId);
      }
    }
  } catch (e) {
    console.error('GHL email sync erro:', e.message);
    return json({ error: e.message }, 500);
  }

  return json({ ok: true, sincronizadas, com_erro: erros.length });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
