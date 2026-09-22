import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparPorAnuncio } from '../functions/api/_argo-leads-anuncio.js';
import { CU_FIELD } from '../functions/api/_clickup.js';

// Um card do ClickUp como a API devolve: custom_fields é lista de {id, value}.
function card({ criadoMs, content, source = 'facebookads', status = 'qualificação', faturamento = 'Mais de 50 Mil' }) {
  return {
    id: `t${criadoMs}${content}`,
    date_created: String(criadoMs),
    status: { status },
    custom_fields: [
      { id: CU_FIELD.utmSource, value: source },
      { id: CU_FIELD.utmContent, value: content },
      { id: CU_FIELD.faturamento, value: faturamento },
    ],
  };
}

const MADURO = 2_000_000;   // qualquer card criado até aqui é maduro
const RECENTE = 3_000_000;  // criado depois: ainda na fila do comercial

test('agrupa por utm_content e conta qualificados só entre os maduros', () => {
  const r = agruparPorAnuncio({
    cards: [
      card({ criadoMs: 1_000_000, content: 'ad15_x_vd' }),
      card({ criadoMs: 1_500_000, content: 'ad15_x_vd', status: 'desqualificado' }),
      card({ criadoMs: RECENTE, content: 'ad15_x_vd' }),
    ],
    maduroAteMs: MADURO,
  });
  const ad = r.anuncios.find((a) => a.utm_content === 'ad15_x_vd');
  assert.equal(ad.leads_maduros, 2);
  assert.equal(ad.qualificados, 1);
  assert.equal(ad.leads_recentes, 1);
});

test('lead recente nunca conta como nao-qualificado', () => {
  const r = agruparPorAnuncio({
    cards: [card({ criadoMs: RECENTE, content: 'ad01_novo_vd' })],
    maduroAteMs: MADURO,
  });
  const ad = r.anuncios.find((a) => a.utm_content === 'ad01_novo_vd');
  assert.equal(ad.leads_maduros, 0);
  assert.equal(ad.qualificados, 0);
  assert.equal(ad.leads_recentes, 1);
});

test('card que nao e trafego pago fica de fora e e contado a parte', () => {
  const r = agruparPorAnuncio({
    cards: [
      card({ criadoMs: 1_000_000, content: 'ad15_x_vd', source: '' }),
      card({ criadoMs: 1_000_000, content: 'ad15_x_vd' }),
    ],
    maduroAteMs: MADURO,
  });
  assert.equal(r.nao_trafego_pago, 1);
  assert.equal(r.anuncios.find((a) => a.utm_content === 'ad15_x_vd').leads_maduros, 1);
});

test('trafego pago sem utm_content e contado a parte, nunca some', () => {
  const r = agruparPorAnuncio({
    cards: [card({ criadoMs: 1_000_000, content: '' })],
    maduroAteMs: MADURO,
  });
  assert.equal(r.sem_utm_content, 1);
  assert.equal(r.anuncios.length, 0);
});

test('sem cards devolve listas vazias, nunca null', () => {
  const r = agruparPorAnuncio({ cards: [], maduroAteMs: MADURO });
  assert.deepEqual(r.anuncios, []);
  assert.equal(r.sem_utm_content, 0);
  assert.equal(r.nao_trafego_pago, 0);
});

test('espaco em volta do utm_content nao cria anuncio duplicado', () => {
  const r = agruparPorAnuncio({
    cards: [
      card({ criadoMs: 1_000_000, content: ' ad15_x_vd ' }),
      card({ criadoMs: 1_000_000, content: 'ad15_x_vd' }),
    ],
    maduroAteMs: MADURO,
  });
  assert.equal(r.anuncios.length, 1);
  assert.equal(r.anuncios[0].leads_maduros, 2);
});
