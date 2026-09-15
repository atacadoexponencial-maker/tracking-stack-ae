// GET /api/funis-relatorio-opcoes?key=...
//
// Opções do formulário da aba "Funis do relatório" (spec-feedback-marketing.md):
//   funis_tracking — os mesmos funis da classificação manual de campanhas da
//                    aba Meta Ads (listarFunisConhecidos) mais `aquisicao`;
//   crm            — opções atuais do campo "🔻 Funil" lidas do CRM, ou a falha
//                    com a mensagem pronta para o formulário;
//   tipos          — por tipo de medição, quais campos o formulário mostra e os
//                    textos de nota (a mesma tabela que a validação usa).
//
// Endpoint ADITIVO: nenhum endpoint existente foi alterado. Só leitura.

import { listarFunisConhecidos } from './_funil-campanha.js';
import { CANAL_AQUISICAO } from './_canal.js';
import { lerOpcoesFunilCrm } from './_crm-opcoes-funil.js';
import { formularioPorTipo } from './_funis-relatorio-validacao.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // A leitura do CRM nunca lança (devolve { ok: false }); só a do D1 derruba.
  const [funis, crm] = await Promise.all([
    listarFunisConhecidos(env.DB),
    lerOpcoesFunilCrm(env),
  ]);

  // Mesma lista que /api/campaign-funnel oferece no <select> da aba Meta Ads.
  return json({
    funis_tracking: [...new Set([...funis, CANAL_AQUISICAO])],
    crm,
    tipos: formularioPorTipo(),
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
