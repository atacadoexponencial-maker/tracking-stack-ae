import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escolherDestino, situacaoDe, montarUrlFinal } from '../functions/_links-destino.js';

const AGORA = 1_800_000_000;
const padrao = { id: 1, target_url: 'https://exemplo.com/padrao', starts_at: null, ends_at: null, criado_em: 1 };
const janela = (id, de, ate) => ({ id, target_url: `https://exemplo.com/${id}`, starts_at: de, ends_at: ate, criado_em: 1 });

test('janela válida vence o destino padrão', () => {
  const r = escolherDestino([padrao, janela(2, AGORA - 60, AGORA + 60)], AGORA);
  assert.equal(r.link.id, 2);
  assert.equal(r.motivo, 'janela');
});

test('fora de qualquer janela cai no padrão', () => {
  const r = escolherDestino([padrao, janela(2, AGORA + 60, AGORA + 120)], AGORA);
  assert.equal(r.link.id, 1);
  assert.equal(r.motivo, 'padrao');
});

test('janela encerrada não é escolhida', () => {
  const r = escolherDestino([padrao, janela(2, AGORA - 120, AGORA - 60)], AGORA);
  assert.equal(r.link.id, 1);
});

test('janelas sobrepostas: vence a que começou mais tarde', () => {
  const r = escolherDestino([janela(2, AGORA - 600, AGORA + 600), janela(3, AGORA - 60, AGORA + 600)], AGORA);
  assert.equal(r.link.id, 3);
});

test('sem nenhum destino não escolhe nada', () => {
  assert.equal(escolherDestino([], AGORA).link, null);
  assert.equal(escolherDestino([], AGORA).motivo, 'nenhum');
});

test('as bordas da janela são inclusivas', () => {
  assert.equal(escolherDestino([janela(2, AGORA, AGORA + 60)], AGORA).link.id, 2);
  assert.equal(escolherDestino([janela(2, AGORA - 60, AGORA)], AGORA).link.id, 2);
});

test('situação reflete a posição no tempo', () => {
  assert.equal(situacaoDe(padrao, AGORA), 'padrao');
  assert.equal(situacaoDe(janela(2, AGORA + 60, AGORA + 120), AGORA), 'agendado');
  assert.equal(situacaoDe(janela(2, AGORA - 120, AGORA - 60), AGORA), 'encerrado');
  assert.equal(situacaoDe(janela(2, AGORA - 60, AGORA + 60), AGORA), 'no-ar');
});

test('UTMs do clique são repassadas ao destino', () => {
  const clique = new URL('https://atacadoexponencial.com/links?utm_source=grupo&utm_medium=whatsapp');
  const final = new URL(montarUrlFinal('https://exemplo.com/lp', clique));
  assert.equal(final.searchParams.get('utm_source'), 'grupo');
  assert.equal(final.searchParams.get('utm_medium'), 'whatsapp');
});

test('UTM já presente no destino vence a do clique', () => {
  const clique = new URL('https://atacadoexponencial.com/links?utm_source=grupo');
  const final = new URL(montarUrlFinal('https://exemplo.com/lp?utm_source=cadastrado', clique));
  assert.equal(final.searchParams.get('utm_source'), 'cadastrado');
});

test('parâmetro que não é UTM não vaza para o destino', () => {
  const clique = new URL('https://atacadoexponencial.com/links?fbclid=abc123');
  assert.equal(montarUrlFinal('https://exemplo.com/lp', clique), 'https://exemplo.com/lp');
});

test('query e fragmento do destino são preservados', () => {
  const clique = new URL('https://atacadoexponencial.com/links?utm_source=grupo');
  const final = montarUrlFinal('https://exemplo.com/lp?a=1#secao', clique);
  assert.match(final, /a=1/);
  assert.match(final, /#secao$/);
});

test('destino que não parseia é devolvido cru, sem quebrar', () => {
  const clique = new URL('https://atacadoexponencial.com/links?utm_source=grupo');
  assert.equal(montarUrlFinal('nao-e-url', clique), 'nao-e-url');
});
