// Acesso à API do ManyChat — inscrever alguém e aplicar uma tag.
//
// Existe para a ponte da Greenn (functions/api/webhooks/greenn.js): a tag
// filtra os compradores e o fluxo manda a confirmação, então "inscrever + taguear" é a operação
// (+ fluxo) inteira do ponto de vista de quem chama.
//
// Prefixo "_": o Cloudflare Pages não transforma em rota. Mora em
// functions/api/ pelo mesmo motivo de _clickup.js e _hash.js.
//
// NÃO reaproveita o `handleManyChat` de functions/webhook/_core.js de
// propósito: aquele está preso ao pipeline antigo de compras (exige
// `productConfig` de config/products.js, que está vazio) e desiste quando o
// inscrito já existe. Ver a descoberta documentada abaixo.
//
// ------------------------------------------------------------------------
// COMO A API DO MANYCHAT SE COMPORTA (testado contra a conta real, 2026-08-13)
//
// 1. O telefone vai em DÍGITOS, sem `+`: `5521993911946`. É o mesmo formato do
//    `normalizePhone` do projeto — confirmado, a API reconhece.
// 2. `createSubscriber` FALHA quando o WhatsApp já existe, com
//    "This WhatsApp ID already exists". Não devolve o id do existente.
// 3. Quem nasce só com WhatsApp fica com o campo `phone` VAZIO, e
//    `findBySystemField` só aceita `phone` ou `email` — `whatsapp_phone` é
//    recusado com "Only phone or email can be specified". Resultado: um inscrito
//    só-WhatsApp é INENCONTRÁVEL pela API.
// 4. `setSystemField` NÃO existe (404). Quem preenche o telefone é
//    `updateSubscriber`, e ele exige `subscriber_id` — não aceita o WhatsApp
//    como identificador.
//
// Daí o passo 2 desta função: preencher `phone` logo na criação torna a pessoa
// encontrável para sempre. Sem ele, a única chance de agir sobre alguém é o
// instante em que ele nasce.
//
// 5. `findBySystemField` responde `status: success` com `data: []` quando NÃO
//    acha — só o array vazio indica ausência (confirmado em 2026-09-09).
// ------------------------------------------------------------------------

const MANYCHAT_API = 'https://api.manychat.com';

function manychatFetch(path, body, env) {
  return fetch(`${MANYCHAT_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.MANYCHAT_API}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

// Procura um inscrito pelo campo `phone` ou `email`. Devolve o id ou ''.
// Só acha quem tem o campo preenchido — quem nasceu só com WhatsApp continua
// inencontrável (item 3 acima).
export async function buscarInscrito(campo, valor, env) {
  if (!valor) return '';
  try {
    const res = await fetch(
      `${MANYCHAT_API}/fb/subscriber/findBySystemField?${campo}=${encodeURIComponent(valor)}`,
      { headers: { Authorization: `Bearer ${env.MANYCHAT_API}` } },
    );
    if (!res.ok) return '';
    const data = (await res.json())?.data;
    if (Array.isArray(data)) return data[0]?.id ? String(data[0].id) : '';
    return data?.id ? String(data.id) : '';
  } catch (e) {
    return '';
  }
}

export async function aplicarTag(subscriberId, tagId, env) {
  const tagRes = await manychatFetch('/fb/subscriber/addTag', {
    subscriber_id: subscriberId,
    tag_id: tagId,
  }, env);
  if (tagRes.ok) return '';
  const t = await tagRes.text().catch(() => '');
  return `tag falhou: ${t.slice(0, 200)}`;
}

// Tira uma tag de quem já é inscrito. Existe para o caso "voltou" do grupo da
// live (functions/api/_grupo-live-manychat.js): quem tinha a tag de saída e
// entrou de novo precisa perdê-la, senão a tag para de descrever a situação
// atual. Remover tag que a pessoa não tem é sucesso silencioso na API —
// o que importa é o estado final.
export async function removerTag(subscriberId, tagId, env) {
  const res = await manychatFetch('/fb/subscriber/removeTag', {
    subscriber_id: subscriberId,
    tag_id: tagId,
  }, env);
  if (res.ok) return '';
  const t = await res.text().catch(() => '');
  return `remover tag falhou: ${t.slice(0, 200)}`;
}

// Dispara um fluxo direto no inscrito. Existe porque o gatilho "Tag aplicada"
// do ManyChat NÃO roda quando a tag vem pela API — só quando é aplicada à mão
// no painel (confirmado pela usuária em 2026-09-17: nenhuma compra jamais acionou a
// automação, mas a tag manual dispara na hora).
// `sendFlow` pode responder 200 com `status: "error"` no corpo, por isso o
// corpo também é conferido.
async function dispararFluxo(subscriberId, flowNs, env) {
  const res = await manychatFetch('/fb/sending/sendFlow', {
    subscriber_id: subscriberId,
    flow_ns: flowNs,
  }, env);
  const t = await res.text().catch(() => '');
  let status = '';
  try { status = JSON.parse(t)?.status || ''; } catch (e) { /* corpo ilegível */ }
  if (res.ok && status !== 'error') return '';
  return `fluxo falhou: ${t.slice(0, 200)}`;
}

// Tag e, se houver `flowNs`, o fluxo. Com `tagEnviadoId`, a tag de controle
// só entra DEPOIS de o fluxo ter sido aceito — é o registro, visível no
// ManyChat, de quem recebeu a confirmação. Devolve '' ou a descrição da falha.
async function taguearEDisparar(subscriberId, tagId, flowNs, tagEnviadoId, env) {
  const falhaTag = await aplicarTag(subscriberId, tagId, env);
  if (falhaTag || !flowNs) return falhaTag;
  const falhaFluxo = await dispararFluxo(subscriberId, flowNs, env);
  if (falhaFluxo || !tagEnviadoId) return falhaFluxo;
  const falhaControle = await aplicarTag(subscriberId, tagEnviadoId, env);
  return falhaControle ? `fluxo enviado, mas a tag de controle falhou: ${falhaControle}` : '';
}

// Divide "Fulana de Tal Silva" em primeiro e último nome. O ManyChat guarda os
// dois separados, e mandar o nome inteiro no primeiro campo deixa a saudação do
// fluxo esquisita ("Oi, Fulana de Tal Silva!").
function separarNome(nome) {
  const partes = (nome || '').toString().trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return { primeiro: '', ultimo: '' };
  if (partes.length === 1) return { primeiro: partes[0], ultimo: '' };
  return { primeiro: partes[0], ultimo: partes.slice(1).join(' ') };
}

/**
 * Inscreve alguém no ManyChat pelo WhatsApp e aplica uma tag.
 *
 * `flowNs` (opcional) é o fluxo disparado logo depois da tag — necessário
 * porque tag aplicada pela API não aciona automação (ver `dispararFluxo`).
 * Só a criação de um inscrito NOVO ou o achado de um existente disparam; quem
 * chama é responsável por não chamar duas vezes para a mesma venda.
 * `tagEnviadoId` (opcional) é aplicada só quando o fluxo foi aceito.
 *
 * `telefone` precisa vir NORMALIZADO em dígitos com DDI (use `normalizePhone`
 * de ./_hash.js). `tagId` é o ID numérico da tag — o nome não serve.
 *
 * Devolve `{ ok, motivo, subscriberId }`. Nunca lança: quem chama está num
 * caminho best-effort e uma exceção aqui não pode derrubar nada.
 *
 * `motivo` distingue os desfechos que importam:
 *   'inscrito'     — criado e tagueado (caminho feliz)
 *   'ja_existia_tagueado' — o WhatsApp já estava na conta; achado pelo
 *                    `phone` ou pelo `email` e tagueado (ok: true)
 *   'ja_existia'   — o WhatsApp já estava na conta e NÃO foi achado nem por
 *                    `phone` nem por `email` (inscrito só-WhatsApp); sem tag
 *   'sem_config'   — falta MANYCHAT_API ou tagId
 *   'sem_telefone' — sem número não há como inscrever por WhatsApp
 *   'erro'         — qualquer outra falha (detalhe no log de quem chama)
 */
export async function inscreverComTag({ nome, telefone, email, tagId, flowNs, tagEnviadoId, consentimento, env }) {
  if (!env.MANYCHAT_API || !tagId) {
    return { ok: false, motivo: 'sem_config', subscriberId: null };
  }
  if (!telefone) {
    return { ok: false, motivo: 'sem_telefone', subscriberId: null };
  }

  const { primeiro, ultimo } = separarNome(nome);

  // 1. Criar o inscrito
  const criaRes = await manychatFetch('/fb/subscriber/createSubscriber', {
    first_name: primeiro,
    last_name: ultimo,
    whatsapp_phone: telefone,
  }, env);

  const criaTexto = await criaRes.text().catch(() => '');

  if (!criaRes.ok) {
    if (!/already exists/i.test(criaTexto)) {
      return { ok: false, motivo: 'erro', subscriberId: null, detalhe: criaTexto.slice(0, 200) };
    }

    // "já existe" é um desfecho previsto: quem já está na conta é procurado
    // pelo `phone` e depois pelo `email` e recebe a tag no contato existente.
    const existenteId =
      (await buscarInscrito('phone', telefone, env)) ||
      (await buscarInscrito('email', email, env));
    if (!existenteId) {
      return { ok: false, motivo: 'ja_existia', subscriberId: null, detalhe: criaTexto.slice(0, 200) };
    }
    const falhaTag = await taguearEDisparar(existenteId, tagId, flowNs, tagEnviadoId, env);
    if (falhaTag) {
      return { ok: false, motivo: 'erro', subscriberId: existenteId, detalhe: falhaTag };
    }
    return { ok: true, motivo: 'ja_existia_tagueado', subscriberId: existenteId };
  }

  let subscriberId = '';
  try {
    subscriberId = JSON.parse(criaTexto)?.data?.id || '';
  } catch (e) {
    return { ok: false, motivo: 'erro', subscriberId: null, detalhe: 'resposta ilegível na criação' };
  }
  if (!subscriberId) {
    return { ok: false, motivo: 'erro', subscriberId: null, detalhe: 'criação sem id' };
  }

  // 2. Preencher o campo `phone`. É o passo que torna a pessoa ENCONTRÁVEL
  //    depois — sem ele, `findBySystemField` nunca acha quem entrou por
  //    WhatsApp. Best-effort: falhar aqui não justifica perder a tag, que é o
  //    que dispara o fluxo.
  try {
    await manychatFetch('/fb/subscriber/updateSubscriber', {
      subscriber_id: subscriberId,
      phone: telefone,
      has_opt_in_sms: true,
      // Registro da origem do opt-in. Cada ponte informa a sua; o padrão é a
      // da Greenn, que foi a primeira a usar este helper.
      consent_phrase: consentimento || 'compra do Workshop Black Exponencial',
    }, env);
  } catch (e) {
    /* segue para a tag */
  }

  // 3. A tag (filtro dos disparos em massa) e o fluxo de confirmação.
  const falhaTag = await taguearEDisparar(subscriberId, tagId, flowNs, tagEnviadoId, env);
  if (falhaTag) {
    return { ok: false, motivo: 'erro', subscriberId, detalhe: falhaTag };
  }

  return { ok: true, motivo: 'inscrito', subscriberId };
}
