// Formatação das respostas impressas do planner (issue 304).
//
// Funções puras, sem DOM, para serem testáveis por `node --test` — mesmo
// motivo pelo qual `_argo-auth.js` e `_ab-estatistica.js` moram em módulos
// próprios. O que toca no documento fica em `planner-impressao.ts`.
//
// A regra que atravessa todas elas: campo vazio NÃO vira caixa em branco com
// borda na folha. Vazio devolve string vazia, e quem chama decide se some ou
// se põe um traço. Uma folha cheia de retângulos vazios é o que faz um planner
// parecer formulário de cartório.

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

// '2026-11-27' → '27 de novembro de 2026'
//
// Lida na mão, e não com `toLocaleDateString`: `new Date('2026-11-27')` é
// interpretado como UTC e, em qualquer fuso a oeste de Greenwich — o Brasil
// inteiro —, volta como dia 26. A folha diria que a Black Friday é 26/11.
export function dataPorExtenso(iso) {
  if (typeof iso !== 'string') return '';
  const partes = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!partes) return '';

  const [, ano, mes, dia] = partes;
  const indice = Number(mes) - 1;
  if (indice < 0 || indice > 11) return '';

  return `${Number(dia)} de ${MESES[indice]} de ${ano}`;
}

// 12500 → 'R$ 12.500,00'. Aceita o que a pessoa digitou com pontos, vírgula ou
// o próprio "R$" colado.
export function dinheiroPorExtenso(valor) {
  const numero = numeroDe(valor);
  if (numero === null) return '';

  const formatado = numero.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });

  // `toLocaleString` separa o "R$" do número com espaço não-quebrável (U+00A0).
  // Invisível na tela, mas vira caractere estranho em cópia/colagem e em
  // conversão para PDF em alguns motores. A folha usa espaço comum.
  return formatado.replace(/ /g, ' ');
}

// '1.250' → 1250. Devolve null quando não há número nenhum, para o chamador
// distinguir "vazio" de "zero" — zero é resposta legítima no planner (quem
// nunca rodou uma Black escreve 0).
export function numeroDe(valor) {
  if (valor === null || valor === undefined) return null;

  const cru = String(valor).trim();
  if (cru === '') return null;

  // Tira tudo que não é dígito, vírgula, ponto ou sinal; depois trata o
  // formato brasileiro: ponto é milhar, vírgula é decimal.
  const limpo = cru.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  if (limpo === '' || limpo === '-') return null;

  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : null;
}

// Número de peças/revendedores para a folha: sem casa decimal, com separador
// de milhar. Vazio devolve ''.
export function inteiroPorExtenso(valor) {
  const numero = numeroDe(valor);
  if (numero === null) return '';
  return Math.round(numero).toLocaleString('pt-BR');
}

// Percentual: 15 → '15%'.
export function percentualPorExtenso(valor) {
  const numero = numeroDe(valor);
  if (numero === null) return '';
  return `${numero.toLocaleString('pt-BR')}%`;
}

// Junta as opções marcadas numa frase única para a folha. Uma marcação sai
// sozinha; duas ou mais saem separadas por vírgula, com "e" antes da última.
export function listaPorExtenso(itens) {
  const limpos = (Array.isArray(itens) ? itens : [])
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);

  if (limpos.length === 0) return '';
  if (limpos.length === 1) return limpos[0];

  return `${limpos.slice(0, -1).join(', ')} e ${limpos[limpos.length - 1]}`;
}

// Escolhe o formatador pelo tipo declarado em `planner-black.js`.
export function formatarResposta(tipo, valor) {
  switch (tipo) {
    case 'data':
      return dataPorExtenso(valor);
    case 'dinheiro':
      return dinheiroPorExtenso(valor);
    case 'percentual':
      return percentualPorExtenso(valor);
    case 'numero':
      return inteiroPorExtenso(valor);
    default:
      return String(valor ?? '').trim();
  }
}

export { MESES };
