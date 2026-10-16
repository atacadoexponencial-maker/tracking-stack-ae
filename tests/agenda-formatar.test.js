// Formatação da descrição do tipo de agenda (public/agenda-formatar.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trechos, blocos } from '../public/agenda-formatar.js';

test('negrito, itálico e sublinhado viram trechos com estilo', () => {
  assert.deepEqual(trechos('**A:** b *c* __d__'), [
    { texto: 'A:', estilo: 'negrito' },
    { texto: ' b ', estilo: '' },
    { texto: 'c', estilo: 'italico' },
    { texto: ' ', estilo: '' },
    { texto: 'd', estilo: 'sublinhado' },
  ]);
});

test('texto sem marca e asterisco solto ficam como estão', () => {
  assert.deepEqual(trechos('Taxa de R$100 * sem par'), [{ texto: 'Taxa de R$100 * sem par', estilo: '' }]);
});

test('linhas com "- " viram lista; brancos em volta da lista somem', () => {
  assert.deepEqual(blocos('Você recebe:\n\n- Plano\n- Diagnóstico\n\nFim'), [
    { tipo: 'texto', linhas: ['Você recebe:'] },
    { tipo: 'lista', itens: ['Plano', 'Diagnóstico'] },
    { tipo: 'texto', linhas: ['Fim'] },
  ]);
});

test('texto da consultoria mantém os parágrafos', () => {
  const b = blocos('**INSTRUÇÕES:**\n\nA consultoria.\n\n**POLÍTICA:** Taxa.');
  assert.equal(b.length, 1);
  assert.deepEqual(b[0].linhas, ['**INSTRUÇÕES:**', '', 'A consultoria.', '', '**POLÍTICA:** Taxa.']);
});

test('descrição vazia não gera bloco', () => {
  assert.deepEqual(blocos(''), []);
  assert.deepEqual(blocos(null), []);
});
