// Cache de leitura para os endpoints do dashboard com período (revisão de
// 13/09/2026, economia do D1).
//
// O dashboard consulta SEMPRE dois períodos (o atual e o anterior, para o
// delta) e a pessoa troca de aba e de filtro várias vezes na mesma sessão.
// Cada troca refazia todas as consultas — e foi assim que a cota de leitura
// do D1 estourou duas vezes em uma semana (01/09 e 04/09). Um período que
// já FECHOU (terminou antes da meia-noite de hoje em Brasília) não muda mais:
// os leads de ontem não vão aumentar. Reconsultar o banco por ele é
// desperdício puro.
//
// Duas camadas, ambas por URL completa (que já carrega período, filtro e
// chave do dash):
//   1. `Cache-Control: private, max-age=3600` para o navegador;
//   2. `caches.default` do Cloudflare, para outra aba/outro navegador/outro
//      dia não bater no D1 pelo mesmo período.
//
// Só entra no cache o que é 200 e de período fechado. O período corrente
// (`until` >= meia-noite de hoje) nunca é guardado: é o que está mudando.
//
// Detalhe que morde: a Cache API do Cloudflare RESPEITA o Cache-Control da
// resposta guardada e NÃO armazena `private`. Por isso a cópia que vai para o
// `caches.default` sai como `public` e a que vai para o navegador sai como
// `private` — são dois objetos Response, montados do mesmo corpo. Isso não
// expõe nada: o Cache API só é lido de dentro da Function, DEPOIS da
// validação da DASH_KEY, e a URL guardada contém a própria chave.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

import { meiaNoiteHojeBrt } from './_data-brt.js';

export const MAX_AGE_SEGUNDOS = 3600;

const CABECALHOS_JSON = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

/**
 * Um período está fechado quando termina ANTES da meia-noite de hoje em
 * Brasília. `agoraUnix` é injetável só para os testes.
 */
export function periodoFechado(until, agoraUnix) {
  const fim = Number(until);
  if (!Number.isFinite(fim) || fim <= 0) return false;
  return fim < meiaNoiteHojeBrt(agoraUnix);
}

// `caches` só existe no runtime do Cloudflare. Em `node --test` (e em qualquer
// outro ambiente) o helper vira transparente: responde sem cache, sem lançar.
function cachePadrao() {
  try {
    return typeof caches !== 'undefined' && caches && caches.default ? caches.default : null;
  } catch {
    return null;
  }
}

/**
 * Tenta responder do cache ANTES de tocar no D1. Devolve a Response pronta ou
 * null. Só consulta quando o período está fechado — para o período corrente
 * nem vale a viagem ao cache.
 */
export async function respostaEmCache(request, { until } = {}) {
  if (!request || request.method !== 'GET') return null;
  if (!periodoFechado(until)) return null;
  const cache = cachePadrao();
  if (!cache) return null;
  try {
    const guardada = await cache.match(request);
    if (!guardada) return null;
    // A cópia guardada é `public` (ver cabeçalho do módulo); para o navegador
    // ela volta como `private`, igual à resposta original.
    const cabecalhos = new Headers(guardada.headers);
    cabecalhos.set('Cache-Control', `private, max-age=${MAX_AGE_SEGUNDOS}`);
    cabecalhos.set('X-Cache', 'HIT');
    return new Response(guardada.body, { status: guardada.status, headers: cabecalhos });
  } catch {
    // Falha de cache nunca pode derrubar o dashboard: segue para o D1.
    return null;
  }
}

/**
 * Monta a resposta JSON e, se o período estiver fechado e a resposta for 200,
 * guarda uma cópia no `caches.default`. `context` (o `context` da Function)
 * é opcional: com ele o `put` roda em `waitUntil`, sem segurar a resposta.
 *
 * Erros (status != 200) nunca são guardados — um 500 do D1 cacheado por uma
 * hora seria um bug com data de validade.
 */
export function respostaJson(request, dados, { until, status = 200, context } = {}) {
  const corpo = JSON.stringify(dados);
  const cacheavel =
    status === 200 && request && request.method === 'GET' && periodoFechado(until);

  if (!cacheavel) {
    return new Response(corpo, { status, headers: CABECALHOS_JSON });
  }

  const cache = cachePadrao();
  if (cache) {
    const copiaCache = new Response(corpo, {
      status,
      headers: { ...CABECALHOS_JSON, 'Cache-Control': `public, max-age=${MAX_AGE_SEGUNDOS}` },
    });
    let gravacao;
    try {
      gravacao = Promise.resolve(cache.put(request, copiaCache)).catch(() => {});
    } catch {
      gravacao = null;
    }
    if (gravacao && context && typeof context.waitUntil === 'function') {
      context.waitUntil(gravacao);
    }
  }

  return new Response(corpo, {
    status,
    headers: {
      ...CABECALHOS_JSON,
      'Cache-Control': `private, max-age=${MAX_AGE_SEGUNDOS}`,
      'X-Cache': 'MISS',
    },
  });
}
