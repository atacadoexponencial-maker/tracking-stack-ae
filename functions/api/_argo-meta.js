// Leitura da Graph API do Meta para o relatório semanal e o registro de testes
// do Argo (issues 403, 404 e 405).
//
// O tracking sincroniza o Meta só em `level=campaign` (sync/meta-ads.js). O
// registro de testes e o relatório precisam de anúncio e conjunto, então este
// módulo lê direto da Graph API com o mesmo token de anúncios do sync
// (`ARGO_META_TOKEN`, o token do Argo; cai no de anúncios do sync). Só leitura.
//
// `fetchImpl` é injetável para os testes. Erro do Meta vira `{ ok:false,
// aviso }`, nunca exceção nem lista vazia com cara de resposta boa: "nenhum
// anúncio" e "não consegui ler" são coisas diferentes para quem decide.

const VERSAO = 'v22.0';
// Mesma conta do `argo_anuncios.py` (CONTA_META); variável sobrepõe.
const CONTA_PADRAO = '4577256079174658';
const MAX_PAGINAS = 20;

export const contaMeta = (env) => String((env && env.META_ADS_ACCOUNT_ID) || CONTA_PADRAO).replace(/^act_/, '');
// O token do Argo (o mesmo que pausa anúncios na VPS) vem primeiro: o de anúncios
// do sync ficou sem uso desde que o sync passou pelo Windsor.
const tokenMeta = (env) => (env && (env.ARGO_META_TOKEN || env.META_ADS_ACCESS_TOKEN || env.META_ACCESS_TOKEN)) || '';

async function lerPaginas(url, fetchImpl) {
  const linhas = [];
  let proxima = url;
  for (let i = 0; proxima && i < MAX_PAGINAS; i += 1) {
    const r = await fetchImpl(proxima);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) {
      // A mensagem do Meta pode repetir a URL com o token: não repassar.
      throw new Error(`Meta respondeu ${r.status}`);
    }
    linhas.push(...(j.data || []));
    proxima = j.paging && j.paging.next ? j.paging.next : null;
  }
  return linhas;
}

/**
 * Anúncios ativos e pausados da conta, com conjunto e campanha. Os pausados
 * entram porque um teste antigo aponta para anúncios que já saíram do ar.
 */
export async function listarAnuncios(env, fetchImpl = fetch) {
  const token = tokenMeta(env);
  if (!token) return { ok: false, aviso: 'O token de anúncios do Meta não está configurado.' };
  const status = encodeURIComponent(JSON.stringify(['ACTIVE', 'PAUSED', 'ADSET_PAUSED', 'CAMPAIGN_PAUSED']));
  const url = `https://graph.facebook.com/${VERSAO}/act_${contaMeta(env)}/ads`
    + `?fields=id,name,effective_status,created_time,adset{id,name},campaign{id,name}`
    + `&effective_status=${status}&limit=500&access_token=${encodeURIComponent(token)}`;
  try {
    const linhas = await lerPaginas(url, fetchImpl);
    return { ok: true, anuncios: linhas.map(normalizarAnuncio) };
  } catch {
    return { ok: false, aviso: 'Não foi possível ler os anúncios do Meta agora.' };
  }
}

export function normalizarAnuncio(a) {
  return {
    id: String(a.id),
    nome: String(a.name || ''),
    ativo: a.effective_status === 'ACTIVE',
    criado_em: a.created_time ? String(a.created_time).slice(0, 10) : null,
    conjunto_id: a.adset ? String(a.adset.id) : null,
    conjunto_nome: a.adset ? String(a.adset.name || '') : '',
    campanha_id: a.campaign ? String(a.campaign.id) : null,
    campanha_nome: a.campaign ? String(a.campaign.name || '') : '',
  };
}

/** Conjuntos distintos a partir da lista de anúncios, os com anúncio ativo primeiro. */
export function conjuntosDosAnuncios(anuncios) {
  const porId = new Map();
  for (const a of anuncios) {
    if (!a.conjunto_id) continue;
    const c = porId.get(a.conjunto_id) || { id: a.conjunto_id, nome: a.conjunto_nome, campanha_nome: a.campanha_nome, ativo: false };
    c.ativo = c.ativo || a.ativo;
    porId.set(a.conjunto_id, c);
  }
  return [...porId.values()].sort((x, y) => Number(y.ativo) - Number(x.ativo) || x.nome.localeCompare(y.nome));
}

/**
 * Gasto, impressões e cliques por anúncio num intervalo (datas 'YYYY-MM-DD',
 * as duas inclusivas). `ids` opcional restringe aos anúncios pedidos.
 */
export async function insightsPorAnuncio(env, { desde, ate, ids = null }, fetchImpl = fetch) {
  const token = tokenMeta(env);
  if (!token) return { ok: false, aviso: 'O token de anúncios do Meta não está configurado.' };
  if (ids && !ids.length) return { ok: true, linhas: [] };
  let url = `https://graph.facebook.com/${VERSAO}/act_${contaMeta(env)}/insights`
    + `?level=ad&fields=ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks`
    + `&time_range=${encodeURIComponent(JSON.stringify({ since: desde, until: ate }))}`
    + `&limit=500&access_token=${encodeURIComponent(token)}`;
  if (ids) url += `&filtering=${encodeURIComponent(JSON.stringify([{ field: 'ad.id', operator: 'IN', value: ids }]))}`;
  try {
    const linhas = await lerPaginas(url, fetchImpl);
    return {
      ok: true,
      linhas: linhas.map((l) => ({
        anuncio_id: String(l.ad_id), anuncio_nome: String(l.ad_name || ''),
        conjunto_id: String(l.adset_id || ''), conjunto_nome: String(l.adset_name || ''),
        campanha_id: String(l.campaign_id || ''), campanha_nome: String(l.campaign_name || ''),
        gasto_centavos: Math.round(Number(l.spend || 0) * 100),
        impressoes: Number(l.impressions || 0), cliques: Number(l.clicks || 0),
      })),
    };
  } catch {
    return { ok: false, aviso: 'Não foi possível ler o gasto por anúncio no Meta agora.' };
  }
}
