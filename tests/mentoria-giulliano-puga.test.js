import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERGUNTAS, CABECALHO, TOTAL_ETAPAS, TEXTOS, validarResposta } from '../src/data/mentoria-giulliano-puga.js';
import { processarResposta } from '../functions/api/mentoria-giulliano-puga.js';
import { acrescentarLinha } from '../functions/api/_google-planilha.js';

const RESPOSTAS = {
  nome: 'Maria Silva',
  telefone: '(11) 98765-4321',
  email: 'maria@marcax.com.br',
  instagram: '@marcax',
  faturamento: 'R$ 30 a 70 mil',
  participa: 'Sim, eu vou',
};

const AGORA = Date.parse('2026-11-13T12:00:00Z');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

function pedido(corpo, ua = UA) {
  return new Request('https://x/api/mentoria-giulliano-puga', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'user-agent': ua, 'cf-connecting-ip': '200.10.20.30' },
    body: JSON.stringify(corpo),
  });
}

test('inscrição aberta: contato na primeira tela, faturamento e confirmação na segunda', () => {
  assert.deepEqual(PERGUNTAS.map((p) => p.name), ['nome', 'telefone', 'email', 'instagram', 'faturamento', 'participa']);
  assert.equal(TOTAL_ETAPAS, 2);
  assert.deepEqual(PERGUNTAS.map((p) => p.etapa), [1, 1, 1, 1, 2, 2]);
  assert.equal(PERGUNTAS.find((p) => p.name === 'faturamento').opcoes.length, 5);
  assert.deepEqual(CABECALHO, ['Data/hora', 'Nome', 'WhatsApp', 'E-mail', 'Instagram da marca', 'Faturamento', 'Vai participar', 'Origem']);
  // O link também vai para os stories: nada de "grupo gratuito" na página.
  assert.equal(/grupo gratuito/i.test(JSON.stringify(TEXTOS) + JSON.stringify(PERGUNTAS)), false);
  assert.equal(TEXTOS.obrigado.analise, undefined);
});

test('grupo gratuito: recusa e-mail torto, opção inventada e campo vazio', () => {
  assert.equal(validarResposta(RESPOSTAS).ok, true);
  assert.deepEqual(validarResposta({ ...RESPOSTAS, email: 'maria@' }), { ok: false, campo: 'email' });
  assert.deepEqual(validarResposta({ ...RESPOSTAS, participa: 'Talvez' }), { ok: false, campo: 'participa' });
  assert.deepEqual(validarResposta({ ...RESPOSTAS, faturamento: 'Muito' }), { ok: false, campo: 'faturamento' });
  assert.deepEqual(validarResposta({ ...RESPOSTAS, nome: ' ' }), { ok: false, campo: 'nome' });
});

test('grupo gratuito: POST válido grava na aba própria, com telefone padronizado', async () => {
  const chamadas = [];
  const r = await processarResposta({ request: pedido({ respostas: RESPOSTAS, origem: 'utm_source=grupo' }), env: {}, agoraMs: AGORA, gravar: async (_env, a) => chamadas.push(a) });
  assert.equal(r.status, 200);
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].planilha, '1a6l4mQIMlzi95TCX7NYcZjIXeJDGujAW9SLAflvfXEo');
  assert.equal(chamadas[0].aba, 'Inscrições');
  assert.deepEqual(chamadas[0].cabecalho, CABECALHO);
  assert.deepEqual(chamadas[0].linha, [
    '13/11/2026 09:00:00', 'Maria Silva', '5511987654321', 'maria@marcax.com.br', '@marcax', 'R$ 30 a 70 mil', 'Sim, eu vou', 'utm_source=grupo',
  ]);
});

test('grupo gratuito: telefone impossível devolve 400 e robô não vira linha', async () => {
  let gravou = false;
  const gravar = async () => { gravou = true; };
  const r1 = await processarResposta({ request: pedido({ respostas: { ...RESPOSTAS, telefone: '123' } }), env: {}, agoraMs: AGORA, gravar });
  assert.equal(r1.status, 400);
  assert.equal((await r1.json()).campo, 'telefone');
  const r2 = await processarResposta({ request: pedido({ respostas: RESPOSTAS }, 'python-requests/2.31'), env: {}, agoraMs: AGORA, gravar });
  assert.equal(r2.status, 200);
  assert.equal(gravou, false);
});

test('aba que não existe é criada, ganha o cabeçalho e recebe a linha', async () => {
  const { privateKey } = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign'],
  );
  const der = Buffer.from(await crypto.subtle.exportKey('pkcs8', privateKey)).toString('base64');
  const env = { GOOGLE_AGENDA_SA_JSON: JSON.stringify({ client_email: 'x@y', private_key: `-----BEGIN PRIVATE KEY-----\n${der}\n-----END PRIVATE KEY-----` }) };
  const passos = [];
  const fetchFalso = async (url, o) => {
    if (String(url).includes('oauth2')) return Response.json({ access_token: 't', expires_in: 3600 });
    if (o.method === 'GET') return Response.json({ error: { message: 'Unable to parse range' } }, { status: 400 });
    passos.push(String(url).includes(':batchUpdate') ? ['criar', JSON.parse(o.body).requests[0].addSheet.properties.title] : [o.method, JSON.parse(o.body).values[0]]);
    return Response.json({});
  };
  const base = { subject: 'teste-aba@x', planilha: 'p', aba: 'Grupo gratuito', cabecalho: CABECALHO, linha: ['l'] };
  await acrescentarLinha(env, { ...base, criarAba: true }, fetchFalso);
  assert.deepEqual(passos, [['criar', 'Grupo gratuito'], ['PUT', CABECALHO], ['POST', ['l']]]);
  // Sem a opção, aba inexistente continua sendo erro (nada é criado em silêncio).
  await assert.rejects(acrescentarLinha(env, base, fetchFalso));
});
