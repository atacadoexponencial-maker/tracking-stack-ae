// GET  /api/campaign-funnel?key=...&days=30  → campanhas do período com o funil resolvido
// POST /api/campaign-funnel?key=...          → grava (ou remove) override manual
//
// A coluna "Funil" da tabela de campanhas do dashboard consome as duas rotas.
// Endpoint ADITIVO: nenhum endpoint existente foi alterado.

import { resolverFunilAuto, listarFunisConhecidos, FUNIL_SEM_CLASSIFICACAO } from './_funil-campanha.js';
import { CANAL_AQUISICAO } from './_canal.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const days = clampInt(url.searchParams.get('days'), 30, 1, 365);
  const { since, until } = resolvePeriod(url, days);
  const sinceDate = new Date(since * 1000).toISOString().slice(0, 10);
  const untilDate = new Date(until * 1000).toISOString().slice(0, 10);

  const [campanhas, overrides, funis] = await Promise.all([
    env.DB.prepare(`
      SELECT campaign_id, MAX(campaign_name) AS campaign_name, SUM(spend_cents) AS spend_cents
      FROM ad_spend
      WHERE platform = 'meta' AND date BETWEEN ? AND ?
      GROUP BY campaign_id
      ORDER BY spend_cents DESC
      LIMIT 200
    `).bind(sinceDate, untilDate).all(),
    env.DB.prepare('SELECT campaign_id, funnel FROM campaign_funnel_map').all(),
    listarFunisConhecidos(env.DB),
  ]);

  const mapaOverride = new Map((overrides.results || []).map((o) => [String(o.campaign_id), o.funnel]));

  const rows = (campanhas.results || []).map((c) => {
    const manual = mapaOverride.get(String(c.campaign_id));
    const auto = manual ? null : resolverFunilAuto(c.campaign_name, funis);
    return {
      campaign_id: c.campaign_id,
      campaign_name: c.campaign_name || c.campaign_id,
      spend: (c.spend_cents || 0) / 100,
      funnel: manual || auto || FUNIL_SEM_CLASSIFICACAO,
      origem: manual ? 'manual' : (auto ? 'auto' : 'sem-funil'),
    };
  });

  return json({ rows, funis: [...funis, CANAL_AQUISICAO] });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const campaignId = (corpo.campaign_id == null ? '' : String(corpo.campaign_id)).trim();
  if (!campaignId) return json({ error: 'campaign_id obrigatório' }, 400);

  const funil = (corpo.funnel == null ? '' : String(corpo.funnel)).trim();

  // Funil vazio = "volta para o automático": apaga o override.
  if (!funil) {
    await env.DB.prepare('DELETE FROM campaign_funnel_map WHERE campaign_id = ?').bind(campaignId).run();
    return json({ ok: true, removido: true });
  }

  // Só aceita funil que existe de verdade (ou o rótulo de impulsionamento).
  // Sem isso, um erro de digitação cria um funil fantasma no relatório.
  const funis = await listarFunisConhecidos(env.DB);
  const permitidos = new Set([...funis, CANAL_AQUISICAO]);
  if (!permitidos.has(funil)) {
    return json({ error: `funil desconhecido: ${funil}` }, 400);
  }

  await env.DB.prepare(`
    INSERT INTO campaign_funnel_map (campaign_id, campaign_name, funnel, atualizado_em)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(campaign_id) DO UPDATE SET
      campaign_name = excluded.campaign_name,
      funnel = excluded.funnel,
      atualizado_em = excluded.atualizado_em
  `).bind(
    campaignId,
    (corpo.campaign_name == null ? '' : String(corpo.campaign_name)).trim() || null,
    funil,
    Math.floor(Date.now() / 1000),
  ).run();

  return json({ ok: true, funnel: funil });
}

function clampInt(raw, fallback, min, max) {
  const n = parseInt(raw || '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function resolvePeriod(url, days) {
  const now = Math.floor(Date.now() / 1000);
  const fromTs = parseInt(url.searchParams.get('from') || '', 10);
  const toTs = parseInt(url.searchParams.get('to') || '', 10);
  const since = Number.isFinite(fromTs) && fromTs > 0 ? fromTs : now - days * 86400;
  const until = Number.isFinite(toTs) && toTs > 0 ? toTs : now;
  return { since, until };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
