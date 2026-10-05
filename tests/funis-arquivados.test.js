// Funis arquivados (05/10/2026): o arquivado continua dono das próprias
// campanhas e leads (o histórico não vira "sem funil"), o ativo vence em
// conflito, e ele só aparece no período em que teve movimento.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconhecerCampanha, listarConflitosCampanhas } from '../functions/api/_funis-relatorio-conflitos.js';
import { atribuirCards } from '../functions/api/_feedback-marketing-crm.js';
import { arquivadoTemMovimento } from '../functions/api/_feedback-marketing-blocos.js';
import { funisDesativados } from '../functions/api/_funis-relatorio.js';
import { montarPacote } from '../functions/api/_argo-relatorio-pacote.js';
import { janelasDoRelatorio } from '../functions/api/_argo-relatorio-semana.js';
import { CU_FIELD } from '../functions/api/_clickup.js';

const SE = { id: 1, nome: 'SE', tipo: 'lead_mql', funil_tracking: 'sessao-estrategica', trecho_campanha: null };
const LIVE = { id: 2, nome: 'LIVE', tipo: 'manual', funil_tracking: 'lives-semanais-v1', trecho_campanha: null, arquivado: true };
const WO = { id: 3, nome: 'WO PAGO', tipo: 'venda_greenn', funil_tracking: null, trecho_campanha: 'workshop-pago', arquivado: true };
const CONHECIDOS = ['sessao-estrategica', 'lives-semanais-v1'];

test('campanha de funil arquivado vai para ele, não para "sem funil"', () => {
  const r = reconhecerCampanha('ae_leads_publico-frio_evento-lead_lives-semanais-v1', { funisAtivos: [SE, LIVE], funisConhecidos: CONHECIDOS });
  assert.deepEqual(r.blocos.map((b) => b.nome), ['LIVE']);
  assert.equal(r.motivo, null);
  const t = reconhecerCampanha('ae_vendas-workshop-pago-23-09_publico-quente', { funisAtivos: [SE, WO], funisConhecidos: CONHECIDOS });
  assert.deepEqual(t.blocos.map((b) => b.nome), ['WO PAGO']);
});

test('ativo vence o arquivado no mesmo funil; dois ativos continuam conflito', () => {
  const SE_VELHO = { ...SE, id: 9, nome: 'SE antigo', arquivado: true };
  const r = reconhecerCampanha('ae_leads_x_sessao-estrategica', { funisAtivos: [SE, SE_VELHO], funisConhecidos: CONHECIDOS });
  assert.deepEqual(r.blocos.map((b) => b.nome), ['SE']);
  const dois = reconhecerCampanha('ae_leads_x_sessao-estrategica', { funisAtivos: [SE, { ...SE, id: 8, nome: 'SE 2' }], funisConhecidos: CONHECIDOS });
  assert.equal(dois.motivo, 'casou com mais de um funil');
});

test('aba de conflitos: campanha em funil arquivado aparece com o motivo certo', () => {
  const c = listarConflitosCampanhas([{ campaign_id: '1', campaign_name: 'ae_leads_x_lives-semanais-v1', spend_cents: 115847 }], { funisAtivos: [SE, LIVE], funisConhecidos: CONHECIDOS });
  assert.equal(c.length, 1);
  assert.match(c[0].motivo, /funil arquivado LIVE/);
  assert.equal(c[0].valor, 1158.47);
});

const OPCAO = { id: 'a158', name: 'SESSÃO ESTRATÉGICA', orderindex: 0 };
const opcaoJson = JSON.stringify([{ id: OPCAO.id, nome: OPCAO.name }]);
const card = (id) => ({ id, name: 'Fulano', date_created: '5000000', status: { status: 'leads de entrada' }, custom_fields: [
  { id: CU_FIELD.funil, type: 'drop_down', type_config: { options: [OPCAO] }, value: 0 },
  { id: CU_FIELD.utmSource, type: 'short_text', value: 'facebookads' },
] });

test('lead da opção de funil arquivado vai para ele; se um ativo usa a opção, o ativo vence', () => {
  const ATIVO = { id: 1, nome: 'SE', tipo: 'lead_mql', opcoes_crm: opcaoJson, origem_lead: 'trafego_pago' };
  const ARQ = { id: 2, nome: 'SE antigo', tipo: 'lead_mql', opcoes_crm: opcaoJson, origem_lead: 'trafego_pago', arquivado: true };
  const limites = { desde: 1, ate: 10000 };
  const so = atribuirCards({ cards: [card('a')], funisAtivos: [ARQ], limites });
  assert.equal(so.blocos.get(2).length, 1);
  assert.equal(so.sem_funil.length, 0);
  const ambos = atribuirCards({ cards: [card('b')], funisAtivos: [ATIVO, ARQ], limites });
  assert.equal(ambos.blocos.get(1).length, 1);
  assert.equal(ambos.blocos.get(2).length, 0);
});

test('arquivado só aparece com movimento; venda arquivada só sem venda ativa', () => {
  assert.equal(arquivadoTemMovimento({ tipo: 'manual', investido: 0 }, false), false);
  assert.equal(arquivadoTemMovimento({ tipo: 'manual', investido: 18.47 }, false), true);
  assert.equal(arquivadoTemMovimento({ tipo: 'lead_mql', investido: 0, metricas: { novos_leads: 2, mqls: 0 } }, false), true);
  assert.equal(arquivadoTemMovimento({ tipo: 'lead_mql', investido: 0, metricas: { novos_leads: null, mqls: null } }, false), false);
  assert.equal(arquivadoTemMovimento({ tipo: 'venda_greenn', investido: 0, metricas: { compras_realizadas: 3 } }, false), true);
  assert.equal(arquivadoTemMovimento({ tipo: 'venda_greenn', investido: 0, metricas: { compras_realizadas: 3 } }, true), false);
});

test('Visão geral: desativado é o funil do tracking que só tem cadastro arquivado', () => {
  const d = funisDesativados([
    { funil_tracking: 'lives-semanais-v1', situacao: 'arquivado' },
    { funil_tracking: 'sessao-estrategica', situacao: 'ativo' },
    { funil_tracking: 'sessao-estrategica', situacao: 'arquivado' },
  ]);
  assert.deepEqual([...d], ['lives-semanais-v1']);
});

test('relatório do Argo: funil arquivado marcado e "sem funil" aparece quando teve gasto', () => {
  const b = (nome, investido, leads, extra = {}) => ({ nome, tipo: 'lead_mql', investido, metricas: { novos_leads: leads, mqls: 0 }, ...extra });
  const sf = (investido, leads) => ({ investido, novos_leads: leads, mqls: 0, campanhas: [] });
  const res = (blocos, semFunil) => ({ blocos, sem_funil: semFunil });
  const p = montarPacote({
    hoje: '2026-10-05', janelas: janelasDoRelatorio('2026-10-05'),
    resultados: {
      atual: res([b('SE', 900, 17), b('LIVE', 20, 0, { arquivado: true })], sf(258.28, 3)),
      anterior: res([b('SE', 800, 15)], sf(0, 0)),
      media4: res([b('SE', 3200, 60)], sf(100, 4)),
    },
    metas: [], piso: { multiplicador: 3 }, argo: { propostas: [], acoes: [], vereditos: [] }, anuncios: { insights: [], leadsPorNome: {}, totalLeadsPagos: 0 },
    anunciosNovos: [], testes: { testes: [] }, contexto: { valendo: [], terminados: [], arquivados: [] }, semanaAnterior: { reacoes: [], descartes: [] }, temRelatorioAnterior: true,
  });
  assert.deepEqual(p.funis.map((f) => [f.nome, f.arquivado, f.sem_funil]), [['SE', false, false], ['LIVE', true, false], ['Sem funil', false, true]]);
  const gastoLive = p.funis[1].metricas.find((m) => m.metrica === 'gasto');
  assert.equal(p.fatos[gastoLive.fato_id].nome, 'Gasto · LIVE (desativado)');
  const gastoSf = p.funis[2].metricas.find((m) => m.metrica === 'gasto');
  assert.equal(p.fatos[gastoSf.fato_id].valor_texto, 'R$ 258,28');
  assert.ok(p.fatos[p.funis[2].metricas[0].media_id]);
});
