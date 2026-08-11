import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extrairEvento } from '../functions/api/webhooks/_greenn-evento.js';

// Payloads reduzidos aos campos que o extrator lê. Os exemplos completos da
// Greenn trazem client, seller, saleMetas etc., que a ingestão não interpreta.
function vendaPaga(extra = {}) {
  return {
    type: 'sale',
    event: 'saleUpdated',
    oldStatus: 'waiting_payment',
    currentStatus: 'paid',
    sale: {
      id: 1001,
      type: 'TRANSACTION',
      status: 'paid',
      amount: 97.0,
      updated_at: '2026-06-11T17:13:46.000000Z',
    },
    product: { id: 77, name: 'Curso de Exemplo' },
    productMetas: { utm_source: 'facebook' },
    ...extra,
  };
}

test('saleUpdated extrai venda, produto e status', () => {
  const r = extrairEvento(vendaPaga());
  assert.equal(r.event, 'saleUpdated');
  assert.equal(r.entity_type, 'sale');
  assert.equal(r.entity_id, 1001);
  assert.equal(r.current_status, 'paid');
  assert.equal(r.product_id, 77);
  assert.equal(r.amount, 97.0);
  assert.equal(r.entity_updated, '2026-06-11T17:13:46.000000Z');
});
