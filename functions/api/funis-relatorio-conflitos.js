// GET /api/funis-relatorio-conflitos?key=...
//
// Aviso de conflito de campanhas da aba "Funis do relatório"
// (spec-feedback-marketing.md): campanhas com investimento nos últimos 30 dias
// que casam com mais de um funil ativo ou com nenhum, com o valor.
//
// Endpoint ADITIVO e só leitura. Separado de /api/funis-relatorio para a lista
// do cadastro não depender do ad_spend: falha aqui só esconde o aviso, não a
// lista. O reconhecimento vem de _funis-relatorio-conflitos.js.

import { listarConflitosCampanhas } from './_funis-relatorio-conflitos.js';
import { listarFunisConhecidos } from './_funil-campanha.js';
import { ymdBrt } from './_data-brt.js';

const DIAS = 30;

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // 30 dias de Brasília terminando hoje: campanha nova de hoje já aparece.
  // `ad_spend.date` é dia de Brasília (ver _data-brt.js).
  const agora = Math.floor(Date.now() / 1000);
  const inicio = ymdBrt(agora - (DIAS - 1) * 86400);
  const fim = ymdBrt(agora);

  const [gastos, overrides, ativos, funisConhecidos] = await Promise.all([
    env.DB.prepare(`
      SELECT campaign_id, MAX(campaign_name) AS campaign_name, SUM(spend_cents) AS spend_cents
      FROM ad_spend
      WHERE platform = 'meta' AND date BETWEEN ? AND ?
      GROUP BY campaign_id
      HAVING SUM(spend_cents) > 0
    `).bind(inicio, fim).all(),
    env.DB.prepare('SELECT campaign_id, funnel FROM campaign_funnel_map').all(),
    env.DB.prepare(`
      SELECT id, nome, funil_tracking, trecho_campanha
      FROM funis_relatorio WHERE situacao = 'ativo'
    `).all(),
    listarFunisConhecidos(env.DB),
  ]);

  return json({
    inicio,
    fim,
    conflitos: listarConflitosCampanhas(gastos.results || [], {
      overrides: overrides.results || [],
      funisAtivos: ativos.results || [],
      funisConhecidos,
    }),
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
