// Contatos de marketing (spec-email-proprio.md, módulo 4; issue 380).
//
// Os contatos são os leads do tracking (formulários das LPs), um por e-mail.
// Entram por dois caminhos que se completam:
//   - na hora, pelo /tracker (registrarLead, com o nome do formulário);
//   - pela rodada /api/sync/email-contatos, que lê o event_log por um cursor
//     (primeira carga dos antigos e rede de segurança se a gravação na hora
//     falhar) e busca no ClickUp o nome de quem ficou sem.
//
// Situação: ativo | invalido | descadastrado | voltou | denunciou. Só "ativo"
// recebe marketing (a regra de envio é da 382).
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.
import { emailValido } from './_email-config.js';
import { canalDeLead } from './_canal.js';
import { STREAMS, criarSupressao, apagarSupressao } from './_postmark.js';
import { clickupFetch, CU_FIELD } from './_clickup.js';
import { clausulasBotIpSql } from '../_bots.js';

const agora = () => Math.floor(Date.now() / 1000);
const POR_PAGINA = 50;
const CURSOR = 'email_contatos_cursor';

export const SITUACOES = ['ativo', 'invalido', 'descadastrado', 'voltou', 'denunciou'];
// Peso de cada situação: um resultado só sobe, nunca rebaixa (denunciou não
// vira descadastrado; descadastrado não vira voltou).
const GRAVIDADE = { ativo: 0, invalido: 0, voltou: 1, descadastrado: 2, denunciou: 3 };
const pesoSql = `CASE situacao ${Object.entries(GRAVIDADE).map(([s, g]) => `WHEN '${s}' THEN ${g}`).join(' ')} ELSE 0 END`;
/** Resultado do Postmark → situação do contato. */
const DO_RESULTADO = { voltou: 'voltou', spam: 'denunciou', descadastrou: 'descadastrado' };

export class ErroContato extends Error {
  constructor(mensagem, status = 400) { super(mensagem); this.status = status; }
}

export const normalizarEmail = (v) => String(v || '').trim().toLowerCase();

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

/**
 * Cria ou junta o contato de um lead e registra a entrada (o formulário).
 * Devolve o id do contato, ou null quando o lead não tem e-mail.
 */
export async function registrarLead(env, { email, nome = '', funil = '', material = '', origem = '', eventId, quando = agora() }) {
  const e = normalizarEmail(email);
  if (!e) return null;
  const n = String(nome || '').trim().slice(0, 200);
  const t = agora();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO email_contatos
       (email, nome, funil, origem, situacao, situacao_em, situacao_por, nome_buscado, entrou_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, 'sistema', ?, ?, ?)`,
  ).bind(e, n || null, funil || null, origem || null, emailValido(e) ? 'ativo' : 'invalido', quando, n ? 1 : 0, quando, t).run();
  const c = await env.DB.prepare('SELECT * FROM email_contatos WHERE email = ?').bind(e).first();

  // Entrada mais antiga que a primeira conhecida (a carga chegou depois da
  // gravação na hora): ela passa a ser a primeira.
  if (quando < c.entrou_em) {
    await env.DB.prepare('UPDATE email_contatos SET entrou_em = ?, funil = ?, origem = ?, atualizado_em = ? WHERE id = ?')
      .bind(quando, funil || null, origem || null, t, c.id).run();
  }
  // O formulário mais novo atualiza o nome.
  if (n && n !== c.nome) {
    await env.DB.prepare('UPDATE email_contatos SET nome = ?, nome_buscado = 1, atualizado_em = ? WHERE id = ?').bind(n, t, c.id).run();
  }
  // Quem se descadastrou e preencheu um formulário DEPOIS volta a ser ativo:
  // é a própria pessoa cadastrando de novo. Denunciou e voltou não voltam.
  if (c.situacao === 'descadastrado' && quando > (c.situacao_em || 0)) {
    await env.DB.prepare("UPDATE email_contatos SET situacao = 'ativo', situacao_em = ?, situacao_por = 'lead', atualizado_em = ? WHERE id = ?")
      .bind(quando, t, c.id).run();
    try {
      const r = await apagarSupressao(env, STREAMS.marketing, e);
      if (!r.ok) console.error('contatos: supressão não apagada', r.erro);
    } catch (err) {
      console.error('contatos: supressão não apagada', err.message);
    }
  }
  if (eventId) {
    await env.DB.prepare(
      'INSERT OR IGNORE INTO email_contatos_entradas (contato_id, event_id, funil, origem, material, entrou_em) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(c.id, String(eventId), funil || null, origem || null, material || null, quando).run();
  }
  return c.id;
}

async function lerCursor(env) {
  const r = await env.DB.prepare('SELECT valor FROM config_kv WHERE chave = ?').bind(CURSOR).first();
  return r ? Number(r.valor) || 0 : 0;
}

async function gravarCursor(env, valor) {
  await env.DB.prepare('INSERT INTO config_kv (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor')
    .bind(CURSOR, String(valor)).run();
}

/**
 * Lê os leads do event_log depois do cursor (primeira carga e rede de
 * segurança). Fica de fora: robô (user-agent e IP), lead bloqueado e teste
 * interno antigo (is_junk). Devolve { lidos, cursor }.
 */
export async function carregarDoTracking(env, { limite = 150 } = {}) {
  const cursor = await lerCursor(env);
  // O teto é lido ANTES: um lead que chegar durante a rodada fica para a próxima.
  const teto = (await env.DB.prepare('SELECT MAX(id) AS m FROM event_log').first())?.m || 0;
  const rows = (await env.DB.prepare(
    `SELECT e.id, e.event_id, e.timestamp, e.raw_email, e.material,
            COALESCE(NULLIF(e.funnel, ''), s.funnel) AS funil, s.utm_source, s.utm_campaign
       FROM event_log e
       LEFT JOIN sessions s ON s.session_id = e.session_id
      WHERE e.event_name = 'Lead' AND e.id > ? AND e.id <= ?
        AND e.is_bot = 0 AND e.is_junk = 0 AND COALESCE(e.raw_email, '') <> ''
        AND e.event_id NOT IN (SELECT event_id FROM leads_bloqueados)
        ${clausulasBotIpSql('s')}
      ORDER BY e.id LIMIT ?`,
  ).bind(cursor, teto, limite).all()).results || [];
  for (const l of rows) {
    await registrarLead(env, {
      email: l.raw_email, funil: l.funil || '', material: l.material || '',
      origem: canalDeLead({ material: l.material, utm_source: l.utm_source, utm_campaign: l.utm_campaign }),
      eventId: l.event_id, quando: l.timestamp,
    });
  }
  const novo = rows.length < limite ? teto : rows[rows.length - 1].id;
  if (novo !== cursor) await gravarCursor(env, novo);
  return { lidos: rows.length, cursor: novo };
}

/** Nome de quem ficou sem, pelo card do ClickUp (campo "Nome"). Devolve quantos achou. */
export async function preencherNomes(env, { limite = 20 } = {}) {
  if (!env.CLICKUP_API_TOKEN) return 0;
  const sem = (await env.DB.prepare(
    `SELECT c.id,
            (SELECT d.task_id FROM lead_dispatch d WHERE lower(d.email) = c.email AND d.task_id IS NOT NULL ORDER BY d.id DESC LIMIT 1) AS task
       FROM email_contatos c
      WHERE COALESCE(c.nome, '') = '' AND c.nome_buscado = 0
      ORDER BY c.id LIMIT ?`,
  ).bind(limite).all()).results || [];
  let achados = 0;
  for (const c of sem) {
    let nome = '';
    if (c.task) {
      let res;
      try {
        res = await clickupFetch(`/task/${encodeURIComponent(c.task)}`, { method: 'GET' }, env);
      } catch {
        break; // ClickUp fora do ar: tenta na próxima rodada
      }
      if (res.status === 429 || res.status >= 500 || res.status === 401) break;
      if (res.ok) {
        const task = await res.json();
        const campo = (task.custom_fields || []).find((f) => f.id === CU_FIELD.nome);
        nome = String(campo?.value || (!/@/.test(task.name || '') ? task.name : '') || '').trim().slice(0, 200);
      }
    }
    await env.DB.prepare('UPDATE email_contatos SET nome = COALESCE(NULLIF(?, \'\'), nome), nome_buscado = 1, atualizado_em = ? WHERE id = ?')
      .bind(nome, agora(), c.id).run();
    if (nome) achados++;
  }
  return achados;
}

// ---------------------------------------------------------------------------
// Resultados e ações da equipe
// ---------------------------------------------------------------------------

/** voltou / spam / descadastrou do Postmark → situação do contato (só sobe). */
export async function aplicarResultado(env, email, tipo, quando = agora()) {
  const situacao = DO_RESULTADO[tipo];
  const e = normalizarEmail(email);
  if (!situacao || !e) return;
  await env.DB.prepare(
    `UPDATE email_contatos SET situacao = ?, situacao_em = ?, situacao_por = 'servico', atualizado_em = ?
      WHERE email = ? AND ${pesoSql} < ?`,
  ).bind(situacao, quando || agora(), agora(), e, GRAVIDADE[situacao]).run();
}

async function lerContato(env, id) {
  const c = Number.isInteger(Number(id)) && Number(id) > 0
    ? await env.DB.prepare('SELECT * FROM email_contatos WHERE id = ?').bind(Number(id)).first()
    : null;
  if (!c) throw new ErroContato('Contato não encontrado.', 404);
  return c;
}

/**
 * Descadastro a pedido da pessoa: marca aqui (é o que barra os envios do
 * dash) e cria a supressão no marketing do Postmark. Devolve { contato, aviso }.
 */
export async function descadastrar(env, id) {
  const c = await lerContato(env, id);
  if (c.situacao === 'denunciou') throw new ErroContato('Este contato denunciou spam e já não recebe marketing.', 409);
  if (c.situacao !== 'descadastrado') {
    const t = agora();
    await env.DB.prepare("UPDATE email_contatos SET situacao = 'descadastrado', situacao_em = ?, situacao_por = 'equipe', atualizado_em = ? WHERE id = ?")
      .bind(t, t, c.id).run();
  }
  let aviso = null;
  try {
    const r = await criarSupressao(env, STREAMS.marketing, c.email);
    if (!r.ok) aviso = `Descadastrado no dash; o serviço de envio não confirmou a supressão (${r.erro}). Tente de novo.`;
  } catch {
    aviso = 'Descadastrado no dash; o serviço de envio não confirmou a supressão. Tente de novo.';
  }
  return { contato: await lerContato(env, c.id), aviso };
}

/** Reativa quem "voltou" por engano: apaga a supressão nos dois canais e volta a ativo. */
export async function reativar(env, id) {
  const c = await lerContato(env, id);
  if (c.situacao !== 'voltou') {
    throw new ErroContato('Só dá para reativar quem voltou. Quem se descadastrou ou denunciou só volta preenchendo um formulário de novo.', 409);
  }
  try {
    for (const stream of Object.values(STREAMS)) {
      const r = await apagarSupressao(env, stream, c.email);
      if (!r.ok) throw new ErroContato(r.erro, 502);
    }
  } catch (e) {
    if (e instanceof ErroContato) throw e;
    throw new ErroContato('Não foi possível falar com o serviço de envio agora. Tente de novo.', 504);
  }
  const t = agora();
  await env.DB.prepare("UPDATE email_contatos SET situacao = 'ativo', situacao_em = ?, situacao_por = 'equipe', atualizado_em = ? WHERE id = ?")
    .bind(t, t, c.id).run();
  return lerContato(env, c.id);
}

// ---------------------------------------------------------------------------
// Leitura para o dash
// ---------------------------------------------------------------------------

/** Lista com busca, filtros, página e totais. */
export async function listar(env, { busca = '', situacao = '', origem = '', funil = '', pagina = 1 } = {}) {
  const onde = [];
  const binds = [];
  const b = String(busca || '').trim().toLowerCase();
  if (b) { onde.push("(c.email LIKE ? OR lower(COALESCE(c.nome, '')) LIKE ?)"); binds.push(`%${b}%`, `%${b}%`); }
  if (SITUACOES.includes(situacao)) { onde.push('c.situacao = ?'); binds.push(situacao); }
  if (origem) { onde.push('c.origem = ?'); binds.push(String(origem)); }
  if (funil) { onde.push('EXISTS (SELECT 1 FROM email_contatos_entradas en WHERE en.contato_id = c.id AND en.funil = ?)'); binds.push(String(funil)); }
  const where = onde.length ? `WHERE ${onde.join(' AND ')}` : '';
  const p = Math.max(1, Math.floor(Number(pagina)) || 1);
  const [linhas, filtrado, totais, funis, origens] = await Promise.all([
    env.DB.prepare(
      `SELECT c.id, c.email, c.nome, c.funil, c.origem, c.situacao, c.situacao_em, c.entrou_em
         FROM email_contatos c ${where} ORDER BY c.entrou_em DESC, c.id DESC LIMIT ? OFFSET ?`,
    ).bind(...binds, POR_PAGINA, (p - 1) * POR_PAGINA).all(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM email_contatos c ${where}`).bind(...binds).first(),
    env.DB.prepare("SELECT COUNT(*) AS geral, SUM(CASE WHEN situacao = 'ativo' THEN 1 ELSE 0 END) AS ativos FROM email_contatos").first(),
    env.DB.prepare("SELECT DISTINCT funil FROM email_contatos_entradas WHERE COALESCE(funil, '') <> '' ORDER BY funil").all(),
    env.DB.prepare("SELECT DISTINCT origem FROM email_contatos WHERE COALESCE(origem, '') <> '' ORDER BY origem").all(),
  ]);
  return {
    contatos: linhas.results || [],
    total: filtrado?.n || 0,
    pagina: p,
    por_pagina: POR_PAGINA,
    totais: { ativos: totais?.ativos || 0, geral: totais?.geral || 0 },
    funis: (funis.results || []).map((x) => x.funil),
    origens: (origens.results || []).map((x) => x.origem),
  };
}

/** Detalhe: dados, entradas e histórico de e-mails recebidos. */
export async function detalhe(env, id) {
  const c = await lerContato(env, id);
  const [entradas, envios] = await Promise.all([
    env.DB.prepare('SELECT funil, origem, material, entrou_em FROM email_contatos_entradas WHERE contato_id = ? ORDER BY entrou_em DESC').bind(c.id).all(),
    env.DB.prepare(
      `SELECT id, canal, origem, assunto, situacao, erro, enviado_em, entregue_em, aberto_em, clicado_em, voltou_em, spam_em, descadastrou_em
         FROM email_envios WHERE lower(destinatario) = ? ORDER BY id DESC LIMIT 100`,
    ).bind(c.email).all(),
  ]);
  return { contato: c, entradas: entradas.results || [], envios: envios.results || [] };
}
