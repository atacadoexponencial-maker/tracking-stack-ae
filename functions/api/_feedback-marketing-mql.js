// MQL dos novos leads para GET /api/feedback-marketing
// (spec-feedback-marketing.md, módulo 2, "Contar MQL").
//
// MQL = status ATUAL do card diferente de "Desqualificado" E faturamento mensal
// acima de R$ 20 mil. Porte fiel da régua do relatório atual
// (/root/ae_weekly_comparative_report.py: extract_money_candidates,
// is_low_revenue_bucket, is_mql_task), com duas diferenças: faturamento
// preenchido sem nenhum número NÃO é MQL (pedido; o script contava), e
// "milhão" vale × 1.000.000 (bug do script; nenhum card real hoje).
//
// Módulo PURO. O status é o do momento da consulta — por isso a nota.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

import { CU_FIELD } from './_clickup.js';
import { normalizarTexto, lerCampo } from './_feedback-marketing-crm.js';

export const NOTA_MQL = 'MQL reflete o status atual do card no CRM, no momento da consulta.';

export const CAMPO_FATURAMENTO = {
  id: CU_FIELD.faturamento,
  nomes: ['🤑 Faturamento Mensal', ':money_mouth_face: Faturamento Mensal'],
};

const LIMITE_REAIS = 20000;
const STATUS_DESQUALIFICADO = normalizarTexto('Desqualificado');

// Faixas que o relatório atual trata como "até R$ 20 mil", já sobre o texto
// normalizado (sem acento: "até" vira "ate").
const PADROES_ATE_20_MIL = [
  /menos de\s*(r\$)?\s*20(\.?000|\s*mil|k)?/,
  /abaixo de\s*(r\$)?\s*20(\.?000|\s*mil|k)?/,
  /ate\s*(r\$)?\s*20(\.?000|\s*mil|k)?/,
  /ate\s*(de\s*)?(r\$)?\s*20(\.?000|\s*mil|k)?/,
  /r\$\s*20\.?000,?00/,
  /^20\s*mil$/,
  /^20k$/,
];
const MARCAS_DE_FAIXA = ['ate', 'menos de', 'abaixo de', '-', ' a '];

const RE_MILHAO = /milhao|milhoes|\bmi\b/;

// Valores em reais citados no texto, no formato brasileiro ("20.000",
// "1.500,00"). Número < 1000 em texto com "mil" (ou "r$") vale mil vezes: o
// "150" de "De 150 a 200 Mil" é 150.000, como no relatório atual. "milhão",
// "milhões" ou "mi" vale um milhão de vezes — correção de um bug do script,
// que lia "Mais de 1 Milhão" como abaixo de R$ 20 mil.
export function valoresDeDinheiro(texto) {
  const norm = normalizarTexto(texto);
  const emMilhao = RE_MILHAO.test(norm);
  const emMil = !emMilhao && (norm.includes('mil') || norm.includes('r$'));
  const valores = [];
  for (const m of norm.matchAll(/\d+[\d.]*,?\d*/g)) {
    let valor = Number(m[0].replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(valor)) continue;
    if (valor < 1000) {
      if (emMilhao) valor *= 1000000;
      else if (emMil) valor *= 1000;
    }
    valores.push(valor);
  }
  return valores;
}

export function faturamentoAcimaDe20Mil(texto) {
  const norm = normalizarTexto(texto);
  if (!norm) return false;
  if (PADROES_ATE_20_MIL.some((re) => re.test(norm))) return false;
  const valores = valoresDeDinheiro(norm);
  if (!valores.length) return false;
  if (valores.length === 1) return valores[0] > LIMITE_REAIS;
  // Faixa ("De 20 a 30 Mil"): basta o TETO passar de R$ 20 mil — decisão da
  // usuária em 15/09/2026, igual ao comparativo semanal. "Menos de 20 Mil" e
  // "De 10 a 20 mil" continuam fora.
  if (MARCAS_DE_FAIXA.some((marca) => norm.includes(marca))) {
    return Math.max(...valores) > LIMITE_REAIS;
  }
  return true;
}

export function ehMql(card) {
  const status = normalizarTexto(card && card.status && card.status.status);
  if (status === STATUS_DESQUALIFICADO) return false;
  return faturamentoAcimaDe20Mil(lerCampo(card, CAMPO_FATURAMENTO));
}

export function contarMqls(cards) {
  return (cards || []).filter(ehMql).length;
}
