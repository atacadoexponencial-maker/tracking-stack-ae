// Funil do lead pela origem, não pelo formulário (spec-funil-pela-utm.md, S3).
//
// O formulário é PORTA, não funil: /aplicacao-mentoria, a home, as /se-* e as
// iscas do ManyChat são entradas da sessão estratégica, e uma pode substituir a
// outra. Nelas, quem decide o funil é o dinheiro que trouxe a pessoa — a mesma
// classificação de campanha usada no investimento, para gasto e lead caírem no
// mesmo funil. Formulário de PRODUTO (workshop, lives, tráfego, calculadora)
// fica sempre no próprio funil, venha de onde vier (decisão de 19/10/2026).
//
// Regra única do dash: quem precisa do funil de um lead chama funilDoLead.

import { canalDeLead, CANAL_AQUISICAO } from './_canal.js';
import { resolverFunilAuto, FUNIL_SEM_CLASSIFICACAO } from './_funil-campanha.js';

export const FUNIL_SE = 'sessao-estrategica';

// Prefixo vale para as variantes (workshop-gratuito, lives-semanais-v1...).
const PRODUTOS = ['workshop', 'lives-semanais', 'trafego-atacado', 'calculadora'];

// Nomes de porta que ainda aparecem em formulário ou em ajuste de campanha.
const PORTA_AQUISICAO = new Set(['iscas-manychat']);
const PORTA_SE = new Set(['sessao-estrategica', 'aplicacao-mentoria', 'diagnostico']);

const texto = (v) => (v == null ? '' : String(v)).trim().toLowerCase();

function ehProduto(funil) {
  const f = texto(funil);
  return PRODUTOS.some((p) => f === p || f.startsWith(p + '-'));
}

/** Funil de porta vira o funil de verdade; os demais passam iguais. */
export function normalizarFunil(funil) {
  const f = texto(funil);
  if (PORTA_AQUISICAO.has(f)) return CANAL_AQUISICAO;
  if (PORTA_SE.has(f)) return FUNIL_SE;
  return funil;
}

/**
 * Nome da campanha (minúsculo) → funil, com a mesma precedência do
 * investimento: ajuste manual por campaign_id, depois o automático pelo nome.
 * `campanhas` = [{ campaign_id, campaign_name }] (todas as já vistas no Meta).
 */
export function mapaCampanhas({ campanhas = [], overrides = [], funisConhecidos = [] }) {
  const manual = new Map((overrides || []).map((o) => [String(o.campaign_id), o.funnel]));
  const mapa = new Map();
  for (const c of campanhas || []) {
    const nome = texto(c.campaign_name);
    if (!nome) continue;
    const funil = manual.get(String(c.campaign_id)) || resolverFunilAuto(c.campaign_name, funisConhecidos);
    if (funil && funil !== FUNIL_SEM_CLASSIFICACAO) mapa.set(nome, normalizarFunil(funil));
  }
  return mapa;
}

/**
 * Funil do lead. `lead` = { funnel, utm_source, utm_campaign, material };
 * `mapa` = mapaCampanhas(...); `funisConhecidos` para reconhecer campanha que
 * não está no mapa pelo nome padrão ae_..._<funil>.
 */
export function funilDoLead(lead, mapa = new Map(), funisConhecidos = []) {
  const doForm = (lead.funnel == null ? '' : String(lead.funnel)).trim();
  if (ehProduto(doForm)) return doForm;

  const canal = canalDeLead(lead);
  if (canal === 'manychat' || canal === 'bio' || PORTA_AQUISICAO.has(texto(doForm)) || texto(lead.utm_source) === 'manychat') {
    return CANAL_AQUISICAO;
  }

  const campanha = texto(lead.utm_campaign);
  let funil = campanha ? mapa.get(campanha) : null;
  // Sem `_` o automático chamaria de impulsionamento — lead não vem de post
  // impulsionado, e `{{campaign.name}}` (anúncio sem nome) cairia ali.
  if (!funil && campanha.includes('_')) {
    const auto = resolverFunilAuto(lead.utm_campaign, funisConhecidos);
    if (auto && auto !== CANAL_AQUISICAO) funil = normalizarFunil(auto);
  }
  return funil || FUNIL_SE;
}

/**
 * Lê do D1 o que a regra precisa: todas as campanhas do Meta já vistas e os
 * ajustes manuais. Uma consulta pequena (uma linha por campanha). Falhou, o
 * mapa sai vazio e só o reconhecimento pelo nome padrão vale.
 */
export async function carregarMapaCampanhas(DB, funisConhecidos) {
  try {
    const [campanhas, overrides] = await Promise.all([
      DB.prepare(`SELECT campaign_id, MAX(campaign_name) AS campaign_name FROM ad_spend WHERE platform = 'meta' GROUP BY campaign_id`).all(),
      DB.prepare('SELECT campaign_id, funnel FROM campaign_funnel_map').all(),
    ]);
    return mapaCampanhas({ campanhas: campanhas.results || [], overrides: overrides.results || [], funisConhecidos });
  } catch (e) {
    console.error('funil do lead: campanhas', e.message);
    return new Map();
  }
}

/**
 * Opções do seletor de funil do dash: os funis do formulário passados pela
 * regra (porta vira o funil de verdade), mais aquisição, sem repetição.
 */
export function funisDoSeletor(funisConhecidos = []) {
  const lista = new Set([CANAL_AQUISICAO]);
  for (const f of funisConhecidos || []) {
    const n = normalizarFunil(f);
    if (n) lista.add(n);
  }
  return [...lista].sort();
}
