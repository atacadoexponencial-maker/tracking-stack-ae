// Webhook de compras da Zouti (spec-popup-checkout-imersao.md, série S10, issue
// S10-02): o endereço /api/webhooks/zouti contra SQLite real (migrations 0070 e
// 0071) e o que a aba Imersão 2027 passa a mostrar (/api/imersao).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { d1 } from './_fluxos-banco.js';
import { onRequestPost as zoutiPost } from '../functions/api/webhooks/zouti.js';
import { montarResposta } from '../functions/api/imersao/index.js';

const SEGREDO = 'segredo-de-teste';
const INGRESSO = 'prod_fe4nfgx9xgwjxmgife1sw5';
const BUMP = 'prod_e52fldo7j7aqksthgah5n1';
const MENTORIA = 'prod_bhq9jo4938vgpv2787rf6m';

let db, env, entrega;
beforeEach(() => {
  entrega = 0;
  db = new DatabaseSync(':memory:');
  for (const f of ['0070_imersao.sql', '0071_imersao_avisos.sql']) {
    db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  }
  env = { DASH_KEY: 'k', DB: d1(db), ZOUTI_WEBHOOK_SECRET: SEGREDO };
});

const item = (produto, centavos, quantidade = 1) => ({ product_id: produto, name: 'x', quantity: quantidade, amount: centavos, amount_in_brl: centavos / 100, type: 'DIGITAL' });

function pedido({ id = 'ord_1', itens = [item(INGRESSO, 2900)], pagoEm = '2026-11-13T15:00:00.000Z', utm = {}, status = 'PAID' } = {}) {
  return {
    id, status, paid_at: pagoEm, created_at: pagoEm,
    amount_total: itens.reduce((s, i) => s + i.amount, 0),
    items: itens,
    customer: { name: 'Maria Teste', email: 'Maria@Exemplo.com', document: '12345678909', phone: '5511987654321' },
    utm_data: utm,
  };
}

/** Envia um aviso como a Zouti: corpo bruto assinado com o segredo. */
async function enviar(tipo, objeto, { assinatura, entregaId } = {}) {
  const corpo = JSON.stringify(objeto);
  const t = 1794600000000;
  const v1 = createHmac('sha256', SEGREDO).update(corpo).digest('hex');
  const headers = {
    'content-type': 'application/json',
    'x-zouti-event-type': tipo,
    'x-zouti-event-id': `evt_${tipo}_${objeto.id}`,
    'x-zouti-webhook-delivery-id': entregaId || `del_${++entrega}`,
    'x-zouti-object-id': objeto.id,
  };
  if (assinatura !== null) headers['x-zouti-signature'] = assinatura ?? `t=${t},v1=${v1}`;
  const res = await zoutiPost({ request: new Request('https://x/api/webhooks/zouti', { method: 'POST', headers, body: corpo }), env });
  return { status: res.status, dados: await res.json() };
}

/** O que a aba Imersão 2027 mostra, com "hoje" fixo em 14/11/2026 ao meio-dia. */
async function aba() {
  const real = Date.now;
  Date.now = () => Date.parse('2026-11-14T12:00:00-03:00');
  try {
    return await montarResposta(env);
  } finally {
    Date.now = real;
  }
}
const vendas = () => db.prepare('SELECT * FROM imersao_vendas ORDER BY id').all();
const avisos = () => db.prepare('SELECT * FROM imersao_avisos ORDER BY recebido_em, entrega_id').all();

test('CA-S10-22: compra paga do ingresso entra nas vendas da aba', async () => {
  assert.equal((await aba()).exemplo, true); // nenhuma venda ainda: dados de exemplo
  const r = await enviar('ORDER_PAID', pedido());
  assert.equal(r.status, 200);

  const a = await aba();
  assert.equal(a.exemplo, false);
  assert.equal(a.ingressos.vendidos.valor, 1);
  assert.equal(a.resultado.faturamento.ingressos, 29);
  const dia = a.resumo.venda_por_dia.find((d) => d.dia === '2026-11-13');
  assert.equal(dia.ingressos, 1);
  const [v] = vendas();
  assert.equal(v.email, 'maria@exemplo.com');
  assert.equal(v.telefone, '5511987654321');
});

test('CA-S10-23: bump entra como bump, mesmo no pedido do ingresso', async () => {
  await enviar('ORDER_PAID', pedido({ itens: [item(INGRESSO, 2900), item(BUMP, 29700)] }));
  const a = await aba();
  assert.equal(a.ingressos.vendidos.valor, 1);
  assert.equal(a.bump.total.bumps, 1);
  assert.equal(a.resultado.faturamento.ingressos, 29);
  assert.equal(a.resultado.faturamento.bump, 297);
});

test('CA-S10-24: venda guarda a UTM de origem e cai em tráfego pago', async () => {
  await enviar('ORDER_PAID', pedido({ utm: { utm_source: 'facebookads', utm_medium: 'cpc', utm_campaign: 'imersao-ingresso', utm_content: 'video-felipe', utm_term: 'x' } }));
  const [v] = vendas();
  assert.deepEqual([v.utm_source, v.utm_medium, v.utm_campaign, v.utm_content], ['facebookads', 'cpc', 'imersao-ingresso', 'video-felipe']);
  const origem = Object.fromEntries((await aba()).ingressos.origem.linhas.map((l) => [l.chave, l.quantidade]));
  assert.equal(origem.pago, 1);
  assert.equal(origem.outros, 0);
});

test('CA-S10-25: cancelamento, reembolso e chargeback tiram a venda dos números', async () => {
  for (const [n, tipo] of [['a', 'ORDER_REFUNDED'], ['b', 'ORDER_CANCELED'], ['c', 'ORDER_DISPUTED']]) {
    await enviar('ORDER_PAID', pedido({ id: `ord_${n}` }));
    await enviar('ORDER_PAID', pedido({ id: `ord_fica_${n}` }));
    assert.equal((await aba()).ingressos.vendidos.valor, 2, tipo);
    const r = await enviar(tipo, pedido({ id: `ord_${n}`, status: 'X' }));
    assert.equal(r.status, 200, tipo);
    assert.equal((await aba()).ingressos.vendidos.valor, 1, tipo);
    db.exec('DELETE FROM imersao_vendas');
  }
});

test('CA-S10-26: aviso repetido não duplica a venda', async () => {
  const p = pedido({ itens: [item(INGRESSO, 2900), item(BUMP, 29700)] });
  await enviar('ORDER_PAID', p, { entregaId: 'del_x' });
  await enviar('ORDER_PAID', p, { entregaId: 'del_x' }); // mesma entrega de novo
  await enviar('ORDER_PAID', p, { entregaId: 'del_y' }); // mesmo pedido, outra entrega
  assert.equal(vendas().length, 2);
  const a = await aba();
  assert.equal(a.ingressos.vendidos.valor, 1);
  assert.equal(a.bump.total.bumps, 1);
});

test('CA-S10-27: aviso sem o segredo ou com o segredo errado é recusado', async () => {
  const sem = await enviar('ORDER_PAID', pedido(), { assinatura: null });
  assert.equal(sem.status, 401);
  const errada = await enviar('ORDER_PAID', pedido(), { assinatura: `t=1,v1=${'0'.repeat(64)}` });
  assert.equal(errada.status, 401);
  // Segredo não configurado no servidor também não aceita nada.
  env.ZOUTI_WEBHOOK_SECRET = '';
  assert.equal((await enviar('ORDER_PAID', pedido())).status, 401);
  assert.equal(vendas().length, 0);
  assert.equal(avisos().length, 0);
});

test('CA-S10-28: produto de fora é ignorado e fica registrado', async () => {
  const r = await enviar('ORDER_PAID', pedido({ id: 'ord_m', itens: [item(MENTORIA, 970000)] }));
  assert.equal(r.status, 200);
  assert.equal(vendas().length, 0);
  const [a] = avisos();
  assert.equal(a.resultado, 'ignorado');
  assert.match(a.motivo, /^produto de fora/);
  assert.doesNotMatch(a.motivo, /exemplo\.com|5511987654321|Maria/i); // o registro não guarda dado da pessoa
  assert.equal(a.objeto_id, 'ord_m');
});

test('CA-S10-30: aviso que o site não usa é aceito sem erro', async () => {
  for (const tipo of ['ORDER_CREATED', 'PIX_CREATED', 'SUBSCRIPTION_CREATED', 'ABANDONED_CART_CREATED']) {
    const r = await enviar(tipo, pedido({ id: `obj_${tipo}`, status: 'AWAITING_PAYMENT' }));
    assert.equal(r.status, 200, tipo);
  }
  assert.equal(vendas().length, 0);
  const lista = avisos();
  assert.equal(lista.length, 4);
  assert.ok(lista.every((a) => a.resultado === 'ignorado' && a.motivo === 'tipo não usado'));
});
