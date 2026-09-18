// POST /api/sync/grupo-acoes — executa as ações de grupo que já venceram.
//
// Chamado por cron na VPS a cada 5 minutos, como os demais syncs. O Cloudflare
// Pages não tem Cron Triggers (só Workers), e sete syncs deste projeto já
// funcionam assim — inventar um oitavo padrão não traria ganho nenhum.
//
// Auth: header `x-sync-secret: <env.SYNC_SECRET>`.

import { executarVencidas, expurgarMidiaAntiga } from '../_grupos-acoes.js';
import { FUSO_BRT } from '../_data-brt.js';

export async function onRequestPost(context) {
  const { request, env, fetchImpl = fetch } = context;
  const sent = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || sent !== env.SYNC_SECRET) return json({ error: 'Unauthorized' }, 401);
  if (!env.DB) return json({ error: 'DB unavailable' }, 500);

  const agora = Math.floor(Date.now() / 1000);

  let rodada;
  try {
    rodada = await executarVencidas(env, agora, fetchImpl);
  } catch (e) {
    console.error('grupo-acoes: rodada falhou', e?.message || e);
    return json({ ok: false, erro: String(e?.message || e) });
  }

  // Alerta é EXTRA: um Slack fora do ar não pode fazer a rodada parecer
  // quebrada, senão o cron vira fonte de alarme falso.
  let alerta = null;
  if (rodada.falhas > 0) {
    try {
      alerta = await avisarNoSlack(env, rodada, agora, fetchImpl);
    } catch (e) {
      alerta = { ok: false, erro: String(e?.message || e) };
    }
  }

  // Expurgo por último e com a falha engolida: limpeza é faxina, não pode
  // fazer a rodada parecer quebrada nem atrasar disparo nenhum.
  let expurgo = null;
  try {
    expurgo = await expurgarMidiaAntiga(env, agora);
  } catch (e) {
    console.error('grupo-acoes: expurgo falhou', e?.message || e);
    expurgo = { erro: String(e?.message || e) };
  }

  return json({ ok: rodada.falhas === 0, ...rodada, alerta, expurgo });
}

async function avisarNoSlack(env, rodada, agora, fetchImpl) {
  // Mesmo canal do CAPI (SLACK_WEBHOOK_META): um segundo webhook só criaria
  // mais uma coisa para cadastrar e esquecer.
  if (!env.SLACK_WEBHOOK_META) return { ok: false, erro: 'sem_canal' };

  const quando = new Date(agora * 1000).toLocaleString('pt-BR', {
    timeZone: FUSO_BRT, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const falhas = rodada.executadas.filter((e) => e.status === 'falhou');
  const texto = [
    `:warning: *Ação de grupo não saiu* — ${quando}`,
    ...falhas.map((f) => `• ação #${f.id}: ${f.erro || 'motivo não registrado'}`),
    'Painel: https://tracking-ae.pages.dev/dash/#grupos',
  ].join('\n');

  try {
    const r = await fetchImpl(env.SLACK_WEBHOOK_META, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: texto }),
    });
    return r.ok ? { ok: true } : { ok: false, erro: `Slack HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, erro: `rede: ${e?.message || e}` };
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
