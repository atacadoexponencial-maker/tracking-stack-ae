import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERGUNTAS, CABECALHO, TOTAL_ETAPAS, validarResposta } from '../src/data/hotseat-giulliano-puga.js';
import { processarResposta } from '../functions/api/hotseat-giulliano-puga.js';
import { acrescentarLinha } from '../functions/api/_google-planilha.js';

const RESPOSTAS = {
  instagram: '@marcax',
  participa: 'Sim, eu vou',
  analise: 'Sim, quero',
};

const AGORA = Date.parse('2026-11-12T12:00:00Z');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

function pedido(corpo, ua = UA) {
  return new Request('https://x/api/hotseat-giulliano-puga', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'user-agent': ua, 'cf-connecting-ip': '200.10.20.30' },
    body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
  });
}

test('3 perguntas na ordem pedida e cabeçalho com data e origem', () => {
  assert.deepEqual(PERGUNTAS.map((p) => p.name), ['instagram', 'participa', 'analise']);
  assert.deepEqual(PERGUNTAS.map((p) => p.etapa), [1, 1, 1]);
  assert.equal(TOTAL_ETAPAS, 1);
  assert.deepEqual(CABECALHO, ['Data/hora', 'Instagram da marca', 'Vai participar', 'Quer análise', 'Origem']);
});

test('validação: recusa opção inventada, campo vazio e texto gigante', () => {
  assert.equal(validarResposta(RESPOSTAS).ok, true);
  assert.deepEqual(validarResposta({ ...RESPOSTAS, participa: 'Talvez' }), { ok: false, campo: 'participa' });
  assert.deepEqual(validarResposta({ ...RESPOSTAS, analise: '' }), { ok: false, campo: 'analise' });
  assert.deepEqual(validarResposta({ ...RESPOSTAS, instagram: ' ' }), { ok: false, campo: 'instagram' });
  assert.deepEqual(validarResposta({ ...RESPOSTAS, instagram: 'x'.repeat(500) }), { ok: false, campo: 'instagram' });
  assert.deepEqual(validarResposta(null), { ok: false, campo: 'instagram' });
});

test('POST válido grava uma linha com hora de Brasília e pede o cabeçalho novo', async () => {
  const chamadas = [];
  const r = await processarResposta({ request: pedido({ respostas: RESPOSTAS, origem: 'utm_source=grupo' }), env: {}, agoraMs: AGORA, gravar: async (_env, a) => chamadas.push(a) });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
  assert.equal(chamadas.length, 1);
  assert.deepEqual(chamadas[0].cabecalho, CABECALHO);
  assert.deepEqual(chamadas[0].linha, [
    '12/11/2026 09:00:00', '@marcax', 'Sim, eu vou', 'Sim, quero', 'utm_source=grupo',
  ]);
  assert.equal(chamadas[0].atualizarCabecalho, true);
});

test('campo inválido devolve 400 com o campo e nada é gravado', async () => {
  let gravou = false;
  const gravar = async () => { gravou = true; };
  const r1 = await processarResposta({ request: pedido({ respostas: { ...RESPOSTAS, analise: 'Talvez' } }), env: {}, agoraMs: AGORA, gravar });
  assert.equal(r1.status, 400);
  assert.equal((await r1.json()).campo, 'analise');
  const r2 = await processarResposta({ request: pedido('{torto'), env: {}, agoraMs: AGORA, gravar });
  assert.equal(r2.status, 400);
  assert.equal(gravou, false);
});

test('robô recebe ok sem virar linha', async () => {
  let gravou = false;
  const r = await processarResposta({ request: pedido({ respostas: RESPOSTAS }, 'python-requests/2.31'), env: {}, agoraMs: AGORA, gravar: async () => { gravou = true; } });
  assert.equal(r.status, 200);
  assert.equal(gravou, false);
});

test('falha do Google vira 502 para a página pedir de novo', async () => {
  const r = await processarResposta({ request: pedido({ respostas: RESPOSTAS }), env: {}, agoraMs: AGORA, gravar: async () => { throw new Error('fora'); } });
  assert.equal(r.status, 502);
});

test('cabeçalho antigo na planilha é trocado pelo novo, limpando as colunas que sobraram', async () => {
  const { privateKey } = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign'],
  );
  const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', privateKey)).toString('base64');
  const env = { GOOGLE_AGENDA_SA_JSON: JSON.stringify({ client_email: 'x@y', private_key: `-----BEGIN PRIVATE KEY-----\n${der}\n-----END PRIVATE KEY-----` }) };
  const antigo = ['Data/hora', 'Nome', 'WhatsApp', 'E-mail', 'Instagram da marca', 'Vai participar', 'Quer análise', 'Origem'];
  const escritas = [];
  const fetchFalso = async (url, o) => {
    if (String(url).includes('oauth2')) return Response.json({ access_token: 't', expires_in: 3600 });
    if (o.method === 'GET') return Response.json({ values: [antigo] });
    escritas.push({ metodo: o.method, valores: JSON.parse(o.body).values[0] });
    return Response.json({});
  };
  const base = { subject: 'teste-cabecalho@x', planilha: 'p', aba: 'a', cabecalho: CABECALHO, linha: ['l'] };
  await acrescentarLinha(env, { ...base, atualizarCabecalho: true }, fetchFalso);
  assert.deepEqual(escritas[0], { metodo: 'PUT', valores: [...CABECALHO, '', '', ''] });
  assert.deepEqual(escritas[1], { metodo: 'POST', valores: ['l'] });
  // Sem a opção (aplicação do plano ao vivo), o cabeçalho que já existe não é tocado.
  escritas.length = 0;
  await acrescentarLinha(env, base, fetchFalso);
  assert.deepEqual(escritas.map((e) => e.metodo), ['POST']);
});
