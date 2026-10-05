import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarTeste, validarEdicao, transicao, mudancasDaEdicao, avaliarLeitura, diasRodando, montarTeste, montarTestes,
} from '../functions/api/_argo-testes.js';

const HOJE = '2026-10-04';
const base = {
  acao: 'criar', tipo: 'criativo', nome: 'Pergunta x número', hipotese: 'Acreditamos que X porque Y', metrica: 'Custo por MQL',
  controle: [{ nivel: 'anuncio', id: '120200000000001', nome: 'ad11' }], variante: [{ nivel: 'anuncio', id: '120200000000002', nome: 'ad09' }],
};

test('criar: exige nome, hipótese, métrica e os dois lados', () => {
  assert.equal(validarTeste({ ...base, nome: ' ' }).erro, 'Dê um nome ao teste.');
  assert.equal(validarTeste({ ...base, hipotese: '' }).erro, 'Escreva a hipótese.');
  assert.equal(validarTeste({ ...base, metrica: '' }).erro, 'Escolha a métrica principal.');
  assert.equal(validarTeste({ ...base, variante: [] }).erro, 'Escolha pelo menos um anúncio ou conjunto em cada lado.');
  assert.equal(validarTeste({ ...base, tipo: 'outro' }).erro, 'Escolha o tipo do teste.');
});

test('criar: lado com id ou nível inválido é recusado, repetido é ignorado', () => {
  assert.equal(validarTeste({ ...base, controle: [{ nivel: 'campanha', id: '1' }] }).ok, false);
  assert.equal(validarTeste({ ...base, controle: [{ nivel: 'anuncio', id: "1; drop" }] }).ok, false);
  const r = validarTeste({ ...base, controle: [{ nivel: 'anuncio', id: '1', nome: 'a' }, { nivel: 'anuncio', id: '1', nome: 'a' }] });
  assert.equal(r.valores.controle.length, 1);
});

test('criar: mesmo alvo nos dois lados só vale em teste de oferta', () => {
  const lado = [{ nivel: 'conjunto', id: '9', nome: 'SE | LAL' }];
  assert.equal(validarTeste({ ...base, controle: lado, variante: lado }).erro, 'O mesmo anúncio ou conjunto não pode estar nos dois lados.');
  assert.equal(validarTeste({ ...base, tipo: 'oferta', controle: lado, variante: lado }).ok, true);
});

test('criar: página exige A/B e ignora lados; padrões de mínimos; começa planejado', () => {
  assert.equal(validarTeste({ ...base, tipo: 'pagina' }).erro, 'Escolha o teste A/B da página.');
  const r = validarTeste({ ...base, tipo: 'pagina', ab_test_id: '3' });
  assert.equal(r.valores.ab_test_id, 3);
  assert.deepEqual(r.valores.controle, []);
  assert.equal(r.valores.min_dias, 14);
  assert.equal(r.valores.min_amostra, 60);
  assert.equal(r.valores.comeca, 'planejado');
  assert.equal(validarTeste({ ...base, comeca: 'rodando' }).valores.comeca, 'rodando');
  assert.equal(validarTeste({ ...base, min_dias: 0 }).ok, false);
});

test('concluir exige resultado e aprendizado; abandonar exige motivo', () => {
  assert.equal(validarTeste({ acao: 'concluir', id: 1, resultado: 'variante' }).ok, false);
  assert.equal(validarTeste({ acao: 'concluir', id: 1, resultado: 'talvez', aprendizado: 'x' }).erro, 'Escolha o resultado.');
  assert.deepEqual(validarTeste({ acao: 'concluir', id: 1, resultado: 'empate', aprendizado: ' ok ' }).valores, { resultado: 'empate', aprendizado: 'ok' });
  assert.equal(validarTeste({ acao: 'abandonar', id: 1, motivo: '' }).erro, 'Escreva o motivo do abandono.');
  assert.equal(validarTeste({ acao: 'iniciar', id: 'x' }).erro, 'Teste inválido.');
});

test('transições permitidas', () => {
  assert.deepEqual(transicao('iniciar', 'planejado'), { ok: true, para: 'rodando' });
  assert.equal(transicao('iniciar', 'rodando').ok, false);
  assert.equal(transicao('concluir', 'pronto').para, 'concluido');
  assert.equal(transicao('concluir', 'planejado').ok, false);
  assert.equal(transicao('abandonar', 'concluido').ok, false);
  assert.equal(transicao('abandonar', 'planejado').para, 'abandonado');
});

test('edição: tipo não muda; fechado não edita; histórico só depois do início', () => {
  const atual = { tipo: 'criativo', situacao: 'rodando', hipotese: 'h1', metrica: 'CPL', criterio: '10% menor' };
  assert.equal(validarEdicao({ ...base, tipo: 'pagina' }, atual).ok, true); // tipo do corpo é ignorado
  assert.equal(validarEdicao(base, { ...atual, situacao: 'concluido' }).ok, false);
  const mud = mudancasDaEdicao(atual, { hipotese: 'h1', metrica: 'CPL', criterio: '15% menor' });
  assert.deepEqual(mud, [{ texto: 'Critério mudou de "10% menor" para "15% menor".', destaque: true }]);
  assert.deepEqual(mudancasDaEdicao({ ...atual, situacao: 'planejado' }, { criterio: 'x' }), []);
});

test('leitura: pronto só com os dois mínimos; amostra indisponível nunca vira zero', () => {
  assert.deepEqual(avaliarLeitura({ min_dias: 14, min_amostra: 60, dias: 14, amostra: 59 }),
    { dias: 14, amostra: 59, falta_dias: 0, falta_amostra: 1, pronto: false });
  assert.equal(avaliarLeitura({ min_dias: 14, min_amostra: 60, dias: 20, amostra: 60 }).pronto, true);
  assert.equal(avaliarLeitura({ min_dias: 14, min_amostra: 60, dias: 13, amostra: 500 }).pronto, false);
  assert.deepEqual(avaliarLeitura({ min_dias: 14, min_amostra: 60, dias: 20, amostra: null }),
    { dias: 20, amostra: null, falta_dias: 0, falta_amostra: null, pronto: false });
});

test('dias rodando e montagem', () => {
  assert.equal(diasRodando('2026-09-25', HOJE), 9);
  assert.equal(diasRodando(new Date('2026-09-25T00:00:00Z'), HOJE), 9);
  const linha = { id: '7', nome: 't', tipo: 'pagina', situacao: 'rodando', hipotese: 'h', metrica: 'm', min_dias: 14, min_amostra: 1000,
    inicio: '2026-09-14', origem: 'gestora', controle: [], variante: [], ab_test_id: 2 };
  const t = montarTeste(linha, [{ texto: 'Iniciado.', destaque: false, criado_em: '2026-09-14T12:00:00Z' }], HOJE, { ok: true, amostra: 1000 });
  assert.equal(t.id, 7);
  assert.equal(t.unidade, 'visitas');
  assert.equal(t.leitura.pronto, true);
  assert.equal(t.historico[0].texto, 'Iniciado.');
  const fechado = montarTeste({ ...linha, situacao: 'concluido', fim: '2026-10-01' }, [], HOJE);
  assert.equal(fechado.leitura, null);
  assert.equal(fechado.dias_rodando, 17);
});

test('lista: resumo por situação', () => {
  const r = montarTestes([
    { id: 1, tipo: 'criativo', situacao: 'rodando', inicio: '2026-10-01', min_dias: 14, min_amostra: 60 },
    { id: 2, tipo: 'criativo', situacao: 'planejado', min_dias: 14, min_amostra: 60 },
  ], new Map(), HOJE);
  assert.deepEqual(r.resumo, { planejado: 1, rodando: 1, pronto: 0, concluido: 0, abandonado: 0 });
  assert.equal(r.testes[0].leitura.amostra, null);
});
