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
import { deveCriarCard, montarCard, TAG_EDICAO } from './_greenn-clickup.js';
import { sendToGHL } from '../../tracker.js';
import {
  CU_FIELD,
  CU_DEFAULT_LIST,
  clickupFetch,
  searchClickUpTask,
  clickupWrite,
  addClickUpTag,
  toClickUpPhone,
} from '../_clickup.js';

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

  let linhaId = null;
  try {
    const gravou = await env.DB.prepare(
      `INSERT OR IGNORE INTO greenn_webhook_event
         (event, entity_type, entity_id, current_status, product_id, amount,
          entity_updated, received_at, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      evento.event, evento.entity_type, evento.entity_id, evento.current_status,
      evento.product_id, evento.amount, evento.entity_updated,
      Math.floor(Date.now() / 1000), cru
    ).run();
    // `meta.last_row_id` só vale quando a linha realmente entrou. Numa reentrega
    // o INSERT OR IGNORE não insere nada, e aí não há ponte a fazer — o card já
    // foi criado na primeira vez.
    linhaId = gravou?.meta?.changes ? gravou.meta.last_row_id : null;
  } catch (e) {
    // Único 5xx do endpoint, e é honesto: o dado não entrou.
    console.error('greenn — falha ao gravar no D1:', e?.message || e);
    return json({ error: 'Erro ao gravar' }, 500);
  }

  // As pontes são o ÚLTIMO passo e rodam fora do caminho da resposta. Só venda
  // paga que acabou de entrar (linhaId não-nulo) vira contato: reentrega não
  // duplica.
  //
  // Dois `waitUntil` separados, e não um só encadeado: o ClickUp e o
  // GoHighLevel são destinos independentes. Se o CRM estiver fora do ar, o
  // contato ainda entra no e-mail marketing, e vice-versa.
  if (linhaId && deveCriarCard(body)) {
    context.waitUntil(pontearParaClickUp(env, body, linhaId));
    context.waitUntil(pontearParaGHL(env, body));
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

// PONTE GREENN → CLICKUP
//
// Roda em waitUntil: a resposta 200 para a Greenn já saiu quando isto executa.
// Nada aqui pode alterar, atrasar ou derrubar aquela resposta — a Greenn não
// reentrega, e um erro nosso viraria perda de dado dela.
//
// Falha deixa `clickup_task_id` NULL na linha já gravada. Como o raw_json está
// guardado, a venda é recuperável: nada se perde, só fica pendente. Não há
// retry automático de propósito (ver spec 2026-08-13).
async function pontearParaClickUp(env, payload, linhaId) {
  if (!env.CLICKUP_API_TOKEN) {
    console.error('greenn — ponte ClickUp ignorada: falta CLICKUP_API_TOKEN');
    return;
  }

  const cliente = payload.client || {};
  const vendaId = payload.sale && payload.sale.id;

  try {
    // Origem da visita: o sf_trk é o mesmo UUID gravado em checkout_sessions
    // quando a pessoa entrou na LP (confirmado com a venda 9606659). Sem ele, ou
    // sem linha casada, o card sai sem UTMs — não se inventa origem.
    let sessao = null;
    if (payload.sf_trk) {
      try {
        sessao = await env.DB.prepare(
          `SELECT utm_source, utm_medium, utm_campaign, utm_content
             FROM checkout_sessions WHERE trk = ?`
        ).bind(payload.sf_trk).first();
      } catch (e) {
        console.error('greenn — falha ao buscar a sessão do sf_trk:', e?.message || e);
      }
    }

    const card = montarCard(payload, sessao);

    // Dedup: telefone primeiro, depois e-mail — DELIBERADAMENTE a mesma ordem
    // de functions/tracker.js (linha ~806). Com dados divergentes no CRM, uma
    // ordem diferente entre os dois fluxos pode casar a mesma pessoa em cards
    // diferentes. A busca chama toClickUpPhone diretamente em vez de escavar
    // card.custom_fields: depois da correção do campo de telefone omitido
    // quando vazio, o campo pode nem existir no array, e cavar ali faria a
    // busca por telefone parar de acontecer em silêncio.
    let existente = null;
    try {
      existente =
        (await searchClickUpTask(CU_FIELD.whatsapp, toClickUpPhone(cliente.cellphone), env)) ||
        (await searchClickUpTask(CU_FIELD.email, cliente.email || '', env));
    } catch (e) {
      console.error('greenn — busca no ClickUp falhou, seguindo como novo:', e?.message || e);
    }

    let taskId;
    if (existente) {
      // NÃO sobrescreve Funil nem Produto: se a pessoa veio de LIVES SEMANAIS,
      // ela continua vindo de lá. Carimbar WO PAGO por cima apagaria a origem
      // verdadeira. A tag e o comentário são aditivos.
      taskId = existente.id;
    } else {
      const listId = env.CLICKUP_LIST_ID || CU_DEFAULT_LIST;
      const createTask = (customFields) => clickupWrite(() => clickupFetch(`/list/${listId}/task`, {
        method: 'POST',
        body: JSON.stringify({
          name: card.name,
          status: card.status,
          custom_fields: customFields,
        }),
      }, env));
      let res;
      try {
        res = await createTask(card.custom_fields);
      } catch (e) {
        // Mesmo comportamento documentado em functions/tracker.js (~linha 876):
        // um telefone fora do padrão do campo type: phone faz a API do ClickUp
        // responder 400 e derrubar a criação da task inteira. clickupWrite não
        // repete em 400 (só 429/5xx/rede) e anexa o status no erro, então dá
        // pra detectar aqui e tentar de novo sem o campo de telefone. Se a
        // segunda tentativa também falhar, propaga pro catch geral.
        const temWhatsapp = card.custom_fields.some((f) => f.id === CU_FIELD.whatsapp);
        if (e.status !== 400 || !temWhatsapp) throw e;
        console.error('greenn — ClickUp create 400 com whatsapp — repetindo sem o campo phone');
        res = await createTask(card.custom_fields.filter((f) => f.id !== CU_FIELD.whatsapp));
      }
      const criada = await res.json();
      taskId = criada.id;
    }

    if (!taskId) {
      console.error('greenn — ClickUp não devolveu id da task; venda', vendaId);
      return;
    }

    await addClickUpTag(taskId, TAG_EDICAO, env);

    // Comentário best-effort: o card já existe e já está tagueado, então falhar
    // aqui não justifica marcar a ponte como perdida.
    try {
      await clickupWrite(() => clickupFetch(`/task/${taskId}/comment`, {
        method: 'POST',
        body: JSON.stringify({ comment_text: card.comentario, notify_all: false }),
      }, env));
    } catch (e) {
      console.error('greenn — comentário falhou na venda', vendaId, e?.message || e);
    }

    if (linhaId) {
      await env.DB.prepare(
        `UPDATE greenn_webhook_event SET clickup_task_id = ? WHERE id = ?`
      ).bind(taskId, linhaId).run();
    }
  } catch (e) {
    // Só o id da venda: o payload carrega nome, e-mail, telefone e CPF.
    console.error('greenn — ponte ClickUp falhou na venda', vendaId, e?.message || e);
  }
}

// PONTE GREENN → GOHIGHLEVEL (e-mail marketing)
//
// Mesmo gatilho do ClickUp — venda paga, uma vez só — mas destino independente:
// roda no próprio waitUntil para que a queda de um não leve o outro junto.
//
// `sendToGHL` já faz upsert (dedup por e-mail OU telefone) e aplica a tag de
// forma ADITIVA, então um comprador que já era lead mantém as tags antigas e
// ganha esta. Ele também é best-effort por dentro: sem TOKEN_GHL/LOCAL_ID, ou
// sem e-mail e telefone, apenas desiste com log.
//
// A tag sai de `TAG_EDICAO` de propósito — a mesma constante que nomeia a tag do
// ClickUp. `ghlFunnelTag` prefixa `funil-`, então a tag lá vira
// `funil-wo-pago-09-09`. Ler as duas do mesmo lugar é o que impede os dois
// destinos de divergirem quando a próxima turma trocar a edição.
async function pontearParaGHL(env, payload) {
  const cliente = payload.client || {};
  const vendaId = payload.sale && payload.sale.id;
  try {
    await sendToGHL({
      leadData: {
        nome: cliente.name || '',
        email: cliente.email || '',
        telefone: cliente.cellphone || '',
        funnel: TAG_EDICAO,
      },
      env,
    });
  } catch (e) {
    // Só o id da venda: o payload carrega nome, e-mail, telefone e CPF.
    console.error('greenn — ponte GHL falhou na venda', vendaId, e?.message || e);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
