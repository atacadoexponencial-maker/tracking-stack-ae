import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// public/_routes.json tira da Function os arquivos estáticos (revisão de
// desperdício, 16/10/2026). Excluir um caminho que tem Function própria
// quebraria a rota em silêncio: o Pages serviria 404 estático no lugar dela.
const rotas = JSON.parse(readFileSync('public/_routes.json', 'utf8'));

function rotasDasFunctions(dir = 'functions') {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) { saida.push(...rotasDasFunctions(caminho)); continue; }
    if (!nome.endsWith('.js') || nome.startsWith('_')) continue;
    const rel = '/' + relative('functions', caminho).split('\\').join('/').replace(/\.js$/, '');
    saida.push(rel.replace(/\/index$/, '') || '/');
  }
  return saida;
}

const casa = (padrao, rota) => padrao.endsWith('/*') ? (rota + '/').startsWith(padrao.slice(0, -1)) : rota === padrao;

test('_routes.json: formato que o Pages aceita, com a Function no resto do site', () => {
  assert.equal(rotas.version, 1);
  assert.deepEqual(rotas.include, ['/*']);
  assert.ok(rotas.exclude.length > 0 && rotas.exclude.length <= 99);
  for (const p of rotas.exclude) assert.ok(p.startsWith('/'), p);
});

test('_routes.json: nenhum caminho excluído cobre uma rota de functions/', () => {
  const funcoes = rotasDasFunctions();
  assert.ok(funcoes.includes('/tracker') && funcoes.some((r) => r.startsWith('/scripts/')));
  for (const padrao of rotas.exclude) {
    for (const rota of funcoes) assert.ok(!casa(padrao, rota), `${padrao} cobre a Function ${rota}`);
  }
});
