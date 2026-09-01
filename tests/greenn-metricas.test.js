import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularGreenn, SEM_CAMPANHA } from '../functions/api/_greenn-metricas.js';

const CAMPANHA = 'ae_vendas-workshop-pago-09-09_publico-frio';
const CAMPANHA_NOVA = 'ae_vendas-workshop-pago-23-09_publico-frio';

function venda({ id = 1, status = 'paid', amount = 27, at = 1000, email = 'cliente@gmail.com', nome = 'Cliente', trk = null, raw = null }) {
  return {
    entity_id: id,
    current_status: status,
    amount,
    received_at: at,
    raw_json: raw !== null ? raw : JSON.stringify({
      client: { name: nome, email },
      sale: { method: 'PIX' },
      product: { name: 'Workshop Black Exponencial' },
      ...(trk ? { sf_trk: trk } : {}),
    }),
  };
}

const sessao = (trk, campanha, criativo = 'ad01') => ({
  trk, utm_campaign: campanha, utm_content: criativo, utm_source: 'facebookads', utm_medium: 'cpc',
});

const gasto = (nome, centavos) => ({ campaign_name: nome, spend_cents: centavos });

const linhaDe = (r, nome) => r.por_campanha.find((c) => c.campanha === nome);

test('receita e vendas contam apenas as pagas', () => {
  const r = calcularGreenn({
    vendas: [
      venda({ id: 1, trk: 'a' }),
      venda({ id: 2, trk: 'b' }),
      venda({ id: 3, status: 'refunded' }),
    ],
    sessoes: [sessao('a', CAMPANHA), sessao('b', CAMPANHA)],
    gastos: [gasto(CAMPANHA, 30592)],
  });
  assert.equal(r.resumo.receita, 54);
  assert.equal(r.resumo.vendas, 2);
  assert.equal(r.resumo.nao_pagas, 1);
  assert.equal(r.resumo.ticket_medio, 27);
});

test('ROAS por campanha divide receita pelo investimento do ciclo inteiro', () => {
  const r = calcularGreenn({
    vendas: [venda({ id: 1, trk: 'a' }), venda({ id: 2, trk: 'b' }), venda({ id: 3, trk: 'c' })],
    sessoes: [sessao('a', CAMPANHA), sessao('b', CAMPANHA), sessao('c', CAMPANHA)],
    gastos: [gasto(CAMPANHA, 30592)],
  });
  const linha = linhaDe(r, CAMPANHA);
  assert.equal(linha.investimento, 305.92);
  assert.equal(linha.receita, 81);
  assert.ok(Math.abs(linha.roas - 0.2648) < 0.001);
  assert.ok(Math.abs(linha.custo_por_venda - 101.9733) < 0.001);
});

test('campanha que gastou e não vendeu continua na lista', () => {
  const r = calcularGreenn({
    vendas: [venda({ id: 1, trk: 'a' })],
    sessoes: [sessao('a', CAMPANHA)],
    gastos: [gasto(CAMPANHA, 10000), gasto(CAMPANHA_NOVA, 5000)],
  });
  const perdida = linhaDe(r, CAMPANHA_NOVA);
  assert.ok(perdida, 'a campanha sem venda não pode sumir da tela');
  assert.equal(perdida.vendas, 0);
  assert.equal(perdida.receita, 0);
  assert.equal(perdida.roas, 0);
  assert.equal(perdida.custo_por_venda, null, 'sem venda não há custo por venda');
});

test('campanha alheia ao produto não entra na aba', () => {
  const r = calcularGreenn({
    vendas: [venda({ id: 1, trk: 'a' })],
    sessoes: [sessao('a', CAMPANHA)],
    gastos: [gasto(CAMPANHA, 10000), gasto('ae_leads_publico-frio_evento-lead_sessao-estrategica', 900000)],
  });
  assert.equal(r.por_campanha.length, 1);
  assert.equal(r.resumo.investimento, 100);
});

test('venda sem sf_trk entra na receita como sem-campanha', () => {
  const r = calcularGreenn({ vendas: [venda({ id: 1 })], sessoes: [], gastos: [] });
  assert.equal(r.resumo.receita, 27);
  assert.equal(r.vendas[0].campanha, SEM_CAMPANHA);
  assert.equal(r.vendas[0].sem_origem, true);
});

test('sf_trk órfão (sessão inexistente) não derruba a venda', () => {
  const r = calcularGreenn({ vendas: [venda({ id: 1, trk: 'fantasma' })], sessoes: [sessao('outro', CAMPANHA)], gastos: [] });
  assert.equal(r.resumo.receita, 27);
  assert.equal(r.vendas[0].campanha, SEM_CAMPANHA);
});

test('sessão com UTM vazia é sem-campanha, não campanha de nome vazio', () => {
  const r = calcularGreenn({
    vendas: [venda({ id: 1, trk: 'a' })],
    sessoes: [{ trk: 'a', utm_campaign: '', utm_content: '', utm_source: '', utm_medium: '' }],
    gastos: [],
  });
  assert.equal(r.por_campanha.length, 1);
  assert.equal(r.por_campanha[0].campanha, SEM_CAMPANHA);
  assert.equal(r.por_campanha[0].investimento, null, 'sem-campanha não tem investimento próprio');
  assert.equal(r.por_campanha[0].roas, null, 'sem investimento não existe ROAS');
});

test('venda de teste interno some de todos os números', () => {
  const r = calcularGreenn({
    vendas: [
      venda({ id: 1, email: 'marcellefernandesdemesquita@gmail.com' }),
      venda({ id: 2, email: 'MARCELLEFERNANDESDEMESQUITA@Gmail.com ' }),
      venda({ id: 3, email: 'cliente@gmail.com' }),
    ],
    sessoes: [],
    gastos: [],
  });
  assert.equal(r.resumo.vendas, 1);
  assert.equal(r.resumo.receita, 27);
  assert.equal(r.resumo.testes_internos, 2);
  assert.equal(r.vendas.length, 1);
});

test('cliente real de Gmail não é confundido com teste interno', () => {
  const reais = ['julianyfsanchez@gmail.com', 'josemariaagostinho12@gmail.com', 'wsbarros2016@gmail.com', 'rayanabeckman@gmail.com'];
  const r = calcularGreenn({
    vendas: reais.map((email, i) => venda({ id: i + 1, email })),
    sessoes: [],
    gastos: [],
  });
  assert.equal(r.resumo.vendas, 4, 'o filtro é por endereço, nunca por domínio');
});

test('payload ilegível é ignorado sem derrubar as outras vendas', () => {
  const r = calcularGreenn({
    vendas: [venda({ id: 1, raw: '{quebrado' }), venda({ id: 2 })],
    sessoes: [],
    gastos: [],
  });
  assert.equal(r.resumo.vendas, 1);
  assert.equal(r.resumo.ilegiveis, 1);
});

test('sem investimento o ROAS é indisponível, nunca infinito', () => {
  const r = calcularGreenn({ vendas: [venda({ id: 1, trk: 'a' })], sessoes: [sessao('a', 'organico-workshop-pago')], gastos: [] });
  assert.equal(linhaDe(r, 'organico-workshop-pago').roas, null);
  assert.equal(r.resumo.roas, null);
});

test('sem venda nenhuma os indicadores são nulos e não zero fabricado', () => {
  const r = calcularGreenn({ vendas: [], sessoes: [], gastos: [] });
  assert.equal(r.resumo.vendas, 0);
  assert.equal(r.resumo.ticket_medio, null);
  assert.equal(r.resumo.roas, null);
  assert.deepEqual(r.vendas, []);
});

test('vendas saem da mais recente para a mais antiga', () => {
  const r = calcularGreenn({
    vendas: [venda({ id: 1, at: 100 }), venda({ id: 2, at: 300 }), venda({ id: 3, at: 200 })],
    sessoes: [],
    gastos: [],
  });
  assert.deepEqual(r.vendas.map((v) => v.id), [2, 3, 1]);
});

test('entrada vazia não lança', () => {
  assert.doesNotThrow(() => calcularGreenn());
});
