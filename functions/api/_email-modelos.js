// Regras dos modelos de e-mail (spec-email-proprio.md, módulo 2; issue 378).
// Validação toda aqui; o dash só mostra a mensagem que volta.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.
import { CANAIS, MARCADOR, desconhecidos, sugerir } from './_email-campos.js';
import { linksDoCorpo } from './_email-render.js';
import { usosNaAgenda } from './_email-agenda.js';
import { modeloEmAgendadas } from './_email-campanhas.js';

const MAX_NOME = 100;
const MAX_ASSUNTO = 200;
const MAX_PREVIA = 200;
const MAX_CORPO = 20000;

const agora = () => Math.floor(Date.now() / 1000);
const COLUNAS = 'id, nome, canal, assunto, previa, corpo, arquivado, criado_em, atualizado_em';

/**
 * Onde cada modelo é usado. Cada issue que liga modelos a algo (agenda 379,
 * campanhas 383, fluxos 385) acrescenta aqui a própria consulta:
 * async (env, id) => ['confirmação da agenda (Sessão estratégica)', ...].
 */
export const consultasDeUso = [usosNaAgenda, modeloEmAgendadas];

export async function usosDoModelo(env, id) {
  const listas = await Promise.all(consultasDeUso.map((c) => c(env, Number(id))));
  return [...new Set(listas.flat())];
}

const textoUso = (usos) => `Este modelo está em uso em: ${usos.join(', ')}.`;

export class ErroModelo extends Error {
  constructor(mensagem, status = 400) { super(mensagem); this.status = status; }
}

export async function listarModelos(env) {
  const { results } = await env.DB.prepare(`SELECT ${COLUNAS} FROM email_modelos ORDER BY atualizado_em DESC, id DESC`).all();
  return results || [];
}

export async function obterModelo(env, id) {
  const m = Number.isInteger(Number(id)) && Number(id) > 0
    ? await env.DB.prepare(`SELECT ${COLUNAS} FROM email_modelos WHERE id = ?`).bind(Number(id)).first()
    : null;
  if (!m) throw new ErroModelo('Modelo não encontrado.', 404);
  return m;
}

const limpo = (v) => (v === null || v === undefined ? '' : String(v)).replace(/\r\n/g, '\n');

function validarCanal(canal) {
  if (!CANAIS.includes(canal)) throw new ErroModelo('Escolha o canal do modelo: transacional ou marketing.');
  return canal;
}

function validarNome(nome) {
  const n = limpo(nome).trim();
  if (!n) throw new ErroModelo('Dê um nome ao modelo.');
  if (n.length > MAX_NOME) throw new ErroModelo(`O nome passa de ${MAX_NOME} caracteres.`);
  return n;
}

/** Campos desconhecidos no canal viram erro com o campo e a sugestão. */
function validarCampos(texto, canal) {
  const ruins = desconhecidos(texto, canal);
  if (!ruins.length) return;
  const nome = ruins[0];
  const s = sugerir(nome, canal);
  throw new ErroModelo(`O campo {{${nome}}} não existe no canal ${canal}.${s ? ` Você quis dizer {{${s}}}?` : ''}`);
}

/** Link precisa começar com https:// ou ser só um campo, como {{link_reuniao}}. */
function validarLinks(corpo) {
  for (const { trecho, url } of linksDoCorpo(corpo)) {
    const soCampo = url.replace(MARCADOR, '') === '' && /\{\{/.test(url);
    if (!soCampo && !/^https:\/\/[^\s]+\.[^\s]+/i.test(url)) {
      throw new ErroModelo(`Link sem https:// em "${trecho}". Use o endereço completo, começando com https://.`);
    }
  }
}

/** Valida o conteúdo de um modelo completo. Devolve os valores limpos. */
export function validarModelo(dados) {
  const canal = validarCanal(dados.canal);
  const nome = validarNome(dados.nome);
  const assunto = limpo(dados.assunto).trim();
  const previa = limpo(dados.previa).trim();
  const corpo = limpo(dados.corpo).trim();
  if (!assunto) throw new ErroModelo('O modelo precisa de assunto.');
  if (assunto.length > MAX_ASSUNTO) throw new ErroModelo(`O assunto passa de ${MAX_ASSUNTO} caracteres.`);
  if (/\n/.test(assunto) || /\n/.test(previa)) throw new ErroModelo('Assunto e pré-visualização ficam numa linha só.');
  if (previa.length > MAX_PREVIA) throw new ErroModelo(`A pré-visualização passa de ${MAX_PREVIA} caracteres.`);
  if (!corpo) throw new ErroModelo('O modelo precisa de corpo.');
  if (corpo.length > MAX_CORPO) throw new ErroModelo(`O corpo passa de ${MAX_CORPO} caracteres.`);
  validarCampos(`${assunto}\n${previa}\n${corpo}`, canal);
  validarLinks(corpo);
  return { nome, canal, assunto, previa, corpo };
}

async function nomeLivre(env, canal, nome, ignorarId = 0) {
  const r = await env.DB.prepare('SELECT id FROM email_modelos WHERE canal = ? AND nome = ? AND id <> ?').bind(canal, nome, ignorarId).first();
  if (r) throw new ErroModelo('Já existe um modelo com esse nome neste canal.', 409);
}

const repetido = (e) => /UNIQUE/i.test(String(e && e.message));

/** Cria um modelo novo só com nome e canal (o resto se escreve no editor). */
export async function criarModelo(env, { nome, canal }) {
  const c = validarCanal(canal);
  const n = validarNome(nome);
  await nomeLivre(env, c, n);
  const t = agora();
  try {
    const r = await env.DB.prepare(
      'INSERT INTO email_modelos (nome, canal, assunto, previa, corpo, arquivado, criado_em, atualizado_em) VALUES (?, ?, \'\', \'\', \'\', 0, ?, ?)',
    ).bind(n, c, t, t).run();
    return obterModelo(env, r.meta.last_row_id);
  } catch (e) {
    if (repetido(e)) throw new ErroModelo('Já existe um modelo com esse nome neste canal.', 409);
    throw e;
  }
}

/** Grava o modelo inteiro. Trocar o canal só enquanto não está em uso. */
export async function salvarModelo(env, id, dados) {
  const atual = await obterModelo(env, id);
  const v = validarModelo(dados);
  if (v.canal !== atual.canal) {
    const usos = await usosDoModelo(env, atual.id);
    if (usos.length) throw new ErroModelo(`${textoUso(usos)} Não dá para trocar o canal.`, 409);
  }
  await nomeLivre(env, v.canal, v.nome, atual.id);
  try {
    await env.DB.prepare(
      'UPDATE email_modelos SET nome = ?, canal = ?, assunto = ?, previa = ?, corpo = ?, atualizado_em = ? WHERE id = ?',
    ).bind(v.nome, v.canal, v.assunto, v.previa, v.corpo, agora(), atual.id).run();
  } catch (e) {
    if (repetido(e)) throw new ErroModelo('Já existe um modelo com esse nome neste canal.', 409);
    throw e;
  }
  return obterModelo(env, atual.id);
}

/** "Cópia de X"; se já existir, "Cópia de X (2)", "(3)"... */
export async function duplicarModelo(env, id) {
  const m = await obterModelo(env, id);
  const base = `Cópia de ${m.nome}`.slice(0, MAX_NOME);
  let nome = base;
  for (let n = 2; await env.DB.prepare('SELECT 1 FROM email_modelos WHERE canal = ? AND nome = ?').bind(m.canal, nome).first(); n++) {
    nome = `${base.slice(0, MAX_NOME - 6)} (${n})`;
  }
  const t = agora();
  const r = await env.DB.prepare(
    'INSERT INTO email_modelos (nome, canal, assunto, previa, corpo, arquivado, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, 0, ?, ?)',
  ).bind(nome, m.canal, m.assunto, m.previa, m.corpo, t, t).run();
  return obterModelo(env, r.meta.last_row_id);
}

export async function arquivarModelo(env, id) {
  const m = await obterModelo(env, id);
  const usos = await usosDoModelo(env, m.id);
  if (usos.length) throw new ErroModelo(`${textoUso(usos)} Troque o modelo lá antes de arquivar.`, 409);
  await env.DB.prepare('UPDATE email_modelos SET arquivado = 1, atualizado_em = ? WHERE id = ?').bind(agora(), m.id).run();
  return obterModelo(env, m.id);
}

export async function desarquivarModelo(env, id) {
  const m = await obterModelo(env, id);
  await env.DB.prepare('UPDATE email_modelos SET arquivado = 0, atualizado_em = ? WHERE id = ?').bind(agora(), m.id).run();
  return obterModelo(env, m.id);
}
