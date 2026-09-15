import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contarComprasDoPeriodo,
  avisosGreenn,
  lerVendasGreennDoPeriodo,
  AVISO_GREENN_SEM_EVENTO_NUNCA,
  classificarOrigem,
  contarPorOrigem,
  lerSessoesCheckout,
} from '../functions/api/_feedback-marketing-greenn.js';
import { limitesDoPeriodoUnix } from '../functions/api/_feedback-marketing-periodo.js';

// 14/09/2026 em Brasília.
const LIM = limitesDoPeriodoUnix({ inicio: '2026-09-14', fim: '2026-09-14' });
const DENTRO = LIM.desde + 3600;

let seq = 0;
function linha({ venda = 1, status = 'paid', at = DENTRO, email = 'cliente@gmail.com', trk = null, raw = null }) {
  seq++;
  return {
    id: seq,
    entity_id: venda,
    current_status: status,
    amount: 67,
    received_at: at,
    raw_json: raw !== null ? raw : JSON.stringify({ client: { email }, ...(trk ? { sf_trk: trk } : {}) }),
  };
}

test('dado real de 14/09: 3 vendas pagas, uma sem sf_trk', () => {
  const linhas = [
    linha({ venda: 9919791, at: 1789417550, email: 'a@x.com' }),
    linha({ venda: 9919861, at: 1789418184, email: 'b@x.com', trk: '99d1569c' }),
    linha({ venda: 9920166, at: 1789420635, email: 'c@x.com', trk: '92162f98' }),
  ];
  const r = contarComprasDoPeriodo({ linhas, limites: LIM });
  assert.equal(r.compras.length, 3);
  assert.equal(r.ilegiveis, 0);
  assert.deepEqual(r.compras.map((c) => c.trk), ['', '99d1569c', '92162f98']);
});

test('venda notificada várias vezes conta uma vez', () => {
  const linhas = [linha({ venda: 1 }), linha({ venda: 1, at: DENTRO + 10 }), linha({ venda: 1, at: DENTRO + 20 })];
  assert.equal(contarComprasDoPeriodo({ linhas, limites: LIM }).compras.length, 1);
});

test('paga e depois estornada ou reembolsada não conta', () => {
  const linhas = [
    linha({ venda: 1 }), linha({ venda: 1, status: 'refunded', at: DENTRO + 100 }),
    linha({ venda: 2 }), linha({ venda: 2, status: 'chargedback', at: LIM.ate + 86400 }),
  ];
  assert.equal(contarComprasDoPeriodo({ linhas, limites: LIM }).compras.length, 0);
});

test('aguardando, recusada ou cancelada não conta', () => {
  const linhas = ['waiting_payment', 'refused', 'canceled'].map((status, i) => linha({ venda: i + 1, status }));
  assert.equal(contarComprasDoPeriodo({ linhas, limites: LIM }).compras.length, 0);
});

test('data da venda é a primeira atualização paga: reemissão no período não traz venda paga antes', () => {
  const linhas = [linha({ venda: 1, at: LIM.desde - 60 }), linha({ venda: 1, at: DENTRO })];
  assert.equal(contarComprasDoPeriodo({ linhas, limites: LIM }).compras.length, 0);
  // E no dia anterior ela conta, com a data da primeira paga.
  const ontem = { desde: LIM.desde - 86400, ate: LIM.desde };
  const r = contarComprasDoPeriodo({ linhas, limites: ontem });
  assert.equal(r.compras.length, 1);
  assert.equal(r.compras[0].pago_em, LIM.desde - 60);
});

test('aguardando antes do período e paga dentro conta', () => {
  const linhas = [linha({ venda: 1, status: 'waiting_payment', at: LIM.desde - 500 }), linha({ venda: 1, at: DENTRO })];
  assert.equal(contarComprasDoPeriodo({ linhas, limites: LIM }).compras.length, 1);
});

test('fronteira: paga à meia-noite de Brasília do dia seguinte fica fora', () => {
  const linhas = [linha({ venda: 1, at: LIM.ate }), linha({ venda: 2, at: LIM.desde })];
  const r = contarComprasDoPeriodo({ linhas, limites: LIM });
  assert.deepEqual(r.compras.map((c) => c.entity_id), [2]);
});

test('teste interno não conta nem soma como ilegível', () => {
  const linhas = [linha({ venda: 1, email: ' MarcelleFernandesDeMesquita@gmail.com ' })];
  const r = contarComprasDoPeriodo({ linhas, limites: LIM });
  assert.equal(r.compras.length, 0);
  assert.equal(r.ilegiveis, 0);
});

test('payload ilegível não conta e soma em ilegíveis', () => {
  const linhas = [linha({ venda: 1, raw: '{quebrado' }), linha({ venda: 2, raw: 'null' }), linha({ venda: 3 })];
  const r = contarComprasDoPeriodo({ linhas, limites: LIM });
  assert.equal(r.compras.length, 1);
  assert.equal(r.ilegiveis, 2);
});

test('avisos: ilegíveis, silêncio desde antes do início e tabela vazia', () => {
  assert.deepEqual(avisosGreenn({ ilegiveis: 2, ultimoEventoUnix: DENTRO, limites: LIM }), ['2 registros da Greenn não puderam ser lidos.']);
  assert.deepEqual(avisosGreenn({ ilegiveis: 0, ultimoEventoUnix: LIM.desde - 3 * 86400 + 7200, limites: LIM }), [
    'Nenhum evento da Greenn desde 11/09/2026 02:00.',
  ]);
  assert.deepEqual(avisosGreenn({ ultimoEventoUnix: LIM.desde, limites: LIM }), []);
  assert.deepEqual(avisosGreenn({ ultimoEventoUnix: null, limites: LIM }), [AVISO_GREENN_SEM_EVENTO_NUNCA]);
});

function dbFalso(respostas) {
  const chamadas = [];
  return {
    chamadas,
    prepare(sql) {
      const c = { sql, binds: [] };
      chamadas.push(c);
      return {
        bind(...b) { c.binds = b; return this; },
        async all() { return { results: respostas(sql, c.binds) }; },
        async first() { return (respostas(sql, c.binds) || [])[0] || null; },
      };
    },
  };
}

test('leitura: candidatas por período, histórico em lotes de 50, último evento', async () => {
  const ids = Array.from({ length: 120 }, (_, i) => ({ entity_id: i + 1 }));
  const db = dbFalso((sql, binds) => {
    if (sql.includes('DISTINCT')) return ids;
    if (sql.includes('MAX(received_at)')) return [{ ultimo: 123 }];
    return binds.map((id) => linha({ venda: id }));
  });
  const r = await lerVendasGreennDoPeriodo(db, LIM);
  assert.equal(r.linhas.length, 120);
  assert.equal(r.ultimoEventoUnix, 123);
  const lotes = db.chamadas.filter((c) => c.sql.includes('entity_id IN'));
  assert.deepEqual(lotes.map((c) => c.binds.length), [50, 50, 20]);
  const cand = db.chamadas.find((c) => c.sql.includes('DISTINCT'));
  assert.deepEqual(cand.binds, [LIM.desde, LIM.ate]);
});

test('leitura: sem candidatas não lê o histórico', async () => {
  const db = dbFalso((sql) => (sql.includes('MAX') ? [{ ultimo: null }] : []));
  const r = await lerVendasGreennDoPeriodo(db, LIM);
  assert.deepEqual(r.linhas, []);
  assert.equal(r.ultimoEventoUnix, null);
  assert.equal(db.chamadas.filter((c) => c.sql.includes('entity_id IN')).length, 0);
});

// Issue 262 — origem da venda.
const sess = (trk, utm = {}) => ({ trk, utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '', utm_term: '', ...utm });

test('origem: dado real de 14/09 — 2 disparo e 1 sem rastreio', () => {
  const compras = [{ trk: '' }, { trk: '99d1569c' }, { trk: '92162f98' }];
  const sessoes = [
    sess('99d1569c', { utm_source: 'disparo-api', utm_medium: 'virada-lote-quarta', utm_content: 'disparo-dia14-09' }),
    sess('92162f98', { utm_source: 'disparo-api', utm_medium: 'virada-lote-quarta', utm_content: 'disparo-dia14-09' }),
  ];
  assert.deepEqual(contarPorOrigem(compras, sessoes), { trafego_pago: 0, disparo: 2, outra_origem: 0, sem_rastreio: 1 });
});

test('origem: tráfego pago pela regra de canal, outra origem e sem rastreio', () => {
  assert.equal(classificarOrigem(sess('a', { utm_source: ' FacebookAds ', utm_medium: 'cpc' })), 'trafego_pago');
  assert.equal(classificarOrigem(sess('a', { utm_source: ' Disparo-API ' })), 'disparo');
  assert.equal(classificarOrigem(sess('a', { utm_source: 'organico', utm_medium: 'instagram' })), 'outra_origem');
  assert.equal(classificarOrigem(sess('a', { utm_campaign: 'bioperfil' })), 'outra_origem');
  assert.equal(classificarOrigem(sess('a')), 'sem_rastreio');
  assert.equal(classificarOrigem(null), 'sem_rastreio');
});

test('origem: trk órfão é sem rastreio e a soma bate com o total', () => {
  const compras = [{ trk: 'orfao' }, { trk: 'x' }, { trk: 'x' }, { trk: '' }, { trk: 'y' }];
  const sessoes = [sess('x', { utm_source: 'facebookads' }), sess('y', { utm_source: 'email' })];
  const r = contarPorOrigem(compras, sessoes);
  assert.deepEqual(r, { trafego_pago: 2, disparo: 0, outra_origem: 1, sem_rastreio: 2 });
  assert.equal(Object.values(r).reduce((a, b) => a + b, 0), compras.length);
  assert.deepEqual(contarPorOrigem([], []), { trafego_pago: 0, disparo: 0, outra_origem: 0, sem_rastreio: 0 });
});

test('sessões: só trks não vazios e distintos, em lotes; sem trk não lê', async () => {
  const trks = Array.from({ length: 60 }, (_, i) => `t${i}`);
  const db = dbFalso((sql, binds) => binds.map((trk) => sess(trk)));
  const r = await lerSessoesCheckout(db, [...trks, '', 't0', null]);
  assert.equal(r.length, 60);
  assert.deepEqual(db.chamadas.map((c) => c.binds.length), [50, 10]);
  const vazio = dbFalso(() => []);
  assert.deepEqual(await lerSessoesCheckout(vazio, ['', null]), []);
  assert.equal(vazio.chamadas.length, 0);
});
