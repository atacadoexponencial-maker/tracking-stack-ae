import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERGUNTAS, CABECALHO, TOTAL_ETAPAS, ENCERRA_EM_MS, aplicacoesAbertas, validarAplicacao,
} from '../src/data/aplicacao-plano-ao-vivo.js';
import { processarAplicacao } from '../functions/api/aplicacao-plano-ao-vivo.js';

const RESPOSTAS = {
  nome: 'Maria Silva',
  telefone: '(11) 98765-4321',
  marca: 'Marca X @marcax',
  vende: 'moda feminina',
  faturamento: 'R$ 70 a 150 mil',
  publico: ['Distribuidor', 'Lojista'],
  entrada: ['Indicação'],
  investimento: 'Até R$ 3 mil',
  comercial: '2 a 4',
  recompra: 'Mais da metade',
  trava: '=HYPERLINK("x") falta gente',
  ao_vivo: 'Sim, mas sem números exatos',
  disponivel: 'Sim',
};

const ANTES = Date.parse('2026-10-06T12:00:00Z');
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

function pedido(corpo, ua = UA) {
  return new Request('https://x/api/aplicacao-plano-ao-vivo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'user-agent': ua, 'cf-connecting-ip': '200.10.20.30' },
    body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
  });
}

test('13 perguntas, names únicos, 4 etapas', () => {
  assert.equal(PERGUNTAS.length, 13);
  assert.equal(new Set(PERGUNTAS.map((p) => p.name)).size, 13);
  assert.deepEqual([...new Set(PERGUNTAS.map((p) => p.etapa))], [1, 2, 3, 4]);
  assert.equal(TOTAL_ETAPAS, 4);
  assert.equal(CABECALHO.length, 15);
});

test('6 e 7 aceitam várias opções', () => {
  const varias = PERGUNTAS.filter((p) => p.tipo === 'varias').map((p) => p.name);
  assert.deepEqual(varias, ['publico', 'entrada']);
});

test('encerra em 06/10 às 23h59 de Brasília', () => {
  assert.equal(aplicacoesAbertas(Date.parse('2026-10-06T23:59:00-03:00')), true);
  assert.equal(aplicacoesAbertas(Date.parse('2026-10-07T00:00:00-03:00')), false);
  assert.equal(ENCERRA_EM_MS, Date.parse('2026-10-07T00:00:00-03:00'));
});

test('validação: ordem das opções múltiplas segue a lista; opção inventada é recusada', () => {
  const v = validarAplicacao(RESPOSTAS);
  assert.equal(v.ok, true);
  assert.equal(v.valores.publico, 'Lojista, Distribuidor');
  assert.deepEqual(validarAplicacao({ ...RESPOSTAS, faturamento: 'R$ 1 milhão' }), { ok: false, campo: 'faturamento' });
  assert.deepEqual(validarAplicacao({ ...RESPOSTAS, entrada: [] }), { ok: false, campo: 'entrada' });
  assert.deepEqual(validarAplicacao({ ...RESPOSTAS, nome: ' ' }), { ok: false, campo: 'nome' });
  assert.deepEqual(validarAplicacao({ ...RESPOSTAS, marca: 'x'.repeat(500) }), { ok: false, campo: 'marca' });
});

test('POST válido grava uma linha com cabeçalho e telefone padronizado', async () => {
  const chamadas = [];
  const r = await processarAplicacao({ request: pedido({ respostas: RESPOSTAS, origem: 'utm_source=grupo' }), env: {}, agoraMs: ANTES, gravar: async (_env, a) => chamadas.push(a) });
  assert.equal(r.status, 200);
  assert.equal(chamadas.length, 1);
  const { linha, cabecalho } = chamadas[0];
  assert.equal(linha.length, cabecalho.length);
  assert.equal(linha[0], '06/10/2026 09:00:00');
  assert.equal(linha[2], '5511987654321');
  assert.equal(linha[11], '=HYPERLINK("x") falta gente');
  assert.equal(linha[14], 'utm_source=grupo');
});

test('depois do prazo: 410 encerrada e nada gravado', async () => {
  let gravou = false;
  const r = await processarAplicacao({ request: pedido({ respostas: RESPOSTAS }), env: {}, agoraMs: ENCERRA_EM_MS, gravar: async () => { gravou = true; } });
  assert.equal(r.status, 410);
  assert.equal((await r.json()).encerrada, true);
  assert.equal(gravou, false);
});

test('campo inválido devolve 400 com o campo; robô recebe ok sem gravar', async () => {
  let gravou = false;
  const gravar = async () => { gravou = true; };
  const r1 = await processarAplicacao({ request: pedido({ respostas: { ...RESPOSTAS, telefone: '123' } }), env: {}, agoraMs: ANTES, gravar });
  assert.equal(r1.status, 400);
  assert.equal((await r1.json()).campo, 'telefone');
  const r2 = await processarAplicacao({ request: pedido({ respostas: RESPOSTAS }, 'python-requests/2.31'), env: {}, agoraMs: ANTES, gravar });
  assert.equal(r2.status, 200);
  assert.equal(gravou, false);
});

test('falha do Google vira 502 para a página pedir de novo', async () => {
  const r = await processarAplicacao({ request: pedido({ respostas: RESPOSTAS }), env: {}, agoraMs: ANTES, gravar: async () => { throw new Error('fora'); } });
  assert.equal(r.status, 502);
});
