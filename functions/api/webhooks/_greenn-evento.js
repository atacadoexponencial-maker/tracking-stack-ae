// Traduz o corpo de um webhook da Greenn nas colunas de greenn_webhook_event.
// Função PURA: sem I/O, sem D1, sem env — é o que permite testá-la com
// `node --test` sem subir nada.
//
// Prefixo "_" no nome: o Cloudflare Pages não transforma em rota (mesmo
// mecanismo de _classificar.js).

export function extrairEvento(body) {
  if (!body || typeof body !== 'object') return null;

  if (body.event === 'saleUpdated') {
    return {
      event: 'saleUpdated',
      entity_type: 'sale',
      entity_id: numero(body.sale?.id),
      current_status: texto(body.currentStatus),
      product_id: numero(body.product?.id),
      amount: numero(body.sale?.amount),
      entity_updated: texto(body.sale?.updated_at) || null,
    };
  }

  if (body.event === 'contractUpdated') {
    return {
      event: 'contractUpdated',
      entity_type: 'contract',
      entity_id: numero(body.contract?.id),
      current_status: texto(body.currentStatus),
      product_id: numero(body.product?.id),
      amount: numero(body.currentSale?.amount),
      entity_updated: texto(body.contract?.updated_at) || null,
    };
  }

  return null;
}

// A Greenn manda inteiros e floats como números, mas um campo ausente vira
// undefined e o D1 recusa undefined no bind. Normaliza para null.
function numero(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function texto(v) {
  return typeof v === 'string' ? v : '';
}
