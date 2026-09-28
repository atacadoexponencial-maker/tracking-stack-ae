// Metas mensais por funil (issue 333) contra SQLite real com as migrations
// 0039 (funis_relatorio) e 0046 (metas_funil).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  validarMeta, metaVigente, montarCadastro, mesBrt, MAX_CENTAVOS, ERRO_CONCORRENCIA, MOTIVO_BLOQUEIO,
} from '../functions/api/_metas.js';
import { onRequestGet, onRequestPost } from '../functions/api/metas/index.js';

function d1(db) {
  const conv = (b) => b.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
  const stmt = (sql, binds = []) => ({
    bind: (...b) => stmt(sql, conv(b)),
    all: async () => ({ results: db.prepare(sql).all(...binds) }),
    first: async () => db.prepare(sql).get(...binds) ?? null,
    run: async () => { const r = db.prepare(sql).run(...binds); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
  });
  return { prepare: (sql) => stmt(sql) };
}

function novoBanco() {
  const db = new DatabaseSync(':memory:');
  for (const m of ['0039_funis_relatorio.sql', '0046_metas_funil.sql']) {
    db.exec(readFileSync(new URL(`../migrations/${m}`, import.meta.url), 'utf8'));
  }
  const ins = db.prepare(`INSERT INTO funis_relatorio (id, nome, tipo, funil_tracking, opcoes_crm, origem_lead, situacao, posicao, criado_em, alterado_em)
                          VALUES (?, ?, ?, ?, '[]', ?, 'ativo', ?, 1, 1)`);
  ins.run(1, 'SE', 'lead_mql', 'sessao-estrategica', 'trafego_pago', 1);
  ins.run(2, 'LIVE', 'manual', 'lives-semanais-v1', null, 2);
  ins.run(4, 'AQUISIÇÃO', 'lead_mql', 'aquisicao', 'exceto_trafego_pago', 4);
  return db;
}

const META = { cpl_max_centavos: 9000, leads_novos: 70, mqls: 35, custo_mql_max_centavos: 18000 };
const pedir = (metodo, corpo, key = 'k') => new Request(`https://x/api/metas?key=${key}`, {
  method: metodo, ...(corpo ? { body: JSON.stringify(corpo), headers: { 'content-type': 'application/json' } } : {}),
});

test('validação: quatro campos, null = sem meta, inteiros não negativos dentro do teto', () => {
  assert.equal(validarMeta(META).ok, true);
  assert.equal(validarMeta({ ...META, mqls: null }).ok, true);
  const r = validarMeta({ cpl_max_centavos: 90.5, leads_novos: -1, mqls: '3', custo_mql_max_centavos: MAX_CENTAVOS + 1, extra: 1 });
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.campos).sort(), ['cpl_max_centavos', 'custo_mql_max_centavos', 'extra', 'leads_novos', 'mqls']);
  assert.equal(validarMeta({ cpl_max_centavos: 1 }).campos.leads_novos, 'campo ausente');
  assert.equal(validarMeta(null).ok, false);
});

test('vigência: a última linha com mês de início até o mês vale; meses passados ficam com a deles', () => {
  const linhas = [
    { id: 1, mes_inicio: '2026-08', leads_novos: 60 },
    { id: 2, mes_inicio: '2026-09', leads_novos: 70 },
    { id: 3, mes_inicio: '2026-09', leads_novos: 75 },
  ];
  assert.equal(metaVigente(linhas, '2026-07'), null);
  assert.equal(metaVigente(linhas, '2026-08').leads_novos, 60);
  assert.equal(metaVigente(linhas, '2026-09').leads_novos, 75); // salvar de novo no mês vale para o mês inteiro
  assert.equal(metaVigente(linhas, '2026-12').leads_novos, 75); // repete até mudar
});

test('cadastro: só funis de lead ativos, SE editável, outros com o motivo; histórico com antes e depois', () => {
  const c = montarCadastro({
    funis: [
      { id: 4, nome: 'AQUISIÇÃO', tipo: 'lead_mql', funil_tracking: 'aquisicao', situacao: 'ativo', posicao: 4 },
      { id: 2, nome: 'LIVE', tipo: 'manual', funil_tracking: 'lives', situacao: 'ativo', posicao: 2 },
      { id: 1, nome: 'SE', tipo: 'lead_mql', funil_tracking: 'sessao-estrategica', situacao: 'ativo', posicao: 1 },
    ],
    linhas: [
      { id: 1, funil_id: 1, mes_inicio: '2026-08', ...META, leads_novos: 60, alterada_em: 1785000000, alterada_por: 'painel' },
      { id: 2, funil_id: 1, mes_inicio: '2026-09', ...META, alterada_em: 1789000000, alterada_por: 'painel' },
    ],
    mes: '2026-09',
  });
  assert.deepEqual(c.funis.map((f) => f.nome), ['SE', 'AQUISIÇÃO']);
  const [se, aq] = c.funis;
  assert.equal(se.editavel, true);
  assert.equal(se.meta.leads_novos, 70);
  assert.equal(se.vigente_desde, '2026-09');
  assert.equal(se.versao, 2);
  assert.equal(se.historico.length, 2);
  assert.equal(se.historico[0].antes.leads_novos, 60);
  assert.equal(se.historico[0].depois.leads_novos, 70);
  assert.equal(se.historico[1].antes.leads_novos, null);
  assert.equal(aq.editavel, false);
  assert.equal(aq.motivo_bloqueio, MOTIVO_BLOQUEIO);
  assert.equal(aq.meta, null);
  assert.equal(aq.versao, null);
});

test('mês em Brasília: 1º de outubro às 01h de Brasília ainda é outubro; 23h UTC do dia 30/09 é setembro', () => {
  assert.equal(mesBrt(Date.parse('2026-10-01T04:00:00Z') / 1000), '2026-10');
  assert.equal(mesBrt(Date.parse('2026-10-01T02:00:00Z') / 1000), '2026-09');
});

test('endpoint: 401 sem chave, GET vazio, POST grava, GET devolve, histórico cresce', async () => {
  const db = novoBanco();
  const env = { DB: d1(db), DASH_KEY: 'k' };
  assert.equal((await onRequestGet({ request: pedir('GET', null, 'errada'), env })).status, 401);
  let c = await (await onRequestGet({ request: pedir('GET'), env })).json();
  assert.equal(c.funis.find((f) => f.funil_id === 1).meta, null);

  const r1 = await onRequestPost({ request: pedir('POST', { funil_id: 1, meta: META, versao: null }), env });
  assert.equal(r1.status, 200);
  const salvo = await r1.json();
  assert.equal(salvo.meta.cpl_max_centavos, 9000);
  assert.equal(salvo.historico.length, 1);

  const r2 = await onRequestPost({ request: pedir('POST', { funil_id: 1, meta: { ...META, leads_novos: 80 }, versao: salvo.versao }), env });
  assert.equal(r2.status, 200);
  c = await (await onRequestGet({ request: pedir('GET'), env })).json();
  const se = c.funis.find((f) => f.funil_id === 1);
  assert.equal(se.meta.leads_novos, 80);
  assert.equal(se.historico.length, 2);
});

test('endpoint: versão velha é recusada com 409; funil bloqueado 403; inválido 400 com campos', async () => {
  const db = novoBanco();
  const env = { DB: d1(db), DASH_KEY: 'k' };
  const a = await (await onRequestPost({ request: pedir('POST', { funil_id: 1, meta: META, versao: null }), env })).json();
  await onRequestPost({ request: pedir('POST', { funil_id: 1, meta: META, versao: a.versao }), env });
  const velho = await onRequestPost({ request: pedir('POST', { funil_id: 1, meta: META, versao: a.versao }), env });
  assert.equal(velho.status, 409);
  assert.equal((await velho.json()).erro, ERRO_CONCORRENCIA);
  assert.equal((await onRequestPost({ request: pedir('POST', { funil_id: 4, meta: META, versao: null }), env })).status, 403);
  assert.equal((await onRequestPost({ request: pedir('POST', { funil_id: 2, meta: META, versao: null }), env })).status, 403);
  assert.equal((await onRequestPost({ request: pedir('POST', { funil_id: 99, meta: META, versao: null }), env })).status, 404);
  const ruim = await onRequestPost({ request: pedir('POST', { funil_id: 1, meta: { ...META, mqls: -2 }, versao: 2 }), env });
  assert.equal(ruim.status, 400);
  assert.ok((await ruim.json()).campos.mqls);
});

test('histórico imutável: UPDATE e DELETE recusados pelo banco', () => {
  const db = novoBanco();
  db.prepare(`INSERT INTO metas_funil (funil_id, mes_inicio, leads_novos, alterada_em, alterada_por) VALUES (1, '2026-09', 70, 1, 'painel')`).run();
  assert.throws(() => db.prepare('UPDATE metas_funil SET leads_novos = 1').run(), /histórico/);
  assert.throws(() => db.prepare('DELETE FROM metas_funil').run(), /histórico/);
  assert.throws(() => db.prepare(`INSERT INTO metas_funil (funil_id, mes_inicio, alterada_em, alterada_por) VALUES (1, '2026-9', 1, 'p')`).run());
});
