// Autenticação de GET /api/feedback-marketing (spec-feedback-marketing.md,
// módulo 2, "Autenticação").
//
// Chave PRÓPRIA (`FEEDBACK_MARKETING_KEY`), isolada da chave do dashboard:
//   - vai no cabeçalho `Authorization: Bearer <chave>`, nunca no endereço —
//     query string fica gravada em histórico de navegador e log de acesso;
//   - sem chave, chave errada e chave do dashboard recebem a MESMA resposta,
//     para não revelar se a chave existe ou está quase certa;
//   - variável ausente, vazia ou igual à DASH_KEY recusa tudo: a rota nunca
//     fica aberta por configuração faltando, e uma chave não abre a rota da
//     outra.
//
// Módulo PURO (sem env.DB, sem fetch) para rodar no `node --test`.

export const ERRO_CHAVE_NO_ENDERECO = 'Envie a chave como credencial da requisição, não no endereço.';
export const ERRO_ACESSO_NEGADO = 'Acesso negado.';

// Nomes com que uma chave costuma ir parar na query. `key` é o do dashboard.
const PARAMETROS_DE_CHAVE = ['key', 'chave', 'token', 'access_token', 'authorization'];

export function chaveNoEndereco(url) {
  const params = new URL(url).searchParams;
  return [...params.keys()].some((nome) => PARAMETROS_DE_CHAVE.includes(nome.toLowerCase()));
}

// Comparação em tempo constante. Mesmo cuidado de `tokenConfere` em
// webhooks/greenn.js — sem retorno antecipado nem na diferença de tamanho,
// que vazaria o comprimento do segredo —, mas em JS puro: o
// `crypto.subtle.timingSafeEqual` é extensão do Workers e não existe no Node
// dos testes.
export function compararEmTempoConstante(recebido, esperado) {
  const a = new TextEncoder().encode(String(recebido == null ? '' : recebido));
  const b = new TextEncoder().encode(String(esperado == null ? '' : esperado));
  const tamanho = Math.max(a.byteLength, b.byteLength);
  let diferenca = a.byteLength ^ b.byteLength;
  for (let i = 0; i < tamanho; i++) {
    diferenca |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diferenca === 0;
}

function lerBearer(authorization) {
  const m = /^\s*bearer\s+(\S+)\s*$/i.exec(authorization == null ? '' : String(authorization));
  return m ? m[1] : '';
}

// Devolve { ok: true } ou { ok: false, status, corpo } — o endpoint só
// transforma em resposta.
export function autorizarFeedbackMarketing({ url, authorization }, env = {}) {
  if (chaveNoEndereco(url)) {
    return { ok: false, status: 400, corpo: { error: ERRO_CHAVE_NO_ENDERECO } };
  }

  const negado = { ok: false, status: 401, corpo: { error: ERRO_ACESSO_NEGADO } };
  const esperada = env.FEEDBACK_MARKETING_KEY == null ? '' : String(env.FEEDBACK_MARKETING_KEY);
  if (!esperada.trim()) return negado;
  if (env.DASH_KEY && esperada === String(env.DASH_KEY)) return negado;

  const recebida = lerBearer(authorization);
  if (!recebida) return negado;

  return compararEmTempoConstante(recebida, esperada) ? { ok: true } : negado;
}
