import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reconhecerCampanhasDoPeriodo,
  montarInvestimento,
  AVISO_NAO_FECHA,
  AVISO_SEM_REGISTRO_ATUALIZACAO,
} from '../functions/api/_feedback-marketing-investimento.js';

// Cadastro inicial (migration 0040), só com o que o reconhecimento usa.
const SE = { id: 1, nome: 'SE', funil_tracking: 'sessao-estrategica', trecho_campanha: null };
const LIVE = { id: 2, nome: 'LIVE', funil_tracking: 'lives-semanais-v1', trecho_campanha: null };
const WO = { id: 3, nome: 'WO PAGO', funil_tracking: null, trecho_campanha: 'workshop-pago' };
const AQ = { id: 4, nome: 'AQUISIÇÃO', funil_tracking: 'aquisicao', trecho_campanha: null };
const ATIVOS = [SE, LIVE, WO, AQ];
const CONHECIDOS = ['aplicacao-mentoria', 'diagnostico', 'lives-semanais-v1', 'sessao-estrategica', 'trafego-atacado', 'workshop'];
const ctx = (extra = {}) => ({ funisAtivos: ATIVOS, funisConhecidos: CONHECIDOS, ...extra });
const gasto = (campaign_id, campaign_name, spend_cents = 1000) => ({ campaign_id, campaign_name, spend_cents });
const resumo = (r) => r.campanhas.map((c) => [c.nome, c.bloco_id, c.reconhecida_por, c.motivo]);

test('reconhece por regra automática, trecho e impulsionamento, e liga ao bloco', () => {
  const r = reconhecerCampanhasDoPeriodo([
    gasto('1', 'ae_leads_publico-frio_conversao_sessao-estrategica', 15000),
    gasto('2', 'ae_leads_publico-frio_evento-lead_lives-semanais', 6035),
    gasto('3', 'ae_vendas-workshop-pago-23-09_publico-frio', 6000),
    gasto('4', 'Post do Instagram: live de terça', 500),
  ], ctx());
  assert.deepEqual(resumo(r), [
    ['ae_leads_publico-frio_conversao_sessao-estrategica', 1, 'automatica', null],
    ['ae_leads_publico-frio_evento-lead_lives-semanais', 2, 'automatica', null],
    ['ae_vendas-workshop-pago-23-09_publico-frio', 3, 'trecho', null],
    ['Post do Instagram: live de terça', 4, 'impulsionamento', null],
  ]);
  assert.deepEqual(r.campanhas[0], {
    campaign_id: '1', nome: 'ae_leads_publico-frio_conversao_sessao-estrategica', spend_cents: 15000,
    bloco_id: 1, reconhecida_por: 'automatica', motivo: null,
  });
  assert.deepEqual(r.avisos, []);
});

test('classificação manual vence o trecho e manda para o funil classificado', () => {
  const r = reconhecerCampanhasDoPeriodo(
    [gasto('3', 'ae_vendas-workshop-pago-23-09_publico-frio')],
    ctx({ overrides: [{ campaign_id: '3', funnel: 'sessao-estrategica' }] }),
  );
  assert.deepEqual(resumo(r), [['ae_vendas-workshop-pago-23-09_publico-frio', 1, 'manual', null]]);
});

test('venda na Greenn só recebe campanha pelo trecho; manual para funil sem bloco vai para sem funil', () => {
  const r = reconhecerCampanhasDoPeriodo([
    // Regra automática resolve `workshop` (gratuito): não vira WO PAGO.
    gasto('5', 'ae_vendas_publico-frio_conversao_workshop'),
    // Manual para funil sem bloco ativo vence o trecho do WO PAGO.
    gasto('6', 'ae_vendas-workshop-pago-23-09_publico-quente'),
  ], ctx({ overrides: [{ campaign_id: '6', funnel: 'workshop' }] }));
  assert.deepEqual(resumo(r), [
    ['ae_vendas_publico-frio_conversao_workshop', null, null, 'funil workshop não cadastrado no relatório'],
    ['ae_vendas-workshop-pago-23-09_publico-quente', null, null, 'funil workshop não cadastrado no relatório'],
  ]);
});

test('funil reconhecido sem bloco ativo e nada reconhecido vão para sem funil com o motivo', () => {
  const r = reconhecerCampanhasDoPeriodo([
    gasto('7', 'ae_leads_frio_conversao_trafego-atacado', 4210),
    gasto('8', 'ae_leads_frio_conversao_inexistente'),
    gasto('9', null, 100),
  ], ctx());
  assert.deepEqual(resumo(r), [
    ['ae_leads_frio_conversao_trafego-atacado', null, null, 'funil trafego-atacado não cadastrado no relatório'],
    ['ae_leads_frio_conversao_inexistente', null, null, 'nenhum funil reconhecido'],
    ['9', null, null, 'nenhum funil reconhecido'],
  ]);
});

test('trecho de dois funis ativos: sem funil, motivo e aviso geral, nunca o primeiro que casou', () => {
  const MENTORIA = { id: 5, nome: 'MENTORIA', funil_tracking: 'aplicacao-mentoria', trecho_campanha: 'mentoria-paga' };
  const r = reconhecerCampanhasDoPeriodo(
    [gasto('10', 'ae_vendas-workshop-pago_mentoria-paga')],
    ctx({ funisAtivos: [...ATIVOS, MENTORIA] }),
  );
  assert.deepEqual(resumo(r), [['ae_vendas-workshop-pago_mentoria-paga', null, null, 'casou com mais de um funil']]);
  assert.deepEqual(r.avisos, [
    "A campanha ae_vendas-workshop-pago_mentoria-paga casou com o trecho de mais de um funil (WO PAGO, MENTORIA) e foi para 'sem funil' — ajuste os trechos no cadastro de funis.",
  ]);
});

test('sem investimento não é listada; sem funil ativo tudo vai para sem funil; entrada vazia', () => {
  assert.deepEqual(reconhecerCampanhasDoPeriodo([gasto('1', 'ae_x_y_sessao-estrategica', 0)], ctx()).campanhas, []);
  const semAtivos = reconhecerCampanhasDoPeriodo([gasto('1', 'ae_x_y_sessao-estrategica')], ctx({ funisAtivos: [] }));
  assert.deepEqual(resumo(semAtivos), [['ae_x_y_sessao-estrategica', null, null, 'funil sessao-estrategica não cadastrado no relatório']]);
  assert.deepEqual(reconhecerCampanhasDoPeriodo(null), { campanhas: [], avisos: [] });
});

// ---- Issue 256: soma por bloco ----

const unix = (iso) => Date.parse(iso) / 1000;
const DIA_14 = { inicio: '2026-09-14', fim: '2026-09-14' };
// 15/09 06:00 de Brasília: sincronizou depois do fim do dia 14.
const SYNC_EM_DIA = unix('2026-09-15T09:00:00Z');

function montar(gastos, { periodo = DIA_14, ultima = SYNC_EM_DIA, extra = {} } = {}) {
  const { campanhas } = reconhecerCampanhasDoPeriodo(gastos, ctx(extra));
  return montarInvestimento({ gastos, campanhas, funisAtivos: ATIVOS, ultimaAtualizacaoUnix: ultima, periodo });
}

test('soma por bloco em centavos; investido geral inclui o sem funil', () => {
  const r = montar([
    gasto('1', 'ae_leads_publico-frio_conversao_sessao-estrategica', 15000),
    gasto('2', 'ae_leads_publico-quente_conversao_sessao-estrategica', 5010),
    gasto('3', 'ae_leads_publico-frio_evento-lead_lives-semanais', 6035),
    gasto('4', 'ae_vendas-workshop-pago-23-09_publico-frio', 6000),
    gasto('5', 'ae_leads_frio_conversao_trafego-atacado', 4210),
  ]);
  assert.equal(r.investido_geral, 362.55);
  assert.deepEqual(r.blocos.get(1), {
    investido: 200.1,
    sem_investimento: false,
    campanhas: [
      { nome: 'ae_leads_publico-frio_conversao_sessao-estrategica', valor: 150, reconhecida_por: 'automatica' },
      { nome: 'ae_leads_publico-quente_conversao_sessao-estrategica', valor: 50.1, reconhecida_por: 'automatica' },
    ],
  });
  assert.equal(r.blocos.get(2).investido, 60.35);
  assert.deepEqual(r.blocos.get(3).campanhas, [{ nome: 'ae_vendas-workshop-pago-23-09_publico-frio', valor: 60, reconhecida_por: 'trecho' }]);
  assert.deepEqual(r.blocos.get(4), { investido: 0, sem_investimento: true, campanhas: [] });
  assert.deepEqual(r.sem_funil, {
    investido: 42.1,
    campanhas: [{ nome: 'ae_leads_frio_conversao_trafego-atacado', valor: 42.1, motivo: 'funil trafego-atacado não cadastrado no relatório' }],
  });
  assert.equal(r.investimento_atualizado_em, '2026-09-15T06:00:00-03:00');
  assert.deepEqual(r.avisos, []);
});

test('período sem investimento: tudo 0, sem campanhas e sem aviso', () => {
  const r = montar([]);
  assert.equal(r.investido_geral, 0);
  for (const f of ATIVOS) assert.deepEqual(r.blocos.get(f.id), { investido: 0, sem_investimento: true, campanhas: [] });
  assert.deepEqual(r.sem_funil, { investido: 0, campanhas: [] });
  assert.deepEqual(r.avisos, []);
});

test('investimento desatualizado, sem registro e período parcial avisam', () => {
  // 14/09 18:12 de Brasília: antes do fim do dia 14.
  const atrasado = montar([], { ultima: unix('2026-09-14T21:12:00Z') });
  assert.deepEqual(atrasado.avisos, ['O investimento foi atualizado pela última vez em 14/09/2026 18:12 — pode estar incompleto.']);
  assert.equal(atrasado.investimento_atualizado_em, '2026-09-14T18:12:00-03:00');

  const semRegistro = montar([], { ultima: null });
  assert.deepEqual([semRegistro.avisos, semRegistro.investimento_atualizado_em], [[AVISO_SEM_REGISTRO_ATUALIZACAO], null]);

  // Hoje ainda não fechou: a última sincronização é sempre anterior ao fim do dia.
  const parcial = montar([], { periodo: { inicio: '2026-09-15', fim: '2026-09-15' } });
  assert.deepEqual(parcial.avisos, ['O investimento foi atualizado pela última vez em 15/09/2026 06:00 — pode estar incompleto.']);

  // Exatamente na meia-noite que fecha o período: em dia, e sem "24:00".
  const meiaNoite = montar([], { ultima: unix('2026-09-15T03:00:00Z') });
  assert.deepEqual([meiaNoite.avisos, meiaNoite.investimento_atualizado_em], [[], '2026-09-15T00:00:00-03:00']);
});

test('dinheiro que não foi para bloco nem para sem funil dispara o aviso de fechamento', () => {
  const r = montar([
    gasto('1', 'ae_leads_publico-frio_conversao_sessao-estrategica', 15000),
    // Estorno maior que o gasto no período: soma negativa, não é listada.
    gasto('2', 'ae_leads_frio_conversao_trafego-atacado', -500),
  ]);
  assert.equal(r.investido_geral, 145);
  assert.equal(r.blocos.get(1).investido, 150);
  assert.deepEqual(r.avisos, [AVISO_NAO_FECHA]);
});
