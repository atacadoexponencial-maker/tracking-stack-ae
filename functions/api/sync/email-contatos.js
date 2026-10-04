// POST /api/sync/email-contatos — rodada dos contatos de marketing (spec-email-proprio.md, módulo 4; issue 380).
//
// Chamado por cron na VPS a cada 5 minutos (o Pages não tem Cron Triggers;
// mesmo padrão de /api/sync/email-agenda). Auth: header `x-sync-secret: <SYNC_SECRET>`.
//   1. Lê os leads do event_log depois do cursor: primeira carga dos antigos e
//      rede de segurança quando a gravação na hora (/tracker) falha.
//   2. Busca no ClickUp o nome de quem ficou sem.
// Teto por rodada para caber no tempo da função; a carga continua na próxima.
import { carregarDoTracking, preencherNomes } from '../_email-contatos.js';

const json = (dados, status = 200) => Response.json(dados, { status });

export async function onRequestPost({ request, env }) {
  const sent = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || sent !== env.SYNC_SECRET) return json({ error: 'Unauthorized' }, 401);
  if (!env.DB) return json({ error: 'DB unavailable' }, 500);
  try {
    const carga = await carregarDoTracking(env);
    const nomes = await preencherNomes(env);
    return json({ ok: true, ...carga, nomes });
  } catch (e) {
    console.error('sync email-contatos', e.message);
    return json({ error: 'Falha na rodada.' }, 500);
  }
}
