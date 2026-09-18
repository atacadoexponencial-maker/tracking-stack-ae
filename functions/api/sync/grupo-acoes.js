// POST /api/sync/grupo-acoes — executa as ações de grupo que já venceram.
//
// Chamado por cron na VPS a cada 5 minutos, como os demais syncs. O Cloudflare
// Pages não tem Cron Triggers (só Workers), e sete syncs deste projeto já
// funcionam assim — inventar um oitavo padrão não traria ganho nenhum.
//
// Auth: header `x-sync-secret: <env.SYNC_SECRET>`.

import { executarVencidas, expurgarMidiaAntiga } from '../_grupos-acoes.js';
import { infoGrupo } from '../_evolution-grupos.js';
import { FUSO_BRT } from '../_data-brt.js';

export async function onRequestPost(context) {
  const { request, env, fetchImpl = fetch } = context;
  const sent = request.headers.get('x-sync-secret') || '';
  if (!env.SYNC_SECRET || sent !== env.SYNC_SECRET) return json({ error: 'Unauthorized' }, 401);
  if (!env.DB) return json({ error: 'DB unavailable' }, 500);

  const agora = Math.floor(Date.now() / 1000);

  // `?acao=diagnostico` — SÓ LEITURA, não executa nada.
  //
  // Existe porque renomear o grupo da Comunidade falha com `bad-request`, e
  // para saber por quê é preciso enxergar QUE TIPO de grupo é cada JID
  // monitorado. Sem isto, qualquer correção seria chute: o mesmo erro aparece
  // tanto quando o alvo é o grupo de Avisos quanto quando é o próprio pai.
  if (new URL(request.url).searchParams.get('acao') === 'diagnostico') {
    return json({ ok: true, grupos: await diagnosticar(env, fetchImpl) });
  }

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

async function diagnosticar(env, fetchImpl) {
  const { results } = await env.DB.prepare(
    'SELECT group_jid, label, parent_jid FROM whatsapp_groups_tracked WHERE enabled = 1 ORDER BY label'
  ).all();

  return Promise.all((results || []).map(async (g) => {
    const r = await infoGrupo(env, g.group_jid, fetchImpl);
    if (!r.ok) return { label: g.label, group_jid: g.group_jid, erro: r.erro };
    const d = r.dados || {};
    // O pai também: é ele que provavelmente precisa ser renomeado, e antes de
    // tentar é preciso saber o nome que ele já tem (para um teste idempotente,
    // que não muda nada para os 200+ membros).
    let pai = null;
    if (d.linkedParent) {
      const p = await infoGrupo(env, d.linkedParent, fetchImpl);
      pai = p.ok
        ? { jid: d.linkedParent, subject: p.dados?.subject ?? null, size: p.dados?.size ?? null,
            isCommunity: p.dados?.isCommunity ?? null, restrict: p.dados?.restrict ?? null }
        : { jid: d.linkedParent, erro: p.erro };
    }
    return {
      pai,
      label: g.label,
      group_jid: g.group_jid,
      subject: d.subject ?? null,
      size: d.size ?? null,
      isCommunity: d.isCommunity ?? null,
      isCommunityAnnounce: d.isCommunityAnnounce ?? null,
      linkedParent: d.linkedParent ?? null,
      announce: d.announce ?? null,
      restrict: d.restrict ?? null,
      parent_jid_guardado: g.parent_jid,
    };
  }));
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
