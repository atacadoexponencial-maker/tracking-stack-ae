import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarPlacar, resolverPeriodo, TIPOS_PLACAR } from '../functions/api/_argo-placar.js';

const HOJE = '2026-09-27';

test('período: padrão são 30 dias até hoje', () => {
  assert.deepEqual(resolverPeriodo({}, HOJE), { de: '2026-08-29', ate: HOJE, preset: 30 });
  assert.deepEqual(resolverPeriodo({ placar_dias: '60' }, HOJE), { de: '2026-07-30', ate: HOJE, preset: 60 });
  assert.equal(resolverPeriodo({ placar_dias: '90' }, HOJE).preset, 90);
});

test('período: preset fora da lista e datas inválidas caem no padrão, nunca em erro', () => {
  const padrao = resolverPeriodo({}, HOJE);
  assert.deepEqual(resolverPeriodo({ placar_dias: '7' }, HOJE), padrao);
  assert.deepEqual(resolverPeriodo({ placar_dias: 'abc' }, HOJE), padrao);
  assert.deepEqual(resolverPeriodo({ placar_de: '2026-09-01' }, HOJE), padrao);
  assert.deepEqual(resolverPeriodo({ placar_de: '01/09/2026', placar_ate: '2026-09-27' }, HOJE), padrao);
  assert.deepEqual(resolverPeriodo({ placar_de: '2026-09-27', placar_ate: '2026-09-01' }, HOJE), padrao);
  assert.deepEqual(resolverPeriodo({ placar_de: '2025-01-01', placar_ate: '2026-09-27' }, HOJE), padrao);
});

test('período: personalizado dentro do teto passa como custom', () => {
  assert.deepEqual(resolverPeriodo({ placar_de: '2026-09-01', placar_ate: '2026-09-27' }, HOJE),
    { de: '2026-09-01', ate: '2026-09-27', preset: 'custom' });
  assert.equal(resolverPeriodo({ placar_de: '2025-09-27', placar_ate: '2026-09-27' }, HOJE).preset, 'custom'); // 366 dias
});

const periodo = { de: '2026-08-29', ate: HOJE, preset: 30 };

test('cartões: os sete tipos saem sempre, na ordem, entre o geral e o manual', () => {
  const p = montarPlacar({ linhas: [], periodo });
  assert.equal(p.cartoes[0].chave, 'argo');
  assert.deepEqual(p.cartoes.slice(1, -1).map((c) => c.chave), [...TIPOS_PLACAR]);
  assert.equal(p.cartoes.at(-1).chave, 'manual');
  for (const c of p.cartoes) {
    assert.equal(c.avaliadas, 0);
    assert.equal(c.taxa_pct, null);
    assert.equal(c.gasto_erradas_centavos, 0);
  }
});

test('taxa = acertos ÷ (acertos + erros); inconclusivas contam nas avaliadas, não na taxa', () => {
  const linhas = [
    { situacao: 'acertou', origem: 'argo', tipo: 'pausar_campanha_trafego', gasto_reais: null },
    { situacao: 'acertou', origem: 'argo', tipo: 'pausar_campanha_trafego', gasto_reais: null },
    { situacao: 'errou', origem: 'argo', tipo: 'pausar_anuncio', gasto_reais: '453.90' },
    { situacao: 'inconclusivo', origem: 'argo', tipo: 'reduzir_orcamento', gasto_reais: '12' },
    { situacao: 'inconclusivo', origem: 'argo', tipo: 'reduzir_orcamento', gasto_reais: null },
    { situacao: 'sem_avaliacao', origem: 'argo', tipo: 'pausar_anuncio', gasto_reais: '999' },
    { situacao: 'avaliando', origem: 'argo', tipo: 'pausar_anuncio', gasto_reais: null },
  ];
  const p = montarPlacar({ linhas, periodo });
  const geral = p.cartoes[0];
  assert.deepEqual([geral.avaliadas, geral.acertos, geral.erros, geral.inconclusivas, geral.taxa_pct], [5, 2, 1, 2, 67]);
  assert.equal(geral.gasto_erradas_centavos, 45390);
  const trafego = p.cartoes.find((c) => c.chave === 'pausar_campanha_trafego');
  assert.deepEqual([trafego.avaliadas, trafego.taxa_pct], [2, 100]);
  const reduzir = p.cartoes.find((c) => c.chave === 'reduzir_orcamento');
  assert.deepEqual([reduzir.avaliadas, reduzir.inconclusivas, reduzir.taxa_pct], [2, 2, null]);
});

test('manuais ficam no cartão próprio, fora do geral e dos tipos', () => {
  const linhas = [
    { situacao: 'errou', origem: 'manual', tipo: 'aumentar_orcamento', gasto_reais: '352.80' },
    { situacao: 'acertou', origem: 'argo', tipo: 'aumentar_orcamento', gasto_reais: null },
  ];
  const p = montarPlacar({ linhas, periodo, manuaisLigadas: false });
  const manual = p.cartoes.at(-1);
  assert.deepEqual([manual.avaliadas, manual.erros, manual.taxa_pct, manual.gasto_erradas_centavos], [1, 1, 0, 35280]);
  assert.equal(p.cartoes[0].avaliadas, 1);
  assert.equal(p.cartoes.find((c) => c.chave === 'aumentar_orcamento').avaliadas, 1);
  assert.equal(p.manuais_ligadas, false);
});

test('tipo desconhecido entra no geral e não cria cartão', () => {
  const p = montarPlacar({ linhas: [{ situacao: 'acertou', origem: 'argo', tipo: 'x', gasto_reais: null }], periodo });
  assert.equal(p.cartoes[0].avaliadas, 1);
  assert.equal(p.cartoes.length, 2 + TIPOS_PLACAR.length);
});

test('régua alterada só aparece quando a data cai dentro do período', () => {
  assert.equal(montarPlacar({ periodo, reguaAlteradaEm: '2026-09-23T14:10:00Z' }).regua_alterada_em, '2026-09-23T14:10:00.000Z');
  assert.equal(montarPlacar({ periodo, reguaAlteradaEm: '2026-08-01T14:10:00Z' }).regua_alterada_em, null);
  assert.equal(montarPlacar({ periodo, reguaAlteradaEm: null }).regua_alterada_em, null);
  assert.equal(montarPlacar({ periodo, reguaAlteradaEm: 'lixo' }).regua_alterada_em, null);
});
