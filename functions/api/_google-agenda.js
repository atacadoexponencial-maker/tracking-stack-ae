// Google Agenda + Meet pela conta de serviço da casa (spec-agenda-propria.md).
//
// A sonda de 01/10/2026 provou que a conta de serviço "vega" (delegação no
// Workspace) entra como felipe@seteads.com: lista agendas, lê horários
// ocupados, cria evento com Meet e lê quem entrou na sala. A chave fica no
// secret GOOGLE_AGENDA_SA_JSON (o JSON inteiro da chave, cru ou em base64).
//
// PEGADINHA da sonda: o escopo tem que ser o `calendar` COMPLETO.
// `calendar.events` ou `calendar.readonly` sozinhos devolvem
// unauthorized_client, porque a delegação no Workspace foi liberada só para o
// escopo inteiro. O Meet entra com `meetings.space.readonly` (testado 02/10).
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

const ESCOPOS = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/meetings.space.readonly',
].join(' ');

const CAL = 'https://www.googleapis.com/calendar/v3';
const MEET = 'https://meet.googleapis.com/v2';

// Domínio aceito nesta versão: só contas do Workspace (spec, módulo 1).
export const DOMINIO_WORKSPACE = 'seteads.com';

export function contaDoWorkspace(email) {
  const e = String(email || '').trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+$/.test(e) && e.endsWith('@' + DOMINIO_WORKSPACE);
}

function lerChave(env) {
  const bruto = (env.GOOGLE_AGENDA_SA_JSON || '').trim();
  if (!bruto) throw erroGoogle('sem_credencial', 'GOOGLE_AGENDA_SA_JSON não configurada');
  const texto = bruto.startsWith('{') ? bruto : atob(bruto);
  return JSON.parse(texto);
}

function erroGoogle(codigo, mensagem, status = 0) {
  const e = new Error(mensagem);
  e.codigo = codigo;
  e.status = status;
  return e;
}

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlTexto = (s) => b64url(new TextEncoder().encode(s));

function pemParaDer(pem) {
  const corpo = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(corpo);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

// Token por conta (subject), guardado enquanto o isolate vive. O Google dá 1h;
// renovamos com 5 min de folga.
const tokens = new Map();

export async function tokenDaConta(env, subject, fetchImpl = fetch) {
  const guardado = tokens.get(subject);
  const agora = Math.floor(Date.now() / 1000);
  if (guardado && guardado.expira - 300 > agora) return guardado.token;

  const chave = lerChave(env);
  const cabecalho = b64urlTexto(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = b64urlTexto(JSON.stringify({
    iss: chave.client_email,
    sub: subject,
    scope: ESCOPOS,
    aud: 'https://oauth2.googleapis.com/token',
    iat: agora,
    exp: agora + 3600,
  }));
  const privada = await crypto.subtle.importKey(
    'pkcs8', pemParaDer(chave.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  );
  const assinatura = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privada, new TextEncoder().encode(`${cabecalho}.${corpo}`));
  const jwt = `${cabecalho}.${corpo}.${b64url(assinatura)}`;

  const r = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok || !dados.access_token) {
    throw erroGoogle('login', `Google recusou o acesso à conta ${subject}: ${dados.error || r.status}`, r.status);
  }
  tokens.set(subject, { token: dados.access_token, expira: agora + (dados.expires_in || 3600) });
  return dados.access_token;
}

async function chamar(env, subject, url, opcoes = {}, fetchImpl = fetch) {
  const token = await tokenDaConta(env, subject, fetchImpl);
  const r = await fetchImpl(url, {
    ...opcoes,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opcoes.headers || {}) },
  });
  if (r.status === 204) return {};
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = dados?.error?.message || `HTTP ${r.status}`;
    throw erroGoogle(r.status === 404 || r.status === 410 ? 'nao_existe' : 'api', msg, r.status);
  }
  return dados;
}

/** Agendas que a conta enxerga: [{ id, nome }]. */
export async function listarAgendas(env, subject, fetchImpl = fetch) {
  const itens = [];
  let pagina = '';
  do {
    const d = await chamar(env, subject, `${CAL}/users/me/calendarList?maxResults=250${pagina ? '&pageToken=' + encodeURIComponent(pagina) : ''}`, {}, fetchImpl);
    for (const c of d.items || []) itens.push({ id: c.id, nome: c.summaryOverride || c.summary || c.id });
    pagina = d.nextPageToken || '';
  } while (pagina);
  return itens;
}

/**
 * Horários ocupados das agendas, entre de/ate (unix). Devolve
 * { ocupados: [{ini, fim}], erros: {calId: motivo} }.
 * Agenda com erro NÃO some em silêncio: quem chama decide (a página pública
 * não oferece horário quando uma agenda de conflito não pôde ser lida).
 */
export async function horariosOcupados(env, subject, calIds, de, ate, fetchImpl = fetch) {
  if (!calIds.length) return { ocupados: [], erros: {} };
  const d = await chamar(env, subject, `${CAL}/freeBusy`, {
    method: 'POST',
    body: JSON.stringify({
      timeMin: new Date(de * 1000).toISOString(),
      timeMax: new Date(ate * 1000).toISOString(),
      items: calIds.map((id) => ({ id })),
    }),
  }, fetchImpl);
  const ocupados = [];
  const erros = {};
  for (const id of calIds) {
    const c = (d.calendars || {})[id] || {};
    if (c.errors && c.errors.length) { erros[id] = c.errors.map((e) => e.reason).join(', '); continue; }
    for (const b of c.busy || []) {
      ocupados.push({ ini: Math.floor(Date.parse(b.start) / 1000), fim: Math.floor(Date.parse(b.end) / 1000) });
    }
  }
  return { ocupados, erros };
}

/** Cria o evento com Meet e o lead como convidado. Devolve { id, meet, link }. */
export async function criarEvento(env, subject, calId, { titulo, descricao, ini, fim, convidado }, fetchImpl = fetch) {
  const corpo = {
    summary: titulo,
    description: descricao || '',
    start: { dateTime: new Date(ini * 1000).toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: new Date(fim * 1000).toISOString(), timeZone: 'America/Sao_Paulo' },
    attendees: convidado ? [{ email: convidado.email, displayName: convidado.nome }] : [],
    conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
    reminders: { useDefault: true },
  };
  const d = await chamar(env, subject,
    `${CAL}/calendars/${encodeURIComponent(calId)}/events?conferenceDataVersion=1&sendUpdates=all`,
    { method: 'POST', body: JSON.stringify(corpo) }, fetchImpl);
  return { id: d.id, meet: meetDoEvento(d), link: d.htmlLink || '' };
}

/** Muda o horário (o Meet continua o mesmo) e avisa o convidado pelo Google. */
export async function moverEvento(env, subject, calId, eventId, ini, fim, fetchImpl = fetch) {
  return chamar(env, subject,
    `${CAL}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all&conferenceDataVersion=1`,
    { method: 'PATCH', body: JSON.stringify({
      start: { dateTime: new Date(ini * 1000).toISOString(), timeZone: 'America/Sao_Paulo' },
      end: { dateTime: new Date(fim * 1000).toISOString(), timeZone: 'America/Sao_Paulo' },
    }) }, fetchImpl);
}

/** Cancela o evento na agenda e avisa o convidado pelo Google. */
export async function cancelarEvento(env, subject, calId, eventId, fetchImpl = fetch) {
  try {
    await chamar(env, subject,
      `${CAL}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
      { method: 'DELETE' }, fetchImpl);
  } catch (e) {
    // Já apagado no Google (alguém tirou à mão): o resultado é o mesmo.
    if (e.codigo !== 'nao_existe') throw e;
  }
}

/** Lê o evento: { situacao: 'ativo'|'cancelado'|'nao_existe', ini, fim }. */
export async function lerEvento(env, subject, calId, eventId, fetchImpl = fetch) {
  try {
    const d = await chamar(env, subject,
      `${CAL}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`, {}, fetchImpl);
    if (d.status === 'cancelled') return { situacao: 'cancelado' };
    return {
      situacao: 'ativo',
      ini: Math.floor(Date.parse(d.start?.dateTime || d.start?.date) / 1000),
      fim: Math.floor(Date.parse(d.end?.dateTime || d.end?.date) / 1000),
    };
  } catch (e) {
    if (e.codigo === 'nao_existe') return { situacao: 'nao_existe' };
    throw e;
  }
}

/** Atualiza o texto da descrição do evento (link de remarcar/cancelar). */
export async function descreverEvento(env, subject, calId, eventId, descricao, fetchImpl = fetch) {
  return chamar(env, subject,
    `${CAL}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
    { method: 'PATCH', body: JSON.stringify({ description: descricao }) }, fetchImpl);
}

export function meetDoEvento(evento) {
  if (evento?.hangoutLink) return evento.hangoutLink;
  const ep = (evento?.conferenceData?.entryPoints || []).find((e) => e.entryPointType === 'video');
  return ep ? ep.uri : '';
}

/** 'abc-defg-hij' a partir de https://meet.google.com/abc-defg-hij */
export function codigoDoMeet(link) {
  const m = /meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})/.exec(link || '');
  return m ? m[1] : '';
}

/**
 * Participantes de todas as sessões da sala: [{ usuario, nome }].
 * `usuario` é o "users/<id>" de quem entrou logado; anônimo vem vazio.
 * null = o Google não guardou nenhuma sessão para a sala.
 */
export async function participantesDoMeet(env, subject, codigo, fetchImpl = fetch) {
  const filtro = encodeURIComponent(`space.meeting_code = "${codigo}"`);
  const recs = await chamar(env, subject, `${MEET}/conferenceRecords?filter=${filtro}`, {}, fetchImpl);
  const lista = recs.conferenceRecords || [];
  if (!lista.length) return null;
  const pessoas = [];
  for (const rec of lista) {
    let pagina = '';
    do {
      const d = await chamar(env, subject,
        `${MEET}/${rec.name}/participants?pageSize=100${pagina ? '&pageToken=' + encodeURIComponent(pagina) : ''}`, {}, fetchImpl);
      for (const p of d.participants || []) {
        pessoas.push({
          usuario: p.signedinUser?.user || '',
          nome: p.signedinUser?.displayName || p.anonymousUser?.displayName || p.phoneUser?.displayName || '',
        });
      }
      pagina = d.nextPageToken || '';
    } while (pagina);
  }
  return pessoas;
}
