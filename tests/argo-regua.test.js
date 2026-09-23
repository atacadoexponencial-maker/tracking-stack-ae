import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGRAS, montarRegua, validarRegua } from '../functions/api/_argo-regua.js';

const padroes = () => Object.fromEntries(Object.entries(REGRAS).map(([k, d]) => [k, d.padrao]));

test('sem régua salva, valem os padrões — que são os números de hoje', () => {
  const r = montarRegua(null);
  assert.equal(r.valores.trafego_tolerancia_pct, 30);
  assert.equal(r.valores.trafego_gasto_min_reais, 30);
  assert.equal(r.valores.intervalo_min_dias, 3);
  assert.deepEqual(r.valores, r.padroes);
});

test('valor salvo vale por cima do padrão', () => {
  const r = montarRegua({ trafego_gasto_min_reais: 40 }, '2026-09-24T10:00:00Z', 'painel');
  assert.equal(r.valores.trafego_gasto_min_reais, 40);
  assert.equal(r.padroes.trafego_gasto_min_reais, 30);
  assert.equal(r.alterada_por, 'painel');
});

test('valor salvo inválido cai no padrão, nunca aparece na tela', () => {
  const r = montarRegua({ trafego_tolerancia_pct: 9999, reativar: 'sim', intervalo_min_dias: 2.5 });
  assert.equal(r.valores.trafego_tolerancia_pct, 30);
  assert.equal(r.valores.reativar, false);
  assert.equal(r.valores.intervalo_min_dias, 3);
});

test('só as regras com lógica de hoje estão ativas', () => {
  assert.deepEqual(montarRegua(null).ativas.sort(), [
    'intervalo_min_dias', 'lead_impressoes_min', 'lead_janela_cpl_dias', 'lead_multiplicador_cpl',
    'trafego_gasto_min_reais', 'trafego_tolerancia_pct',
  ]);
});

test('booleanos não têm limite numérico; números têm', () => {
  const r = montarRegua(null);
  assert.equal(r.limites.reativar, undefined);
  assert.deepEqual(r.limites.lead_multiplicador_cpl, { min: 1, max: 10, passo: 0.5 });
});

test('régua completa e válida passa', () => {
  assert.equal(validarRegua(padroes()).ok, true);
});

test('régua inválida é recusada nomeando o problema', () => {
  const casos = [
    [null, /objeto/],
    [{ ...padroes(), extra: 1 }, /desconhecida: extra/],
    [(() => { const p = padroes(); delete p.reduzir_pct; return p; })(), /ausente: reduzir_pct/],
    [{ ...padroes(), lead_multiplicador_cpl: 20 }, /lead_multiplicador_cpl.*entre 1 e 10/],
    [{ ...padroes(), intervalo_min_dias: 2.5 }, /intervalo_min_dias.*inteiro/],
    [{ ...padroes(), reativar: 'sim' }, /reativar.*ligado ou desligado/],
    [{ ...padroes(), trafego_gasto_min_reais: '30' }, /trafego_gasto_min_reais/],
  ];
  for (const [regua, erro] of casos) {
    const r = validarRegua(regua);
    assert.equal(r.ok, false, JSON.stringify(regua));
    assert.match(r.erros.join(' '), erro);
  }
});
