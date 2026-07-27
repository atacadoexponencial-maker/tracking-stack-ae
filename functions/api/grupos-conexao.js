// GET /api/grupos-conexao?key=...
//
// Estado da conexão do WhatsApp e tamanho ATUAL de cada grupo monitorado, para o
// topo da aba "Grupos". É o ÚNICO endpoint desta feature que fala com a
// Evolution, e de propósito fica separado do /api/grupos: assim uma Evolution
// lenta ou fora do ar deixa só estes números indefinidos, sem atrasar a aba.
//
// Por que o total de membros vem daqui, ao vivo, e não do D1: o D1 guarda FLUXO
// (quem entrou e saiu desde que a coleta começou), não ESTOQUE. O tamanho do
// grupo já existia antes da feature e continua mudando por caminhos que o
// webhook não cobre — só a Evolution sabe o número de agora.
//
// A apikey nunca chega ao navegador — as consultas acontecem aqui.
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
    return json({ estado: 'indefinido', state: null, instancia: instancia || null, motivo: 'config_faltando', grupos: [] });
  }

  // As duas consultas correm em paralelo: juntas continuam cabendo no mesmo
  // orçamento de 5s, e o card não fica esperando uma para começar a outra.
  const [conexao, grupos] = await Promise.all([
    consultarConexao(base, instancia, apikey),
    consultarGrupos(env, base, instancia, apikey),
  ]);

  return json({ ...conexao, instancia, grupos });
}

async function consultarConexao(base, instancia, apikey) {
  const dados = await buscar(`${base}/instance/connectionState/${encodeURIComponent(instancia)}`, apikey, 'conexão');
  if (dados.erro) return { estado: 'indefinido', state: null, motivo: dados.erro };
  const state = dados.json?.instance?.state || null;
  return { estado: ESTADOS[state] || 'indefinido', state };
}

// Tamanho e título atuais de cada grupo monitorado. A lista de quais grupos
// consultar vem do D1 (mesma allowlist que o /api/grupos usa), não de constante
// no código — trocar de grupo continua sendo um INSERT, sem deploy.
async function consultarGrupos(env, base, instancia, apikey) {
  let alvos = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT group_jid, label FROM whatsapp_groups_tracked WHERE enabled = 1 ORDER BY label`
    ).all();
    alvos = results || [];
  } catch (e) {
    console.error('grupos-conexao — falha ao ler a allowlist no D1:', e?.message || e);
    return [];
  }

  return Promise.all(alvos.map(async (g) => {
    const url = `${base}/group/findGroupInfos/${encodeURIComponent(instancia)}` +
      `?groupJid=${encodeURIComponent(g.group_jid)}`;
    const dados = await buscar(url, apikey, `grupo ${g.group_jid}`);
    if (dados.erro) {
      return { group_jid: g.group_jid, label: g.label, subject: null, size: null, motivo: dados.erro };
    }
    // `size` ausente vira null, não 0: "não sei" e "grupo vazio" são coisas
    // diferentes, e 0 na tela seria uma afirmação falsa.
    const size = Number.isFinite(Number(dados.json?.size)) ? Number(dados.json.size) : null;
    return { group_jid: g.group_jid, label: g.label, subject: dados.json?.subject || null, size };
  }));
}

// Chamada à Evolution com timeout próprio. Nunca lança: devolve `{ erro }` para
// o chamador decidir o que mostrar. Uma consulta que falha não pode derrubar as
// outras nem o endpoint.
async function buscar(url, apikey, oQue) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { apikey }, signal: ctrl.signal });
    if (!res.ok) return { erro: `http_${res.status}` };
    return { json: await res.json() };
  } catch (e) {
    // Timeout ou rede: quem chama diz "não foi possível consultar" em vez de
    // mentir "desconectado" ou "0 membros" — são coisas diferentes.
    console.error(`grupos-conexao — falha ao consultar ${oQue}:`, e?.message || e);
    return { erro: 'timeout_ou_erro' };
  } finally {
    clearTimeout(timer);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
