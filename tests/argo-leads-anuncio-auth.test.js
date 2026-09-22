import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/argo/leads-por-anuncio.js';

const env = { ARGO_KEY: 'chave-certa' };

function req(headers = {}) {
  return new Request('https://exemplo.com/api/argo/leads-por-anuncio?dias=30', { headers });
}

test('sem cabecalho de autorizacao devolve 401', async () => {
  const r = await onRequestGet({ request: req(), env });
  assert.equal(r.status, 401);
});

test('chave errada devolve 401', async () => {
  const r = await onRequestGet({ request: req({ Authorization: 'Bearer errada' }), env });
  assert.equal(r.status, 401);
});

test('sem ARGO_KEY no ambiente recusa, nao abre a porta', async () => {
  const r = await onRequestGet({ request: req({ Authorization: 'Bearer qualquer' }), env: {} });
  assert.equal(r.status, 401);
});

test('a DASH_KEY nao abre esta rota, nem por query string', async () => {
  const request = new Request('https://exemplo.com/api/argo/leads-por-anuncio?key=chave-do-dash');
  const r = await onRequestGet({ request, env: { ...env, DASH_KEY: 'chave-do-dash' } });
  assert.equal(r.status, 401);
});

// --- Contrato com o CRM -----------------------------------------------------
// Estes três nascem de dois defeitos reais no código do plano: ele passava
// milissegundos para uma função que espera segundos, e tratava o retorno
// `{ ok, cards }` como se fosse a lista de cards. Os dois juntos devolveriam
// "nenhum lead" com cara de resposta boa — e o Argo proporia pausar tudo.

const AUTORIZADO = { Authorization: 'Bearer chave-certa' };

test('CRM indisponivel devolve 503, nunca "nenhum lead" com cara de sucesso', async () => {
  const r = await onRequestGet({
    request: req(AUTORIZADO),
    env: { ARGO_KEY: 'chave-certa' }, // sem CLICKUP_API_TOKEN
  });
  assert.equal(r.status, 503);
  const corpo = await r.json();
  assert.match(corpo.erro, /não foi possível ler o crm/i);
});
