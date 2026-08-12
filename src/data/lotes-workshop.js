// Tabela de lotes do Workshop Black Exponencial 2026 (issue 186).
//
// Módulo PURO: sem DOM, sem `window`, sem `Date.now()` interno, sem I/O — é o
// que permite testá-lo com `node --test` sem subir navegador (mesmo precedente
// de functions/_links-destino.js + tests/links-destino.test.js e de
// src/data/materiais.js).
//
// Mora em src/data/ porque é a tabela de negócio da página: importado tanto
// pelo frontmatter de src/pages/workshop-black-exponencial-2026.astro (para o
// HTML nascer no primeiro lote) quanto pelo <script> da própria página.
//
// FUSO: as fronteiras são escritas como ISO com deslocamento EXPLÍCITO
// (`-03:00`) e viram epoch em ms via `Date.parse`. A comparação passa a ser
// número >= número, então o fuso configurado no aparelho do visitante não
// participa da conta. America/Sao_Paulo não tem horário de verão desde 2019, e
// se um dia voltar ESTE é o único ponto a mudar (mesmo aviso de
// functions/api/webhooks/_classificar.js). Não se usa
// `toLocaleString('pt-BR', { timeZone: ... })` para decidir o lote: formatar em
// outro fuso e reinterpretar a string é o caminho que gera erro de 1 hora nas
// bordas.
//
// RISCO ACEITO — relógio errado do dispositivo: quem decide o lote é
// `Date.now()` do visitante, então um aparelho com a data errada vê o lote
// errado (inclusive "encerradas" antes da hora). Isso é consciente, não é bug a
// corrigir aqui: o site é estático (`output: 'static'`), não há servidor no
// caminho da renderização para fornecer a hora, e a spec proíbe qualquer
// relógio/contador na página. Na prática o preço aqui é informativo e quem cobra
// é o checkout — o valor final é sempre o configurado lá. Ninguém deve
// "consertar" isto depois com um fetch de hora do servidor sem discutir antes.

// Valores são strings fixas: são cinco ao todo, e escrevê-los prontos é mais
// simples e mais determinístico que chamar Intl.NumberFormat e depois arrancar
// os centavos. Formato brasileiro, com R$ e sem centavos.

// O `fim` de um lote é LITERALMENTE o `inicio` do seguinte: é o que torna
// impossível existir buraco ou sobreposição entre eles.
//
// A VIRADA É ÀS 23:59 DO ÚLTIMO DIA, não à meia-noite do dia seguinte (decisão
// da usuária em 2026-08-12). Consequência a conhecer: no minuto final do dia da
// virada — 23:59:00 a 23:59:59 — o preço exibido já é o do lote seguinte. É o
// comportamento pedido, não um erro de borda.
export const LOTES = [
  {
    rotulo: 'Lote 1',
    valor: 'R$ 27',
    inicio: '2026-08-10T00:00:00-03:00',
    fim: '2026-08-17T23:59:00-03:00',
  },
  {
    rotulo: 'Lote 2',
    valor: 'R$ 47',
    inicio: '2026-08-17T23:59:00-03:00',
    fim: '2026-08-24T23:59:00-03:00',
  },
  {
    rotulo: 'Lote 3',
    valor: 'R$ 67',
    inicio: '2026-08-24T23:59:00-03:00',
    fim: '2026-08-31T23:59:00-03:00',
  },
  {
    rotulo: 'Lote 4',
    valor: 'R$ 97',
    inicio: '2026-08-31T23:59:00-03:00',
    // As vendas encerram às 20h do dia do workshop — que começa às 19h. Ou
    // seja, a primeira hora da aula ainda vende, de propósito.
    fim: '2026-09-09T20:00:00-03:00',
  },
];

// Ancoragem riscada na caixa de oferta. É FIXA e não é um lote — a constante
// existe para o texto ficar em um lugar só e para o teste poder afirmar que
// ninguém a transformou em lote.
export const VALOR_CHEIO = 'R$ 297';

function aberto(indice) {
  const lote = LOTES[indice];
  const seguinte = LOTES[indice + 1];
  return {
    estado: 'aberto',
    rotulo: lote.rotulo,
    valor: lote.valor,
    proximoValor: seguinte ? seguinte.valor : null,
  };
}

/**
 * Qual lote está vigente no instante `agoraMs` (epoch em milissegundos).
 *
 * O instante é INJETADO, nunca lido de `Date.now()` aqui dentro: é o que torna
 * todas as viradas testáveis.
 *
 * Regra de faixa: início inclusivo, fim exclusivo (`inicio <= agora < fim`).
 * Um e só um lote vigente por instante — nenhum instante pertence a dois lotes
 * e nenhum fica órfão entre eles. Como os lotes são contíguos, basta escolher o
 * primeiro cujo `fim` ainda não passou.
 *
 * Antes do início do primeiro lote devolve o primeiro lote (a página não
 * inventa "em breve" nem esconde o preço). Depois do fim do último devolve
 * `{ estado: 'encerrado' }`, sem preço.
 *
 * Se alguma fronteira não for finita (literal escrito errado) ou `agoraMs` não
 * for um número finito, devolve o primeiro lote: errar para o lado de continuar
 * vendendo é menos danoso que fechar a loja por engano.
 */
export function loteVigente(agoraMs) {
  const fins = LOTES.map((l) => Date.parse(l.fim));
  if (!fins.every(Number.isFinite)) return aberto(0);
  if (!Number.isFinite(agoraMs)) return aberto(0);

  for (let i = 0; i < LOTES.length; i += 1) {
    if (agoraMs < fins[i]) return aberto(i);
  }
  return { estado: 'encerrado' };
}

/**
 * Texto da linha do próximo lote. Devolve `null` quando não há lote seguinte —
 * a página nunca anuncia um valor que não existe.
 */
export function textoProximo(proximoValor, rotulo) {
  if (!proximoValor || !rotulo) return null;
  return `Depois do ${rotulo}, o valor sobe para ${proximoValor}`;
}
