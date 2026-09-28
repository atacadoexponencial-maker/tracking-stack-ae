// Realizado × meta (issue 334): regras puras de situação, projeção e textos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  indicadorCusto, indicadorVolume, montarFunilAcompanhamento, filtrarAvisos, diasDoMes, rotuloDoMes, reais,
} from '../functions/api/_metas-acompanhamento.js';

test('custo: dentro, perto até 10%, fora; sem meta; sem dado', () => {
  assert.equal(indicadorCusto({ chave: 'cpl', rotulo: 'CPL', realizado: 85, metaReais: 90 }).situacao, 'dentro');
  const perto = indicadorCusto({ chave: 'cpl', rotulo: 'CPL', realizado: 90.56, metaReais: 90 });
  assert.equal(perto.situacao, 'perto');
  assert.equal(perto.realizado, 'R$ 90,56');
  assert.equal(perto.meta, 'R$ 90,00');
  assert.equal(perto.diferenca, '+R$ 0,56 (+0,6%)');
  assert.equal(indicadorCusto({ chave: 'cpl', rotulo: 'CPL', realizado: 99.01, metaReais: 90 }).situacao, 'fora');
  assert.equal(indicadorCusto({ chave: 'cpl', rotulo: 'CPL', realizado: 99, metaReais: 90 }).situacao, 'perto'); // fronteira: 10% conta como perto
  const menor = indicadorCusto({ chave: 'c', rotulo: 'C', realizado: 175.28, metaReais: 180 });
  assert.equal(menor.diferenca, '−R$ 4,72 (−2,6%)');
  assert.equal(indicadorCusto({ chave: 'c', rotulo: 'C', realizado: 175.28, metaReais: null }).situacao, 'sem_meta');
  const semDado = indicadorCusto({ chave: 'c', rotulo: 'C', realizado: null, metaReais: 180 });
  assert.equal(semDado.situacao, 'sem_dado');
  assert.equal(semDado.realizado, null); // a tela mostra "—", nunca R$ 0,00
});

test('volume: projeção pelo ritmo dos dias fechados e cores pela projeção', () => {
  // 60 em 27 dias de um mês de 30 → projeção 67; meta 70 → 95,7% → perto.
  const v = indicadorVolume({ chave: 'l', rotulo: 'Leads novos', realizado: 60, meta: 70, diasFechados: 27, diasNoMes: 30 });
  assert.equal(v.projecao, '67');
  assert.equal(v.situacao, 'perto');
  assert.equal(v.pct, 86);
  assert.equal(v.por_dia, 'precisa de 3,3 por dia'); // faltam 10 em 3 dias (hoje incluso)
  assert.equal(indicadorVolume({ chave: 'l', rotulo: 'L', realizado: 50, meta: 70, diasFechados: 27, diasNoMes: 30 }).situacao, 'fora');
  assert.equal(indicadorVolume({ chave: 'l', rotulo: 'L', realizado: 64, meta: 70, diasFechados: 27, diasNoMes: 30 }).situacao, 'dentro');
});

test('volume: meta atingida, dia 1º, sem meta e CRM fora', () => {
  const ating = indicadorVolume({ chave: 'l', rotulo: 'L', realizado: 72, meta: 70, diasFechados: 27, diasNoMes: 30 });
  assert.equal(ating.atingida, true);
  assert.equal(ating.situacao, 'dentro');
  assert.equal(ating.por_dia, null);
  const dia1 = indicadorVolume({ chave: 'l', rotulo: 'L', realizado: 0, meta: 70, diasFechados: 0, diasNoMes: 31 });
  assert.equal(dia1.projecao, '—');
  assert.equal(dia1.situacao, 'sem_dado');
  assert.equal(dia1.por_dia, 'precisa de 2,3 por dia');
  assert.equal(indicadorVolume({ chave: 'l', rotulo: 'L', realizado: 10, meta: null, diasFechados: 5, diasNoMes: 30 }).situacao, 'sem_meta');
  assert.equal(indicadorVolume({ chave: 'l', rotulo: 'L', realizado: null, meta: 70, diasFechados: 5, diasNoMes: 30 }).situacao, 'sem_dado');
});

test('funil: usa os números do relatório, divide sem denominador em "—" e marca CRM fora', () => {
  const meta = { cpl_max_centavos: 9000, leads_novos: 70, mqls: 35, custo_mql_max_centavos: 18000 };
  const vigente = { ...meta, mes_inicio: '2026-09', alterada_em: Date.parse('2026-09-15T14:10:00Z') / 1000, alterada_por: 'painel' };
  const f = montarFunilAcompanhamento({
    funil: { id: 1, nome: 'SE' }, bloco: { investido: 5433.83, metricas: { novos_leads: 60, mqls: 31 } },
    meta, vigente, mes: '2026-09', diasFechados: 27, diasNoMes: 30,
    inicioDoMesUnix: Date.parse('2026-09-01T03:00:00Z') / 1000,
  });
  assert.equal(f.investido_centavos, 543383);
  assert.equal(f.crm_ok, true);
  assert.deepEqual(f.indicadores.map((i) => i.realizado), ['R$ 90,56', '60', '31', 'R$ 175,28']);
  assert.equal(f.meta_alterada_no_mes_em, '2026-09-15T14:10:00.000Z');
  const fora = montarFunilAcompanhamento({
    funil: { id: 1, nome: 'SE' }, bloco: { investido: 100, metricas: { novos_leads: null, mqls: null } },
    meta, vigente, mes: '2026-09', diasFechados: 27, diasNoMes: 30, inicioDoMesUnix: 0,
  });
  assert.equal(fora.crm_ok, false);
  assert.equal(fora.indicadores[0].realizado, null);
  const semLead = montarFunilAcompanhamento({
    funil: { id: 1, nome: 'SE' }, bloco: { investido: 100, metricas: { novos_leads: 0, mqls: 0 } },
    meta, vigente, mes: '2026-09', diasFechados: 3, diasNoMes: 30, inicioDoMesUnix: 0,
  });
  assert.equal(semLead.indicadores[0].realizado, null); // CPL "—" sem lead
  assert.equal(semLead.indicadores[3].realizado, null);
});

test('meta de mês anterior repetida não conta como "alterada neste mês"', () => {
  const meta = { cpl_max_centavos: 9000, leads_novos: 70, mqls: 35, custo_mql_max_centavos: null };
  const f = montarFunilAcompanhamento({
    funil: { id: 1, nome: 'SE' }, bloco: { investido: 0, metricas: { novos_leads: 0, mqls: 0 } },
    meta, vigente: { ...meta, mes_inicio: '2026-09', alterada_em: 10, alterada_por: 'painel' },
    mes: '2026-10', diasFechados: 5, diasNoMes: 31, inicioDoMesUnix: 1000,
  });
  assert.equal(f.meta_alterada_no_mes_em, null);
});

test('utilidades: dias do mês, rótulo, reais e avisos filtrados', () => {
  assert.equal(diasDoMes('2026-02'), 28);
  assert.equal(diasDoMes('2026-09'), 30);
  assert.equal(rotuloDoMes('2026-09'), 'setembro');
  assert.equal(reais(1234.5), 'R$ 1.234,50');
  assert.deepEqual(filtrarAvisos([
    'R$ 1.887,78 de investimento sem funil — classifique as campanhas no dashboard.',
    'O investimento foi atualizado pela última vez em 27/09 às 18:00 — pode estar incompleto.',
    'CRM indisponível — leads não contados.',
  ]), [
    'O investimento foi atualizado pela última vez em 27/09 às 18:00 — pode estar incompleto.',
    'CRM indisponível — leads não contados.',
  ]);
});
