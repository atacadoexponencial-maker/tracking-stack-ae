// Alerta de saúde do envio ao Meta (issues 284–287).
//
// Substitui o aviso por WhatsApp (Evolution, muda desde 10/08/2026) para falha
// de conversão do Meta. Entrega num canal do Slack por Incoming Webhook: a URL
// fica só no secret SLACK_WEBHOOK_META, nunca no dash.
//
// Cada mensagem é gravada ANTES de tentar entregar, em meta_alertas_log; o que
// não foi entregue é tentado de novo na verificação seguinte. Falha de entrega
// nunca é silenciosa.

import { ALERTA, TITULOS_CONDICAO } from './_meta-envio.js';
import { FUSO_BRT } from './_data-brt.js';

const CONDICOES = Object.keys(TITULOS_CONDICAO);
// Condições que carregam uma lista de itens (credenciais, fontes): item novo
// numa condição já ativa gera alerta só com o item novo.
const CONDICOES_COM_ITENS = new Set(['credencial_problema', 'horario_suspeito']);
const REENTREGA_JANELA_SEG = 24 * 3600;
const LINK_PADRAO = 'https://tracking-ae.pages.dev/dash/#saude-meta';

export const canalConfigurado = (env) => !!env.SLACK_WEBHOOK_META;

const dataHora = (ts) => new Date(ts * 1000).toLocaleString('pt-BR', { timeZone: FUSO_BRT, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function duracao(segundos) {
  const s = Math.max(0, Math.round(segundos));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h >= 48) return `${Math.floor(h / 24)} dias`;
  if (h >= 1) return m ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}

function numeros(m) {
  const taxa = m.total6h ? `${Math.round((m.aceitas6h / m.total6h) * 100)}%` : '—';
  const linhas = [
    `• Aceitação nas últimas 6 h: ${taxa} (${m.aceitas6h} de ${m.total6h})`,
    `• Última conversão aceita: ${m.ultimaAceitaEm ? dataHora(m.ultimaAceitaEm) : 'nenhuma registrada'}`,
  ];
  if (m.expiram24h) linhas.push(`• Pendentes que expiram em 24 h: ${m.expiram24h}`);
  return linhas.join('\n');
}

/** Texto das mensagens (puro, testável). */
export function montarMensagem(tipo, { condicoes = [], metricas = {}, estados = {}, recuperadas = 0, motivoFrequente = '', agora, link = LINK_PADRAO, itens = {} }) {
  const lista = condicoes.map((c) => {
    const desde = estados[c]?.desde;
    const sufixo = !desde ? ''
      : tipo === 'lembrete' ? ` — há ${duracao(agora - desde)}`
        : tipo === 'recuperacao' ? ` (durou ${duracao(agora - desde)})` : '';
    // Credenciais e fontes: só nome e tipo do problema — nunca valor de segredo.
    const sub = (itens[c] || []).map((i) => `\n    – ${i}`).join('');
    return `• ${TITULOS_CONDICAO[c] || c}${sufixo}${sub}`;
  }).join('\n');
  const soDoMeta = condicoes.some((c) => !CONDICOES_COM_ITENS.has(c));
  if (tipo === 'alerta') {
    return `:rotating_light: *${soDoMeta ? 'Envio de conversões ao Meta com problema' : 'Integração do tracking com problema'}*\n${lista}`
      + (soDoMeta ? `\n\n${numeros(metricas)}` : '')
      + (soDoMeta && motivoFrequente ? `\n• Motivo mais frequente: ${motivoFrequente}` : '') + `\n\nDetalhes: ${link}`;
  }
  if (tipo === 'lembrete') {
    return `:warning: *Ainda acontecendo: ${soDoMeta ? 'envio ao Meta' : 'integração do tracking'} com problema*\n${lista}`
      + (soDoMeta ? `\n\n${numeros(metricas)}` : '') + `\n\nDetalhes: ${link}`;
  }
  if (tipo === 'recuperacao') {
    return `:white_check_mark: *${soDoMeta ? 'Envio ao Meta normalizado' : 'Integração do tracking normalizada'}*\n${lista}`
      + (soDoMeta ? `\n\n• Conversões recuperadas pelo reenvio: ${recuperadas}` : '') + `\n\nDetalhes: ${link}`;
  }
  return `:test_tube: *Teste do alerta do tracking* — se esta mensagem chegou, o canal de avisos do Meta está funcionando. (${dataHora(agora)})`;
}

// Condições medidas numa janela móvel: saem da lista quando a janela anda,
// mesmo sem nada ter sido aceito. Só contam como resolvidas com prova — uma
// conversão aceita depois que começaram.
const PRECISAM_DE_ACEITE = new Set(['aceitacao_baixa', 'sem_aceitas']);

/**
 * Decide o que mandar a partir das condições ativas e do estado guardado (puro).
 * Devolve { novas, lembrar, resolvidas }.
 */
export function planejarAvisos(condicoes, estados, agora, metricas = {}) {
  const novas = condicoes.filter((c) => !estados[c]?.ativa);
  const lembrar = condicoes.filter((c) => estados[c]?.ativa && agora - (estados[c].ultimo_aviso_em || 0) >= ALERTA.lembreteSeg);
  const resolvidas = CONDICOES.filter((c) => estados[c]?.ativa && !condicoes.includes(c)
    && (!PRECISAM_DE_ACEITE.has(c) || (metricas.ultimaAceitaEm || 0) > (estados[c].desde || 0)));
  return { novas, lembrar, resolvidas };
}

async function entregarSlack(env, texto, fetchImpl) {
  if (!canalConfigurado(env)) return { ok: false, erro: 'Nenhum canal de alerta configurado.' };
  try {
    const r = await fetchImpl(env.SLACK_WEBHOOK_META, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: texto }),
    });
    if (r.ok) return { ok: true };
    return { ok: false, erro: `Slack respondeu HTTP ${r.status}: ${(await r.text().catch(() => '')).slice(0, 200)}` };
  } catch (e) {
    return { ok: false, erro: `Falha de rede ao falar com o Slack: ${e.message}` };
  }
}

// Grava e tenta entregar. A linha existe antes da tentativa: se a entrega
// falhar (ou o Worker morrer no meio), ela fica como não entregue.
async function registrarEEntregar(env, tipo, condicoes, texto, agora, fetchImpl) {
  const ins = await env.DB.prepare(
    `INSERT INTO meta_alertas_log (tipo, condicoes, mensagem, criado_em, entregue, tentativas)
     VALUES (?, ?, ?, ?, 0, 0)`
  ).bind(tipo, condicoes.join(','), texto, agora).run();
  const id = ins.meta?.last_row_id;
  const r = await entregarSlack(env, texto, fetchImpl);
  await env.DB.prepare('UPDATE meta_alertas_log SET entregue = ?, tentativas = tentativas + 1, erro = ? WHERE id = ?')
    .bind(r.ok ? 1 : 0, r.ok ? null : r.erro, id).run();
  return { id, ...r };
}

/**
 * Verificação periódica (issues 284–286): manda alerta, lembrete e
 * recuperação conforme as condições, e reentrega o que ficou pendente.
 */
export async function processarAlertas(env, { condicoes, metricas, agora = Math.floor(Date.now() / 1000), fetchImpl = fetch, itens = {} }) {
  const { results } = await env.DB.prepare('SELECT condicao, ativa, desde, ultimo_aviso_em, itens FROM meta_alertas_estado').all();
  const estados = Object.fromEntries(results.map((e) => [e.condicao, e]));
  const { novas, lembrar, resolvidas } = planejarAvisos(condicoes, estados, agora, metricas);
  const enviados = [];
  const link = env.DASH_URL_SAUDE_META || LINK_PADRAO;

  // 1. Reentrega do que não chegou (antes de gerar mensagens novas).
  const { results: naoEntregues } = await env.DB.prepare(
    `SELECT id, mensagem FROM meta_alertas_log
      WHERE entregue = 0 AND tipo <> 'teste' AND criado_em >= ?
      ORDER BY criado_em LIMIT 5`
  ).bind(agora - REENTREGA_JANELA_SEG).all();
  for (const l of naoEntregues) {
    const r = await entregarSlack(env, l.mensagem, fetchImpl);
    await env.DB.prepare('UPDATE meta_alertas_log SET entregue = ?, tentativas = tentativas + 1, erro = ? WHERE id = ?')
      .bind(r.ok ? 1 : 0, r.ok ? null : r.erro, l.id).run();
  }

  const motivoFrequente = await env.DB.prepare(
    `SELECT motivo, COUNT(*) AS n FROM meta_envios
      WHERE situacao <> 'aceita' AND motivo IS NOT NULL AND COALESCE(ultima_tentativa_em, 0) >= ?
      GROUP BY motivo ORDER BY n DESC LIMIT 1`
  ).bind(agora - 6 * 3600).first().catch(() => null);

  // Item novo numa condição que já estava ativa (ex.: uma segunda credencial
  // quebrou): alerta só com o item novo, sem esperar o lembrete.
  const jaAvisados = (c) => { try { return JSON.parse(estados[c]?.itens || '[]'); } catch { return []; } };
  const itensNovos = {};
  for (const c of condicoes) {
    if (!CONDICOES_COM_ITENS.has(c) || !estados[c]?.ativa) continue;
    const novosDaCondicao = (itens[c] || []).filter((i) => !jaAvisados(c).includes(i));
    if (novosDaCondicao.length) itensNovos[c] = novosDaCondicao;
  }
  const gravarItens = async (c) => {
    if (CONDICOES_COM_ITENS.has(c)) {
      await env.DB.prepare('UPDATE meta_alertas_estado SET itens = ? WHERE condicao = ?').bind(JSON.stringify(itens[c] || []), c).run();
    }
  };

  // 2. Condição nova: um alerta só, listando todas as que estão ativas.
  if (novas.length) {
    const texto = montarMensagem('alerta', { condicoes, metricas, agora, link, itens, motivoFrequente: motivoFrequente?.motivo || '' });
    enviados.push({ tipo: 'alerta', ...(await registrarEEntregar(env, 'alerta', condicoes, texto, agora, fetchImpl)) });
    for (const c of condicoes) {
      await env.DB.prepare(
        `INSERT INTO meta_alertas_estado (condicao, ativa, desde, ultimo_aviso_em) VALUES (?, 1, ?, ?)
         ON CONFLICT(condicao) DO UPDATE SET ativa = 1, desde = COALESCE(CASE WHEN meta_alertas_estado.ativa = 1 THEN meta_alertas_estado.desde END, excluded.desde), ultimo_aviso_em = excluded.ultimo_aviso_em`
      ).bind(c, agora, agora).run();
      await gravarItens(c);
    }
  } else if (Object.keys(itensNovos).length) {
    const conds = Object.keys(itensNovos);
    const texto = montarMensagem('alerta', { condicoes: conds, metricas, agora, link, itens: itensNovos });
    enviados.push({ tipo: 'alerta', ...(await registrarEEntregar(env, 'alerta', conds, texto, agora, fetchImpl)) });
    for (const c of conds) {
      await env.DB.prepare('UPDATE meta_alertas_estado SET ultimo_aviso_em = ? WHERE condicao = ?').bind(agora, c).run();
      await gravarItens(c);
    }
  } else if (lembrar.length) {
    // 3. Persistente há mais que o intervalo de lembrete.
    const texto = montarMensagem('lembrete', { condicoes: lembrar, metricas, estados, agora, link, itens });
    enviados.push({ tipo: 'lembrete', ...(await registrarEEntregar(env, 'lembrete', lembrar, texto, agora, fetchImpl)) });
    for (const c of lembrar) {
      await env.DB.prepare('UPDATE meta_alertas_estado SET ultimo_aviso_em = ? WHERE condicao = ?').bind(agora, c).run();
      await gravarItens(c);
    }
  }

  // Item que saiu de uma condição ainda ativa: guarda a lista atual, para que ele
  // volte a alertar se quebrar de novo.
  for (const c of condicoes) {
    if (CONDICOES_COM_ITENS.has(c) && estados[c]?.ativa && !itensNovos[c] && !lembrar.includes(c)) await gravarItens(c);
  }

  // 4. Condição que deixou de valer: recuperação uma única vez.
  if (resolvidas.length) {
    const desde = Math.min(...resolvidas.map((c) => estados[c].desde || agora));
    const rec = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM meta_envios WHERE aceita_por_reenvio = 1 AND aceita_em >= ?'
    ).bind(desde).first();
    const texto = montarMensagem('recuperacao', { condicoes: resolvidas, estados, agora, link, recuperadas: Number(rec?.n) || 0,
      itens: Object.fromEntries(resolvidas.map((c) => [c, jaAvisados(c)])) });
    enviados.push({ tipo: 'recuperacao', ...(await registrarEEntregar(env, 'recuperacao', resolvidas, texto, agora, fetchImpl)) });
    for (const c of resolvidas) {
      await env.DB.prepare('UPDATE meta_alertas_estado SET ativa = 0 WHERE condicao = ?').bind(c).run();
    }
  }

  return { novas, lembrar, resolvidas, enviados, reentregas: naoEntregues.length };
}

/** Alerta de teste (issue 287): não mexe em nenhuma condição. */
export async function enviarTeste(env, agora = Math.floor(Date.now() / 1000), fetchImpl = fetch) {
  const texto = montarMensagem('teste', { agora });
  return registrarEEntregar(env, 'teste', [], texto, agora, fetchImpl);
}
