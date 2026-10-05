// Semanas do relatório semanal do Argo (spec-relatorio-semanal-argo.md, módulo 3).
//
// Decisão da gestora (04/10): o relatório sai toda segunda às 07h e cobre os
// 7 dias anteriores sem contar o dia atual. Gerado em outro dia (refazer, ou
// atraso do cron), continua cobrindo os 7 dias que terminam ontem.
// Módulo puro.

export function somarDias(ymd, n) {
  const [a, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

const dataBR = (ymd) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

/**
 * As três janelas que o relatório compara, a partir do dia da geração
 * ('YYYY-MM-DD', Brasília): a semana, a anterior e as 4 anteriores juntas.
 */
export function janelasDoRelatorio(hoje) {
  const fim = somarDias(hoje, -1);
  const inicio = somarDias(fim, -6);
  const anteriorFim = somarDias(inicio, -1);
  const anteriorInicio = somarDias(anteriorFim, -6);
  const media4Inicio = somarDias(anteriorFim, -27);
  return {
    semana: { inicio, fim, rotulo: `${dataBR(inicio)} a ${dataBR(fim)}` },
    anterior: { inicio: anteriorInicio, fim: anteriorFim, rotulo: `${dataBR(anteriorInicio)} a ${dataBR(anteriorFim)}` },
    media4: { inicio: media4Inicio, fim: anteriorFim, semanas: 4, rotulo: `${dataBR(media4Inicio)} a ${dataBR(anteriorFim)}` },
  };
}

/** Limites em ms (meia-noite de Brasília, fim exclusivo) de uma janela de dias inteiros. */
export function limitesMs({ inicio, fim }) {
  return { desde: Date.parse(`${inicio}T00:00:00-03:00`), ate: Date.parse(`${somarDias(fim, 1)}T00:00:00-03:00`) };
}
