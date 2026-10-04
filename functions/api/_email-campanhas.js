// Campanhas de marketing (spec-email-proprio.md, módulo 6; issue 382).
//
// Rascunho → disparo (uma vez só) → envio em lotes pelo /email/batch do
// Postmark, com o e-mail de cada pessoa montado aqui. Cada destinatário vira
// uma linha em email_envios (origem 'campanha', ref_id = campanha): o webhook
// da 377 liga entregue, aberto, clicado, voltou e descadastrou a cada pessoa.
//
// Nada sai pela metade sem aviso: lote recusado para a campanha ("falhou",
// com o motivo); lote sem resposta fica "não confirmado" e não é reenviado
// (para ninguém receber duas vezes).
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.
import { lerConfig, remetente } from './_email-config.js';
import { montarEmail } from './_email-render.js';
import { STREAMS, enviarLote } from './_postmark.js';
import { validarModelo, ErroModelo } from './_email-modelos.js';
import { sqlDasRegras } from './_email-segmentos.js';
import { ymdBrt, inicioDoDiaBrt } from './_data-brt.js';

const agora = () => Math.floor(Date.now() / 1000);

/** Plano Basic do Postmark: 10 mil e-mails por mês. Se o plano mudar, muda aqui. */
export const LIMITE_MES = 10000;
const TAM_LOTE = 100;
const RESERVA_PARADA_SEG = 600;
const MAX_NOME = 100;
const SEM_ACESSO = 'Serviço de envio sem acesso. Confira a chave em Saúde das integrações.';

export class ErroCampanha extends Error {
  constructor(mensagem, status = 400) { super(mensagem); this.status = status; }
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

const daLinha = (l) => ({ ...l, segmentos: JSON.parse(l.segmentos_json || '[]') });

export async function lerCampanha(env, id) {
  const l = Number.isInteger(Number(id)) && Number(id) > 0
    ? await env.DB.prepare('SELECT * FROM email_campanhas WHERE id = ?').bind(Number(id)).first()
    : null;
  if (!l) throw new ErroCampanha('Campanha não encontrada.', 404);
  return daLinha(l);
}

/** Andamento por campanha: destinatários por situação. */
async function andamentos(env, ids) {
  if (!ids.length) return new Map();
  const r = (await env.DB.prepare(
    `SELECT campanha_id, situacao, COUNT(*) AS n FROM email_campanha_destinatarios
      WHERE campanha_id IN (${ids.map(() => '?').join(',')}) GROUP BY campanha_id, situacao`,
  ).bind(...ids).all()).results || [];
  const m = new Map();
  for (const x of r) {
    if (!m.has(x.campanha_id)) m.set(x.campanha_id, {});
    m.get(x.campanha_id)[x.situacao] = x.n;
  }
  return m;
}

function comAndamento(c, a = {}) {
  const total = Object.values(a).reduce((s, n) => s + n, 0) || c.total;
  const enviados = a.enviado || 0;
  const falhas = (a.falhou || 0) + (a.nao_confirmado || 0) + (a.nao_enviado || 0);
  const feitos = total - (a.pendente || 0) - (a.enviando || 0);
  return { ...c, total, enviados, falhas, pendentes: (a.pendente || 0) + (a.enviando || 0), percentual: total ? Math.floor((feitos / total) * 100) : 0 };
}

export async function listarCampanhas(env, { situacao = '' } = {}) {
  const linhas = ((situacao
    ? await env.DB.prepare('SELECT * FROM email_campanhas WHERE situacao = ? ORDER BY criado_em DESC, id DESC').bind(situacao).all()
    : await env.DB.prepare('SELECT * FROM email_campanhas ORDER BY criado_em DESC, id DESC').all()).results || []).map(daLinha);
  const a = await andamentos(env, linhas.map((c) => c.id));
  const contagem = (await env.DB.prepare('SELECT situacao, COUNT(*) AS n FROM email_campanhas GROUP BY situacao').all()).results || [];
  return { campanhas: linhas.map((c) => comAndamento(c, a.get(c.id))), por_situacao: Object.fromEntries(contagem.map((x) => [x.situacao, x.n])) };
}

export async function detalheCampanha(env, id) {
  const c = await lerCampanha(env, id);
  const a = await andamentos(env, [c.id]);
  return comAndamento(c, a.get(c.id));
}

/** Campanhas que já saíram (para "abriu/clicou" dos segmentos, 381). */
export async function campanhasEnviadas(env) {
  try {
    return (await env.DB.prepare(
      "SELECT id, nome FROM email_campanhas WHERE disparada_em IS NOT NULL AND situacao IN ('enviada', 'falhou') ORDER BY disparada_em DESC",
    ).all()).results || [];
  } catch {
    return []; // migration 0055 ainda não aplicada
  }
}

/** E-mails que saíram no mês de Brasília (agenda, testes e campanhas). */
export async function usoDoMes(env, t = agora()) {
  const inicio = inicioDoDiaBrt(`${ymdBrt(t).slice(0, 8)}01`);
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM email_envios WHERE message_id IS NOT NULL AND enviado_em >= ?').bind(inicio).first();
  const usados = r?.n || 0;
  return { usados, limite: LIMITE_MES, restam: Math.max(0, LIMITE_MES - usados) };
}

// ---------------------------------------------------------------------------
// Rascunho
// ---------------------------------------------------------------------------

async function modeloDaCampanha(env, modeloId, { exigir }) {
  if (!modeloId) {
    if (exigir) throw new ErroCampanha('Escolha o modelo da campanha.');
    return null;
  }
  const m = await env.DB.prepare('SELECT * FROM email_modelos WHERE id = ?').bind(Number(modeloId)).first();
  if (!m) throw new ErroCampanha('Modelo não encontrado.', 404);
  if (m.canal !== 'marketing') throw new ErroCampanha('Campanha usa só modelos do canal de marketing.');
  if (m.arquivado) throw new ErroCampanha('Este modelo está arquivado. Tire do arquivo ou escolha outro.');
  if (exigir) {
    try { validarModelo(m); } catch (e) { if (e instanceof ErroModelo) throw new ErroCampanha(`O modelo precisa de ajuste: ${e.message}`); throw e; }
  }
  return m;
}

async function segmentosValidos(env, ids, { exigir }) {
  const lista = [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!lista.length) {
    if (exigir) throw new ErroCampanha('Escolha ao menos um segmento.');
    return [];
  }
  const r = (await env.DB.prepare(`SELECT id, regras_json FROM email_segmentos WHERE id IN (${lista.map(() => '?').join(',')})`).bind(...lista).all()).results || [];
  if (r.length !== lista.length) throw new ErroCampanha('Um dos segmentos escolhidos não existe mais.');
  return r.map((s) => ({ id: s.id, regras: JSON.parse(s.regras_json || '[]') }));
}

export async function salvarCampanha(env, { id, nome, modelo_id: modeloId, segmentos, dia, hora }) {
  const n = String(nome || '').trim();
  if (!n) throw new ErroCampanha('Dê um nome à campanha.');
  if (n.length > MAX_NOME) throw new ErroCampanha(`O nome passa de ${MAX_NOME} caracteres.`);
  const t = agora();
  if (id) {
    const c = await lerCampanha(env, id);
    if (c.situacao === 'agendada') {
      // Agendada (383): edita até o horário, com tudo preenchido.
      const m = await modeloDaCampanha(env, modeloId, { exigir: true });
      const segs = await segmentosValidos(env, segmentos, { exigir: true });
      const para = dia || hora ? quandoBrt(dia, hora, t) : c.agendada_para;
      const r = await env.DB.prepare(
        "UPDATE email_campanhas SET nome = ?, modelo_id = ?, segmentos_json = ?, agendada_para = ?, atualizado_em = ? WHERE id = ? AND situacao = 'agendada'",
      ).bind(n, m.id, JSON.stringify(segs.map((s) => s.id)), para, t, c.id).run();
      if (r.meta.changes !== 1) throw new ErroCampanha('A campanha já começou a sair.', 409);
      return detalheCampanha(env, c.id);
    }
    if (c.situacao !== 'rascunho') throw new ErroCampanha('Só dá para editar campanha em rascunho ou agendada.', 409);
    const m = await modeloDaCampanha(env, modeloId, { exigir: false });
    const segs = await segmentosValidos(env, segmentos, { exigir: false });
    await env.DB.prepare('UPDATE email_campanhas SET nome = ?, modelo_id = ?, segmentos_json = ?, atualizado_em = ? WHERE id = ?')
      .bind(n, m ? m.id : null, JSON.stringify(segs.map((s) => s.id)), t, c.id).run();
    return detalheCampanha(env, c.id);
  }
  const m = await modeloDaCampanha(env, modeloId, { exigir: false });
  const segs = await segmentosValidos(env, segmentos, { exigir: false });
  const ins = await env.DB.prepare(
    "INSERT INTO email_campanhas (nome, modelo_id, segmentos_json, situacao, criado_em, atualizado_em) VALUES (?, ?, ?, 'rascunho', ?, ?)",
  ).bind(n, m ? m.id : null, JSON.stringify(segs.map((s) => s.id)), t, t).run();
  return detalheCampanha(env, ins.meta.last_row_id);
}

export async function duplicarCampanha(env, id) {
  const c = await lerCampanha(env, id);
  const t = agora();
  const ins = await env.DB.prepare(
    "INSERT INTO email_campanhas (nome, modelo_id, segmentos_json, situacao, criado_em, atualizado_em) VALUES (?, ?, ?, 'rascunho', ?, ?)",
  ).bind(`Cópia de ${c.nome}`.slice(0, MAX_NOME), c.modelo_id, c.segmentos_json, t, t).run();
  return detalheCampanha(env, ins.meta.last_row_id);
}

export async function excluirCampanha(env, id) {
  const c = await lerCampanha(env, id);
  if (c.situacao !== 'rascunho') throw new ErroCampanha('Só rascunho pode ser excluído. Campanha disparada fica no histórico.', 409);
  await env.DB.prepare("DELETE FROM email_campanhas WHERE id = ? AND situacao = 'rascunho'").bind(c.id).run();
}

// ---------------------------------------------------------------------------
// Público e resumo
// ---------------------------------------------------------------------------

/**
 * Quem os segmentos pegam, somados sem repetir pessoa (todas as situações,
 * para contar quem fica de fora e por quê).
 */
export async function publico(env, segs, t = agora()) {
  const porId = new Map();
  for (const s of segs) {
    const q = sqlDasRegras(s.regras, t);
    const r = (await env.DB.prepare(`${q.antes} SELECT c.id, c.email, c.nome, c.funil, c.situacao FROM ${q.de} WHERE ${q.onde}`).bind(...q.binds).all()).results || [];
    for (const c of r) {
      const x = porId.get(c.id);
      if (x) x.vezes++;
      else porId.set(c.id, { ...c, vezes: 1 });
    }
  }
  const todos = [...porId.values()];
  const ativos = todos.filter((c) => c.situacao === 'ativo');
  const fora = { descadastrado: 0, voltou: 0, denunciou: 0, invalido: 0 };
  for (const c of todos) if (c.situacao !== 'ativo' && c.situacao in fora) fora[c.situacao]++;
  return { ativos, fora, em_dois: todos.filter((c) => c.vezes > 1 && c.situacao === 'ativo').length };
}

const usaNome = (m) => /\{\{\s*(nome|primeiro_nome)\s*\}\}/.test(`${m.assunto}\n${m.previa}\n${m.corpo}`);

/** Resumo antes de disparar (de um rascunho ou do formulário ainda não salvo). */
export async function resumo(env, { modelo_id: modeloId, segmentos }) {
  const m = await modeloDaCampanha(env, modeloId, { exigir: true });
  const segs = await segmentosValidos(env, segmentos, { exigir: true });
  const p = await publico(env, segs);
  // Último teste deste modelo (Modelos › Mandar teste grava ref_id "modelo:<id>").
  // É conselho, não trava: o resumo avisa quando não houve teste depois da última mudança.
  const [uso, cfg, teste] = await Promise.all([usoDoMes(env), lerConfig(env), env.DB.prepare(
    "SELECT destinatario, enviado_em FROM email_envios WHERE origem = 'teste' AND ref_id = ? AND message_id IS NOT NULL ORDER BY id DESC LIMIT 1",
  ).bind(`modelo:${m.id}`).first()]);
  const recebem = p.ativos.length;
  const bloqueio = cfg.marketing_liberado !== '1' ? 'O marketing está marcado como não liberado na configuração. O disparo fica bloqueado até ligar a opção.'
    : !env.POSTMARK_SERVER_TOKEN ? SEM_ACESSO
    : !recebem ? 'Nenhum contato ativo nesses segmentos.'
    : recebem > uso.restam ? `Este envio tem ${recebem} pessoas e restam ${uso.restam} e-mails no mês. Diminua o segmento ou espere o limite renovar no dia 1º.`
    : null;
  return {
    recebem,
    em_dois: p.em_dois,
    fora: p.fora,
    sem_nome: usaNome(m) ? p.ativos.filter((c) => !String(c.nome || '').trim()).length : 0,
    assunto: m.assunto,
    remetente: remetente(cfg, 'marketing'),
    uso,
    bloqueio,
    ultimo_teste: teste ? { para: teste.destinatario, em: teste.enviado_em, antes_da_mudanca: teste.enviado_em < (m.atualizado_em || 0) } : null,
  };
}

// ---------------------------------------------------------------------------
// Disparo
// ---------------------------------------------------------------------------

/**
 * Dispara a campanha: troca rascunho → enviando uma vez só, recalcula a lista
 * de ativos e grava os destinatários (um por e-mail). Os lotes saem depois,
 * por processarEnvio.
 */
export async function disparar(env, id, t = agora()) {
  const c = await lerCampanha(env, id);
  if (c.situacao !== 'rascunho') throw new ErroCampanha('Esta campanha já foi disparada.', 409);
  const r = await resumo(env, { modelo_id: c.modelo_id, segmentos: c.segmentos });
  if (r.bloqueio) throw new ErroCampanha(r.bloqueio, 409);
  if (!(await iniciarEnvio(env, c, 'rascunho', r.assunto, t))) throw new ErroCampanha('Esta campanha já foi disparada.', 409);
  return detalheCampanha(env, c.id);
}

/**
 * Começo do envio, comum ao disparo (rascunho) e à agendada (383): troca a
 * situação uma vez só, recalcula a lista de ativos e grava os destinatários.
 * Devolve false quando outra chamada já trocou.
 */
async function iniciarEnvio(env, c, de, assunto, t) {
  const segs = await segmentosValidos(env, c.segmentos, { exigir: true });
  const p = await publico(env, segs, t);
  const troca = await env.DB.prepare(
    "UPDATE email_campanhas SET situacao = 'enviando', assunto = ?, total = ?, disparada_em = ?, atualizado_em = ? WHERE id = ? AND situacao = ?",
  ).bind(assunto, p.ativos.length, t, t, c.id, de).run();
  if (troca.meta.changes !== 1) return false;
  // O D1 aceita até 100 valores por comando: 3 por destinatário, 30 por vez.
  for (let i = 0; i < p.ativos.length; i += 30) {
    const parte = p.ativos.slice(i, i + 30);
    await env.DB.prepare(
      `INSERT OR IGNORE INTO email_campanha_destinatarios (campanha_id, contato_id, email, situacao, atualizado_em)
       VALUES ${parte.map(() => `(${c.id}, ?, ?, 'pendente', ?)`).join(', ')}`,
    ).bind(...parte.flatMap((x) => [x.id, x.email, t])).run();
  }
  return true;
}

// ---------------------------------------------------------------------------
// Agendamento (383)
// ---------------------------------------------------------------------------

const MIN_ANTECEDENCIA = 5 * 60;
const MAX_ANTECEDENCIA = 90 * 86400;

/** Dia (AAAA-MM-DD) e hora (HH:MM) de Brasília → unix, dentro da janela aceita. */
export function quandoBrt(dia, hora, t = agora()) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hora || ''));
  const zero = inicioDoDiaBrt(String(dia || ''));
  if (!m || zero === null) throw new ErroCampanha('Escolha o dia e a hora do envio.');
  const quando = zero + Number(m[1]) * 3600 + Number(m[2]) * 60;
  if (quando < t + MIN_ANTECEDENCIA) throw new ErroCampanha('Escolha um horário pelo menos 5 minutos à frente.');
  if (quando > t + MAX_ANTECEDENCIA) throw new ErroCampanha('Escolha um horário dentro dos próximos 90 dias.');
  return quando;
}

/** Rascunho → agendada. Os bloqueios de envio são conferidos de novo na hora de sair. */
export async function agendar(env, id, { dia, hora }, t = agora()) {
  const c = await lerCampanha(env, id);
  if (c.situacao !== 'rascunho') throw new ErroCampanha('Só rascunho pode ser agendado.', 409);
  await modeloDaCampanha(env, c.modelo_id, { exigir: true });
  await segmentosValidos(env, c.segmentos, { exigir: true });
  const para = quandoBrt(dia, hora, t);
  const r = await env.DB.prepare(
    "UPDATE email_campanhas SET situacao = 'agendada', agendada_para = ?, atualizado_em = ? WHERE id = ? AND situacao = 'rascunho'",
  ).bind(para, t, c.id).run();
  if (r.meta.changes !== 1) throw new ErroCampanha('Só rascunho pode ser agendado.', 409);
  return detalheCampanha(env, c.id);
}

export async function cancelarAgendada(env, id, t = agora()) {
  const c = await lerCampanha(env, id);
  const r = await env.DB.prepare(
    "UPDATE email_campanhas SET situacao = 'cancelada', cancelada_em = ?, atualizado_em = ? WHERE id = ? AND situacao = 'agendada'",
  ).bind(t, t, c.id).run();
  if (r.meta.changes !== 1) {
    throw new ErroCampanha(c.situacao === 'agendada' || c.situacao === 'enviando' ? 'A campanha já começou a sair.' : 'Só campanha agendada pode ser cancelada.', 409);
  }
  return detalheCampanha(env, c.id);
}

/**
 * Agendadas cujo horário chegou: confere os bloqueios de novo e começa o
 * envio (lista recalculada agora). O que barrar vira "falhou" com o motivo.
 */
export async function processarAgendadas(env, t = agora()) {
  const prontas = (await env.DB.prepare(
    "SELECT * FROM email_campanhas WHERE situacao = 'agendada' AND agendada_para <= ? ORDER BY agendada_para",
  ).bind(t).all()).results || [];
  let iniciadas = 0;
  for (const l of prontas) {
    const c = daLinha(l);
    let r;
    try {
      r = await resumo(env, { modelo_id: c.modelo_id, segmentos: c.segmentos });
    } catch (e) {
      if (!(e instanceof ErroCampanha)) throw e;
      r = { bloqueio: e.message };
    }
    if (r.bloqueio) {
      await env.DB.prepare("UPDATE email_campanhas SET situacao = 'falhou', motivo = ?, concluida_em = ?, atualizado_em = ? WHERE id = ? AND situacao = 'agendada'")
        .bind(`Não saiu no horário: ${r.bloqueio}`, t, t, c.id).run();
      continue;
    }
    if (await iniciarEnvio(env, c, 'agendada', r.assunto, t)) iniciadas++;
  }
  return iniciadas;
}

/** Travas: modelo e segmento usados em campanha agendada. */
export async function modeloEmAgendadas(env, modeloId) {
  try {
    const r = (await env.DB.prepare("SELECT nome FROM email_campanhas WHERE situacao = 'agendada' AND modelo_id = ? ORDER BY nome").bind(Number(modeloId)).all()).results || [];
    return r.map((x) => `campanha agendada "${x.nome}"`);
  } catch {
    return []; // migration 0056 ainda não aplicada
  }
}

export async function segmentoEmAgendadas(env, segmentoId) {
  try {
    const r = (await env.DB.prepare(
      "SELECT DISTINCT c.nome FROM email_campanhas c, json_each(c.segmentos_json) j WHERE c.situacao = 'agendada' AND j.value = ? ORDER BY c.nome",
    ).bind(Number(segmentoId)).all()).results || [];
    return r.map((x) => `campanha agendada "${x.nome}"`);
  } catch {
    return [];
  }
}

function valoresDoContato(d) {
  const nome = String(d.nome || '').trim();
  return { nome, primeiro_nome: nome.split(/\s+/)[0] || '', email: d.email, funil: d.funil || '' };
}

async function concluirSePronto(env, campanhaId, t) {
  const a = (await andamentos(env, [campanhaId])).get(campanhaId) || {};
  if ((a.pendente || 0) + (a.enviando || 0) > 0) return false;
  const c = await lerCampanha(env, campanhaId);
  const semConfirmar = a.nao_confirmado || 0;
  const falhou = c.situacao === 'falhou' || semConfirmar > 0;
  const motivo = c.situacao === 'falhou' ? c.motivo
    : semConfirmar ? `${semConfirmar} destinatários ficaram sem confirmação do serviço de envio e não foram reenviados, para ninguém receber duas vezes.` : null;
  const res = comAndamento(c, a);
  await env.DB.prepare('UPDATE email_campanhas SET situacao = ?, motivo = ?, enviados = ?, falhas = ?, concluida_em = ?, atualizado_em = ? WHERE id = ?')
    .bind(falhou ? 'falhou' : 'enviada', motivo, res.enviados, res.falhas, t, t, campanhaId).run();
  return true;
}

/** Lote recusado inteiro: a campanha para, e o que não saiu fica "não enviado". */
async function pararCampanha(env, campanhaId, motivo, t) {
  await env.DB.prepare("UPDATE email_campanhas SET situacao = 'falhou', motivo = ?, atualizado_em = ? WHERE id = ?").bind(motivo, t, campanhaId).run();
  await env.DB.prepare("UPDATE email_campanha_destinatarios SET situacao = 'nao_enviado', motivo = ?, atualizado_em = ? WHERE campanha_id = ? AND situacao IN ('pendente', 'enviando')")
    .bind(motivo, t, campanhaId).run();
}

async function enviarUmLote(env, c, modelo, cfg, t) {
  const lote = crypto.randomUUID();
  await env.DB.prepare(
    `UPDATE email_campanha_destinatarios SET situacao = 'enviando', lote = ?, atualizado_em = ?
      WHERE id IN (SELECT id FROM email_campanha_destinatarios WHERE campanha_id = ? AND situacao = 'pendente' ORDER BY id LIMIT ?)`,
  ).bind(lote, t, c.id, TAM_LOTE).run();
  const dest = (await env.DB.prepare(
    `SELECT d.id, d.email, ct.nome, ct.funil FROM email_campanha_destinatarios d
       LEFT JOIN email_contatos ct ON ct.id = d.contato_id WHERE d.lote = ? ORDER BY d.id`,
  ).bind(lote).all()).results || [];
  if (!dest.length) return false;

  const de = remetente(cfg, 'marketing');
  const resposta = cfg.resposta_marketing || null;
  const mensagens = [];
  for (const d of dest) {
    const e = montarEmail(modelo, cfg, { valores: valoresDoContato(d) });
    const ins = await env.DB.prepare(
      `INSERT INTO email_envios (canal, origem, ref_id, destinatario, assunto, situacao, erro)
       VALUES ('marketing', 'campanha', ?, ?, ?, 'falhou', 'Envio em andamento.')`,
    ).bind(String(c.id), d.email, e.assunto).run();
    d.envioId = ins.meta.last_row_id;
    const m = {
      From: de, To: d.email, Subject: e.assunto, HtmlBody: e.html, TextBody: e.texto,
      MessageStream: STREAMS.marketing, TrackOpens: true, TrackLinks: 'HtmlAndText',
      Tag: `campanha-${c.id}`, Metadata: { origem: 'campanha', envio_id: String(d.envioId), campanha_id: String(c.id) },
    };
    if (resposta) m.ReplyTo = resposta;
    mensagens.push(m);
  }

  let r;
  try {
    r = await enviarLote(env, mensagens);
  } catch {
    const motivo = 'O serviço de envio não respondeu; não reenviado para ninguém receber duas vezes.';
    await env.DB.prepare("UPDATE email_campanha_destinatarios SET situacao = 'nao_confirmado', motivo = ?, atualizado_em = ? WHERE lote = ?").bind(motivo, t, lote).run();
    for (const d of dest) await env.DB.prepare('UPDATE email_envios SET erro = ? WHERE id = ?').bind(motivo, d.envioId).run();
    return true;
  }
  if (!r.ok) {
    const motivo = r.codigo === 10 ? SEM_ACESSO : r.erro;
    for (const d of dest) await env.DB.prepare('UPDATE email_envios SET erro = ?, enviado_em = ? WHERE id = ?').bind(motivo, t, d.envioId).run();
    await pararCampanha(env, c.id, motivo, t);
    return false;
  }
  for (let i = 0; i < dest.length; i++) {
    const d = dest[i];
    const it = r.itens[i] || { ok: false, erro: 'Sem resposta do serviço para esta mensagem.' };
    if (it.ok) {
      await env.DB.prepare("UPDATE email_envios SET message_id = ?, situacao = 'enviado', erro = NULL, enviado_em = ? WHERE id = ?").bind(it.messageId, t, d.envioId).run();
      await env.DB.prepare("UPDATE email_campanha_destinatarios SET situacao = 'enviado', envio_id = ?, motivo = NULL, atualizado_em = ? WHERE id = ?").bind(d.envioId, t, d.id).run();
    } else {
      await env.DB.prepare('UPDATE email_envios SET erro = ?, enviado_em = ? WHERE id = ?').bind(it.erro, t, d.envioId).run();
      await env.DB.prepare("UPDATE email_campanha_destinatarios SET situacao = 'falhou', envio_id = ?, motivo = ?, atualizado_em = ? WHERE id = ?").bind(d.envioId, it.erro, t, d.id).run();
    }
  }
  return true;
}

/**
 * Manda os lotes pendentes das campanhas "enviando" (ou de uma só). Chamado
 * logo depois do disparo (waitUntil) e pela rodada de 5 minutos.
 */
export async function processarEnvio(env, { campanhaId = null, lotes = 3, t = agora() } = {}) {
  const resumoRodada = { campanhas: 0, lotes: 0 };
  // Lote reservado há mais de 10 min sem resultado: não dá para saber se saiu.
  await env.DB.prepare(
    "UPDATE email_campanha_destinatarios SET situacao = 'nao_confirmado', motivo = ?, atualizado_em = ? WHERE situacao = 'enviando' AND atualizado_em < ?",
  ).bind('O envio foi interrompido sem confirmação; não reenviado para ninguém receber duas vezes.', t, t - RESERVA_PARADA_SEG).run();
  const campanhas = (campanhaId
    ? await env.DB.prepare("SELECT * FROM email_campanhas WHERE id = ? AND situacao = 'enviando'").bind(Number(campanhaId)).all()
    : await env.DB.prepare("SELECT * FROM email_campanhas WHERE situacao = 'enviando' ORDER BY disparada_em").all()).results || [];
  if (!campanhas.length) return resumoRodada;
  const cfg = await lerConfig(env);
  for (const c of campanhas) {
    resumoRodada.campanhas++;
    const modelo = await env.DB.prepare('SELECT * FROM email_modelos WHERE id = ?').bind(c.modelo_id).first();
    if (!modelo) { await pararCampanha(env, c.id, 'O modelo da campanha não existe mais.', t); continue; }
    for (let i = 0; i < lotes; i++) {
      const seguiu = await enviarUmLote(env, c, modelo, cfg, t);
      if (!seguiu) break;
      resumoRodada.lotes++;
    }
    await concluirSePronto(env, c.id, t);
  }
  return resumoRodada;
}
