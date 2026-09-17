// Horário suspeito nas integrações (spec-protecoes-integracoes.md, módulo 2).
//
// A Evolution mandou o horário de Brasília carimbado como UTC por 7 semanas e
// todo evento de grupo ficou 3 h atrasado. Aqui cada fonte que informa horário
// próprio é comparada com o horário de chegada, e o sistema distingue atraso
// isolado (reentrega, venda antiga) de desvio sistemático (fuso errado).
//
// Nada é descartado nem corrigido: só medido. Lógica pura (testes em
// tests/horario-fontes.test.js); o I/O fica em _horario-registro.js.

export const FONTES = {
  'grupos-whatsapp': { rotulo: 'Grupos de WhatsApp (Evolution)', toleranciaMin: 10, correcao: 'grupos-whatsapp:corrigido' },
  'grupos-whatsapp:corrigido': { rotulo: 'Grupos de WhatsApp — depois da correção', toleranciaMin: 10, oculta: true },
  greenn: { rotulo: 'Greenn (vendas)', toleranciaMin: 30 },
  clickup: { rotulo: 'ClickUp (mudança de estágio)', toleranciaMin: 10 },
  'meta-formulario': { rotulo: 'Formulário do Meta (planilha)', toleranciaMin: 15 + 30 },
  kiwify: { rotulo: 'Kiwify (vendas)', toleranciaMin: 30 },
  hotmart: { rotulo: 'Hotmart (vendas)', toleranciaMin: 30 },
  eduzz: { rotulo: 'Eduzz (vendas)', toleranciaMin: 30 },
};

export const FUTURO_MAX_MIN = 5;
export const VOLUME_MINIMO = 5;
export const MEDIANA_MAX_MIN = 30;
export const FRACAO_HORAS_INTEIRAS = 0.8;
export const TOLERANCIA_HORA_INTEIRA_MIN = 5;
export const AMOSTRA_SUSPEITOS = 50;

// Faixas de |desvio| em minutos para estimar a mediana sem guardar cada evento.
export const FAIXAS = [0, 5, 10, 30, 60, 90, 120, 180, 240, 360, 720, 1440, 2880, Infinity];

/**
 * Lê um horário informado pela fonte. Unix (s ou ms) e ISO com fuso são lidos
 * como estão; texto SEM fuso ("2026-09-16 10:00:00") é lido como UTC — de
 * propósito: se a fonte manda horário de Brasília sem dizer, o desvio de 3 h
 * aparece, que é exatamente o que se quer detectar.
 */
export function lerHorario(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  if (Number.isFinite(n) && n > 0) return String(Math.trunc(n)).length <= 10 ? n * 1000 : n;
  const s = String(valor).trim();
  const temFuso = /(?:[Zz]|[+-]\d{2}:?\d{2})$/.test(s);
  const ms = Date.parse(temFuso ? s : s.replace(' ', 'T') + 'Z');
  return Number.isFinite(ms) ? ms : null;
}

/** Desvio em minutos (positivo = informado no passado). */
export function desvioMin(informadoMs, chegadaMs) {
  return Math.round((chegadaMs - informadoMs) / 60000);
}

export function ehSuspeito(fonte, desvio) {
  const tol = (FONTES[fonte] || {}).toleranciaMin ?? 30;
  return desvio < -FUTURO_MAX_MIN || Math.abs(desvio) > tol;
}

export function indiceFaixa(absMin) {
  for (let i = 0; i < FAIXAS.length - 1; i++) if (absMin < FAIXAS[i + 1]) return i;
  return FAIXAS.length - 2;
}

/** Deslocamento próximo de N horas inteiras (N ≠ 0), ou 0. */
export function horasInteiras(desvio) {
  const h = Math.round(desvio / 60);
  return h !== 0 && Math.abs(desvio - h * 60) <= TOLERANCIA_HORA_INTEIRA_MIN ? h : 0;
}

/** Soma um evento a um resumo (objetos puros: { eventos, sem_horario, suspeitos, hist[], horas{} }). */
export function somarEvento(resumo, fonte, desvio) {
  const r = resumo || { eventos: 0, sem_horario: 0, suspeitos: 0, hist: [], horas: {} };
  r.eventos++;
  if (desvio === null) { r.sem_horario++; return r; }
  if (ehSuspeito(fonte, desvio)) r.suspeitos++;
  const i = indiceFaixa(Math.abs(desvio));
  r.hist[i] = (r.hist[i] || 0) + 1;
  const h = horasInteiras(desvio);
  if (h) r.horas[h] = (r.horas[h] || 0) + 1;
  return r;
}

/** Junta resumos de várias horas. */
export function juntar(resumos) {
  const t = { eventos: 0, sem_horario: 0, suspeitos: 0, hist: [], horas: {} };
  for (const r of resumos) {
    t.eventos += r.eventos || 0;
    t.sem_horario += r.sem_horario || 0;
    t.suspeitos += r.suspeitos || 0;
    (r.hist || []).forEach((v, i) => { t.hist[i] = (t.hist[i] || 0) + (v || 0); });
    for (const [h, v] of Object.entries(r.horas || {})) t.horas[h] = (t.horas[h] || 0) + v;
  }
  return t;
}

/** Mediana aproximada de |desvio| (limite superior da faixa que contém a mediana). */
export function medianaAproximada(hist) {
  const total = hist.reduce((s, v) => s + (v || 0), 0);
  if (!total) return null;
  let acum = 0;
  for (let i = 0; i < hist.length; i++) {
    acum += hist[i] || 0;
    if (acum >= total / 2) return FAIXAS[i + 1] === Infinity ? FAIXAS[i] : FAIXAS[i + 1];
  }
  return null;
}

/**
 * Avalia uma fonte sobre as últimas 24 h.
 * @returns {{ situacao: 'normal'|'suspeito'|'pouco_volume', diagnostico: string, medianaMin, fracaoSuspeitos, horasDominantes }}
 */
export function avaliarFonte(resumo24h) {
  const comHorario = resumo24h.eventos - resumo24h.sem_horario;
  const mediana = medianaAproximada(resumo24h.hist);
  const fracaoSuspeitos = comHorario ? resumo24h.suspeitos / comHorario : 0;
  const [horaDominante, qtdHora] = Object.entries(resumo24h.horas).sort((a, b) => b[1] - a[1])[0] || [null, 0];
  const fracaoHoras = comHorario ? qtdHora / comHorario : 0;
  const base = { medianaMin: mediana, fracaoSuspeitos, horasDominantes: horaDominante ? Number(horaDominante) : null };

  if (comHorario < VOLUME_MINIMO) {
    return { ...base, situacao: 'pouco_volume', diagnostico: 'Pouco volume nas últimas 24 h para avaliar.' };
  }
  if (fracaoHoras >= FRACAO_HORAS_INTEIRAS) {
    const h = Number(horaDominante);
    return {
      ...base,
      situacao: 'suspeito',
      diagnostico: `Os horários desta fonte estão, em regra, ${Math.abs(h)} h ${h > 0 ? 'atrasados' : 'adiantados'} em relação à chegada — provável fuso errado.`,
    };
  }
  if (mediana !== null && mediana > MEDIANA_MAX_MIN) {
    return { ...base, situacao: 'suspeito', diagnostico: `Metade dos eventos chega com mais de ${mediana >= 60 ? Math.round(mediana / 60) + ' h' : mediana + ' min'} de diferença.` };
  }
  return { ...base, situacao: 'normal', diagnostico: 'Horários coerentes com a chegada.' };
}
