import { test } from 'node:test';
import assert from 'node:assert/strict';
import { julgavelPorAnuncio, funisParaArgo, campanhasParaArgo } from '../functions/api/_argo-funis-anuncio.js';

const SE = { id: 1, nome: 'SE', tipo: 'lead_mql', origem_lead: 'trafego_pago' };
const LIVE = { id: 2, nome: 'LIVE', tipo: 'manual', origem_lead: null };
const WO = { id: 3, nome: 'WO PAGO', tipo: 'venda_greenn', origem_lead: null };
const AQ = { id: 4, nome: 'AQUISIÇÃO', tipo: 'lead_mql', origem_lead: 'exceto_trafego_pago' };

test('só o funil de MQL com leads de tráfego pago é julgável por anúncio', () => {
  assert.deepEqual([SE, LIVE, WO, AQ].map(julgavelPorAnuncio), [true, false, false, false]);
});

test('CPL médio = investimento do funil ÷ leads do funil, como no feedback diário', () => {
  const investimento = { blocos: new Map([[1, { investido: 812 }], [4, { investido: 300 }]]) };
  const leadsPorBloco = new Map([[1, new Array(10).fill({})], [4, []]]);
  const [se, , , aq] = funisParaArgo({ funisAtivos: [SE, LIVE, WO, AQ], investimento, leadsPorBloco });
  assert.equal(se.cpl_medio, 81.2);
  assert.equal(se.leads, 10);
  assert.equal(se.julgavel_por_anuncio, true);
  // Sem lead não existe CPL: null, nunca zero nem infinito.
  assert.equal(aq.cpl_medio, null);
  assert.match(aq.motivo_nao_julgavel, /não vêm de anúncio pago/);
});

test('CRM ilegível: nenhum CPL, leads e MQLs nulos — nunca zero', () => {
  const investimento = { blocos: new Map([[1, { investido: 812 }]]) };
  const [se] = funisParaArgo({ funisAtivos: [SE], investimento, leadsPorBloco: null });
  assert.equal(se.leads, null);
  assert.equal(se.mqls, null);
  assert.equal(se.cpl_medio, null);
});

test('funil sem investimento no período sai com investido 0 e sem CPL', () => {
  const [se] = funisParaArgo({ funisAtivos: [SE], investimento: { blocos: new Map() }, leadsPorBloco: new Map() });
  assert.equal(se.investido, 0);
  assert.equal(se.cpl_medio, null);
});

test('campanha sem funil vem com o motivo, não some', () => {
  const c = campanhasParaArgo([
    { campaign_id: 12, nome: 'SE_captacao', bloco_id: 1, motivo: null },
    { campaign_id: 13, nome: 'teste', bloco_id: null, motivo: 'nenhum funil reconhecido' },
    { campaign_id: 14, nome: 'dup', bloco_id: null, motivo: 'casou com mais de um funil' },
  ]);
  assert.deepEqual(c.map((x) => [x.campaign_id, x.funil_id, x.motivo]), [
    ['12', 1, null],
    ['13', null, 'nenhum funil reconhecido'],
    ['14', null, 'casou com mais de um funil'],
  ]);
});
