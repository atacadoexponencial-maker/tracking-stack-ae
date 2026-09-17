// POST /api/sync/meta-reenvio            — rodada de reenvio + checagens + alertas
// POST /api/sync/meta-reenvio?acao=recuperar — coloca na fila as recusas dos últimos 6 dias
//
// Chamado por cron na VPS a cada 15 minutos, como os demais syncs
// (spec-capi-reenvio-monitoramento.md e spec-protecoes-integracoes.md).
// Auth: header `x-sync-secret: <env.SYNC_SECRET>`.

import { executarRodada, recuperarRecentes } from '../_meta-fila.js';
import { talvezChecarAutomatico } from '../_credenciais-checagem.js';
import { limparHorarioAntigo } from '../_horario-registro.js';
import { verificarAlertas } from '../_saude-alertas.js';

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

  // Checagem das credenciais: 1 vez por dia (a própria função decide se é hora).
  // Na mesma janela, a limpeza dos resumos de horário com mais de 30 dias.
  let credenciais = null;
  try {
    credenciais = await talvezChecarAutomatico(env, agora);
    if (credenciais.executada) await limparHorarioAntigo(env, agora);
  } catch (e) {
    console.error('meta-reenvio: checagem de credenciais falhou', e.message);
    credenciais = { erro: e.message };
  }

  let alertas = null;
  try {
    alertas = await verificarAlertas(env, agora);
  } catch (e) {
    console.error('meta-reenvio: verificação de alertas falhou', e.message);
    alertas = { erro: e.message };
  }

  return json({ ok: !rodada.erro && !alertas.erro && !credenciais?.erro, rodada, credenciais, alertas });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
