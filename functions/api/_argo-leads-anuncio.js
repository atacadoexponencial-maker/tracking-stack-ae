// Leads e MQLs agrupados por anúncio, para o Argo (spec 2026-09-20-argo-regua-de-dinheiro).
//
// O `utm_content` do card É o nome do anúncio no Meta — medido em 20/09: 85,9%
// dos leads de tráfego pago casam com um anúncio da conta. O Argo faz a junção;
// aqui só se agrupa.
//
// Janela de maturação: um lead de ontem ainda está na fila do comercial.
// Contá-lo como "não qualificou" mataria anúncio bom, então ele entra em
// `leads_recentes` e fica fora de `leads_maduros`/`qualificados`.
//
// Convenções do contrato, as mesmas de _cpl-calculo.js: contagens são números,
// nunca `null`; o que não é tráfego pago e o que não tem `utm_content` são
// contados à parte em vez de sumir.
//
// Módulo PURO. Prefixo "_": o Pages não transforma o arquivo em rota.

import { CU_FIELD } from './_clickup.js';
import { ehTrafegoPago, lerCampo } from './_feedback-marketing-crm.js';
import { ehMql } from './_feedback-marketing-mql.js';

export function agruparPorAnuncio({ cards = [], maduroAteMs } = {}) {
  const porAnuncio = new Map();
  let semUtmContent = 0;
  let naoTrafegoPago = 0;

  for (const card of cards) {
    const source = lerCampo(card, { id: CU_FIELD.utmSource });
    if (!ehTrafegoPago(source)) {
      naoTrafegoPago += 1;
      continue;
    }

    const content = String(lerCampo(card, { id: CU_FIELD.utmContent }) ?? '').trim();
    if (!content) {
      semUtmContent += 1;
      continue;
    }

    if (!porAnuncio.has(content)) {
      porAnuncio.set(content, {
        utm_content: content,
        leads_maduros: 0,
        qualificados: 0,
        leads_recentes: 0,
      });
    }
    const linha = porAnuncio.get(content);

    const criadoMs = Number(card.date_created);
    const maduro = Number.isFinite(criadoMs) && criadoMs <= maduroAteMs;

    if (!maduro) {
      linha.leads_recentes += 1;
      continue;
    }
    linha.leads_maduros += 1;
    if (ehMql(card)) linha.qualificados += 1;
  }

  return {
    anuncios: [...porAnuncio.values()],
    sem_utm_content: semUtmContent,
    nao_trafego_pago: naoTrafegoPago,
  };
}
