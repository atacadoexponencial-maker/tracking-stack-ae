// Motor dos fluxos (issue 386) contra SQLite real e um Postmark simulado.
// Os acontecimentos entram pela fonte de verdade (event_log), como na prévia.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { bancoDosFluxos, d1 } from './_fluxos-banco.js';
import * as fluxosApi from '../functions/api/email/fluxos.js';
import * as contatosApi from '../functions/api/email/contatos.js';
import * as syncFluxos from '../functions/api/sync/email-fluxos.js';
import { rodar, proximoDiaHora, dentroDaJanela } from '../functions/api/_email-motor.js';
import { registrarLead, aplicarResultado } from '../functions/api/_email-contatos.js';
import { inicioDoDiaBrt, ymdBrt } from '../functions/api/_data-brt.js';

let db, env, pm;
const T0 = Math.floor(Date.now() / 1000);

function postmarkFalso() {
  const estado = { envios: [], foraDoAr: false, n: 0 };
  estado.fetch = async (url, op = {}) => {
    const u = new URL(String(url));
    if (estado.foraDoAr) throw new TypeError('fetch failed');
    if (u.pathname === '/email') {
      const c = JSON.parse(op.body);
      const id = `msg-${++estado.n}`;
      estado.envios.push({ ...c, MessageID: id });
      return new Response(JSON.stringify({ ErrorCode: 0, MessageID: id, To: c.To }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error('fetch inesperado: ' + u);
  };
  return estado;
}

beforeEach(() => {
  db = bancoDosFluxos();
  db.prepare(`INSERT INTO email_modelos (id, nome, canal, assunto, previa, corpo, arquivado, criado_em, atualizado_em) VALUES
    (1, 'E-mail 1', 'marketing', 'Oi, {{primeiro_nome}}', '', 'Bem-vinda!', 0, 0, 0),
    (2, 'Abriu', 'marketing', 'Que bom que abriu', '', 'x', 0, 0, 0),
    (3, 'Não abriu', 'marketing', 'Você viu?', '', 'x', 0, 0, 0),
    (4, 'Objetivo', 'marketing', 'Reunião marcada', '', 'x', 0, 0, 0)`).run();
  env = { DB: d1(db), DASH_KEY: 'k', SYNC_SECRET: 's', POSTMARK_SERVER_TOKEN: 'srv' };
  pm = postmarkFalso();
  globalThis.fetch = pm.fetch;
});

const fx = (corpo, qs = '') => (corpo
  ? fluxosApi.onRequestPost({ request: new Request(`https://x/api?key=k${qs}`, { method: 'POST', body: JSON.stringify(corpo) }), env })
  : fluxosApi.onRequestGet({ request: new Request(`https://x/api?key=k${qs}`), env })).then(async (r) => ({ status: r.status, corpo: await r.json() }));

let nSessao = 0;
/** Lead pelo formulário (fonte de verdade) e contato de marketing. */
async function lead(email, { funil = 'workshop', ts = T0, nome = 'Ana Lima' } = {}) {
  const sid = `s${++nSessao}`;
  db.prepare("INSERT INTO sessions (session_id, landing_url) VALUES (?, 'https://atacadoexponencial.com/workshop-gratuito')").run(sid);
  const eid = `ev${nSessao}`;
  db.prepare("INSERT INTO event_log (session_id, event_name, event_id, timestamp, raw_email, funnel) VALUES (?, 'Lead', ?, ?, ?, ?)").run(sid, eid, ts, email, funil);
  await registrarLead(env, { email, nome, funil, eventId: eid, quando: ts });
}
const pessoa = (email, fluxo) => db.prepare('SELECT p.* FROM email_fluxo_pessoas p JOIN email_contatos c ON c.id = p.contato_id WHERE c.email = ? AND p.fluxo_id = ?').get(email, fluxo);
const assuntos = (email) => pm.envios.filter((m) => m.To === email).map((m) => m.Subject);
const caminho = (p) => db.prepare('SELECT tipo, no_id, saida FROM email_fluxo_passos WHERE pessoa_id = ? ORDER BY id').all(p.id).map((x) => `${x.tipo}:${x.no_id}${x.saida ? ':' + x.saida : ''}`);

/** O fluxo do "pronto quando": gatilho filtrado → e-mail 1 → espera 1 dia → desvio abriu? → sim/não; objetivo "agendou". */
function grafo({ espera = { modo: 'tempo', qtd: 1, unidade: 'dias', janela: { ligada: false } } } = {}) {
  return {
    nos: [
      { id: 'n1', tipo: 'inicio', x: 0, y: 0, dados: { gatilhos: [{ evento: 'formulario', filtros: [{ campo: 'funil', valor: 'workshop' }] }] } },
      { id: 'n2', tipo: 'email', x: 0, y: 0, dados: { modelo: 1 } },
      { id: 'n3', tipo: 'espera', x: 0, y: 0, dados: espera },
      { id: 'n4', tipo: 'desvio', x: 0, y: 0, dados: { juncao: 'e', condicoes: [{ tipo: 'abriu', ref: 'n2' }] } },
      { id: 'n5', tipo: 'email', x: 0, y: 0, dados: { modelo: 2 } },
      { id: 'n6', tipo: 'email', x: 0, y: 0, dados: { modelo: 3 } },
      { id: 'n7', tipo: 'objetivo', x: 0, y: 0, dados: { evento: 'agendou', filtro: '' } },
      { id: 'n8', tipo: 'email', x: 0, y: 0, dados: { modelo: 4 } },
      { id: 'n9', tipo: 'fim', x: 0, y: 0, dados: {} },
    ],
    arestas: [
      ['n1', 'proximo', 'n2'], ['n2', 'proximo', 'n3'], ['n3', espera.modo === 'evento' ? 'aconteceu' : 'proximo', 'n4'], ['n4', 'sim', 'n5'], ['n4', 'nao', 'n6'],
      ['n5', 'proximo', 'n9'], ['n6', 'proximo', 'n9'], ['n7', 'proximo', 'n8'], ['n8', 'proximo', 'n9'],
      ...(espera.modo === 'evento' ? [['n3', 'nao_aconteceu', 'n6']] : []),
    ].map(([de, saida, para], i) => ({ id: `a${i}`, de, saida, para })),
    notas: [],
  };
}
async function publicado(g = grafo(), t = T0) {
  const c = await fx({ acao: 'criar', nome: 'Boas-vindas' });
  const id = c.corpo.fluxo.id;
  const s = await fx({ acao: 'salvar', id, nome: 'Boas-vindas', grafo: g, versao: 1 });
  assert.deepEqual(s.corpo.problemas, [], JSON.stringify(s.corpo));
  const p = await fx({ acao: 'publicar', id });
  assert.equal(p.status, 200, JSON.stringify(p.corpo));
  db.prepare('UPDATE email_fluxos SET publicado_em = ? WHERE id = ?').run(t, id);
  return id;
}
const abrir = (email) => db.prepare("UPDATE email_envios SET aberto_em = 1, situacao = 'aberto' WHERE destinatario = ?").run(email);

test('pronto quando: entra pelo gatilho filtrado, e-mail 1, desvio conforme abriu, objetivo pula', async () => {
  await lead('ana@x.com', { ts: T0 - 3600 }); // antes de publicar: não entra
  const id = await publicado();
  await lead('bia@x.com', { ts: T0 + 10, nome: 'Bia Souza' });
  await lead('caio@x.com', { ts: T0 + 10 });
  await lead('davi@x.com', { ts: T0 + 10, funil: 'sessao-estrategica' }); // filtro: não entra
  await rodar(env, T0 + 60);
  assert.equal(pessoa('ana@x.com', id), undefined, 'sem puxar o passado');
  assert.equal(pessoa('davi@x.com', id), undefined, 'filtro do gatilho');
  assert.deepEqual(assuntos('bia@x.com'), ['Oi, Bia']);
  assert.equal(pessoa('bia@x.com', id).situacao, 'esperando');
  // Bia abre; Caio não. Um dia depois, o desvio manda cada um para um lado.
  abrir('bia@x.com');
  await rodar(env, T0 + 60 + 86400 + 60);
  assert.deepEqual(assuntos('bia@x.com'), ['Oi, Bia', 'Que bom que abriu']);
  assert.deepEqual(assuntos('caio@x.com'), ['Oi, Ana', 'Você viu?']);
  assert.equal(pessoa('bia@x.com', id).situacao, 'concluiu');
  assert.deepEqual(caminho(pessoa('bia@x.com', id)), ['entrou:n1', 'email:n2', 'espera:n3', 'espera:n3:proximo', 'desvio:n4:sim', 'email:n5', 'fim:n9']);
  const envio = db.prepare("SELECT origem, ref_id, canal FROM email_envios WHERE destinatario = 'bia@x.com' ORDER BY id").get();
  assert.deepEqual({ ...envio }, { origem: 'fluxo', ref_id: `${id}:n2`, canal: 'marketing' });
});

test('objetivo: quem agenda pula para ele de onde estiver', async () => {
  const id = await publicado();
  await lead('ana@x.com', { ts: T0 + 10 });
  await rodar(env, T0 + 60);
  assert.equal(pessoa('ana@x.com', id).no_atual, 'n3');
  db.prepare("INSERT INTO agenda_grades (id, nome, faixas_json, criado_em, atualizado_em) VALUES (1, 'G', '{}', 0, 0)").run();
  db.prepare("INSERT INTO agenda_tipos (id, slug, nome, duracao_min, destino_cal, grade_id, criado_em, atualizado_em) VALUES (1, 's', 'S', 45, 'c', 1, 0, 0)").run();
  db.prepare("INSERT INTO agenda_reunioes (id, tipo_id, inicio, fim, nome, email, token_gestao, criado_em, atualizado_em) VALUES ('r1', 1, 1, 2, 'Ana', 'ana@x.com', 't', 0, 0)").run();
  db.prepare("INSERT INTO agenda_historico (reuniao_id, acao, por, criado_em) VALUES ('r1', 'agendou', 'lead', ?)").run(T0 + 100);
  await rodar(env, T0 + 120);
  assert.deepEqual(assuntos('ana@x.com'), ['Oi, Ana', 'Reunião marcada']);
  assert.equal(pessoa('ana@x.com', id).situacao, 'concluiu');
});

test('não entra duas vezes, nem depois de concluir', async () => {
  const id = await publicado();
  await lead('ana@x.com', { ts: T0 + 10 });
  await lead('ana@x.com', { ts: T0 + 20 });
  await rodar(env, T0 + 60);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM email_fluxo_pessoas WHERE fluxo_id = ?').get(id).n, 1);
  assert.deepEqual(assuntos('ana@x.com'), ['Oi, Ana']);
});

test('espera até algo acontecer: abriu solta por "aconteceu"; prazo vencido vai por "não aconteceu"', async () => {
  const id = await publicado(grafo({ espera: { modo: 'evento', evento: 'abriu', ref: 'n2', prazo: 2, unidade: 'dias', janela: { ligada: false } } }));
  await lead('ana@x.com', { ts: T0 + 10 });
  await lead('bia@x.com', { ts: T0 + 10 });
  await rodar(env, T0 + 60);
  abrir('ana@x.com');
  await rodar(env, T0 + 120);
  assert.deepEqual(assuntos('ana@x.com'), ['Oi, Ana', 'Que bom que abriu']);
  assert.equal(pessoa('bia@x.com', id).situacao, 'esperando');
  await rodar(env, T0 + 60 + 2 * 86400 + 60);
  assert.deepEqual(assuntos('bia@x.com'), ['Oi, Ana', 'Você viu?']);
});

test('espera até dia e hora e janela de envio (Brasília)', () => {
  // sábado 03/10/2026 15:00 BRT → próxima terça 09:00 BRT (06/10, 12:00 UTC)
  const t = Date.parse('2026-10-03T18:00:00Z') / 1000;
  assert.equal(proximoDiaHora(t, '2', '09:00'), Date.parse('2026-10-06T12:00:00Z') / 1000);
  // mesmo dia, horário ainda não passou
  assert.equal(proximoDiaHora(t, '6', '20:00'), Date.parse('2026-10-03T23:00:00Z') / 1000);
  const j = { ligada: true, de: '08:00', ate: '20:00' };
  assert.equal(dentroDaJanela(t, j), t);
  const noite = Date.parse('2026-10-03T23:30:00Z') / 1000; // 20:30 BRT
  assert.equal(dentroDaJanela(noite, j), inicioDoDiaBrt(ymdBrt(noite)) + 86400 + 8 * 3600);
  const madrugada = Date.parse('2026-10-03T08:00:00Z') / 1000; // 05:00 BRT
  assert.equal(dentroDaJanela(madrugada, j), inicioDoDiaBrt('2026-10-03') + 8 * 3600);
  assert.equal(dentroDaJanela(noite, { ligada: false }), noite);
});

test('ir para outro fluxo e fim', async () => {
  const destino = await publicado({
    nos: [{ id: 'n1', tipo: 'inicio', x: 0, y: 0, dados: { gatilhos: [{ evento: 'crm', filtros: [] }] } }, { id: 'n2', tipo: 'email', x: 0, y: 0, dados: { modelo: 4 } }, { id: 'n3', tipo: 'fim', x: 0, y: 0, dados: {} }],
    arestas: [{ id: 'a1', de: 'n1', saida: 'proximo', para: 'n2' }, { id: 'a2', de: 'n2', saida: 'proximo', para: 'n3' }], notas: [],
  });
  const origem = await publicado({
    nos: [{ id: 'n1', tipo: 'inicio', x: 0, y: 0, dados: { gatilhos: [{ evento: 'formulario', filtros: [] }] } }, { id: 'n2', tipo: 'ir_fluxo', x: 0, y: 0, dados: { fluxo: destino } }],
    arestas: [{ id: 'a1', de: 'n1', saida: 'proximo', para: 'n2' }], notas: [],
  });
  await lead('ana@x.com', { ts: T0 + 10 });
  await rodar(env, T0 + 60);
  assert.equal(pessoa('ana@x.com', origem).situacao, 'saiu');
  assert.match(pessoa('ana@x.com', origem).motivo_saida, /Foi para o fluxo/);
  assert.equal(pessoa('ana@x.com', destino).situacao, 'concluiu');
  assert.deepEqual(assuntos('ana@x.com'), ['Reunião marcada']);
});

test('sai sozinho quem se descadastra; saída manual pelo contato', async () => {
  const id = await publicado();
  await lead('ana@x.com', { ts: T0 + 10 });
  await lead('bia@x.com', { ts: T0 + 10 });
  await rodar(env, T0 + 60);
  await aplicarResultado(env, 'ana@x.com', 'descadastrou', T0 + 70);
  await rodar(env, T0 + 120);
  assert.deepEqual([pessoa('ana@x.com', id).situacao, pessoa('ana@x.com', id).motivo_saida], ['saiu', 'Descadastrou-se do marketing.']);
  const bia = db.prepare("SELECT id FROM email_contatos WHERE email = 'bia@x.com'").get().id;
  const det = await (await contatosApi.onRequestGet({ request: new Request(`https://x/api?key=k&id=${bia}`), env })).json();
  assert.deepEqual(det.fluxos.map((f) => [f.nome, f.situacao]), [['Boas-vindas', 'esperando']]);
  const r = await contatosApi.onRequestPost({ request: new Request('https://x/api?key=k', { method: 'POST', body: JSON.stringify({ acao: 'tirar_do_fluxo', id: bia, fluxo_id: id }) }), env });
  assert.equal(r.status, 200);
  assert.equal(pessoa('bia@x.com', id).motivo_saida, 'Tirado do fluxo pela equipe.');
  await rodar(env, T0 + 86400 * 2);
  assert.deepEqual(assuntos('bia@x.com'), ['Oi, Ana'], 'não recebe mais nada');
});

test('pausar segura; retomar empurra as esperas pelo tempo da pausa', async () => {
  const id = await publicado();
  await lead('ana@x.com', { ts: T0 + 10 });
  await rodar(env, T0 + 60);
  const ate = pessoa('ana@x.com', id).espera_ate;
  await fx({ acao: 'pausar', id });
  // A pausa começou há 2 dias (o retomar usa a hora real).
  db.prepare('UPDATE email_fluxos SET pausado_em = ? WHERE id = ?').run(Math.floor(Date.now() / 1000) - 2 * 86400, id);
  await lead('bia@x.com', { ts: T0 + 200 });
  await rodar(env, T0 + 86400 * 3);
  assert.equal(pessoa('bia@x.com', id), undefined, 'pausado: ninguém entra');
  assert.deepEqual(assuntos('ana@x.com'), ['Oi, Ana'], 'pausado: ninguém anda');
  const retomado = await fluxosApi.onRequestPost({ request: new Request('https://x/api?key=k', { method: 'POST', body: JSON.stringify({ acao: 'retomar', id }) }), env });
  assert.equal(retomado.status, 200);
  const pausa = pessoa('ana@x.com', id).espera_ate - ate;
  assert.ok(pausa >= 2 * 86400 - 5 && pausa <= 2 * 86400 + 5, 'a espera foi empurrada pelos 2 dias da pausa');
});

test('marketing não liberado segura o e-mail sem pular; sem resposta tenta de novo', async () => {
  const id = await publicado();
  await lead('ana@x.com', { ts: T0 + 10 });
  db.prepare("UPDATE email_config SET valor = '0' WHERE chave = 'marketing_liberado'").run();
  await rodar(env, T0 + 60);
  assert.deepEqual([pessoa('ana@x.com', id).no_atual, pm.envios.length], ['n2', 0]);
  db.prepare("UPDATE email_config SET valor = '1' WHERE chave = 'marketing_liberado'").run();
  pm.foraDoAr = true;
  await rodar(env, T0 + 120);
  assert.deepEqual([pessoa('ana@x.com', id).no_atual, pessoa('ana@x.com', id).tentativas], ['n2', 1]);
  pm.foraDoAr = false;
  await rodar(env, T0 + 180);
  assert.deepEqual(assuntos('ana@x.com'), ['Oi, Ana']);
});

test('duas rodadas juntas não mandam duas vezes', async () => {
  await publicado();
  await lead('ana@x.com', { ts: T0 + 10 });
  await Promise.all([rodar(env, T0 + 60), rodar(env, T0 + 60)]);
  assert.deepEqual(assuntos('ana@x.com'), ['Oi, Ana']);
});

test('laço sem espera para no limite de passos', async () => {
  const id = await publicado({
    nos: [{ id: 'n1', tipo: 'inicio', x: 0, y: 0, dados: { gatilhos: [{ evento: 'formulario', filtros: [] }] } },
      { id: 'n2', tipo: 'desvio', x: 0, y: 0, dados: { juncao: 'e', condicoes: [{ tipo: 'evento', evento: 'compra', valor: '' }] } }],
    arestas: [{ id: 'a1', de: 'n1', saida: 'proximo', para: 'n2' }, { id: 'a2', de: 'n2', saida: 'sim', para: 'n2' }, { id: 'a3', de: 'n2', saida: 'nao', para: 'n2' }], notas: [],
  });
  await lead('ana@x.com', { ts: T0 + 10 });
  await rodar(env, T0 + 60);
  assert.equal(pessoa('ana@x.com', id).situacao, 'andando');
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM email_fluxo_passos WHERE tipo = 'desvio'").get().n <= 50);
});

test('publicar exige quadro sem problemas e só uma vez; estimativa dos 30 dias', async () => {
  const c = await fx({ acao: 'criar', nome: 'X' });
  let r = await fx({ acao: 'publicar', id: c.corpo.fluxo.id });
  assert.equal(r.status, 409);
  assert.match(r.corpo.error, /problema/);
  const id = await publicado();
  assert.equal((await fx({ acao: 'publicar', id })).status, 409);
  assert.equal((await fx({ acao: 'retomar', id })).status, 409);
  await lead('ana@x.com', { ts: T0 - 86400 });
  await rodar(env, T0);
  r = await fx({ acao: 'estimar', gatilho: { evento: 'formulario', filtros: [{ campo: 'funil', valor: 'workshop' }] } });
  assert.equal(r.corpo.pessoas, 1);
  const s = await syncFluxos.onRequestPost({ request: new Request('https://x', { method: 'POST' }), env });
  assert.equal(s.status, 401);
});
