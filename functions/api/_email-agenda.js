// E-mails da agenda (spec-email-proprio.md, módulo 3; issue 379).
//
// Configuração por tipo de reunião (agenda_emails) e uma fila por reunião
// (agenda_emails_fila). Quem marca, remarca ou cancela chama
// `emailsDaMudanca`, que programa a fila e já manda o que é para agora
// (confirmação, remarcação, cancelamento). Os lembretes saem pela rodada
// /api/sync/email-agenda (cron na VPS a cada 5 minutos).
//
// Antes de cada envio a fila reconfere a reunião e a configuração: o que
// mudou depois da programação vira "não enviado" com o motivo.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.
import { SITUACOES_ATIVAS } from './_agenda-regras.js';
import { lerReuniao, lerTipo, linkGestao } from './_agenda.js';
import { FUSO_BRT } from './_data-brt.js';
import { lerConfig } from './_email-config.js';
import { montarEmail } from './_email-render.js';
import { enviarERegistrar } from './_email-envio.js';

const agora = () => Math.floor(Date.now() / 1000);

export const EVENTOS = ['confirmacao', 'lembrete', 'remarcacao', 'cancelamento'];
/** Antecedências aceitas para lembrete, em minutos. */
export const ANTECEDENCIAS = [2880, 1440, 720, 180, 120, 60, 30, 15];
const MAX_TENTATIVAS = 3;
const RESERVA_PARADA_SEG = 600;

// Modelos semeados pela migration 0052 (procurados pelo nome).
const MODELO_PADRAO = {
  confirmacao: 'Confirmação de reunião',
  remarcacao: 'Reunião remarcada',
  cancelamento: 'Reunião cancelada',
  lembreteLongo: 'Lembrete 24h antes',
  lembreteCurto: 'Lembrete 1h antes',
};
const PADRAO = [
  { evento: 'confirmacao', antes_min: 0, modelo: MODELO_PADRAO.confirmacao },
  { evento: 'lembrete', antes_min: 1440, modelo: MODELO_PADRAO.lembreteLongo },
  { evento: 'lembrete', antes_min: 60, modelo: MODELO_PADRAO.lembreteCurto },
  { evento: 'remarcacao', antes_min: 0, modelo: MODELO_PADRAO.remarcacao },
  { evento: 'cancelamento', antes_min: 0, modelo: MODELO_PADRAO.cancelamento },
];

export class ErroEmailAgenda extends Error {
  constructor(mensagem, status = 400) { super(mensagem); this.status = status; }
}

// ---------------------------------------------------------------------------
// Nomes
// ---------------------------------------------------------------------------

export const rotuloAntes = (min) => (min >= 60 ? `${min / 60} h` : `${min} min`);

export function nomeDoEmail(evento, antesMin) {
  return {
    confirmacao: 'Confirmação',
    lembrete: `Lembrete ${rotuloAntes(antesMin)} antes`,
    remarcacao: 'Remarcação',
    cancelamento: 'Cancelamento',
  }[evento] || evento;
}

const QUANDO = {
  confirmacao: 'logo que o lead confirma o horário',
  remarcacao: 'quando a reunião muda de horário',
  cancelamento: 'quando a reunião é cancelada',
};
const quandoSai = (evento, antesMin) => QUANDO[evento] || `${rotuloAntes(antesMin)} antes da reunião`;

const dataHoraCurta = (ts) => new Date(ts * 1000).toLocaleString('pt-BR', { timeZone: FUSO_BRT, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');

// ---------------------------------------------------------------------------
// Configuração por tipo
// ---------------------------------------------------------------------------

async function modeloPorNome(env, nome) {
  const m = await env.DB.prepare("SELECT id FROM email_modelos WHERE canal = 'transacional' AND nome = ? AND arquivado = 0").bind(nome).first();
  if (m) return m.id;
  const qualquer = await env.DB.prepare("SELECT id FROM email_modelos WHERE canal = 'transacional' AND arquivado = 0 ORDER BY id LIMIT 1").first();
  return qualquer ? qualquer.id : null;
}

const ORDEM_SQL = `ORDER BY CASE evento WHEN 'confirmacao' THEN 0 WHEN 'lembrete' THEN 1 WHEN 'remarcacao' THEN 2 ELSE 3 END, antes_min DESC`;

/** Configuração do tipo; na primeira leitura cria a padrão (os cinco e-mails ligados). */
export async function configDoTipo(env, tipoId) {
  const ler = async () => (await env.DB.prepare(
    `SELECT id, tipo_id, evento, antes_min, modelo_id, ligado FROM agenda_emails WHERE tipo_id = ? ${ORDEM_SQL}`,
  ).bind(Number(tipoId)).all()).results || [];
  let linhas = await ler();
  if (!linhas.length) {
    const t = agora();
    for (const p of PADRAO) {
      const modeloId = await modeloPorNome(env, p.modelo);
      if (!modeloId) continue; // sem modelo transacional nenhum: nada a configurar
      await env.DB.prepare(
        'INSERT OR IGNORE INTO agenda_emails (tipo_id, evento, antes_min, modelo_id, ligado, criado_em, atualizado_em) VALUES (?, ?, ?, ?, 1, ?, ?)',
      ).bind(Number(tipoId), p.evento, p.antes_min, modeloId, t, t).run();
    }
    linhas = await ler();
  }
  return linhas.map((l) => ({ ...l, nome: nomeDoEmail(l.evento, l.antes_min), quando: quandoSai(l.evento, l.antes_min) }));
}

async function validarModeloDaAgenda(env, modeloId) {
  const m = await env.DB.prepare('SELECT id, canal, arquivado FROM email_modelos WHERE id = ?').bind(Number(modeloId)).first();
  if (!m) throw new ErroEmailAgenda('Modelo não encontrado.', 404);
  if (m.canal !== 'transacional') throw new ErroEmailAgenda('A agenda só usa modelos do canal transacional.');
  if (m.arquivado) throw new ErroEmailAgenda('Este modelo está arquivado. Tire do arquivo antes de usar.');
  return m.id;
}

async function linhaDaConfig(env, id) {
  const l = await env.DB.prepare('SELECT * FROM agenda_emails WHERE id = ?').bind(Number(id)).first();
  if (!l) throw new ErroEmailAgenda('E-mail da agenda não encontrado.', 404);
  return l;
}

/** Liga, desliga ou troca o modelo de um e-mail da agenda. Devolve o tipo_id. */
export async function salvarEmailDaAgenda(env, { id, ligado, modelo_id: modeloId }) {
  const l = await linhaDaConfig(env, id);
  const novoModelo = modeloId !== undefined && modeloId !== null ? await validarModeloDaAgenda(env, modeloId) : l.modelo_id;
  const novoLigado = ligado === undefined || ligado === null ? l.ligado : (ligado === true || ligado === 1 || ligado === '1' ? 1 : 0);
  await env.DB.prepare('UPDATE agenda_emails SET modelo_id = ?, ligado = ?, atualizado_em = ? WHERE id = ?')
    .bind(novoModelo, novoLigado, agora(), l.id).run();
  return l.tipo_id;
}

export async function adicionarLembrete(env, { tipo_id: tipoId, antes_min: antesMin }) {
  const tipo = await lerTipo(env, { id: Number(tipoId) });
  if (!tipo) throw new ErroEmailAgenda('Tipo de reunião não encontrado.', 404);
  const min = Number(antesMin);
  if (!ANTECEDENCIAS.includes(min)) throw new ErroEmailAgenda('Escolha uma antecedência da lista.');
  await configDoTipo(env, tipo.id);
  const existe = await env.DB.prepare("SELECT 1 FROM agenda_emails WHERE tipo_id = ? AND evento = 'lembrete' AND antes_min = ?").bind(tipo.id, min).first();
  if (existe) throw new ErroEmailAgenda('Este lembrete já existe neste tipo.', 409);
  const modeloId = await modeloPorNome(env, min >= 720 ? MODELO_PADRAO.lembreteLongo : MODELO_PADRAO.lembreteCurto);
  if (!modeloId) throw new ErroEmailAgenda('Crie um modelo transacional antes de adicionar lembretes.', 409);
  const t = agora();
  await env.DB.prepare(
    "INSERT INTO agenda_emails (tipo_id, evento, antes_min, modelo_id, ligado, criado_em, atualizado_em) VALUES (?, 'lembrete', ?, ?, 1, ?, ?)",
  ).bind(tipo.id, min, modeloId, t, t).run();
  return tipo.id;
}

export async function tirarLembrete(env, { id }) {
  const l = await linhaDaConfig(env, id);
  if (l.evento !== 'lembrete') throw new ErroEmailAgenda('Só lembretes podem ser tirados. Os outros e-mails se desligam.');
  await env.DB.prepare('DELETE FROM agenda_emails WHERE id = ?').bind(l.id).run();
  return l.tipo_id;
}

/** Onde o modelo é usado na agenda (trava de arquivar e de trocar canal, 378). */
export async function usosNaAgenda(env, modeloId) {
  try {
    const r = (await env.DB.prepare(
      `SELECT a.evento, a.antes_min, t.nome FROM agenda_emails a JOIN agenda_tipos t ON t.id = a.tipo_id
        WHERE a.modelo_id = ? ORDER BY t.nome, a.evento, a.antes_min DESC`,
    ).bind(Number(modeloId)).all()).results || [];
    return r.map((u) => `${u.evento === 'lembrete' ? `lembrete de ${rotuloAntes(u.antes_min)}` : nomeDoEmail(u.evento).toLowerCase()} da agenda (${u.nome})`);
  } catch {
    return []; // migration 0052 ainda não aplicada
  }
}

// ---------------------------------------------------------------------------
// Programação
// ---------------------------------------------------------------------------

async function inserirNaFila(env, reuniaoId, linha, inicioRef, enviarEm, t, pulado = null) {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO agenda_emails_fila
       (reuniao_id, agenda_email_id, evento, antes_min, inicio_ref, enviar_em, situacao, motivo, tentativas, criado_em, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  ).bind(reuniaoId, linha.id, linha.evento, linha.antes_min, inicioRef, enviarEm, pulado ? 'pulado' : 'pendente', pulado, t, t).run();
}

async function programarLembretes(env, reuniao, config, t) {
  for (const l of config.filter((c) => c.evento === 'lembrete' && c.ligado)) {
    const enviarEm = reuniao.inicio - l.antes_min * 60;
    await inserirNaFila(env, reuniao.id, l, reuniao.inicio, enviarEm, t,
      enviarEm <= t ? 'O horário do lembrete já tinha passado.' : null);
  }
}

async function pularPendentes(env, reuniaoId, motivo, t, soLembretes = true) {
  await env.DB.prepare(
    `UPDATE agenda_emails_fila SET situacao = 'pulado', motivo = ?, atualizado_em = ?
      WHERE reuniao_id = ? AND situacao = 'pendente'${soLembretes ? " AND evento = 'lembrete'" : ''}`,
  ).bind(motivo, t, reuniaoId).run();
}

/**
 * Programa os e-mails de uma reunião depois que ela nasce ou muda.
 * motivo: 'agendou' | 'remarcou' | 'cancelou'. Lê a reunião de novo no banco
 * (depois de remarcar, o horário já é o novo).
 */
export async function programarEmails(env, reuniaoId, motivo, t = agora()) {
  const reuniao = await lerReuniao(env, { id: reuniaoId });
  if (!reuniao) return;
  const config = await configDoTipo(env, reuniao.tipo_id);
  const doEvento = (ev) => config.find((c) => c.evento === ev && c.ligado);

  if (motivo === 'agendou') {
    const c = doEvento('confirmacao');
    if (c) await inserirNaFila(env, reuniao.id, c, reuniao.inicio, t, t);
    await programarLembretes(env, reuniao, config, t);
  } else if (motivo === 'remarcou') {
    await pularPendentes(env, reuniao.id, 'Reunião remarcada.', t);
    const c = doEvento('remarcacao');
    if (c) await inserirNaFila(env, reuniao.id, c, reuniao.inicio, t, t);
    await programarLembretes(env, reuniao, config, t);
  } else if (motivo === 'cancelou') {
    await pularPendentes(env, reuniao.id, 'Reunião cancelada.', t, false);
    const c = doEvento('cancelamento');
    if (c) await inserirNaFila(env, reuniao.id, c, reuniao.inicio, t, t);
  }
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

const DIA_SEMANA = (ts) => new Date(ts * 1000).toLocaleDateString('pt-BR', { timeZone: FUSO_BRT, weekday: 'long' }).replace('-feira', '');

/** Campos do canal transacional preenchidos com os dados da reunião. */
export function valoresDaReuniao(reuniao, tipo) {
  const nome = String(reuniao.nome || '').trim();
  return {
    nome,
    primeiro_nome: nome.split(/\s+/)[0] || '',
    email: reuniao.email,
    tipo_reuniao: tipo?.nome || '',
    data_reuniao: `${DIA_SEMANA(reuniao.inicio)}, ${new Date(reuniao.inicio * 1000).toLocaleDateString('pt-BR', { timeZone: FUSO_BRT, day: '2-digit', month: '2-digit' })}`,
    hora_reuniao: new Date(reuniao.inicio * 1000).toLocaleTimeString('pt-BR', { timeZone: FUSO_BRT, hour: '2-digit', minute: '2-digit' }),
    link_reuniao: reuniao.meet_link || '',
    link_remarcar: linkGestao(reuniao.token_gestao),
  };
}

/** Motivo para NÃO mandar agora (reunião ou configuração mudou), ou null. */
function motivoParaPular(item, reuniao, linha, t) {
  if (!reuniao) return 'Reunião não encontrada.';
  if (!linha) return 'Lembrete tirado em Agenda › E-mails.';
  if (!linha.ligado) return 'Desligado em Agenda › E-mails.';
  const ativa = SITUACOES_ATIVAS.includes(reuniao.situacao);
  if (item.evento === 'cancelamento') return reuniao.situacao === 'cancelada' ? null : 'A reunião não está cancelada.';
  if (reuniao.situacao === 'cancelada') return 'Reunião cancelada.';
  if (!ativa) return 'A reunião já aconteceu.';
  if (reuniao.inicio !== item.inicio_ref) return 'Reunião remarcada.';
  if (item.evento === 'lembrete' && t >= reuniao.inicio) return 'A reunião já tinha começado.';
  return null;
}

async function fechar(env, id, situacao, motivo, envioId, t) {
  await env.DB.prepare('UPDATE agenda_emails_fila SET situacao = ?, motivo = ?, envio_id = COALESCE(?, envio_id), atualizado_em = ? WHERE id = ?')
    .bind(situacao, motivo, envioId ?? null, t, id).run();
}

/**
 * Manda o que já chegou na hora. `reuniaoId` restringe a uma reunião (logo
 * depois de agendar, remarcar ou cancelar). Devolve o resumo da rodada.
 */
export async function processarFila(env, { reuniaoId = null, limite = 30, t = agora() } = {}) {
  const resumo = { enviados: 0, pulados: 0, falhas: 0, adiados: 0 };
  // Reserva parada (rodada que caiu no meio) volta para a fila.
  await env.DB.prepare("UPDATE agenda_emails_fila SET situacao = 'pendente', atualizado_em = ? WHERE situacao = 'enviando' AND atualizado_em < ?")
    .bind(t, t - RESERVA_PARADA_SEG).run();
  const itens = (await env.DB.prepare(
    `SELECT * FROM agenda_emails_fila WHERE situacao = 'pendente' AND enviar_em <= ?${reuniaoId ? ' AND reuniao_id = ?' : ''}
      ORDER BY enviar_em, id LIMIT ?`,
  ).bind(...(reuniaoId ? [t, reuniaoId, limite] : [t, limite])).all()).results || [];
  if (!itens.length) return resumo;

  const cfg = await lerConfig(env);
  for (const item of itens) {
    // Reserva: só quem trocou pendente → enviando manda (cron e waitUntil juntos).
    const reserva = await env.DB.prepare("UPDATE agenda_emails_fila SET situacao = 'enviando', atualizado_em = ? WHERE id = ? AND situacao = 'pendente'")
      .bind(t, item.id).run();
    if (reserva.meta.changes !== 1) continue;

    const reuniao = await lerReuniao(env, { id: item.reuniao_id });
    const linha = await env.DB.prepare('SELECT * FROM agenda_emails WHERE id = ?').bind(item.agenda_email_id).first();
    const pular = motivoParaPular(item, reuniao, linha, t);
    if (pular) { await fechar(env, item.id, 'pulado', pular, null, t); resumo.pulados++; continue; }

    const modelo = await env.DB.prepare('SELECT * FROM email_modelos WHERE id = ?').bind(linha.modelo_id).first();
    if (!modelo || !modelo.assunto || !modelo.corpo) {
      await fechar(env, item.id, 'falhou', 'O modelo escolhido está sem assunto ou sem corpo.', null, t);
      resumo.falhas++;
      continue;
    }
    const tipo = await lerTipo(env, { id: reuniao.tipo_id });
    const e = montarEmail(modelo, cfg, { valores: valoresDaReuniao(reuniao, tipo) });
    const r = await enviarERegistrar(env, {
      canal: 'transacional', origem: 'agenda', refId: reuniao.id, para: reuniao.email,
      assunto: e.assunto, html: e.html, texto: e.texto, tag: `agenda-${item.evento}`, cfg,
    });
    if (r.ok) { await fechar(env, item.id, 'enviado', null, r.envioId, t); resumo.enviados++; continue; }
    if (r.semResposta) {
      const tentativas = item.tentativas + 1;
      if (tentativas >= MAX_TENTATIVAS) {
        await env.DB.prepare("UPDATE agenda_emails_fila SET situacao = 'falhou', motivo = ?, tentativas = ?, atualizado_em = ? WHERE id = ?")
          .bind('O serviço de envio não respondeu em três tentativas.', tentativas, t, item.id).run();
        resumo.falhas++;
      } else {
        await env.DB.prepare("UPDATE agenda_emails_fila SET situacao = 'pendente', tentativas = ?, atualizado_em = ? WHERE id = ?")
          .bind(tentativas, t, item.id).run();
        resumo.adiados++;
      }
      continue;
    }
    await fechar(env, item.id, 'falhou', r.erro, r.envioId, t);
    resumo.falhas++;
  }
  return resumo;
}

/**
 * Chamado por quem marca, remarca ou cancela: programa e manda o que é para
 * agora. Nunca lança: o agendamento do lead não falha por causa do e-mail.
 */
export async function emailsDaMudanca(env, reuniaoId, motivo) {
  try {
    await programarEmails(env, reuniaoId, motivo);
    await processarFila(env, { reuniaoId });
  } catch (e) {
    console.error('agenda: e-mails', motivo, e.message);
  }
}

// ---------------------------------------------------------------------------
// Leitura para o dash e para o aviso
// ---------------------------------------------------------------------------

const SITUACAO_FILA = { pendente: 'agendado', enviando: 'agendado', pulado: 'nao_enviado', falhou: 'falhou' };

/** "E-mails desta reunião" no detalhe do agendamento. */
export async function emailsDaReuniao(env, reuniaoId) {
  try {
    const r = (await env.DB.prepare(
      `SELECT f.evento, f.antes_min, f.enviar_em, f.situacao, f.motivo, e.situacao AS envio_situacao, e.enviado_em, e.erro
         FROM agenda_emails_fila f LEFT JOIN email_envios e ON e.id = f.envio_id
        WHERE f.reuniao_id = ? ORDER BY f.enviar_em, f.id`,
    ).bind(reuniaoId).all()).results || [];
    return r.map((x) => ({
      nome: nomeDoEmail(x.evento, x.antes_min),
      quando: x.enviado_em || x.enviar_em,
      situacao: x.situacao === 'enviado' ? x.envio_situacao || 'enviado' : SITUACAO_FILA[x.situacao],
      motivo: x.motivo || (x.envio_situacao === 'voltou' ? 'O endereço não recebeu o e-mail (voltou). Vale confirmar o e-mail com o lead.' : null),
    }));
  } catch {
    return []; // migration 0052 ainda não aplicada
  }
}

/** Itens do aviso de integrações: falhas e devoluções das últimas 24 h, sem dado pessoal. */
export async function falhasRecentes(env, t = agora()) {
  try {
    const desde = t - 86400;
    const r = (await env.DB.prepare(
      `SELECT f.evento, f.antes_min, f.inicio_ref, f.situacao, f.motivo, e.situacao AS envio_situacao, tp.nome AS tipo
         FROM agenda_emails_fila f
         JOIN agenda_reunioes r ON r.id = f.reuniao_id
         JOIN agenda_tipos tp ON tp.id = r.tipo_id
         LEFT JOIN email_envios e ON e.id = f.envio_id
        WHERE (f.situacao = 'falhou' AND f.atualizado_em >= ?)
           OR (e.situacao IN ('voltou', 'spam') AND COALESCE(e.voltou_em, e.spam_em) >= ?)
        ORDER BY f.atualizado_em DESC LIMIT 20`,
    ).bind(desde, desde).all()).results || [];
    return r.map((x) => `${nomeDoEmail(x.evento, x.antes_min)} · ${x.tipo} · ${dataHoraCurta(x.inicio_ref)}: ${
      x.situacao === 'falhou' ? x.motivo : x.envio_situacao === 'spam' ? 'marcado como spam' : 'voltou'}`);
  } catch {
    return []; // migration 0052 ainda não aplicada
  }
}
