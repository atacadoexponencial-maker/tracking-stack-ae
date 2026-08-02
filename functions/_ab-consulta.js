// Leitura dos testes A/B ativos, com cache curto em memória.
//
// Isto roda em TODA requisição de página HTML, então uma ida ao D1 por
// carregamento seria latência cobrada de cada visitante para consultar uma
// tabela de 1 a 3 linhas. O cache de 60s corta isso: na prática quase todo
// request responde da memória do isolate.
//
// O preço é que ligar ou pausar um teste pelo painel leva até 1 minuto para
// valer em todos os isolates. É um preço aceitável — e a aba avisa isso.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

const TTL_MS = 60_000;

let cache = { em: 0, testes: [] };

// Paths comparáveis: '/se-v1/' e '/se-v1' são a mesma página, e o path
// cadastrado no teste precisa casar com os dois. A raiz continua '/'.
export function normalizarPath(pathname) {
  const p = (pathname || '/').split('?')[0].split('#')[0];
  if (p.length > 1 && p.endsWith('/')) return p.slice(0, -1);
  return p || '/';
}

export function invalidarCacheAb() {
  cache = { em: 0, testes: [] };
}

export async function carregarTestesAtivos(env) {
  const agoraMs = Date.now();
  if (agoraMs - cache.em < TTL_MS) return cache.testes;

  // Falha também é resposta cacheável. Se a query quebrar (tabela ainda não
  // migrada em produção, D1 fora do ar), deixar a exceção subir sem gravar o
  // cache faz TODA requisição HTML do site repetir a query que falha. Guardar
  // o resultado vazio faz a falha custar uma query por minuto em vez de uma
  // por pageview. Para o chamador é o mesmo desfecho de antes — o middleware
  // trata lista vazia e exceção do mesmo jeito: serve a página original.
  let results;
  try {
    ({ results } = await env.DB.prepare(`
      SELECT t.id, t.slug, t.path, t.status, v.chave, v.page_path, v.peso
      FROM ab_tests t
      JOIN ab_variants v ON v.test_id = t.id
      WHERE t.status = 'ativo'
    `).all());
  } catch (e) {
    console.error('AB: falha ao consultar testes ativos, cacheando vazio por 60s:', e.message);
    cache = { em: agoraMs, testes: [] };
    return cache.testes;
  }

  const porId = new Map();
  for (const linha of results || []) {
    if (!porId.has(linha.id)) {
      porId.set(linha.id, {
        id: linha.id,
        slug: linha.slug,
        path: normalizarPath(linha.path),
        status: linha.status,
        variantes: [],
      });
    }
    porId.get(linha.id).variantes.push({
      chave: linha.chave,
      page_path: linha.page_path,
      peso: linha.peso,
    });
  }

  cache = { em: agoraMs, testes: [...porId.values()] };
  return cache.testes;
}
