// Traduz o corpo de um webhook da Greenn nas colunas de greenn_webhook_event.
// Função PURA: sem I/O, sem D1, sem env — é o que permite testá-la com
// `node --test` sem subir nada.
//
// Prefixo "_" no nome: o Cloudflare Pages não transforma em rota (mesmo
// mecanismo de _classificar.js).

export function extrairEvento(body) {
  if (!body || typeof body !== 'object') return null;
  if (typeof body.event !== 'string' || body.event === '') return null;

  if (body.event === 'saleUpdated') {
    return {
      event: 'saleUpdated',
      entity_type: 'sale',
      entity_id: numero(body.sale?.id),
      current_status: texto(body.currentStatus),
      product_id: numero(body.product?.id),
      amount: numero(body.sale?.amount),
      // '' em vez de null quando updated_at não vem: entity_updated também
      // faz parte do índice único de dedup, e no SQLite NULL nunca é igual a
      // NULL num índice único — mesmo motivo de current_status usar ''.
      entity_updated: texto(body.sale?.updated_at) || '',
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
      entity_updated: texto(body.contract?.updated_at) || '', // ver comentário acima
    };
  }

  if (body.event === 'checkoutAbandoned') {
    return {
      event: 'checkoutAbandoned',
      entity_type: 'lead',
      entity_id: numero(body.lead?.id),
      current_status: '',
      product_id: numero(body.product?.id),
      amount: null,
      entity_updated: texto(body.lead?.updated_at) || '', // ver comentário acima
    };
  }

  // Evento que a Greenn manda mas que a ingestão ainda não conhece. A Greenn
  // não reentrega webhook, então descartar aqui seria perda definitiva do
  // dado — grava-se com entity_type nulo (spec, tabela de erros) para não
  // perder o registro; o console.error no endpoint é o que avisa que surgiu
  // um tipo novo.
  return {
    event: body.event,
    entity_type: null,
    entity_id: null,
    // '' e não NULL: esta coluna é NOT NULL e faz parte do índice único de
    // dedup — um NULL aqui desligaria a dedup para eventos desconhecidos.
    current_status: '',
    product_id: numero(body.product?.id),
    amount: null,
    entity_updated: null,
  };
}

// A Greenn manda inteiros e floats como números, mas às vezes serializa valor
// monetário como string ("97.00"). Aceita as duas formas; um campo ausente
// vira undefined e o D1 recusa undefined no bind, então normaliza para null.
function numero(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function texto(v) {
  return typeof v === 'string' ? v : '';
}
