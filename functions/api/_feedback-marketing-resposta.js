// Montagem final da resposta de GET /api/feedback-marketing
// (spec-feedback-marketing.md, módulo 2, "Bloco 'sem funil', ordem e resposta").
//
// Módulo PURO: recebe os blocos já montados (issues 256–264) e devolve o corpo
// na ordem do contrato. `agoraUnix` é injetável para os testes.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

import { dataHoraIso } from './_feedback-marketing-investimento.js';
import { NOTA_MQL } from './_feedback-marketing-mql.js';

export const AVISO_NENHUM_FUNIL = 'Nenhum funil cadastrado.';
export const ERRO_FALHA_INESPERADA = 'Não foi possível montar o feedback agora.';

// Soma que se recusa a ser parcial: se uma parte é null (fonte não respondeu),
// o total é null.
function somaOuNull(valores) {
  let soma = 0;
  for (const v of valores) {
    if (v == null) return null;
    soma += v;
  }
  return soma;
}

// Totais: leads e MQLs dos blocos do tipo lead + "sem funil" (nada do tipo
// Manual); compras do bloco de venda na Greenn, ou null sem esse bloco.
export function montarTotais({ investidoGeral, blocos = [], semFunil }) {
  const deLead = blocos.filter((b) => b.tipo === 'lead_mql');
  const venda = blocos.find((b) => b.tipo === 'venda_greenn');
  return {
    investido_geral: investidoGeral,
    novos_leads: somaOuNull([...deLead.map((b) => b.metricas.novos_leads), semFunil.novos_leads]),
    mqls: somaOuNull([...deLead.map((b) => b.metricas.mqls), semFunil.mqls]),
    compras_realizadas: venda ? venda.metricas.compras_realizadas : null,
  };
}

// `blocos` já na ordem do cadastro (não são reordenados aqui); `avisos` = os
// avisos gerais das leituras, na ordem em que foram produzidos.
export function montarResposta({
  periodo,
  agoraUnix,
  investimento,
  blocos = [],
  semFunil,
  crmLido,
  ultimoEventoGreennUnix = null,
  avisos = [],
}) {
  const ultimoGreenn = ultimoEventoGreennUnix == null ? null : Number(ultimoEventoGreennUnix);
  return {
    periodo,
    gerado_em: dataHoraIso(agoraUnix),
    investido_geral: investimento.investido_geral,
    blocos,
    sem_funil: semFunil,
    totais: montarTotais({ investidoGeral: investimento.investido_geral, blocos, semFunil }),
    frescor: {
      investimento_atualizado_em: investimento.investimento_atualizado_em,
      crm_lido: !!crmLido,
      greenn_ultimo_evento_em: Number.isFinite(ultimoGreenn) ? dataHoraIso(ultimoGreenn) : null,
    },
    nota_mql: NOTA_MQL,
    avisos: [...(blocos.length ? [] : [AVISO_NENHUM_FUNIL]), ...avisos],
  };
}
