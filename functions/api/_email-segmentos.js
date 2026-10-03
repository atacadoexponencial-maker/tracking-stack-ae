// Segmentos de contatos (spec-email-proprio.md, módulo 5; issue 381).
//
// Um segmento é uma regra (condições combinadas com "e") sobre email_contatos.
// Quem está nele é recalculado a cada leitura e, na 382, na hora do disparo.
// Só contato "ativo" conta.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.
import { CANAIS } from './_canal.js';
import { campanhasEnviadas, segmentoEmAgendadas } from './_email-campanhas.js';

const agora = () => Math.floor(Date.now() / 1000);
const MAX_REGRAS = 10;
const MAX_NOME = 100;
const AMOSTRA = 10;
export const DIAS_ENTRADA = [7, 15, 30, 60, 90];

/** Campos do montador e comparações aceitas. */
export const CAMPOS = {
  funil: ['e', 'nao'],
  origem: ['e', 'nao'],
  entrada: ['ultimos', 'antes'],
  estagio: ['e', 'nao'],
  abriu: ['sim', 'nao'],
  clicou: ['sim', 'nao'],
};

/**
 * Campanhas enviadas que servem para "abriu"/"clicou" (a das campanhas entrou
 * na 382): async (env) => [{ id, nome }].
 */
export const fontesDeCampanhas = [campanhasEnviadas];
/**
 * Onde o segmento é usado (trava de excluir). A 383 acrescenta a consulta das
 * campanhas agendadas: async (env, id) => ['campanha agendada "X"', ...].
 */
export const consultasDeUso = [segmentoEmAgendadas];

export class ErroSegmento extends Error {
  constructor(mensagem, status = 400) { super(mensagem); this.status = status; }
}

async function opcoesDeCampanhas(env) {
  const listas = await Promise.all(fontesDeCampanhas.map((f) => f(env)));
  return listas.flat();
}

export async function usosDoSegmento(env, id) {
  const listas = await Promise.all(consultasDeUso.map((c) => c(env, Number(id))));
  return [...new Set(listas.flat())];
}

// ---------------------------------------------------------------------------
// Regras
// ---------------------------------------------------------------------------

/** Valida e limpa as regras. Devolve a lista ou lança ErroSegmento. */
export async function validarRegras(env, regras) {
  if (regras === undefined || regras === null) return [];
  if (!Array.isArray(regras)) throw new ErroSegmento('Regra inválida.');
  if (regras.length > MAX_REGRAS) throw new ErroSegmento(`Use no máximo ${MAX_REGRAS} condições.`);
  let campanhas = null;
  const limpas = [];
  for (const r of regras) {
    const campo = String(r?.campo || '');
    const op = String(r?.op || '');
    if (!CAMPOS[campo]) throw new ErroSegmento('Condição com campo desconhecido.');
    if (!CAMPOS[campo].includes(op)) throw new ErroSegmento('Condição com comparação desconhecida.');
    let valor = String(r?.valor ?? '').trim();
    if (campo === 'entrada') {
      if (!DIAS_ENTRADA.includes(Number(valor))) throw new ErroSegmento('Escolha um prazo da lista para a data de entrada.');
      valor = String(Number(valor));
    } else if (campo === 'origem') {
      if (!CANAIS.includes(valor)) throw new ErroSegmento('Escolha uma origem da lista.');
    } else if (campo === 'abriu' || campo === 'clicou') {
      campanhas = campanhas || await opcoesDeCampanhas(env);
      if (!campanhas.length) throw new ErroSegmento('Ainda não há campanha enviada para usar nesta condição.');
      if (!campanhas.some((c) => String(c.id) === valor)) throw new ErroSegmento('Escolha uma campanha enviada da lista.');
    } else if (!valor || valor.length > 100) {
      throw new ErroSegmento('Escolha um valor para cada condição.');
    }
    limpas.push({ campo, op, valor });
  }
  return limpas;
}

// Estágio atual no CRM por e-mail: o card mais recente da ponte (lead_dispatch)
// e o último status dele, na mesma ordem da aba Leads.
const CTE_ESTAGIO = `WITH tarefa AS (
    SELECT lower(email) AS email, task_id FROM lead_dispatch
     WHERE id IN (SELECT MAX(id) FROM lead_dispatch WHERE task_id IS NOT NULL AND email IS NOT NULL GROUP BY lower(email))
  ), estagio AS (
    SELECT t.email, (SELECT st.status FROM crm_status_log st WHERE st.task_id = t.task_id
                      ORDER BY COALESCE(st.hist_date, st.recebido_em) DESC, st.id DESC LIMIT 1) AS status
      FROM tarefa t
  )`;

/**
 * Monta o FROM/WHERE das regras sobre email_contatos (alias c).
 * O estágio do CRM só entra na consulta quando alguma regra usa.
 */
export function sqlDasRegras(regras, t = agora()) {
  const onde = [];
  const binds = [];
  const envio = (coluna, sim, campanha) => {
    onde.push(`${sim ? '' : 'NOT '}EXISTS (SELECT 1 FROM email_envios v WHERE v.origem = 'campanha' AND v.ref_id = ? AND lower(v.destinatario) = c.email AND v.${coluna} IS NOT NULL)`);
    binds.push(campanha);
  };
  for (const r of regras) {
    switch (r.campo) {
      case 'funil':
        onde.push(`${r.op === 'e' ? '' : 'NOT '}EXISTS (SELECT 1 FROM email_contatos_entradas en WHERE en.contato_id = c.id AND en.funil = ?)`);
        binds.push(r.valor);
        break;
      case 'origem':
        onde.push(r.op === 'e' ? 'c.origem = ?' : "COALESCE(c.origem, '') <> ?");
        binds.push(r.valor);
        break;
      case 'entrada':
        onde.push(r.op === 'ultimos' ? 'c.entrou_em >= ?' : 'c.entrou_em < ?');
        binds.push(t - Number(r.valor) * 86400);
        break;
      case 'estagio':
        onde.push(r.op === 'e' ? 'est.status = ?' : "COALESCE(est.status, '') <> ?");
        binds.push(r.valor);
        break;
      case 'abriu': envio('aberto_em', r.op === 'sim', r.valor); break;
      case 'clicou': envio('clicado_em', r.op === 'sim', r.valor); break;
      default: break;
    }
  }
  const comEstagio = regras.some((r) => r.campo === 'estagio');
  return {
    antes: comEstagio ? CTE_ESTAGIO : '',
    de: `email_contatos c${comEstagio ? ' LEFT JOIN estagio est ON est.email = c.email' : ''}`,
    onde: onde.length ? onde.join(' AND ') : '1 = 1',
    binds,
  };
}

/** Ativos e fora do marketing que a regra pega agora. */
export async function contar(env, regras, t = agora()) {
  const q = sqlDasRegras(regras, t);
  const r = await env.DB.prepare(
    `${q.antes} SELECT COUNT(*) AS total, SUM(CASE WHEN c.situacao = 'ativo' THEN 1 ELSE 0 END) AS ativos FROM ${q.de} WHERE ${q.onde}`,
  ).bind(...q.binds).first();
  const ativos = r?.ativos || 0;
  return { ativos, fora: (r?.total || 0) - ativos };
}

/** Primeiros contatos ativos da regra (mais recentes primeiro). */
export async function amostra(env, regras, t = agora()) {
  const q = sqlDasRegras(regras, t);
  return (await env.DB.prepare(
    `${q.antes} SELECT c.id, c.nome, c.email, c.funil, c.entrou_em FROM ${q.de}
      WHERE ${q.onde} AND c.situacao = 'ativo' ORDER BY c.entrou_em DESC, c.id DESC LIMIT ?`,
  ).bind(...q.binds, AMOSTRA).all()).results || [];
}

/** Todos os ativos do segmento, na hora do disparo (382). */
export async function contatosDoSegmento(env, regras, t = agora()) {
  const q = sqlDasRegras(regras, t);
  return (await env.DB.prepare(
    `${q.antes} SELECT c.id, c.nome, c.email, c.funil FROM ${q.de} WHERE ${q.onde} AND c.situacao = 'ativo' ORDER BY c.id`,
  ).bind(...q.binds).all()).results || [];
}

/** Valores do montador. */
export async function opcoes(env) {
  const [funis, estagios, campanhas] = await Promise.all([
    env.DB.prepare("SELECT DISTINCT funil FROM email_contatos_entradas WHERE COALESCE(funil, '') <> '' ORDER BY funil").all(),
    env.DB.prepare('SELECT status, COUNT(DISTINCT task_id) AS n FROM crm_status_log GROUP BY status ORDER BY n DESC, status').all()
      .catch(() => ({ results: [] })),
    opcoesDeCampanhas(env),
  ]);
  return {
    funis: (funis.results || []).map((x) => x.funil),
    origens: CANAIS,
    entrada: DIAS_ENTRADA,
    estagios: (estagios.results || []).map((x) => x.status),
    campanhas,
  };
}

// ---------------------------------------------------------------------------
// Segmentos
// ---------------------------------------------------------------------------

const daLinha = (l) => ({ id: l.id, nome: l.nome, regras: JSON.parse(l.regras_json || '[]'), criado_em: l.criado_em, atualizado_em: l.atualizado_em });

export async function lerSegmento(env, id) {
  const l = Number.isInteger(Number(id)) && Number(id) > 0
    ? await env.DB.prepare('SELECT * FROM email_segmentos WHERE id = ?').bind(Number(id)).first()
    : null;
  if (!l) throw new ErroSegmento('Segmento não encontrado.', 404);
  return daLinha(l);
}

/** Segmentos com os ativos de agora. */
export async function listarSegmentos(env) {
  const linhas = ((await env.DB.prepare('SELECT * FROM email_segmentos ORDER BY nome').all()).results || []).map(daLinha);
  const t = agora();
  for (const s of linhas) s.ativos = (await contar(env, s.regras, t)).ativos;
  return linhas;
}

async function nomeLivre(env, nome, ignorarId = 0) {
  const r = await env.DB.prepare('SELECT id FROM email_segmentos WHERE nome = ? AND id <> ?').bind(nome, ignorarId).first();
  if (r) throw new ErroSegmento('Já existe um segmento com esse nome.', 409);
}

export async function salvarSegmento(env, { id, nome, regras }) {
  const n = String(nome || '').trim();
  if (!n) throw new ErroSegmento('Dê um nome ao segmento.');
  if (n.length > MAX_NOME) throw new ErroSegmento(`O nome passa de ${MAX_NOME} caracteres.`);
  const r = await validarRegras(env, regras);
  const t = agora();
  if (id) {
    const atual = await lerSegmento(env, id);
    await nomeLivre(env, n, atual.id);
    await env.DB.prepare('UPDATE email_segmentos SET nome = ?, regras_json = ?, atualizado_em = ? WHERE id = ?')
      .bind(n, JSON.stringify(r), t, atual.id).run();
    return lerSegmento(env, atual.id);
  }
  await nomeLivre(env, n);
  const ins = await env.DB.prepare('INSERT INTO email_segmentos (nome, regras_json, criado_em, atualizado_em) VALUES (?, ?, ?, ?)')
    .bind(n, JSON.stringify(r), t, t).run();
  return lerSegmento(env, ins.meta.last_row_id);
}

export async function duplicarSegmento(env, id) {
  const s = await lerSegmento(env, id);
  const base = `Cópia de ${s.nome}`.slice(0, MAX_NOME);
  let nome = base;
  for (let n = 2; await env.DB.prepare('SELECT 1 FROM email_segmentos WHERE nome = ?').bind(nome).first(); n++) {
    nome = `${base.slice(0, MAX_NOME - 6)} (${n})`;
  }
  const t = agora();
  const ins = await env.DB.prepare('INSERT INTO email_segmentos (nome, regras_json, criado_em, atualizado_em) VALUES (?, ?, ?, ?)')
    .bind(nome, JSON.stringify(s.regras), t, t).run();
  return lerSegmento(env, ins.meta.last_row_id);
}

export async function excluirSegmento(env, id) {
  const s = await lerSegmento(env, id);
  const usos = await usosDoSegmento(env, s.id);
  if (usos.length) throw new ErroSegmento(`Este segmento está em uso em: ${usos.join(', ')}. Tire o segmento de lá antes de excluir.`, 409);
  await env.DB.prepare('DELETE FROM email_segmentos WHERE id = ?').bind(s.id).run();
}

/** Segmentos em que o contato está agora (detalhe do contato). */
export async function segmentosDoContato(env, contatoId) {
  let linhas;
  try {
    linhas = ((await env.DB.prepare('SELECT * FROM email_segmentos ORDER BY nome').all()).results || []).map(daLinha);
  } catch {
    return []; // migration 0054 ainda não aplicada
  }
  const t = agora();
  const dentro = [];
  for (const s of linhas) {
    const q = sqlDasRegras(s.regras, t);
    const r = await env.DB.prepare(`${q.antes} SELECT 1 AS ok FROM ${q.de} WHERE ${q.onde} AND c.id = ?`).bind(...q.binds, Number(contatoId)).first();
    if (r) dentro.push({ id: s.id, nome: s.nome });
  }
  return dentro;
}
