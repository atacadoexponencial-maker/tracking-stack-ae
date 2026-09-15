// Montagem dos blocos por tipo de medição para GET /api/feedback-marketing
// (spec-feedback-marketing.md, módulo 2).
//
// Módulo PURO: recebe o funil do cadastro, o investimento do bloco (saída de
// montarInvestimento) e o que cada tipo mede, e devolve o bloco no formato do
// contrato. Convenções: `null` = sem denominador ("—" no relatório), nunca 0
// inventado.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

import { contarMqls } from './_feedback-marketing-mql.js';

export const MARCA_SEM_INVESTIMENTO = 'sem investimento no período';
export const MOTIVO_CONTAGEM_MANUAL = 'contagem manual';

const naoCalculado = () => ({ calculado: false, motivo: MOTIVO_CONTAGEM_MANUAL });

// Custo por resultado em reais com duas casas, calculado em centavos.
// Sem denominador (0 ou desconhecido) não existe custo: null.
export function calcularCusto(investido, quantidade) {
  if (quantidade == null || !(Number(quantidade) > 0)) return null;
  const centavos = Math.round((Number(investido) || 0) * 100);
  return Math.round(centavos / Number(quantidade)) / 100;
}

function baseDoBloco(funil, investimento) {
  return {
    nome: funil.nome,
    tipo: funil.tipo,
    posicao: funil.posicao,
    investido: investimento.investido,
    sem_investimento: investimento.sem_investimento,
    campanhas: investimento.campanhas,
  };
}

// Issue 259. `cards` = novos leads atribuídos ao bloco; null quando o CRM não
// pôde ser lido — leads, MQLs e CPL vêm null, nunca 0.
export function montarBlocoLead({ funil, investimento, cards }) {
  const novosLeads = Array.isArray(cards) ? cards.length : null;
  const custo = calcularCusto(investimento.investido, novosLeads);
  return {
    ...baseDoBloco(funil, investimento),
    metricas: {
      novos_leads: novosLeads,
      mqls: Array.isArray(cards) ? contarMqls(cards) : null,
    },
    custo_tipo: 'CPL',
    custo_por_resultado: custo,
    // CPL 0 é custo zero de verdade (lead orgânico) — marcado para não ser lido
    // como "lead de graça" por engano. Pelo investimento zero, e não por
    // `custo === 0`: R$ 0,01 em 3 leads arredonda o CPL para 0,00 e não é
    // "sem investimento".
    avisos: investimento.sem_investimento && novosLeads > 0 ? [MARCA_SEM_INVESTIMENTO] : [],
  };
}

// Issue 260. O resultado do funil Manual é contado pela equipe fora do tracking:
// a consulta traz só o investimento, e leads e custo vêm "não calculados" —
// ausentes, nunca 0 nem estimados. O número da equipe não entra nem sai daqui.
export function montarBlocoManual({ funil, investimento }) {
  return {
    ...baseDoBloco(funil, investimento),
    metricas: { novos_leads: naoCalculado() },
    custo_tipo: 'CPL',
    custo_por_resultado: naoCalculado(),
    avisos: [],
  };
}

// Issue 263. `compras` = { total, por_origem } das vendas pagas na Greenn no
// período (todas as origens). CPA = investido ÷ total; a quebra por origem é
// complementar e não mexe no CPA. A compra atribuída pelo Meta não entra.
export function montarBlocoVenda({ funil, investimento, compras }) {
  const total = compras.total;
  const custo = calcularCusto(investimento.investido, total);
  return {
    ...baseDoBloco(funil, investimento),
    metricas: {
      compras_realizadas: total,
      compras_por_origem: { ...compras.por_origem },
    },
    custo_tipo: 'CPA',
    custo_por_resultado: custo,
    // Mesma regra do bloco de lead: CPA arredondado para 0,00 não é marca.
    avisos: investimento.sem_investimento && total > 0 ? [MARCA_SEM_INVESTIMENTO] : [],
  };
}

// Sem funil ativo de venda na Greenn, as vendas não aparecem em bloco nenhum —
// e não podem sumir em silêncio. Com 0 vendas não há o que avisar.
export function avisoVendasSemFunilDeVenda(funisAtivos, totalCompras) {
  if (!(totalCompras > 0)) return [];
  if ((funisAtivos || []).some((f) => f.tipo === 'venda_greenn')) return [];
  return [`Há ${totalCompras} vendas pagas na Greenn no período e nenhum funil de venda cadastrado.`];
}

// "1.234,56" a partir de reais, calculado em centavos (sem Intl: o texto do
// aviso não pode depender do ICU do ambiente).
export function formatarReais(valor) {
  const centavos = Math.round((Number(valor) || 0) * 100);
  const sinal = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos);
  const inteiro = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sinal}${inteiro},${String(abs % 100).padStart(2, '0')}`;
}

// Issue 264. `investimento` = montarInvestimento(...).sem_funil;
// `leads` = atribuirCards(...).sem_funil ([{ opcao, cards }]) ou null quando o
// CRM não pôde ser lido. Sem CPL: o investimento e os leads daqui não têm
// ligação entre si.
export function montarSemFunil({ investimento, leads }) {
  const crmLido = Array.isArray(leads);
  const cards = crmLido ? leads.flatMap((g) => g.cards) : null;
  const novosLeads = crmLido ? cards.length : null;
  return {
    investido: investimento.investido,
    campanhas: investimento.campanhas,
    novos_leads: novosLeads,
    leads_por_opcao: crmLido ? leads.map((g) => ({ opcao: g.opcao, novos_leads: g.cards.length })) : null,
    mqls: crmLido ? contarMqls(cards) : null,
    // Sem ler o CRM não dá para afirmar que está vazio.
    vazio: crmLido && investimento.investido === 0 && investimento.campanhas.length === 0 && novosLeads === 0,
  };
}

export function avisoInvestimentoSemFunil(investido) {
  if (!(Number(investido) > 0)) return [];
  return [`R$ ${formatarReais(investido)} de investimento sem funil — classifique as campanhas no dashboard.`];
}
