/**
 * Conferência dos nomes das etapas de um formulário (série S6).
 *
 * Toda pergunta precisa de um nome, e o nome não pode se repetir no mesmo
 * formulário: é por ele que o funil do dash agrupa as etapas. Uma pergunta
 * sem nome ou com nome repetido voltaria a misturar os números. O teste
 * (tests/etapas-com-nome.test.js) roda esta conferência sobre as perguntas
 * reais do chat, então o problema é barrado antes de ir ao ar.
 *
 * Devolve a lista de problemas, vazia quando está tudo certo.
 */
export function conferirNomesDasEtapas(perguntas: { chave: string; etapa?: string }[]): string[] {
  const problemas: string[] = [];
  const vistos = new Set<string>();
  for (const p of perguntas) {
    if (!p.etapa) {
      problemas.push(`pergunta "${p.chave}" está sem nome de etapa`);
      continue;
    }
    if (vistos.has(p.etapa)) problemas.push(`nome de etapa repetido: "${p.etapa}"`);
    vistos.add(p.etapa);
  }
  return problemas;
}
