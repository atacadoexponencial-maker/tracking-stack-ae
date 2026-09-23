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

// --- A régua de cada funil --------------------------------------------------
// Decisão da gestora em 22/09, depois da primeira rodada real: SE por MQL,
// WO PAGO por compra, LIVE fora do julgamento automático, AQUISIÇÃO por custo
// por visita (que vive no monitor de tráfego, não aqui).
//
// O que motivou: o Argo propôs pausar um anúncio com 43 leads maduros e "zero
// qualificados" — era da live, onde ninguém preenche faturamento. Perguntar
// "quantos MQLs?" a um funil que não produz MQL dá sempre zero.

// Como o cadastro real da conta: SE declara origem, LIVE e WO PAGO não.
const FUNIS = [
  { id: 1, nome: 'SE', tipo: 'lead_mql', origem_lead: 'trafego_pago', opcoes_crm: JSON.stringify([{ id: 'op-se', nome: 'Sessão Estratégica' }]) },
  { id: 2, nome: 'LIVE', tipo: 'manual', origem_lead: null, opcoes_crm: JSON.stringify([{ id: 'op-live', nome: 'Live' }]) },
  { id: 3, nome: 'WO PAGO', tipo: 'venda_greenn', origem_lead: null, opcoes_crm: JSON.stringify([{ id: 'op-wo', nome: 'Workshop' }]) },
];

function cardComFunil({ criadoMs, content, opcao, faturamento = 'Mais de 50 Mil', status = 'qualificação' }) {
  return {
    id: `f${criadoMs}${content}${opcao}`,
    date_created: String(criadoMs),
    status: { status },
    custom_fields: [
      { id: CU_FIELD.utmSource, value: 'facebookads' },
      { id: CU_FIELD.utmContent, value: content },
      { id: CU_FIELD.faturamento, value: faturamento },
      {
        id: CU_FIELD.funil,
        value: opcao,
        type_config: { options: [{ id: 'op-se', name: 'Sessão Estratégica' }, { id: 'op-live', name: 'Live' }, { id: 'op-wo', name: 'Workshop' }] },
      },
    ],
  };
}

test('anuncio da SE e julgavel por MQL', () => {
  const r = agruparPorAnuncio({
    cards: [
      cardComFunil({ criadoMs: 1_000_000, content: 'ad13_se_vd', opcao: 'op-se' }),
      cardComFunil({ criadoMs: 1_100_000, content: 'ad13_se_vd', opcao: 'op-se', status: 'desqualificado' }),
    ],
    maduroAteMs: MADURO,
    funis: FUNIS,
  });
  const ad = r.anuncios.find((a) => a.utm_content === 'ad13_se_vd');
  assert.equal(ad.funil, 'SE');
  assert.equal(ad.tipo_funil, 'lead_mql');
  assert.equal(ad.julgavel, true);
  assert.equal(ad.qualificados, 1);
});

test('anuncio da LIVE NUNCA e julgavel, por mais leads que tenha', () => {
  // O caso real de 22/09: 43 leads maduros, zero "qualificados", proposta de
  // pausa. É o teste que impede a volta desse erro.
  const cards = [];
  for (let i = 0; i < 43; i++) {
    cards.push(cardComFunil({ criadoMs: 1_000_000 + i, content: 'ad06_live_img', opcao: 'op-live', faturamento: '' }));
  }
  const r = agruparPorAnuncio({ cards, maduroAteMs: MADURO, funis: FUNIS });
  const ad = r.anuncios.find((a) => a.utm_content === 'ad06_live_img');
  assert.equal(ad.funil, 'LIVE');
  assert.equal(ad.leads_maduros, 43);
  assert.equal(ad.qualificados, 0);
  assert.equal(ad.julgavel, false);
  assert.match(ad.motivo_nao_julgavel, /manual/i);
});

test('anuncio do WO PAGO nao e julgavel por MQL — o desfecho dele e compra', () => {
  const r = agruparPorAnuncio({
    cards: [cardComFunil({ criadoMs: 1_000_000, content: 'ad02_wo_img', opcao: 'op-wo', faturamento: '' })],
    maduroAteMs: MADURO,
    funis: FUNIS,
  });
  const ad = r.anuncios.find((a) => a.utm_content === 'ad02_wo_img');
  assert.equal(ad.tipo_funil, 'venda_greenn');
  assert.equal(ad.julgavel, false);
  assert.match(ad.motivo_nao_julgavel, /compra/i);
});

test('anuncio sem funil reconhecido nao e julgavel — silencio, nunca chute', () => {
  const r = agruparPorAnuncio({
    cards: [cardComFunil({ criadoMs: 1_000_000, content: 'ad99_orfao_vd', opcao: null })],
    maduroAteMs: MADURO,
    funis: FUNIS,
  });
  const ad = r.anuncios.find((a) => a.utm_content === 'ad99_orfao_vd');
  assert.equal(ad.funil, null);
  assert.equal(ad.julgavel, false);
});

test('sem a lista de funis nada e julgavel — deploy incompleto nao vira pausa', () => {
  const r = agruparPorAnuncio({
    cards: [cardComFunil({ criadoMs: 1_000_000, content: 'ad13_se_vd', opcao: 'op-se' })],
    maduroAteMs: MADURO,
  });
  assert.equal(r.anuncios[0].julgavel, false);
});

test('anuncio que serve dois funis fica com o funil da maioria dos leads', () => {
  const r = agruparPorAnuncio({
    cards: [
      cardComFunil({ criadoMs: 1_000_000, content: 'ad20_misto_vd', opcao: 'op-se' }),
      cardComFunil({ criadoMs: 1_100_000, content: 'ad20_misto_vd', opcao: 'op-se' }),
      cardComFunil({ criadoMs: 1_200_000, content: 'ad20_misto_vd', opcao: 'op-live', faturamento: '' }),
    ],
    maduroAteMs: MADURO,
    funis: FUNIS,
  });
  const ad = r.anuncios.find((a) => a.utm_content === 'ad20_misto_vd');
  assert.equal(ad.funil, 'SE');
  assert.equal(ad.julgavel, true);
});

// --- Dois funis na MESMA opção do CRM ---------------------------------------
// Defeito real, achado em 22/09 rodando contra a conta: SE e AQUISIÇÃO
// compartilham a opção "SESSÃO ESTRATÉGICA" e são separados por `origem_lead`
// (SE = tráfego pago; AQUISIÇÃO = exceto tráfego pago). Sem ler esse campo, a
// última cadastrada vencia e TODOS os anúncios apareciam como AQUISIÇÃO.
//
// Aqui só entram cards de tráfego pago — os outros já saíram antes —, então o
// funil certo é sempre o de origem `trafego_pago` ou `qualquer`. Um anúncio
// nunca pode ser de um funil "exceto tráfego pago".

const FUNIS_MESMA_OPCAO = [
  { id: 1, nome: 'SE', tipo: 'lead_mql', origem_lead: 'trafego_pago', opcoes_crm: JSON.stringify([{ id: 'op-se', nome: 'SESSÃO ESTRATÉGICA' }]) },
  { id: 4, nome: 'AQUISIÇÃO', tipo: 'lead_mql', origem_lead: 'exceto_trafego_pago', opcoes_crm: JSON.stringify([{ id: 'op-se', nome: 'SESSÃO ESTRATÉGICA' }]) },
];

test('opcao compartilhada: anuncio fica com o funil de trafego pago', () => {
  const r = agruparPorAnuncio({
    cards: [cardComFunil({ criadoMs: 1_000_000, content: 'ad13_se_vd', opcao: 'op-se' })],
    maduroAteMs: MADURO,
    funis: FUNIS_MESMA_OPCAO,
  });
  assert.equal(r.anuncios[0].funil, 'SE');
  assert.equal(r.anuncios[0].julgavel, true);
});

test('opcao so de funil "exceto trafego pago" nao da funil a anuncio nenhum', () => {
  const r = agruparPorAnuncio({
    cards: [cardComFunil({ criadoMs: 1_000_000, content: 'ad13_se_vd', opcao: 'op-se' })],
    maduroAteMs: MADURO,
    funis: [FUNIS_MESMA_OPCAO[1]],
  });
  assert.equal(r.anuncios[0].funil, null);
  assert.equal(r.anuncios[0].julgavel, false);
});

test('origem "qualquer" serve a anuncio', () => {
  const r = agruparPorAnuncio({
    cards: [cardComFunil({ criadoMs: 1_000_000, content: 'ad13_se_vd', opcao: 'op-se' })],
    maduroAteMs: MADURO,
    funis: [{ id: 9, nome: 'GERAL', tipo: 'lead_mql', origem_lead: 'qualquer', opcoes_crm: JSON.stringify([{ id: 'op-se', nome: 'SESSÃO ESTRATÉGICA' }]) }],
  });
  assert.equal(r.anuncios[0].funil, 'GERAL');
});
