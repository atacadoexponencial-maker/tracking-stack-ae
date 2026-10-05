import { test } from 'node:test';
import assert from 'node:assert/strict';
import { somarLado, leadsPorAnuncio, numerosDePagina } from '../functions/api/_argo-testes-numeros.js';
import { CU_FIELD } from '../functions/api/_clickup.js';

function card({ criadoMs, content, status = 'qualificação', faturamento = 'Mais de 50 Mil' }) {
  return {
    id: `t${criadoMs}${content}`,
    date_created: String(criadoMs),
    status: { status },
    custom_fields: [
      { id: CU_FIELD.utmSource, value: 'facebookads' },
      { id: CU_FIELD.utmContent, value: content },
      { id: CU_FIELD.faturamento, value: faturamento },
    ],
  };
}

const insights = [
  { anuncio_id: '1', anuncio_nome: 'ad09', conjunto_id: '9', gasto_centavos: 30000, impressoes: 5000 },
  { anuncio_id: '2', anuncio_nome: 'ad11', conjunto_id: '9', gasto_centavos: 20000, impressoes: 3000 },
  { anuncio_id: '3', anuncio_nome: 'ad15', conjunto_id: '8', gasto_centavos: 10000, impressoes: 1000 },
];

test('leads por anúncio contam todos os leads (maduros e recentes) e os MQLs', () => {
  const m = leadsPorAnuncio([
    card({ criadoMs: 1000, content: 'ad09' }),
    card({ criadoMs: 2000, content: 'ad09', status: 'desqualificado' }),
    card({ criadoMs: 3000, content: 'ad11' }),
  ], 10_000);
  assert.deepEqual(m.get('ad09'), { leads: 2, mqls: 1 });
  assert.deepEqual(m.get('ad11'), { leads: 1, mqls: 1 });
});

test('lado por anúncio soma gasto e junta leads pelo nome', () => {
  const leads = new Map([['ad09', { leads: 10, mqls: 3 }], ['ad11', { leads: 4, mqls: 1 }]]);
  const r = somarLado([{ nivel: 'anuncio', id: '1', nome: 'ad09' }], insights, leads);
  assert.deepEqual(r, { gasto_centavos: 30000, impressoes: 5000, leads: 10, mqls: 3, cpl_centavos: 3000, custo_mql_centavos: 10000 });
});

test('anúncio sem gasto no período ainda conta os leads pelo nome escolhido', () => {
  const r = somarLado([{ nivel: 'anuncio', id: '99', nome: 'ad99' }], insights, new Map([['ad99', { leads: 2, mqls: 0 }]]));
  assert.equal(r.leads, 2);
  assert.equal(r.gasto_centavos, 0);
  assert.equal(r.custo_mql_centavos, null);
});

test('lado por conjunto soma os anúncios do conjunto', () => {
  const leads = new Map([['ad09', { leads: 10, mqls: 3 }], ['ad11', { leads: 4, mqls: 1 }], ['ad15', { leads: 50, mqls: 5 }]]);
  const r = somarLado([{ nivel: 'conjunto', id: '9', nome: 'SE | LAL' }], insights, leads);
  assert.equal(r.gasto_centavos, 50000);
  assert.equal(r.leads, 14);
  assert.equal(r.mqls, 4);
});

test('página: A é controle, B é variante; amostra é o lado com menos visitas', () => {
  const r = numerosDePagina([
    { test_id: 2, variante: 'a', visitas: 1204, leads: 215 },
    { test_id: 2, variante: 'b', visitas: 1188, leads: 254 },
    { test_id: 3, variante: 'a', visitas: 9, leads: 0 },
  ], 2);
  assert.equal(r.amostra, 1188);
  assert.equal(r.lados.controle.visitas, 1204);
  assert.ok(Math.abs(r.lados.variante.taxa - 254 / 1188) < 1e-9);
  assert.equal(numerosDePagina([], 5).lados.controle.taxa, null);
});
