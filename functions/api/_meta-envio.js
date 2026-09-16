// Regras do reenvio ao Meta e da saúde do envio (spec-capi-reenvio-monitoramento.md).
//
// Lógica pura — sem D1, sem fetch — para ser testada sozinha
// (tests/meta-envio.test.js). Quem lê e grava no banco é _meta-fila.js.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

export const MAX_TENTATIVAS = 5;
// O Meta recusa evento com mais de 7 dias; 6 dá margem (mesma regra do EntrouGrupo).
export const DIAS_JANELA = 6;
export const JANELA_SEGUNDOS = DIAS_JANELA * 86400;
export const TAMANHO_RODADA = 50;
// Espera da 1ª nova tentativa; dobra a cada tentativa consumida.
export const ESPERA_BASE_SEGUNDOS = 15 * 60;
// Trava de uma linha durante o envio: passa disso, outra rodada pode pegá-la.
export const TRAVA_SEGUNDOS = 120;

// Limites do alerta (spec, "Decisões tomadas", item 8).
export const ALERTA = {
  janelaAceitacaoSeg: 6 * 3600,
  taxaMinima: 0.8,
  volumeMinimo: 10,
  semLeadAceitaSeg: 24 * 3600,
  lembreteSeg: 6 * 3600,
};

export const MOTIVOS = {
  credencial: 'Credencial do Meta inválida, expirada ou sem permissão — nenhuma conversão está sendo aceita.',
  semCredencial: 'Credencial do Meta não configurada.',
  expirou: 'Passou de 6 dias sem ser aceita — o Meta não aceita mais este evento.',
  passageira: 'Sem resposta do Meta (rede ou instabilidade).',
};

// Códigos do Graph API que querem dizer "tente mais tarde": erro desconhecido
// (1), serviço temporário (2), limites de chamada (4, 17, 32, 341, 613).
const CODIGOS_PASSAGEIROS = new Set([1, 2, 4, 17, 32, 341, 613]);
// Token inválido (190), sessão (102), permissão (10 e a faixa 200–299).
const CODIGOS_CREDENCIAL = new Set([190, 102, 10]);

function lerErroMeta(corpo) {
  try {
    const j = typeof corpo === 'string' ? JSON.parse(corpo) : corpo;
    return (j && j.error) || null;
  } catch {
    return null;
  }
}

/**
 * Decide a situação de uma conversão a partir da resposta do Meta.
 *
 * Credencial NÃO é reconhecida por `type: OAuthException`: o Meta usa esse
 * mesmo tipo em "parâmetro inválido" (code 100), e tratar isso como credencial
 * deixaria um evento quebrado preso na fila para sempre, sem gastar tentativa.
 *
 * @returns {{ situacao: 'aceita'|'pendente'|'falhou', categoria: string|null,
 *             motivo: string|null, consomeTentativa: boolean }}
 */
export function classificarRespostaMeta({ ok = false, status = 0, corpo = '', erroRede = false, semCredencial = false } = {}) {
  if (semCredencial) {
    return { situacao: 'pendente', categoria: 'credencial', motivo: MOTIVOS.semCredencial, consomeTentativa: false };
  }
  if (ok && status >= 200 && status < 300) {
    return { situacao: 'aceita', categoria: null, motivo: null, consomeTentativa: true };
  }
  if (erroRede || !status) {
    return { situacao: 'pendente', categoria: 'passageira', motivo: MOTIVOS.passageira, consomeTentativa: true };
  }

  const erro = lerErroMeta(corpo);
  const code = erro ? Number(erro.code) : NaN;

  if (status === 401 || status === 403 || CODIGOS_CREDENCIAL.has(code) || (code >= 200 && code < 300)) {
    return { situacao: 'pendente', categoria: 'credencial', motivo: MOTIVOS.credencial, consomeTentativa: false };
  }
  if (status >= 500 || status === 429 || (erro && erro.is_transient === true) || CODIGOS_PASSAGEIROS.has(code)) {
    return { situacao: 'pendente', categoria: 'passageira', motivo: MOTIVOS.passageira, consomeTentativa: true };
  }

  const msgMeta = (erro && (erro.error_user_msg || erro.message)) || String(corpo || `HTTP ${status}`);
  return {
    situacao: 'falhou',
    categoria: 'evento',
    motivo: `O Meta recusou o conteúdo do evento: ${resumir(msgMeta, 200)}`,
    consomeTentativa: true,
  };
}

export function motivoEsgotou(ultimaResposta) {
  return `Esgotou as tentativas. Última resposta: ${resumir(ultimaResposta || 'sem resposta', 160)}.`;
}

export function resumir(texto, max) {
  const t = String(texto == null ? '' : texto).replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/** Quando tentar de novo depois de `tentativas` consumidas: 15 min, 30 min, 1 h, 2 h… */
export function proximaTentativaEm(agora, tentativas) {
  const n = Math.max(1, Number(tentativas) || 1);
  return agora + ESPERA_BASE_SEGUNDOS * 2 ** (n - 1);
}

/** A conversão ainda está dentro da janela em que o Meta aceita? */
export function dentroDaJanela(eventTime, agora) {
  return Number(eventTime) >= agora - JANELA_SEGUNDOS;
}

/**
 * Condições de alerta ativas agora.
 *
 * `metricas`:
 *   ultimaCredencialEm  — última tentativa recusada por credencial (unix | null)
 *   ultimaAceitaEm      — última conversão aceita, qualquer tipo (unix | null)
 *   ultimaLeadAceitaEm  — último Lead aceito (unix | null)
 *   total6h, aceitas6h  — conversões (por horário original) nas últimas 6 h
 *   expiram24h          — pendentes que passam de 6 dias nas próximas 24 h
 *
 * "sem_aceitas" é a leitura da spec ajustada: "nenhuma conversão aceita há 6 h"
 * ao pé da letra dispara toda madrugada com ~5 leads por dia. Aqui só vale
 * quando HOUVE conversão nas últimas 6 h e nenhuma foi aceita — é o sinal de
 * quebra, sem o ruído do horário vazio.
 */
export function avaliarCondicoes(m, agora) {
  const ativas = [];
  const credencial = !!m.ultimaCredencialEm && (!m.ultimaAceitaEm || m.ultimaCredencialEm >= m.ultimaAceitaEm);
  if (credencial) ativas.push('credencial');
  // Com a credencial recusada, aceitação baixa e "nenhuma aceita" são o mesmo
  // incidente: listá-las à parte só duplicaria o aviso (e a "recuperação" delas
  // quando a janela de 6 h andasse diria que normalizou sem ter normalizado).
  if (!credencial && m.total6h >= ALERTA.volumeMinimo && m.aceitas6h / m.total6h < ALERTA.taxaMinima) {
    ativas.push('aceitacao_baixa');
  }
  if (!credencial && m.total6h > 0 && m.aceitas6h === 0) {
    ativas.push('sem_aceitas');
  }
  if (m.ultimaLeadAceitaEm && agora - m.ultimaLeadAceitaEm > ALERTA.semLeadAceitaSeg) {
    ativas.push('sem_lead_aceita');
  }
  if (m.expiram24h > 0) {
    ativas.push('pendentes_expirando');
  }
  return ativas;
}

export const TITULOS_CONDICAO = {
  credencial: 'Credencial do Meta recusada',
  aceitacao_baixa: 'Aceitação do Meta abaixo de 80% nas últimas 6 h',
  sem_aceitas: 'Nenhuma conversão aceita pelo Meta nas últimas 6 h',
  sem_lead_aceita: 'Nenhum Lead aceito pelo Meta há mais de 24 h',
  pendentes_expirando: 'Conversões pendentes prestes a expirar',
};

/**
 * Estado geral da aba.
 * Incidente: credencial recusada ou volume zerado (sem_aceitas / sem_lead_aceita).
 * Atenção: aceitação das últimas 24 h abaixo do limite, pendentes expirando em
 * 24 h ou falha definitiva nas últimas 24 h.
 *
 * `m.total24h`, `m.aceitas24h`, `m.falhas24h` complementam as métricas de avaliarCondicoes.
 */
export function estadoGeral(m, condicoes, agora, formatarData = (ts) => new Date(ts * 1000).toISOString()) {
  if (condicoes.includes('credencial')) {
    return { estado: 'incidente', frase: `Credencial do Meta recusada desde ${formatarData(m.credencialDesde || m.ultimaCredencialEm)}` };
  }
  if (condicoes.includes('sem_aceitas')) {
    return { estado: 'incidente', frase: TITULOS_CONDICAO.sem_aceitas };
  }
  if (condicoes.includes('sem_lead_aceita')) {
    return { estado: 'incidente', frase: TITULOS_CONDICAO.sem_lead_aceita };
  }
  const motivos = [];
  if (m.total24h >= ALERTA.volumeMinimo && m.aceitas24h / m.total24h < ALERTA.taxaMinima) {
    motivos.push(`aceitação de ${Math.round((m.aceitas24h / m.total24h) * 100)}% nas últimas 24 h`);
  }
  if (m.expiram24h > 0) motivos.push(`${m.expiram24h} ${m.expiram24h === 1 ? 'pendente expira' : 'pendentes expiram'} nas próximas 24 h`);
  if (m.falhas24h > 0) motivos.push(`${m.falhas24h} ${m.falhas24h === 1 ? 'falha definitiva' : 'falhas definitivas'} nas últimas 24 h`);
  if (motivos.length) return { estado: 'atencao', frase: motivos.join(' · ') };
  return { estado: 'saudavel', frase: 'O Meta está aceitando as conversões.' };
}
