import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canalDeLead, CANAIS } from '../functions/api/_canal.js';

test('material preenchido vence tudo e vira manychat', () => {
  assert.equal(canalDeLead({ material: 'icp', utm_source: 'facebookads' }), 'manychat');
});

test('campanha bioperfil vira bio', () => {
  assert.equal(canalDeLead({ utm_campaign: 'bioperfil-felipe', utm_source: 'organico' }), 'bio');
  assert.equal(canalDeLead({ utm_campaign: 'BioPerfil-Barbara' }), 'bio');
});

test('facebookads vira meta-ads', () => {
  assert.equal(canalDeLead({ utm_source: 'facebookads', utm_campaign: 'ae_leads_x' }), 'meta-ads');
});

test('email e ghl viram email', () => {
  assert.equal(canalDeLead({ utm_source: 'email-marketing' }), 'email');
  assert.equal(canalDeLead({ utm_source: 'ghl' }), 'email');
});

test('utm_source desconhecida vira outro', () => {
  assert.equal(canalDeLead({ utm_source: 'youtube' }), 'outro');
});

test('sem utm nenhuma vira direto', () => {
  assert.equal(canalDeLead({}), 'direto');
  assert.equal(canalDeLead({ utm_source: '', utm_campaign: '   ' }), 'direto');
  assert.equal(canalDeLead({ utm_source: null, material: null }), 'direto');
});

test('bio vence meta-ads quando as duas condições batem', () => {
  assert.equal(canalDeLead({ utm_campaign: 'bioperfil-day', utm_source: 'facebookads' }), 'bio');
});

test('CANAIS contém todos os valores que canalDeLead sabe devolver', () => {
  for (const c of ['manychat', 'bio', 'meta-ads', 'email', 'outro', 'direto']) {
    assert.ok(CANAIS.includes(c), `${c} faltando em CANAIS`);
  }
});
