// Uso da Cloudflare: requisições de Functions da conta × teto do plano Free
// (spec-uso-cloudflare.md, série S1; issue S1-02).
//
// Toda regra mora aqui: teto, faixas de cor e suas palavras, nome de cada
// projeto, o "dia" que o teto usa (00:00 UTC = 21h de Brasília), a tradução de
// falha em motivo e o cache. A aba (public/dash/cloudflare.js) só desenha.
//
// O teto de 100 mil/dia vale para a CONTA inteira (todos os projetos do Pages e
// qualquer Worker), por isso a soma junta os dois datasets do GraphQL.
//
// Cache de 15 minutos no `caches.default`: o Pages está no limite de CPU do
// plano Free desde 04/10, e a aba não pode consultar a Cloudflare a cada
// abertura. Falha nunca é guardada: a próxima abertura tenta de novo.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

import { FUSO_BRT } from './_data-brt.js';

export const TETO_DIARIO = 100000;
export const CACHE_SEGUNDOS = 15 * 60;
export const CONTA_CLOUDFLARE = '1f66a02c2442fa044eea07c5c1ec5ea2';
const GRAPHQL = 'https://api.cloudflare.com/client/v4/graphql';

// A credencial de Analytics não lê a lista de projetos do Pages, então o nome
// vem desta tabela (SUP-S1-07). Projeto novo aparece com o nome técnico até
// entrar aqui. Ids conferidos em 15/10 (production_script_name de cada projeto).
const PROJETOS = {
  14963629: 'tracking-ae',
  16433236: 'painel-atacadoexponencial',
};

export const MOTIVOS = {
  semCredencial: 'credencial da Cloudflare não configurada',
  recusada: 'credencial recusada pela Cloudflare',
  foraDoAr: 'a Cloudflare não respondeu',
};

// Verde abaixo de 60%, amarelo de 60% a 80% (inclusive), vermelho acima de 80%.
export function faixaDoUso(requisicoes, teto = TETO_DIARIO) {
  if (requisicoes < teto * 0.6) return { faixa: 'folga', palavra: 'folga' };
  if (requisicoes <= teto * 0.8) return { faixa: 'atencao', palavra: 'atenção' };
  return { faixa: 'perto', palavra: 'perto do teto' };
}

export function nomeDoProjeto(scriptName) {
  const m = /^pages-worker--(\d+)-(production|preview)$/.exec(String(scriptName || ''));
  if (!m) return String(scriptName || 'sem nome');
  const nome = PROJETOS[m[1]];
  if (!nome) return scriptName;
  return m[2] === 'preview' ? `${nome} (prévia)` : nome;
}

export function inicioDoDiaUtc(agoraMs) {
  const d = new Date(agoraMs);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function horaBrasilia(agoraMs) {
  return new Date(agoraMs).toLocaleTimeString('pt-BR', { timeZone: FUSO_BRT, hour: '2-digit', minute: '2-digit' });
}

function consultaHoje(agoraMs) {
  const de = inicioDoDiaUtc(agoraMs).toISOString();
  const ate = new Date(agoraMs).toISOString();
  const filtro = `{ datetime_geq: "${de}", datetime_lt: "${ate}" }`;
  return `{ viewer { accounts(filter: { accountTag: "${CONTA_CLOUDFLARE}" }) {
    pages: pagesFunctionsInvocationsAdaptiveGroups(limit: 1000, filter: ${filtro}) { sum { requests } dimensions { scriptName } }
    workers: workersInvocationsAdaptive(limit: 1000, filter: ${filtro}) { sum { requests } dimensions { scriptName } }
  } } }`;
}

// Soma por projeto (várias linhas do mesmo projeto, uma por status, viram uma),
// do maior para o menor, e monta o bloco de hoje.
export function montarHoje(linhas, agoraMs) {
  const porProjeto = new Map();
  for (const l of linhas) {
    const nome = nomeDoProjeto(l?.dimensions?.scriptName);
    porProjeto.set(nome, (porProjeto.get(nome) || 0) + Number(l?.sum?.requests || 0));
  }
  const projetos = [...porProjeto].map(([nome, requisicoes]) => ({ nome, requisicoes }))
    .filter((p) => p.requisicoes > 0)
    .sort((a, b) => b.requisicoes - a.requisicoes || a.nome.localeCompare(b.nome));
  const total = projetos.reduce((s, p) => s + p.requisicoes, 0);
  return {
    teto: TETO_DIARIO,
    hoje: {
      requisicoes: total,
      porcentagem: (total / TETO_DIARIO) * 100,
      restam: Math.max(0, TETO_DIARIO - total),
      ...faixaDoUso(total),
      zera_as: '21h de Brasília',
    },
    projetos,
    lido_as: horaBrasilia(agoraMs),
    lido_em: agoraMs,
  };
}

const ehErroDeAutenticacao = (erros) => erros.some((e) => /auth|token|permission|not authorized/i.test(String(e?.message || '')));

// Lê a Cloudflare. Devolve o bloco de hoje ou { indisponivel, motivo }.
export async function consultarCloudflare({ token, fetchFn = fetch, agoraMs }) {
  if (!token) return { indisponivel: true, motivo: MOTIVOS.semCredencial };
  let resp, corpo;
  try {
    resp = await fetchFn(GRAPHQL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: consultaHoje(agoraMs) }),
    });
  } catch {
    return { indisponivel: true, motivo: MOTIVOS.foraDoAr };
  }
  if (resp.status === 401 || resp.status === 403) return { indisponivel: true, motivo: MOTIVOS.recusada };
  try { corpo = await resp.json(); } catch { corpo = null; }
  // Token inválido volta como HTTP 400 com "Authentication failed" no corpo
  // (conferido em 15/10), então o corpo é lido antes de olhar o status.
  const erros = Array.isArray(corpo?.errors) ? corpo.errors : [];
  if (erros.length && ehErroDeAutenticacao(erros)) return { indisponivel: true, motivo: MOTIVOS.recusada };
  if (!resp.ok || !corpo || erros.length) return { indisponivel: true, motivo: MOTIVOS.foraDoAr };
  const conta = corpo?.data?.viewer?.accounts?.[0];
  if (!conta) return { indisponivel: true, motivo: MOTIVOS.recusada };
  return montarHoje([...(conta.pages || []), ...(conta.workers || [])], agoraMs);
}

// Cache no `caches.default`. Só existe no runtime da Cloudflare; no node vira
// um cache que não guarda nada, sem lançar.
const CHAVE_CACHE = 'https://cache.interno/api/cloudflare-uso/v1';
export function cachePadrao() {
  let c = null;
  try { c = typeof caches !== 'undefined' && caches?.default ? caches.default : null; } catch { c = null; }
  return {
    async ler() {
      if (!c) return null;
      const r = await c.match(CHAVE_CACHE);
      return r ? r.json() : null;
    },
    async gravar(dados) {
      if (!c) return;
      await c.put(CHAVE_CACHE, new Response(JSON.stringify(dados), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_SEGUNDOS}` },
      }));
    },
  };
}

// Leitura com cache de 15 minutos. Falha não é guardada.
export async function lerUso({ env, fetchFn = fetch, cache = cachePadrao(), agoraMs = Date.now() }) {
  const guardado = await cache.ler().catch(() => null);
  if (guardado && !guardado.indisponivel && agoraMs - Number(guardado.lido_em) < CACHE_SEGUNDOS * 1000) return guardado;
  const novo = await consultarCloudflare({ token: env?.CF_ANALYTICS_TOKEN, fetchFn, agoraMs });
  if (!novo.indisponivel) await cache.gravar(novo).catch(() => {});
  return novo;
}
