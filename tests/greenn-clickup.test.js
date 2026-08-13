import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TAG_EDICAO,
  STATUS_INICIAL,
  deveCriarCard,
  montarCard,
} from '../functions/api/webhooks/_greenn-clickup.js';
import { CU_FIELD, CU_FUNIL_WO_PAGO, CU_PRODUTO_AE } from '../functions/api/_clickup.js';

// Recorte do payload REAL da venda 9606659 (12/08/2026), com os campos que a
// ponte lê. Os exemplos da doc da Greenn são fictícios; este veio de produção.
function vendaPaga(extra = {}) {
  return {
    type: 'sale',
    event: 'saleUpdated',
    oldStatus: 'waiting_payment',
    currentStatus: 'paid',
    sale: {
      id: 9606659,
      type: 'TRANSACTION',
      status: 'paid',
      method: 'PIX',
      amount: 27,
      fee: 2.35,
      seller_balance: 24.65,
      updated_at: '2026-08-12T18:18:00.000000Z',
    },
    client: {
      id: 644,
      name: 'Marcelle Mesquita',
      email: 'marcellefernandesdemesquita@gmail.com',
      cellphone: '+5521993911946',
      document: '449.669.868-75',
    },
    product: { id: 186687, name: 'Workshop Black Exponencial Atacado 2026', amount: 27 },
    offer: { hash: 'WwUtjz', name: 'Inteira', amount: 27 },
    sf_trk: '9c1a011e-f15c-45d8-a886-9022b395f3bf',
    saleMetas: [
      { meta_key: 'sf_trk', meta_value: '9c1a011e-f15c-45d8-a886-9022b395f3bf' },
    ],
    ...extra,
  };
}

const sessao = {
  utm_source: 'facebookads',
  utm_medium: 'auto_ig_aberto',
  utm_campaign: 'ae_workshop_black',
  utm_content: 'ad06_planner',
};

// Acha o valor de um custom field pelo id, para o teste não depender da ordem
// do array.
const campo = (card, id) => {
  const achado = card.custom_fields.find((c) => c.id === id);
  return achado ? achado.value : undefined;
};

test('venda paga com sessão vira card com nome, contato e UTMs da visita', () => {
  const card = montarCard(vendaPaga(), sessao);

  assert.equal(card.name, 'Marcelle Mesquita');
  assert.equal(card.status, 'leads de entrada');
  assert.equal(card.tag, 'wo-pago-09-09');

  assert.equal(campo(card, CU_FIELD.nome), 'Marcelle Mesquita');
  assert.equal(campo(card, CU_FIELD.email), 'marcellefernandesdemesquita@gmail.com');
  assert.equal(campo(card, CU_FIELD.whatsapp), '+5521993911946');
  assert.equal(campo(card, CU_FIELD.funil), CU_FUNIL_WO_PAGO);
  assert.equal(campo(card, CU_FIELD.produto), CU_PRODUTO_AE);
  assert.equal(campo(card, CU_FIELD.valor), 27);

  assert.equal(campo(card, CU_FIELD.utmSource), 'facebookads');
  assert.equal(campo(card, CU_FIELD.utmMedium), 'auto_ig_aberto');
  assert.equal(campo(card, CU_FIELD.utmCampaign), 'ae_workshop_black');
  assert.equal(campo(card, CU_FIELD.utmContent), 'ad06_planner');
});

test('só venda paga vira card', () => {
  assert.equal(deveCriarCard(vendaPaga()), true);

  for (const status of ['refused', 'refunded', 'chargedback', 'waiting_payment', 'unpaid']) {
    assert.equal(deveCriarCard(vendaPaga({ currentStatus: status })), false, status);
  }
});

test('contrato, abandono e corpo inválido não viram card', () => {
  assert.equal(deveCriarCard({ event: 'contractUpdated', currentStatus: 'paid' }), false);
  assert.equal(deveCriarCard({ event: 'checkoutAbandoned' }), false);
  assert.equal(deveCriarCard({}), false);
  assert.equal(deveCriarCard(null), false);
  assert.equal(deveCriarCard('texto'), false);
});

// ESTE TESTE TRAVA A ARMADILHA. O campo 💰 Arrecadado é lido por
// functions/webhook/clickup.js quando um card entra em "contrato assinado", e
// registra a venda no purchase_log/ROAS do negócio antigo. A Greenn é produto
// separado (decisão da usuária) e não pode entrar ali.
test('o card NUNCA carrega o campo 💰 Arrecadado', () => {
  const ARRECADADO = '85ef1a33-01f7-4ea4-9f24-f742b660a04e';
  const card = montarCard(vendaPaga(), sessao);
  assert.equal(
    card.custom_fields.some((c) => c.id === ARRECADADO),
    false,
    'Arrecadado preencheria a receita do negocio antigo com uma venda da Greenn'
  );
});

test('o card nasce em "leads de entrada", nunca em "contrato assinado"', () => {
  const card = montarCard(vendaPaga(), sessao);
  assert.equal(card.status, 'leads de entrada');
  assert.notEqual(card.status, 'contrato assinado');
  assert.equal(STATUS_INICIAL, 'leads de entrada');
});
