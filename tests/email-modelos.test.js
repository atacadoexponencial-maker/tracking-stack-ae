// Modelos de e-mail (issue 378) contra SQLite real (migrations 0050 e 0051)
// e um Postmark simulado (fetch trocado).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import * as modelos from '../functions/api/email/modelos.js';
import { consultasDeUso } from '../functions/api/_email-modelos.js';

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

let db, env, pm;

function postmarkFalso() {
  const estado = { envios: [], recusar: null, foraDoAr: false, n: 0 };
  const resp = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
  estado.fetch = async (url, op = {}) => {
    const u = new URL(String(url));
    if (estado.foraDoAr) throw new TypeError('fetch failed');
    if (op.headers['X-Postmark-Server-Token'] !== 'srv') return resp({ ErrorCode: 10 }, 401);
    if (u.pathname === '/email') {
      const c = JSON.parse(op.body);
      if (estado.recusar) return resp({ ErrorCode: estado.recusar, Message: 'x' }, 422);
      const id = `msg-${++estado.n}`;
      estado.envios.push({ ...c, MessageID: id });
      return resp({ ErrorCode: 0, Message: 'OK', MessageID: id, To: c.To });
    }
    throw new Error('fetch inesperado: ' + u);
  };
  return estado;
}

const config = (chave, valor) => db.prepare('UPDATE email_config SET valor = ? WHERE chave = ?').run(valor, chave);

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  for (const f of ['0050_email.sql', '0051_email_modelos.sql']) db.exec(readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'));
  config('rodape', 'Seteads Ltda.');
  env = { DB: d1(db), DASH_KEY: 'k', POSTMARK_SERVER_TOKEN: 'srv' };
  pm = postmarkFalso();
  globalThis.fetch = pm.fetch;
  consultasDeUso.length = 0;
});

const ORIGEM = 'https://email-proprio.tracking-ae.pages.dev';
const dash = (corpo, key = 'k') => (corpo
  ? modelos.onRequestPost({ request: new Request(`${ORIGEM}/api/email/modelos?key=${key}`, { method: 'POST', body: JSON.stringify(corpo) }), env })
  : modelos.onRequestGet({ request: new Request(`${ORIGEM}/api/email/modelos?key=${key}`), env })).then(async (r) => ({ status: r.status, corpo: await r.json() }));

const CONTEUDO = {
  assunto: 'Sua reunião, {{primeiro_nome}}', previa: '{{data_reuniao}} às {{hora_reuniao}}',
  corpo: 'Oi, {{ nome }}!\n\n[[Entrar na reunião | {{link_reuniao}}]]\n\nVeja [o site](https://atacadoexponencial.com).',
};
async function criar(nome = 'Confirmação', canal = 'transacional', conteudo = CONTEUDO) {
  const c = await dash({ acao: 'salvar', modelo: { nome, canal } });
  assert.equal(c.status, 200, JSON.stringify(c.corpo));
  const s = await dash({ acao: 'salvar', id: c.corpo.modelo.id, modelo: { nome, canal, ...conteudo } });
  assert.equal(s.status, 200, JSON.stringify(s.corpo));
  return s.corpo.modelo;
}

test('sem a chave do dash: 401', async () => {
  assert.equal((await dash(null, 'x')).status, 401);
  assert.equal((await dash({ acao: 'salvar' }, 'x')).status, 401);
});

test('GET começa vazio e traz os campos por canal', async () => {
  const r = await dash();
  assert.deepEqual(r.corpo.modelos, []);
  assert.ok(r.corpo.campos.transacional.some((c) => c.campo === 'link_reuniao'));
  assert.ok(!r.corpo.campos.marketing.some((c) => c.campo === 'link_reuniao'));
});

test('criar e salvar: grava e aparece na lista', async () => {
  const m = await criar();
  assert.equal(m.canal, 'transacional');
  assert.equal(m.arquivado, 0);
  // O corpo é guardado como documento de blocos (393), convertido do texto.
  const doc = JSON.parse(m.corpo);
  assert.equal(doc.formato, 'blocos');
  assert.deepEqual(doc.blocos.map((b) => b.tipo), ['texto', 'botao', 'texto']);
  const r = await dash();
  assert.deepEqual(r.corpo.modelos.map((x) => x.nome), ['Confirmação']);
});

test('criar pede nome e canal válido', async () => {
  assert.equal((await dash({ acao: 'salvar', modelo: { nome: '', canal: 'marketing' } })).status, 400);
  assert.equal((await dash({ acao: 'salvar', modelo: { nome: 'x', canal: 'sms' } })).status, 400);
});

test('salvar exige assunto e corpo', async () => {
  const c = await dash({ acao: 'salvar', modelo: { nome: 'A', canal: 'marketing' } });
  const r = await dash({ acao: 'salvar', id: c.corpo.modelo.id, modelo: { nome: 'A', canal: 'marketing', assunto: '', corpo: 'x' } });
  assert.equal(r.status, 400);
  assert.match(r.corpo.error, /assunto/);
});

test('campo desconhecido: recusado com sugestão; campo de outro canal também', async () => {
  const c = await dash({ acao: 'salvar', modelo: { nome: 'Black', canal: 'marketing' } });
  const salvar = (corpo) => dash({ acao: 'salvar', id: c.corpo.modelo.id, modelo: { nome: 'Black', canal: 'marketing', assunto: 'Oi', corpo } });
  let r = await salvar('Oi, {{nmoe}}!');
  assert.equal(r.status, 400);
  assert.match(r.corpo.error, /\{\{nmoe\}\}.*Você quis dizer \{\{nome\}\}\?/);
  r = await salvar('[[Entrar | {{link_reuniao}}]]');
  assert.equal(r.status, 400);
  assert.match(r.corpo.error, /link_reuniao/);
});

test('link sem https é recusado apontando o trecho; campo como link é aceito', async () => {
  const c = await dash({ acao: 'salvar', modelo: { nome: 'L', canal: 'transacional' } });
  const salvar = (corpo) => dash({ acao: 'salvar', id: c.corpo.modelo.id, modelo: { nome: 'L', canal: 'transacional', assunto: 'Oi', corpo } });
  let r = await salvar('Veja [aqui](www.site.com)');
  assert.equal(r.status, 400);
  assert.match(r.corpo.error, /^Texto: link sem https:\/\/ \("www\.site\.com"\)/);
  r = await salvar('[[Ir | http://site.com]]');
  assert.equal(r.status, 400);
  assert.equal((await salvar('[[Ir | https://site.com/x]]')).status, 200);
  assert.equal((await salvar('[[Ir | {{link_reuniao}}]]')).status, 200);
});

test('nome repetido no mesmo canal é recusado; em outro canal pode', async () => {
  await criar('Boas-vindas', 'marketing', { assunto: 'Oi', corpo: 'Oi' });
  const r = await dash({ acao: 'salvar', modelo: { nome: 'Boas-vindas', canal: 'marketing' } });
  assert.equal(r.status, 409);
  assert.match(r.corpo.error, /Já existe um modelo com esse nome/);
  assert.equal((await dash({ acao: 'salvar', modelo: { nome: 'Boas-vindas', canal: 'transacional' } })).status, 200);
});

test('duplicar: "Cópia de ..." com o mesmo conteúdo, sem repetir nome', async () => {
  const m = await criar();
  const a = await dash({ acao: 'duplicar', id: m.id });
  assert.equal(a.corpo.modelo.nome, 'Cópia de Confirmação');
  assert.equal(a.corpo.modelo.corpo, m.corpo);
  assert.notEqual(a.corpo.modelo.id, m.id);
  const b = await dash({ acao: 'duplicar', id: m.id });
  assert.equal(b.corpo.modelo.nome, 'Cópia de Confirmação (2)');
});

test('arquivar e desarquivar', async () => {
  const m = await criar();
  let r = await dash({ acao: 'arquivar', id: m.id });
  assert.equal(r.corpo.modelo.arquivado, 1);
  r = await dash({ acao: 'desarquivar', id: m.id });
  assert.equal(r.corpo.modelo.arquivado, 0);
});

test('modelo em uso: não arquiva nem troca de canal', async () => {
  const m = await criar('Lembrete', 'transacional', { assunto: 'Oi', corpo: 'Oi, {{nome}}' });
  consultasDeUso.push(async (_env, id) => (id === m.id ? ['confirmação da agenda (Sessão estratégica)'] : []));
  let r = await dash({ acao: 'arquivar', id: m.id });
  assert.equal(r.status, 409);
  assert.match(r.corpo.error, /Este modelo está em uso em: confirmação da agenda \(Sessão estratégica\)/);
  const mudar = { nome: 'Lembrete', canal: 'marketing', assunto: 'Oi', corpo: 'Oi, {{nome}}' };
  r = await dash({ acao: 'salvar', id: m.id, modelo: mudar });
  assert.equal(r.status, 409);
  const linha = db.prepare('SELECT canal, arquivado FROM email_modelos WHERE id = ?').get(m.id);
  assert.deepEqual([linha.canal, linha.arquivado], ['transacional', 0]);
  // Sem uso, trocar o canal é permitido.
  consultasDeUso.length = 0;
  r = await dash({ acao: 'salvar', id: m.id, modelo: mudar });
  assert.equal(r.corpo.modelo.canal, 'marketing');
});

test('modelo inexistente: 404', async () => {
  for (const acao of ['duplicar', 'arquivar', 'desarquivar', 'enviar_teste']) {
    const r = await dash({ acao, id: 999, para: 'eu@x.com' });
    assert.equal(r.status, 404, acao);
    assert.equal(r.corpo.error, 'Modelo não encontrado.');
  }
  assert.equal((await dash({ acao: 'salvar', id: 'abc', modelo: {} })).status, 404);
});

test('prévia: dados de exemplo, campo desconhecido apontado, aviso de rodapé vazio', async () => {
  let r = await dash({ acao: 'previa', modelo: { canal: 'marketing', assunto: 'Oi, {{primeiro_nome}}', previa: '', corpo: 'Oi, {{nmoe}}' } });
  assert.equal(r.status, 200);
  assert.equal(r.corpo.assunto, 'Oi, Ana');
  assert.deepEqual(r.corpo.desconhecidos, ['nmoe']);
  assert.match(r.corpo.html, /<mark[^>]*>\{\{nmoe\}\}<\/mark>/);
  assert.match(r.corpo.html, /Não quero mais receber/);
  assert.deepEqual(r.corpo.avisos, []);
  config('rodape', '');
  r = await dash({ acao: 'previa', modelo: { canal: 'transacional', assunto: 'x', corpo: 'y' } });
  assert.deepEqual(r.corpo.avisos, ['Rodapé vazio: preencha em Configuração.']);
});

test('teste do modelo: campos preenchidos, remetente do canal, tag e registro', async () => {
  const m = await criar();
  const r = await dash({ acao: 'enviar_teste', id: m.id, para: 'Eu@Exemplo.com' });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  const e = pm.envios[0];
  assert.equal(e.MessageStream, 'outbound');
  assert.equal(e.From, '"Atacado Exponencial" <notify@envio.atacadoexponencial.com>');
  assert.equal(e.Subject, 'Sua reunião, Ana');
  assert.equal(e.Tag, 'teste-modelo');
  assert.deepEqual(e.Metadata, { origem: 'teste', envio_id: String(r.corpo.envio_id) });
  assert.match(e.HtmlBody, /Oi, Ana Lima!/);
  assert.match(e.HtmlBody, /href="https:\/\/meet\.google\.com\/abc-defg-hij"/);
  assert.match(e.HtmlBody, /src="https:\/\/email-proprio\.tracking-ae\.pages\.dev\/email\/logo\.png"/);
  assert.match(e.TextBody, /Entrar na reunião: https:\/\/meet\.google\.com/);
  const linha = db.prepare('SELECT * FROM email_envios WHERE id = ?').get(r.corpo.envio_id);
  assert.deepEqual([linha.situacao, linha.origem, linha.ref_id, linha.destinatario], ['enviado', 'teste', `modelo:${m.id}`, 'eu@exemplo.com']);
});

test('teste do modelo: recusado pelo serviço fica "falhou" com o motivo', async () => {
  const m = await criar();
  pm.recusar = 406;
  const r = await dash({ acao: 'enviar_teste', id: m.id, para: 'eu@x.com' });
  assert.equal(r.status, 422);
  assert.match(r.corpo.error, /Endereço inativo/);
  assert.equal(db.prepare('SELECT situacao FROM email_envios').get().situacao, 'falhou');
});

test('teste do modelo: serviço sem resposta não grava nada', async () => {
  const m = await criar();
  pm.foraDoAr = true;
  const r = await dash({ acao: 'enviar_teste', id: m.id, para: 'eu@x.com' });
  assert.equal(r.status, 504);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM email_envios').get().n, 0);
});

test('teste do modelo: marketing não liberado é recusado; modelo sem corpo também', async () => {
  const m = await criar('Convite', 'marketing', { assunto: 'Oi {{primeiro_nome}}', corpo: 'Oi' });
  config('marketing_liberado', '0');
  let r = await dash({ acao: 'enviar_teste', id: m.id, para: 'eu@x.com' });
  assert.equal(r.status, 409);
  const c = await dash({ acao: 'salvar', modelo: { nome: 'Vazio', canal: 'transacional' } });
  r = await dash({ acao: 'enviar_teste', id: c.corpo.modelo.id, para: 'eu@x.com' });
  assert.equal(r.status, 400);
  assert.equal(pm.envios.length, 0);
});

test('editor (394): teste com o rascunho da tela, sem salvar', async () => {
  const m = await criar();
  const rasc = {
    assunto: 'Rascunho, {{primeiro_nome}}', previa: '',
    corpo: { formato: 'blocos', versao: 1, cab: { modo: 'sem', fundo: '' }, fundo: { fora: '#ffffff', conteudo: '#ffffff' }, blocos: [{ id: 'a1', tipo: 'titulo', texto: 'Só na tela' }] },
  };
  const r = await dash({ acao: 'enviar_teste', id: m.id, para: 'eu@x.com', modelo: rasc });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  assert.equal(pm.envios[0].Subject, 'Rascunho, Ana');
  assert.match(pm.envios[0].HtmlBody, /Só na tela/);
  assert.doesNotMatch(pm.envios[0].HtmlBody, /logo\.png/, 'sem cabeçalho');
  // O modelo salvo não mudou.
  assert.equal((await dash()).corpo.modelos[0].assunto, CONTEUDO.assunto);
  // Rascunho inválido não sai.
  const ruim = await dash({ acao: 'enviar_teste', id: m.id, para: 'eu@x.com', modelo: { ...rasc, corpo: { ...rasc.corpo, blocos: [] } } });
  assert.equal(ruim.status, 400);
  assert.equal(pm.envios.length, 1);
});

test('editor (394): prévia marca os blocos para clicar e arrastar; lista diz onde o modelo é usado', async () => {
  const corpo = { formato: 'blocos', versao: 1, cab: { modo: 'padrao', fundo: '' }, fundo: {}, blocos: [{ id: 'x9', tipo: 'texto', html: '<p>Oi</p>' }, { id: 'y8', tipo: 'titulo', texto: '' }] };
  const p = await dash({ acao: 'previa', editor: true, modelo: { canal: 'marketing', assunto: 'A', previa: '', corpo } });
  assert.match(p.corpo.html, /<tr data-b="x9" draggable="true">/);
  assert.match(p.corpo.html, /<tr data-b="y8" draggable="true"><td[^>]*>Título vazio/);
  assert.match(p.corpo.html, /<tr data-cabeca>/);
  assert.equal(p.corpo.texto.split('\n')[0], 'Oi');
  const sem = await dash({ acao: 'previa', modelo: { canal: 'marketing', assunto: 'A', previa: '', corpo } });
  assert.doesNotMatch(sem.corpo.html, /data-b=|Título vazio/, 'fora do editor, nada de marca');

  const m = await criar();
  consultasDeUso.push(async (e, id) => (id === m.id ? ['confirmação da agenda (Sessão estratégica)'] : []));
  assert.deepEqual((await dash()).corpo.modelos[0].usos, ['confirmação da agenda (Sessão estratégica)']);
});
