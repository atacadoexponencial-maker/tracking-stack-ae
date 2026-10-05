// Análise escrita pelo próprio Argo (perfil gestor-ia do Hermes), sem chave
// de API separada (decisão da gestora, 05/10; issues 407 e 410).
//
// O tracking deixa um pedido em `argo.analise_pedidos`. O job do Argo na VPS
// (`argo_relatorio_semanal.py`) pega o pedido, roda o Argo com a consulta
// montada aqui e devolve a resposta. O tracking confere com a MESMA checagem
// (`_argo-relatorio-checagem.js`): os guardrails não dependem do modelo.
// Reprovou: a próxima consulta leva as violações; na segunda tentativa, o que
// passou vai ao ar e o resto sai. Módulo puro.
import { montarMensagem, VERSOES_INSTRUCOES, VERSAO_PADRAO } from './_argo-relatorio-instrucoes.js';
import { checarAnalise, publicar } from './_argo-relatorio-checagem.js';

export const MAX_TENTATIVAS = 2;

/**
 * O texto inteiro que o Argo recebe. O Hermes não tem saída estruturada como a
 * API, então o formato vai por escrito e a checagem reprova o que vier fora dele.
 */
export function montarConsulta(versao, pacote, anterior = null) {
  const instr = VERSOES_INSTRUCOES[versao] || VERSOES_INSTRUCOES[VERSAO_PADRAO];
  return [
    'TAREFA: escrever a leitura semanal da conta do Atacado Exponencial a partir do pacote de fatos abaixo. Não use ferramentas, não consulte nada fora do pacote e não grave memória.',
    instr.sistema,
    'FORMATO DA RESPOSTA: responda APENAS com um objeto JSON válido, sem texto antes ou depois e sem bloco de código, que siga exatamente este esquema (JSON Schema):',
    JSON.stringify(instr.esquema),
    montarMensagem(pacote, anterior),
  ].join('\n\n');
}

/** Normaliza o que o Argo devolveu: objeto JSON ou nada. */
export function lerSaida(saida) {
  return saida && typeof saida === 'object' && !Array.isArray(saida) ? saida : null;
}

/**
 * Processa uma resposta do Argo para um pedido. Devolve o novo histórico e,
 * quando acabou, o que vai ao ar (`publicado`) e a checagem no formato do
 * relatório.
 */
export function processarResposta({ historico = [], pacote, saida, erro }) {
  const tentativa = historico.length + 1;
  const valida = lerSaida(saida);
  const violacoes = valida
    ? checarAnalise(valida, pacote)
    : [{ regra: 'Formato', bloco: 'formato', trecho: '', motivo: erro ? String(erro).slice(0, 200) : 'A resposta não veio em JSON válido.' }];
  const novo = [...historico, { tentativa, saida: valida, violacoes }];
  const checagem = novo.map((h) => ({ tentativa: h.tentativa, resultado: h.violacoes.length ? 'reprovou' : 'passou', violacoes: h.violacoes }));
  if (violacoes.length && tentativa < MAX_TENTATIVAS) {
    return { final: false, historico: novo, checagem, anterior: { saida: valida || {}, violacoes } };
  }
  // A última resposta válida é a que conta; sem nenhuma válida, nada vai ao ar.
  const ultimaValida = [...novo].reverse().find((h) => h.saida);
  const publicado = ultimaValida
    ? publicar(ultimaValida.saida, ultimaValida.violacoes)
    : { situacao: 'nao_passou', blocos: [], removidos: [] };
  return { final: true, historico: novo, checagem, publicado };
}
