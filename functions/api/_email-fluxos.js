// Fluxos automáticos de e-mail (spec-email-proprio.md, módulo 9; issue 385).
//
// Um fluxo é um quadro { nos, arestas, notas }. Esta parte guarda o rascunho
// (com versão, para duas abas não se atropelarem), confere a estrutura e
// aponta os problemas que impedem publicar. Publicar e rodar são da 386.
//
// Catálogo de tipos de cartão: cada tipo diz as próprias saídas e o que falta
// nele. Um tipo novo entra aqui (e no desenho do cartão no dash), sem mexer
// no resto.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.
import { CANAIS } from './_canal.js';
import { FUNIL_POR_PAGINA } from './_funil-paginas.js';
import { MATERIAIS } from '../../src/data/materiais.js';

const agora = () => Math.floor(Date.now() / 1000);
const MAX_NOS = 200;
const MAX_NOTAS = 100;
const MAX_BYTES = 200 * 1024;
const MAX_NOME = 100;
const ID = /^[A-Za-z0-9_-]{1,40}$/;

export class ErroFluxo extends Error {
  constructor(mensagem, status = 400) { super(mensagem); this.status = status; }
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

/** Acontecimentos que viram gatilho, condição de desvio, espera ou objetivo, e os filtros de cada um. */
export const EVENTOS = {
  formulario: ['funil', 'pagina', 'canal', 'utm_source', 'utm_campaign', 'utm_content'],
  aplicacao: ['formulario'],
  material: ['material'],
  compra: ['produto', 'compra'],
  agendou: ['tipo'],
  cancelou: ['tipo'],
  faltou: ['tipo'],
  compareceu: ['tipo'],
  grupo_entrou: ['grupo'],
  grupo_saiu: ['grupo'],
  crm: ['estagio'],
  site: ['pagina', 'evento'],
  segmento: ['segmento'],
  campanha: ['acao', 'campanha'],
};
const MODOS_ESPERA = ['tempo', 'dia', 'evento'];
const CONDICOES = ['abriu', 'clicou', 'evento', 'segmento'];

const emails = (grafo) => new Set(grafo.nos.filter((n) => n.tipo === 'email').map((n) => n.id));

/**
 * Tipos de cartão: saídas(dados) e problemas(dados, contexto) → ['Sem modelo', ...].
 * contexto = { grafo, modelos: Map, fluxos: Map, fluxoId }.
 */
export const TIPOS = {
  inicio: {
    saidas: () => ['proximo'],
    problemas: (d) => (Array.isArray(d.gatilhos) && d.gatilhos.length ? [] : ['Sem gatilho']),
  },
  email: {
    saidas: () => ['proximo'],
    problemas: (d, ctx) => {
      const m = ctx.modelos.get(Number(d.modelo));
      if (!m || m.canal !== 'marketing') return ['Sem modelo'];
      if (m.arquivado) return ['Modelo arquivado'];
      if (!String(m.assunto || '').trim() || !String(m.corpo || '').trim()) return ['Modelo incompleto'];
      return [];
    },
  },
  espera: {
    saidas: (d) => (d.modo === 'evento' ? ['aconteceu', 'nao_aconteceu'] : ['proximo']),
    problemas: (d, ctx) => (d.modo === 'evento' && ['abriu', 'clicou'].includes(d.evento || 'abriu') && !emails(ctx.grafo).has(d.ref) ? ['Sem e-mail de referência'] : []),
  },
  desvio: {
    saidas: () => ['sim', 'nao'],
    problemas: (d, ctx) => {
      if (!Array.isArray(d.condicoes) || !d.condicoes.length) return ['Sem condição'];
      return d.condicoes.some((c) => ['abriu', 'clicou'].includes(c.tipo) && !emails(ctx.grafo).has(c.ref)) ? ['Sem e-mail de referência'] : [];
    },
  },
  objetivo: {
    saidas: () => ['proximo'],
    problemas: (d) => (EVENTOS[d.evento] ? [] : ['Sem condição']),
  },
  ir_fluxo: {
    saidas: () => [],
    problemas: (d, ctx) => {
      const f = ctx.fluxos.get(Number(d.fluxo));
      return !f || f.arquivado || Number(d.fluxo) === Number(ctx.fluxoId) ? ['Sem fluxo de destino'] : [];
    },
  },
  fim: { saidas: () => [], problemas: () => [] },
};

// ---------------------------------------------------------------------------
// Estrutura
// ---------------------------------------------------------------------------

const texto = (v, max) => String(v ?? '').slice(0, max);
const numero = (v) => (Number.isFinite(Number(v)) ? Math.round(Math.max(-100000, Math.min(100000, Number(v)))) : 0);

function limparGatilho(g) {
  if (!g || !EVENTOS[g.evento]) throw new ErroFluxo('Gatilho com acontecimento desconhecido.');
  const filtros = (Array.isArray(g.filtros) ? g.filtros : []).map((f) => {
    if (!EVENTOS[g.evento].includes(f?.campo)) throw new ErroFluxo('Filtro que não existe para este acontecimento.');
    return { campo: f.campo, valor: texto(f.valor, 200) };
  });
  return { evento: g.evento, filtros };
}

function limparDados(tipo, d = {}) {
  d = d && typeof d === 'object' ? d : {};
  const janela = (j) => (j && typeof j === 'object' ? { ligada: !!j.ligada, de: texto(j.de || '08:00', 5), ate: texto(j.ate || '20:00', 5) } : { ligada: false, de: '08:00', ate: '20:00' });
  switch (tipo) {
    case 'inicio': return { gatilhos: (Array.isArray(d.gatilhos) ? d.gatilhos : []).slice(0, 10).map(limparGatilho) };
    case 'email': return { modelo: d.modelo ? Number(d.modelo) || '' : '' };
    case 'espera': {
      const modo = MODOS_ESPERA.includes(d.modo) ? d.modo : 'tempo';
      const unidade = d.unidade === 'horas' ? 'horas' : 'dias';
      if (modo === 'tempo') return { modo, qtd: Math.max(1, Math.min(365, numero(d.qtd) || 1)), unidade, janela: janela(d.janela) };
      if (modo === 'dia') return { modo, dia: /^[0-6]$/.test(String(d.dia)) ? String(d.dia) : '2', hora: /^\d{2}:\d{2}$/.test(d.hora) ? d.hora : '09:00', janela: janela(d.janela) };
      const evento = ['abriu', 'clicou'].includes(d.evento) || EVENTOS[d.evento] ? d.evento : 'abriu';
      return { modo, evento, ref: texto(d.ref, 40), valor: texto(d.valor, 200), prazo: Math.max(1, Math.min(365, numero(d.prazo) || 1)), unidade, janela: janela(d.janela) };
    }
    case 'desvio': return {
      juncao: d.juncao === 'ou' ? 'ou' : 'e',
      condicoes: (Array.isArray(d.condicoes) ? d.condicoes : []).slice(0, 10).map((c) => {
        if (!CONDICOES.includes(c?.tipo)) throw new ErroFluxo('Condição de desvio desconhecida.');
        if (c.tipo === 'evento' && !EVENTOS[c.evento]) throw new ErroFluxo('Condição com acontecimento desconhecido.');
        return { tipo: c.tipo, ref: texto(c.ref, 40), link: texto(c.link, 500), evento: texto(c.evento, 40), valor: texto(c.valor, 200) };
      }),
    };
    case 'objetivo': return { evento: EVENTOS[d.evento] ? d.evento : '', filtro: texto(d.filtro, 200) };
    case 'ir_fluxo': return { fluxo: d.fluxo ? Number(d.fluxo) || '' : '' };
    default: return {};
  }
}

/** Confere e limpa o quadro. Lança ErroFluxo quando a estrutura não fecha. */
export function normalizarGrafo(g) {
  if (!g || typeof g !== 'object') throw new ErroFluxo('Quadro inválido.');
  if (JSON.stringify(g).length > MAX_BYTES) throw new ErroFluxo('O quadro passou do tamanho máximo. Divida em dois fluxos.');
  const nosIn = Array.isArray(g.nos) ? g.nos : [];
  if (nosIn.length > MAX_NOS) throw new ErroFluxo(`O quadro passou de ${MAX_NOS} cartões. Divida em dois fluxos.`);
  const ids = new Set();
  const nos = nosIn.map((n) => {
    if (!n || !ID.test(String(n.id)) || ids.has(n.id)) throw new ErroFluxo('Cartão com identificador inválido ou repetido.');
    if (!TIPOS[n.tipo]) throw new ErroFluxo('Tipo de cartão desconhecido.');
    ids.add(n.id);
    return { id: n.id, tipo: n.tipo, x: numero(n.x), y: numero(n.y), dados: limparDados(n.tipo, n.dados) };
  });
  if (nos.filter((n) => n.tipo === 'inicio').length !== 1) throw new ErroFluxo('O fluxo precisa de exatamente um cartão de início.');
  const porId = new Map(nos.map((n) => [n.id, n]));
  const usadas = new Set();
  const arestas = (Array.isArray(g.arestas) ? g.arestas : []).map((a) => {
    const de = porId.get(a?.de);
    if (!de || !porId.has(a.para) || !ID.test(String(a.id))) throw new ErroFluxo('Ligação para um cartão que não existe.');
    if (!TIPOS[de.tipo].saidas(de.dados).includes(a.saida)) throw new ErroFluxo('Ligação saindo de uma saída que o cartão não tem.');
    const chave = `${a.de}|${a.saida}`;
    if (usadas.has(chave)) throw new ErroFluxo('Uma saída só pode ir para um cartão.');
    usadas.add(chave);
    return { id: a.id, de: a.de, saida: a.saida, para: a.para };
  });
  const notasIn = Array.isArray(g.notas) ? g.notas : [];
  if (notasIn.length > MAX_NOTAS) throw new ErroFluxo(`O quadro passou de ${MAX_NOTAS} notas.`);
  const notas = notasIn.map((o) => {
    if (!o || !ID.test(String(o.id))) throw new ErroFluxo('Nota com identificador inválido.');
    return { id: o.id, x: numero(o.x), y: numero(o.y), texto: texto(o.texto, 2000) };
  });
  return { nos, arestas, notas };
}

/** Problemas que impedem publicar: [{ no, textos }]. */
export async function problemas(env, grafo, fluxoId) {
  const [mods, fls] = await Promise.all([
    env.DB.prepare('SELECT id, canal, arquivado, assunto, corpo FROM email_modelos').all(),
    env.DB.prepare('SELECT id, arquivado FROM email_fluxos').all(),
  ]);
  const ctx = {
    grafo, fluxoId,
    modelos: new Map((mods.results || []).map((m) => [m.id, m])),
    fluxos: new Map((fls.results || []).map((f) => [f.id, f])),
  };
  const ini = grafo.nos.find((n) => n.tipo === 'inicio');
  const alcance = new Set();
  const fila = [ini.id, ...grafo.nos.filter((n) => n.tipo === 'objetivo').map((n) => n.id)];
  while (fila.length) {
    const id = fila.shift();
    if (alcance.has(id)) continue;
    alcance.add(id);
    grafo.arestas.filter((a) => a.de === id).forEach((a) => fila.push(a.para));
  }
  const lista = [];
  for (const n of grafo.nos) {
    const tipo = TIPOS[n.tipo];
    const p = [...tipo.problemas(n.dados, ctx)];
    if (!alcance.has(n.id)) p.push('Solto');
    const soltas = tipo.saidas(n.dados).filter((s) => !grafo.arestas.some((a) => a.de === n.id && a.saida === s));
    if (soltas.length) p.push(soltas.length > 1 ? 'Saídas sem destino' : 'Saída sem destino');
    if (p.length) lista.push({ no: n.id, textos: p });
  }
  return lista;
}

// ---------------------------------------------------------------------------
// Fluxos
// ---------------------------------------------------------------------------

const GRAFO_NOVO = () => ({ nos: [{ id: 'n1', tipo: 'inicio', x: 60, y: 140, dados: { gatilhos: [] } }], arestas: [], notas: [] });
const daLinha = (l) => ({
  id: l.id, nome: l.nome, situacao: l.situacao, arquivado: l.arquivado, versao: l.versao, publicado_em: l.publicado_em || null,
  grafo: JSON.parse(l.rascunho_json), criado_em: l.criado_em, atualizado_em: l.atualizado_em,
});

async function linhaDoFluxo(env, id) {
  const l = Number.isInteger(Number(id)) && Number(id) > 0
    ? await env.DB.prepare('SELECT * FROM email_fluxos WHERE id = ?').bind(Number(id)).first()
    : null;
  if (!l) throw new ErroFluxo('Fluxo não encontrado.', 404);
  return l;
}

/** Fluxo com os problemas de agora. */
export async function lerFluxo(env, id) {
  const f = daLinha(await linhaDoFluxo(env, id));
  return { ...f, problemas: await problemas(env, f.grafo, f.id) };
}

export async function listarFluxos(env, { arquivados = false } = {}) {
  const r = (await env.DB.prepare('SELECT * FROM email_fluxos WHERE arquivado = ? ORDER BY atualizado_em DESC, id DESC').bind(arquivados ? 1 : 0).all()).results || [];
  const contagem = await env.DB.prepare('SELECT SUM(CASE WHEN arquivado = 1 THEN 1 ELSE 0 END) AS arquivados FROM email_fluxos').first();
  return { fluxos: r.map(daLinha), arquivados: contagem?.arquivados || 0 };
}

const nomeLimpo = (nome) => {
  const n = String(nome || '').trim();
  if (!n) throw new ErroFluxo('Dê um nome ao fluxo.');
  if (n.length > MAX_NOME) throw new ErroFluxo(`O nome passa de ${MAX_NOME} caracteres.`);
  return n;
};

export async function criarFluxo(env, { nome = 'Fluxo sem nome' } = {}) {
  const t = agora();
  const r = await env.DB.prepare('INSERT INTO email_fluxos (nome, situacao, rascunho_json, versao, criado_em, atualizado_em) VALUES (?, \'rascunho\', ?, 1, ?, ?)')
    .bind(nomeLimpo(nome), JSON.stringify(GRAFO_NOVO()), t, t).run();
  return lerFluxo(env, r.meta.last_row_id);
}

/** Salva o rascunho. `versao` é a que a tela tinha: se outra aba salvou antes, recusa. */
export async function salvarFluxo(env, id, { nome, grafo, versao }) {
  const atual = await linhaDoFluxo(env, id);
  const g = normalizarGrafo(grafo);
  const n = nomeLimpo(nome ?? atual.nome);
  const t = agora();
  const r = await env.DB.prepare('UPDATE email_fluxos SET nome = ?, rascunho_json = ?, versao = versao + 1, atualizado_em = ? WHERE id = ? AND versao = ?')
    .bind(n, JSON.stringify(g), t, atual.id, Number(versao)).run();
  if (r.meta.changes !== 1) throw new ErroFluxo('Este fluxo foi mudado em outra aba. Recarregue para continuar.', 409);
  return { versao: atual.versao + 1, atualizado_em: t, problemas: await problemas(env, g, atual.id) };
}

export async function duplicarFluxo(env, id) {
  const f = await linhaDoFluxo(env, id);
  const t = agora();
  const r = await env.DB.prepare('INSERT INTO email_fluxos (nome, situacao, rascunho_json, versao, criado_em, atualizado_em) VALUES (?, \'rascunho\', ?, 1, ?, ?)')
    .bind(`Cópia de ${f.nome}`.slice(0, MAX_NOME), f.rascunho_json, t, t).run();
  return lerFluxo(env, r.meta.last_row_id);
}

export async function arquivarFluxo(env, id, arquivar) {
  const f = await linhaDoFluxo(env, id);
  await env.DB.prepare('UPDATE email_fluxos SET arquivado = ?, atualizado_em = ? WHERE id = ?').bind(arquivar ? 1 : 0, agora(), f.id).run();
  return lerFluxo(env, f.id);
}

// ---------------------------------------------------------------------------
// Travas: modelo e segmento usados em fluxo não arquivado
// ---------------------------------------------------------------------------

async function grafosAtivos(env) {
  try {
    const r = (await env.DB.prepare('SELECT nome, rascunho_json, publicado_json FROM email_fluxos WHERE arquivado = 0').all()).results || [];
    return r.map((f) => ({ nome: f.nome, grafos: [f.rascunho_json, f.publicado_json].filter(Boolean).map((j) => JSON.parse(j)) }));
  } catch {
    return []; // migration 0057 ainda não aplicada
  }
}

export async function modeloEmFluxos(env, modeloId) {
  const id = Number(modeloId);
  return (await grafosAtivos(env))
    .filter((f) => f.grafos.some((g) => g.nos.some((n) => n.tipo === 'email' && Number(n.dados.modelo) === id)))
    .map((f) => `fluxo "${f.nome}"`);
}

export async function segmentoEmFluxos(env, segmentoId) {
  const id = String(segmentoId);
  const usa = (n) => (n.tipo === 'inicio' && n.dados.gatilhos.some((g) => g.evento === 'segmento' && g.filtros.some((f) => f.campo === 'segmento' && String(f.valor) === id)))
    || (n.tipo === 'desvio' && n.dados.condicoes.some((c) => c.tipo === 'segmento' && String(c.valor) === id));
  return (await grafosAtivos(env)).filter((f) => f.grafos.some((g) => g.nos.some(usa))).map((f) => `fluxo "${f.nome}"`);
}

// ---------------------------------------------------------------------------
// Opções reais dos filtros
// ---------------------------------------------------------------------------

async function lista(fn) {
  try { return await fn(); } catch { return []; }
}

/** Valores de cada filtro: { campo: [[valor, rótulo], ...] }. Fonte que falhar fica vazia. */
export async function opcoes(env, t = agora()) {
  const desde = t - 90 * 86400;
  const utm = (col) => lista(async () => ((await env.DB.prepare(
    `SELECT s.${col} AS v, COUNT(*) AS n FROM event_log e JOIN sessions s ON s.session_id = e.session_id
      WHERE e.event_name = 'Lead' AND e.timestamp >= ? AND COALESCE(s.${col}, '') <> '' GROUP BY s.${col} ORDER BY n DESC LIMIT 50`,
  ).bind(desde).all()).results || []).map((x) => [x.v, x.v]));
  const [funis, utmSource, utmCampaign, utmContent, produtos, tipos, grupos, estagios, segmentos, campanhas, fluxos] = await Promise.all([
    lista(async () => ((await env.DB.prepare("SELECT DISTINCT funil FROM email_contatos_entradas WHERE COALESCE(funil, '') <> '' ORDER BY funil").all()).results || []).map((x) => x.funil)),
    utm('utm_source'), utm('utm_campaign'), utm('utm_content'),
    lista(async () => ((await env.DB.prepare(
      "SELECT product_id AS id, MAX(json_extract(raw_json, '$.product.name')) AS nome FROM greenn_webhook_event WHERE product_id IS NOT NULL GROUP BY product_id ORDER BY nome",
    ).all()).results || []).map((x) => [String(x.id), x.nome || `Produto ${x.id}`])),
    lista(async () => ((await env.DB.prepare('SELECT id, nome FROM agenda_tipos ORDER BY nome').all()).results || []).map((x) => [String(x.id), x.nome])),
    lista(async () => ((await env.DB.prepare(
      'SELECT g.group_jid AS id, COALESCE(c.subject, g.group_jid) AS nome FROM whatsapp_groups_tracked g LEFT JOIN whatsapp_groups_catalogo c ON c.group_jid = g.group_jid ORDER BY nome',
    ).all()).results || []).map((x) => [x.id, x.nome])),
    lista(async () => ((await env.DB.prepare('SELECT status, COUNT(DISTINCT task_id) AS n FROM crm_status_log GROUP BY status ORDER BY n DESC').all()).results || []).map((x) => [x.status, x.status])),
    lista(async () => ((await env.DB.prepare('SELECT id, nome FROM email_segmentos ORDER BY nome').all()).results || []).map((x) => [String(x.id), x.nome])),
    lista(async () => ((await env.DB.prepare(
      "SELECT id, nome FROM email_campanhas WHERE disparada_em IS NOT NULL AND situacao IN ('enviada', 'falhou', 'enviando') ORDER BY disparada_em DESC",
    ).all()).results || []).map((x) => [String(x.id), x.nome])),
    lista(async () => ((await env.DB.prepare('SELECT id, nome FROM email_fluxos WHERE arquivado = 0 ORDER BY nome').all()).results || []).map((x) => [String(x.id), x.nome])),
  ]);
  return {
    funil: funis.map((f) => [f, f]),
    pagina: [...FUNIL_POR_PAGINA.keys()].map((p) => [p, p]),
    canal: CANAIS.map((c) => [c, c]),
    utm_source: utmSource,
    utm_campaign: utmCampaign,
    utm_content: utmContent,
    formulario: funis.filter((f) => /aplicacao/.test(f)).map((f) => [f, f]),
    material: MATERIAIS.map((m) => [m.slug, m.titulo]),
    produto: produtos,
    compra: [['aprovada', 'aprovada'], ['reembolsada', 'reembolsada'], ['cancelada', 'cancelada']],
    tipo: tipos,
    grupo: grupos,
    estagio: estagios,
    evento: [['ctaclick', 'clicou num botão'], ['formstart', 'começou a preencher o formulário'], ['formstep', 'concluiu uma etapa do formulário'], ['storyopen', 'abriu um story']],
    segmento: segmentos,
    campanha: campanhas,
    acao: [['abriu', 'abriu'], ['clicou', 'clicou']],
    fluxos,
  };
}

// ---------------------------------------------------------------------------
// Publicar, pausar e retomar (issue 386)
// ---------------------------------------------------------------------------

/**
 * Rascunho → ativo. Só sem problemas. A hora da publicação fica gravada:
 * quem disparou o gatilho antes não entra (o motor compara com ela).
 * Publicar mudanças num fluxo já ativo é da 387.
 */
export async function publicarFluxo(env, id, t = agora()) {
  const f = await linhaDoFluxo(env, id);
  if (f.arquivado) throw new ErroFluxo('Tire o fluxo do arquivo antes de publicar.', 409);
  if (f.situacao !== 'rascunho') throw new ErroFluxo('Este fluxo já está publicado.', 409);
  const grafo = JSON.parse(f.rascunho_json);
  const probs = await problemas(env, grafo, f.id);
  if (probs.length) throw new ErroFluxo(`Não dá para publicar: ${probs.length} ${probs.length > 1 ? 'problemas marcados' : 'problema marcado'} no quadro.`, 409);
  const r = await env.DB.prepare("UPDATE email_fluxos SET situacao = 'ativo', publicado_json = rascunho_json, publicado_em = ?, atualizado_em = ? WHERE id = ? AND situacao = 'rascunho'")
    .bind(t, t, f.id).run();
  if (r.meta.changes !== 1) throw new ErroFluxo('Este fluxo já está publicado.', 409);
  return lerFluxo(env, f.id);
}

/** Ninguém novo entra e quem está dentro para onde está. */
export async function pausarFluxo(env, id, t = agora()) {
  const f = await linhaDoFluxo(env, id);
  const r = await env.DB.prepare("UPDATE email_fluxos SET situacao = 'pausado', pausado_em = ?, atualizado_em = ? WHERE id = ? AND situacao = 'ativo'")
    .bind(t, t, f.id).run();
  if (r.meta.changes !== 1) throw new ErroFluxo('Só fluxo ativo pode ser pausado.', 409);
  return lerFluxo(env, f.id);
}

/** Volta a rodar; as esperas são empurradas pelo tempo da pausa (sem rajada de acumulados). */
export async function retomarFluxo(env, id, t = agora()) {
  const f = await linhaDoFluxo(env, id);
  if (f.situacao !== 'pausado') throw new ErroFluxo('Só fluxo pausado pode ser retomado.', 409);
  const pausa = Math.max(0, t - (f.pausado_em || t));
  await env.DB.prepare("UPDATE email_fluxo_pessoas SET espera_ate = espera_ate + ?, atualizado_em = ? WHERE fluxo_id = ? AND situacao = 'esperando' AND espera_ate IS NOT NULL")
    .bind(pausa, t, f.id).run();
  await env.DB.prepare("UPDATE email_fluxos SET situacao = 'ativo', pausado_em = NULL, atualizado_em = ? WHERE id = ? AND situacao = 'pausado'").bind(t, f.id).run();
  return lerFluxo(env, f.id);
}
