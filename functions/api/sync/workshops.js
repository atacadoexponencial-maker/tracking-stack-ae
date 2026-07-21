// POST /api/sync/workshops
//
// Recebe o payload já montado pelo coletor Python da VPS (Meet + Calendly já
// casados) e faz UPSERT idempotente nas tabelas de workshops. NÃO chama Meet
// nem Calendly — toda a busca acontece na VPS (onde vive a chave do Google).
//
// Auth: header `x-sync-secret: <env.SYNC_SECRET>` (mesmo secret dos outros syncs).
// Body: ver contrato em docs/superpowers/plans/2026-07-21-presenca-workshops.md
//
// Idempotente: reprocessar o mesmo workshop (mesmo meet_record_name) faz update.

export async function onRequestPost(context) {
  const { request, env } = context;

  const sent = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || sent !== env.SYNC_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body;
  try { body = await request.json(); } catch (_) {
    return json({ error: 'invalid JSON' }, 400);
  }
  const workshops = Array.isArray(body.workshops) ? body.workshops : [];
  const learned = Array.isArray(body.learned) ? body.learned : [];

  const now = Math.floor(Date.now() / 1000);
  const nowIso = new Date(now * 1000).toISOString();
  const stmts = [];

  const upWorkshop = env.DB.prepare(
    `INSERT INTO workshops (id, title, started_at, ended_at, calendly_event_uri, meet_record_name, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title, started_at=excluded.started_at, ended_at=excluded.ended_at,
       calendly_event_uri=excluded.calendly_event_uri, meet_record_name=excluded.meet_record_name,
       synced_at=excluded.synced_at`);

  const upReg = env.DB.prepare(
    `INSERT INTO workshop_registrants (workshop_id, name, email, registered_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(workshop_id, email) DO UPDATE SET
       name=excluded.name, registered_at=excluded.registered_at`);

  const upPart = env.DB.prepare(
    `INSERT INTO workshop_participants
       (workshop_id, google_user_id, display_name, total_minutes, first_join, last_leave, registrant_email)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(workshop_id, google_user_id) DO UPDATE SET
       display_name=excluded.display_name, total_minutes=excluded.total_minutes,
       first_join=excluded.first_join, last_leave=excluded.last_leave,
       registrant_email=excluded.registrant_email`);

  const upIdentity = env.DB.prepare(
    `INSERT INTO meet_identity_map (google_user_id, email, display_name, first_seen, last_seen)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(google_user_id) DO UPDATE SET
       email=excluded.email, display_name=excluded.display_name, last_seen=excluded.last_seen`);

  let pCount = 0;
  for (const w of workshops) {
    stmts.push(upWorkshop.bind(
      w.id, w.title || null, w.started_at || null, w.ended_at || null,
      w.calendly_event_uri || null, w.meet_record_name || w.id, now));
    for (const r of (w.registrants || [])) {
      if (!r.email) continue;
      stmts.push(upReg.bind(w.id, r.name || null, r.email, r.registered_at || null));
    }
    for (const p of (w.participants || [])) {
      stmts.push(upPart.bind(
        w.id, p.google_user_id, p.display_name || null, p.total_minutes || 0,
        p.first_join || null, p.last_leave || null, p.registrant_email || null));
      pCount++;
    }
  }
  for (const l of learned) {
    if (!l.google_user_id || !l.email) continue;
    stmts.push(upIdentity.bind(l.google_user_id, l.email, l.display_name || null, nowIso, nowIso));
  }

  if (stmts.length) await env.DB.batch(stmts);

  // sync_log.run_at é INTEGER (unix seconds) — usar `now`, não ISO (ver 0014_sync_log.sql).
  await env.DB.prepare(
    `INSERT INTO sync_log (platform, status, rows_upserted, date_from, date_to, error_message, duration_ms, run_at)
     VALUES ('workshops', 'ok', ?, NULL, NULL, NULL, 0, ?)`
  ).bind(pCount, now).run();

  return json({
    ok: true,
    workshops_upserted: workshops.length,
    participants_upserted: pCount,
    learned_upserted: learned.length,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
