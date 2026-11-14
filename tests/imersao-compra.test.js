// Compra da Imersão fora do banco (spec-popup-checkout-imersao.md, série S10,
// issue S10-07): aba Compras da planilha, card do funil IMERSÃO no CRM (ou
// comentário), lista de e-mail e o relatório de marketing sem os compradores.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { d1 } from './_fluxos-banco.js';
import { processarAviso } from '../functions/api/_imersao-zouti.js';
import { CABECALHO_COMPRAS } from '../functions/api/_imersao-compra.js';
import { CU_FIELD, CU_FUNIL_IMERSAO, CU_FUNIL_SESSAO } from '../functions/api/_clickup.js';
import { atribuirCards } from '../functions/api/_feedback-marketing-crm.js';

const SEGREDO = 'segredo-de-teste';
const INGRESSO = 'prod_fe4nfgx9xgwjxmgife1sw5';
const BUMP = 'prod_e52fldo7j7aqksthgah5n1';
const PAGO_EM = '2026-11-14T15:00:00.000Z'; // 12:00 em Brasília
const AGORA = Math.floor(Date.parse('2026-11-15T13:30:00.000Z') / 1000); // 10:30 em Brasília
const UTM = { utm_source: 'facebookads', utm_medium: 'cpc', utm_campaign: 'imersao-ingresso', utm_content: 'video-felipe', utm_term: 'dona-de-marca' };

let db, env, linhas, crm, fetchReal, entrega, planilhaFora;

/** ClickUp de mentira: anota cada chamada; `crm.existente` é o card que a busca acha. */
function ligarCrm() {
  crm = { chamadas: [], existente: null, fora: false };
  globalThis.fetch = async (url, opcoes = {}) => {
    const u = new URL(String(url));
    const chamada = { host: u.host, caminho: u.pathname.replace('/api/v2', ''), metodo: opcoes.method || 'GET', corpo: opcoes.body ? JSON.parse(opcoes.body) : null };
    crm.chamadas.push(chamada);
    if (crm.fora) return new Response('{}', { status: 401 });
    if (chamada.metodo === 'GET') return Response.json({ tasks: crm.existente ? [crm.existente] : [] });
    return Response.json({ id: 'card_novo' });
  };
}
const escritas = () => crm.chamadas.filter((c) => c.metodo !== 'GET');

beforeEach(() => {
  entrega = 0;
  linhas = [];
  planilhaFora = false;
  db = new DatabaseSync(':memory:');
  for (const f of ['0070_imersao.sql', '0071_imersao_avisos.sql', '0053_email_contatos.sql']) {
    db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  }
  env = { DB: d1(db), ZOUTI_WEBHOOK_SECRET: SEGREDO, CLICKUP_API_TOKEN: 'pk_teste' };
  fetchReal = globalThis.fetch;
  ligarCrm();
});
afterEach(() => { globalThis.fetch = fetchReal; });

const item = (produto, centavos) => ({ product_id: produto, name: 'x', quantity: 1, amount: centavos, type: 'DIGITAL' });
const pedido = ({ id = 'ord_1', itens = [item(INGRESSO, 2900)], utm = UTM } = {}) => ({
  id, status: 'PAID', updated_at: PAGO_EM, created_at: PAGO_EM, items: itens,
  customer: { name: 'Maria Teste', email: 'Maria@Exemplo.com', document: '12345678909', phone: '11987654321' },
  utm_data: utm,
});

/** Aviso assinado como o da Zouti; espera também o que roda depois da resposta. */
async function aviso(tipo, objeto, { entregaId } = {}) {
  const corpo = JSON.stringify(objeto);
  const v1 = createHmac('sha256', SEGREDO).update(corpo).digest('hex');
  const r = await processarAviso({
    env, corpo, agora: AGORA,
    cab: { assinatura: `t=1794600000000,v1=${v1}`, tipo, eventoId: `evt_${tipo}_${objeto.id}`, entregaId: entregaId || `del_${++entrega}`, objetoId: objeto.id },
    gravarLinha: async (_env, a) => { if (planilhaFora) throw new Error('planilha fora do ar'); linhas.push(a); },
  });
  await r.depois;
  return r;
}
const vendasPagas = () => db.prepare("SELECT COUNT(*) AS n FROM imersao_vendas WHERE situacao = 'paga'").get().n;

test('CA-S10-38: compra paga vira uma linha por produto na aba Compras', async () => {
  await aviso('ORDER_PAID', pedido({ itens: [item(INGRESSO, 2900), item(BUMP, 29700)] }));
  assert.equal(linhas.length, 2);
  assert.ok(linhas.every((l) => l.aba === 'Compras' && l.planilha === '1extoy7Pqg4woEV_xUqm6KRR6aj9HLTy2-rVQQX_qGD8'));
  assert.deepEqual(linhas[0].cabecalho, CABECALHO_COMPRAS);
  const pessoa = ['Maria Teste', 'maria@exemplo.com', '5511987654321', 'facebookads', 'cpc', 'imersao-ingresso', 'video-felipe', 'dona-de-marca', 'ord_1', 'Paga'];
  const porProduto = Object.fromEntries(linhas.map((l) => [l.linha[1], l.linha]));
  assert.deepEqual(porProduto.Ingresso, ['14/11/2026 12:00:00', 'Ingresso', 'R$ 29,00', ...pessoa]);
  assert.deepEqual(porProduto.Bump, ['14/11/2026 12:00:00', 'Bump', 'R$ 297,00', ...pessoa]);
});

test('CA-S10-39: reembolso, cancelamento e chargeback viram linha nova e a da compra fica', async () => {
  for (const [id, tipo, situacao] of [['ord_a', 'ORDER_REFUNDED', 'Reembolsada'], ['ord_b', 'ORDER_CANCELED', 'Cancelada'], ['ord_c', 'ORDER_DISPUTED', 'Reembolsada']]) {
    linhas = [];
    await aviso('ORDER_PAID', pedido({ id }));
    await aviso(tipo, { ...pedido({ id }), status: 'X' });
    assert.deepEqual(linhas.map((l) => [l.linha[11], l.linha[12]]), [[id, 'Paga'], [id, situacao]], tipo);
    assert.deepEqual(linhas[1].linha.slice(0, 5), ['15/11/2026 10:30:00', 'Ingresso', 'R$ 29,00', 'Maria Teste', 'maria@exemplo.com'], tipo);
  }
});

test('CA-S10-40: planilha, CRM e lista fora do ar não derrubam o aviso nem a venda', async () => {
  planilhaFora = true;
  crm.fora = true;
  db.exec('DROP TABLE email_contatos_entradas; DROP TABLE email_contatos;');
  const r = await aviso('ORDER_PAID', pedido());
  assert.equal(r.status, 200);
  assert.equal(r.corpo.resultado, 'gravado');
  assert.equal(vendasPagas(), 1);
  // Sem a credencial do CRM também responde sucesso.
  delete env.CLICKUP_API_TOKEN;
  assert.equal((await aviso('ORDER_PAID', pedido({ id: 'ord_2' }))).status, 200);
  assert.equal(vendasPagas(), 2);
});

test('CA-S10-41: compra de quem não está no CRM vira card do funil IMERSÃO', async () => {
  await aviso('ORDER_PAID', pedido({ itens: [item(INGRESSO, 2900), item(BUMP, 29700)] }));
  const [criacao, ...resto] = escritas();
  assert.deepEqual(resto, []);
  assert.equal(criacao.caminho, '/list/205126080/task');
  assert.equal(criacao.corpo.name, 'Maria Teste');
  const campos = Object.fromEntries(criacao.corpo.custom_fields.map((c) => [c.id, c.value]));
  assert.equal(campos[CU_FIELD.funil], CU_FUNIL_IMERSAO);
  assert.equal(campos[CU_FIELD.nome], 'Maria Teste');
  assert.equal(campos[CU_FIELD.email], 'maria@exemplo.com');
  assert.equal(campos[CU_FIELD.whatsapp], '+5511987654321');
  assert.deepEqual(
    [CU_FIELD.utmSource, CU_FIELD.utmMedium, CU_FIELD.utmCampaign, CU_FIELD.utmContent].map((id) => campos[id]),
    ['facebookads', 'cpc', 'imersao-ingresso', 'video-felipe'],
  );
  // O card diz o que a pessoa comprou e quanto pagou.
  assert.match(criacao.corpo.description, /Ingresso \(R\$ 29,00\) e Bump \(R\$ 297,00\), total de R\$ 326,00/);
  assert.equal(campos[CU_FIELD.valor], 326);
});

test('CA-S10-42: comprador que já tem card recebe comentário, sem segundo card', async () => {
  crm.existente = { id: 'card_antigo' };
  await aviso('ORDER_PAID', pedido());
  const feitas = escritas();
  assert.equal(feitas.length, 1);
  assert.equal(feitas[0].caminho, '/task/card_antigo/comment');
  assert.match(feitas[0].corpo.comment_text, /Comprou a Imersão Planejamento Atacado 2027.*Ingresso \(R\$ 29,00\)/);
  assert.equal(feitas[0].corpo.notify_all, false);
});

test('CA-S10-43: aviso repetido não repete card, comentário nem linha', async () => {
  const p = pedido();
  await aviso('ORDER_PAID', p, { entregaId: 'del_x' });
  await aviso('ORDER_PAID', p, { entregaId: 'del_x' }); // mesma entrega de novo
  await aviso('ORDER_PAID', p, { entregaId: 'del_y' }); // mesmo pedido, outra entrega
  assert.equal(escritas().length, 1);
  assert.equal(linhas.length, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM email_contatos_entradas').get().n, 1);

  // Com a pessoa já no CRM: um comentário só.
  crm.existente = { id: 'card_antigo' };
  crm.chamadas = [];
  const q = pedido({ id: 'ord_2' });
  await aviso('ORDER_PAID', q);
  await aviso('ORDER_PAID', q);
  assert.deepEqual(escritas().map((c) => c.caminho), ['/task/card_antigo/comment']);
  // Reembolso repetido também não repete.
  await aviso('ORDER_REFUNDED', q);
  await aviso('ORDER_REFUNDED', q);
  assert.equal(escritas().length, 2);
  assert.equal(linhas.filter((l) => l.linha[12] === 'Reembolsada').length, 1);
});

test('CA-S10-44: reembolso, cancelamento e chargeback viram comentário, sem mexer na etapa', async () => {
  const frases = { ORDER_REFUNDED: /foi reembolsada/, ORDER_CANCELED: /foi cancelada/, ORDER_DISPUTED: /chargeback/ };
  for (const [tipo, frase] of Object.entries(frases)) {
    const id = `ord_${tipo}`;
    crm.existente = null;
    await aviso('ORDER_PAID', pedido({ id }));
    crm.existente = { id: 'card_da_compra' }; // o card que nasceu na compra
    crm.chamadas = [];
    await aviso(tipo, { ...pedido({ id }), status: 'X' });
    const feitas = escritas();
    assert.equal(feitas.length, 1, tipo);
    assert.equal(feitas[0].caminho, '/task/card_da_compra/comment', tipo);
    assert.match(feitas[0].corpo.comment_text, frase);
    assert.ok(crm.chamadas.every((c) => c.metodo !== 'PUT'), tipo); // etapa intocada
  }
});

test('CA-S10-45: comprador entra na lista de e-mail com a marca da Imersão, sem disparo', async () => {
  await aviso('ORDER_PAID', pedido());
  const contato = db.prepare('SELECT * FROM email_contatos').get();
  assert.equal(contato.email, 'maria@exemplo.com');
  assert.equal(contato.nome, 'Maria Teste');
  assert.equal(contato.funil, 'imersao');
  const entrada = db.prepare('SELECT * FROM email_contatos_entradas').get();
  assert.equal(entrada.funil, 'imersao');
  assert.equal(entrada.event_id, 'zouti:ord_1');
  // Nada sai para serviço de e-mail, WhatsApp, Meta ou Google: só o CRM é chamado.
  assert.ok(crm.chamadas.length > 0);
  assert.ok(crm.chamadas.every((c) => c.host === 'api.clickup.com'));
});

test('CA-S10-46: comprador da Imersão não entra no total de leads nem no CPL', async () => {
  const opcoes = [{ id: CU_FUNIL_SESSAO, name: 'SESSÃO ESTRATÉGICA', orderindex: 0 }, { id: CU_FUNIL_IMERSAO, name: 'IMERSÃO', orderindex: 18 }];
  const card = (id, opcao) => ({
    id, name: `Lead ${id}`, date_created: String(Date.parse('2026-11-14T12:00:00Z')),
    custom_fields: [{ id: CU_FIELD.funil, value: opcao, type_config: { options: opcoes } }],
  });
  const cards = [
    ...Array.from({ length: 10 }, (_, i) => card(`l${i}`, CU_FUNIL_SESSAO)),
    ...Array.from({ length: 3 }, (_, i) => card(`i${i}`, CU_FUNIL_IMERSAO)),
  ];
  const limites = { desde: Date.parse('2026-11-14T00:00:00Z') / 1000, ate: Date.parse('2026-11-15T00:00:00Z') / 1000 };
  // Relatório de marketing (leads novos): 10, não 13.
  const r = atribuirCards({ cards, funisAtivos: [], limites });
  const contados = r.sem_funil.reduce((s, g) => s + g.cards.length, 0) + [...r.blocos.values()].reduce((s, c) => s + c.length, 0);
  assert.equal(contados, 10);
  assert.ok(r.sem_funil.every((g) => g.opcao !== 'IMERSÃO'));
  // Total de leads e CPL contam eventos de lead e cards registrados em
  // lead_dispatch: a compra não escreve em nenhum dos dois (as tabelas nem
  // existem neste banco, e a compra roda inteira).
  await aviso('ORDER_PAID', pedido());
  assert.equal(escritas().length, 1);
  const tabelas = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => t.name);
  assert.ok(!tabelas.includes('lead_dispatch') && !tabelas.includes('event_log'));
});
