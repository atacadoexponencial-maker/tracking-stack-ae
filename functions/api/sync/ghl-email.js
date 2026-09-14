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
  const started = Date.now();
  // Teto de campanhas por execução: cada campanha = 1 subrequisição de stats, e
  // o Worker tem limite de subrequisições por invocação. As gravações no D1 vão
  // num batch único (1 subrequisição). Sincroniza as MAIS RECENTES — campanhas
  // antigas já têm stats estabilizado. Override via body {limit}.
  let body = {};
  try { body = await request.json(); } catch (_) { body = {}; }
  const limitCampanhas = Math.max(1, Math.min(45, parseInt(body.limit, 10) || 20));

  const erros = [];
  try {
    // 1) Lista as campanhas enviadas, paginando. A v3 limita `limit` a 20 por
    //    página, e devolve as mais recentes primeiro; junta páginas até cobrir
    //    limitCampanhas.
    const PAGINA = 20;
    const todasBrutas = [];
    for (let offset = 0; offset < limitCampanhas + PAGINA; offset += PAGINA) {
      const res = await ghlV3(`/emails/locations/${loc}/campaigns/emails?status=sent&limit=${PAGINA}&offset=${offset}`, env);
      if (!res.ok) {
        const corpo = await res.text().catch(() => '');
        await gravarSyncLog(env, 'error', 0, `list campaigns HTTP ${res.status}: ${corpo.slice(0, 200)}`, started);
        return json({ error: `list campaigns HTTP ${res.status}`, corpo: corpo.slice(0, 300) }, 502);
      }
      const lote = (await res.json().catch(() => ({}))).campaigns || [];
      todasBrutas.push(...lote);
      if (lote.length < PAGINA || todasBrutas.length >= limitCampanhas + PAGINA) break;
    }
    const todas = todasBrutas
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

    // Campanha com stats indisponível não derruba a rodada, mas também não é
    // "ok": fica registrado como erro parcial para aparecer no sync_log.
    await gravarSyncLog(env, erros.length ? 'error' : 'ok', batch.length,
      erros.length ? `${erros.length} campanha(s) sem stats: ${erros.slice(0, 5).join(', ')}` : null, started);

    return json({ ok: true, sincronizadas: batch.length, com_erro: erros.length });
  } catch (e) {
    console.error('GHL email sync erro:', e.message);
    await gravarSyncLog(env, 'error', 0, e.message, started);
    return json({ error: e.message }, 500);
  }
}

// Mesma tabela e mesmo formato dos outros syncs (meta, workshops,
// grupo_conversoes). Até 2026-09-13 este era o único sync que não gravava nada:
// a queda de entrega de 91% para ~50% (ver metricas-email-gohighlevel) só foi
// notada olhando o GHL à mão, porque não havia rastro de rodada falhando.
// Best-effort: falha ao logar não muda o desfecho da rodada.
async function gravarSyncLog(env, status, rows, erro, started) {
  try {
    await env.DB.prepare(
      `INSERT INTO sync_log (platform, status, rows_upserted, date_from, date_to, error_message, duration_ms, run_at)
       VALUES ('ghl_email', ?, ?, NULL, NULL, ?, ?, ?)`
    ).bind(status, rows, erro ? String(erro).slice(0, 500) : null,
      Date.now() - started, Math.floor(Date.now() / 1000)).run();
  } catch (e) {
    console.error('GHL email sync_log erro:', e.message);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
