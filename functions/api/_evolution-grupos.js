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
