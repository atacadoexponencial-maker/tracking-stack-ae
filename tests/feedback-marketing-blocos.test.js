import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calcularCusto,
  montarBlocoLead,
  montarBlocoManual,
  MARCA_SEM_INVESTIMENTO,
  montarBlocoVenda,
  avisoVendasSemFunilDeVenda,
  montarSemFunil,
  avisoInvestimentoSemFunil,
  formatarReais,
} from '../functions/api/_feedback-marketing-blocos.js';

const LIVE = { id: 2, nome: 'LIVE', tipo: 'manual', posicao: 2 };
const NAO_CALCULADO = { calculado: false, motivo: 'contagem manual' };

test('bloco manual: só investimento e campanhas; leads e custo não calculados', () => {
  const campanhas = [{ nome: 'ae_leads_publico-frio_evento-lead_lives-semanais', valor: 60.35, reconhecida_por: 'automatica' }];
  assert.deepEqual(montarBlocoManual({ funil: LIVE, investimento: { investido: 60.35, sem_investimento: false, campanhas } }), {
    nome: 'LIVE',
    tipo: 'manual',
    posicao: 2,
    investido: 60.35,
    sem_investimento: false,
    campanhas,
    metricas: { novos_leads: NAO_CALCULADO },
    custo_tipo: 'CPL',
    custo_por_resultado: NAO_CALCULADO,
    avisos: [],
  });
});

test('bloco manual sem investimento: investido 0 e continua não calculado', () => {
  const b = montarBlocoManual({ funil: LIVE, investimento: { investido: 0, sem_investimento: true, campanhas: [] } });
  assert.equal(b.investido, 0);
  assert.equal(b.sem_investimento, true);
  assert.deepEqual(b.campanhas, []);
  assert.deepEqual(b.metricas.novos_leads, NAO_CALCULADO);
  assert.deepEqual(b.custo_por_resultado, NAO_CALCULADO);
  // Nunca 0 nem número estimado.
  assert.equal(typeof b.metricas.novos_leads, 'object');
  // Objetos próprios: mexer num não altera o outro.
  assert.notEqual(b.metricas.novos_leads, b.custo_por_resultado);
});
import { CU_FIELD } from '../functions/api/_clickup.js';

const SE = { id: 1, nome: 'SE', tipo: 'lead_mql', posicao: 1 };
const campanha = { nome: 'ae_leads_publico-frio_conversao_sessao-estrategica', valor: 150, reconhecida_por: 'automatica' };
const inv = (investido, campanhas = investido ? [campanha] : []) => ({ investido, sem_investimento: investido === 0, campanhas });
const lead = (fat = null, status = 'leads de entrada') => ({
  id: Math.random().toString(36),
  status: { status },
  custom_fields: [{ id: CU_FIELD.faturamento, name: '🤑 Faturamento Mensal', value: fat }],
});

test('calcularCusto: duas casas em centavos; sem denominador é null', () => {
  assert.equal(calcularCusto(150, 7), 21.43);
  assert.equal(calcularCusto(150, 5), 30);
  assert.equal(calcularCusto(0.05, 2), 0.03);
  assert.equal(calcularCusto(0.1 + 0.2, 1), 0.3);
  assert.equal(calcularCusto(0, 3), 0);
  assert.equal(calcularCusto(150, 0), null);
  assert.equal(calcularCusto(150, null), null);
});

test('bloco lead: investido, leads, MQLs e CPL', () => {
  const cards = [lead('De 40 a 75 Mil'), lead('Menos de 20 Mil'), lead(), lead('De 200 a 300 Mil', 'desqualificado'), lead('De 30 a 40 Mil')];
  assert.deepEqual(montarBlocoLead({ funil: SE, investimento: inv(150), cards }), {
    nome: 'SE',
    tipo: 'lead_mql',
    posicao: 1,
    investido: 150,
    sem_investimento: false,
    campanhas: [campanha],
    metricas: { novos_leads: 5, mqls: 2 },
    custo_tipo: 'CPL',
    custo_por_resultado: 30,
    avisos: [],
  });
});

test('sem novos leads: leads 0, MQLs 0 e CPL vazio, com ou sem investimento', () => {
  for (const investido of [150, 0]) {
    const b = montarBlocoLead({ funil: SE, investimento: inv(investido), cards: [] });
    assert.deepEqual(b.metricas, { novos_leads: 0, mqls: 0 });
    assert.equal(b.custo_por_resultado, null);
    assert.deepEqual(b.avisos, []);
  }
});

test('leads sem investimento: CPL 0 marcado "sem investimento no período"', () => {
  const b = montarBlocoLead({ funil: SE, investimento: inv(0), cards: [lead(), lead()] });
  assert.equal(b.custo_por_resultado, 0);
  assert.equal(b.sem_investimento, true);
  assert.deepEqual(b.campanhas, []);
  assert.deepEqual(b.avisos, [MARCA_SEM_INVESTIMENTO]);
  assert.equal(MARCA_SEM_INVESTIMENTO, 'sem investimento no período');
});

test('CRM indisponível: leads, MQLs e CPL null, investimento segue', () => {
  const b = montarBlocoLead({ funil: SE, investimento: inv(150), cards: null });
  assert.deepEqual(b.metricas, { novos_leads: null, mqls: null });
  assert.equal(b.custo_por_resultado, null);
  assert.equal(b.investido, 150);
  assert.deepEqual(b.avisos, []);
});

// Issue 263 — bloco de venda na Greenn.
const WO = { id: 3, nome: 'WO PAGO', tipo: 'venda_greenn', posicao: 3 };
const origens = (o = {}) => ({ trafego_pago: 0, disparo: 0, outra_origem: 0, sem_rastreio: 0, ...o });

test('bloco de venda: CPA = investido ÷ todas as compras, duas casas', () => {
  const campanhas = [{ nome: 'ae_vendas-workshop-pago-23-09_publico-frio', valor: 60, reconhecida_por: 'trecho' }];
  const b = montarBlocoVenda({
    funil: WO,
    investimento: { investido: 60, sem_investimento: false, campanhas },
    compras: { total: 3, por_origem: origens({ trafego_pago: 1, disparo: 2 }) },
  });
  assert.deepEqual(b, {
    nome: 'WO PAGO', tipo: 'venda_greenn', posicao: 3, investido: 60, sem_investimento: false, campanhas,
    metricas: { compras_realizadas: 3, compras_por_origem: origens({ trafego_pago: 1, disparo: 2 }) },
    custo_tipo: 'CPA', custo_por_resultado: 20, avisos: [],
  });
  const b2 = montarBlocoVenda({ funil: WO, investimento: { investido: 100, sem_investimento: false, campanhas: [] }, compras: { total: 3, por_origem: origens({ disparo: 3 }) } });
  assert.equal(b2.custo_por_resultado, 33.33);
});

test('bloco de venda: investimento sem venda → compras 0 e CPA null', () => {
  const b = montarBlocoVenda({ funil: WO, investimento: { investido: 45.5, sem_investimento: false, campanhas: [] }, compras: { total: 0, por_origem: origens() } });
  assert.equal(b.metricas.compras_realizadas, 0);
  assert.equal(b.custo_por_resultado, null);
  assert.deepEqual(b.avisos, []);
});

test('bloco de venda: venda sem investimento → CPA 0 marcado', () => {
  const b = montarBlocoVenda({ funil: WO, investimento: { investido: 0, sem_investimento: true, campanhas: [] }, compras: { total: 3, por_origem: origens({ disparo: 2, sem_rastreio: 1 }) } });
  assert.equal(b.custo_por_resultado, 0);
  assert.equal(b.sem_investimento, true);
  assert.deepEqual(b.avisos, [MARCA_SEM_INVESTIMENTO]);
});

test('aviso de vendas sem funil de venda cadastrado', () => {
  const SE = { id: 1, tipo: 'lead_mql' };
  assert.deepEqual(avisoVendasSemFunilDeVenda([SE], 3), ['Há 3 vendas pagas na Greenn no período e nenhum funil de venda cadastrado.']);
  assert.deepEqual(avisoVendasSemFunilDeVenda([], 1), ['Há 1 vendas pagas na Greenn no período e nenhum funil de venda cadastrado.']);
  assert.deepEqual(avisoVendasSemFunilDeVenda([SE, WO], 3), []);
  assert.deepEqual(avisoVendasSemFunilDeVenda([SE], 0), []);
});

// Issue 264 — bloco "sem funil".
const card = (id, faturamento = null, status = 'novo') => ({
  id,
  status: { status },
  custom_fields: faturamento ? [{ id: 'x', name: '🤑 Faturamento Mensal', value: faturamento }] : [],
});

test('sem funil: investimento, leads por opção e MQLs, sem CPL', () => {
  const campanhas = [{ nome: 'ae_leads_publico-frio_conversao_trafego-pago', valor: 42.1, motivo: 'funil trafego-atacado não cadastrado no relatório' }];
  const b = montarSemFunil({
    investimento: { investido: 42.1, campanhas },
    leads: [
      { opcao: 'TRAFEGO PAGO', cards: [card('a', 'De 50 a 100 mil'), card('b', 'Até 20 mil')] },
      { opcao: 'sem opção de funil no CRM', cards: [card('c')] },
    ],
  });
  assert.deepEqual(b, {
    investido: 42.1,
    campanhas,
    novos_leads: 3,
    leads_por_opcao: [
      { opcao: 'TRAFEGO PAGO', novos_leads: 2 },
      { opcao: 'sem opção de funil no CRM', novos_leads: 1 },
    ],
    mqls: 1,
    vazio: false,
  });
  assert.equal('custo_por_resultado' in b, false);
});

test('sem funil vazio: presente e marcado, sem aviso', () => {
  const b = montarSemFunil({ investimento: { investido: 0, campanhas: [] }, leads: [] });
  assert.deepEqual(b, { investido: 0, campanhas: [], novos_leads: 0, leads_por_opcao: [], mqls: 0, vazio: true });
  assert.deepEqual(avisoInvestimentoSemFunil(0), []);
});

test('sem funil com CRM indisponível: leads e MQLs null e não vazio', () => {
  const b = montarSemFunil({ investimento: { investido: 0, campanhas: [] }, leads: null });
  assert.equal(b.novos_leads, null);
  assert.equal(b.leads_por_opcao, null);
  assert.equal(b.mqls, null);
  assert.equal(b.vazio, false);
});

test('sem funil só com campanha de soma negativa não é vazio e não avisa', () => {
  const b = montarSemFunil({ investimento: { investido: -1.5, campanhas: [{ nome: 'x', valor: -1.5, motivo: 'm' }] }, leads: [] });
  assert.equal(b.vazio, false);
  assert.deepEqual(avisoInvestimentoSemFunil(-1.5), []);
});

test('aviso e formatação de reais', () => {
  assert.deepEqual(avisoInvestimentoSemFunil(42.1), ['R$ 42,10 de investimento sem funil — classifique as campanhas no dashboard.']);
  assert.equal(formatarReais(1234.56), '1.234,56');
  assert.equal(formatarReais(1234567.8), '1.234.567,80');
  assert.equal(formatarReais(0.05), '0,05');
});

test('investimento de R$ 0,01: CPL/CPA arredonda para 0,00 mas não é "sem investimento"', () => {
  const centavo = { investido: 0.01, sem_investimento: false, campanhas: [campanha] };
  const l = montarBlocoLead({ funil: SE, investimento: centavo, cards: [lead(), lead(), lead()] });
  assert.equal(l.custo_por_resultado, 0);
  assert.deepEqual(l.avisos, []);
  const v = montarBlocoVenda({ funil: WO, investimento: centavo, compras: { total: 3, por_origem: origens({ disparo: 3 }) } });
  assert.equal(v.custo_por_resultado, 0);
  assert.deepEqual(v.avisos, []);
});
