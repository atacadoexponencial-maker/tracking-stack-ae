// Tabela de lotes da Imersão Planejamento Atacado 2027
// (/imersao-planejamento-atacado).
//
// Só a TABELA mora aqui. A regra (qual lote vale em cada instante, texto do
// próximo lote, quanto do lote já passou) é a mesma da Black e vem de
// src/data/lotes-workshop.js, que recebe esta tabela como parâmetro. Mesmo
// formato de lá: fronteiras ISO com deslocamento explícito (-03:00) e o `fim`
// de um lote é LITERALMENTE o `inicio` do seguinte, para não existir buraco nem
// sobreposição.
//
// A virada é às 23:59 do último dia de cada lote (mesma convenção da Black).
// O lote 07 é o único diferente: vai até o início do evento, 05/12 às 9h30, e
// ali as vendas encerram.
//
// `ate` é o texto curto que a barra de progresso mostra ("até 15/11"). Fica
// escrito à mão ao lado do `fim` para ninguém ter que formatar data em fuso de
// Brasília no navegador do visitante.
export const LOTES_IMERSAO = [
  {
    rotulo: 'Lote 01',
    valor: 'R$ 29',
    ate: '15/11',
    inicio: '2026-11-09T00:00:00-03:00',
    fim: '2026-11-15T23:59:00-03:00',
  },
  {
    rotulo: 'Lote 02',
    valor: 'R$ 35',
    ate: '18/11',
    inicio: '2026-11-15T23:59:00-03:00',
    fim: '2026-11-18T23:59:00-03:00',
  },
  {
    rotulo: 'Lote 03',
    valor: 'R$ 39',
    ate: '22/11',
    inicio: '2026-11-18T23:59:00-03:00',
    fim: '2026-11-22T23:59:00-03:00',
  },
  {
    rotulo: 'Lote 04',
    valor: 'R$ 45',
    ate: '25/11',
    inicio: '2026-11-22T23:59:00-03:00',
    fim: '2026-11-25T23:59:00-03:00',
  },
  {
    rotulo: 'Lote 05',
    valor: 'R$ 49',
    ate: '29/11',
    inicio: '2026-11-25T23:59:00-03:00',
    fim: '2026-11-29T23:59:00-03:00',
  },
  {
    rotulo: 'Lote 06',
    valor: 'R$ 55',
    ate: '02/12',
    inicio: '2026-11-29T23:59:00-03:00',
    fim: '2026-12-02T23:59:00-03:00',
  },
  {
    rotulo: 'Lote 07',
    valor: 'R$ 59',
    ate: '05/12, 9h30',
    inicio: '2026-12-02T23:59:00-03:00',
    fim: '2026-12-05T09:30:00-03:00',
  },
];

// Preço riscado, fixo em todos os lotes (decisão da usuária em 09/11: R$ 97,
// no lugar dos R$ 59 que estavam na copy).
export const VALOR_CHEIO_IMERSAO = 'R$ 97';
