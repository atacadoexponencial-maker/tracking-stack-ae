// Regras puras da agenda própria (spec-agenda-propria.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarGrade, resumoGrade, validarTipo, horariosLivres, validarDadosAgendamento,
  situacaoPelaPresenca, emCimaDaHora, numerosDoPeriodo, tituloDoEvento,
} from '../functions/api/_agenda-regras.js';
import { padronizarTelefone } from '../functions/_telefone.js';

// 2026-10-05 é uma segunda-feira. 09:00 BRT = 12:00 UTC.
const T = (iso) => Math.floor(Date.parse(iso) / 1000);
const SEG_8H = T('2026-10-05T08:00:00-03:00');

const tipoBase = {
  duracao_min: 45, intervalo_min: 30, folga_antes_min: 0, folga_depois_min: 0,
  antecedencia_min: 0, janela_dias: 30, limite_dia: null,
};
const gradeSeg = { faixas: { 1: [['09:00', '11:00']] }, datas: {} };

test('grade: valida faixas e rejeita sobreposição', () => {
  assert.ok(validarGrade({ nome: 'A', faixas: { 1: [['09:00', '12:00'], ['13:00', '18:00']] } }).grade);
  assert.match(validarGrade({ nome: 'A', faixas: { 1: [['09:00', '12:00'], ['11:00', '13:00']] } }).erro, /sobrepostas/);
  assert.match(validarGrade({ nome: 'A', faixas: { 1: [['12:00', '09:00']] } }).erro, /depois do início/);
  assert.match(validarGrade({ nome: '' }).erro, /nome/);
  assert.match(validarGrade({ nome: 'A', datas: { '2026-13': [] } }).erro, /Data inválida/);
});

test('grade: resumo agrupa dias vizinhos iguais', () => {
  const r = resumoGrade({ 2: [['09:30', '12:00']], 3: [['09:30', '12:00']], 4: [['09:30', '12:00']], 1: [['14:00', '21:00']] });
  assert.equal(r, 'seg 14:00–21:00 · ter a qui 09:30–12:00');
  assert.equal(resumoGrade({}), 'sem horários');
});

test('horários: faixa com passo de 30 e duração de 45', () => {
  const h = horariosLivres({ tipo: tipoBase, grade: gradeSeg, agora: SEG_8H, de: '2026-10-05', ate: '2026-10-05' });
  // 09:00, 09:30, 10:00 cabem (10:00+45 = 10:45 <= 11:00); 10:30 não.
  assert.deepEqual(h['2026-10-05'], [T('2026-10-05T09:00:00-03:00'), T('2026-10-05T09:30:00-03:00'), T('2026-10-05T10:00:00-03:00')]);
});

test('horários: ocupado e folga bloqueiam', () => {
  const ocupados = [{ ini: T('2026-10-05T10:00:00-03:00'), fim: T('2026-10-05T10:30:00-03:00') }];
  const h = horariosLivres({ tipo: { ...tipoBase, folga_depois_min: 15 }, grade: gradeSeg, ocupados, agora: SEG_8H, de: '2026-10-05', ate: '2026-10-05' });
  // 09:00–09:45 +15 folga = 10:00 → não encosta; 09:30 bate; 10:00 bate.
  assert.deepEqual(h['2026-10-05'], [T('2026-10-05T09:00:00-03:00')]);
});

test('horários: antecedência mínima e janela', () => {
  const h = horariosLivres({ tipo: { ...tipoBase, antecedencia_min: 120 }, grade: gradeSeg, agora: SEG_8H, de: '2026-10-05', ate: '2026-10-05' });
  assert.deepEqual(h['2026-10-05'], [T('2026-10-05T10:00:00-03:00')]);
  const j = horariosLivres({ tipo: { ...tipoBase, janela_dias: 1 }, grade: gradeSeg, agora: SEG_8H, de: '2026-10-05', ate: '2026-10-20' });
  assert.deepEqual(Object.keys(j), ['2026-10-05']);
});

test('horários: data bloqueada, exceção de data e limite por dia', () => {
  const grade = { faixas: { 1: [['09:00', '11:00']], 2: [['09:00', '10:00']] }, datas: { '2026-10-05': [], '2026-10-06': [['15:00', '16:00']] } };
  const h = horariosLivres({ tipo: tipoBase, grade, agora: SEG_8H, de: '2026-10-05', ate: '2026-10-06' });
  assert.equal(h['2026-10-05'], undefined);
  assert.deepEqual(h['2026-10-06'], [T('2026-10-06T15:00:00-03:00')]);
  const l = horariosLivres({ tipo: { ...tipoBase, limite_dia: 2 }, grade: gradeSeg, reunioesNoDia: { '2026-10-05': 2 }, agora: SEG_8H, de: '2026-10-05', ate: '2026-10-05' });
  assert.deepEqual(l, {});
});

test('horários: remarcar ignora o próprio horário', () => {
  const proprio = { ini: T('2026-10-05T09:00:00-03:00'), fim: T('2026-10-05T09:45:00-03:00') };
  const h = horariosLivres({ tipo: tipoBase, grade: gradeSeg, ocupados: [proprio], ignorar: proprio, agora: SEG_8H, de: '2026-10-05', ate: '2026-10-05' });
  assert.equal(h['2026-10-05'][0], proprio.ini);
});

test('tipo: validação', () => {
  const ctx = { calendarios: new Set(['cal1']), grades: new Set([1]), funis: new Set(['sessao-estrategica']) };
  const base = { nome: 'Consultoria', slug: 'consultoria-individual', duracao_min: 45, destino_cal: 'cal1', conflito_cals: ['cal1'], grade_id: 1, janela_dias: 30, intervalo_min: 30, comercial: true, funil: 'sessao-estrategica' };
  const ok = validarTipo(base, ctx);
  assert.ok(ok.tipo);
  assert.equal(ok.tipo.comercial, 1);
  assert.match(validarTipo({ ...base, slug: 'Com Espaço' }, ctx).erro, /Endereço/);
  assert.match(validarTipo({ ...base, funil: '' }, ctx).erro, /funil/);
  assert.equal(validarTipo({ ...base, comercial: false, funil: '' }, ctx).tipo.funil, null);
  assert.match(validarTipo({ ...base, destino_cal: 'x' }, ctx).erro, /destino/);
  assert.match(validarTipo({ ...base, perguntas: [{ texto: 'Fat?', tipo: 'escolha', opcoes: ['a'] }] }, ctx).erro, /2 opções/);
});

test('agendamento: valida dados e respostas', () => {
  const perguntas = [{ texto: 'Faturamento?', tipo: 'escolha', opcoes: ['A', 'B'], obrigatoria: true }];
  const r = validarDadosAgendamento({ nome: 'Ana', email: 'ANA@x.com', telefone: '(11) 98765-4321', respostas: ['A'] }, perguntas, padronizarTelefone);
  assert.equal(r.dados.email, 'ana@x.com');
  assert.equal(r.dados.telefone, '5511987654321');
  const e = validarDadosAgendamento({ nome: 'A', email: 'x', telefone: '12', respostas: ['C'] }, perguntas, padronizarTelefone);
  assert.deepEqual(Object.keys(e.erros).sort(), ['email', 'nome', 'p0', 'telefone']);
});

test('presença pelo Meet', () => {
  assert.equal(situacaoPelaPresenca(null), 'sem_info');
  assert.equal(situacaoPelaPresenca([{ usuario: 'users/102068618279730112556' }]), 'faltou');
  assert.equal(situacaoPelaPresenca([{ usuario: 'users/102068618279730112556' }, { usuario: '', nome: 'Lead' }]), 'realizada');
  assert.equal(situacaoPelaPresenca([]), 'faltou');
});

test('em cima da hora, números e título', () => {
  assert.equal(emCimaDaHora(1000 + 3600, 120, 1000), true);
  assert.equal(emCimaDaHora(1000 + 3 * 3600, 120, 1000), false);
  const n = numerosDoPeriodo([{ situacao: 'realizada' }, { situacao: 'faltou' }, { situacao: 'cancelada' }, { situacao: 'marcada' }]);
  assert.equal(n.agendados, 4);
  assert.equal(n.taxa_comparecimento, 0.5);
  assert.equal(tituloDoEvento('{nome} e AE', 'Ana'), 'Ana e AE');
});
