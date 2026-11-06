// Nome da etapa concluída num formulário (série S6, spec-etapas-com-nome.md).
//
// Função pura: o /tracker chama no `FormStep` antes de gravar `step_nome`.
// Nome inválido NÃO recusa o evento: devolve `null` e a etapa fica gravada só
// com a posição, como antes desta mudança — perder a etapa seria pior do que
// perder o nome.

const FORMATO = /^[a-z0-9-]{1,40}$/;

/** Devolve o nome se for válido (minúsculas, números e hífen, até 40), senão `null`. */
export function nomeDeEtapa(valor) {
  if (typeof valor !== 'string') return null;
  return FORMATO.test(valor) ? valor : null;
}
