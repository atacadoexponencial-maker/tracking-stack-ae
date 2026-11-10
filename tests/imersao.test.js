// Imersão 2027 (spec-imersao-2027.md, série S8): contas de
// functions/api/_imersao.js, o endpoint /api/imersao contra SQLite real (com a
// migration 0070) e o desenho de public/dash/imersao.js com um contexto falso.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import { d1 } from './_fluxos-banco.js';
import {
  calcularVisao, metasEfetivas, previstoDoDia, precoDoDia, corDoDia,
} from '../functions/api/_imersao.js';
import { dadosDeExemplo, AGORA_EXEMPLO, METAS_EXEMPLO } from '../functions/api/_imersao-exemplo.js';
import { onRequestGet as imersaoGet } from '../functions/api/imersao/index.js';
import { onRequestPost as metasPost } from '../functions/api/imersao/metas.js';

const em = (iso) => Math.floor(Date.parse(`${iso}-03:00`) / 1000);
const SEM_METAS = metasEfetivas({});

let seq = 0;
/** Venda paga; `pessoa` vira o e-mail. */
function venda({ produto = 'ingresso', quando = '2026-11-20T10:00:00', valor = 39, pessoa, situacao = 'paga', ...utm } = {}) {
  seq += 1;
  return { id: `v${seq}`, produto, valor, pago_em: em(quando), email: `${pessoa || `p${seq}`}@x.com`, situacao, ...utm };
}
const ingressos = (n, extra = {}) => Array.from({ length: n }, () => venda(extra));
const dados = (vendas, extra = {}) => ({ vendas, trafego: null, visualizacoes: null, inicios_checkout: null, anuncios: [], meet: null, ...extra });
const visao = (vendas, { metas = SEM_METAS, agora = '2026-11-20T15:00:00', extra = {}, exemplo = false } = {}) =>
  calcularVisao(dados(vendas, extra), metas, em(agora), { exemplo });

// ── Banco ────────────────────────────────────────────────────────────────
let db, env;
beforeEach(() => {
  seq = 0;
  db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../migrations/0070_imersao.sql', import.meta.url), 'utf8'));
  env = { DASH_KEY: 'k', DB: d1(db) };
});

async function getImersao() {
  const res = await imersaoGet({ request: new Request('https://x/api/imersao?key=k'), env });
  assert.equal(res.status, 200);
  return res.json();
}

// ── Desenho ──────────────────────────────────────────────────────────────
globalThis.window = globalThis.window || {};
new Function(readFileSync(new URL('../public/dash/imersao.js', import.meta.url), 'utf8'))();
const IM = globalThis.window.Imersao;
const CTX = {
  esc: (s) => String(s ?? ''),
  fmtInt: (n) => Number(n || 0).toLocaleString('pt-BR'),
  fmtPct: (n, c = 1) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: c, minimumFractionDigits: c }) + '%',
  fmtNum: (n, c = 2) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: c }),
  money: (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
};
function tela(resposta, estado = {}) {
  IM._definir({ aba: 'visao', ordem: 'vendas', ...estado });
  const raiz = { innerHTML: '' };
  IM.desenhar(raiz, resposta, CTX);
  return raiz.innerHTML;
}
/** Texto do card (rótulo → HTML do card). */
function cardDe(html, rotulo) {
  const i = html.indexOf(`data-im-card="${rotulo}"`);
  assert.ok(i >= 0, `card ${rotulo} não encontrado`);
  return html.slice(i, html.indexOf('data-im-card=', i + 10) > 0 ? html.indexOf('data-im-card=', i + 10) : undefined);
}

// ── Critérios ────────────────────────────────────────────────────────────

test('CA-S8-03: sem venda real, a tela mostra dados de exemplo com aviso', async () => {
  db.prepare("INSERT INTO imersao_vendas (id, produto, valor_centavos, pago_em, situacao) VALUES ('c1', 'ingresso', 2900, ?, 'cancelada')").run(em('2026-11-10T10:00:00'));
  const r = await getImersao();
  assert.equal(r.exemplo, true);
  assert.ok(r.ingressos.vendidos.valor > 0);
  assert.match(tela(r), /im-faixa-exemplo[\s\S]*Dados de exemplo/);
});

test('CA-S8-04: com a primeira venda real, o aviso some e só entram dados reais', async () => {
  db.prepare("INSERT INTO imersao_vendas (id, produto, valor_centavos, pago_em, email) VALUES ('z1', 'ingresso', 2900, ?, 'a@x.com')").run(em('2026-11-10T10:00:00'));
  const r = await getImersao();
  assert.equal(r.exemplo, false);
  assert.equal(r.ingressos.vendidos.valor, 1);
  assert.equal(r.trafego.investimento, null);
  assert.equal(r.resultado.faturamento.ingressos, 29);
  assert.doesNotMatch(tela(r), /Dados de exemplo/);
});

test('CA-S8-06: indicador sem meta pede a meta', () => {
  const r = visao(ingressos(10), { extra: { trafego: { investimento: 500, impressoes: 1000, cliques: 10 } } });
  assert.equal(r.trafego.cpa_teto.valor, null);
  assert.equal(r.trafego.cpa_teto.falta_meta, true);
  assert.match(cardDe(tela(r), 'CPA teto'), /defina a meta/);
});

test('CA-S8-08: ingressos vendidos sobre a meta', () => {
  const r = visao(ingressos(37));
  assert.deepEqual(r.ingressos.vendidos, { valor: 37, meta: 100, pct: 37 });
  const card = cardDe(tela(r), 'Ingressos vendidos');
  assert.match(card, /37 de 100/);
  assert.match(card, /width:37%/);
});

test('CA-S8-09: pacing por dia corrido e por dia útil', () => {
  const p = visao(ingressos(37), { agora: '2026-11-25T10:00:00' }).ingressos.pacing;
  assert.equal(p.dias_corridos, 10);
  assert.equal(p.dias_uteis, 8);
  assert.equal(p.por_dia_corrido, 6.3);
  assert.equal(p.por_dia_util, 7.9);
});

test('CA-S8-10: pacing com a meta já batida', () => {
  const r = visao(ingressos(104));
  const p = r.ingressos.pacing;
  assert.equal(p.meta_batida, true);
  assert.equal(p.faltam, 0);
  assert.equal(p.por_dia_corrido, null);
  assert.equal(p.por_dia_util, null);
  const html = tela(r);
  assert.match(html, /Meta batida/);
  assert.doesNotMatch(html, /-\d+[,.]?\d*\/dia/);
});

test('CA-S8-11: previsto do dia calculado pela meta', () => {
  assert.equal(precoDoDia('2026-11-20'), 39);
  assert.equal(previstoDoDia({ faltam: 63, dias: 10, preco: 39, metaBump: 10 }), 432.81);
  assert.equal(previstoDoDia({ faltam: 63, dias: 10, preco: 39, metaBump: null }), 245.7);
  // Na Visão geral: hoje 25/11 (lote de R$ 45), 37 vendidos antes, 10 dias.
  const r = visao(ingressos(37, { quando: '2026-11-20T10:00:00' }), { agora: '2026-11-25T10:00:00', metas: metasEfetivas({ meta_bump: 10 }) });
  const hoje = r.ingressos.faturamento_dia.find((d) => d.dia === '2026-11-25');
  assert.equal(hoje.previsto, previstoDoDia({ faltam: 63, dias: 10, preco: 45, metaBump: 10 }));
});

test('CA-S8-12: cor do faturamento do dia', () => {
  assert.equal(corDoDia(480, 400), 'forte');
  assert.equal(corDoDia(410, 400), 'claro');
  assert.equal(corDoDia(400, 400), 'claro');
  assert.equal(corDoDia(390, 400), 'vermelho');
});

test('CA-S8-13: vendas por lote', () => {
  const r = visao([
    venda({ quando: '2026-11-10T10:00:00' }),
    venda({ quando: '2026-11-17T10:00:00' }),
    venda({ quando: '2026-11-17T12:00:00' }),
    venda({ quando: '2026-11-20T10:00:00' }),
  ], { agora: '2026-11-20T15:00:00' });
  const lotes = r.ingressos.lotes;
  assert.equal(lotes.length, 7);
  assert.deepEqual(lotes.map((l) => l.vendidos), [1, 2, 1, 0, 0, 0, 0]);
  assert.deepEqual(lotes.map((l) => l.atual), [false, false, true, false, false, false, false]);
  assert.match(tela(r), /im-lote im-lote--atual[\s\S]*Lote 03 · atual/);
});

test('CA-S8-14: vendas por origem pela UTM', () => {
  const r = visao([
    venda({ utm_source: 'facebookads', utm_medium: 'cpc', utm_content: 'A' }),
    venda({ utm_source: 'instagram', utm_campaign: 'bioperfil-imersao' }),
    venda({ utm_source: 'whatsapp', utm_medium: 'disparo' }),
    venda({}),
  ]);
  const o = Object.fromEntries(r.ingressos.origem.linhas.map((l) => [l.chave, l]));
  for (const k of ['pago', 'organico', 'base', 'outros']) {
    assert.equal(o[k].quantidade, 1, k);
    assert.equal(o[k].pct, 25, k);
  }
  assert.match(r.ingressos.origem.referencia, /75%/);
  assert.match(tela(r), /<b>referência<\/b> ~75%/);
});

test('CA-S8-15: CAC do ingresso e CPA teto', () => {
  const r = visao(ingressos(30, { utm_source: 'facebookads' }), {
    metas: metasEfetivas({ verba_ingresso: 5000, pct_trafego: 75 }),
    extra: { trafego: { investimento: 1500, impressoes: 100000, cliques: 1000 } },
  });
  assert.equal(r.trafego.cac.valor, 50);
  assert.equal(r.trafego.cpa_teto.valor, 66.67);
});

test('CA-S8-16: aviso do CAC acima do teto antes da reta final', () => {
  const metas = metasEfetivas({ verba_ingresso: 5000, pct_trafego: 75 }); // teto R$ 66,67
  const comCac100 = (n) => visao(ingressos(n, { utm_source: 'facebookads' }), { metas, extra: { trafego: { investimento: 100 * n, impressoes: 1e6, cliques: 1e4 } } });
  assert.equal(comCac100(50).trafego.cac.alerta, true);
  assert.equal(comCac100(65).trafego.cac.alerta, true);
  assert.equal(comCac100(75).trafego.cac.alerta, false);
  assert.match(tela(comCac100(50)), /etiqueta im-alerta" data-im-card="CAC do ingresso"/);
});

test('CA-S8-17: taxas do funil com referência', () => {
  const r = visao(ingressos(96), { extra: { trafego: { investimento: 4000, impressoes: 200000, cliques: 2000 }, visualizacoes: 1600, inicios_checkout: 240 } });
  const t = r.trafego;
  assert.equal(t.cpm.valor, 20);
  assert.equal(t.ctr.valor, 1);
  assert.equal(t.connect.valor, 80);
  assert.equal(t.page_checkout.valor, 15);
  assert.equal(t.checkout_compra.valor, 40);
  for (const k of ['ctr', 'connect', 'page_checkout', 'checkout_compra']) assert.ok(t[k].referencia, k);
  const html = tela(r);
  assert.match(cardDe(html, 'CTR'), /1,00%[\s\S]*referência<\/b> 0,95% a 1,06%/);
  assert.match(cardDe(html, 'Connect rate'), /80,0%[\s\S]*referência<\/b> 75% a 94%/);
  assert.match(cardDe(html, 'Checkout to compra'), /40,0%[\s\S]*referência/);
});

test('CA-S8-18: taxa com denominador zero', () => {
  const r = visao(ingressos(3), { extra: { trafego: { investimento: 100, impressoes: 1000, cliques: 0 }, visualizacoes: 50 } });
  assert.equal(r.trafego.connect.valor, null);
  assert.match(cardDe(tela(r), 'Connect rate'), /semdado">—/);
});

test('CA-S8-19: ranking de criativos', () => {
  const r = visao([...ingressos(10, { utm_content: 'A' }), ...ingressos(4, { utm_content: 'B' })], {
    extra: { anuncios: [{ anuncio: 'C', investimento: 50 }, { anuncio: 'A', investimento: 300 }, { anuncio: 'B', investimento: 80 }] },
  });
  const rk = r.trafego.ranking;
  assert.deepEqual(rk.por_vendas.map((a) => a.vendas), [10, 4, 0]);
  assert.deepEqual(rk.por_custo.map((a) => a.custo_por_venda), [20, 30, null]);
  assert.deepEqual(rk.por_custo.map((a) => a.vendas), [4, 10, 0]);
  const html = tela(r, { ordem: 'custo' });
  const tabela = html.slice(html.indexOf('data-im-ranking="custo"'));
  assert.ok(tabela.indexOf('>B<') < tabela.indexOf('>A<') && tabela.indexOf('>A<') < tabela.indexOf('>C<'));
});

test('CA-S8-20: conversão do bump por dia', () => {
  const vendas = [];
  for (let i = 0; i < 8; i++) vendas.push(venda({ quando: '2026-11-10T10:00:00', pessoa: `d${i}` }));
  vendas.push(venda({ produto: 'bump', valor: 297, quando: '2026-11-10T10:00:00', pessoa: 'd0' }));
  vendas.push(venda({ produto: 'bump', valor: 297, quando: '2026-11-10T10:00:00', pessoa: 'd1' }));
  const r = visao(vendas, { agora: '2026-11-11T12:00:00' });
  const dia = Object.fromEntries(r.bump.por_dia.map((d) => [d.dia, d]));
  assert.equal(dia['2026-11-10'].conversao, 25);
  assert.equal(dia['2026-11-11'].conversao, null);
});

test('CA-S8-21: Mentoria com bump x sem bump', () => {
  const vendas = [];
  for (let i = 0; i < 100; i++) vendas.push(venda({ pessoa: `c${i}` }));
  for (let i = 0; i < 20; i++) vendas.push(venda({ produto: 'bump', valor: 297, pessoa: `c${i}` }));
  for (let i = 0; i < 6; i++) vendas.push(venda({ produto: 'mentoria', valor: 10000, quando: '2026-12-05T17:00:00', pessoa: `c${i}` }));
  for (let i = 20; i < 32; i++) vendas.push(venda({ produto: 'mentoria', valor: 10000, quando: '2026-12-05T17:00:00', pessoa: `c${i}` }));
  const m = visao(vendas).bump.mentoria;
  assert.equal(m.com_bump.conversao, 30);
  assert.equal(m.sem_bump.conversao, 15);
  assert.equal(m.diferenca_pct, 100);
  assert.match(m.referencia, /30% a 100%/);
  assert.match(cardDe(tela(visao(vendas, { exemplo: true })), 'Diferença'), /\+100%[\s\S]*referência<\/b> quem compra o bump/);
});

test('CA-S8-22: comparecimento pelo Meet', () => {
  const meet = [];
  for (let i = 0; i < 74; i++) meet.push({ pessoa: `m${i}`, entrou: em('2026-12-05T09:30:00'), saiu: em('2026-12-05T12:00:00') });
  meet.push({ pessoa: 'm0', entrou: em('2026-12-05T14:00:00'), saiu: em('2026-12-05T17:00:00') }); // voltou: conta uma vez
  const r = visao(ingressos(100), { agora: '2026-12-06T10:00:00', extra: { meet } });
  assert.equal(r.evento.comparecimento.valor, 74);
  assert.match(r.evento.comparecimento.referencia, /70% a 80%/);
});

test('CA-S8-23: pico ao vivo no horário da oferta', () => {
  const h = (hm) => em(`2026-12-05T${hm}:00`);
  const meet = [
    { pessoa: 'A', entrou: h('09:30'), saiu: h('17:30') },
    { pessoa: 'B', entrou: h('15:00'), saiu: h('16:10') },
    { pessoa: 'C', entrou: h('16:15'), saiu: h('16:40') },
    { pessoa: 'D', entrou: h('16:20'), saiu: h('17:00') },
    { pessoa: 'E', entrou: h('16:40'), saiu: h('17:00') }, // depois da janela de 30 min
    { pessoa: 'F', entrou: h('15:00'), saiu: h('15:59') }, // saiu antes da oferta
  ];
  const r = visao(ingressos(10), { agora: '2026-12-06T10:00:00', metas: metasEfetivas({ horario_oferta: '16:00' }), extra: { meet } });
  assert.equal(r.evento.pico.valor, 3);
});

test('CA-S8-24: bloco do evento antes da data', () => {
  const r = visao(ingressos(10), { agora: '2026-11-20T10:00:00' });
  assert.equal(r.evento.disponivel, false);
  const html = tela(r);
  const bloco = html.slice(html.indexOf('data-im-bloco="evento"'), html.indexOf('data-im-bloco="resultado"'));
  assert.match(bloco, /Disponível a partir de 05\/12/);
  assert.doesNotMatch(bloco, /data-im-card/);
});

test('CA-S8-26: conversão na Mentoria no dia x 14 dias seguintes', () => {
  const vendas = [];
  for (let i = 0; i < 100; i++) vendas.push(venda({ pessoa: `q${i}` }));
  for (let i = 0; i < 9; i++) vendas.push(venda({ produto: 'mentoria', valor: 9700, quando: '2026-12-05T17:00:00', pessoa: `q${i}` }));
  for (let i = 9; i < 20; i++) vendas.push(venda({ produto: 'mentoria', valor: 9700, quando: '2026-12-12T10:00:00', pessoa: `q${i}` }));
  for (let i = 20; i < 22; i++) vendas.push(venda({ produto: 'mentoria', valor: 9700, quando: '2026-12-22T10:00:00', pessoa: `q${i}` }));
  vendas.push(venda({ produto: 'mentoria', valor: 9700, quando: '2026-12-05T17:00:00', pessoa: 'estranho' })); // não comprou ingresso
  const r = visao(vendas, { agora: '2026-12-23T10:00:00' }).resultado;
  assert.equal(r.dia_x_seguintes.no_dia.conversao, 9);
  assert.equal(r.dia_x_seguintes.seguintes.conversao, 11);
  assert.equal(r.conversao_mentoria.valor, 22);
});

test('CA-S8-27: faturamento total, ticket médio e ROAS', () => {
  const vendas = [];
  for (let i = 0; i < 100; i++) vendas.push(venda({ pessoa: `f${i}`, valor: 45 }));
  for (let i = 0; i < 20; i++) vendas.push(venda({ produto: 'bump', valor: 297, pessoa: `f${i}` }));
  for (let i = 0; i < 6; i++) vendas.push(venda({ produto: 'mentoria', valor: 10000, quando: '2026-12-05T17:00:00', pessoa: `f${i}` }));
  const r = visao(vendas, { agora: '2026-12-06T10:00:00', extra: { trafego: { investimento: 6000, impressoes: 300000, cliques: 3000 } } }).resultado;
  assert.equal(r.faturamento.total, 70440);
  assert.equal(r.ticket_medio, 704.4);
  assert.equal(r.roas, 11.74);
});

test('CA-S8-31: dados de exemplo coerentes', () => {
  const d = dadosDeExemplo();
  const r = calcularVisao(d, metasEfetivas({}, METAS_EXEMPLO), AGORA_EXEMPLO, { exemplo: true });
  const taxas = [];
  (function varrer(o, caminho) {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'number' && (k === 'pct' || k === 'conversao')) taxas.push([`${caminho}.${k}`, v]);
      else varrer(v, `${caminho}.${k}`);
    }
  })(r, 'r');
  for (const k of ['ctr', 'connect', 'page_checkout', 'checkout_compra']) taxas.push([k, r.trafego[k].valor]);
  taxas.push(['comparecimento', r.evento.comparecimento.valor]);
  for (const [nome, v] of taxas) assert.ok(v === null || v <= 100, `${nome} = ${v}`);
  const vendidos = r.ingressos.vendidos.valor;
  assert.ok(vendidos <= d.inicios_checkout && d.inicios_checkout <= d.visualizacoes
    && d.visualizacoes <= d.trafego.cliques && d.trafego.cliques <= d.trafego.impressoes);
  assert.ok(r.resultado.conversao_mentoria.mentorias <= vendidos);
  assert.ok(r.bump.total.bumps <= vendidos);
});

// ── S8-02: metas editáveis ───────────────────────────────────────────────
async function postMetas(corpo) {
  const res = await metasPost({ request: new Request('https://x/api/imersao/metas?key=k', { method: 'POST', body: JSON.stringify(corpo) }), env });
  return { status: res.status, dados: await res.json() };
}
const metasNoBanco = () => Object.fromEntries(db.prepare('SELECT campo, valor FROM imersao_metas').all().map((l) => [l.campo, l.valor]));

test('CA-S8-05: meta salva vale para todo mundo', async () => {
  // Venda real, para o CPA teto não usar a meta de exemplo.
  db.prepare("INSERT INTO imersao_vendas (id, produto, valor_centavos, pago_em, email) VALUES ('z1', 'ingresso', 2900, ?, 'a@x.com')").run(em('2026-11-10T10:00:00'));
  const salvo = await postMetas({ verba_ingresso: '5000', pct_trafego: '75' });
  assert.equal(salvo.status, 200);
  assert.equal(salvo.dados.trafego.cpa_teto.valor, 66.67);
  // "Outra pessoa": um GET novo, sem nada do POST em memória.
  const r = await getImersao();
  assert.equal(r.metas.verba_ingresso, 5000);
  assert.equal(r.metas.origem.verba_ingresso, 'salva');
  assert.equal(r.trafego.cpa_teto.valor, 66.67);
  assert.match(cardDe(tela(r), 'CPA teto'), /R\$\s?66,67/);
});

test('CA-S8-07: valor inválido é recusado com motivo', async () => {
  const neg = await postMetas({ verba_ingresso: '-10', meta_bump: '20' });
  assert.equal(neg.status, 400);
  assert.equal(neg.dados.erros.verba_ingresso, 'a verba não pode ser negativa');
  const pct = await postMetas({ meta_mentoria: '120' });
  assert.equal(pct.status, 400);
  assert.equal(pct.dados.erros.meta_mentoria, 'a porcentagem vai de 0 a 100');
  assert.deepEqual(metasNoBanco(), {}); // nem o meta_bump válido do mesmo envio foi gravado

  // A tela mostra o motivo junto do campo.
  const r = await getImersao();
  IM._definir({ aba: 'visao', ordem: 'vendas', resposta: r });
  const raiz = { innerHTML: '' };
  const form = { elements: Object.fromEntries(['verba_ingresso', 'pct_trafego', 'meta_bump', 'meta_mentoria', 'horario_oferta'].map((c) => [c, { value: '' }])) };
  form.elements.meta_mentoria.value = '120';
  await IM.salvarMetas(raiz, form, { ...CTX, postJson: async (_p, corpo) => { const x = await postMetas(corpo); return { ok: x.status === 200, ...x }; } });
  assert.match(raiz.innerHTML, /data-im-erro="meta_mentoria">a porcentagem vai de 0 a 100/);
  IM._definir({ erros: null, digitado: null, msgMetas: null, metasAberto: false });
});
