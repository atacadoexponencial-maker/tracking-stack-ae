// Fluxos: editar ativo com segurança e testar (issue 387).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { bancoDosFluxos, d1 } from './_fluxos-banco.js';
import * as fluxosApi from '../functions/api/email/fluxos.js';
import { rodar } from '../functions/api/_email-motor.js';
import { registrarLead } from '../functions/api/_email-contatos.js';

let db, env, pm;
const T0 = Math.floor(Date.now() / 1000);

beforeEach(() => {
  db = bancoDosFluxos();
  db.prepare(`INSERT INTO email_modelos (id, nome, canal, assunto, previa, corpo, arquivado, criado_em, atualizado_em) VALUES
    (1, 'E-mail 1', 'marketing', 'Oi, {{primeiro_nome}}', '', 'x', 0, 0, 0),
    (2, 'E-mail 2', 'marketing', 'Segundo', '', 'x', 0, 0, 0),
    (3, 'E-mail 3', 'marketing', 'Terceiro', '', 'x', 0, 0, 0)`).run();
  env = { DB: d1(db), DASH_KEY: 'k', POSTMARK_SERVER_TOKEN: 'srv' };
  pm = { envios: [], foraDoAr: false, n: 0 };
  globalThis.fetch = async (url, op = {}) => {
    if (pm.foraDoAr) throw new TypeError('fetch failed');
    const c = JSON.parse(op.body);
    pm.envios.push(c);
    return new Response(JSON.stringify({ ErrorCode: 0, MessageID: `m${++pm.n}`, To: c.To }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
});

const fx = (corpo, qs = '') => (corpo
  ? fluxosApi.onRequestPost({ request: new Request(`https://x.dev/api?key=k${qs}`, { method: 'POST', body: JSON.stringify(corpo) }), env })
  : fluxosApi.onRequestGet({ request: new Request(`https://x.dev/api?key=k${qs}`), env })).then(async (r) => ({ status: r.status, corpo: await r.json() }));

const espera = { modo: 'tempo', qtd: 1, unidade: 'dias', janela: { ligada: false } };
/** início → e-mail 1 → espera → desvio (abriu?) → sim: e-mail 2 / não: e-mail 3 → fim */
function grafo() {
  return {
    nos: [
      { id: 'n1', tipo: 'inicio', x: 0, y: 0, dados: { gatilhos: [{ evento: 'formulario', filtros: [] }] } },
      { id: 'n2', tipo: 'email', x: 0, y: 0, dados: { modelo: 1 } },
      { id: 'n3', tipo: 'espera', x: 0, y: 0, dados: espera },
      { id: 'n4', tipo: 'desvio', x: 0, y: 0, dados: { juncao: 'e', condicoes: [{ tipo: 'abriu', ref: 'n2' }] } },
      { id: 'n5', tipo: 'email', x: 0, y: 0, dados: { modelo: 2 } },
      { id: 'n6', tipo: 'email', x: 0, y: 0, dados: { modelo: 3 } },
      { id: 'n7', tipo: 'fim', x: 0, y: 0, dados: {} },
    ],
    arestas: [['n1', 'proximo', 'n2'], ['n2', 'proximo', 'n3'], ['n3', 'proximo', 'n4'], ['n4', 'sim', 'n5'], ['n4', 'nao', 'n6'], ['n5', 'proximo', 'n7'], ['n6', 'proximo', 'n7']]
      .map(([de, saida, para], i) => ({ id: `a${i}`, de, saida, para })),
    notas: [],
  };
}
async function publicado() {
  const c = await fx({ acao: 'criar', nome: 'Boas-vindas' });
  const id = c.corpo.fluxo.id;
  await fx({ acao: 'salvar', id, nome: 'Boas-vindas', grafo: grafo(), versao: 1 });
  await fx({ acao: 'publicar', id });
  db.prepare('UPDATE email_fluxos SET publicado_em = ? WHERE id = ?').run(T0, id);
  return id;
}
async function lead(email, ts = T0 + 10) {
  db.prepare("INSERT INTO sessions (session_id, landing_url) VALUES (?, 'https://x.com/')").run(email);
  db.prepare("INSERT INTO event_log (session_id, event_name, event_id, timestamp, raw_email, funnel) VALUES (?, 'Lead', ?, ?, ?, 'workshop')").run(email, email, ts, email);
  await registrarLead(env, { email, nome: 'Ana', funil: 'workshop', eventId: email, quando: ts });
}
const versao = async (id) => (await fx(null, `&id=${id}`)).corpo.fluxo.versao;
const pessoa = (email) => db.prepare('SELECT p.* FROM email_fluxo_pessoas p JOIN email_contatos c ON c.id = p.contato_id WHERE c.email = ?').get(email);

test('editar ativo: o motor segue a versão no ar; o aviso aparece e some ao desfazer', async () => {
  const id = await publicado();
  await lead('ana@x.com');
  await rodar(env, T0 + 60);
  const g = grafo();
  g.nos[1].dados.modelo = 2; // e-mail 1 passa a ser o "Segundo"
  let r = await fx({ acao: 'salvar', id, nome: 'Boas-vindas', grafo: g, versao: await versao(id) });
  assert.equal(r.corpo.mudancas, true);
  await lead('bia@x.com', T0 + 70);
  await rodar(env, T0 + 120);
  assert.deepEqual(pm.envios.map((m) => m.Subject), ['Oi, Ana', 'Oi, Ana'], 'quem entra depois recebe a versão no ar');
  r = await fx({ acao: 'salvar', id, nome: 'Boas-vindas', grafo: grafo(), versao: await versao(id) });
  assert.equal(r.corpo.mudancas, false, 'voltou a ficar igual');
});

test('descartar volta o quadro para a versão no ar', async () => {
  const id = await publicado();
  const g = grafo();
  g.nos.push({ id: 'n9', tipo: 'fim', x: 0, y: 0, dados: {} });
  await fx({ acao: 'salvar', id, nome: 'Boas-vindas', grafo: g, versao: await versao(id) });
  const r = await fx({ acao: 'descartar', id, versao: await versao(id) });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  assert.equal(r.corpo.fluxo.mudancas, false);
  assert.equal(r.corpo.fluxo.grafo.nos.length, 7);
  assert.equal((await fx({ acao: 'descartar', id, versao: 1 })).status, 409, 'versão velha');
});

test('publicar mudanças: quem está em cartão que existe segue; em cartão excluído sai com registro', async () => {
  const id = await publicado();
  await lead('ana@x.com');
  await rodar(env, T0 + 60);
  assert.equal(pessoa('ana@x.com').no_atual, 'n3');
  // Remove a espera n3 (ana está nela) e liga o e-mail direto no desvio.
  const g = grafo();
  g.nos = g.nos.filter((n) => n.id !== 'n3');
  g.arestas = g.arestas.filter((a) => a.de !== 'n3' && a.para !== 'n3').concat([{ id: 'a9', de: 'n2', saida: 'proximo', para: 'n4' }]);
  const s = await fx({ acao: 'salvar', id, nome: 'Boas-vindas', grafo: g, versao: await versao(id) });
  assert.equal(s.corpo.saem_ao_publicar, 1);
  const r = await fx({ acao: 'publicar', id, versao: await versao(id) });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  assert.deepEqual([r.corpo.fluxo.sairam, r.corpo.fluxo.mudancas], [1, false]);
  assert.deepEqual([pessoa('ana@x.com').situacao, pessoa('ana@x.com').motivo_saida], ['saiu', 'O cartão em que estava foi excluído ao publicar mudanças.']);
  const passo = db.prepare("SELECT tipo, no_id FROM email_fluxo_passos WHERE tipo = 'saiu'").get();
  assert.deepEqual({ ...passo }, { tipo: 'saiu', no_id: 'n3' });
  // Quem entra agora segue a versão nova (sem espera: vai direto ao desvio).
  await lead('bia@x.com', T0 + 70);
  await rodar(env, T0 + 120);
  assert.deepEqual(pm.envios.filter((m) => m.To === 'bia@x.com').map((m) => m.Subject), ['Oi, Ana', 'Terceiro']);
});

test('publicar mudanças: sem mudança, com problema ou com versão velha é recusado', async () => {
  const id = await publicado();
  let r = await fx({ acao: 'publicar', id });
  assert.equal(r.status, 409);
  assert.match(r.corpo.error, /Não há mudanças/);
  const g = grafo();
  g.nos[1].dados.modelo = '';
  await fx({ acao: 'salvar', id, nome: 'Boas-vindas', grafo: g, versao: await versao(id) });
  r = await fx({ acao: 'publicar', id });
  assert.match(r.corpo.error, /problema/);
  assert.equal((await fx({ acao: 'publicar', id, versao: 1 })).status, 409);
});

test('teste passo a passo: e-mail na hora com dados de exemplo, espera pulada, desvio pela escolha', async () => {
  const id = await publicado();
  const passos = [];
  let no;
  let saida;
  for (let i = 0; i < 10; i++) {
    const r = await fx({ acao: 'testar', id, para: 'Equipe@seteads.com', no, saida });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    passos.push(r.corpo.texto);
    if (r.corpo.escolhas) { saida = 'nao'; no = r.corpo.no; continue; }
    saida = undefined;
    if (r.corpo.fim) break;
    no = r.corpo.proximo;
  }
  assert.deepEqual(passos, [
    'Entrou, como se tivesse disparado o gatilho.',
    'E-mail enviado: "Oi, Ana".',
    'Espera pulada (no teste não se espera).',
    'Desvio: escolha o caminho.',
    'Seguiu por "não" (escolhido no teste).',
    'E-mail enviado: "Terceiro".',
    'Concluiu o fluxo.',
  ]);
  assert.deepEqual(pm.envios.map((m) => [m.To, m.Subject, m.MessageStream, m.Tag]), [
    ['equipe@seteads.com', 'Oi, Ana', 'broadcast', 'teste-fluxo'], ['equipe@seteads.com', 'Terceiro', 'broadcast', 'teste-fluxo'],
  ]);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM email_envios WHERE origem = 'teste'").get().n, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM email_fluxo_pessoas').get().n, 0, 'o teste não coloca ninguém no fluxo');
});

test('teste: endereço inválido, quadro com problema, marketing não liberado e sem resposta', async () => {
  const id = await publicado();
  assert.equal((await fx({ acao: 'testar', id, para: 'nada' })).status, 400);
  db.prepare("UPDATE email_config SET valor = '0' WHERE chave = 'marketing_liberado'").run();
  let r = await fx({ acao: 'testar', id, para: 'eu@x.com', no: 'n2' });
  assert.deepEqual([r.corpo.repetir, r.corpo.proximo], [true, 'n2']);
  assert.match(r.corpo.texto, /não liberado/);
  db.prepare("UPDATE email_config SET valor = '1' WHERE chave = 'marketing_liberado'").run();
  pm.foraDoAr = true;
  r = await fx({ acao: 'testar', id, para: 'eu@x.com', no: 'n2' });
  assert.match(r.corpo.texto, /Não foi possível falar com o serviço de envio/);
  const g = grafo();
  g.nos[1].dados.modelo = '';
  await fx({ acao: 'salvar', id, nome: 'Boas-vindas', grafo: g, versao: await versao(id) });
  r = await fx({ acao: 'testar', id, para: 'eu@x.com' });
  assert.equal(r.status, 409);
  assert.match(r.corpo.error, /Resolva os problemas/);
});

test('teste num rascunho (antes de publicar) e com ir para outro fluxo', async () => {
  const c = await fx({ acao: 'criar', nome: 'Rascunho' });
  const destino = await fx({ acao: 'criar', nome: 'Destino' });
  const g = { nos: [{ id: 'n1', tipo: 'inicio', x: 0, y: 0, dados: { gatilhos: [{ evento: 'crm', filtros: [] }] } }, { id: 'n2', tipo: 'ir_fluxo', x: 0, y: 0, dados: { fluxo: destino.corpo.fluxo.id } }],
    arestas: [{ id: 'a1', de: 'n1', saida: 'proximo', para: 'n2' }], notas: [] };
  await fx({ acao: 'salvar', id: c.corpo.fluxo.id, nome: 'Rascunho', grafo: g, versao: 1 });
  const r = await fx({ acao: 'testar', id: c.corpo.fluxo.id, para: 'eu@x.com', no: 'n2' });
  assert.deepEqual([r.corpo.texto, r.corpo.fim], ['Iria para o fluxo "Destino". O teste para aqui.', true]);
});
