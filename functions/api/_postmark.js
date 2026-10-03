// Cliente do Postmark (spec-email-proprio.md; issue 377).
//
// - Server token (POSTMARK_SERVER_TOKEN): envio, /server e /webhooks.
// - Account token (POSTMARK_ACCOUNT_TOKEN): só /domains (exigência do Postmark).
//
// Tempo limite de 8 s em toda chamada. NUNCA loga token, corpo do e-mail nem a
// resposta crua: o que sai daqui é status, código e mensagem traduzida.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

const BASE = 'https://api.postmarkapp.com';
const TIMEOUT_MS = 8000;

/** Canal do dash → MessageStream do Postmark. */
export const STREAMS = { transacional: 'outbound', marketing: 'broadcast' };

/** Falha de rede, tempo esgotado ou 5xx: o serviço não respondeu de verdade. */
export class SemResposta extends Error {
  constructor() { super('Não foi possível falar com o serviço de envio agora. Tente de novo.'); this.semResposta = true; }
}

// ErrorCode do Postmark → frase para a equipe. Lista dos códigos mais comuns
// (https://postmarkapp.com/developer/api/overview#error-codes).
const ERROS = {
  10: 'O serviço de envio recusou a chave de acesso. Confira a chave em Saúde das integrações.',
  300: 'Endereço de e-mail inválido.',
  400: 'O remetente não está confirmado no serviço de envio.',
  401: 'O remetente não está confirmado no serviço de envio.',
  402: 'Corpo do pedido inválido.',
  405: 'A conta do serviço de envio está sem créditos.',
  406: 'Endereço inativo: ele voltou antes, marcou como spam ou se descadastrou. O serviço bloqueou o envio.',
  409: 'Pedido sem formato esperado pelo serviço de envio.',
  411: 'Remetente de envio sem domínio verificado.',
  412: 'A conta ainda está em período de teste e só envia para o próprio domínio.',
  413: 'Mensagem grande demais.',
  429: 'Muitos envios em pouco tempo. Tente de novo em instantes.',
  1235: 'O canal de envio (stream) não existe no serviço.',
};

export function traduzirErro(codigo, status) {
  if (ERROS[codigo]) return ERROS[codigo];
  if (status === 401) return ERROS[10];
  return `O serviço de envio recusou o pedido (código ${codigo ?? status}).`;
}

async function chamar(caminho, { token, conta = false, metodo = 'GET', corpo } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let r;
  try {
    r = await fetch(BASE + caminho, {
      method: metodo,
      headers: {
        Accept: 'application/json',
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
        [conta ? 'X-Postmark-Account-Token' : 'X-Postmark-Server-Token']: String(token).trim(),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: ctl.signal,
    });
  } catch {
    throw new SemResposta();
  } finally {
    clearTimeout(t);
  }
  if (r.status >= 500) throw new SemResposta();
  const dados = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, dados };
}

const erroDe = (res) => ({ ok: false, codigo: res.dados?.ErrorCode ?? null, status: res.status, erro: traduzirErro(res.dados?.ErrorCode, res.status) });

/**
 * Envia um e-mail. Devolve { ok: true, messageId } ou { ok: false, codigo, erro }.
 * Lança SemResposta quando o serviço não respondeu (nada foi confirmado).
 */
export async function enviar(env, { canal, de, para, assunto, html, texto, resposta, tag, metadata }) {
  if (!env.POSTMARK_SERVER_TOKEN) return { ok: false, codigo: 10, erro: ERROS[10] };
  const corpo = {
    From: de, To: para, Subject: assunto, HtmlBody: html, TextBody: texto,
    MessageStream: STREAMS[canal], TrackOpens: true, TrackLinks: 'HtmlAndText',
  };
  if (resposta) corpo.ReplyTo = resposta;
  if (tag) corpo.Tag = tag;
  if (metadata) corpo.Metadata = metadata;
  const res = await chamar('/email', { token: env.POSTMARK_SERVER_TOKEN, metodo: 'POST', corpo });
  if (res.ok && res.dados?.ErrorCode === 0 && res.dados?.MessageID) return { ok: true, messageId: res.dados.MessageID };
  return erroDe(res);
}

/** Situação da chave do servidor: 'aceita' | 'recusada' | 'sem_resposta' | 'ausente'. */
export async function consultarServidor(env) {
  if (!env.POSTMARK_SERVER_TOKEN) return 'ausente';
  try {
    const res = await chamar('/server', { token: env.POSTMARK_SERVER_TOKEN });
    if (res.ok) return 'aceita';
    return res.status === 429 ? 'sem_resposta' : 'recusada';
  } catch {
    return 'sem_resposta';
  }
}

/**
 * Domínios da conta. null quando falta a chave da conta.
 * Devolve { ok, dominios: [{ nome, dkim, retorno }] } ou { ok: false, motivo }.
 */
export async function listarDominios(env) {
  if (!env.POSTMARK_ACCOUNT_TOKEN) return null;
  try {
    const res = await chamar('/domains?count=100&offset=0', { token: env.POSTMARK_ACCOUNT_TOKEN, conta: true });
    if (!res.ok) return { ok: false, motivo: 'recusada' };
    return {
      ok: true,
      dominios: (res.dados?.Domains || []).map((d) => ({
        nome: String(d.Name || '').toLowerCase(),
        dkim: !!d.DKIMVerified,
        retorno: !!d.ReturnPathDomainVerified,
      })),
    };
  } catch {
    return { ok: false, motivo: 'sem_resposta' };
  }
}

/** Webhooks de um stream. Devolve { ok, webhooks } ou { ok: false, erro }. */
export async function listarWebhooks(env, stream) {
  const res = await chamar(`/webhooks?MessageStream=${encodeURIComponent(stream)}`, { token: env.POSTMARK_SERVER_TOKEN });
  if (!res.ok) return erroDe(res);
  return { ok: true, webhooks: res.dados?.Webhooks || [] };
}

export async function criarWebhook(env, dados) {
  const res = await chamar('/webhooks', { token: env.POSTMARK_SERVER_TOKEN, metodo: 'POST', corpo: dados });
  return res.ok ? { ok: true, webhook: res.dados } : erroDe(res);
}

export async function editarWebhook(env, id, dados) {
  const res = await chamar(`/webhooks/${encodeURIComponent(id)}`, { token: env.POSTMARK_SERVER_TOKEN, metodo: 'PUT', corpo: dados });
  return res.ok ? { ok: true, webhook: res.dados } : erroDe(res);
}
