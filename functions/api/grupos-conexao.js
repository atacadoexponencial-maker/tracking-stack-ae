// GET /api/grupos-conexao?key=...
//
// Estado da conexão do WhatsApp, para o card no topo da aba "Grupos". É o ÚNICO
// endpoint desta feature que fala com a Evolution, e de propósito fica separado
// do /api/grupos: assim uma Evolution lenta ou fora do ar deixa só este card
// indefinido, sem atrasar a aba inteira.
//
// A apikey nunca chega ao navegador — a consulta acontece aqui.
//
// Reusa EVOLUTION_APIKEY_NOTIF (mesma instância dos alertas; não faz sentido
// cadastrar a chave duas vezes). EVOLUTION_BASE_URL e EVOLUTION_INSTANCE são
// variáveis próprias porque o EVOLUTION_API_URL existente é a URL completa de
// ENVIO de mensagem, não uma base.

const TIMEOUT_MS = 5000;

const ESTADOS = {
  open: 'conectado',
  connecting: 'reconectando',
  close: 'desconectado',
};

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const base = String(env.EVOLUTION_BASE_URL || '').trim().replace(/\/+$/, '');
  const instancia = String(env.EVOLUTION_INSTANCE || '').trim();
  const apikey = env.EVOLUTION_APIKEY_NOTIF;

  if (!base || !instancia || !apikey) {
    const faltando = [
      !base && 'EVOLUTION_BASE_URL',
      !instancia && 'EVOLUTION_INSTANCE',
      !apikey && 'EVOLUTION_APIKEY_NOTIF',
    ].filter(Boolean).join(', ');
    console.error('grupos-conexao — config faltando:', faltando);
    return json({ estado: 'indefinido', state: null, instancia: instancia || null, motivo: 'config_faltando' });
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${base}/instance/connectionState/${encodeURIComponent(instancia)}`,
      { headers: { apikey }, signal: ctrl.signal }
    );
    if (!res.ok) {
      return json({ estado: 'indefinido', state: null, instancia, motivo: `http_${res.status}` });
    }
    const dados = await res.json();
    const state = dados?.instance?.state || null;
    return json({ estado: ESTADOS[state] || 'indefinido', state, instancia });
  } catch (e) {
    // Timeout ou rede: o card diz "não foi possível consultar" em vez de mentir
    // "desconectado" — são coisas diferentes.
    console.error('grupos-conexao — falha ao consultar a Evolution:', e?.message || e);
    return json({ estado: 'indefinido', state: null, instancia, motivo: 'timeout_ou_erro' });
  } finally {
    clearTimeout(timer);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
