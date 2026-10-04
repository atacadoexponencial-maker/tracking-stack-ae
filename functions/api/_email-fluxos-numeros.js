// Números dos fluxos e histórico do contato (spec-email-proprio.md, módulos 4 e 9; issue 388).
//
// Tudo sai do caminho de cada pessoa (email_fluxo_passos, gravado pelo motor)
// e da entrega de cada e-mail (email_envios, atualizado pelo webhook). Cada
// pessoa passa no máximo uma vez por cartão de e-mail, então recebidos,
// abertos e clicados já são de pessoas únicas.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.
import { ErroFluxo } from './_email-fluxos.js';

const agora = () => Math.floor(Date.now() / 1000);
const POR_PAGINA = 100;
const DESDE = { 7: 7 * 86400, 30: 30 * 86400 };

async function fluxo(env, id) {
  const f = Number.isInteger(Number(id)) && Number(id) > 0
    ? await env.DB.prepare('SELECT id, situacao, publicado_json FROM email_fluxos WHERE id = ?').bind(Number(id)).first()
    : null;
  if (!f) throw new ErroFluxo('Fluxo não encontrado.', 404);
  return f;
}

/** Números por cartão da versão no ar, no período (7, 30 ou desde o início). */
export async function numerosDoFluxo(env, id, periodo = '30', t = agora()) {
  const f = await fluxo(env, id);
  if (!f.publicado_json) return { periodo, cartoes: {} };
  const desde = DESDE[periodo] ? t - DESDE[periodo] : 0;
  const [passos, emails, agoraDentro] = await Promise.all([
    env.DB.prepare(
      `SELECT no_id, tipo, saida, COUNT(DISTINCT pessoa_id) AS n FROM email_fluxo_passos
        WHERE fluxo_id = ? AND em >= ? GROUP BY no_id, tipo, saida`,
    ).bind(f.id, desde).all(),
    env.DB.prepare(
      `SELECT p.no_id, COUNT(*) AS receberam,
              SUM(CASE WHEN e.aberto_em IS NOT NULL THEN 1 ELSE 0 END) AS abriram,
              SUM(CASE WHEN e.clicado_em IS NOT NULL THEN 1 ELSE 0 END) AS clicaram
         FROM email_fluxo_passos p JOIN email_envios e ON e.id = p.envio_id
        WHERE p.fluxo_id = ? AND p.tipo = 'email' AND p.em >= ? AND e.message_id IS NOT NULL GROUP BY p.no_id`,
    ).bind(f.id, desde).all(),
    env.DB.prepare("SELECT no_atual, situacao, COUNT(*) AS n FROM email_fluxo_pessoas WHERE fluxo_id = ? AND situacao IN ('andando', 'esperando') GROUP BY no_atual, situacao").bind(f.id).all(),
  ]);
  const grafo = JSON.parse(f.publicado_json);
  const cartoes = Object.fromEntries(grafo.nos.map((n) => [n.id, {}]));
  const conta = (no, tipo, saida = null) => ((passos.results || []).find((x) => x.no_id === no && x.tipo === tipo && (x.saida ?? null) === saida) || { n: 0 }).n;
  for (const n of grafo.nos) {
    const c = cartoes[n.id];
    if (n.tipo === 'inicio') c.entraram = conta(n.id, 'entrou');
    if (n.tipo === 'email') {
      const e = (emails.results || []).find((x) => x.no_id === n.id) || {};
      Object.assign(c, { receberam: e.receberam || 0, abriram: e.abriram || 0, clicaram: e.clicaram || 0 });
    }
    if (n.tipo === 'espera') {
      c.esperando = (agoraDentro.results || []).filter((x) => x.no_atual === n.id && x.situacao === 'esperando').reduce((s, x) => s + x.n, 0);
      if (n.dados.modo === 'evento') Object.assign(c, { aconteceu: conta(n.id, 'espera', 'aconteceu'), nao_aconteceu: conta(n.id, 'espera', 'nao_aconteceu') });
    }
    if (n.tipo === 'desvio') Object.assign(c, { sim: conta(n.id, 'desvio', 'sim'), nao: conta(n.id, 'desvio', 'nao') });
    if (n.tipo === 'objetivo') c.chegaram = conta(n.id, 'objetivo');
    if (n.tipo === 'ir_fluxo') c.passaram = conta(n.id, 'ir_fluxo');
    if (n.tipo === 'fim') c.concluiram = conta(n.id, 'fim');
  }
  return { periodo, cartoes };
}

/** Quem está dentro (andando ou esperando), de um cartão ou do fluxo todo. */
export async function pessoasDentro(env, id, { no = '', pagina = 1 } = {}) {
  const f = await fluxo(env, id);
  const p = Math.max(1, Math.floor(Number(pagina)) || 1);
  const filtro = no ? ' AND p.no_atual = ?' : '';
  const binds = no ? [f.id, String(no)] : [f.id];
  const [linhas, total] = await Promise.all([
    env.DB.prepare(
      `SELECT p.contato_id, c.nome, c.email, p.no_atual, p.situacao, p.atualizado_em
         FROM email_fluxo_pessoas p LEFT JOIN email_contatos c ON c.id = p.contato_id
        WHERE p.fluxo_id = ? AND p.situacao IN ('andando', 'esperando')${filtro}
        ORDER BY p.atualizado_em DESC, p.id DESC LIMIT ? OFFSET ?`,
    ).bind(...binds, POR_PAGINA, (p - 1) * POR_PAGINA).all(),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM email_fluxo_pessoas p WHERE p.fluxo_id = ? AND p.situacao IN ('andando', 'esperando')${filtro}`).bind(...binds).first(),
  ]);
  return { pessoas: linhas.results || [], total: total?.n || 0, pagina: p, por_pagina: POR_PAGINA };
}

/** Totais da lista: dentro agora, concluíram e taxa de clique (pessoas que clicaram ÷ que receberam). */
export async function totaisDosFluxos(env, ids) {
  if (!ids.length) return {};
  try {
    const marcas = ids.map(() => '?').join(',');
    const [pessoas, emails] = await Promise.all([
      env.DB.prepare(
        `SELECT fluxo_id, SUM(CASE WHEN situacao IN ('andando', 'esperando') THEN 1 ELSE 0 END) AS dentro,
                SUM(CASE WHEN situacao = 'concluiu' THEN 1 ELSE 0 END) AS concluiram
           FROM email_fluxo_pessoas WHERE fluxo_id IN (${marcas}) GROUP BY fluxo_id`,
      ).bind(...ids).all(),
      env.DB.prepare(
        `SELECT p.fluxo_id, COUNT(DISTINCT p.pessoa_id) AS receberam,
                COUNT(DISTINCT CASE WHEN e.clicado_em IS NOT NULL THEN p.pessoa_id END) AS clicaram
           FROM email_fluxo_passos p JOIN email_envios e ON e.id = p.envio_id
          WHERE p.fluxo_id IN (${marcas}) AND p.tipo = 'email' AND e.message_id IS NOT NULL GROUP BY p.fluxo_id`,
      ).bind(...ids).all(),
    ]);
    const tot = {};
    for (const id of ids) tot[id] = { dentro: 0, concluiram: 0, clique: null };
    for (const x of pessoas.results || []) Object.assign(tot[x.fluxo_id], { dentro: x.dentro || 0, concluiram: x.concluiram || 0 });
    for (const x of emails.results || []) tot[x.fluxo_id].clique = x.receberam ? x.clicaram / x.receberam : null;
    return tot;
  } catch {
    return {}; // migration 0058 ainda não aplicada
  }
}

/** Caminho do contato em cada fluxo: { pessoa_id: [{ tipo, no_id, saida, detalhe, em, assunto, aberto, clicado }] }. */
export async function caminhoDoContato(env, contatoId) {
  try {
    const r = (await env.DB.prepare(
      `SELECT p.pessoa_id, p.tipo, p.no_id, p.saida, p.detalhe, p.em, e.assunto, e.message_id,
              CASE WHEN e.aberto_em IS NOT NULL THEN 1 ELSE 0 END AS aberto, CASE WHEN e.clicado_em IS NOT NULL THEN 1 ELSE 0 END AS clicado
         FROM email_fluxo_passos p
         JOIN email_fluxo_pessoas fp ON fp.id = p.pessoa_id
         LEFT JOIN email_envios e ON e.id = p.envio_id
        WHERE fp.contato_id = ?
        ORDER BY p.id`,
    ).bind(Number(contatoId)).all()).results || [];
    const porPessoa = {};
    for (const x of r) (porPessoa[x.pessoa_id] = porPessoa[x.pessoa_id] || []).push(x);
    return porPessoa;
  } catch {
    return {};
  }
}
