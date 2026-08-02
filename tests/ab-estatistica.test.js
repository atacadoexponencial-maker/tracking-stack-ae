import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cdfNormalPadrao,
  testeDuasProporcoes,
  checarSrm,
  avaliarTeste,
} from '../functions/api/_ab-estatistica.js';

const perto = (obtido, esperado, tol) =>
  assert.ok(Math.abs(obtido - esperado) <= tol, `esperado ~${esperado}, veio ${obtido}`);

const DIA = 86400;
const AGORA = 1_800_000_000;

test('cdfNormalPadrao bate com valores tabelados', () => {
  perto(cdfNormalPadrao(0), 0.5, 1e-6);
  perto(cdfNormalPadrao(1.96), 0.975, 1e-4);
  perto(cdfNormalPadrao(-1.96), 0.025, 1e-4);
  perto(cdfNormalPadrao(1.645), 0.95, 1e-4);
  perto(cdfNormalPadrao(-3), 0.00135, 1e-5);
});

test('z de duas proporcoes: 10% vs 15% em 1000 cada', () => {
  const { z, p } = testeDuasProporcoes(1000, 100, 1000, 150);
  perto(z, 3.381, 0.01);
  assert.ok(p < 0.001, `p deveria ser < 0.001, veio ${p}`);
});

test('taxas identicas dao z zero e p um', () => {
  const { z, p } = testeDuasProporcoes(1000, 100, 1000, 100);
  perto(z, 0, 1e-9);
  perto(p, 1, 1e-9);
});

test('z negativo quando A converte mais que B', () => {
  const { z } = testeDuasProporcoes(1000, 150, 1000, 100);
  assert.ok(z < 0);
});

test('amostra vazia ou sem conversao nenhuma nao quebra', () => {
  assert.deepEqual(testeDuasProporcoes(0, 0, 0, 0), { z: 0, p: 1 });
  assert.deepEqual(testeDuasProporcoes(100, 0, 100, 0), { z: 0, p: 1 });
  assert.deepEqual(testeDuasProporcoes(100, 100, 100, 100), { z: 0, p: 1 });
});

test('SRM: 600/400 esperando 50/50 dispara alerta', () => {
  const r = checarSrm(600, 400, 50);
  perto(r.chi2, 40, 0.001);
  assert.ok(r.p < 0.01);
  assert.equal(r.alerta, true);
});

test('SRM: 52/48 esperando 50/50 nao dispara', () => {
  const r = checarSrm(52, 48, 50);
  assert.equal(r.alerta, false);
});

test('SRM: divisao 80/20 configurada e observada nao dispara', () => {
  assert.equal(checarSrm(800, 200, 80).alerta, false);
});

test('SRM: amostra pequena demais nunca dispara', () => {
  // 30 x 0 e uma divisao absurda, mas com 30 visitas ainda pode ser o comeco
  // do teste; alarme aqui so geraria ruido.
  assert.equal(checarSrm(30, 0, 50).alerta, false);
});

const testeBase = { meta_leads_variante: 60, meta_dias: 14, started_at: AGORA - 20 * DIA };

test('alvo de leads nao atingido: fica rodando mesmo com p baixo', () => {
  const r = avaliarTeste({
    teste: testeBase,
    a: { visitas: 1000, leads: 10, peso: 50 },
    b: { visitas: 1000, leads: 40, peso: 50 },
    agora: AGORA,
  });
  assert.ok(r.p < 0.05, 'o cenario precisa ter p baixo para o teste fazer sentido');
  assert.equal(r.estado, 'rodando');
  assert.equal(r.vencedor, null);
  // A variante mais atrasada é a A, com 10 leads: faltam 50 para a meta de 60.
  assert.equal(r.faltamLeads, 50);
});

test('alvo de dias nao atingido: fica rodando mesmo com leads suficientes', () => {
  const r = avaliarTeste({
    teste: { ...testeBase, started_at: AGORA - 5 * DIA },
    a: { visitas: 4000, leads: 100, peso: 50 },
    b: { visitas: 4000, leads: 200, peso: 50 },
    agora: AGORA,
  });
  assert.equal(r.estado, 'rodando');
  assert.equal(r.diasCorridos, 5);
  assert.equal(r.faltamDias, 9);
});

test('alvos batidos e diferenca real: conclusivo com vencedor', () => {
  const r = avaliarTeste({
    teste: testeBase,
    a: { visitas: 4000, leads: 100, peso: 50 },
    b: { visitas: 4000, leads: 200, peso: 50 },
    agora: AGORA,
  });
  assert.equal(r.estado, 'conclusivo');
  assert.equal(r.vencedor, 'b');
  assert.equal(r.faltamLeads, 0);
  assert.equal(r.faltamDias, 0);
});

test('alvos batidos e taxas parecidas: sem diferenca detectavel', () => {
  const r = avaliarTeste({
    teste: testeBase,
    a: { visitas: 4000, leads: 100, peso: 50 },
    b: { visitas: 4000, leads: 104, peso: 50 },
    agora: AGORA,
  });
  assert.equal(r.estado, 'sem-diferenca');
  assert.equal(r.vencedor, null);
});

test('vencedor pode ser A', () => {
  const r = avaliarTeste({
    teste: testeBase,
    a: { visitas: 4000, leads: 200, peso: 50 },
    b: { visitas: 4000, leads: 100, peso: 50 },
    agora: AGORA,
  });
  assert.equal(r.estado, 'conclusivo');
  assert.equal(r.vencedor, 'a');
});

test('teste nunca ativado (sem started_at) fica rodando com zero dias', () => {
  const r = avaliarTeste({
    teste: { ...testeBase, started_at: null },
    a: { visitas: 0, leads: 0, peso: 50 },
    b: { visitas: 0, leads: 0, peso: 50 },
    agora: AGORA,
  });
  assert.equal(r.estado, 'rodando');
  assert.equal(r.diasCorridos, 0);
  assert.equal(r.faltamDias, 14);
});

test('o SRM vem junto do veredito', () => {
  const r = avaliarTeste({
    teste: testeBase,
    a: { visitas: 600, leads: 60, peso: 50 },
    b: { visitas: 400, leads: 60, peso: 50 },
    agora: AGORA,
  });
  assert.equal(r.srm.alerta, true);
});
