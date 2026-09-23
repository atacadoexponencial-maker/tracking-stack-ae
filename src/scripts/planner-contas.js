// Contas do planner (issue 301).
//
// Funções puras, sem DOM, pelo mesmo motivo de `planner-formato.js`: dá para
// testar com `node --test`. Quem lê os campos e escreve na tela é
// `planner-campos.ts`.

import { numeroDe, inteiroPorExtenso, dinheiroPorExtenso } from './planner-formato.js';

// Ativos + novos + reativados. Campo vazio conta como zero, mas com TODOS
// vazios a conta devolve null: mostrar "0" seria afirmar algo sobre a base
// dela que ninguém disse ainda.
export function somaDaBase(valores) {
  const numeros = (Array.isArray(valores) ? valores : []).map(numeroDe);
  if (numeros.every((n) => n === null)) return null;
  return numeros.reduce((total, n) => total + (n ?? 0), 0);
}

// Frase do painel com {total} e {ativos} trocados. Sem total, sem frase.
export function fraseDaBase(modelo, total, ativos) {
  if (total === null || total === undefined) return '';
  return String(modelo)
    .replace('{total}', Math.round(total).toLocaleString('pt-BR'))
    .replace('{ativos}', inteiroPorExtenso(ativos) || '0');
}

// O pedido mínimo de hoje, como aparece no bloco 2. A unidade vem da escolha
// Peças/Reais do bloco 1; sem escolha, sai só o número.
export function textoDoMinimo(valor, unidade) {
  if (unidade === 'reais') return dinheiroPorExtenso(valor);
  const numero = inteiroPorExtenso(valor);
  if (!numero) return '';
  return unidade === 'pecas' ? `${numero} peças` : numero;
}
