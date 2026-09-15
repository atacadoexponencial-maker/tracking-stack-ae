import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  montarResposta,
  montarTotais,
  AVISO_NENHUM_FUNIL,
  ERRO_FALHA_INESPERADA,
} from '../functions/api/_feedback-marketing-resposta.js';
import { NOTA_MQL } from '../functions/api/_feedback-marketing-mql.js';
import { inicioDoDiaBrt } from '../functions/api/_data-brt.js';

const PERIODO = { inicio: '2026-09-14', fim: '2026-09-14', dias: 1, rotulo: '14/09', padrao: true, parcial: false };
const AGORA = inicioDoDiaBrt('2026-09-15') + 8 * 3600 + 30 * 60;

const lead = (nome, posicao, novos, mqls) => ({ nome, tipo: 'lead_mql', posicao, metricas: { novos_leads: novos, mqls } });
const manual = { nome: 'LIVE', tipo: 'manual', posicao: 2, metricas: { novos_leads: { calculado: false, motivo: 'contagem manual' } } };
const venda = { nome: 'WO PAGO', tipo: 'venda_greenn', posicao: 3, metricas: { compras_realizadas: 3 } };
const semFunil = (novos, mqls, extra = {}) => ({ investido: 0, campanhas: [], novos_leads: novos, leads_por_opcao: [], mqls, vazio: false, ...extra });
const INVEST = { investido_geral: 312.45, investimento_atualizado_em: '2026-09-15T06:00:00-03:00' };

test('resposta: ordem do contrato, blocos na ordem do cadastro, sem funil por último', () => {
  const blocos = [lead('SE', 1, 5, 2), manual, venda, lead('AQUISIÇÃO', 4, 0, 0)];
  const r = montarResposta({
    periodo: PERIODO,
    agoraUnix: AGORA,
    investimento: INVEST,
    blocos,
    semFunil: semFunil(2, 0),
    crmLido: true,
    ultimoEventoGreennUnix: 1789420635,
    avisos: ['a'],
  });
  assert.deepEqual(Object.keys(r), ['periodo', 'gerado_em', 'investido_geral', 'blocos', 'sem_funil', 'totais', 'frescor', 'nota_mql', 'avisos']);
  assert.deepEqual(r.blocos.map((b) => b.nome), ['SE', 'LIVE', 'WO PAGO', 'AQUISIÇÃO']);
  assert.equal(r.gerado_em, '2026-09-15T08:30:00-03:00');
  assert.deepEqual(r.totais, { investido_geral: 312.45, novos_leads: 7, mqls: 2, compras_realizadas: 3 });
  assert.deepEqual(r.frescor, {
    investimento_atualizado_em: '2026-09-15T06:00:00-03:00',
    crm_lido: true,
    greenn_ultimo_evento_em: '2026-09-14T18:17:15-03:00',
  });
  assert.equal(r.nota_mql, NOTA_MQL);
  assert.deepEqual(r.avisos, ['a']);
});

test('nenhum funil ativo: só investido geral, sem funil com tudo e o aviso', () => {
  const r = montarResposta({
    periodo: PERIODO,
    agoraUnix: AGORA,
    investimento: INVEST,
    blocos: [],
    semFunil: semFunil(4, 1, { investido: 312.45 }),
    crmLido: true,
    ultimoEventoGreennUnix: null,
    avisos: ['Há 3 vendas pagas na Greenn no período e nenhum funil de venda cadastrado.'],
  });
  assert.deepEqual(r.blocos, []);
  assert.equal(r.avisos[0], AVISO_NENHUM_FUNIL);
  assert.equal(r.avisos.length, 2);
  assert.deepEqual(r.totais, { investido_geral: 312.45, novos_leads: 4, mqls: 1, compras_realizadas: null });
  assert.equal(r.frescor.greenn_ultimo_evento_em, null);
});

test('totais: CRM indisponível → leads e MQLs null; Manual nunca soma', () => {
  assert.deepEqual(
    montarTotais({ investidoGeral: 10, blocos: [lead('SE', 1, null, null), manual], semFunil: semFunil(null, null) }),
    { investido_geral: 10, novos_leads: null, mqls: null, compras_realizadas: null },
  );
  assert.deepEqual(
    montarTotais({ investidoGeral: 0, blocos: [manual], semFunil: semFunil(0, 0) }),
    { investido_geral: 0, novos_leads: 0, mqls: 0, compras_realizadas: null },
  );
});

test('dia sem dado: resposta completa, volumes 0 e sem erro', () => {
  const r = montarResposta({
    periodo: PERIODO,
    agoraUnix: AGORA,
    investimento: { investido_geral: 0, investimento_atualizado_em: null },
    blocos: [lead('SE', 1, 0, 0), { ...venda, metricas: { compras_realizadas: 0 } }],
    semFunil: semFunil(0, 0, { vazio: true }),
    crmLido: false,
    avisos: [],
  });
  assert.deepEqual(r.totais, { investido_geral: 0, novos_leads: 0, mqls: 0, compras_realizadas: 0 });
  assert.equal(r.frescor.crm_lido, false);
  assert.deepEqual(r.avisos, []);
});

test('mesma entrada → mesma resposta', () => {
  const entrada = () => ({ periodo: PERIODO, agoraUnix: AGORA, investimento: INVEST, blocos: [venda], semFunil: semFunil(0, 0), crmLido: true, avisos: [] });
  assert.deepEqual(montarResposta(entrada()), montarResposta(entrada()));
});

test('mensagem de falha inesperada', () => {
  assert.equal(ERRO_FALHA_INESPERADA, 'Não foi possível montar o feedback agora.');
});
