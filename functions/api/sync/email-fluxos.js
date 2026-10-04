// POST /api/sync/email-fluxos — rodada dos fluxos (spec-email-proprio.md, módulo 9; issue 386).
//
// Chamado por cron na VPS a cada minuto (o Pages não tem Cron Triggers).
// Auth: header `x-sync-secret: <SYNC_SECRET>`. Coleta os acontecimentos novos
// e faz os fluxos ativos andarem (_email-motor.js).
import { rodar } from '../_email-motor.js';

const json = (dados, status = 200) => Response.json(dados, { status });

export async function onRequestPost({ request, env }) {
  const sent = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || sent !== env.SYNC_SECRET) return json({ error: 'Unauthorized' }, 401);
  if (!env.DB) return json({ error: 'DB unavailable' }, 500);
  try {
    return json({ ok: true, ...(await rodar(env)) });
  } catch (e) {
    console.error('sync email-fluxos', e.message);
    return json({ error: 'Falha na rodada.' }, 500);
  }
}
