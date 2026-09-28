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
    'avaliacao_janela_dias', 'avaliacao_manuais', 'avaliacao_piso_lead_multiplicador', 'avaliacao_piso_visita_reais',
    'avaliacao_releitura_dias', 'avaliacao_tolerancia_pct',
    'intervalo_min_dias', 'lead_impressoes_min', 'lead_janela_cpl_dias', 'lead_multiplicador_cpl',
    'reativar', 'reativar_tolerancia_pct', 'reduzir_antes', 'reduzir_pct',
    'trafego_gasto_min_reais', 'trafego_janela_media_dias', 'trafego_janela_recente_dias', 'trafego_tolerancia_pct',
    'trava_aprendizado', 'trava_aprendizado_dias',
  ]);
  // Detecção de mudanças manuais no ar (issue 331): a chave vale.
  assert.equal(montarRegua(null).ativas.includes('avaliacao_manuais'), true);
});

test('avaliação do resultado (issue 328): padrões iguais aos dos monitores e pisos aceitam zero', () => {
  const r = montarRegua(null);
  assert.equal(r.valores.avaliacao_janela_dias, 7);
  assert.equal(r.valores.avaliacao_piso_visita_reais, 30);
  assert.equal(r.valores.avaliacao_piso_lead_multiplicador, 3);
  assert.equal(r.valores.avaliacao_tolerancia_pct, 30);
  assert.equal(r.valores.avaliacao_releitura_dias, 3);
  assert.equal(r.valores.avaliacao_manuais, true);
  assert.deepEqual(r.limites.avaliacao_janela_dias, { min: 1, max: 30, passo: 1 });
  // Piso zero desliga o piso (como `aceita_zero` no Python); janela zero não vale.
  assert.equal(validarRegua({ ...padroes(), avaliacao_piso_visita_reais: 0 }).ok, true);
  const semJanela = validarRegua({ ...padroes(), avaliacao_janela_dias: 0 });
  assert.equal(semJanela.ok, false);
  assert.match(semJanela.erros.join(' '), /avaliacao_janela_dias/);
  // Valor salvo fora do limite volta ao padrão na tela.
  assert.equal(montarRegua({ avaliacao_tolerancia_pct: 500 }).valores.avaliacao_tolerancia_pct, 30);
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
