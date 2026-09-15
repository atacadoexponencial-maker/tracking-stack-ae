// Campanha → bloco do cadastro de funis do relatório, e o aviso de conflito da
// aba "Funis do relatório" (spec-feedback-marketing.md, módulo 1).
//
// Módulo PURO: recebe gastos, overrides, funis ativos e funis conhecidos já
// lidos do D1. A ordem de reconhecimento é a da spec (módulo 2):
//   (1) classificação manual da aba Meta Ads (campaign_funnel_map);
//   (2) trecho do nome da campanha de um funil ativo;
//   (3) regra automática pelo último segmento (resolverFunilAuto), incluindo
//       impulsionamento como `aquisicao`;
//   (4) nenhum → "sem funil".
// O funil do tracking reconhecido liga a campanha ao bloco que tem esse funil.
// Nada é dividido nem atribuído ao "primeiro que casou": casou com mais de um
// ou com nenhum, é conflito.

import { resolverFunilAuto } from './_funil-campanha.js';

// `override` = funil gravado na classificação manual (ou vazio).
// Devolve { blocos, funil_tracking, reconhecida_por, motivo }; `motivo` só
// quando a campanha não casa com exatamente um bloco.
export function reconhecerCampanha(campanhaNome, { override = null, funisAtivos = [], funisConhecidos = [] } = {}) {
  const nome = campanhaNome == null ? '' : String(campanhaNome);
  const ativos = funisAtivos || [];
  const porFunil = (f) => ativos.filter((l) => l.funil_tracking && l.funil_tracking === f);

  let blocos;
  let funil = null;
  let reconhecidaPor = null;

  if (override) {
    funil = String(override);
    reconhecidaPor = 'manual';
    blocos = porFunil(funil);
  } else {
    const minusculo = nome.toLowerCase();
    const peloTrecho = ativos.filter((l) => l.trecho_campanha
      && minusculo.includes(String(l.trecho_campanha).trim().toLowerCase()));
    if (peloTrecho.length) {
      reconhecidaPor = 'trecho';
      blocos = peloTrecho;
    } else {
      funil = resolverFunilAuto(nome, funisConhecidos);
      // Impulsionamento é o único caso sem underscore (ver resolverFunilAuto).
      reconhecidaPor = funil ? (nome.includes('_') ? 'automatica' : 'impulsionamento') : null;
      blocos = funil ? porFunil(funil) : [];
    }
  }

  let motivo = null;
  if (blocos.length > 1) motivo = 'casou com mais de um funil';
  else if (!blocos.length) motivo = funil ? `funil ${funil} não cadastrado no relatório` : 'nenhum funil reconhecido';

  return { blocos, funil_tracking: funil, reconhecida_por: reconhecidaPor, motivo };
}

// Cada campanha COM investimento reconhecida contra o cadastro. Usada pelo
// aviso de conflito da aba e pelo GET /api/feedback-marketing — uma regra só.
// `gastos` = [{ campaign_id, campaign_name, spend_cents }] já somados por campanha.
// Devolve [{ campaign_id, campanha, spend_cents, ...reconhecerCampanha }].
export function reconhecerGastos(gastos, { overrides = [], funisAtivos = [], funisConhecidos = [] } = {}) {
  const mapaOverride = new Map((overrides || []).map((o) => [String(o.campaign_id), o.funnel]));
  return (gastos || [])
    .filter((g) => Number(g.spend_cents) > 0)
    .map((g) => ({
      campaign_id: g.campaign_id,
      // Reconhece pelo nome como veio (vazio não casa nada, igual a
      // /api/campaign-funnel); o id só aparece na listagem quando falta nome —
      // passado à regra automática, um id sem "_" viraria impulsionamento.
      campanha: g.campaign_name || String(g.campaign_id),
      spend_cents: Math.round(Number(g.spend_cents)),
      ...reconhecerCampanha(g.campaign_name, {
        override: mapaOverride.get(String(g.campaign_id)) || null,
        funisAtivos,
        funisConhecidos,
      }),
    }));
}

// Campanhas com investimento que casam com mais de um funil ativo ou com
// nenhum, com o valor em reais (duas casas), da maior para a menor.
export function listarConflitosCampanhas(gastos, ctx = {}) {
  return reconhecerGastos(gastos, ctx)
    .filter((r) => r.motivo)
    .map((r) => ({ campanha: r.campanha, valor: r.spend_cents / 100, motivo: r.motivo }))
    .sort((a, b) => b.valor - a.valor || a.campanha.localeCompare(b.campanha));
}
