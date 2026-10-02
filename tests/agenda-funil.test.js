// Funil da agenda e custo por reunião (spec-conversao-agenda.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularFunilAgenda, custoPorReuniao } from '../functions/api/_agenda-funil.js';

const c = (o) => ({ email: 'a@x.com', funil: 'sessao-estrategica', criado_em: 100, abriu: 0, escolheu: 0, agendou_em: null, situacao: null, tipo_nome: 'Consultoria', utm_source: '', utm_campaign: '', ...o });

test('funil: etapas acumulam e etapa posterior implica as anteriores', () => {
  const f = calcularFunilAgenda([
    c({ email: '1@x' }),
    c({ email: '2@x', abriu: 1 }),
    c({ email: '3@x', abriu: 1, escolheu: 1 }),
    c({ email: '4@x', agendou_em: 400, situacao: 'marcada' }), // sem registro de abertura
    c({ email: '5@x', abriu: 1, escolheu: 1, agendou_em: 300, situacao: 'realizada' }),
    c({ email: '6@x', abriu: 1, escolheu: 1, agendou_em: 200, situacao: 'faltou' }),
  ]);
  assert.deepEqual([f.leads, f.abriu, f.escolheu, f.agendou, f.compareceu], [6, 5, 4, 3, 1]);
  assert.equal(f.faltou, 1);
  assert.equal(f.taxa_lead_reuniao, 1 / 6);
  const maior = f.etapas.find((e) => e.maiorPerda);
  assert.equal(maior.chave, 'compareceu'); // 3 → 1 perde 2
  assert.equal(f.mediana_segundos_ate_agendar, 200); // 300, 100, 200
});

test('funil: mesma pessoa duas vezes conta uma, pela etapa mais avançada', () => {
  const f = calcularFunilAgenda([
    c({ email: 'A@x.com', criado_em: 100 }),
    c({ email: 'a@x.com', criado_em: 200, abriu: 1, escolheu: 1, agendou_em: 250, situacao: 'marcada' }),
  ]);
  assert.equal(f.leads, 1);
  assert.equal(f.agendou, 1);
});

test('funil: quebras por funil, origem e tipo', () => {
  const f = calcularFunilAgenda([
    c({ email: '1@x', utm_source: 'facebookads', utm_campaign: 'camp1' }),
    c({ email: '2@x', funil: 'trafego-atacado', tipo_nome: 'Tráfego', utm_campaign: 'bioperfil' }),
  ]);
  assert.deepEqual(f.por_funil.map((x) => x.nome).sort(), ['sessao-estrategica', 'trafego-atacado']);
  assert.ok(f.por_origem.some((x) => x.nome === 'meta-ads · camp1'));
  assert.ok(f.por_origem.some((x) => x.nome === 'bio · bioperfil'));
  assert.deepEqual(f.por_tipo.map((x) => x.nome).sort(), ['Consultoria', 'Tráfego']);
});

test('custo por reunião: granular por funil e total só dos funis com agenda', () => {
  const r = custoPorReuniao({
    porFunilCpl: [{ funnel: 'sessao-estrategica', spend: 1000 }, { funnel: 'workshop', spend: 5000 }, { funnel: 'trafego-atacado', spend: 300 }],
    agendadas: [{ funil: 'sessao-estrategica' }, { funil: 'sessao-estrategica' }, { funil: 'trafego-atacado' }],
    realizadas: [{ funil: 'sessao-estrategica' }],
    funisComAgenda: ['sessao-estrategica', 'trafego-atacado'],
  });
  assert.equal(r.por_funil['sessao-estrategica'].custo_agendada, 500);
  assert.equal(r.por_funil['sessao-estrategica'].custo_realizada, 1000);
  assert.equal(r.por_funil['trafego-atacado'].custo_realizada, null); // gasto sem reunião realizada
  assert.equal(r.por_funil.workshop, undefined);
  assert.equal(r.total.spend, 1300);
  assert.equal(r.total.custo_agendada, 1300 / 3);
});
