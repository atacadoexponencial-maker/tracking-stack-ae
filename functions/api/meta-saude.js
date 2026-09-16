// /api/meta-saude — aba "Saúde do Meta" do dash (issues 277–283, 286, 287).
//
// GET  ?from=&to=&key=                         painel do período + números de agora
// GET  ?view=falhas&from=&to=&tipo=&categoria=&pagina=&key=
// GET  ?view=detalhe&origem=&id=&key=
// POST ?key=  { acao: 'tentar-de-novo', id }   devolve uma falha para a fila
// POST ?key=  { acao: 'alerta-teste' }         mensagem de teste no canal
//
// Toda regra (taxas, categorias, estado geral, janela) sai pronta daqui; o dash
// só exibe. Sem cache de resposta: metade do painel é "agora" (pendentes,
// última aceita, estado), que muda a cada rodada.
//
// EntrouGrupo entra como mais um tipo, lendo whatsapp_group_conversions sem
// alterá-la (spec, "Decisões tomadas", item 2).

import { metricasSaude } from './_meta-fila.js';
import { avaliarCondicoes, estadoGeral, dentroDaJanela, JANELA_SEGUNDOS, MOTIVOS } from './_meta-envio.js';
import { canalConfigurado, enviarTeste } from './_meta-alerta.js';
import { FUSO_BRT } from './_data-brt.js';
import { clausulasBotSql, clausulasBotIpSql } from '../_bots.js';

const MAX_DIAS = 92;
const POR_PAGINA = 20;
const EG = 'EntrouGrupo';
const iso = (unix) => new Date(unix * 1000).toISOString();
const dataHora = (ts) => new Date(ts * 1000).toLocaleString('pt-BR', { timeZone: FUSO_BRT, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const taxa = (aceitas, total) => (total ? aceitas / total : null);

// Categoria da fila do EntrouGrupo, que não guarda uma: deriva do texto do erro.
function categoriaEntrouGrupo(l) {
  if (/expirada/i.test(l.erro || '')) return 'expirou';
  if (Number(l.tentativas) >= 5) return 'esgotou';
  return 'evento';
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) return json({ error: 'Unauthorized' }, 401);
  if (!env.DB) return json({ error: 'DB unavailable' }, 500);

  const agora = Math.floor(Date.now() / 1000);
  const de = Number(url.searchParams.get('from')) || agora - 30 * 86400;
  const ate = Number(url.searchParams.get('to')) || agora;
  if (ate < de) return json({ error: 'Período inválido.' }, 400);
  if (ate - de > MAX_DIAS * 86400 + 86400) return json({ error: 'Escolha um período de até 92 dias.' }, 400);

  try {
    const view = url.searchParams.get('view');
    if (view === 'falhas') return json(await falhas(env, url, de, ate, agora));
    if (view === 'detalhe') return json(await detalhe(env, url, agora));
    return json(await painel(env, de, ate, agora));
  } catch (e) {
    console.error('meta-saude:', e.message);
    return json({ error: 'Não foi possível carregar a saúde do Meta agora.' }, 500);
  }
}

async function painel(env, de, ate, agora) {
  const metricas = await metricasSaude(env, agora);
  const condicoes = avaliarCondicoes(metricas, agora);
  const estado = estadoGeral(metricas, condicoes, agora, dataHora);

  // --- aceitação por tipo (pelo horário original do evento) ---
  const { results: tipos } = await env.DB.prepare(
    `SELECT event_name AS tipo, COUNT(*) AS total,
            SUM(situacao = 'aceita' AND aceita_por_reenvio = 0) AS primeira,
            SUM(situacao = 'aceita' AND aceita_por_reenvio = 1) AS reenvio,
            SUM(situacao = 'pendente') AS pendentes,
            SUM(situacao = 'falhou') AS falhas
       FROM meta_envios WHERE event_time BETWEEN ? AND ?
      GROUP BY event_name`
  ).bind(de, ate).all();
  const eg = await env.DB.prepare(
    `SELECT COUNT(*) AS total,
            SUM(status = 'enviada' AND tentativas <= 1) AS primeira,
            SUM(status = 'enviada' AND tentativas > 1) AS reenvio,
            SUM(status = 'pendente') AS pendentes,
            SUM(status = 'falha') AS falhas
       FROM whatsapp_group_conversions WHERE occurred_at BETWEEN ? AND ?`
  ).bind(iso(de), iso(ate)).first().catch(() => null);
  if (eg && Number(eg.total)) tipos.push({ tipo: EG, ...eg });

  const n = (v) => Number(v) || 0;
  const linhas = tipos.map((t) => ({
    tipo: t.tipo, total: n(t.total), primeira: n(t.primeira), reenvio: n(t.reenvio),
    pendentes: n(t.pendentes), falhas: n(t.falhas),
    taxa: taxa(n(t.primeira) + n(t.reenvio), n(t.total)),
  })).sort((a, b) => b.total - a.total);
  const soma = (k) => linhas.reduce((s, l) => s + l[k], 0);
  const totais = { total: soma('total'), primeira: soma('primeira'), reenvio: soma('reenvio'), pendentes: soma('pendentes'), falhas: soma('falhas') };
  totais.taxa = taxa(totais.primeira + totais.reenvio, totais.total);

  // --- evolução diária (dia de Brasília) ---
  const { results: diasMeta } = await env.DB.prepare(
    `SELECT date(event_time, 'unixepoch', '-3 hours') AS d, COUNT(*) AS total, SUM(situacao = 'aceita') AS aceitas
       FROM meta_envios WHERE event_time BETWEEN ? AND ? GROUP BY d`
  ).bind(de, ate).all();
  const { results: diasEg } = await env.DB.prepare(
    `SELECT date(occurred_at, '-3 hours') AS d, COUNT(*) AS total, SUM(status = 'enviada') AS aceitas
       FROM whatsapp_group_conversions WHERE occurred_at BETWEEN ? AND ? GROUP BY d`
  ).bind(iso(de), iso(ate)).all().catch(() => ({ results: [] }));
  const porDia = {};
  for (const r of [...diasMeta, ...diasEg]) {
    porDia[r.d] = porDia[r.d] || { d: r.d, total: 0, aceitas: 0 };
    porDia[r.d].total += n(r.total);
    porDia[r.d].aceitas += n(r.aceitas);
  }
  const diario = Object.values(porDia).sort((a, b) => a.d.localeCompare(b.d));

  // --- pendentes (agora, independente do período) ---
  const { results: pendCat } = await env.DB.prepare(
    `SELECT categoria, COUNT(*) AS n, MIN(event_time) AS mais_antiga
       FROM meta_envios WHERE situacao = 'pendente' GROUP BY categoria`
  ).all();
  const egPend = await env.DB.prepare(
    `SELECT COUNT(*) AS n, MIN(occurred_at) AS mais_antiga FROM whatsapp_group_conversions WHERE status = 'pendente'`
  ).first().catch(() => null);
  const porCategoria = Object.fromEntries(pendCat.map((p) => [p.categoria || 'passageira', n(p.n)]));
  if (egPend && n(egPend.n)) porCategoria[EG] = n(egPend.n);
  const antigas = pendCat.map((p) => n(p.mais_antiga)).filter(Boolean);
  if (egPend?.mais_antiga) antigas.push(Math.floor(Date.parse(egPend.mais_antiga) / 1000));
  const maisAntiga = antigas.length ? Math.min(...antigas) : null;
  const pendentes = {
    total: Object.values(porCategoria).reduce((s, v) => s + v, 0),
    porCategoria,
    maisAntigaEm: maisAntiga,
    idadeMaisAntiga: maisAntiga ? agora - maisAntiga : null,
    expiram24h: metricas.expiram24h,
  };

  // --- última aceita, geral e por tipo ---
  const { results: ultimas } = await env.DB.prepare(
    `SELECT event_name AS tipo, MAX(aceita_em) AS ts FROM meta_envios WHERE aceita_em IS NOT NULL GROUP BY event_name`
  ).all();
  const egUlt = await env.DB.prepare(`SELECT MAX(enviado_em) AS ts FROM whatsapp_group_conversions WHERE status = 'enviada'`).first().catch(() => null);
  if (egUlt?.ts) ultimas.push({ tipo: EG, ts: egUlt.ts });
  const ultimaAceita = { geral: metricas.ultimaAceitaEm, porTipo: ultimas.sort((a, b) => b.ts - a.ts) };

  // --- rodadas e alertas ---
  const { results: rodadas } = await env.DB.prepare(
    `SELECT iniciada_em, aceitas, pendentes, falhas, expiradas, abortou_credencial
       FROM meta_reenvio_rodadas ORDER BY iniciada_em DESC LIMIT 10`
  ).all();
  const { results: alertas } = await env.DB.prepare(
    `SELECT tipo, condicoes, criado_em, entregue, erro FROM meta_alertas_log ORDER BY criado_em DESC LIMIT 15`
  ).all();

  // --- ativação e conversões sem situação ---
  const ativ = await env.DB.prepare('SELECT MIN(criado_em) AS ts FROM meta_envios').first();
  const ativacaoEm = ativ?.ts || null;
  let semSituacao = 0;
  if (ativacaoEm && ate > ativacaoEm) {
    // Eventos de conversão que foram ao Meta depois da ativação e não ganharam
    // situação (o registro falhou). Janela = período ∩ depois da ativação.
    const r = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM event_log e
        WHERE e.timestamp BETWEEN ? AND ? AND e.sent_to_meta = 1 AND e.is_bot = 0
          AND LOWER(e.event_name) NOT IN ('pageview', 'page_view', 'formstart', 'ctaclick', 'formstep')
          AND NOT EXISTS (SELECT 1 FROM meta_envios m WHERE m.origem = 'site' AND m.event_id = e.event_id)`
    ).bind(Math.max(de, ativacaoEm + 60), ate).first();
    semSituacao = n(r?.n);
  }

  return {
    agora,
    estado: { ...estado, condicoes },
    ultimaAceita,
    porTipo: { linhas, totais },
    diario,
    pendentes,
    captura: await capturaCliques(env, de, ate),
    rodadas,
    alertas,
    canalConfigurado: canalConfigurado(env),
    ativacaoEm,
    antesDaAtivacao: !ativacaoEm || de < ativacaoEm,
    semSituacao,
  };
}

// Visitas de anúncio com identificador de clique (issue 283). Mesma regra de
// canal do dash (utm_source=facebookads para o Meta); Google pela origem
// google/adwords com mídia paga. Bots fora pelas mesmas cláusulas do dash.
async function capturaCliques(env, de, ate) {
  const google = `LOWER(COALESCE(s.utm_source, '')) IN ('google', 'googleads', 'google-ads', 'adwords')
                  AND LOWER(COALESCE(s.utm_medium, '')) IN ('cpc', 'ppc', 'paid', 'paidsearch', 'paid_search', 'paid-search')`;
  const r = await env.DB.prepare(
    `SELECT SUM(LOWER(COALESCE(s.utm_source, '')) = 'facebookads') AS meta_visitas,
            SUM(LOWER(COALESCE(s.utm_source, '')) = 'facebookads' AND COALESCE(s.fbclid, '') <> '') AS meta_com,
            SUM(${google}) AS google_visitas,
            SUM(${google} AND COALESCE(s.gclid, '') <> '') AS google_com
       FROM sessions s
      WHERE s.created_at BETWEEN ? AND ?
        AND s.user_agent IS NOT NULL AND LENGTH(s.user_agent) >= 10
        ${clausulasBotSql('s')}
        ${clausulasBotIpSql('s')}`
  ).bind(de, ate).first();
  const n = (v) => Number(v) || 0;
  return {
    meta: { visitas: n(r?.meta_visitas), comId: n(r?.meta_com), taxa: taxa(n(r?.meta_com), n(r?.meta_visitas)) },
    google: { visitas: n(r?.google_visitas), comId: n(r?.google_com), taxa: taxa(n(r?.google_com), n(r?.google_visitas)) },
  };
}

// Lista de falhas definitivas (issue 281): meta_envios + EntrouGrupo, mais
// recentes primeiro, com filtros e paginação.
async function falhas(env, url, de, ate, agora) {
  const tipo = url.searchParams.get('tipo') || '';
  const categoria = url.searchParams.get('categoria') || '';
  const pagina = Math.max(1, Number(url.searchParams.get('pagina')) || 1);
  const limite = pagina * POR_PAGINA + 1;
  let linhas = [];

  if (tipo !== EG) {
    const filtros = [];
    const binds = [de, ate];
    if (tipo) { filtros.push('AND event_name = ?'); binds.push(tipo); }
    if (categoria) { filtros.push('AND categoria = ?'); binds.push(categoria); }
    const { results } = await env.DB.prepare(
      `SELECT id, origem, event_name AS tipo, event_time, referencia, tentativas, categoria, motivo, falhou_em,
              payload IS NOT NULL AS tem_payload
         FROM meta_envios
        WHERE situacao = 'falhou' AND event_time BETWEEN ? AND ? ${filtros.join(' ')}
        ORDER BY event_time DESC LIMIT ?`
    ).bind(...binds, limite).all();
    linhas = results.map((l) => ({
      ...l,
      podeTentarDeNovo: !!l.tem_payload && dentroDaJanela(l.event_time, agora),
      dicaTentar: !l.tem_payload ? 'Conteúdo original indisponível para reenvio.'
        : dentroDaJanela(l.event_time, agora) ? '' : 'O Meta não aceita mais este evento (mais de 6 dias).',
    }));
  }

  if (!tipo || tipo === EG) {
    const { results } = await env.DB.prepare(
      `SELECT id, occurred_at, tentativas, erro, criado_em FROM whatsapp_group_conversions
        WHERE status = 'falha' AND occurred_at BETWEEN ? AND ?
        ORDER BY occurred_at DESC LIMIT ?`
    ).bind(iso(de), iso(ate), limite).all().catch(() => ({ results: [] }));
    for (const l of results) {
      const cat = categoriaEntrouGrupo(l);
      if (categoria && categoria !== cat) continue;
      linhas.push({
        id: l.id, origem: 'grupo', tipo: EG, event_time: Math.floor(Date.parse(l.occurred_at) / 1000),
        referencia: 'entrada no grupo de WhatsApp', tentativas: l.tentativas, categoria: cat,
        motivo: cat === 'expirou' ? MOTIVOS.expirou : (l.erro || 'Falha no envio ao Meta.'),
        falhou_em: null, podeTentarDeNovo: false, dicaTentar: 'O EntrouGrupo tem fila própria.',
      });
    }
  }

  linhas.sort((a, b) => b.event_time - a.event_time);
  const inicio = (pagina - 1) * POR_PAGINA;
  return {
    pagina,
    temProxima: linhas.length > inicio + POR_PAGINA,
    linhas: linhas.slice(inicio, inicio + POR_PAGINA).map(({ tem_payload, ...l }) => l),
  };
}

async function detalhe(env, url) {
  const origem = url.searchParams.get('origem');
  const id = Number(url.searchParams.get('id'));
  if (!id) return { error: 'Falha não encontrada.' };
  if (origem === 'grupo') {
    const l = await env.DB.prepare('SELECT event_id, erro, tentativas, occurred_at FROM whatsapp_group_conversions WHERE id = ?').bind(id).first();
    return l ? { eventId: l.event_id, ultimaResposta: l.erro || '', ultimoStatus: null } : { error: 'Falha não encontrada.' };
  }
  const l = await env.DB.prepare('SELECT event_id, ultima_resposta, ultimo_status FROM meta_envios WHERE id = ?').bind(id).first();
  return l ? { eventId: l.event_id, ultimaResposta: l.ultima_resposta || '', ultimoStatus: l.ultimo_status } : { error: 'Falha não encontrada.' };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) return json({ error: 'Unauthorized' }, 401);
  if (!env.DB) return json({ error: 'DB unavailable' }, 500);
  const corpo = await request.json().catch(() => ({}));
  const agora = Math.floor(Date.now() / 1000);

  if (corpo.acao === 'alerta-teste') {
    const r = await enviarTeste(env, agora);
    return json(r.ok ? { ok: true, mensagem: 'Mensagem de teste entregue no Slack.' } : { ok: false, error: r.erro }, r.ok ? 200 : 502);
  }

  if (corpo.acao === 'tentar-de-novo') {
    const id = Number(corpo.id);
    const l = id ? await env.DB.prepare('SELECT situacao, event_time, payload IS NOT NULL AS tem FROM meta_envios WHERE id = ?').bind(id).first() : null;
    if (!l || l.situacao !== 'falhou') return json({ error: 'Esta falha não existe mais ou já voltou para a fila.' }, 404);
    if (!dentroDaJanela(l.event_time, agora)) return json({ error: 'O Meta não aceita mais este evento (mais de 6 dias).' }, 400);
    if (!l.tem) return json({ error: 'Conteúdo original indisponível para reenvio.' }, 400);
    await env.DB.prepare(
      `UPDATE meta_envios
          SET situacao = 'pendente', tentativas = 0, proxima_tentativa_em = ?, falhou_em = NULL,
              motivo = 'Devolvida para a fila manualmente.', em_envio_ate = NULL
        WHERE id = ? AND situacao = 'falhou' AND event_time >= ?`
    ).bind(agora, id, agora - JANELA_SEGUNDOS).run();
    return json({ ok: true, mensagem: 'Devolvida para a fila: vai na próxima rodada, em até 15 minutos.' });
  }

  return json({ error: 'Ação desconhecida.' }, 400);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
