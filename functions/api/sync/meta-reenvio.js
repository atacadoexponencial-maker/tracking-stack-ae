// POST /api/sync/meta-reenvio            — rodada de reenvio + verificação de alertas
// POST /api/sync/meta-reenvio?acao=recuperar — coloca na fila as recusas dos últimos 6 dias
//
// Chamado por cron na VPS a cada 15 minutos, como os demais syncs
// (spec-capi-reenvio-monitoramento.md, issues 272–276 e 284–286).
// Auth: header `x-sync-secret: <env.SYNC_SECRET>`.

import { executarRodada, metricasSaude, recuperarRecentes } from '../_meta-fila.js';
import { avaliarCondicoes } from '../_meta-envio.js';
import { processarAlertas } from '../_meta-alerta.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const sent = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || sent !== env.SYNC_SECRET) return json({ error: 'Unauthorized' }, 401);
  if (!env.DB) return json({ error: 'DB unavailable' }, 500);

  const agora = Math.floor(Date.now() / 1000);
  const acao = new URL(request.url).searchParams.get('acao');

  if (acao === 'recuperar') {
    const recuperadas = await recuperarRecentes(env, agora);
    return json({ ok: true, recuperadas });
  }

  let rodada;
  try {
    rodada = await executarRodada(env, agora);
  } catch (e) {
    // Rodada quebrada não pode impedir o alerta de avisar que algo está errado.
    console.error('meta-reenvio: rodada falhou', e.message);
    rodada = { erro: e.message };
  }

  let alertas = null;
  try {
    const metricas = await metricasSaude(env, agora);
    const condicoes = avaliarCondicoes(metricas, agora);
    alertas = await processarAlertas(env, { condicoes, metricas, agora });
    alertas.condicoes = condicoes;
  } catch (e) {
    console.error('meta-reenvio: verificação de alertas falhou', e.message);
    alertas = { erro: e.message };
  }

  return json({ ok: !rodada.erro && !alertas.erro, rodada, alertas });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
