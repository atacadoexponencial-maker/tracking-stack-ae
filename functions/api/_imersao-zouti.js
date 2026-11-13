// Compras da Zouti → imersao_vendas (spec-popup-checkout-imersao.md, série S10).
//
// Regras do webhook de compras da Imersão 2027, sem HTTP: conferir a assinatura,
// traduzir o aviso em vendas, gravar e registrar o que foi feito. O endereço
// (./webhooks/zouti.js) só lê a requisição e chama `processarAviso`.
//
// Documentação da Zouti (13/11/2026):
// https://ajuda.zouti.com.br/pt-br/articles/9740997-como-configurar-webhook
//   - cabeçalho `x-zouti-signature: t=<ms>,v1=<hex>`, HMAC-SHA256 do corpo bruto
//     com o segredo do webhook;
//   - valores em centavos; datas ISO em UTC;
//   - só 2xx é sucesso; 10 falhas seguidas desligam o webhook e não há reenvio
//     manual. Por isso todo aviso assinado que o site não usa responde 200.
import { timingSafeEqual } from '../webhook/_utils.js';

// Produto da Zouti → produto da aba Imersão 2027 (informados pela usuária em
// 13/11). A Mentoria Atacado Exponencial fica de fora por decisão dela.
export const PRODUTOS_ZOUTI = {
  prod_fe4nfgx9xgwjxmgife1sw5: 'ingresso',
  prod_e52fldo7j7aqksthgah5n1: 'bump',
};

// Tipo do aviso → situação que as vendas do pedido passam a ter.
const SITUACAO_POR_TIPO = {
  ORDER_REFUNDED: 'reembolsada',
  ORDER_DISPUTED: 'reembolsada',
  ORDER_CANCELED: 'cancelada',
};

async function hmacHex(segredo, texto) {
  const enc = new TextEncoder();
  const chave = await crypto.subtle.importKey('raw', enc.encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', chave, enc.encode(texto));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Confere `x-zouti-signature` contra o corpo bruto. A documentação mostra o
 * HMAC só do corpo; o trecho do formato está cortado, então aceita também o
 * horário junto do corpo (`<t>.<corpo>`), sem conferir a validade do horário
 * (SUP-S10-17).
 */
export async function assinaturaConfere(segredo, cabecalho, corpo) {
  if (!segredo || typeof cabecalho !== 'string') return false;
  const partes = Object.fromEntries(cabecalho.split(',').map((p) => {
    const i = p.indexOf('=');
    return i < 0 ? [p.trim(), ''] : [p.slice(0, i).trim(), p.slice(i + 1).trim()];
  }));
  const recebida = (partes.v1 || '').toLowerCase();
  if (!recebida) return false;
  if (timingSafeEqual(recebida, await hmacHex(segredo, corpo))) return true;
  return !!partes.t && timingSafeEqual(recebida, await hmacHex(segredo, `${partes.t}.${corpo}`));
}

const unix = (iso) => {
  const ms = Date.parse(iso || '');
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
};

/**
 * Vendas de um pedido pago: uma por unidade de ingresso ou de bump. O valor do
 * item é o total do item; com mais de uma unidade, divide (SUP-S10-18). O
 * identificador é fixo (pedido + produto + unidade), o que impede duplicar.
 */
export function vendasDoPedido(pedido, agora) {
  const itens = Array.isArray(pedido?.items) ? pedido.items : [];
  const utm = pedido?.utm_data || {};
  const pagoEm = unix(pedido?.paid_at) ?? unix(pedido?.created_at) ?? agora;
  const vendas = [];
  for (const item of itens) {
    const produto = PRODUTOS_ZOUTI[item?.product_id];
    if (!produto) continue;
    const quantidade = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const valor = Math.round((Number(item.amount) || 0) / quantidade);
    for (let n = 1; n <= quantidade; n++) {
      vendas.push({
        id: `${pedido.id}:${item.product_id}:${n}`,
        produto,
        valor_centavos: valor,
        pago_em: pagoEm,
        email: String(pedido?.customer?.email || '').trim().toLowerCase(),
        telefone: String(pedido?.customer?.phone || '').replace(/\D/g, ''),
        utm_source: utm.utm_source || null,
        utm_medium: utm.utm_medium || null,
        utm_campaign: utm.utm_campaign || null,
        utm_content: utm.utm_content || null,
      });
    }
  }
  return vendas;
}

/**
 * Retrato do formato de um aviso que não virou venda, para conferir no registro
 * o que a Zouti mandou: só nomes de campos e códigos de produto, nunca dado da
 * pessoa.
 */
function formatoDoAviso(aviso, pedido) {
  const chaves = (o) => (o && typeof o === 'object' ? Object.keys(o).slice(0, 30).join(',') : typeof o);
  const itens = Array.isArray(pedido?.items) ? pedido.items : null;
  const produtos = itens ? itens.map((i) => `${i?.product_id ?? '?'}x${i?.quantity ?? '?'}`).join(',') : 'sem items';
  const camposItem = itens && itens[0] ? chaves(itens[0]) : '';
  return ` | campos: ${chaves(aviso)} | itens: ${produtos} | campos do item: ${camposItem}`.slice(0, 900);
}

async function gravarVendas(db, vendas) {
  for (const v of vendas) {
    await db.prepare(
      `INSERT INTO imersao_vendas (id, produto, valor_centavos, pago_em, email, telefone,
                                   utm_source, utm_medium, utm_campaign, utm_content, situacao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paga')
       ON CONFLICT(id) DO UPDATE SET
         produto = excluded.produto, valor_centavos = excluded.valor_centavos, pago_em = excluded.pago_em,
         email = excluded.email, telefone = excluded.telefone,
         utm_source = excluded.utm_source, utm_medium = excluded.utm_medium,
         utm_campaign = excluded.utm_campaign, utm_content = excluded.utm_content, situacao = 'paga'`,
    ).bind(v.id, v.produto, v.valor_centavos, v.pago_em, v.email, v.telefone,
      v.utm_source, v.utm_medium, v.utm_campaign, v.utm_content).run();
  }
  return vendas.length;
}

async function mudarSituacao(db, pedidoId, situacao) {
  // `substr` em vez de LIKE: o identificador do pedido pode ter `_`, que no LIKE é coringa.
  const prefixo = `${pedidoId}:`;
  const r = await db.prepare(
    'UPDATE imersao_vendas SET situacao = ? WHERE substr(id, 1, ?) = ?',
  ).bind(situacao, prefixo.length, prefixo).run();
  return r?.meta?.changes || 0;
}

async function registrar(db, cab, objetoId, resultado, motivo, vendas, agora) {
  // Sem identificador de entrega (não deveria acontecer), cria um para não perder o registro.
  const entrega = cab.entregaId || `sem-id:${cab.eventoId || objetoId || 'aviso'}:${agora}`;
  await db.prepare(
    `INSERT INTO imersao_avisos (entrega_id, evento_id, tipo, objeto_id, resultado, motivo, vendas, recebido_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(entrega_id) DO UPDATE SET resultado = excluded.resultado, motivo = excluded.motivo,
       vendas = excluded.vendas, recebido_em = excluded.recebido_em`,
  ).bind(entrega, cab.eventoId || null, cab.tipo || null, objetoId || null, resultado, motivo || null, vendas, agora).run();
}

/**
 * Processa um aviso da Zouti.
 * `cab` = { assinatura, tipo, eventoId, entregaId, objetoId } (cabeçalhos).
 * Devolve { status, corpo } para o endereço responder.
 *   401: assinatura ausente ou errada, ou segredo não configurado. Nada gravado.
 *   200: aviso aceito (gravado ou ignorado).
 *   Falha do banco sobe como exceção: o endereço responde 500 e a Zouti reenvia.
 */
export async function processarAviso({ env, corpo, cab, agora = Math.floor(Date.now() / 1000) }) {
  if (!(await assinaturaConfere(env.ZOUTI_WEBHOOK_SECRET, cab.assinatura, corpo))) {
    return { status: 401, corpo: { erro: 'assinatura inválida' } };
  }
  const db = env.DB;
  const ignorar = async (objetoId, motivo) => {
    await registrar(db, cab, objetoId, 'ignorado', motivo, 0, agora);
    return { status: 200, corpo: { ok: true, resultado: 'ignorado', motivo } };
  };

  let aviso;
  try {
    aviso = JSON.parse(corpo);
  } catch {
    return ignorar(cab.objetoId, 'corpo inválido');
  }
  // O objeto pode vir na raiz ou embrulhado (a documentação mostra o objeto; o
  // envelope não é descrito).
  const pedido = aviso && typeof aviso === 'object' && !aviso.id && aviso.data && typeof aviso.data === 'object' ? aviso.data : aviso;
  const pedidoId = pedido?.id || cab.objetoId || '';
  // O tipo vem no cabeçalho `x-zouti-event-type`; se faltar, tenta o corpo (SUP-S10-20).
  const tipo = cab.tipo || aviso?.event_type || aviso?.event || '';

  if (tipo === 'ORDER_PAID') {
    if (!pedidoId) return ignorar('', 'pedido sem identificador');
    const vendas = vendasDoPedido({ ...pedido, id: pedidoId }, agora);
    if (!vendas.length) return ignorar(pedidoId, `produto de fora${formatoDoAviso(aviso, pedido)}`);
    const n = await gravarVendas(db, vendas);
    await registrar(db, cab, pedidoId, 'gravado', null, n, agora);
    return { status: 200, corpo: { ok: true, resultado: 'gravado', vendas: n } };
  }

  const situacao = SITUACAO_POR_TIPO[tipo];
  if (situacao) {
    const n = pedidoId ? await mudarSituacao(db, pedidoId, situacao) : 0;
    if (!n) return ignorar(pedidoId, 'pedido desconhecido');
    await registrar(db, cab, pedidoId, 'gravado', null, n, agora);
    return { status: 200, corpo: { ok: true, resultado: 'gravado', vendas: n } };
  }

  return ignorar(pedidoId, 'tipo não usado');
}
