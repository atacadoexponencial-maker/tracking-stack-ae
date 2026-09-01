// GET /api/greenn?key=...
//
// Resultado do produto pago que roda na Greenn: receita, investimento e ROAS
// por campanha (spec-greenn-aba-dashboard.md).
//
// NÃO aceita `from`/`to` de propósito. Cada campanha é lida pelo seu ciclo
// inteiro porque o gasto e as vendas caem em dias diferentes: sob um filtro de
// "últimos 7 dias", uma campanha que gastou há duas semanas apareceria com
// investimento zero e ROAS infinito. Mesmo padrão de /api/workshops, que também
// ignora o período do cabeçalho.
//
// Este endpoint é isolado do resto da contabilidade: não lê nem escreve em
// purchase_log, e nenhuma outra aba depende dele (migration 0032).

import { calcularGreenn } from './_greenn-metricas.js';

// D1 limita a quantidade de parâmetros por consulta; as sessões são buscadas
// em lotes para que a aba continue funcionando quando as vendas crescerem.
const LOTE_TRK = 50;

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const vendas = await env.DB.prepare(`
      SELECT entity_id, current_status, amount, received_at, raw_json
      FROM greenn_webhook_event
      WHERE event = 'saleUpdated'
      ORDER BY received_at DESC
    `).all();

    const linhas = vendas.results || [];

    // O `sf_trk` devolvido pela Greenn casa com checkout_sessions.trk — e não
    // com event_log.session_id, que é outra coisa.
    const trks = [...new Set(linhas.map(extrairTrk).filter(Boolean))];
    const sessoes = [];
    for (let i = 0; i < trks.length; i += LOTE_TRK) {
      const lote = trks.slice(i, i + LOTE_TRK);
      const { results } = await env.DB.prepare(`
        SELECT trk, utm_campaign, utm_content, utm_source, utm_medium
        FROM checkout_sessions
        WHERE trk IN (${lote.map(() => '?').join(',')})
      `).bind(...lote).all();
      sessoes.push(...(results || []));
    }

    const gastos = await env.DB.prepare(`
      SELECT campaign_name, SUM(spend_cents) AS spend_cents
      FROM ad_spend
      WHERE platform = 'meta' AND campaign_name IS NOT NULL
      GROUP BY campaign_name
    `).all();

    return json(calcularGreenn({
      vendas: linhas,
      sessoes,
      gastos: gastos.results || [],
    }));
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

// Lê só o `sf_trk` do payload, para montar a consulta das sessões. O parse
// completo (e o tratamento de payload ilegível) mora no módulo de cálculo.
function extrairTrk(linha) {
  try {
    return JSON.parse(linha.raw_json)?.sf_trk || '';
  } catch {
    return '';
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
