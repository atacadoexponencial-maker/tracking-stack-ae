// Fluxos: quadro e rascunho (issue 385) contra SQLite real (migrations 0050,
// 0051, 0053–0057). Opções que dependem de tabelas antigas ausentes ficam
// vazias, como na prévia quando uma fonte falha.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import * as fluxosApi from '../functions/api/email/fluxos.js';
import * as modelosApi from '../functions/api/email/modelos.js';
import * as segApi from '../functions/api/email/segmentos.js';
import { normalizarGrafo } from '../functions/api/_email-fluxos.js';

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

let db, env;

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  for (const f of ['0050_email.sql', '0051_email_modelos.sql', '0053_email_contatos.sql', '0054_email_segmentos.sql', '0055_email_campanhas.sql', '0056_email_campanhas_agendadas.sql', '0057_email_fluxos.sql']) {
    db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  }
  db.prepare(`INSERT INTO email_modelos (id, nome, canal, assunto, previa, corpo, arquivado, criado_em, atualizado_em) VALUES
    (1, 'Boas-vindas 1', 'marketing', 'Oi', '', 'Corpo', 0, 0, 0),
    (2, 'Boas-vindas 2', 'marketing', 'Oi de novo', '', 'Corpo', 0, 0, 0),
    (3, 'Incompleto', 'marketing', '', '', '', 0, 0, 0),
    (4, 'Velho', 'marketing', 'a', '', 'b', 1, 0, 0),
    (5, 'Agenda', 'transacional', 'a', '', 'b', 0, 0, 0)`).run();
  env = { DB: d1(db), DASH_KEY: 'k' };
});

const api = (mod, corpo, qs = '') => (corpo
  ? mod.onRequestPost({ request: new Request(`https://x/api?key=k${qs}`, { method: 'POST', body: JSON.stringify(corpo) }), env })
  : mod.onRequestGet({ request: new Request(`https://x/api?key=k${qs}`), env })).then(async (r) => ({ status: r.status, corpo: await r.json() }));
const fx = (corpo, qs) => api(fluxosApi, corpo, qs);

/** O fluxo do "pronto quando": gatilho filtrado, dois e-mails, espera, desvio e objetivo. */
function grafoCompleto() {
  const j = { ligada: true, de: '08:00', ate: '20:00' };
  return {
    nos: [
      { id: 'n1', tipo: 'inicio', x: 40, y: 150, dados: { gatilhos: [{ evento: 'formulario', filtros: [{ campo: 'funil', valor: 'workshop' }] }] } },
      { id: 'n2', tipo: 'email', x: 360, y: 150, dados: { modelo: 1 } },
      { id: 'n3', tipo: 'espera', x: 680, y: 150, dados: { modo: 'tempo', qtd: 1, unidade: 'dias', janela: j } },
      { id: 'n4', tipo: 'desvio', x: 1000, y: 150, dados: { juncao: 'e', condicoes: [{ tipo: 'abriu', ref: 'n2' }] } },
      { id: 'n5', tipo: 'email', x: 1330, y: 20, dados: { modelo: 2 } },
      { id: 'n6', tipo: 'fim', x: 1330, y: 330, dados: {} },
      { id: 'n7', tipo: 'objetivo', x: 1660, y: 170, dados: { evento: 'agendou', filtro: '' } },
      { id: 'n8', tipo: 'fim', x: 1990, y: 200, dados: {} },
    ],
    arestas: [
      { id: 'a1', de: 'n1', saida: 'proximo', para: 'n2' }, { id: 'a2', de: 'n2', saida: 'proximo', para: 'n3' },
      { id: 'a3', de: 'n3', saida: 'proximo', para: 'n4' }, { id: 'a4', de: 'n4', saida: 'sim', para: 'n5' },
      { id: 'a5', de: 'n4', saida: 'nao', para: 'n6' }, { id: 'a6', de: 'n5', saida: 'proximo', para: 'n7' },
      { id: 'a7', de: 'n7', saida: 'proximo', para: 'n8' },
    ],
    notas: [{ id: 'o1', x: 600, y: 400, texto: 'Quem agendar pula para o objetivo.' }],
  };
}
async function novo() {
  const r = await fx({ acao: 'criar', nome: 'Boas-vindas do workshop' });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  return r.corpo.fluxo;
}

test('criar abre com o início e o problema "sem gatilho"', async () => {
  const f = await novo();
  assert.equal(f.situacao, 'rascunho');
  assert.deepEqual(f.grafo.nos.map((n) => n.tipo), ['inicio']);
  assert.deepEqual(f.problemas, [{ no: 'n1', textos: ['Sem gatilho', 'Saída sem destino'] }]);
});

test('salvar e reabrir: tudo igual, sem problemas, versão sobe', async () => {
  const f = await novo();
  const r = await fx({ acao: 'salvar', id: f.id, nome: 'Boas-vindas WO', grafo: grafoCompleto(), versao: f.versao });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  assert.deepEqual([r.corpo.versao, r.corpo.problemas], [2, []]);
  const g = (await fx(null, `&id=${f.id}`)).corpo;
  assert.equal(g.fluxo.nome, 'Boas-vindas WO');
  assert.deepEqual(g.fluxo.grafo, normalizarGrafo(grafoCompleto()));
  assert.equal(g.fluxo.grafo.notas[0].texto, 'Quem agendar pula para o objetivo.');
  assert.ok(g.opcoes.pagina.some(([p]) => p === '/workshop-gratuito'));
  assert.ok(g.opcoes.material.length > 0);
  assert.deepEqual(g.opcoes.produto, [], 'fonte ausente fica vazia');
});

test('duas abas: a versão antiga é recusada sem gravar', async () => {
  const f = await novo();
  await fx({ acao: 'salvar', id: f.id, nome: 'A', grafo: grafoCompleto(), versao: 1 });
  const r = await fx({ acao: 'salvar', id: f.id, nome: 'B', grafo: grafoCompleto(), versao: 1 });
  assert.equal(r.status, 409);
  assert.match(r.corpo.error, /outra aba/);
  assert.equal((await fx(null, `&id=${f.id}`)).corpo.fluxo.nome, 'A');
});

test('estrutura inválida é recusada', async () => {
  const f = await novo();
  const ruins = [
    (g) => { g.nos.push({ id: 'n9', tipo: 'inicio', x: 0, y: 0, dados: { gatilhos: [] } }); },
    (g) => { g.nos.push({ id: 'n2', tipo: 'fim', x: 0, y: 0 }); },
    (g) => { g.nos[1].tipo = 'sms'; },
    (g) => { g.arestas.push({ id: 'a9', de: 'n2', saida: 'proximo', para: 'nada' }); },
    (g) => { g.arestas.push({ id: 'a9', de: 'n2', saida: 'proximo', para: 'n4' }); },
    (g) => { g.arestas.push({ id: 'a9', de: 'n3', saida: 'aconteceu', para: 'n4' }); },
    (g) => { g.nos[0].dados.gatilhos[0].evento = 'tempo'; },
    (g) => { g.nos[0].dados.gatilhos[0].filtros[0].campo = 'produto'; },
    (g) => { g.nos = g.nos.concat(Array.from({ length: 200 }, (_, i) => ({ id: `x${i}`, tipo: 'fim', x: 0, y: 0 }))); },
  ];
  for (const mexer of ruins) {
    const g = grafoCompleto();
    mexer(g);
    const r = await fx({ acao: 'salvar', id: f.id, nome: 'x', grafo: g, versao: 1 });
    assert.equal(r.status, 400, mexer.toString());
  }
});

test('problemas: solto, saída sem destino, sem modelo, incompleto, arquivado, desvio e referência', async () => {
  const f = await novo();
  const g = grafoCompleto();
  g.nos[1].dados.modelo = 3;              // incompleto
  g.nos[4].dados.modelo = 4;              // arquivado
  g.nos.push({ id: 'n9', tipo: 'email', x: 0, y: 600, dados: { modelo: 5 } }); // transacional = sem modelo, e solto
  g.nos[3].dados.condicoes = [];          // desvio sem condição
  g.arestas = g.arestas.filter((a) => a.id !== 'a5'); // saída "não" sem destino
  g.nos.push({ id: 'n10', tipo: 'espera', x: 0, y: 800, dados: { modo: 'evento', evento: 'abriu', ref: 'zz', prazo: 2 } });
  g.arestas.push({ id: 'a10', de: 'n9', saida: 'proximo', para: 'n10' });
  const r = await fx({ acao: 'salvar', id: f.id, nome: 'x', grafo: g, versao: 1 });
  const p = Object.fromEntries(r.corpo.problemas.map((x) => [x.no, x.textos]));
  assert.deepEqual(p.n2, ['Modelo incompleto']);
  assert.deepEqual(p.n5, ['Modelo arquivado']);
  assert.deepEqual(p.n9, ['Sem modelo', 'Solto']);
  assert.deepEqual(p.n4, ['Sem condição', 'Saída sem destino']);
  assert.deepEqual(p.n10, ['Sem e-mail de referência', 'Solto', 'Saídas sem destino']);
  assert.equal(p.n7, undefined, 'objetivo não é solto: a pessoa pula para ele');
});

test('ir para outro fluxo: destino arquivado ou o próprio fluxo é problema', async () => {
  const a = await novo();
  const b = await novo();
  const g = { nos: [{ id: 'n1', tipo: 'inicio', x: 0, y: 0, dados: { gatilhos: [{ evento: 'crm', filtros: [] }] } }, { id: 'n2', tipo: 'ir_fluxo', x: 300, y: 0, dados: { fluxo: b.id } }], arestas: [{ id: 'a1', de: 'n1', saida: 'proximo', para: 'n2' }], notas: [] };
  let r = await fx({ acao: 'salvar', id: a.id, nome: 'A', grafo: g, versao: 1 });
  assert.deepEqual(r.corpo.problemas, []);
  await fx({ acao: 'arquivar', id: b.id });
  assert.deepEqual((await fx(null, `&id=${a.id}`)).corpo.fluxo.problemas, [{ no: 'n2', textos: ['Sem fluxo de destino'] }]);
  g.nos[1].dados.fluxo = a.id;
  r = await fx({ acao: 'salvar', id: a.id, nome: 'A', grafo: g, versao: 2 });
  assert.deepEqual(r.corpo.problemas, [{ no: 'n2', textos: ['Sem fluxo de destino'] }]);
});

test('lista, duplicar, arquivar e tirar do arquivo', async () => {
  const f = await novo();
  await fx({ acao: 'salvar', id: f.id, nome: 'Boas-vindas', grafo: grafoCompleto(), versao: 1 });
  const d = await fx({ acao: 'duplicar', id: f.id });
  assert.deepEqual([d.corpo.fluxo.nome, d.corpo.fluxo.situacao, d.corpo.fluxo.grafo.nos.length], ['Cópia de Boas-vindas', 'rascunho', 8]);
  await fx({ acao: 'arquivar', id: f.id });
  let l = await fx(null);
  assert.deepEqual([l.corpo.fluxos.map((x) => x.nome), l.corpo.arquivados], [['Cópia de Boas-vindas'], 1]);
  l = await fx(null, '&arquivados=1');
  assert.deepEqual(l.corpo.fluxos.map((x) => x.nome), ['Boas-vindas']);
  await fx({ acao: 'desarquivar', id: f.id });
  assert.equal((await fx(null)).corpo.fluxos.length, 2);
  assert.equal((await fx(null, '&id=999')).status, 404);
});

test('travas: modelo e segmento usados em fluxo não arquivado', async () => {
  const s = await api(segApi, { acao: 'salvar', nome: 'Todos', regras: [] });
  const sid = s.corpo.segmento.id;
  const f = await novo();
  const g = grafoCompleto();
  g.nos[3].dados.condicoes.push({ tipo: 'segmento', valor: String(sid) });
  await fx({ acao: 'salvar', id: f.id, nome: 'Boas-vindas', grafo: g, versao: 1 });
  const m = await api(modelosApi, { acao: 'arquivar', id: 2 });
  assert.equal(m.status, 409);
  assert.match(m.corpo.error, /fluxo "Boas-vindas"/);
  const e = await api(segApi, { acao: 'excluir', id: sid });
  assert.equal(e.status, 409);
  assert.match(e.corpo.error, /fluxo "Boas-vindas"/);
  await fx({ acao: 'arquivar', id: f.id });
  assert.equal((await api(modelosApi, { acao: 'arquivar', id: 2 })).status, 200, 'fluxo arquivado não trava');
});
