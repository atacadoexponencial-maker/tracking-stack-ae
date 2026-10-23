import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tagsDoCardNovo, TAG_LINK_DA_BIO } from '../functions/api/_clickup.js';

test('lead da bio ganha link-da-bio no card novo', () => {
  assert.deepEqual(tagsDoCardNovo({ utm_source: 'organico', utm_campaign: 'bioperfil-felipe' }), [TAG_LINK_DA_BIO]);
  assert.deepEqual(tagsDoCardNovo({ utm_campaign: 'BioPerfil-Barbara' }), ['link-da-bio']);
});

test('tag que já vinha é mantida junto com link-da-bio', () => {
  assert.deepEqual(tagsDoCardNovo({ tag: 'formulario-meta', utm_campaign: 'bioperfil-felipe' }), ['formulario-meta', 'link-da-bio']);
});

test('lead de anúncio não ganha link-da-bio', () => {
  assert.deepEqual(tagsDoCardNovo({ utm_source: 'facebookads', utm_campaign: 'ae_leads_publico-frio' }), []);
});

test('isca segue só com a tag do material, mesmo com UTM da bio', () => {
  assert.deepEqual(tagsDoCardNovo({ tag: 'isca-icp', material: 'icp', utm_campaign: 'bioperfil-felipe' }), ['isca-icp']);
});

test('sem UTM e sem tag não manda tag nenhuma', () => {
  assert.deepEqual(tagsDoCardNovo({}), []);
  assert.deepEqual(tagsDoCardNovo(), []);
});
