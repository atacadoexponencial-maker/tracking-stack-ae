// Fila de reenvio ao Meta (spec-capi-reenvio-monitoramento.md, issues 270–276, 280).
//
// Tudo que lê e grava `meta_envios`. As decisões (categoria, espera, janela)
// vêm de _meta-envio.js; aqui só há I/O. A fila do EntrouGrupo
// (whatsapp_group_conversions) continua separada e NÃO é tocada — as métricas
// só a leem.
//
// Custo: toda consulta usa índice e lê só pendentes ou uma janela recente. O D1
// deste projeto já estourou limite de leitura duas vezes por varredura.

import {
  classificarRespostaMeta, proximaTentativaEm, motivoEsgotou, resumir,
  MAX_TENTATIVAS, JANELA_SEGUNDOS, TAMANHO_RODADA, TRAVA_SEGUNDOS, MOTIVOS,
} from './_meta-envio.js';

const MAX_RESPOSTA = 2000;
// Eventos do site que nunca entram na fila: medição interna e PageView (que nem
// é gravado no event_log, de propósito, para poupar o D1).
export const EVENTOS_FORA_DA_FILA = ['pageview', 'page_view', 'formstart', 'ctaclick', 'formstep'];

const urlEventos = (env) => `https://graph.facebook.com/v25.0/${env.META_PIXEL_ID_2}/events?access_token=${env.META_ACCESS_TOKEN_2}`;

/**
 * Grava a situação de uma conversão depois da 1ª tentativa (issues 270/271).
 *
 * `resultado`: { ok, status, corpo, erroRede, semCredencial } — o mesmo que foi
 * lido da resposta do envio original. Falha aqui vai só ao log: o evento e o
 * registro principal (event_log / purchase_log) já valeram.
 */
export async function registrarPrimeiraTentativa(env, { origem, eventId, eventName, eventTime, referencia, payload, resultado }, agora = Math.floor(Date.now() / 1000)) {
  if (!env.DB || !eventId || !eventName) return null;
  if (EVENTOS_FORA_DA_FILA.includes(String(eventName).toLowerCase())) return null;
  try {
    const c = classificarRespostaMeta(resultado);
    const tentativas = c.consomeTentativa ? 1 : 0;
    const proxima = c.situacao !== 'pendente' ? null
      : (c.categoria === 'credencial' ? agora : proximaTentativaEm(agora, 1));
    await env.DB.prepare(
      `INSERT OR IGNORE INTO meta_envios
         (origem, event_id, event_name, event_time, referencia, situacao, categoria, motivo,
          tentativas, payload, ultimo_status, ultima_resposta, proxima_tentativa_em,
          criado_em, ultima_tentativa_em, aceita_em, falhou_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      origem, eventId, eventName, Number(eventTime) || agora, referencia || null,
      c.situacao, c.categoria, c.motivo, tentativas,
      c.situacao === 'aceita' ? null : (payload || null),
      Number(resultado?.status) || 0, resumir(resultado?.corpo || '', MAX_RESPOSTA),
      proxima, agora, agora,
      c.situacao === 'aceita' ? agora : null,
      c.situacao === 'falhou' ? agora : null,
    ).run();
    return c.situacao;
  } catch (e) {
    console.error('meta_envios: falha ao registrar situação', eventId, e.message);
    return null;
  }
}

/**
 * Uma rodada de reenvio (issues 272–275). Devolve o resumo; `vazia: true`
 * quando não havia nada a fazer (e aí nada é gravado).
 */
export async function executarRodada(env, agora = Math.floor(Date.now() / 1000), fetchImpl = fetch) {
  const inicio = Date.now();
  const resumo = { vazia: false, expiradas: 0, tentadas: 0, aceitas: 0, pendentes: 0, falhas: 0, abortouCredencial: false };

  // 1. O que passou de 6 dias não será mais aceito pelo Meta.
  const exp = await env.DB.prepare(
    `UPDATE meta_envios
        SET situacao = 'falhou', categoria = 'expirou', motivo = ?, falhou_em = ?,
            payload = NULL, em_envio_ate = NULL
      WHERE situacao = 'pendente' AND event_time < ?`
  ).bind(MOTIVOS.expirou, agora, agora - JANELA_SEGUNDOS).run();
  resumo.expiradas = exp.meta?.changes || 0;

  // 2. Pendentes cuja espera acabou, das mais antigas para as mais novas.
  const { results: fila } = await env.DB.prepare(
    `SELECT id, event_id, event_time, payload, tentativas
       FROM meta_envios
      WHERE situacao = 'pendente'
        AND COALESCE(proxima_tentativa_em, 0) <= ?
        AND COALESCE(em_envio_ate, 0) < ?
      ORDER BY event_time
      LIMIT ?`
  ).bind(agora, agora, TAMANHO_RODADA).all();

  if (!fila.length && !resumo.expiradas) {
    resumo.vazia = true;
    return resumo;
  }

  const semCredencial = !env.META_PIXEL_ID_2 || !env.META_ACCESS_TOKEN_2;

  for (const linha of fila) {
    // Trava a linha: outra rodada simultânea não pega a mesma conversão.
    const trava = await env.DB.prepare(
      `UPDATE meta_envios SET em_envio_ate = ?
        WHERE id = ? AND situacao = 'pendente' AND COALESCE(em_envio_ate, 0) < ?`
    ).bind(agora + TRAVA_SEGUNDOS, linha.id, agora).run();
    if (!trava.meta?.changes) continue;

    resumo.tentadas++;
    let resultado;
    if (semCredencial) {
      resultado = { semCredencial: true };
    } else if (!linha.payload) {
      // Sem o conteúdo original não há como reenviar sem inventar dado.
      resultado = { status: 400, corpo: JSON.stringify({ error: { message: 'Conteúdo original indisponível para reenvio.' } }) };
    } else {
      try {
        const r = await fetchImpl(urlEventos(env), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: linha.payload,
        });
        resultado = { ok: r.ok, status: r.status, corpo: await r.text().catch(() => '') };
      } catch (e) {
        resultado = { erroRede: true, corpo: `Fetch error: ${e.message}` };
      }
    }

    try {
      const parou = await decidirReenvio(env, linha, resultado, agora, resumo);
      if (parou) break;
    } catch (e) {
      // Erro de banco numa linha não derruba a rodada: a trava expira sozinha
      // e a conversão volta a ser elegível na próxima.
      console.error('meta_envios: falha ao gravar decisão', linha.event_id, e.message);
    }
  }

  await env.DB.prepare(
    `INSERT INTO meta_reenvio_rodadas
       (iniciada_em, aceitas, pendentes, falhas, expiradas, abortou_credencial, duracao_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(agora, resumo.aceitas, resumo.pendentes, resumo.falhas, resumo.expiradas,
    resumo.abortouCredencial ? 1 : 0, Date.now() - inicio).run();

  return resumo;
}

// Grava a decisão de um reenvio. Devolve true quando a rodada deve parar.
async function decidirReenvio(env, linha, resultado, agora, resumo) {
  const c = classificarRespostaMeta(resultado);
  const status = Number(resultado.status) || 0;
  const resposta = resumir(resultado.corpo || '', MAX_RESPOSTA);

  if (c.situacao === 'aceita') {
    await env.DB.prepare(
      `UPDATE meta_envios
          SET situacao = 'aceita', aceita_em = ?, aceita_por_reenvio = 1, tentativas = tentativas + 1,
              payload = NULL, ultimo_status = ?, ultima_resposta = ?, ultima_tentativa_em = ?,
              proxima_tentativa_em = NULL, em_envio_ate = NULL
        WHERE id = ?`
    ).bind(agora, status, resposta, agora, linha.id).run();
    resumo.aceitas++;
    return false;
  }

  if (c.categoria === 'credencial') {
    // Não é culpa do evento: não consome tentativa, e as demais dariam o mesmo
    // erro — a rodada para. A próxima tenta de novo só a mais antiga.
    await env.DB.prepare(
      `UPDATE meta_envios
          SET categoria = 'credencial', motivo = ?, ultimo_status = ?, ultima_resposta = ?,
              ultima_tentativa_em = ?, proxima_tentativa_em = ?, em_envio_ate = NULL
        WHERE id = ?`
    ).bind(c.motivo, status, resposta, agora, agora, linha.id).run();
    resumo.pendentes++;
    resumo.abortouCredencial = true;
    return true;
  }

  const tentativas = (Number(linha.tentativas) || 0) + 1;

  if (c.situacao === 'pendente' && tentativas < MAX_TENTATIVAS) {
    await env.DB.prepare(
      `UPDATE meta_envios
          SET categoria = ?, motivo = ?, tentativas = ?, ultimo_status = ?, ultima_resposta = ?,
              ultima_tentativa_em = ?, proxima_tentativa_em = ?, em_envio_ate = NULL
        WHERE id = ?`
    ).bind(c.categoria, c.motivo, tentativas, status, resposta, agora, proximaTentativaEm(agora, tentativas), linha.id).run();
    resumo.pendentes++;
    return false;
  }

  // Falhou de vez: evento recusado, ou passageira que esgotou as tentativas.
  // O payload fica, para o "Tentar de novo" manual dentro da janela.
  const esgotou = c.situacao === 'pendente';
  await env.DB.prepare(
    `UPDATE meta_envios
        SET situacao = 'falhou', categoria = ?, motivo = ?, tentativas = ?, ultimo_status = ?,
            ultima_resposta = ?, ultima_tentativa_em = ?, falhou_em = ?, proxima_tentativa_em = NULL,
            em_envio_ate = NULL
      WHERE id = ?`
  ).bind(esgotou ? 'esgotou' : c.categoria, esgotou ? motivoEsgotou(resposta) : c.motivo,
    tentativas, status, resposta, agora, agora, linha.id).run();
  resumo.falhas++;
  return false;
}

/**
 * Na ativação, coloca na fila as recusas dos últimos 6 dias (issue 276).
 * Idempotente: INSERT OR IGNORE pelo par (origem, event_id).
 */
export async function recuperarRecentes(env, agora = Math.floor(Date.now() / 1000)) {
  const desde = agora - JANELA_SEGUNDOS;
  const fora = EVENTOS_FORA_DA_FILA.map(() => '?').join(', ');
  const { results: site } = await env.DB.prepare(
    `SELECT event_id, event_name, timestamp AS event_time, meta_status_code AS status,
            meta_response_body AS corpo, meta_payload_sent AS payload
       FROM event_log
      WHERE timestamp >= ? AND sent_to_meta = 1 AND COALESCE(meta_response_ok, 0) = 0
        AND is_bot = 0 AND meta_payload_sent IS NOT NULL
        AND LOWER(event_name) NOT IN (${fora})`
  ).bind(desde, ...EVENTOS_FORA_DA_FILA).all();

  const { results: vendas } = await env.DB.prepare(
    `SELECT event_id, 'Purchase' AS event_name, event_time, meta_status_code AS status,
            meta_response_body AS corpo, meta_payload_sent AS payload, product_name AS referencia
       FROM purchase_log
      WHERE created_at >= ? AND COALESCE(meta_response_ok, 0) = 0 AND meta_payload_sent IS NOT NULL`
  ).bind(desde).all();

  const contagem = { site: 0, venda: 0 };
  for (const [origem, linhas] of [['site', site], ['venda', vendas]]) {
    for (const l of linhas) {
      const corpo = String(l.corpo || '');
      const antes = await env.DB.prepare('SELECT 1 AS x FROM meta_envios WHERE origem = ? AND event_id = ?').bind(origem, l.event_id).first();
      if (antes) continue;
      await registrarPrimeiraTentativa(env, {
        origem, eventId: l.event_id, eventName: l.event_name, eventTime: l.event_time,
        referencia: l.referencia || referenciaDoPayload(l.payload), payload: l.payload,
        resultado: {
          ok: false, status: Number(l.status) || 0, corpo,
          semCredencial: corpo.startsWith('skipped: missing meta env'),
          erroRede: corpo.startsWith('Fetch error'),
        },
      }, agora);
      contagem[origem]++;
    }
  }
  return contagem;
}

function referenciaDoPayload(payload) {
  try { return JSON.parse(payload).data[0].event_source_url || null; } catch { return null; }
}

// --- EntrouGrupo (só leitura) ---------------------------------------------

const iso = (unix) => new Date(unix * 1000).toISOString();

/**
 * Números do "agora" para estado geral e alerta (issues 280/284). Só janelas
 * recentes e índices; EntrouGrupo entra somando a fila dele.
 */
export async function metricasSaude(env, agora = Math.floor(Date.now() / 1000)) {
  const h6 = agora - 6 * 3600, h24 = agora - 24 * 3600;
  const limiteExpira = agora - JANELA_SEGUNDOS + 24 * 3600;

  const cred = await env.DB.prepare(
    `SELECT MAX(ultima_tentativa_em) AS ultima, MIN(ultima_tentativa_em) AS desde
       FROM meta_envios WHERE situacao = 'pendente' AND categoria = 'credencial'`
  ).first();
  const aceita = await env.DB.prepare('SELECT MAX(aceita_em) AS ts FROM meta_envios').first();
  const lead = await env.DB.prepare(`SELECT MAX(aceita_em) AS ts FROM meta_envios WHERE event_name = 'Lead'`).first();
  const j6 = await env.DB.prepare(
    `SELECT COUNT(*) AS total, SUM(situacao = 'aceita') AS aceitas FROM meta_envios WHERE event_time >= ?`
  ).bind(h6).first();
  const j24 = await env.DB.prepare(
    `SELECT COUNT(*) AS total, SUM(situacao = 'aceita') AS aceitas FROM meta_envios WHERE event_time >= ?`
  ).bind(h24).first();
  const falhas24 = await env.DB.prepare(`SELECT COUNT(*) AS n FROM meta_envios WHERE situacao = 'falhou' AND falhou_em >= ?`).bind(h24).first();
  const expira = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM meta_envios WHERE situacao = 'pendente' AND event_time < ?`
  ).bind(limiteExpira).first();

  // EntrouGrupo: mesma credencial, mesmo painel. occurred_at é ISO UTC.
  const g6 = await env.DB.prepare(
    `SELECT COUNT(*) AS total, SUM(status = 'enviada') AS aceitas, MAX(enviado_em) AS ultima
       FROM whatsapp_group_conversions WHERE occurred_at >= ?`
  ).bind(iso(h6)).first().catch(() => null);
  const g24 = await env.DB.prepare(
    `SELECT COUNT(*) AS total, SUM(status = 'enviada') AS aceitas FROM whatsapp_group_conversions WHERE occurred_at >= ?`
  ).bind(iso(h24)).first().catch(() => null);
  const gExpira = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM whatsapp_group_conversions WHERE status = 'pendente' AND occurred_at < ?`
  ).bind(iso(limiteExpira)).first().catch(() => null);
  const gUltima = await env.DB.prepare(
    `SELECT MAX(enviado_em) AS ts FROM whatsapp_group_conversions WHERE status = 'enviada'`
  ).first().catch(() => null);

  const n = (v) => Number(v) || 0;
  return {
    ultimaCredencialEm: cred?.ultima || null,
    credencialDesde: cred?.desde || null,
    ultimaAceitaEm: Math.max(n(aceita?.ts), n(gUltima?.ts)) || null,
    ultimaLeadAceitaEm: lead?.ts || null,
    total6h: n(j6?.total) + n(g6?.total),
    aceitas6h: n(j6?.aceitas) + n(g6?.aceitas),
    total24h: n(j24?.total) + n(g24?.total),
    aceitas24h: n(j24?.aceitas) + n(g24?.aceitas),
    falhas24h: n(falhas24?.n),
    expiram24h: n(expira?.n) + n(gExpira?.n),
  };
}
