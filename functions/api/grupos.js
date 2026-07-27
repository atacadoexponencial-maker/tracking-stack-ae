// GET /api/grupos?from=<unix>&to=<unix>&key=...
//
// Entradas e saídas nos grupos de WhatsApp monitorados, para a aba "Grupos" do
// dash. Lê SÓ do D1 (whatsapp_group_events / whatsapp_groups_tracked /
// whatsapp_groups_seen), alimentado por /api/webhooks/whatsapp-grupo. Nunca fala
// com a Evolution — quem faz isso é /api/grupos-conexao, em requisição separada.
//
// Séries, totais, saldos e recordes saem prontos daqui: o dash só formata.

import { diaLocalDeUnix } from './webhooks/_classificar.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const agora = Math.floor(Date.now() / 1000);
  const de = Number(url.searchParams.get('from')) || (agora - 30 * 86400);
  const ate = Number(url.searchParams.get('to')) || agora;
  const diaDe = diaLocalDeUnix(de);
  const diaAte = diaLocalDeUnix(ate);

  const { results: grupos } = await env.DB.prepare(
    `SELECT group_jid, label FROM whatsapp_groups_tracked WHERE enabled = 1 ORDER BY label`
  ).all();

  const { results: porDia } = await env.DB.prepare(
    `SELECT e.group_jid, e.day_local,
            SUM(CASE WHEN e.action = 'entrou'   THEN 1 ELSE 0 END) AS entradas,
            SUM(CASE WHEN e.action = 'saiu'     THEN 1 ELSE 0 END) AS saidas,
            SUM(CASE WHEN e.action = 'removido' THEN 1 ELSE 0 END) AS removidos
       FROM whatsapp_group_events e
       JOIN whatsapp_groups_tracked t
         ON t.group_jid = e.group_jid AND t.enabled = 1
      WHERE e.day_local BETWEEN ? AND ?
      GROUP BY e.group_jid, e.day_local`
  ).bind(diaDe, diaAte).all();

  const { results: recentes } = await env.DB.prepare(
    `SELECT t.label, e.participant_jid, e.action, e.occurred_at
       FROM whatsapp_group_events e
       JOIN whatsapp_groups_tracked t
         ON t.group_jid = e.group_jid AND t.enabled = 1
      WHERE e.day_local BETWEEN ? AND ?
      ORDER BY e.occurred_at DESC
      LIMIT 100`
  ).bind(diaDe, diaAte).all();

  const { results: naoMonitorados } = await env.DB.prepare(
    `SELECT s.group_jid, s.events, s.last_event_at
       FROM whatsapp_groups_seen s
       LEFT JOIN whatsapp_groups_tracked t ON t.group_jid = s.group_jid
      WHERE t.group_jid IS NULL
      ORDER BY s.events DESC
      LIMIT 20`
  ).all();

  const ultimo = await env.DB.prepare(
    `SELECT MAX(occurred_at) AS quando FROM whatsapp_group_events`
  ).first();

  // Dias sem evento precisam existir com zero: buraco na série faria o gráfico
  // ligar dois pontos distantes como se o período no meio não existisse.
  const dias = listarDias(diaDe, diaAte);
  const porGrupo = {};
  for (const r of (porDia || [])) {
    (porGrupo[r.group_jid] = porGrupo[r.group_jid] || {})[r.day_local] = r;
  }

  const saida = (grupos || []).map((g) => {
    const mapa = porGrupo[g.group_jid] || {};
    const serie = dias.map((d) => ({
      d,
      entradas: Number(mapa[d]?.entradas || 0),
      saidas: Number(mapa[d]?.saidas || 0),
    }));
    const entradas = serie.reduce((a, p) => a + p.entradas, 0);
    const saidas = serie.reduce((a, p) => a + p.saidas, 0);
    const removidos = dias.reduce((a, d) => a + Number(mapa[d]?.removidos || 0), 0);
    return {
      group_jid: g.group_jid,
      label: g.label,
      entradas, saidas, removidos,
      saldo: entradas - saidas - removidos,
      serie,
      dia_top_entradas: recorde(serie, 'entradas'),
      dia_top_saidas: recorde(serie, 'saidas'),
    };
  });

  return json({
    grupos: saida,
    recentes: recentes || [],
    nao_monitorados: naoMonitorados || [],
    ultimo_evento_em: ultimo?.quando || null,
  });
}

// Todos os dias entre duas datas 'YYYY-MM-DD', inclusive. Usa UTC para andar de
// dia em dia porque as datas já vêm convertidas para o fuso local.
function listarDias(diaDe, diaAte) {
  const dias = [];
  let atual = Date.parse(diaDe + 'T00:00:00Z');
  const fim = Date.parse(diaAte + 'T00:00:00Z');
  if (!Number.isFinite(atual) || !Number.isFinite(fim) || fim < atual) return dias;
  while (atual <= fim) {
    dias.push(new Date(atual).toISOString().slice(0, 10));
    atual += 86400000;
  }
  return dias;
}

// Dia de maior valor. Empate fica com o mais recente; período sem nenhum evento
// devolve null em vez de um "dia recorde" com zero, que seria mentira.
function recorde(serie, campo) {
  let melhor = null;
  for (const p of serie) {
    if (p[campo] > 0 && (!melhor || p[campo] >= melhor.n)) melhor = { d: p.d, n: p[campo] };
  }
  return melhor;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
