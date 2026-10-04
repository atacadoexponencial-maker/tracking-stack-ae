// Fluxos: números nos cartões e histórico do contato (issue 388). O fluxo roda
// pelo motor de verdade (386) e os números saem do caminho gravado.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { bancoDosFluxos, d1 } from './_fluxos-banco.js';
import * as fluxosApi from '../functions/api/email/fluxos.js';
import * as contatosApi from '../functions/api/email/contatos.js';
import { rodar } from '../functions/api/_email-motor.js';
import { registrarLead } from '../functions/api/_email-contatos.js';

let db, env, pm;
const T0 = Math.floor(Date.now() / 1000);

beforeEach(() => {
  db = bancoDosFluxos();
  db.prepare(`INSERT INTO email_modelos (id, nome, canal, assunto, previa, corpo, arquivado, criado_em, atualizado_em) VALUES
    (1, 'E-mail 1', 'marketing', 'Primeiro', '', 'x', 0, 0, 0), (2, 'Sim', 'marketing', 'Abriu', '', 'x', 0, 0, 0), (3, 'Não', 'marketing', 'Não abriu', '', 'x', 0, 0, 0)`).run();
  env = { DB: d1(db), DASH_KEY: 'k', POSTMARK_SERVER_TOKEN: 'srv' };
  pm = { recusar: new Set(), n: 0 };
  globalThis.fetch = async (url, op = {}) => {
    const c = JSON.parse(op.body);
    if (pm.recusar.has(c.To)) return new Response(JSON.stringify({ ErrorCode: 406, Message: 'x' }), { status: 422 });
    return new Response(JSON.stringify({ ErrorCode: 0, MessageID: `m${++pm.n}`, To: c.To }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
});

const fx = (corpo, qs = '') => (corpo
  ? fluxosApi.onRequestPost({ request: new Request(`https://x/api?key=k${qs}`, { method: 'POST', body: JSON.stringify(corpo) }), env })
  : fluxosApi.onRequestGet({ request: new Request(`https://x/api?key=k${qs}`), env })).then(async (r) => ({ status: r.status, corpo: await r.json() }));

/** início → e-mail 1 → espera até abrir (2 dias) → aconteceu: desvio (abriu?) sim/não → e-mails → fim; não aconteceu → fim */
const GRAFO = {
  nos: [
    { id: 'n1', tipo: 'inicio', x: 0, y: 0, dados: { gatilhos: [{ evento: 'formulario', filtros: [] }] } },
    { id: 'n2', tipo: 'email', x: 0, y: 0, dados: { modelo: 1 } },
    { id: 'n3', tipo: 'espera', x: 0, y: 0, dados: { modo: 'evento', evento: 'abriu', ref: 'n2', prazo: 2, unidade: 'dias', janela: { ligada: false } } },
    { id: 'n4', tipo: 'desvio', x: 0, y: 0, dados: { juncao: 'e', condicoes: [{ tipo: 'clicou', ref: 'n2' }] } },
    { id: 'n5', tipo: 'email', x: 0, y: 0, dados: { modelo: 2 } },
    { id: 'n6', tipo: 'email', x: 0, y: 0, dados: { modelo: 3 } },
    { id: 'n7', tipo: 'fim', x: 0, y: 0, dados: {} },
  ],
  arestas: [['n1', 'proximo', 'n2'], ['n2', 'proximo', 'n3'], ['n3', 'aconteceu', 'n4'], ['n3', 'nao_aconteceu', 'n7'], ['n4', 'sim', 'n5'], ['n4', 'nao', 'n6'], ['n5', 'proximo', 'n7'], ['n6', 'proximo', 'n7']]
    .map(([de, saida, para], i) => ({ id: `a${i}`, de, saida, para })),
  notas: [],
};

async function lead(email) {
  db.prepare("INSERT INTO sessions (session_id, landing_url) VALUES (?, 'https://x.com/')").run(email);
  db.prepare("INSERT INTO event_log (session_id, event_name, event_id, timestamp, raw_email, funnel) VALUES (?, 'Lead', ?, ?, ?, 'workshop')").run(email, email, T0 + 10, email);
  await registrarLead(env, { email, nome: email.split('@')[0], funil: 'workshop', eventId: email, quando: T0 + 10 });
}
const abriu = (email, clicou = false) => db.prepare(`UPDATE email_envios SET aberto_em = 1${clicou ? ', clicado_em = 2' : ''} WHERE destinatario = ? AND assunto = 'Primeiro'`).run(email);

/** Ana abre e clica; Bia abre; Caio não abre; Davi teve o e-mail recusado. */
async function cenario() {
  const c = await fx({ acao: 'criar', nome: 'Boas-vindas' });
  const id = c.corpo.fluxo.id;
  await fx({ acao: 'salvar', id, nome: 'Boas-vindas', grafo: GRAFO, versao: 1 });
  await fx({ acao: 'publicar', id });
  db.prepare('UPDATE email_fluxos SET publicado_em = ? WHERE id = ?').run(T0, id);
  pm.recusar.add('davi@x.com');
  for (const e of ['ana@x.com', 'bia@x.com', 'caio@x.com', 'davi@x.com']) await lead(e);
  await rodar(env, T0 + 60);
  abriu('ana@x.com', true);
  abriu('bia@x.com');
  await rodar(env, T0 + 120);
  return id;
}

test('números por cartão: entraram, receberam/abriram/clicaram, aconteceu, sim/não, esperando, concluíram', async () => {
  const id = await cenario();
  const r = await fx(null, `&id=${id}&numeros=30`);
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  const c = r.corpo.cartoes;
  assert.deepEqual(c.n1, { entraram: 4 });
  assert.deepEqual(c.n2, { receberam: 3, abriram: 2, clicaram: 1 }, 'o recusado não conta em receberam');
  assert.deepEqual(c.n3, { esperando: 2, aconteceu: 2, nao_aconteceu: 0 });
  assert.deepEqual(c.n4, { sim: 1, nao: 1 });
  assert.deepEqual([c.n5.receberam, c.n6.receberam], [1, 1]);
  assert.deepEqual(c.n7, { concluiram: 2 });
  // Período: daqui a 40 dias, os 30 dias não pegam nada; "desde o início" pega tudo.
  const futuro = await import('../functions/api/_email-fluxos-numeros.js');
  const vazio = await futuro.numerosDoFluxo(env, id, '30', T0 + 40 * 86400);
  assert.deepEqual([vazio.cartoes.n1.entraram, vazio.cartoes.n3.esperando], [0, 2], 'esperando é sempre agora');
  assert.equal((await futuro.numerosDoFluxo(env, id, 'tudo', T0 + 40 * 86400)).cartoes.n1.entraram, 4);
});

test('quem está dentro: por cartão, com página; tirar do fluxo', async () => {
  const id = await cenario();
  let r = await fx(null, `&id=${id}&pessoas=1&no=n3`);
  assert.deepEqual(r.corpo.pessoas.map((p) => p.email).sort(), ['caio@x.com', 'davi@x.com']);
  assert.equal(r.corpo.total, 2);
  const caio = db.prepare("SELECT id FROM email_contatos WHERE email = 'caio@x.com'").get().id;
  assert.equal((await fx({ acao: 'tirar', id, contato_id: caio })).status, 200);
  assert.equal((await fx({ acao: 'tirar', id, contato_id: caio })).status, 409);
  r = await fx(null, `&id=${id}&pessoas=1`);
  assert.deepEqual(r.corpo.pessoas.map((p) => p.email), ['davi@x.com']);
});

test('totais na lista: dentro agora, concluíram e taxa de clique', async () => {
  const id = await cenario();
  const r = await fx(null);
  const f = r.corpo.fluxos.find((x) => x.id === id);
  assert.deepEqual(f.totais, { dentro: 2, concluiram: 2, clique: 1 / 3 });
});

test('caminho no detalhe do contato', async () => {
  await cenario();
  const ana = db.prepare("SELECT id FROM email_contatos WHERE email = 'ana@x.com'").get().id;
  const det = await (await contatosApi.onRequestGet({ request: new Request(`https://x/api?key=k&id=${ana}`), env })).json();
  const c = det.fluxos[0].caminho;
  assert.deepEqual(c.map((p) => p.tipo), ['entrou', 'email', 'espera', 'espera', 'desvio', 'email', 'fim']);
  assert.deepEqual([c[1].assunto, c[1].aberto, c[1].clicado], ['Primeiro', 1, 1]);
  assert.equal(c[4].saida, 'sim');
});

test('rascunho e fluxo inexistente', async () => {
  const c = await fx({ acao: 'criar', nome: 'Novo' });
  const r = await fx(null, `&id=${c.corpo.fluxo.id}&numeros=30`);
  assert.deepEqual(r.corpo.cartoes, {});
  assert.equal((await fx(null, '&id=999&numeros=30')).status, 404);
});
