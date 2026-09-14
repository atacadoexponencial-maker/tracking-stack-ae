// Datas de NEGÓCIO em America/Sao_Paulo, num lugar só.
//
// O D1 guarda tudo em UTC (unix em segundos; ISO em texto), mas quem lê o
// dashboard pensa no dia de Brasília. Antes desta revisão (13/09/2026) cada
// endpoint fazia a conversão do seu jeito: attribution.js com getUTC*(),
// cpl.js / campaign-funnel.js / ad-spend.js com toISOString().slice(0, 10) —
// todos em UTC. Consequência concreta: um período que começa em 01/09 00:00
// de Brasília vira 01/09 03:00 UTC, e um gasto lançado pelo Meta no dia 31/08
// (que o sync grava por data local) entrava ou saía da soma conforme a hora
// da consulta. Investimento e leads do mesmo "dia" vinham de calendários
// diferentes.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

export const FUSO_BRT = 'America/Sao_Paulo';

// O Brasil não tem horário de verão desde 2019, então o deslocamento é fixo.
// É o mesmo pressuposto de `diaLocal` em webhooks/_classificar.js; se um dia
// o horário de verão voltar, são estes dois pontos que mudam.
const OFFSET_BRT = '-03:00';

/**
 * 'YYYY-MM-DD' do instante (unix em SEGUNDOS) no fuso de Brasília.
 *
 * `sv-SE` é o único locale cujo formato de data curta é exatamente ISO
 * (2026-09-13); é o mesmo truque que o dashboard já usa para agrupar leads por
 * dia. Entrada inválida devolve null em vez de lançar — um endpoint não pode
 * cair por causa de um `from` malformado.
 */
export function ymdBrt(unixSegundos) {
  const n = Number(unixSegundos);
  if (!Number.isFinite(n)) return null;
  return new Date(n * 1000).toLocaleDateString('sv-SE', { timeZone: FUSO_BRT });
}

/**
 * Unix (segundos) da meia-noite de Brasília do dia 'YYYY-MM-DD' informado.
 * É a fronteira usada para decidir se um período já FECHOU (ver _cache.js) e
 * para recortar tabelas com data em ISO (aba Grupos).
 */
export function inicioDoDiaBrt(ymd) {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const ms = Date.parse(`${ymd}T00:00:00${OFFSET_BRT}`);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/**
 * Meia-noite de HOJE em Brasília (unix em segundos). `agoraUnix` é injetável
 * para os testes não dependerem do relógio.
 */
export function meiaNoiteHojeBrt(agoraUnix = Math.floor(Date.now() / 1000)) {
  return inicioDoDiaBrt(ymdBrt(agoraUnix));
}
