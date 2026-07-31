// GET  /api/links?key=...  → destinos do /links, com cliques e o que está no ar
// POST /api/links?key=...  → cria, edita ou apaga um destino
//
// Consome a aba "Links" do dashboard. Endpoint ADITIVO: nenhum endpoint
// existente foi alterado.
//
// A escolha do destino ativo NÃO é reimplementada aqui — vem de
// functions/_links-destino.js, a mesma função que o redirect usa. É isso que
// impede o painel de dizer "está no ar o link X" enquanto /links entrega outro.

import { escolherDestino, situacaoDe } from '../_links-destino.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const agora = Math.floor(Date.now() / 1000);

  // Cliques agregados em SQL, não no navegador: a tabela de cliques cresce e
  // mandá-la inteira para a tela seria desperdício.
  const { results } = await env.DB.prepare(`
    SELECT l.id, l.label, l.target_url, l.starts_at, l.ends_at, l.criado_em,
           COUNT(c.id) AS cliques
    FROM short_links l
    LEFT JOIN short_link_clicks c ON c.link_id = l.id
    WHERE l.apagado_em IS NULL
    GROUP BY l.id
    ORDER BY l.starts_at IS NULL DESC, l.starts_at DESC, l.criado_em DESC
  `).all();

  const linhas = results || [];
  const escolha = escolherDestino(linhas, agora);

  return json({
    agora,
    // Situação calculada no backend: a tela só exibe o rótulo que vem pronto.
    rows: linhas.map((l) => ({
      id: l.id,
      label: l.label,
      target_url: l.target_url,
      starts_at: l.starts_at,
      ends_at: l.ends_at,
      cliques: l.cliques || 0,
      situacao: situacaoDe(l, agora),
    })),
    ativo: escolha.link
      ? { id: escolha.link.id, label: escolha.link.label, target_url: escolha.link.target_url, motivo: escolha.motivo }
      : null,
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const agora = Math.floor(Date.now() / 1000);
  const id = parseInt(corpo.id, 10);

  // --- apagar ---
  // Marcação, nunca DELETE: os cliques já recebidos apontam para esta linha, e
  // removê-la faria o histórico perder rótulo e URL.
  if (corpo.acao === 'apagar') {
    if (!Number.isFinite(id)) return json({ error: 'id obrigatório para apagar' }, 400);
    await env.DB.prepare('UPDATE short_links SET apagado_em = ? WHERE id = ? AND apagado_em IS NULL')
      .bind(agora, id).run();
    return json({ ok: true, apagado: true });
  }

  // --- validação (toda no backend, nunca no formulário) ---
  const label = str(corpo.label);
  if (!label) return json({ error: 'Dê um rótulo ao destino (ex.: "Disparo Live 05/08").' }, 400);

  const erroUrl = validarUrl(str(corpo.target_url));
  if (erroUrl) return json({ error: erroUrl }, 400);

  const { starts_at, ends_at, erro: erroJanela } = validarJanela(corpo);
  if (erroJanela) return json({ error: erroJanela }, 400);

  const ehPadrao = starts_at == null;

  // Só pode existir UM destino padrão: com dois, a escolha no clique viraria
  // ambígua. O anterior é aposentado (marcado como apagado), não sobrescrito,
  // para os cliques que ele recebeu continuarem com rótulo e URL no histórico.
  if (ehPadrao) {
    const base = `UPDATE short_links SET apagado_em = ?
                   WHERE apagado_em IS NULL AND starts_at IS NULL AND ends_at IS NULL`;
    // Ao EDITAR o padrão atual, ele não pode aposentar a si mesmo.
    await (Number.isFinite(id)
      ? env.DB.prepare(`${base} AND id != ?`).bind(agora, id)
      : env.DB.prepare(base).bind(agora)
    ).run();
  }

  if (Number.isFinite(id)) {
    await env.DB.prepare(`
      UPDATE short_links SET label = ?, target_url = ?, starts_at = ?, ends_at = ?
      WHERE id = ? AND apagado_em IS NULL
    `).bind(label, str(corpo.target_url), starts_at, ends_at, id).run();
    return json({ ok: true, id });
  }

  const r = await env.DB.prepare(`
    INSERT INTO short_links (label, target_url, starts_at, ends_at, criado_em)
    VALUES (?, ?, ?, ?, ?)
  `).bind(label, str(corpo.target_url), starts_at, ends_at, agora).run();

  return json({ ok: true, id: r.meta ? r.meta.last_row_id : null });
}

// Aceitar qualquer esquema transformaria /links num redirecionador aberto: o
// domínio da marca viraria fachada para phishing ("o link é do site deles"), e
// `javascript:` seria XSS em quem clicasse. Por isso a lista é fechada.
function validarUrl(alvo) {
  if (!alvo) return 'Informe a URL de destino.';
  let u;
  try {
    u = new URL(alvo);
  } catch {
    return 'URL inválida. Cole o endereço completo, começando com https://';
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return 'A URL precisa começar com http:// ou https://';
  }
  return null;
}

// Ou as duas datas, ou nenhuma (destino padrão). Uma só deixaria a janela sem
// fim ou sem começo, e a regra de escolha não saberia o que fazer com ela.
function validarJanela(corpo) {
  const inicio = num(corpo.starts_at);
  const fim = num(corpo.ends_at);

  if (inicio == null && fim == null) return { starts_at: null, ends_at: null, erro: null };
  if (inicio == null || fim == null) {
    return { erro: 'Preencha início E fim da janela, ou nenhum dos dois (destino padrão).' };
  }
  if (fim < inicio) return { erro: 'O fim da janela não pode ser antes do início.' };
  return { starts_at: inicio, ends_at: fim, erro: null };
}

const str = (v) => (v == null ? '' : String(v)).trim();

function num(v) {
  if (v == null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
