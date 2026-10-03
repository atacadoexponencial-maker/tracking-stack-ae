// POST /api/sync/email-agenda — rodada dos e-mails da agenda (spec-email-proprio.md, módulo 3; issue 379).
//
// Chamado por cron na VPS a cada 5 minutos (o Pages não tem Cron Triggers;
// mesmo padrão de /api/sync/agenda). Auth: header `x-sync-secret: <SYNC_SECRET>`.
// Manda os lembretes cujo horário chegou e o que ficou para trás (serviço de
// envio sem resposta na tentativa anterior). Teto por rodada para caber no
// tempo da função.
import { processarFila } from '../_email-agenda.js';

const json = (dados, status = 200) => Response.json(dados, { status });
const TETO = 50;

export async function onRequestPost({ request, env }) {
  const sent = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || sent !== env.SYNC_SECRET) return json({ error: 'Unauthorized' }, 401);
  if (!env.DB) return json({ error: 'DB unavailable' }, 500);
  try {
    return json({ ok: true, ...(await processarFila(env, { limite: TETO })) });
  } catch (e) {
    console.error('sync email-agenda', e.message);
    return json({ error: 'Falha na rodada.' }, 500);
  }
}
