import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVISO_SEM_FUNIL_VENDA, avisoFunilVenda, calcularGreenn, campanhaDoProduto, reduzirPorVenda, SEM_CAMPANHA } from '../functions/api/_greenn-metricas.js';

const CAMPANHA = 'ae_vendas-workshop-pago-09-09_publico-frio';
const CAMPANHA_NOVA = 'ae_vendas-workshop-pago-23-09_publico-frio';
// Trecho do cadastro inicial (migration 0040) do funil WO PAGO.
const TRECHO = 'workshop-pago';

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
    trechoCampanha: TRECHO,
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
    trechoCampanha: TRECHO,
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

// --- Uma linha por venda (revisão de 13/09/2026) -----------------------------

test('a mesma venda com vários saleUpdated conta UMA vez', () => {
  const r = calcularGreenn({
    vendas: [
      venda({ id: 7, status: 'waiting_payment', at: 100 }),
      venda({ id: 7, status: 'paid', at: 200 }),
      venda({ id: 7, status: 'paid', at: 300 }),
    ],
    sessoes: [],
    gastos: [],
  });
  assert.equal(r.resumo.vendas, 1);
  assert.equal(r.resumo.receita, 27);
  assert.equal(r.resumo.nao_pagas, 0, 'o waiting_payment anterior não conta como não paga');
});

test('venda estornada depois de paga não entra na receita', () => {
  const r = calcularGreenn({
    vendas: [
      venda({ id: 7, status: 'paid', at: 200 }),
      venda({ id: 7, status: 'refunded', at: 300 }),
    ],
    sessoes: [],
    gastos: [],
  });
  assert.equal(r.resumo.vendas, 0);
  assert.equal(r.resumo.nao_pagas, 1);
});

test('a ordem das linhas não importa: vence o maior received_at', () => {
  const r = calcularGreenn({
    vendas: [
      venda({ id: 7, status: 'refunded', at: 300 }),
      venda({ id: 7, status: 'paid', at: 200 }),
    ],
    sessoes: [],
    gastos: [],
  });
  assert.equal(r.resumo.vendas, 0);
});

test('empate de received_at é desfeito pelo id da linha (ordem de chegada)', () => {
  const linhas = [
    { ...venda({ id: 7, status: 'paid', at: 200 }), id: 10 },
    { ...venda({ id: 7, status: 'refunded', at: 200 }), id: 11 },
  ];
  assert.equal(calcularGreenn({ vendas: linhas }).resumo.vendas, 0);
  assert.equal(calcularGreenn({ vendas: [linhas[1], linhas[0]] }).resumo.vendas, 0);
});

test('reduzirPorVenda mantém uma linha por entity_id', () => {
  const linhas = [
    venda({ id: 1, at: 100 }),
    venda({ id: 2, at: 100 }),
    venda({ id: 1, at: 150 }),
    { entity_id: '2', current_status: 'paid', amount: 27, received_at: 90, raw_json: '{}' },
  ];
  const reduzidas = reduzirPorVenda(linhas);
  assert.equal(reduzidas.length, 2);
  assert.equal(reduzidas.find((l) => String(l.entity_id) === '1').received_at, 150);
  assert.equal(reduzidas.find((l) => String(l.entity_id) === '2').received_at, 100, 'entity_id numérico e texto são a mesma venda');
});

// --- Reconhecimento pelo trecho do cadastro (issue 266) ----------------------

test('trecho reconhece sem diferenciar maiúsculas e minúsculas', () => {
  assert.equal(campanhaDoProduto('AE_VENDAS-WORKSHOP-PAGO-30-09_PUBLICO-FRIO', 'workshop-pago'), true);
  assert.equal(campanhaDoProduto('ae_vendas-workshop-pago-23-09_publico-frio', 'WorkShop-Pago'), true);
});

test('trecho é texto literal, nunca regex', () => {
  assert.equal(campanhaDoProduto('ae_vendas-axb_publico', 'a.b'), false);
  assert.equal(campanhaDoProduto('ae_vendas-a.b_publico', 'a.b'), true);
  assert.equal(campanhaDoProduto('campanha (teste)+1', '(teste)+'), true);
  assert.doesNotThrow(() => campanhaDoProduto('x', '[quebrado('));
});

test('trecho com espaços nas pontas vale sem eles; vazio não reconhece nada', () => {
  assert.equal(campanhaDoProduto(CAMPANHA, '  workshop-pago '), true);
  assert.equal(campanhaDoProduto(CAMPANHA, ''), false);
  assert.equal(campanhaDoProduto(CAMPANHA, '   '), false);
  assert.equal(campanhaDoProduto(CAMPANHA, null), false);
});

test('trecho alterado passa a reconhecer as campanhas do trecho novo', () => {
  const gastos = [gasto(CAMPANHA, 10000), gasto('ae_vendas-mentoria-paga_publico-frio', 5000)];
  const antes = calcularGreenn({ gastos, trechoCampanha: TRECHO });
  const depois = calcularGreenn({ gastos, trechoCampanha: 'mentoria-paga' });
  assert.deepEqual(antes.por_campanha.map((c) => c.campanha), [CAMPANHA]);
  assert.deepEqual(depois.por_campanha.map((c) => c.campanha), ['ae_vendas-mentoria-paga_publico-frio']);
});

test('sem trecho: lista vendas e campanhas que venderam, esconde as que só gastaram', () => {
  for (const trechoCampanha of [null, undefined, '']) {
    const r = calcularGreenn({
      vendas: [venda({ id: 1, trk: 'a' })],
      sessoes: [sessao('a', CAMPANHA)],
      gastos: [gasto(CAMPANHA, 10000), gasto(CAMPANHA_NOVA, 5000)],
      trechoCampanha,
    });
    assert.deepEqual(r.por_campanha.map((c) => c.campanha), [CAMPANHA]);
    assert.equal(linhaDe(r, CAMPANHA).investimento, 100, 'quem vendeu mantém o investimento');
    assert.equal(r.resumo.vendas, 1);
    assert.equal(r.vendas.length, 1);
    assert.equal(r.resumo.investimento, 100);
  }
});

// Equivalência: padrão fixo antigo × trecho do cadastro inicial.
//
// NOMES reúne os nomes reais de ad_spend (três campanhas do produto, SE, LIVE,
// impulsionamento) mais uma variação em maiúsculas e uma quase-igual sem hífen.
const PADRAO_ANTIGO = /workshop-pago/i;
const NOMES = [
  'ae_vendas-workshop-pago-09-09_publico-frio',
  'ae_vendas-workshop-pago-23-09_publico-frio',
  'ae_vendas-workshop-pago-23-09_publico-quente',
  'ae_leads_publico-frio_evento-lead_sessao-estrategica',
  'ae_leads_publico-frio_evento-lead_lives-semanais',
  'Post do Instagram: Comente “ANALISE” se quiser...',
  'AE_VENDAS-WORKSHOP-PAGO-30-09_PUBLICO-FRIO',
  'workshop_pago_sem_hifen',
];

test('equivalência: o trecho do cadastro reconhece exatamente as mesmas campanhas do padrão antigo', () => {
  for (const nome of NOMES) {
    assert.equal(campanhaDoProduto(nome, TRECHO), PADRAO_ANTIGO.test(nome), nome);
  }
});

function vendaEq(id, status, at, email, trk) {
  return {
    id, entity_id: id, current_status: status, amount: 27, received_at: at,
    raw_json: JSON.stringify({ client: { name: 'C' + id, email }, sale: { method: 'PIX' }, product: { name: 'Workshop' }, ...(trk ? { sf_trk: trk } : {}) }),
  };
}

// Cobre: venda paga de campanha do produto, venda com várias atualizações,
// venda paga vinda de campanha de outro funil, venda sem rastreio, estorno,
// teste interno, campanha do produto que só gastou e campanhas alheias.
const CONJUNTO_EQ = {
  vendas: [
    vendaEq(1, 'paid', 100, 'a@gmail.com', 't1'),
    vendaEq(2, 'waiting_payment', 100, 'b@gmail.com', 't2'),
    vendaEq(2, 'paid', 200, 'b@gmail.com', 't2'),
    vendaEq(3, 'paid', 150, 'c@gmail.com', 't3'),
    vendaEq(4, 'paid', 160, 'd@gmail.com', null),
    vendaEq(5, 'refunded', 170, 'e@gmail.com', 't1'),
    vendaEq(6, 'paid', 180, 'marcellefernandesdemesquita@gmail.com', 't1'),
  ],
  sessoes: [
    { trk: 't1', utm_campaign: NOMES[0], utm_content: 'ad01', utm_source: 'facebookads', utm_medium: 'cpc' },
    { trk: 't2', utm_campaign: NOMES[2], utm_content: 'ad02', utm_source: 'facebookads', utm_medium: 'cpc' },
    { trk: 't3', utm_campaign: NOMES[3], utm_content: 'ad03', utm_source: 'facebookads', utm_medium: 'cpc' },
  ],
  gastos: [30592, 176113, 48938, 1285039, 489140, 42567, 1000, 500].map((c, i) => gasto(NOMES[i], c)),
};

// Saída de `calcularGreenn(CONJUNTO_EQ)` gerada com o módulo ANTES da troca
// (commit 7bbb053, ainda com `PADRAO_CAMPANHA_PRODUTO = /workshop-pago/i`).
// Não recalcular a partir do código novo: o valor é justamente o de antes.
const SAIDA_PADRAO_ANTIGO = {"resumo":{"receita":108,"vendas":4,"ticket_medio":27,"investimento":15416.82,"roas":0.0070053357307148945,"nao_pagas":1,"ilegiveis":0,"testes_internos":1},"por_campanha":[{"campanha":"ae_leads_publico-frio_evento-lead_sessao-estrategica","sem_campanha":false,"investimento":12850.39,"receita":27,"vendas":1,"roas":0.002101103546273693,"custo_por_venda":12850.39},{"campanha":"ae_vendas-workshop-pago-23-09_publico-quente","sem_campanha":false,"investimento":489.38,"receita":27,"vendas":1,"roas":0.055171850096039886,"custo_por_venda":489.38},{"campanha":"ae_vendas-workshop-pago-09-09_publico-frio","sem_campanha":false,"investimento":305.92,"receita":27,"vendas":1,"roas":0.08825836820083681,"custo_por_venda":305.92},{"campanha":"sem-campanha","sem_campanha":true,"investimento":null,"receita":27,"vendas":1,"roas":null,"custo_por_venda":0},{"campanha":"ae_vendas-workshop-pago-23-09_publico-frio","sem_campanha":false,"investimento":1761.13,"receita":0,"vendas":0,"roas":0,"custo_por_venda":null},{"campanha":"AE_VENDAS-WORKSHOP-PAGO-30-09_PUBLICO-FRIO","sem_campanha":false,"investimento":10,"receita":0,"vendas":0,"roas":0,"custo_por_venda":null}],"vendas":[{"id":2,"data":200,"nome":"C2","valor":27,"metodo":"PIX","produto":"Workshop","campanha":"ae_vendas-workshop-pago-23-09_publico-quente","criativo":"ad02","origem":"facebookads","sem_origem":false},{"id":4,"data":160,"nome":"C4","valor":27,"metodo":"PIX","produto":"Workshop","campanha":"sem-campanha","criativo":"","origem":"","sem_origem":true},{"id":3,"data":150,"nome":"C3","valor":27,"metodo":"PIX","produto":"Workshop","campanha":"ae_leads_publico-frio_evento-lead_sessao-estrategica","criativo":"ad03","origem":"facebookads","sem_origem":false},{"id":1,"data":100,"nome":"C1","valor":27,"metodo":"PIX","produto":"Workshop","campanha":"ae_vendas-workshop-pago-09-09_publico-frio","criativo":"ad01","origem":"facebookads","sem_origem":false}]};

test('equivalência: com o trecho do cadastro inicial a saída é idêntica à do padrão antigo', () => {
  const r = calcularGreenn({ ...CONJUNTO_EQ, trechoCampanha: TRECHO });
  assert.deepEqual(r, SAIDA_PADRAO_ANTIGO);
  assert.equal(JSON.stringify(r), JSON.stringify(SAIDA_PADRAO_ANTIGO), 'mesma ordem de campanhas e de chaves');
});

// --- Aviso da aba Greenn sem funil de venda ou sem trecho (issue 267) --------

test('sem funil de venda ativo o aviso manda cadastrar', () => {
  assert.equal(avisoFunilVenda(null), 'Nenhum funil de venda cadastrado — as campanhas do produto que não venderam não aparecem. Cadastre em Funis do relatório.');
  assert.equal(avisoFunilVenda(undefined), AVISO_SEM_FUNIL_VENDA);
});

test('funil de venda sem trecho avisa pelo nome do funil', () => {
  const msg = 'O funil WO PAGO não tem trecho do nome da campanha.';
  assert.equal(avisoFunilVenda({ nome: 'WO PAGO', trecho_campanha: null }), msg);
  assert.equal(avisoFunilVenda({ nome: 'WO PAGO', trecho_campanha: '' }), msg);
  assert.equal(avisoFunilVenda({ nome: 'WO PAGO', trecho_campanha: '   ' }), msg, 'só espaços é sem trecho');
});

test('funil de venda com trecho não gera aviso', () => {
  assert.equal(avisoFunilVenda({ nome: 'WO PAGO', trecho_campanha: 'workshop-pago' }), null);
});
