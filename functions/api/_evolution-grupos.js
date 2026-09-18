// A ÚNICA porta desta feature para a Evolution. Todo o resto (executor,
// endpoints, painel) fala com este arquivo, nunca com a Evolution.
//
// Existe por uma razão específica: a Evolution está sendo aposentada como
// canal de WhatsApp deste projeto, e o número conectado pode cair a qualquer
// momento. Quando isso acontecer, é este arquivo que muda — não a feature.
//
// Nunca lança: devolve { ok, erro } para quem chama decidir o que fazer. É o
// mesmo contrato do buscar() em grupos-conexao.js, e é o que impede uma
// Evolution lenta de derrubar o endpoint inteiro.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

export const TIMEOUT_MS = 5000;

// Listar TODOS os grupos é bem mais caro que consultar um: a usuária participa
// de dezenas, e a Evolution monta a lista inteira antes de responder.
export const TIMEOUT_LISTA_MS = 25000;

/**
 * Credenciais da Evolution, ou null se faltar qualquer uma.
 *
 * Reusa EVOLUTION_APIKEY_NOTIF (mesma instância dos alertas e do card de
 * conexão); cadastrar a chave de novo só criaria uma segunda coisa para
 * rotacionar — e uma delas ficaria para trás.
 */
export function credenciais(env) {
  const base = String(env?.EVOLUTION_BASE_URL || '').trim().replace(/\/+$/, '');
  const instancia = String(env?.EVOLUTION_INSTANCE || '').trim();
  const apikey = env?.EVOLUTION_APIKEY_NOTIF;
  if (!base || !instancia || !apikey) return null;
  return { base, instancia, apikey };
}

/** Manda uma mensagem de texto no grupo. */
export async function enviarTexto(env, jid, texto, fetchImpl = fetch) {
  const c = credenciais(env);
  if (!c) return { ok: false, erro: faltando(env) };
  return chamar(
    `${c.base}/message/sendText/${encodeURIComponent(c.instancia)}`,
    { number: jid, text: texto },
    c.apikey, fetchImpl, 'enviar a mensagem',
  );
}

/** Troca o nome do grupo. Idempotente: aplicar duas vezes dá o mesmo resultado. */
export async function renomear(env, jid, titulo, fetchImpl = fetch) {
  const c = credenciais(env);
  if (!c) return { ok: false, erro: faltando(env) };
  return chamar(
    `${c.base}/group/updateGroupSubject/${encodeURIComponent(c.instancia)}?groupJid=${encodeURIComponent(jid)}`,
    { subject: titulo },
    c.apikey, fetchImpl, 'renomear o grupo',
  );
}

/**
 * Manda imagem, vídeo, documento ou áudio-como-arquivo.
 *
 * Duas escolhas aqui não são estilo, são defesa:
 *
 * 1. `media` é sempre uma URL, nunca base64. Vídeo em base64 derruba a
 *    Evolution com "Maximum call stack size exceeded" (bug aberto #1885, sem
 *    correção desde a 2.3.1).
 * 2. NÃO mandamos `mimetype`. O service faz `mimeTypes.lookup(fileName)` e
 *    sobrescreve o que viesse — e quando não reconhece a extensão devolve
 *    `false`, que vira a STRING "false" e entrega o arquivo corrompido, sem
 *    erro. Por isso a extensão do `fileName` é validada lá no upload.
 *
 * `delay` fica em 0 porque ele é implementado com "digitando…" e segura a
 * requisição HTTP inteira. Quem controla horário aqui é o cron.
 */
export async function enviarMidia(env, jid, { mediatype, url, fileName, caption }, fetchImpl = fetch) {
  const c = credenciais(env);
  if (!c) return { ok: false, erro: faltando(env) };

  const corpo = { number: jid, mediatype, media: url, fileName, delay: 0 };
  if (caption) corpo.caption = caption;

  return chamar(
    `${c.base}/message/sendMedia/${encodeURIComponent(c.instancia)}`,
    corpo, c.apikey, fetchImpl, 'enviar o arquivo',
  );
}

/**
 * Manda uma nota de voz (PTT).
 *
 * Endpoint separado porque `sendWhatsAppAudio` força `ptt: true` e
 * `audio/ogg; codecs=opus`. Ele NÃO aceita legenda — se houver texto, quem
 * chama manda uma segunda mensagem.
 *
 * `encoding` fica no default (ligado): a Evolution converte com ffmpeg, então
 * mp3 e m4a entram e saem como nota de voz de verdade.
 */
export async function enviarAudio(env, jid, url, fetchImpl = fetch) {
  const c = credenciais(env);
  if (!c) return { ok: false, erro: faltando(env) };
  return chamar(
    `${c.base}/message/sendWhatsAppAudio/${encodeURIComponent(c.instancia)}`,
    { number: jid, audio: url, delay: 0 },
    c.apikey, fetchImpl, 'enviar o áudio',
  );
}

/**
 * Consulta o grupo só para deixar o cache de metadados da Evolution quente.
 *
 * Existe por um motivo específico: quando esse cache está frio, o envio para
 * grupo falha com `404 Group not found` mesmo o grupo existindo no WhatsApp.
 * O resultado não interessa e o erro é engolido de propósito — isto é uma
 * tentativa de evitar uma falha, não uma etapa que possa causar outra.
 */
export async function aquecerGrupo(env, jid, fetchImpl = fetch) {
  const r = await infoGrupo(env, jid, fetchImpl);
  return { ok: r.ok };
}

/**
 * Metadados do grupo. Mesma chamada do aquecimento, mas devolvendo o corpo.
 *
 * Os campos que importam aqui são os que dizem QUE TIPO de grupo é este:
 *   isCommunity          → é a Comunidade em si (o grupo "pai")
 *   isCommunityAnnounce  → é o grupo de Avisos (o `default_sub_group`)
 *   linkedParent         → o JID da Comunidade a que ele pertence
 *
 * Essa distinção não é detalhe: operações que valem num grupo comum são
 * recusadas pelo servidor do WhatsApp com `bad-request` quando o alvo é o
 * Avisos ou o pai.
 */
export async function infoGrupo(env, jid, fetchImpl = fetch) {
  const c = credenciais(env);
  if (!c) return { ok: false, erro: faltando(env) };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const url = `${c.base}/group/findGroupInfos/${encodeURIComponent(c.instancia)}?groupJid=${encodeURIComponent(jid)}`;
    const res = await fetchImpl(url, { headers: { apikey: c.apikey }, signal: ctrl.signal });
    if (!res.ok) {
      const detalhe = (await res.text().catch(() => '')).slice(0, 200);
      return { ok: false, erro: `HTTP ${res.status} ${detalhe}`.trim() };
    }
    return { ok: true, dados: await res.json() };
  } catch (e) {
    return { ok: false, erro: `rede/timeout: ${e?.message || e}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Todos os grupos de que o número participa.
 *
 * `getParticipants=false` de propósito: a lista serve para ESCOLHER um grupo,
 * e trazer os participantes de dezenas de grupos seria pesado sem servir a
 * nada aqui.
 *
 * Timeout próprio e maior: é uma ação manual, de uma pessoa esperando na tela,
 * e a Evolution demora bem mais para montar esta lista do que para responder
 * sobre um grupo só. Os 5s do resto derrubariam a chamada sempre.
 */
export async function listarGrupos(env, fetchImpl = fetch) {
  const c = credenciais(env);
  if (!c) return { ok: false, erro: faltando(env) };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_LISTA_MS);
  try {
    const url = `${c.base}/group/fetchAllGroups/${encodeURIComponent(c.instancia)}?getParticipants=false`;
    const res = await fetchImpl(url, { headers: { apikey: c.apikey }, signal: ctrl.signal });
    if (!res.ok) {
      const detalhe = (await res.text().catch(() => '')).slice(0, 200);
      return { ok: false, erro: `A Evolution recusou listar os grupos (HTTP ${res.status}). ${detalhe}`.trim() };
    }
    const dados = await res.json();
    return { ok: true, grupos: Array.isArray(dados) ? dados : [] };
  } catch (e) {
    return { ok: false, erro: `Não foi possível listar os grupos: ${e?.message || e}` };
  } finally {
    clearTimeout(timer);
  }
}

function faltando(env) {
  const nomes = ['EVOLUTION_BASE_URL', 'EVOLUTION_INSTANCE', 'EVOLUTION_APIKEY_NOTIF']
    .filter((n) => !String(env?.[n] || '').trim());
  return `Configuração da Evolution incompleta: falta ${nomes.join(', ')}.`;
}

async function chamar(url, corpo, apikey, fetchImpl, oQue) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { apikey, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const detalhe = (await res.text().catch(() => '')).slice(0, 200);
      return { ok: false, erro: `A Evolution recusou ${oQue} (HTTP ${res.status}). ${detalhe}`.trim() };
    }
    return { ok: true };
  } catch (e) {
    // Timeout ou rede. Quem chama registra o motivo; o importante é não
    // confundir "não consegui falar com a Evolution" com "a ação falhou lá" —
    // são problemas diferentes e levam a decisões diferentes.
    return { ok: false, erro: `Não foi possível falar com a Evolution para ${oQue}: ${e?.message || e}` };
  } finally {
    clearTimeout(timer);
  }
}
