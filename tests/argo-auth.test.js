// Guarda de acesso das rotas do Argo.
//
// Este arquivo existe por causa de uma decisão errada: "endpoint é só fiação,
// dispensa teste". Foi ela que deixou `/api/argo/config` e
// `/api/argo/registro` irem até a revisão final SEM autenticação nenhuma —
// um POST anônimo com as seis permissões em `desligado` desligaria a pausa
// automática de campanhas de Meta Ads, e nenhuma suíte diria nada.
//
// Por isso aqui se testa a guarda E os handlers de verdade: a função certa
// existir não adianta se ninguém a chamar na primeira linha. Os testes de
// handler rodam com `env` sem `ARGO_DATABASE_URL` de propósito — se a guarda
// sair do lugar, a chamada passa dela e estoura no banco, e o 401 esperado
// vira outro status.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chaveAutorizada, recusarSemChave, ERRO_NAO_AUTORIZADO } from '../functions/api/_argo-auth.js';
import { onRequestGet as configGet, onRequestPost as configPost } from '../functions/api/argo/config.js';
import { onRequestGet as registroGet } from '../functions/api/argo/registro.js';

const ENV = { DASH_KEY: 'chave-do-dash-456' };
const pedir = (query = '') => new Request('https://atacadoexponencial.com/api/argo/config' + query);

test('sem chave nenhuma a guarda recusa', () => {
  assert.equal(chaveAutorizada(pedir(), ENV), false);
  assert.equal(chaveAutorizada(pedir('?limite=20'), ENV), false);
});

test('chave errada recusa — inclusive prefixo, sufixo e caixa diferente', () => {
  for (const q of ['?key=', '?key=errada', '?key=chave-do-dash-45', '?key=chave-do-dash-4567', '?key=CHAVE-DO-DASH-456']) {
    assert.equal(chaveAutorizada(pedir(q), ENV), false, q);
  }
});

test('chave certa passa, sozinha ou no meio de outros parâmetros', () => {
  assert.equal(chaveAutorizada(pedir('?key=chave-do-dash-456'), ENV), true);
  assert.equal(chaveAutorizada(pedir('?limite=20&key=chave-do-dash-456'), ENV), true);
});

test('ambiente sem DASH_KEY (ou com ela vazia) recusa tudo — nunca vira porta aberta', () => {
  assert.equal(chaveAutorizada(pedir('?key=chave-do-dash-456'), {}), false);
  assert.equal(chaveAutorizada(pedir('?key='), {}), false);
  assert.equal(chaveAutorizada(pedir('?key=qualquer'), { DASH_KEY: '' }), false);
  assert.equal(chaveAutorizada(pedir('?key=undefined'), { DASH_KEY: undefined }), false);
});

test('recusarSemChave devolve 401 Unauthorized, e null quando pode seguir', async () => {
  const recusa = recusarSemChave(pedir('?key=errada'), ENV);
  assert.equal(recusa.status, 401);
  assert.deepEqual(await recusa.json(), { erro: ERRO_NAO_AUTORIZADO });
  assert.equal(recusarSemChave(pedir('?key=chave-do-dash-456'), ENV), null);
});

// --- Os handlers de verdade: a guarda está na PRIMEIRA linha de cada um? ---

const semBanco = { DASH_KEY: 'chave-do-dash-456' }; // sem ARGO_DATABASE_URL
const req = (caminho) => new Request('https://atacadoexponencial.com' + caminho);
const post = (caminho, corpo) => new Request('https://atacadoexponencial.com' + caminho, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(corpo),
});

const GRADE_DESLIGANDO_TUDO = {
  permissoes: {
    pausar_campanha_trafego: 'desligado',
    pausar_anuncio: 'desligado',
    pausar_conjunto: 'desligado',
    realocar_verba: 'desligado',
    reduzir_orcamento: 'desligado',
    aumentar_orcamento: 'desligado',
  },
};

test('GET /api/argo/config sem chave e com chave errada devolve 401', async () => {
  for (const caminho of ['/api/argo/config', '/api/argo/config?key=', '/api/argo/config?key=errada']) {
    const r = await configGet({ request: req(caminho), env: semBanco });
    assert.equal(r.status, 401, caminho);
    assert.deepEqual(await r.json(), { erro: ERRO_NAO_AUTORIZADO }, caminho);
  }
});

test('GET /api/argo/registro sem chave e com chave errada devolve 401', async () => {
  for (const caminho of ['/api/argo/registro?limite=20', '/api/argo/registro?limite=20&key=errada']) {
    const r = await registroGet({ request: req(caminho), env: semBanco });
    assert.equal(r.status, 401, caminho);
    assert.deepEqual(await r.json(), { erro: ERRO_NAO_AUTORIZADO }, caminho);
  }
});

// O caso que motivou tudo: o POST anônimo que desligaria a pausa automática.
test('POST /api/argo/config sem chave devolve 401 e não chega a validar nem a gravar', async () => {
  for (const caminho of ['/api/argo/config', '/api/argo/config?key=errada']) {
    const r = await configPost({ request: post(caminho, GRADE_DESLIGANDO_TUDO), env: semBanco });
    assert.equal(r.status, 401, caminho);
    assert.deepEqual(await r.json(), { erro: ERRO_NAO_AUTORIZADO }, caminho);
  }
});

// Com a chave certa a guarda deixa passar: daí em diante é o banco que
// responde (aqui ausente de propósito → 500), nunca mais 401. Sem esta
// asserção, uma guarda que recusasse TUDO passaria nos testes acima.
test('com a chave certa os handlers passam da guarda', async () => {
  const comChave = '?key=chave-do-dash-456';
  const g = await configGet({ request: req('/api/argo/config' + comChave), env: semBanco });
  assert.notEqual(g.status, 401);
  assert.equal(g.status, 500);
  const reg = await registroGet({ request: req('/api/argo/registro?limite=20&key=chave-do-dash-456'), env: semBanco });
  assert.notEqual(reg.status, 401);
  assert.equal(reg.status, 500);
  // POST com chave certa e corpo inválido tem que chegar na VALIDAÇÃO (400),
  // prova de que passou da guarda sem depender do banco.
  const p = await configPost({ request: post('/api/argo/config' + comChave, { parada_geral: true }), env: semBanco });
  assert.equal(p.status, 400);
});
