// Testes do conteúdo do Planner da Black Atacado (issue 298).
//
// O planner não tem backend nem banco: o que existe para dar errado em
// silêncio é o CONTEÚDO. Uma semana faltando na trilha, um canal a menos na
// tabela, duas chaves de campo repetidas (que fariam dois campos escreverem um
// por cima do outro no rascunho) ou uma data de 2026 caindo no dia da semana
// errado passariam despercebidos numa leitura rápida e só apareceriam ao vivo,
// com a turma preenchendo. Daí estes testes.
//
// A parte mais importante é a das datas. O planner afirma, em texto, que a
// Black Friday de 2026 cai numa sexta e que o Dia das Crianças abre a semana.
// Se a afirmação e a data divergirem, o planner mente com cara de autoridade.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DATAS_2026,
  BLOCOS,
  BLOCO_2,
  BLOCO_3,
  BLOCO_4,
  CABECALHO,
  RODAPE,
  MICROCOPY,
  chavesDoCanal,
} from '../src/data/planner-black.js';

// Dia da semana em UTC, para o fuso de quem roda o teste não mudar o
// resultado: 0 é domingo, 1 segunda, ... 6 sábado.
function diaDaSemana(iso) {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

const DOMINGO = 0;
const SEGUNDA = 1;
const TERCA = 2;
const QUARTA = 3;
const SEXTA = 5;

// Percorre a estrutura inteira recolhendo todo campo que tenha `chave`.
function coletarChaves(no, achadas = []) {
  if (Array.isArray(no)) {
    for (const item of no) coletarChaves(item, achadas);
    return achadas;
  }
  if (no && typeof no === 'object') {
    if (typeof no.chave === 'string') achadas.push(no.chave);
    for (const valor of Object.values(no)) coletarChaves(valor, achadas);
  }
  return achadas;
}

test('as datas de 2026 caem nos dias da semana que o planner afirma', () => {
  assert.equal(diaDaSemana(DATAS_2026.blackFriday), SEXTA, 'Black Friday 27/11 é sexta');
  assert.equal(diaDaSemana(DATAS_2026.cyberMonday), SEGUNDA, 'Cyber Monday 30/11 é segunda');
  assert.equal(diaDaSemana(DATAS_2026.pico1Inicio), SEGUNDA, 'Dia das Crianças 12/10 é segunda');
  assert.equal(diaDaSemana(DATAS_2026.blackVip), QUARTA, 'Black VIP 11/11 é quarta');
  assert.equal(diaDaSemana(DATAS_2026.aquecimentoInicio), SEGUNDA, 'aquecimento abre numa segunda');
  assert.equal(diaDaSemana(DATAS_2026.pico2Inicio), SEGUNDA, 'pico 2 abre numa segunda');
  assert.equal(diaDaSemana(DATAS_2026.prazoArte), SEXTA, 'prazo da arte cai numa sexta');
  assert.equal(diaDaSemana(DATAS_2026.pico1MinimoAte), DOMINGO, 'o mínimo reduzido vale até o fim da semana');
  assert.equal(diaDaSemana(DATAS_2026.posVendaInicio), TERCA, 'pós-venda começa em 01/12');
});

test('a janela de antecipação é mesmo de 45 a 30 dias antes da Black', () => {
  const black = new Date(`${DATAS_2026.blackFriday}T00:00:00Z`);
  const dia = 24 * 60 * 60 * 1000;

  const quarentaECinco = new Date(black.getTime() - 45 * dia).toISOString().slice(0, 10);
  const trinta = new Date(black.getTime() - 30 * dia).toISOString().slice(0, 10);

  // São os dois extremos que o texto do bloco 2 e do bloco 3 citam de cabeça.
  assert.equal(quarentaECinco, '2026-10-13');
  assert.equal(trinta, '2026-10-28');
});

test('o aquecimento começa antes do pico 1, e a arte fica pronta antes do aquecimento', () => {
  assert.ok(DATAS_2026.prazoArte < DATAS_2026.aquecimentoInicio, 'arte antes do aquecimento');
  assert.ok(DATAS_2026.aquecimentoInicio < DATAS_2026.pico1Inicio, 'aquecimento antes da venda');
  assert.ok(DATAS_2026.pico1Inicio < DATAS_2026.pico2Inicio, 'pico 1 antes do pico 2');
  assert.ok(DATAS_2026.blackVip < DATAS_2026.blackFriday, 'a VIP acontece antes da Black');
  assert.ok(DATAS_2026.vendasFim < DATAS_2026.posVendaInicio, 'pós-venda começa depois das vendas');
});

test('o planner tem os quatro blocos, na ordem da aula', () => {
  assert.equal(BLOCOS.length, 4);
  assert.deepEqual(
    BLOCOS.map((b) => b.numero),
    [1, 2, 3, 4],
  );
  for (const bloco of BLOCOS) {
    assert.ok(bloco.id, 'todo bloco tem id');
    assert.ok(bloco.titulo, 'todo bloco tem título');
  }
});

test('todo bloco tem rótulo curto, distinto e que cabe na barra do celular', () => {
  // Os quatro ficam lado a lado numa tela de celular. Um rótulo comprido
  // quebra a linha ou vaza — e um rótulo repetido faz a pessoa clicar no
  // errado enquanto assiste à aula.
  const curtos = BLOCOS.map((bloco) => bloco.curto);

  for (const curto of curtos) {
    assert.ok(curto, 'todo bloco tem rótulo curto');
    assert.ok(curto.length <= 10, `rótulo longo demais para a barra: ${curto}`);
  }
  assert.equal(new Set(curtos).size, 4, 'os quatro rótulos curtos são distintos');
});

test('as duas trilhas do calendário têm cinco semanas cada, sem buraco', () => {
  assert.equal(BLOCO_3.trilhas.length, 2);
  for (const trilha of BLOCO_3.trilhas) {
    assert.equal(trilha.semanas.length, 5, `${trilha.id} tem cinco semanas`);
    for (const semana of trilha.semanas) {
      assert.match(semana.periodo, /^\d{2}\/\d{2} a \d{2}\/\d{2}$/);
      assert.ok(semana.funcao.length > 10, 'cada semana diz para que serve');
    }
  }
});

test('as dez semanas cobrem de 28/09 a 06/12 sem pular nem repetir', () => {
  const semanas = BLOCO_3.trilhas.flatMap((t) => t.semanas);
  assert.equal(semanas.length, 10);

  const inicios = semanas.map((s) => s.periodo.split(' a ')[0]);
  const fins = semanas.map((s) => s.periodo.split(' a ')[1]);

  assert.equal(inicios[0], '28/09', 'a primeira semana abre o aquecimento');
  assert.equal(fins[9], '06/12', 'a última semana fecha na virada de dezembro');

  // O fim de uma semana e o começo da seguinte têm que ser dias consecutivos.
  const paraData = (ddmm) => new Date(`2026-${ddmm.slice(3)}-${ddmm.slice(0, 2)}T00:00:00Z`);
  for (let i = 0; i < 9; i += 1) {
    const diferenca = paraData(inicios[i + 1]) - paraData(fins[i]);
    assert.equal(diferenca, 24 * 60 * 60 * 1000, `a semana ${i + 2} começa no dia seguinte ao fim da ${i + 1}`);
  }
});

test('cada pico oferece três narrativas, de três ângulos diferentes', () => {
  assert.equal(BLOCO_2.picos.length, 2);
  for (const pico of BLOCO_2.picos) {
    assert.equal(pico.narrativa.opcoes.length, 3, `${pico.id} tem três narrativas`);
    const angulos = pico.narrativa.opcoes.map((o) => o.angulo);
    assert.equal(new Set(angulos).size, 3, 'os três ângulos são diferentes entre si');
    for (const opcao of pico.narrativa.opcoes) {
      assert.ok(opcao.valor, 'toda narrativa tem valor');
      assert.ok(opcao.texto.length > 20, 'toda narrativa tem texto de verdade');
    }
  }
});

test('as narrativas que citam a marca usam o mesmo marcador de lacuna', () => {
  const comMarca = BLOCO_2.picos
    .flatMap((p) => p.narrativa.opcoes)
    .filter((o) => o.texto.includes('{marca}'));

  // Quatro das seis citam a marca; as outras duas falam de "Black Última Hora"
  // e de estoque, sem nomear ninguém. O que não pode é uma delas inventar outro
  // marcador — a issue 301 só sabe trocar `{marca}`.
  assert.ok(comMarca.length >= 3, 'a maioria das narrativas nomeia a marca');
  for (const opcao of BLOCO_2.picos.flatMap((p) => p.narrativa.opcoes)) {
    assert.doesNotMatch(opcao.texto, /\[marca\]/, 'ninguém usa [marca] no lugar de {marca}');
  }
});

test('a tabela de desconto tem três faixas: o mínimo, o dobro e o triplo', () => {
  const faixas = BLOCO_2.picos[0].progressivo.faixas;
  assert.equal(faixas.length, 3);
  assert.deepEqual(faixas.map((f) => f.multiplo), [1, 2, 3]);
  assert.deepEqual(faixas.map((f) => f.padrao), [5, 10, 15]);
  assert.equal(new Set(faixas.map((f) => f.alvoId)).size, 3, 'cada faixa tem seu próprio alvo');
});

test('a tabela de canais tem os oito canais, com chaves derivadas do id', () => {
  assert.equal(BLOCO_4.canais.length, 8);

  const chaves = BLOCO_4.canais.flatMap((c) => Object.values(chavesDoCanal(c)));
  assert.equal(chaves.length, 16, 'cada canal gera duas chaves');
  assert.equal(new Set(chaves).size, 16, 'nenhuma chave de canal se repete');

  assert.deepEqual(chavesDoCanal({ id: 'live-boom' }), {
    usar: 'canal_liveBoom_usar',
    responsavel: 'canal_liveBoom_responsavel',
  });
  assert.deepEqual(chavesDoCanal({ id: 'whatsapp' }), {
    usar: 'canal_whatsapp_usar',
    responsavel: 'canal_whatsapp_responsavel',
  });
});

test('nenhuma chave de campo se repete — rascunho não pode escrever por cima', () => {
  const doConteudo = coletarChaves([CABECALHO, ...BLOCOS]);
  const dosCanais = BLOCO_4.canais.flatMap((c) => Object.values(chavesDoCanal(c)));
  const todas = [...doConteudo, ...dosCanais];

  const repetidas = todas.filter((chave, i) => todas.indexOf(chave) !== i);
  assert.deepEqual(repetidas, [], `chaves repetidas: ${repetidas.join(', ')}`);
  assert.ok(todas.length > 40, 'o planner tem mais de quarenta campos');
});

test('toda chave é um nome estável, sem espaço nem acento', () => {
  const todas = [
    ...coletarChaves([CABECALHO, ...BLOCOS]),
    ...BLOCO_4.canais.flatMap((c) => Object.values(chavesDoCanal(c))),
  ];
  for (const chave of todas) {
    assert.match(chave, /^[A-Za-z][A-Za-z0-9_]*$/, `chave inválida: ${chave}`);
  }
});

test('o painel da base soma três números, e só isso', () => {
  // Soma pura é decisão de spec: nenhum percentual, nenhuma projeção. Se
  // alguém acrescentar um quarto termo ou um fator, este teste cai.
  assert.deepEqual(BLOCOS[0].painelBase.formula, [
    'ativosHoje',
    'metaNovos',
    'metaReativados',
  ]);
  assert.match(BLOCOS[0].painelBase.frase, /\{total\}/);
  assert.match(BLOCOS[0].painelBase.frase, /\{ativos\}/);
});

test('o rodapé tem as duas saídas: baixar o PDF e imprimir', () => {
  assert.equal(RODAPE.botoes.length, 2);
  assert.deepEqual(RODAPE.botoes.map((b) => b.papel).sort(), ['imprimir', 'pdf']);
  assert.equal(new Set(RODAPE.botoes.map((b) => b.id)).size, 2);
});

test('a microcopy que as issues seguintes exibem já está escrita', () => {
  for (const [nome, texto] of Object.entries(MICROCOPY)) {
    assert.equal(typeof texto, 'string', `${nome} é texto`);
    assert.ok(texto.length > 0, `${nome} não está vazio`);
  }
  assert.match(MICROCOPY.descontoAcimaDaMargem, /\{desconto\}/);
  assert.match(MICROCOPY.descontoAcimaDaMargem, /\{margem\}/);
  assert.match(MICROCOPY.blocoIncompleto, /\{bloco\}/);
});
