import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { montarListaFunis, lerOpcoesCrmGravadas, AVISO_VAZIO, trocaDePosicao, confirmacaoArquivar } from '../functions/api/_funis-relatorio.js';
import { onRequestPost } from '../functions/api/funis-relatorio.js';

const SESSAO = { id: 'a158', nome: 'SESSÃO ESTRATÉGICA' };
const WO = { id: '4208', nome: 'WO PAGO' };

const funil = (id, extra = {}) => ({
  id,
  nome: `F${id}`,
  tipo: 'lead_mql',
  funil_tracking: `funil-${id}`,
  opcoes_crm: JSON.stringify([SESSAO]),
  origem_lead: 'trafego_pago',
  trecho_campanha: null,
  situacao: 'ativo',
  posicao: id,
  versao: 1,
  alterado_em: 1000 + id,
  ...extra,
});

test('ativos saem na ordem do relatório, não na ordem de leitura', () => {
  const r = montarListaFunis([funil(1, { posicao: 3 }), funil(2, { posicao: 1 }), funil(3, { posicao: 2 })]);
  assert.deepEqual(r.rows.map((l) => l.id), [2, 3, 1]);
  assert.equal(r.total_ativos, 3);
  assert.equal(r.aviso_vazio, null);
});

test('padrão "ativos" não traz arquivados', () => {
  const r = montarListaFunis([funil(1), funil(2, { situacao: 'arquivado', posicao: null })]);
  assert.deepEqual(r.rows.map((l) => l.id), [1]);
});

test('"todos" traz os arquivados abaixo dos ativos, marcados e sem posição', () => {
  const r = montarListaFunis([
    funil(1, { situacao: 'arquivado', posicao: null, alterado_em: 10 }),
    funil(2, { posicao: 1 }),
    funil(3, { situacao: 'arquivado', posicao: null, alterado_em: 20 }),
  ], { situacao: 'todos' });
  assert.deepEqual(r.rows.map((l) => [l.id, l.situacao, l.posicao]), [[2, 'ativo', 1], [3, 'arquivado', null], [1, 'arquivado', null]]);
  assert.equal(r.total_ativos, 1);
});

test('rótulos de tipo e origem vêm prontos; origem ausente vira null', () => {
  const r = montarListaFunis([
    funil(1, { tipo: 'lead_mql', origem_lead: 'exceto_trafego_pago' }),
    funil(2, { tipo: 'manual', origem_lead: null }),
    funil(3, { tipo: 'venda_greenn', origem_lead: null, trecho_campanha: 'workshop-pago' }),
  ]);
  assert.deepEqual(r.rows.map((l) => [l.tipo_rotulo, l.origem_rotulo, l.trecho_campanha]), [
    ['Lead do formulário + MQL', 'Qualquer origem exceto tráfego pago', null],
    ['Manual', null, null],
    ['Venda na Greenn', null, 'workshop-pago'],
  ]);
});

test('funil de venda na Greenn sai sem funil do tracking (null), sem quebrar a lista', () => {
  const r = montarListaFunis([
    funil(1, { tipo: 'venda_greenn', funil_tracking: null, origem_lead: null, trecho_campanha: 'workshop-pago' }),
    funil(2, { funil_tracking: 'sessao-estrategica' }),
  ]);
  assert.deepEqual(r.rows.map((l) => l.funil_tracking), [null, 'sessao-estrategica']);
});

test('opção cadastrada que sumiu do CRM é marcada como inexistente', () => {
  const r = montarListaFunis([funil(1, { opcoes_crm: JSON.stringify([SESSAO, WO]) })], { opcoesCrm: [SESSAO] });
  assert.deepEqual(r.rows[0].opcoes_crm, [
    { id: 'a158', nome: 'SESSÃO ESTRATÉGICA', existe: true },
    { id: '4208', nome: 'WO PAGO', existe: false },
  ]);
});

test('CRM sem resposta: não afirma que a opção sumiu (existe = null)', () => {
  const r = montarListaFunis([funil(1)], { opcoesCrm: null });
  assert.equal(r.rows[0].opcoes_crm[0].existe, null);
});

test('sem funil ativo devolve o estado vazio, mesmo com arquivados em "todos"', () => {
  assert.deepEqual(montarListaFunis([]), { rows: [], total_ativos: 0, aviso_vazio: AVISO_VAZIO });
  const r = montarListaFunis([funil(1, { situacao: 'arquivado', posicao: null })], { situacao: 'todos' });
  assert.equal(r.rows.length, 1);
  assert.equal(r.aviso_vazio, AVISO_VAZIO);
});

test('opcoes_crm ilegível não derruba a lista', () => {
  assert.deepEqual(lerOpcoesCrmGravadas('não é json'), []);
  assert.deepEqual(lerOpcoesCrmGravadas('{"id":"x"}'), []);
  assert.deepEqual(lerOpcoesCrmGravadas(null), []);
  const r = montarListaFunis([funil(1, { opcoes_crm: '{' })]);
  assert.deepEqual(r.rows[0].opcoes_crm, []);
});

// ---------- subir/descer (issue 249) ----------

test('troca de posição: acha o vizinho ativo na ordem do relatório', () => {
  const linhas = [funil(1, { posicao: 2 }), funil(2, { posicao: 1 }), funil(3, { posicao: 3 }), funil(4, { situacao: 'arquivado', posicao: null })];
  assert.deepEqual(trocaDePosicao(linhas, 1, 'subir'), { a: { id: 1, posicao: 2 }, b: { id: 2, posicao: 1 } });
  assert.deepEqual(trocaDePosicao(linhas, 1, 'descer'), { a: { id: 1, posicao: 2 }, b: { id: 3, posicao: 3 } });
});

test('troca de posição: pontas, arquivado, inexistente ou direção inválida não trocam', () => {
  const linhas = [funil(1, { posicao: 1 }), funil(2, { posicao: 2 }), funil(3, { situacao: 'arquivado', posicao: null })];
  assert.equal(trocaDePosicao(linhas, 1, 'subir'), null);
  assert.equal(trocaDePosicao(linhas, 2, 'descer'), null);
  assert.equal(trocaDePosicao(linhas, 3, 'subir'), null);
  assert.equal(trocaDePosicao(linhas, 99, 'descer'), null);
  assert.equal(trocaDePosicao(linhas, 1, 'lado'), null);
  assert.equal(trocaDePosicao(null, 1, 'descer'), null);
});

// ---------- arquivar (issue 250) ----------

test('confirmação de arquivar traz o nome do bloco e a consequência', () => {
  assert.equal(
    confirmacaoArquivar('LIVE'),
    "O bloco LIVE sai do relatório. O investimento e os leads dele passam a aparecer em 'sem funil', inclusive se um dia passado for consultado de novo.",
  );
});

// ---------- migrations 0039/0040 e gravação no SQLite (ajustes pós-revisão) ----------

const MIG_0039 = readFileSync(new URL('../migrations/0039_funis_relatorio.sql', import.meta.url), 'utf8');
const MIG_0040 = readFileSync(new URL('../migrations/0040_funis_relatorio_cadastro_inicial.sql', import.meta.url), 'utf8');

function bancoSemeado() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(MIG_0039);
  sqlite.exec(MIG_0040);
  return sqlite;
}

// D1 mínimo sobre node:sqlite. `aoLerCadastro` segura a leitura do cadastro
// (lerLinhas) para duas requisições lerem o mesmo estado antes de gravar.
function d1(sqlite, { aoLerCadastro = null } = {}) {
  const stmt = (sql, binds = []) => ({
    bind: (...b) => stmt(sql, b),
    async all() {
      if (aoLerCadastro && /^\s*SELECT id, nome, tipo/.test(sql)) await aoLerCadastro();
      return { results: sqlite.prepare(sql).all(...binds) };
    },
    async run() {
      const r = sqlite.prepare(sql).run(...binds);
      return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } };
    },
  });
  return { prepare: (sql) => stmt(sql) };
}

// Libera as leituras só quando `n` requisições já leram; as seguintes passam direto.
function barreira(n) {
  const fila = [];
  return () => new Promise((liberar) => {
    if (fila.length >= n) return liberar();
    fila.push(liberar);
    if (fila.length === n) fila.forEach((f) => f());
  });
}

const post = (env, corpo) => onRequestPost({
  env,
  request: new Request('https://x/api/funis-relatorio?key=k', { method: 'POST', body: JSON.stringify(corpo) }),
}).then((r) => r.json());

test('0039 e 0040 reaplicam sem erro e sem duplicar o cadastro inicial', () => {
  const sqlite = bancoSemeado();
  sqlite.exec(MIG_0039);
  sqlite.exec(MIG_0040);
  const linhas = sqlite.prepare('SELECT nome, tipo, origem_lead, posicao FROM funis_relatorio ORDER BY posicao').all();
  assert.deepEqual(linhas.map((l) => [l.nome, l.tipo, l.origem_lead, l.posicao]), [
    ['SE', 'lead_mql', 'trafego_pago', 1],
    ['LIVE', 'manual', null, 2],
    ['WO PAGO', 'venda_greenn', null, 3],
    ['AQUISIÇÃO', 'lead_mql', 'exceto_trafego_pago', 4],
  ]);
});

test('0039: origem só no lead_mql e no máximo um venda_greenn ativo', () => {
  const sqlite = bancoSemeado();
  const inserir = (nome, tipo, funil, origem, situacao = 'ativo') => sqlite.prepare(`
    INSERT INTO funis_relatorio (nome, tipo, funil_tracking, opcoes_crm, origem_lead, situacao, posicao, criado_em, alterado_em)
    VALUES (?, ?, ?, '[]', ?, ?, NULL, 1, 1)
  `).run(nome, tipo, funil, origem, situacao);
  assert.throws(() => inserir('A', 'lead_mql', 'x', null), /CHECK constraint failed/);
  assert.throws(() => inserir('B', 'manual', 'x', 'qualquer'), /CHECK constraint failed/);
  assert.throws(() => inserir('C', 'venda_greenn', null, 'qualquer', 'arquivado'), /CHECK constraint failed/);
  assert.throws(() => inserir('D', 'venda_greenn', null, null), /UNIQUE constraint failed: funis_relatorio\.tipo/);
  // Arquivado não conta para a unicidade.
  inserir('E', 'venda_greenn', null, null, 'arquivado');
  inserir('F', 'venda_greenn', null, null, 'arquivado');
});

test('arquivar o mesmo funil duas vezes ao mesmo tempo compacta a ordem uma vez só', async () => {
  const sqlite = bancoSemeado();
  const env = { DASH_KEY: 'k', DB: d1(sqlite, { aoLerCadastro: barreira(2) }) };
  const respostas = await Promise.all([
    post(env, { acao: 'arquivar', id: 2, confirmado: true }),
    post(env, { acao: 'arquivar', id: 2, confirmado: true }),
  ]);
  assert.deepEqual(respostas.map((r) => r.arquivado).sort(), [false, true]);
  const linhas = sqlite.prepare('SELECT nome, situacao, posicao, versao FROM funis_relatorio ORDER BY id').all();
  assert.deepEqual(linhas.map((l) => [l.nome, l.situacao, l.posicao, l.versao]), [
    ['SE', 'ativo', 1, 1],
    ['LIVE', 'arquivado', null, 2],
    ['WO PAGO', 'ativo', 2, 1],
    ['AQUISIÇÃO', 'ativo', 3, 1],
  ]);
});

test('reativar dois funis de venda ao mesmo tempo: o índice recusa o segundo com a mensagem da spec', async () => {
  const sqlite = bancoSemeado();
  sqlite.exec(`
    UPDATE funis_relatorio SET situacao = 'arquivado', posicao = NULL WHERE nome = 'WO PAGO';
    UPDATE funis_relatorio SET posicao = 3 WHERE nome = 'AQUISIÇÃO';
    INSERT INTO funis_relatorio (nome, tipo, funil_tracking, opcoes_crm, origem_lead, situacao, posicao, criado_em, alterado_em)
    VALUES ('WO NOVO', 'venda_greenn', NULL, '[{"id":"420877c7-44de-4d46-a934-718889443f49","nome":"WO PAGO"}]', NULL, 'arquivado', NULL, 1, 1);
  `);
  const [wo, novo] = sqlite.prepare("SELECT id FROM funis_relatorio WHERE tipo = 'venda_greenn' ORDER BY id").all().map((l) => l.id);
  const env = { DASH_KEY: 'k', DB: d1(sqlite, { aoLerCadastro: barreira(2) }) };
  const respostas = await Promise.all([
    post(env, { acao: 'reativar', id: wo }),
    post(env, { acao: 'reativar', id: novo }),
  ]);
  const ativo = sqlite.prepare("SELECT nome FROM funis_relatorio WHERE tipo = 'venda_greenn' AND situacao = 'ativo'").all();
  assert.equal(ativo.length, 1);
  assert.equal(respostas.filter((r) => r.reativado === true).length, 1);
  assert.deepEqual(respostas.filter((r) => r.error).map((r) => r.error), [
    `Já existe um funil de venda na Greenn (${ativo[0].nome}). Hoje as vendas da Greenn não são separadas por produto.`,
  ]);
});
