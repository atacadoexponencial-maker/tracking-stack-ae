// Gravação em Planilha Google pela conta de serviço da casa ("vega").
// Usado pela aplicação do plano ao vivo (spec-aplicacao-plano-ao-vivo.md).
//
// A chave é a mesma do Google Agenda: secret GOOGLE_AGENDA_SA_JSON (o JSON
// inteiro, cru ou em base64). O login (JWT assinado com a chave) é o mesmo de
// functions/api/_google-agenda.js da branch agenda-propria. Quando as duas se
// encontrarem na main, dá para juntar num helper só.
//
// PEGADINHA (scripts/meta-leads-sync/sheets.py): a delegação no Workspace casa
// o escopo por string EXATA e só o `drive` completo está liberado. Os escopos
// `spreadsheets` e `spreadsheets.readonly` devolvem unauthorized_client.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

const ESCOPO = 'https://www.googleapis.com/auth/drive';
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

function erroGoogle(codigo, mensagem, status = 0) {
  const e = new Error(mensagem);
  e.codigo = codigo;
  e.status = status;
  return e;
}

function lerChave(env) {
  const bruto = (env.GOOGLE_AGENDA_SA_JSON || '').trim();
  if (!bruto) throw erroGoogle('sem_credencial', 'GOOGLE_AGENDA_SA_JSON não configurada');
  const texto = bruto.startsWith('{') ? bruto : atob(bruto);
  return JSON.parse(texto);
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

// Token por conta, guardado enquanto o isolate vive (1h, renova com 5 min de folga).
const tokens = new Map();

async function tokenDaConta(env, subject, fetchImpl) {
  const guardado = tokens.get(subject);
  const agora = Math.floor(Date.now() / 1000);
  if (guardado && guardado.expira - 300 > agora) return guardado.token;

  const chave = lerChave(env);
  const cabecalho = b64urlTexto(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = b64urlTexto(JSON.stringify({
    iss: chave.client_email,
    sub: subject,
    scope: ESCOPO,
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

async function chamar(env, subject, url, opcoes, fetchImpl) {
  const token = await tokenDaConta(env, subject, fetchImpl);
  const r = await fetchImpl(url, {
    ...opcoes,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw erroGoogle('api', dados?.error?.message || `HTTP ${r.status}`, r.status);
  return dados;
}

/**
 * Acrescenta `linha` no fim da aba. Se a primeira linha estiver vazia, grava
 * `cabecalho` nela antes. RAW: o Google guarda tudo como texto, então resposta
 * começando com "=" nunca vira fórmula.
 */
export async function acrescentarLinha(env, { subject, planilha, aba, cabecalho, linha }, fetchImpl = fetch) {
  const base = `${SHEETS}/${encodeURIComponent(planilha)}/values`;
  const faixa = (r) => encodeURIComponent(`'${aba}'!${r}`);

  const topo = await chamar(env, subject, `${base}/${faixa('1:1')}`, { method: 'GET' }, fetchImpl);
  if (!topo.values || !topo.values.length || !topo.values[0].length) {
    await chamar(env, subject, `${base}/${faixa('A1')}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({ values: [cabecalho] }),
    }, fetchImpl);
  }

  await chamar(env, subject, `${base}/${faixa('A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values: [linha] }),
  }, fetchImpl);
}
