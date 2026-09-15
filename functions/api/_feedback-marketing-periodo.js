// Período de GET /api/feedback-marketing (spec-feedback-marketing.md,
// módulo 2, "Período").
//
// Tudo em dias de Brasília (ver _data-brt.js): o "hoje", o dia da semana do
// período padrão e o recorte. Padrão = ontem; na segunda-feira, sexta a
// domingo. Sem feriado e sem "período anterior": o comparativo chama duas
// vezes.
//
// Módulo PURO: `agoraUnix` é injetável para os testes não dependerem do relógio.

import { ymdBrt, inicioDoDiaBrt } from './_data-brt.js';

export const MAX_DIAS = 92;
export const ERRO_DATA_INVALIDA = 'Data inválida: use AAAA-MM-DD.';
export const ERRO_FIM_ANTES_DO_INICIO = 'A data final é anterior à inicial.';
export const ERRO_FUTURO = 'O período não pode terminar no futuro.';
export const ERRO_LIMITE = 'O período pode ter no máximo 92 dias — divida em mais de uma consulta.';
export const AVISO_PARCIAL = 'Dia de hoje ainda em andamento — números parciais.';

const DIA_MS = 86400000;
const SEGUNDA = 1;

// Meia-noite UTC do dia civil 'AAAA-MM-DD', ou null se o texto não é uma data
// que existe (31/09, 29/02 fora de ano bissexto). A conta de dias é feita em
// UTC puro, onde todo dia tem 24h; o fuso só entra ao descobrir o "hoje".
function diaCivilMs(ymd) {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [ano, mes, dia] = ymd.split('-').map(Number);
  const ms = Date.UTC(ano, mes - 1, dia);
  const d = new Date(ms);
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return ms;
}

function somarDias(ymd, n) {
  return new Date(diaCivilMs(ymd) + n * DIA_MS).toISOString().slice(0, 10);
}

function rotuloDoDia(ymd) {
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
}

const texto = (v) => (v == null ? '' : String(v).trim());

// `inicio`/`fim` como vieram da query (vazio = não informado).
// Devolve { ok: true, periodo, avisos } ou { ok: false, erro }.
export function resolverPeriodo({ inicio, fim } = {}, agoraUnix = Math.floor(Date.now() / 1000)) {
  const hoje = ymdBrt(agoraUnix);
  let ini = texto(inicio);
  let fi = texto(fim);
  const padrao = !ini && !fi;

  if (padrao) {
    const ehSegunda = new Date(diaCivilMs(hoje)).getUTCDay() === SEGUNDA;
    ini = somarDias(hoje, ehSegunda ? -3 : -1);
    fi = somarDias(hoje, -1);
  } else {
    // Só uma data: o período é aquele único dia.
    if (!ini) ini = fi;
    if (!fi) fi = ini;
  }

  const msInicio = diaCivilMs(ini);
  const msFim = diaCivilMs(fi);
  if (msInicio == null || msFim == null) return { ok: false, erro: ERRO_DATA_INVALIDA };
  if (msFim < msInicio) return { ok: false, erro: ERRO_FIM_ANTES_DO_INICIO };
  if (msFim > diaCivilMs(hoje)) return { ok: false, erro: ERRO_FUTURO };

  const dias = Math.round((msFim - msInicio) / DIA_MS) + 1;
  if (dias > MAX_DIAS) return { ok: false, erro: ERRO_LIMITE };

  const parcial = fi === hoje;
  return {
    ok: true,
    periodo: {
      inicio: ini,
      fim: fi,
      dias,
      rotulo: dias === 1 ? rotuloDoDia(ini) : `${rotuloDoDia(ini)} a ${rotuloDoDia(fi)}`,
      padrao,
      parcial,
    },
    avisos: parcial ? [AVISO_PARCIAL] : [],
  };
}

// Recorte em unix (segundos) para tabelas com data em instante — cards,
// vendas, entradas: [desde, ate), da meia-noite de Brasília do primeiro dia à
// meia-noite de Brasília do dia seguinte ao último. `ad_spend.date` já é dia
// de Brasília e é recortado direto por `inicio`/`fim`.
export function limitesDoPeriodoUnix(periodo) {
  return {
    desde: inicioDoDiaBrt(periodo.inicio),
    ate: inicioDoDiaBrt(somarDias(periodo.fim, 1)),
  };
}
