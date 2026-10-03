// Relatório de campanha e visão geral do canal (spec-email-proprio.md, módulo 7; issue 384).
//
// Tudo sai de email_envios (um por pessoa e campanha, preenchido pelo webhook
// da 377) e de email_eventos (link clicado, tipo de devolução). Como cada
// pessoa recebe um envio por campanha, aberturas e cliques já são de pessoas
// únicas.
//
// Reputação: o Postmark exige spam abaixo de 0,1% e devolução abaixo de 10%
// (acima disso pode suspender a conta); a devolução saudável, segundo ele, é
// "bem abaixo de 5%". O alerta sai antes do limite: spam acima de 0,1% ou
// devolução acima de 5%, nos últimos 30 dias, por canal, com volume mínimo.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.
import { ErroCampanha, detalheCampanha, usoDoMes } from './_email-campanhas.js';
import { ymdBrt, inicioDoDiaBrt } from './_data-brt.js';

const agora = () => Math.floor(Date.now() / 1000);
const POR_PAGINA = 50;
export const LIMITE_SPAM = 0.001;
export const LIMITE_DEVOLUCAO = 0.05;
const VOLUME_MINIMO = 100;
const JANELA_REPUTACAO = 30 * 86400;

const taxa = (a, b) => (b ? a / b : null);
const NUMEROS = `COUNT(*) AS linhas,
  SUM(CASE WHEN message_id IS NOT NULL THEN 1 ELSE 0 END) AS enviados,
  SUM(CASE WHEN entregue_em IS NOT NULL THEN 1 ELSE 0 END) AS entregues,
  SUM(CASE WHEN aberto_em IS NOT NULL THEN 1 ELSE 0 END) AS abertos,
  SUM(CASE WHEN clicado_em IS NOT NULL THEN 1 ELSE 0 END) AS clicados,
  SUM(CASE WHEN voltou_em IS NOT NULL THEN 1 ELSE 0 END) AS voltaram,
  SUM(CASE WHEN spam_em IS NOT NULL THEN 1 ELSE 0 END) AS spam,
  SUM(CASE WHEN descadastrou_em IS NOT NULL THEN 1 ELSE 0 END) AS descadastros`;

function comTaxas(n) {
  const x = Object.fromEntries(['enviados', 'entregues', 'abertos', 'clicados', 'voltaram', 'spam', 'descadastros'].map((k) => [k, n?.[k] || 0]));
  return {
    ...x,
    taxas: {
      entrega: taxa(x.entregues, x.enviados),
      abertura: taxa(x.abertos, x.entregues),
      clique: taxa(x.clicados, x.entregues),
      clique_sobre_abertura: taxa(x.clicados, x.abertos),
      devolucao: taxa(x.voltaram, x.enviados),
      spam: taxa(x.spam, x.entregues),
      descadastro: taxa(x.descadastros, x.entregues),
    },
  };
}

// ---------------------------------------------------------------------------
// Campanha
// ---------------------------------------------------------------------------

const SEM_RELATORIO = ['rascunho', 'agendada', 'cancelada'];

export async function relatorioCampanha(env, id) {
  const c = await detalheCampanha(env, id);
  if (SEM_RELATORIO.includes(c.situacao)) throw new ErroCampanha('Esta campanha ainda não saiu: não tem relatório.', 409);
  const [n, links] = await Promise.all([
    env.DB.prepare(`SELECT ${NUMEROS} FROM email_envios WHERE origem = 'campanha' AND ref_id = ?`).bind(String(c.id)).first(),
    env.DB.prepare(
      `SELECT json_extract(ev.detalhe_json, '$.link') AS link, COUNT(DISTINCT ev.envio_id) AS pessoas
         FROM email_eventos ev JOIN email_envios e ON e.id = ev.envio_id
        WHERE e.origem = 'campanha' AND e.ref_id = ? AND ev.tipo = 'clicado' AND json_extract(ev.detalhe_json, '$.link') IS NOT NULL
        GROUP BY link ORDER BY pessoas DESC, link LIMIT 20`,
    ).bind(String(c.id)).all(),
  ]);
  return { campanha: c, destinatarios: c.total, ...comTaxas(n), links: links.results || [] };
}

const COLUNA_LISTA = { abriram: 'aberto_em', clicaram: 'clicado_em', voltaram: 'voltou_em', descadastraram: 'descadastrou_em' };

/** Quem abriu, clicou, voltou ou se descadastrou (mais recentes primeiro). */
export async function pessoasDaCampanha(env, id, filtro, pagina = 1) {
  const c = await detalheCampanha(env, id);
  const col = COLUNA_LISTA[filtro];
  if (!col) throw new ErroCampanha('Escolha quem ver: abriram, clicaram, voltaram ou descadastraram.');
  const p = Math.max(1, Math.floor(Number(pagina)) || 1);
  const detalhe = filtro === 'clicaram'
    ? "(SELECT json_extract(ev.detalhe_json, '$.link') FROM email_eventos ev WHERE ev.envio_id = e.id AND ev.tipo = 'clicado' ORDER BY ev.ocorrido_em, ev.id LIMIT 1)"
    : filtro === 'voltaram'
      ? "(SELECT json_extract(ev.detalhe_json, '$.tipo_devolucao') FROM email_eventos ev WHERE ev.envio_id = e.id AND ev.tipo = 'voltou' ORDER BY ev.ocorrido_em, ev.id LIMIT 1)"
      : 'NULL';
  const [linhas, total] = await Promise.all([
    env.DB.prepare(
      `SELECT e.destinatario AS email, e.${col} AS quando, ${detalhe} AS detalhe, ct.id AS contato_id, ct.nome
         FROM email_envios e LEFT JOIN email_contatos ct ON ct.email = lower(e.destinatario)
        WHERE e.origem = 'campanha' AND e.ref_id = ? AND e.${col} IS NOT NULL
        ORDER BY e.${col} DESC, e.id DESC LIMIT ? OFFSET ?`,
    ).bind(String(c.id), POR_PAGINA, (p - 1) * POR_PAGINA).all(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM email_envios WHERE origem = 'campanha' AND ref_id = ? AND ${col} IS NOT NULL`).bind(String(c.id)).first(),
  ]);
  return { filtro, pessoas: linhas.results || [], total: total?.n || 0, pagina: p, por_pagina: POR_PAGINA };
}

// ---------------------------------------------------------------------------
// Visão geral do canal
// ---------------------------------------------------------------------------

function inicioDoMes(t) {
  return inicioDoDiaBrt(`${ymdBrt(t).slice(0, 8)}01`);
}

/** Recorte do período: mes (até agora), mes-passado ou 90 (últimos 90 dias). */
export function recorte(periodo, t = agora()) {
  const mes = inicioDoMes(t);
  if (periodo === 'mes-passado') return { periodo, de: inicioDoMes(mes - 86400), ate: mes };
  if (periodo === '90') return { periodo, de: t - 90 * 86400, ate: t + 1 };
  return { periodo: 'mes', de: mes, ate: t + 1 };
}

/** Uso do mês com a parte de cada canal e a projeção para o fim do mês. */
async function usoComProjecao(env, t) {
  const uso = await usoDoMes(env, t);
  const de = inicioDoMes(t);
  const r = (await env.DB.prepare('SELECT canal, COUNT(*) AS n FROM email_envios WHERE message_id IS NOT NULL AND enviado_em >= ? GROUP BY canal').bind(de).all()).results || [];
  const ymd = ymdBrt(t);
  const dia = Number(ymd.slice(8, 10));
  const diasNoMes = new Date(Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)), 0)).getUTCDate();
  return {
    ...uso,
    por_canal: Object.fromEntries(r.map((x) => [x.canal, x.n])),
    projecao: Math.round((uso.usados / Math.max(1, dia)) * diasNoMes),
    renova: `01/${String(Number(ymd.slice(5, 7)) % 12 + 1).padStart(2, '0')}`,
  };
}

export async function visaoCanal(env, periodo, t = agora()) {
  const p = recorte(periodo, t);
  const onde = "message_id IS NOT NULL AND origem <> 'teste' AND enviado_em >= ? AND enviado_em < ?";
  const [porCanal, campanhas, uso, rep] = await Promise.all([
    env.DB.prepare(`SELECT canal, ${NUMEROS} FROM email_envios WHERE ${onde} GROUP BY canal`).bind(p.de, p.ate).all(),
    env.DB.prepare(
      `SELECT c.id, c.nome, c.disparada_em, c.situacao, ${NUMEROS.replace(/\b(message_id|entregue_em|aberto_em|clicado_em|voltou_em|spam_em|descadastrou_em)\b/g, 'e.$1')}
         FROM email_campanhas c JOIN email_envios e ON e.origem = 'campanha' AND e.ref_id = CAST(c.id AS TEXT)
        WHERE c.disparada_em >= ? AND c.disparada_em < ? GROUP BY c.id ORDER BY c.disparada_em DESC`,
    ).bind(p.de, p.ate).all(),
    usoComProjecao(env, t),
    reputacao(env, t),
  ]);
  const canais = Object.fromEntries((porCanal.results || []).map((x) => [x.canal, comTaxas(x)]));
  const soma = (k) => Object.values(canais).reduce((s, x) => s + x[k], 0);
  const mkt = canais.marketing || comTaxas({});
  return {
    ...p,
    enviados: soma('enviados'),
    entregues: soma('entregues'),
    taxas: {
      entrega: taxa(soma('entregues'), soma('enviados')),
      spam: taxa(soma('spam'), soma('entregues')),
      devolucao: taxa(soma('voltaram'), soma('enviados')),
      descadastro: taxa(mkt.descadastros, mkt.entregues), // só o marketing tem descadastro
    },
    canais,
    campanhas: (campanhas.results || []).map((x) => ({ id: x.id, nome: x.nome, disparada_em: x.disparada_em, situacao: x.situacao, ...comTaxas(x) })),
    uso,
    reputacao: rep,
  };
}

// ---------------------------------------------------------------------------
// Reputação
// ---------------------------------------------------------------------------

const NOME_CANAL = { marketing: 'Marketing', transacional: 'Transacional' };
const pctTxt = (v, c) => `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c })}%`;

/**
 * Taxas de spam e devolução dos últimos 30 dias por canal (sobre os e-mails
 * que saíram, como o Postmark mede) e os itens do alerta.
 */
export async function reputacao(env, t = agora()) {
  try {
    const r = (await env.DB.prepare(
      `SELECT canal, COUNT(*) AS enviados,
              SUM(CASE WHEN spam_em IS NOT NULL THEN 1 ELSE 0 END) AS spam,
              SUM(CASE WHEN voltou_em IS NOT NULL THEN 1 ELSE 0 END) AS voltaram
         FROM email_envios WHERE message_id IS NOT NULL AND enviado_em >= ? GROUP BY canal ORDER BY canal`,
    ).bind(t - JANELA_REPUTACAO).all()).results || [];
    const canais = r.map((x) => {
      const spam = taxa(x.spam, x.enviados) || 0;
      const devolucao = taxa(x.voltaram, x.enviados) || 0;
      const volume = x.enviados >= VOLUME_MINIMO;
      return { canal: x.canal, enviados: x.enviados, spam, devolucao, spam_acima: volume && spam > LIMITE_SPAM, devolucao_acima: volume && devolucao > LIMITE_DEVOLUCAO };
    });
    const itens = [];
    for (const c of canais) {
      if (c.spam_acima) itens.push(`${NOME_CANAL[c.canal] || c.canal}: spam ${pctTxt(c.spam, 2)} nos últimos 30 dias (limite ${pctTxt(LIMITE_SPAM, 2)})`);
      if (c.devolucao_acima) itens.push(`${NOME_CANAL[c.canal] || c.canal}: devolução ${pctTxt(c.devolucao, 1)} nos últimos 30 dias (alerta a partir de ${pctTxt(LIMITE_DEVOLUCAO, 0)}; o serviço suspende em 10%)`);
    }
    return { canais, itens };
  } catch {
    return { canais: [], itens: [] }; // migration 0050 ainda não aplicada
  }
}
