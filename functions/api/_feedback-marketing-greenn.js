// Compras realizadas na Greenn para GET /api/feedback-marketing
// (spec-feedback-marketing.md, módulo 2, tipo "Venda na Greenn").
//
// Mesmas regras da aba Greenn, importadas e não reescritas: a última
// atualização de cada venda (`reduzirPorVenda`) e a exclusão de teste interno
// (`ehTesteInterno`). A compra atribuída pelo Meta (purchase_log) não é lida.
//
// Data da venda = `received_at` da PRIMEIRA atualização paga. A Greenn reemite
// o `paid` quando a venda é editada (linha nova, outro updated_at); usar a
// última faria a venda "andar" para o dia da reemissão e contar em dois
// períodos. O status, esse sim, é o da atualização mais recente no momento da
// consulta: estorno posterior tira a venda do período.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

import { reduzirPorVenda, ehTesteInterno } from './_greenn-metricas.js';
import { dataHoraLegivel } from './_feedback-marketing-investimento.js';
import { canalDeLead } from './_canal.js';

// D1 limita a quantidade de parâmetros por consulta (mesmo lote de greenn.js).
// `IN (?, …)` e não `json_each`: conferido com EXPLAIN no D1 remoto, só a lista
// explícita usa idx_greenn_entidade — a outra forma varre a tabela.
const LOTE = 50;

export const AVISO_GREENN_SEM_EVENTO_NUNCA = 'Nenhum evento da Greenn registrado.';

export const avisoIlegiveis = (n) => `${n} registros da Greenn não puderam ser lidos.`;

const texto = (v) => (v == null ? '' : String(v)).trim();

// `linhas` = histórico completo (saleUpdated) das vendas candidatas;
// `limites` = { desde, ate } em unix segundos, [desde, ate).
// Devolve { compras: [{ entity_id, pago_em, trk }], ilegiveis }.
export function contarComprasDoPeriodo({ linhas = [], limites }) {
  const primeiraPaga = new Map();
  for (const l of linhas || []) {
    if (!l || l.current_status !== 'paid') continue;
    const chave = String(l.entity_id);
    const em = Number(l.received_at);
    if (!Number.isFinite(em)) continue;
    if (!primeiraPaga.has(chave) || em < primeiraPaga.get(chave)) primeiraPaga.set(chave, em);
  }

  const compras = [];
  let ilegiveis = 0;
  for (const ultima of reduzirPorVenda(linhas)) {
    let p;
    try {
      p = JSON.parse(ultima.raw_json);
    } catch {
      p = null;
    }
    if (!p || typeof p !== 'object') { ilegiveis++; continue; }
    if (ehTesteInterno(p.client && p.client.email)) continue;
    if (ultima.current_status !== 'paid') continue;

    const pagoEm = primeiraPaga.get(String(ultima.entity_id));
    if (pagoEm == null || pagoEm < limites.desde || pagoEm >= limites.ate) continue;
    compras.push({ entity_id: ultima.entity_id, pago_em: pagoEm, trk: texto(p.sf_trk) });
  }
  compras.sort((a, b) => a.pago_em - b.pago_em);
  return { compras, ilegiveis };
}

// Avisos da leitura da Greenn: ilegíveis e silêncio desde antes do início.
export function avisosGreenn({ ilegiveis = 0, ultimoEventoUnix = null, limites }) {
  const avisos = [];
  if (ilegiveis > 0) avisos.push(avisoIlegiveis(ilegiveis));
  const ultimo = ultimoEventoUnix == null ? null : Number(ultimoEventoUnix);
  if (ultimo == null || !Number.isFinite(ultimo)) {
    avisos.push(AVISO_GREENN_SEM_EVENTO_NUNCA);
  } else if (ultimo < limites.desde) {
    avisos.push(`Nenhum evento da Greenn desde ${dataHoraLegivel(ultimo)}.`);
  }
  return avisos;
}

// Só leitura, sempre por índice: candidatas por idx_greenn_recebido, histórico
// delas por idx_greenn_entidade, último evento por índice coberto.
// Devolve { linhas, ultimoEventoUnix }.
export async function lerVendasGreennDoPeriodo(db, { desde, ate }) {
  const [candidatasRes, ultimoRes] = await Promise.all([
    db.prepare(`
      SELECT DISTINCT entity_id FROM greenn_webhook_event
      WHERE received_at >= ? AND received_at < ?
        AND event = 'saleUpdated' AND current_status = 'paid'
    `).bind(desde, ate).all(),
    db.prepare('SELECT MAX(received_at) AS ultimo FROM greenn_webhook_event').first(),
  ]);

  const ids = [...new Set((candidatasRes.results || []).map((r) => r.entity_id).filter((id) => id != null))];
  const linhas = [];
  for (let i = 0; i < ids.length; i += LOTE) {
    const lote = ids.slice(i, i + LOTE);
    const { results } = await db.prepare(`
      SELECT id, entity_id, current_status, amount, received_at, raw_json
      FROM greenn_webhook_event
      WHERE entity_type = 'sale' AND entity_id IN (${lote.map(() => '?').join(',')})
        AND event = 'saleUpdated'
    `).bind(...lote).all();
    linhas.push(...(results || []));
  }

  return { linhas, ultimoEventoUnix: ultimoRes ? ultimoRes.ultimo : null };
}

// Issue 262. Origem da compra pela UTM da sessão de checkout (sf_trk → trk).
// Disparo: `_canal.js` não reconhece (lá `disparo-api` é `outro`), então a
// regra mínima mora aqui — utm_source começando por "disparo" (ex.:
// `disparo-api`, o único valor em uso no D1 em 15/09/2026).
export const ORIGENS_VENDA = ['trafego_pago', 'disparo', 'outra_origem', 'sem_rastreio'];
const CAMPOS_UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

export function classificarOrigem(sessao) {
  if (!sessao || !CAMPOS_UTM.some((c) => texto(sessao[c]))) return 'sem_rastreio';
  if (canalDeLead({ utm_source: sessao.utm_source, utm_campaign: sessao.utm_campaign }) === 'meta-ads') return 'trafego_pago';
  if (texto(sessao.utm_source).toLowerCase().startsWith('disparo')) return 'disparo';
  return 'outra_origem';
}

// `compras` = saída de contarComprasDoPeriodo; `sessoes` = linhas de
// checkout_sessions. Soma das origens = total de compras, sempre.
export function contarPorOrigem(compras = [], sessoes = []) {
  const porTrk = new Map((sessoes || []).map((s) => [s.trk, s]));
  const contagem = Object.fromEntries(ORIGENS_VENDA.map((o) => [o, 0]));
  for (const c of compras || []) {
    contagem[classificarOrigem(c.trk ? porTrk.get(c.trk) : null)]++;
  }
  return contagem;
}

// Sessões de checkout pela chave primária, em lotes; sem trk não lê nada.
export async function lerSessoesCheckout(db, trks) {
  const lista = [...new Set((trks || []).filter(Boolean))];
  const sessoes = [];
  for (let i = 0; i < lista.length; i += LOTE) {
    const lote = lista.slice(i, i + LOTE);
    const { results } = await db.prepare(`
      SELECT trk, utm_source, utm_medium, utm_campaign, utm_content, utm_term
      FROM checkout_sessions
      WHERE trk IN (${lote.map(() => '?').join(',')})
    `).bind(...lote).all();
    sessoes.push(...(results || []));
  }
  return sessoes;
}
