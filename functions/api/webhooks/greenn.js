// POST /api/webhooks/greenn  (GET/HEAD respondem 200 — ver abaixo)
//
// Recebe os webhooks da Greenn, a plataforma de checkout de um produto
// SEPARADO do restante do tracking. A URL é cadastrada no campo `url_callback`
// de cada produto na Greenn — quais produtos entram é decisão operacional de
// onde a URL foi colada, não deste código.
//
// Auth: header `X-Webhook-Token`, comparado com env.GREENN_WEBHOOK_TOKEN. É o
// único fator disponível: a Greenn não assina o corpo com HMAC.
//
// Responde 200 mesmo quando não entende o evento. Um 5xx nosso faria a Greenn
// tratar como falha de entrega, e ela não promete reentrega — o erro nosso
// viraria perda de dado dela. A única exceção é falha de escrita no D1, onde o
// dado realmente não entrou e um 200 mentiria.
//
// O payload traz nome, e-mail, celular, CPF e endereço do comprador: nada de
// raw_json em log, nunca.

import { extrairEvento } from './_greenn-evento.js';

// GET/HEAD respondem 200 só para dizer "esta URL existe".
//
// Motivo concreto (2026-08-12): o botão de evento de teste do painel da Greenn
// falhava com "Falha no envio" e SEM código HTTP — sinal de que a requisição
// nem completava. O endpoint só exportava onRequestPost, então qualquer GET
// batia no 404 do Pages. Plataformas de webhook comumente validam a URL com um
// GET antes de entregar, e uma validação que 404 derruba a entrega inteira.
//
// Não expõe nada: sem dados, sem contagem, sem estado. E NÃO é um caminho de
// autenticação alternativo — gravar continua sendo só via POST com o token.
export async function onRequestGet() {
  return json({ ok: true, endpoint: 'greenn', metodo: 'use POST para entregar eventos' });
}

export async function onRequestHead() {
  return new Response(null, { status: 200 });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const enviado = request.headers.get('x-webhook-token') || '';
  if (!env.GREENN_WEBHOOK_TOKEN || !tokenConfere(enviado, env.GREENN_WEBHOOK_TOKEN)) {
    // NUNCA o valor recebido nem o esperado: são segredos mesmo quando estão
    // errados. O que vai para o log são três booleanos que separam as causas de
    // um 401 sem revelar nada — sem eles, "401" é um beco sem saída:
    //   configurado=false          → falta o secret GREENN_WEBHOOK_TOKEN no Pages
    //   recebido=false             → a plataforma não mandou o header
    //   mesmoTamanho=false         → é outro token
    //   mesmoTamanho=true          → mesmo tamanho, conteúdo diferente
    //                                (espaço colado junto, quebra de linha)
    console.error('greenn — 401:', {
      configurado: !!env.GREENN_WEBHOOK_TOKEN,
      recebido: enviado.length > 0,
      mesmoTamanho: enviado.length === (env.GREENN_WEBHOOK_TOKEN || '').length,
    });
    return json({ error: 'Unauthorized' }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    console.error('greenn — JSON inválido no corpo da requisição:', e?.message || e);
    return json({ ok: true, status: 'ignorado', motivo: 'json_invalido' });
  }

  const evento = extrairEvento(body);
  if (!evento) {
    // Corpo sem forma de evento da Greenn (não é objeto, ou não tem `event`
    // string) — não há o que gravar. Isso é diferente de "evento desconhecido
    // mas reconhecível", que extrairEvento já devolve como objeto (com
    // entity_type nulo) para ser gravado logo abaixo.
    console.error('greenn — corpo sem formato de evento reconhecível:', {
      type: body?.type,
      event: body?.event,
    });
    return json({ ok: true, status: 'ignorado', motivo: 'corpo_invalido' });
  }

  if (evento.entity_type === null) {
    // Só o suficiente para diagnosticar: se a Greenn criar um evento novo,
    // isto é o que vai aparecer no log do Pages. O evento é gravado mesmo
    // assim (abaixo) — a Greenn não reentrega, então descartar aqui seria
    // perda definitiva do dado.
    console.error('greenn — evento desconhecido, gravando com entity_type nulo:', {
      type: body?.type,
      event: evento.event,
    });
  }

  // Íntegro, sem truncar: o raw_json é a fonte da verdade desta tabela, e um
  // corte no meio produziria JSON inválido.
  const cru = JSON.stringify(body);

  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO greenn_webhook_event
         (event, entity_type, entity_id, current_status, product_id, amount,
          entity_updated, received_at, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      evento.event, evento.entity_type, evento.entity_id, evento.current_status,
      evento.product_id, evento.amount, evento.entity_updated,
      Math.floor(Date.now() / 1000), cru
    ).run();
  } catch (e) {
    // Único 5xx do endpoint, e é honesto: o dado não entrou.
    console.error('greenn — falha ao gravar no D1:', e?.message || e);
    return json({ error: 'Erro ao gravar' }, 500);
  }

  return json({ ok: true, status: 'gravado', event: evento.event });
}

// Comparação em tempo constante. Um `!==` comum interrompe na primeira
// diferença e vaza o prefixo do token por timing. Por isso também NÃO se
// retorna cedo quando os comprimentos diferem: um early-return ali vazaria o
// comprimento do segredo pelo tempo de resposta. Quando os tamanhos não
// batem, comparamos `a` com ele mesmo (sempre igual) e negamos o resultado —
// mesmo custo de tempo do caminho "comprimentos batem, conteúdo não".
function tokenConfere(recebido, esperado) {
  const a = new TextEncoder().encode(recebido);
  const b = new TextEncoder().encode(esperado);
  const lengthsMatch = a.byteLength === b.byteLength;
  return lengthsMatch
    ? crypto.subtle.timingSafeEqual(a, b)
    : !crypto.subtle.timingSafeEqual(a, a);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
