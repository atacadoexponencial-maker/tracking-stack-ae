// O que acontece fora do banco quando a Zouti avisa de uma compra da Imersão
// (spec-popup-checkout-imersao.md, série S10, issue S10-07; decisão da usuária
// em 14/11/2026): linha na aba Compras da planilha, card do funil IMERSÃO no CRM
// (ou comentário no card que a pessoa já tem) e comprador na lista de e-mail.
//
// REGRA: nada aqui pode derrubar o aviso. A venda já está gravada quando isto
// roda; cada passo tem o próprio try/catch e a falha fica só no log (sem dado
// da pessoa). A Zouti desliga o webhook depois de 10 falhas seguidas.
//
// O site não envia nada ao Meta, não manda WhatsApp nem e-mail e não grava em
// lead_dispatch nem em event_log: comprador da Imersão não é lead dos outros
// funis (fica fora do total de leads e do CPL).
import {
  CU_FIELD, CU_DEFAULT_LIST, CU_FUNIL_IMERSAO, clickupFetch, clickupWrite,
  searchClickUpTask, searchClickUpTaskPorTelefone, toClickUpPhone,
} from './_clickup.js';
import { padronizarTelefone } from '../_telefone.js';
import { acrescentarLinha } from './_google-planilha.js';
import { dataHoraBrasilia } from './hotseat-giulliano-puga.js';
import { registrarLead } from './_email-contatos.js';
import { PLANILHA, CONTA } from './imersao-cadastro.js';

export const ABA_COMPRAS = 'Compras';
export const CABECALHO_COMPRAS = [
  'Data/hora', 'Produto', 'Valor', 'Nome', 'E-mail', 'WhatsApp',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'Pedido', 'Situação',
];
// Mesma primeira etapa dos cards que nascem pela Greenn (SUP-S10-02).
const STATUS_INICIAL = 'leads de entrada';
const NOME_PRODUTO = { ingresso: 'Ingresso', bump: 'Bump' };
const NOME_SITUACAO = { paga: 'Paga', reembolsada: 'Reembolsada', cancelada: 'Cancelada' };
const O_QUE_HOUVE = {
  ORDER_REFUNDED: 'foi reembolsada',
  ORDER_DISPUTED: 'entrou em chargeback (contestação no cartão)',
  ORDER_CANCELED: 'foi cancelada',
};

const reais = (centavos) => `R$ ${(Number(centavos || 0) / 100).toFixed(2).replace('.', ',')}`;
const erro = (onde, pedidoId, e) => console.error(`[imersao-compra] ${onde} falhou no pedido`, pedidoId, e?.codigo || '', e?.status || '', e?.message || e);

/** Quem comprou, do jeito que a Zouti mandou. */
export function compradorDoPedido(pedido) {
  const c = pedido?.customer || {};
  const utm = pedido?.utm_data || {};
  const tel = padronizarTelefone(c.phone);
  return {
    nome: String(c.name || '').trim(),
    email: String(c.email || '').trim().toLowerCase(),
    telefone: tel.situacao === 'impossivel' || tel.situacao === 'ausente' ? '' : tel.digitos,
    telefoneBruto: c.phone || '',
    utms: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].map((k) => String(utm[k] || '')),
  };
}

/** "Ingresso (R$ 29,00) e Bump (R$ 297,00), total de R$ 326,00". */
export function resumoDaCompra(vendas) {
  const itens = vendas.map((v) => `${NOME_PRODUTO[v.produto] || v.produto} (${reais(v.valor_centavos)})`);
  const total = vendas.reduce((s, v) => s + Number(v.valor_centavos || 0), 0);
  return `${itens.join(' e ')}${vendas.length > 1 ? `, total de ${reais(total)}` : ''}`;
}

async function linhasNaPlanilha(env, gravar, pedidoId, comprador, vendas, situacao, quandoMs) {
  for (const v of vendas) {
    await gravar(env, {
      subject: CONTA, planilha: PLANILHA, aba: ABA_COMPRAS, cabecalho: CABECALHO_COMPRAS, criarAba: true,
      linha: [
        dataHoraBrasilia(quandoMs), NOME_PRODUTO[v.produto] || v.produto, reais(v.valor_centavos),
        comprador.nome, comprador.email, comprador.telefone, ...comprador.utms, pedidoId, NOME_SITUACAO[situacao] || situacao,
      ],
    });
  }
}

async function cardDoComprador(env, comprador) {
  try {
    return (await searchClickUpTaskPorTelefone(CU_FIELD.whatsapp, comprador.telefoneBruto, env))
      || (await searchClickUpTask(CU_FIELD.email, comprador.email, env));
  } catch (e) {
    console.error('[imersao-compra] busca no CRM falhou, seguindo como pessoa nova:', e?.message || e);
    return null;
  }
}

const comentar = (env, taskId, texto) => clickupWrite(() => clickupFetch(`/task/${taskId}/comment`, {
  method: 'POST',
  body: JSON.stringify({ comment_text: texto, notify_all: false }),
}, env));

async function compraNoCrm(env, pedidoId, comprador, vendas) {
  const texto = `Comprou a Imersão Planejamento Atacado 2027 pela Zouti: ${resumoDaCompra(vendas)}. Pedido ${pedidoId}.`;
  const existente = await cardDoComprador(env, comprador);
  // Quem já tem card não ganha um segundo, e o Funil dele não é trocado: a
  // origem verdadeira da pessoa continua valendo.
  if (existente) return comentar(env, existente.id, texto);

  const total = vendas.reduce((s, v) => s + Number(v.valor_centavos || 0), 0);
  const campos = [
    { id: CU_FIELD.nome, value: comprador.nome },
    { id: CU_FIELD.email, value: comprador.email },
    { id: CU_FIELD.funil, value: CU_FUNIL_IMERSAO },
    // 💵 Valor, nunca 💰 Arrecadado (ver _clickup.js).
    { id: CU_FIELD.valor, value: total / 100 },
  ];
  // Campo vazio aparece preenchido-porém-vazio no ClickUp: só entra o que tem valor.
  const whatsapp = toClickUpPhone(comprador.telefoneBruto);
  if (whatsapp) campos.push({ id: CU_FIELD.whatsapp, value: whatsapp });
  [CU_FIELD.utmSource, CU_FIELD.utmMedium, CU_FIELD.utmCampaign, CU_FIELD.utmContent].forEach((id, i) => {
    if (comprador.utms[i]) campos.push({ id, value: comprador.utms[i] });
  });

  const listId = env.CLICKUP_LIST_ID || CU_DEFAULT_LIST;
  const criar = (customFields) => clickupWrite(() => clickupFetch(`/list/${listId}/task`, {
    method: 'POST',
    body: JSON.stringify({ name: comprador.nome || `Compra Zouti ${pedidoId}`, status: STATUS_INICIAL, description: texto, custom_fields: customFields }),
  }, env));
  try {
    return await criar(campos);
  } catch (e) {
    // Telefone fora do padrão do campo derruba a criação com 400 (mesmo caso da
    // Greenn e do /tracker): repete sem o campo.
    if (e.status !== 400 || !whatsapp) throw e;
    return criar(campos.filter((f) => f.id !== CU_FIELD.whatsapp));
  }
}

/** Pedido pago: planilha, CRM e lista de e-mail. Nunca lança. */
export async function efeitosDaCompra({ env, pedido, pedidoId, vendas, gravar = acrescentarLinha }) {
  const comprador = compradorDoPedido(pedido);
  const pagoEm = vendas[0]?.pago_em || Math.floor(Date.now() / 1000);

  try {
    await linhasNaPlanilha(env, gravar, pedidoId, comprador, vendas, 'paga', pagoEm * 1000);
  } catch (e) { erro('planilha', pedidoId, e); }

  try {
    if (!env.CLICKUP_API_TOKEN) throw new Error('falta CLICKUP_API_TOKEN');
    await compraNoCrm(env, pedidoId, comprador, vendas);
  } catch (e) { erro('CRM', pedidoId, e); }

  try {
    // Só entra na lista, marcado com o funil: nada dispara envio (o e-mail do
    // comprador fica para depois, decisão da usuária em 14/11).
    await registrarLead(env, { email: comprador.email, nome: comprador.nome, funil: 'imersao', origem: 'zouti', eventId: `zouti:${pedidoId}`, quando: pagoEm });
  } catch (e) { erro('lista de e-mail', pedidoId, e); }
}

/** Reembolso, cancelamento ou chargeback: linha nova na planilha e comentário no card. Nunca lança. */
export async function efeitosDaMudanca({ env, pedido, pedidoId, tipo, situacao, vendas, agora, gravar = acrescentarLinha }) {
  const comprador = compradorDoPedido(pedido);
  // Aviso sem os dados da pessoa: valem os da venda gravada.
  if (!comprador.email) comprador.email = vendas[0]?.email || '';
  if (!comprador.telefone) { comprador.telefone = vendas[0]?.telefone || ''; comprador.telefoneBruto = comprador.telefone; }

  try {
    await linhasNaPlanilha(env, gravar, pedidoId, comprador, vendas, situacao, agora * 1000);
  } catch (e) { erro('planilha', pedidoId, e); }

  try {
    if (!env.CLICKUP_API_TOKEN) throw new Error('falta CLICKUP_API_TOKEN');
    const card = await cardDoComprador(env, comprador);
    // A etapa do card não muda: só o comentário.
    if (card) await comentar(env, card.id, `A compra da Imersão Planejamento Atacado 2027 ${O_QUE_HOUVE[tipo] || 'mudou de situação'}: ${resumoDaCompra(vendas)}. Pedido ${pedidoId}.`);
  } catch (e) { erro('CRM', pedidoId, e); }
}
