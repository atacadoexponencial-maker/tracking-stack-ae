import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERGUNTAS, CABECALHO, TOTAL_ETAPAS, validarResposta } from '../src/data/hotseat-giulliano-puga.js';
import { processarResposta } from '../functions/api/hotseat-giulliano-puga.js';

const RESPOSTAS = {
  nome: 'Maria Silva',
  telefone: '(11) 98765-4321',
  email: 'maria@marcax.com.br',
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

test('6 perguntas na ordem pedida e cabeçalho com data e origem', () => {
  assert.deepEqual(PERGUNTAS.map((p) => p.name), ['nome', 'telefone', 'email', 'instagram', 'participa', 'analise']);
  assert.deepEqual(PERGUNTAS.map((p) => p.etapa), [1, 1, 1, 1, 2, 3]);
  assert.equal(TOTAL_ETAPAS, 3);
  assert.deepEqual(CABECALHO, ['Data/hora', 'Nome', 'WhatsApp', 'E-mail', 'Instagram da marca', 'Vai participar', 'Quer análise', 'Origem']);
});

test('validação: recusa e-mail torto, opção inventada, campo vazio e texto gigante', () => {
  assert.equal(validarResposta(RESPOSTAS).ok, true);
  assert.deepEqual(validarResposta({ ...RESPOSTAS, email: 'maria@' }), { ok: false, campo: 'email' });
  assert.deepEqual(validarResposta({ ...RESPOSTAS, participa: 'Talvez' }), { ok: false, campo: 'participa' });
  assert.deepEqual(validarResposta({ ...RESPOSTAS, analise: '' }), { ok: false, campo: 'analise' });
  assert.deepEqual(validarResposta({ ...RESPOSTAS, nome: ' ' }), { ok: false, campo: 'nome' });
  assert.deepEqual(validarResposta({ ...RESPOSTAS, instagram: 'x'.repeat(500) }), { ok: false, campo: 'instagram' });
  assert.deepEqual(validarResposta(null), { ok: false, campo: 'nome' });
});

test('POST válido grava uma linha com telefone padronizado e hora de Brasília', async () => {
  const chamadas = [];
  const r = await processarResposta({ request: pedido({ respostas: RESPOSTAS, origem: 'utm_source=grupo' }), env: {}, agoraMs: AGORA, gravar: async (_env, a) => chamadas.push(a) });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
  assert.equal(chamadas.length, 1);
  assert.deepEqual(chamadas[0].cabecalho, CABECALHO);
  assert.deepEqual(chamadas[0].linha, [
    '12/11/2026 09:00:00', 'Maria Silva', '5511987654321', 'maria@marcax.com.br', '@marcax',
    'Sim, eu vou', 'Sim, quero', 'utm_source=grupo',
  ]);
});

test('campo inválido devolve 400 com o campo e nada é gravado', async () => {
  let gravou = false;
  const gravar = async () => { gravou = true; };
  const r1 = await processarResposta({ request: pedido({ respostas: { ...RESPOSTAS, telefone: '123' } }), env: {}, agoraMs: AGORA, gravar });
  assert.equal(r1.status, 400);
  assert.equal((await r1.json()).campo, 'telefone');
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
