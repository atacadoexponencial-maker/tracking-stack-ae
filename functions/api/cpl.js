// GET /api/cpl?key=...&days=30 (ou from=<unix>&to=<unix>)
//
// CPL por funil (a oferta) e por canal (a origem), mais o cruzamento dos dois.
// Todo o cálculo mora em _cpl-calculo.js; aqui só acontece I/O.
//
// Investimento vem de ad_spend (Meta). Leads vêm de event_log com o mesmo
// filtro de validade do /api/leads: não-bot, não-junk, funil efetivo.

import { custoPorReuniao } from './_agenda-funil.js';
import { calcularCpl, montarAvisosCpl } from './_cpl-calculo.js';
import { listarFunisConhecidos } from './_funil-campanha.js';
import { clausulasBotIpSql } from '../_bots.js';
import { ymdBrt } from './_data-brt.js';
import { respostaJson, respostaEmCache } from './_cache.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const days = clampInt(url.searchParams.get('days'), 30, 1, 365);
  const { since, until } = resolvePeriod(url, days);
  // `ad_spend.date` é dia de Brasília; o recorte do período também tem que ser
  // (ver _data-brt.js). Em UTC, o gasto da noite caía no dia seguinte e o CPL
  // do "mesmo dia" dividia investimento de um calendário por leads de outro.
  const sinceDate = ymdBrt(since);
  const untilDate = ymdBrt(until);

  // Período fechado já respondido antes? Sai sem tocar no D1 (ver _cache.js).
  const emCache = await respostaEmCache(request, { until });
  if (emCache) return emCache;

  const [gastos, leads, overrides, funisConhecidos] = await Promise.all([
    env.DB.prepare(`
      SELECT campaign_id, MAX(campaign_name) AS campaign_name, SUM(spend_cents) AS spend_cents
      FROM ad_spend
      WHERE platform = 'meta' AND date BETWEEN ? AND ?
      GROUP BY campaign_id
    `).bind(sinceDate, untilDate).all(),

    env.DB.prepare(`
      SELECT
        COALESCE(NULLIF(e.funnel, ''), s.funnel) AS funnel,
        s.utm_source,
        s.utm_campaign,
        e.material,
        e.origin,
        -- Card que a ponte CRIOU para este lead (lead novo); NULL = já tinha
        -- card (retorno) ou não passou pela ponte. Busca pelo índice
        -- idx_lead_dispatch_event, uma linha por lead do período.
        (SELECT d.task_id FROM lead_dispatch d
          WHERE d.event_id = e.event_id AND d.resultado = 'criado' AND d.task_id IS NOT NULL
          LIMIT 1) AS task_novo
      FROM event_log e
      LEFT JOIN sessions s ON e.session_id = s.session_id
      WHERE e.event_name = 'Lead'
        AND e.timestamp >= ? AND e.timestamp <= ?
        AND e.is_bot = 0
        AND COALESCE(e.is_junk, 0) = 0
        ${clausulasBotIpSql('s')}
    `).bind(since, until).all(),

    env.DB.prepare('SELECT campaign_id, funnel FROM campaign_funnel_map').all(),

    listarFunisConhecidos(env.DB),
  ]);

  const resultado = calcularCpl({
    leads: leads.results || [],
    gastos: gastos.results || [],
    overrides: overrides.results || [],
    funisConhecidos,
  });

  // Reuniões e custo por reunião (spec-conversao-agenda.md, módulo 4): mesmo
  // investimento por funil do CPL, funil do formulário de onde o lead veio.
  // Agendada conta pela data em que agendou; realizada, pela data da reunião.
  let reunioes = null;
  try {
    const [ag, re, tiposComerciais] = await Promise.all([
      env.DB.prepare(`SELECT COALESCE(funil, '') AS funil FROM agenda_reunioes
                       WHERE comercial = 1 AND is_teste = 0 AND criado_em >= ? AND criado_em <= ?`).bind(since, until).all(),
      env.DB.prepare(`SELECT COALESCE(funil, '') AS funil FROM agenda_reunioes
                       WHERE comercial = 1 AND is_teste = 0 AND situacao = 'realizada' AND inicio >= ? AND inicio <= ?`).bind(since, until).all(),
      env.DB.prepare(`SELECT DISTINCT funil FROM agenda_tipos WHERE comercial = 1 AND funil IS NOT NULL`).all(),
    ]);
    reunioes = custoPorReuniao({
      porFunilCpl: resultado.por_funil,
      agendadas: ag.results || [],
      realizadas: re.results || [],
      funisComAgenda: (tiposComerciais.results || []).map((t) => t.funil),
    });
  } catch (e) {
    // Agenda fora do ar não derruba o CPL: os números de reunião ficam "—".
    console.error('cpl: reuniões', e.message);
  }

  const avisos = montarAvisosCpl({
    por_funil: resultado.por_funil,
    gastos: gastos.results || [],
    leads: leads.results || [],
  });

  // `por_canal` é uma LISTA ordenada por CANAIS (ver _cpl-calculo.js); a linha
  // 'meta-ads' só existe quando houve gasto ou lead pago no período.
  return respostaJson(request, { ...resultado, avisos, reunioes }, { until, context });
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
