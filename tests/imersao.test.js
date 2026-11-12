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
/** HTML de uma subaba; sem `aba`, junta as telas de detalhe e o Resumo (nessa ordem). */
function tela(resposta, estado = {}) {
  const abas = estado.aba ? [estado.aba] : ['ingressos', 'trafego', 'bump', 'evento', 'resumo'];
  return abas.map((aba) => {
    IM._definir({ ordem: 'vendas', ...estado, aba });
    const raiz = { innerHTML: '' };
    IM.desenhar(raiz, resposta, CTX);
    return raiz.innerHTML;
  }).join('\n');
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
  const p = visao(ingressos(37), { agora: '2026-12-02T10:00:00' }).ingressos.pacing;
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
  assert.equal(precoDoDia('2026-11-27'), 39);
  assert.equal(previstoDoDia({ faltam: 63, dias: 10, preco: 39, metaBump: 10 }), 432.81);
  assert.equal(previstoDoDia({ faltam: 63, dias: 10, preco: 39, metaBump: null }), 245.7);
  // Na Visão geral: hoje 02/12 (lote de R$ 45), 37 vendidos antes, 10 dias.
  const r = visao(ingressos(37, { quando: '2026-11-27T10:00:00' }), { agora: '2026-12-02T10:00:00', metas: metasEfetivas({ meta_bump: 10 }) });
  const hoje = r.ingressos.faturamento_dia.find((d) => d.dia === '2026-12-02');
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
    venda({ quando: '2026-11-24T10:00:00' }),
    venda({ quando: '2026-11-24T12:00:00' }),
    venda({ quando: '2026-11-27T10:00:00' }),
  ], { agora: '2026-11-27T15:00:00' });
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
  for (let i = 0; i < 6; i++) vendas.push(venda({ produto: 'mentoria', valor: 10000, quando: '2026-12-12T17:00:00', pessoa: `c${i}` }));
  for (let i = 20; i < 32; i++) vendas.push(venda({ produto: 'mentoria', valor: 10000, quando: '2026-12-12T17:00:00', pessoa: `c${i}` }));
  const m = visao(vendas).bump.mentoria;
  assert.equal(m.com_bump.conversao, 30);
  assert.equal(m.sem_bump.conversao, 15);
  assert.equal(m.diferenca_pct, 100);
  assert.match(m.referencia, /30% a 100%/);
  assert.match(cardDe(tela(visao(vendas, { exemplo: true })), 'Diferença'), /\+100%[\s\S]*referência<\/b> quem compra o bump/);
});

test('CA-S8-22: comparecimento pelo Meet', () => {
  const meet = [];
  for (let i = 0; i < 74; i++) meet.push({ pessoa: `m${i}`, entrou: em('2026-12-12T09:30:00'), saiu: em('2026-12-12T12:00:00') });
  meet.push({ pessoa: 'm0', entrou: em('2026-12-12T14:00:00'), saiu: em('2026-12-12T17:00:00') }); // voltou: conta uma vez
  const r = visao(ingressos(100), { agora: '2026-12-13T10:00:00', extra: { meet } });
  assert.equal(r.evento.comparecimento.valor, 74);
  assert.match(r.evento.comparecimento.referencia, /70% a 80%/);
});

test('CA-S8-23: pico ao vivo no horário da oferta', () => {
  const h = (hm) => em(`2026-12-12T${hm}:00`);
  const meet = [
    { pessoa: 'A', entrou: h('09:30'), saiu: h('17:30') },
    { pessoa: 'B', entrou: h('15:00'), saiu: h('16:10') },
    { pessoa: 'C', entrou: h('16:15'), saiu: h('16:40') },
    { pessoa: 'D', entrou: h('16:20'), saiu: h('17:00') },
    { pessoa: 'E', entrou: h('16:40'), saiu: h('17:00') }, // depois da janela de 30 min
    { pessoa: 'F', entrou: h('15:00'), saiu: h('15:59') }, // saiu antes da oferta
  ];
  const r = visao(ingressos(10), { agora: '2026-12-13T10:00:00', metas: metasEfetivas({ horario_oferta: '16:00' }), extra: { meet } });
  assert.equal(r.evento.pico.valor, 3);
});

test('CA-S8-24: bloco do evento antes da data', () => {
  const r = visao(ingressos(10), { agora: '2026-11-20T10:00:00' });
  assert.equal(r.evento.disponivel, false);
  const html = tela(r);
  const bloco = html.slice(html.indexOf('data-im-bloco="evento"'), html.indexOf('data-im-bloco="resultado"'));
  assert.match(bloco, /Disponível a partir de 12\/12/);
  assert.doesNotMatch(bloco, /data-im-card/);
});

test('CA-S8-26: conversão na Mentoria no dia x 14 dias seguintes', () => {
  const vendas = [];
  for (let i = 0; i < 100; i++) vendas.push(venda({ pessoa: `q${i}` }));
  for (let i = 0; i < 9; i++) vendas.push(venda({ produto: 'mentoria', valor: 9700, quando: '2026-12-12T17:00:00', pessoa: `q${i}` }));
  for (let i = 9; i < 20; i++) vendas.push(venda({ produto: 'mentoria', valor: 9700, quando: '2026-12-19T10:00:00', pessoa: `q${i}` }));
  for (let i = 20; i < 22; i++) vendas.push(venda({ produto: 'mentoria', valor: 9700, quando: '2026-12-29T10:00:00', pessoa: `q${i}` }));
  vendas.push(venda({ produto: 'mentoria', valor: 9700, quando: '2026-12-12T17:00:00', pessoa: 'estranho' })); // não comprou ingresso
  const r = visao(vendas, { agora: '2026-12-30T10:00:00' }).resultado;
  assert.equal(r.dia_x_seguintes.no_dia.conversao, 9);
  assert.equal(r.dia_x_seguintes.seguintes.conversao, 11);
  assert.equal(r.conversao_mentoria.valor, 22);
});

test('CA-S8-27: faturamento total, ticket médio e ROAS', () => {
  const vendas = [];
  for (let i = 0; i < 100; i++) vendas.push(venda({ pessoa: `f${i}`, valor: 45 }));
  for (let i = 0; i < 20; i++) vendas.push(venda({ produto: 'bump', valor: 297, pessoa: `f${i}` }));
  for (let i = 0; i < 6; i++) vendas.push(venda({ produto: 'mentoria', valor: 10000, quando: '2026-12-12T17:00:00', pessoa: `f${i}` }));
  const r = visao(vendas, { agora: '2026-12-13T10:00:00', extra: { trafego: { investimento: 6000, impressoes: 300000, cliques: 3000 } } }).resultado;
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
  IM._definir({ aba: 'metas', ordem: 'vendas', resposta: r });
  const raiz = { innerHTML: '' };
  const form = { elements: Object.fromEntries(['verba_ingresso', 'pct_trafego', 'meta_bump', 'meta_mentoria', 'horario_oferta'].map((c) => [c, { value: '' }])) };
  form.elements.meta_mentoria.value = '120';
  await IM.salvarMetas(raiz, form, { ...CTX, postJson: async (_p, corpo) => { const x = await postMetas(corpo); return { ok: x.status === 200, ...x }; } });
  assert.match(raiz.innerHTML, /data-im-erro="meta_mentoria">a porcentagem vai de 0 a 100/);
  IM._definir({ erros: null, digitado: null, msgMetas: null });
});

// ── S8-03: simulação ─────────────────────────────────────────────────────
import { projetar, ritmoAtual } from '../functions/api/_imersao.js';
import { onRequestGet as simulacaoGet } from '../functions/api/imersao/simulacao.js';

/** Banco real com 37 ingressos: 25 em 12/11 e 4 em cada um de 29/11, 30/11 e 01/12 (ritmo 4/dia). */
function cenario37() {
  const ins = db.prepare("INSERT INTO imersao_vendas (id, produto, valor_centavos, pago_em, email) VALUES (?, 'ingresso', 3500, ?, ?)");
  let n = 0;
  for (let i = 0; i < 25; i++) ins.run(`s${++n}`, em('2026-11-12T10:00:00'), `s${n}@x.com`);
  for (const d of ['11-29', '11-30', '12-01']) for (let i = 0; i < 4; i++) ins.run(`s${++n}`, em(`2026-${d}T10:00:00`), `s${n}@x.com`);
}
async function getSimulacao(ajuste, agora = '2026-12-02T10:00:00') {
  const real = Date.now;
  Date.now = () => em(agora) * 1000;
  try {
    const q = ajuste === undefined ? '' : `&ajuste=${ajuste}`;
    const res = await simulacaoGet({ request: new Request(`https://x/api/imersao/simulacao?key=k${q}`), env });
    assert.equal(res.status, 200);
    return res.json();
  } finally {
    Date.now = real;
  }
}

test('CA-S8-28: projeção pelo ritmo atual', async () => {
  cenario37();
  const s = await getSimulacao();
  assert.equal(s.exemplo, false);
  assert.equal(s.vendidos, 37);
  assert.equal(s.ritmo_atual, 4);
  assert.equal(s.dias, 10);
  assert.equal(s.projetado_fim, 77);
  assert.equal(s.bate_meta, false);
  assert.equal(s.ritmo_necessario, 6.3);
  const html = IM.desenharSimulacao(s, CTX);
  assert.match(html, /Não bate a meta · faltam 23/);
  assert.match(html, /6,3\/dia/);
});

test('CA-S8-29: ajuste de ritmo', async () => {
  cenario37();
  const s = await getSimulacao(60);
  assert.equal(s.projetado_fim, 101);
  assert.equal(s.bate_meta, true);
  assert.equal(s.bate_em, '2026-12-11');
  assert.match(IM.desenharSimulacao(s, CTX), /Bate a meta em 11\/12/);
  // Nada gravado: outra pessoa (sem ajuste) continua vendo o ritmo atual.
  assert.equal((await getSimulacao()).projetado_fim, 77);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM imersao_metas').get().n, 0);
});

test('CA-S8-30: faturamento projetado com o preço de cada lote', () => {
  assert.equal(ritmoAtual([], em('2026-11-25T10:00:00')), 0);
  const p = projetar({
    vendidos: 37, ritmo: 4, agora: em('2026-12-01T08:00:00'), conversaoBump: 10, realizado: 2000,
    dias: ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05'],
  });
  assert.deepEqual(p.linhas.map((l) => l.preco), [45, 45, 49, 49, 49]);
  assert.equal(r2(p.faturamento.ingressos_projetados + p.faturamento.bump_projetado), 1542);
  assert.equal(p.faturamento.total, 3542);
});
const r2 = (n) => Math.round(n * 100) / 100;

// ── S8-04: Resumo e telas de detalhe ─────────────────────────────────────
import { linhaVendaDia, simular } from '../functions/api/_imersao.js';

const resumoExemplo = () => calcularVisao(dadosDeExemplo(), metasEfetivas({}, METAS_EXEMPLO), AGORA_EXEMPLO, { exemplo: true });
/** Linha <tr> da tabela de venda por dia que começa com o dia dd/mm. */
function linhaDaTabela(html, ddmm) {
  const t = html.slice(html.indexOf('data-im-venda-dia'));
  const i = t.indexOf(`<td>${ddmm}</td>`);
  assert.ok(i >= 0, `linha ${ddmm} não encontrada`);
  return t.slice(i, t.indexOf('</tr>', i));
}

test('CA-S8-33: venda por dia no Resumo', () => {
  const l = linhaVendaDia({ dia: '2026-11-20', ingressos: 5, realizado: 240, previsto: 200, meta_ingressos: 4, cor: corDoDia(240, 200) }, 80);
  assert.deepEqual(
    { ingressos: l.ingressos, faturamento: l.faturamento, conversao: l.conversao, meta: l.meta_ingressos, atingimento: l.atingimento, cor: l.cor },
    { ingressos: 5, faturamento: 240, conversao: 6.25, meta: 4, atingimento: 120, cor: 'forte' },
  );
  const r = resumoExemplo();
  r.resumo.venda_por_dia = [l];
  const linha = linhaDaTabela(tela(r, { aba: 'resumo' }), '20/11');
  assert.match(linha, /<td class="num">5<\/td><td class="num">4<\/td>/);
  assert.match(linha, /R\$\s?240,00/);
  assert.match(linha, /6,25%/);
  assert.match(linha, /im-cor--forte[^>]*>120%/);

  // Na conta de verdade: 17/11 sem nada vendido antes → meta do dia = 100 ÷ 25 dias = 4.
  const v = visao(ingressos(5, { quando: '2026-11-17T10:00:00', valor: 48 }), { agora: '2026-11-18T12:00:00', extra: { visitas_por_dia: { '2026-11-17': 80 } } });
  const d = v.resumo.venda_por_dia.find((x) => x.dia === '2026-11-17');
  assert.equal(d.meta_ingressos, 4);
  assert.equal(d.previsto, 116); // 4 × R$ 29 (lote 01), sem meta de bump
  assert.equal(d.conversao, 6.25);
  assert.equal(d.atingimento, 206.9);
  // O exemplo traz visitas em todos os dias.
  assert.ok(resumoExemplo().resumo.venda_por_dia.every((x) => x.conversao !== null && x.conversao <= 100));
});

test('CA-S8-34: conversão do dia sem visitas', () => {
  const base = { dia: '2026-11-20', ingressos: 3, realizado: 117, previsto: 150, meta_ingressos: 4, cor: 'vermelho' };
  assert.equal(linhaVendaDia(base, null).conversao, null);
  assert.equal(linhaVendaDia(base, 0).conversao, null);
  const v = visao(ingressos(3), { agora: '2026-11-21T12:00:00' });
  assert.ok(v.resumo.venda_por_dia.every((x) => x.conversao === null));
  const linha = linhaDaTabela(tela(v, { aba: 'resumo' }), '20/11');
  assert.doesNotMatch(linha, /0,00%/);
  assert.match(linha, /<td class="num">—<\/td>/);
});

/** 40 ingressos do tráfego a R$ 39 + 8 bumps; CAC R$ 52 > teto R$ 46,67; bump 20% < meta 25%. */
function cenarioResumo() {
  const vendas = [];
  for (let i = 1; i <= 40; i++) {
    vendas.push(venda({ pessoa: `r${i}`, utm_source: 'facebookads' }));
    if (i <= 8) vendas.push(venda({ produto: 'bump', valor: 297, pessoa: `r${i}` }));
  }
  return visao(vendas, {
    metas: metasEfetivas({ verba_ingresso: 3500, pct_trafego: 75, meta_bump: 25 }),
    extra: { trafego: { investimento: 2080, impressoes: 100000, cliques: 1000 } },
  });
}

test('CA-S8-35: cards de estado do Resumo', () => {
  const r = cenarioResumo();
  const c = r.resumo.cards;
  assert.deepEqual(c.vendidos, { valor: 40, meta: 100, pct: 40 });
  assert.equal(c.faturamento_ate_agora, 3936);
  assert.equal(c.por_dia.valor, 2.7); // 60 em 22 dias (20/11 a 11/12)
  assert.deepEqual(c.cac, { valor: 52, teto: 46.67, falta_meta: false, alerta: true });
  assert.deepEqual(c.bump, { conversao: 20, meta: 25 });
  const html = tela(r, { aba: 'resumo' });
  assert.match(cardDe(html, 'Vendidos x meta'), /40 de 100/);
  assert.match(cardDe(html, 'Faturamento até agora'), /R\$\s?3\.936,00/);
  assert.match(cardDe(html, 'Precisa vender por dia'), /2,7\/dia/);
  assert.match(html, /etiqueta im-alerta" data-im-card="CAC x CPA teto"/);
  assert.match(cardDe(html, 'CAC x CPA teto'), /R\$\s?52,00[\s\S]*teto R\$\s?46,67/);
  assert.match(cardDe(html, 'Bump x meta'), /20,0%[\s\S]*meta 25%/);
});

test('CA-S8-36: projeção em uma linha igual à Simulação', () => {
  const casos = [
    [dadosDeExemplo(), AGORA_EXEMPLO, true],
    [dados([...ingressos(25, { quando: '2026-11-12T10:00:00' }), ...ingressos(12, { quando: '2026-11-23T10:00:00' })]), em('2026-11-25T10:00:00'), false],
  ];
  for (const [d, agora, exemplo] of casos) {
    const p = calcularVisao(d, metasEfetivas({}), agora, { exemplo }).resumo.projecao;
    const s = simular(d, agora, 0, { exemplo });
    assert.deepEqual([p.projetado_fim, p.bate_meta, p.bate_em, p.faltam_no_fim], [s.projetado_fim, s.bate_meta, s.bate_em, s.faltam_no_fim]);
  }
  const r = resumoExemplo();
  const s = simular(dadosDeExemplo(), AGORA_EXEMPLO, 0, { exemplo: true });
  const html = tela(r, { aba: 'resumo' });
  assert.match(html, new RegExp(`termina com <b>${Math.round(s.projetado_fim)} ingressos</b>`));
  assert.match(html, s.bate_meta ? /bate a meta em/ : /não bate a meta · faltam/);
});

test('CA-S8-37: alertas do Resumo', () => {
  const r = cenarioResumo(); // 19/11 sem venda, CAC acima do teto, bump abaixo, ritmo 0
  assert.deepEqual(r.resumo.alertas.map((a) => a.chave), ['dia_abaixo', 'cac_acima', 'bump_abaixo', 'projecao']);
  const html = tela(r, { aba: 'resumo' });
  assert.match(html, /data-im-alerta="dia_abaixo">[\s\S]*19\/11 faturou R\$ 0,00, abaixo do previsto/);
  assert.match(html, /CAC de R\$ 52,00 acima do teto de R\$ 46,67/);
  assert.match(html, /Bump convertendo 20%, abaixo da meta de 25%/);
  assert.match(html, /não bate a meta de 100/);

  // Meta batida ontem, sem tráfego e sem meta de bump: nada fora.
  const ok = visao(ingressos(104, { quando: '2026-11-19T10:00:00' }));
  assert.deepEqual(ok.resumo.alertas, []);
  assert.match(tela(ok, { aba: 'resumo' }), /data-im-alertas>Nada fora do previsto/);
});

test('CA-S8-38: cada subaba mostra o seu bloco', () => {
  const r = resumoExemplo();
  const blocos = (html) => [...html.matchAll(/data-im-bloco="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(blocos(tela(r, { aba: 'ingressos' })), ['ingressos']);
  assert.deepEqual(blocos(tela(r, { aba: 'trafego' })), ['trafego']);
  assert.deepEqual(blocos(tela(r, { aba: 'bump' })), ['bump']);
  assert.deepEqual(blocos(tela(r, { aba: 'evento' })), ['evento', 'resultado']);
  const metas = tela(r, { aba: 'metas' });
  assert.deepEqual(blocos(metas), ['metas']);
  assert.match(metas, /data-im-form-metas/);
  const resumo = tela(r, { aba: 'resumo' });
  assert.deepEqual(blocos(resumo), ['resumo']);
  assert.doesNotMatch(resumo, /data-im-form-metas/);
  assert.match(resumo, /data-im-grafico/);
  // As subabas na ordem combinada; aba desconhecida cai no Resumo.
  const rotulos = [...resumo.matchAll(/data-im-aba="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(rotulos, ['resumo', 'ingressos', 'trafego', 'bump', 'evento', 'simulacao', 'metas']);
  assert.match(tela(r, { aba: 'visao' }), /data-im-conteudo="resumo"/);
});
