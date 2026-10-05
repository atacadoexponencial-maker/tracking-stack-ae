import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarCandidata, semelhanca } from '../functions/api/_argo-relatorio-avaliacao.js';

const texto = (chave, t) => ({ chave, tipo: 'texto', frases: [{ texto: t }] });

test('semelhança: mesmo texto é 1, textos diferentes perto de 0', () => {
  assert.equal(semelhanca('O CPL da SE subiu muito', 'O CPL da SE subiu muito'), 1);
  assert.ok(semelhanca('O CPL da SE subiu muito', 'Workshop trouxe poucos leads hoje') < 0.2);
  assert.equal(semelhanca('', 'x'), 0);
});

test('aprovada quando não passa menos e não repete o que foi marcado errado', () => {
  const r = avaliarCandidata([
    { relatorio_id: 1, rotulo: 'a', publicado: { situacao: 'parcial', analise: [texto('acoes', 'A pausa do anuncio derrubou o custo por lead da campanha')] }, errados: ['acoes'],
      candidata: { situacao: 'verificada', blocos: [texto('acoes', 'Sem veredito ainda, nao da para dizer se a pausa ajudou')] } },
    { relatorio_id: 2, rotulo: 'b', publicado: { situacao: 'verificada', analise: [] }, errados: [], candidata: { situacao: 'verificada', blocos: [] } },
  ]);
  assert.equal(r.situacao, 'aprovada');
  assert.deepEqual([r.base.aprovacao, r.candidata.aprovacao], [0.75, 1]);
  assert.equal(r.candidata.repetidos, 0);
});

test('recusada quando passa menos na checagem', () => {
  const r = avaliarCandidata([{ relatorio_id: 1, rotulo: 'a', publicado: { situacao: 'verificada', analise: [] }, errados: [], candidata: { situacao: 'nao_passou', blocos: [] } }]);
  assert.equal(r.situacao, 'recusada');
  assert.match(r.motivo, /passou menos/);
});

test('repetir o trecho marcado como errado conta; sem semanas, recusa', () => {
  const frase = 'A pausa do anuncio derrubou o custo por lead da campanha';
  const r = avaliarCandidata([{ relatorio_id: 1, rotulo: 'a', publicado: { situacao: 'verificada', analise: [texto('acoes', frase)] }, errados: ['acoes'], candidata: { situacao: 'verificada', blocos: [texto('acoes', frase)] } }]);
  assert.equal(r.candidata.repetidos, 1);
  assert.equal(r.situacao, 'aprovada'); // repetiu, mas não mais que a versão publicada
  assert.equal(avaliarCandidata([]).situacao, 'recusada');
});
