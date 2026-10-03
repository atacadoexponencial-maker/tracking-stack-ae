// POST /api/sync/email-campanhas — rodada das campanhas (spec-email-proprio.md, módulo 6; issue 382).
//
// Chamado por cron na VPS a cada 5 minutos (o Pages não tem Cron Triggers;
// mesmo padrão de /api/sync/email-agenda). Auth: header `x-sync-secret: <SYNC_SECRET>`.
// Continua as campanhas "enviando": lotes que não couberam no disparo e
// reservas paradas (função encerrada no meio). A 383 acrescenta aqui as agendadas.
import { processarEnvio } from '../_email-campanhas.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const LOTES_POR_RODADA = 5;

export async function onRequestPost({ request, env }) {
  const sent = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || sent !== env.SYNC_SECRET) return json({ error: 'Unauthorized' }, 401);
  if (!env.DB) return json({ error: 'DB unavailable' }, 500);
  try {
    return json({ ok: true, ...(await processarEnvio(env, { lotes: LOTES_POR_RODADA })) });
  } catch (e) {
    console.error('sync email-campanhas', e.message);
    return json({ error: 'Falha na rodada.' }, 500);
  }
}
