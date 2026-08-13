// Monta o card do ClickUp a partir de uma venda paga da Greenn.
//
// Função PURA: sem I/O, sem D1, sem fetch, sem env. Quem busca a sessão e fala
// com a API do ClickUp é o endpoint (greenn.js) — aqui só se traduz payload em
// corpo de task, que é a parte onde errar é fácil e testar é barato.
//
// Prefixo "_": o Cloudflare Pages não transforma em rota.

import { CU_FIELD, CU_FUNIL_WO_PAGO, CU_PRODUTO_AE, toClickUpPhone } from '../_clickup.js';

// A tag nomeia a EDIÇÃO do workshop, não a Greenn. A turma seguinte precisa de
// tag nova, senão duas turmas ficam indistinguíveis no CRM. Trocar de edição é
// editar esta linha.
export const TAG_EDICAO = 'wo-pago-09-09';

// NUNCA 'contrato assinado': aquele status faz functions/webhook/clickup.js
// registrar a venda no purchase_log/ROAS do negócio antigo, e a Greenn é um
// produto à parte (decisão da usuária, 2026-08-10).
export const STATUS_INICIAL = 'leads de entrada';

/**
 * Só venda PAGA vira card. Reembolso, estorno, recusa, aguardando pagamento,
 * assinatura e abandono de checkout não criam nada.
 */
export function deveCriarCard(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return payload.event === 'saleUpdated' && payload.currentStatus === 'paid';
}

/**
 * Traduz a venda no corpo da task. `sessao` é a linha de `checkout_sessions`
 * casada pelo `sf_trk`, ou `null` quando a compra não passou pela LP — nesse
 * caso os campos de UTM simplesmente não entram. Não se inventa origem.
 */
export function montarCard(payload, sessao) {
  const cliente = payload.client || {};
  const venda = payload.sale || {};

  const campos = [
    { id: CU_FIELD.nome, value: cliente.name || '' },
    { id: CU_FIELD.email, value: cliente.email || '' },
    { id: CU_FIELD.funil, value: CU_FUNIL_WO_PAGO },
    { id: CU_FIELD.produto, value: CU_PRODUTO_AE },
    // 💵 Valor, NUNCA 💰 Arrecadado — ver o comentário em _clickup.js.
    { id: CU_FIELD.valor, value: numero(venda.amount) },
  ];

  // Mesmo raciocínio das UTMs vazias, aplicado ao telefone: um valor fora do
  // padrão do campo `type: phone` do ClickUp faz a API responder 400 e
  // derrubar a criação da task inteira (é o mesmo comportamento documentado em
  // functions/tracker.js). Omitir o campo quando não há telefone normalizável
  // é mais seguro do que mandar string vazia — e evita o 400 na origem, sem
  // depender só do fallback em greenn.js.
  const whatsapp = toClickUpPhone(cliente.cellphone);
  if (whatsapp) campos.push({ id: CU_FIELD.whatsapp, value: whatsapp });

  if (sessao) {
    // Só entram os que têm valor: um custom field com string vazia aparece
    // preenchido-porém-vazio no ClickUp, o que mente sobre haver origem.
    const utms = [
      [CU_FIELD.utmSource, sessao.utm_source],
      [CU_FIELD.utmMedium, sessao.utm_medium],
      [CU_FIELD.utmCampaign, sessao.utm_campaign],
      [CU_FIELD.utmContent, sessao.utm_content],
    ];
    for (const [id, valor] of utms) {
      if (valor) campos.push({ id, value: valor });
    }
  }

  return {
    name: cliente.name || `Venda Greenn ${venda.id || ''}`.trim(),
    status: STATUS_INICIAL,
    custom_fields: campos,
    tag: TAG_EDICAO,
    comentario: comentarioDaVenda(payload, sessao),
  };
}

// O comentário é o registro humano da compra: o que o card não mostra em campo.
function comentarioDaVenda(payload, sessao) {
  const v = payload.sale || {};
  const p = payload.product || {};
  const linhas = [
    `Compra na Greenn — ${p.name || 'produto sem nome'}`,
    `Venda ${v.id} · ${v.method || 'método desconhecido'} · ${moeda(v.amount)}`,
    `Taxa ${moeda(v.fee)} · Líquido ${moeda(v.seller_balance)}`,
  ];
  if (payload.sf_trk) linhas.push(`Rastreamento: ${payload.sf_trk}`);
  if (!sessao) linhas.push('Sem sessão casada: a compra não passou pela LP, ou a visita expirou.');
  return linhas.join('\n');
}

// O D1 e a API do ClickUp recusam `undefined`; e um valor ausente vira 0 no
// campo de moeda, não `null`, para o card não ficar com o campo em branco.
function numero(v) {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

function moeda(v) {
  return `R$ ${numero(v).toFixed(2).replace('.', ',')}`;
}
