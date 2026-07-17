// Sessão do admin: cookie HMAC assinado com chave derivada de ADMIN_PASSWORD.
// Sem tabela de usuários — a agência tem uma senha única (env), como decidido
// na spec (issue 101).
const enc = new TextEncoder();

async function chave(env) {
  return crypto.subtle.importKey(
    'raw', enc.encode('painel-admin-v1:' + env.ADMIN_PASSWORD),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
}

export async function criarToken(env, dias = 7) {
  const exp = Date.now() + dias * 864e5;
  const sig = await crypto.subtle.sign('HMAC', await chave(env), enc.encode(String(exp)));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${exp}.${hex}`;
}

export async function sessaoValida(request, env) {
  if (!env.ADMIN_PASSWORD) return false;
  const m = (request.headers.get('Cookie') || '').match(/painel_admin=(\d+\.[0-9a-f]+)/);
  if (!m) return false;
  const [exp, hex] = m[1].split('.');
  if (!exp || !hex || Number(exp) < Date.now()) return false;
  const sig = new Uint8Array((hex.match(/../g) || []).map((h) => parseInt(h, 16)));
  try {
    return await crypto.subtle.verify('HMAC', await chave(env), sig, enc.encode(exp));
  } catch { return false; }
}

// Comparação de senha sem short-circuit: compara HMACs das duas strings.
export async function senhaConfere(env, senha) {
  if (!env.ADMIN_PASSWORD || typeof senha !== 'string') return false;
  const k = await crypto.subtle.importKey('raw', enc.encode('cmp'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const a = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(senha)));
  const b = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(env.ADMIN_PASSWORD)));
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}
