// Agenda de ações de grupo: validar, criar, cancelar, listar e EXECUTAR.
// Spec: docs/superpowers/specs/2026-09-17-gestao-grupos-whatsapp-design.md
//
// A execução mora aqui, e não no endpoint, porque ela tem DOIS gatilhos: o
// cron (ações vencidas) e o botão "fazer agora" do painel. Um caminho de
// código só é o que garante que o que se testa clicando é o que roda às 12h.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

import { enviarTexto, renomear } from './_evolution-grupos.js';

// Passado isto da hora marcada, a ação NÃO dispara mais. Um aviso de live
// chegando quatro horas depois é pior que não chegar: a live já acabou, e
// quem recebe aprende que o aviso não vale.
export const ATRASO_MAX_SEG = 30 * 60;

// Só para 'renomear', que é idempotente. Mensagem nunca retenta — ver finalizar().
export const MAX_TENTATIVAS = 3;

export const TEXTO_MAX = 4000;
export const TITULO_MAX = 100;

const TIPOS = new Set(['mensagem', 'renomear']);

/**
 * Regras de uma ação nova. Pura de propósito: é onde a validação fica
 * testável sem banco, e é a única validação que existe — o formulário do
 * painel não valida nada (thin client).
 */
export function validarAcao(corpo, grupo, agora) {
  if (!grupo) return { erro: 'Esse grupo não está na lista de grupos monitorados.' };

  const tipo = String(corpo?.tipo || '').trim();
  if (!TIPOS.has(tipo)) return { erro: 'Tipo de ação desconhecido. Use "mensagem" ou "renomear".' };

  const quando = Number(corpo?.agendada_para);
  if (!Number.isFinite(quando)) return { erro: 'Informe a data e a hora.' };
  if (quando < agora) return { erro: 'Essa hora já passou — escolha um horário no futuro.' };

  let payload;
  if (tipo === 'mensagem') {
    const texto = String(corpo?.texto ?? '').trim();
    if (!texto) return { erro: 'Escreva o texto da mensagem.' };
    if (texto.length > TEXTO_MAX) return { erro: `A mensagem passou de ${TEXTO_MAX} caracteres.` };
    payload = { texto };
  } else {
    const titulo = String(corpo?.titulo ?? '').trim();
    if (!titulo) return { erro: 'Escreva o novo título do grupo.' };
    if (titulo.length > TITULO_MAX) return { erro: `O título passou de ${TITULO_MAX} caracteres.` };
    const noPar = !!corpo?.aplicar_no_par;
    // Sem parent_jid conferido, aplicar no par seria adivinhar qual é o outro
    // grupo — e renomear o grupo errado é justamente o dano que a allowlist
    // existe para impedir.
    if (noPar && !grupo.parent_jid) {
      return { erro: 'O grupo par (Comunidade) ainda não foi identificado para este grupo. Renomeie só este por enquanto.' };
    }
    payload = { titulo, aplicar_no_par: noPar };
  }

  return { acao: { group_jid: grupo.group_jid, tipo, payload: JSON.stringify(payload), agendada_para: quando } };
}

/** Grupo da allowlist, com o par. Fonte única de "em que grupo posso agir". */
export async function grupoMonitorado(env, jid) {
  return env.DB.prepare(
    'SELECT group_jid, label, parent_jid FROM whatsapp_groups_tracked WHERE group_jid = ? AND enabled = 1'
  ).bind(String(jid || '')).first();
}

export async function criarAcao(env, corpo, agora) {
  const grupo = await grupoMonitorado(env, corpo?.group_jid);
  const v = validarAcao(corpo, grupo, agora);
  if (v.erro) return { erro: v.erro, status: 400 };

  const r = await env.DB.prepare(
    `INSERT INTO whatsapp_group_actions (group_jid, tipo, payload, agendada_para, status, criada_em)
     VALUES (?, ?, ?, ?, 'agendada', ?)`
  ).bind(v.acao.group_jid, v.acao.tipo, v.acao.payload, v.acao.agendada_para, agora).run();

  return { id: r.meta.last_row_id, acao: v.acao };
}

/**
 * Cancela enquanto ainda está 'agendada'. O WHERE carrega a regra: uma ação
 * que já entrou em execução não volta atrás, e dizer "cancelei" nesse caso
 * seria mentir para quem clicou.
 */
export async function cancelarAcao(env, id) {
  const n = parseInt(id, 10);
  if (!Number.isFinite(n)) return { ok: false, erro: 'id inválido' };
  const r = await env.DB.prepare(
    "UPDATE whatsapp_group_actions SET status = 'cancelada' WHERE id = ? AND status = 'agendada'"
  ).bind(n).run();
  if (r.meta.changes === 0) return { ok: false, erro: 'Essa ação não está mais agendada — ou já saiu, ou já foi cancelada.' };
  return { ok: true };
}

/** O que vai acontecer e o que já aconteceu, com o rótulo do grupo resolvido. */
export async function listarAcoes(env, agora) {
  const campos = `a.id, a.group_jid, a.tipo, a.payload, a.agendada_para, a.status,
                  a.tentativas, a.erro, a.resultado, a.executada_em,
                  COALESCE(g.label, a.group_jid) AS label`;
  const juncao = 'FROM whatsapp_group_actions a LEFT JOIN whatsapp_groups_tracked g ON g.group_jid = a.group_jid';

  const agendadas = await env.DB.prepare(
    `SELECT ${campos} ${juncao} WHERE a.status IN ('agendada','executando') ORDER BY a.agendada_para ASC`
  ).all();
  // Histórico curto de propósito: é para responder "saiu?", não para virar
  // relatório. Tabela grande na tela custa leitura do D1 sem servir a ninguém.
  const historico = await env.DB.prepare(
    `SELECT ${campos} ${juncao} WHERE a.status IN ('concluida','falhou','cancelada')
     ORDER BY COALESCE(a.executada_em, a.agendada_para) DESC LIMIT 30`
  ).all();

  return { agora, agendadas: (agendadas.results || []).map(comPayload), historico: (historico.results || []).map(comPayload) };
}

// O payload chega do banco como texto; a tela não deveria precisar saber disso.
function comPayload(l) {
  let p = {};
  try { p = JSON.parse(l.payload || '{}'); } catch { p = {}; }
  return { ...l, payload: p };
}

/**
 * Executa UMA ação. Os dois gatilhos (cron e botão "fazer agora") passam por
 * aqui — é o que garante que testar clicando testa o que roda às 12h.
 *
 * Devolve sempre um objeto, nunca lança: uma ação quebrada não pode derrubar
 * a rodada inteira nem o endpoint.
 */
export async function executarAcao(env, id, agora, fetchImpl = fetch) {
  const n = parseInt(id, 10);
  if (!Number.isFinite(n)) return { id, status: 'ignorada', erro: 'id inválido' };

  // TRAVA DE CORRIDA. A reserva é a própria condição do UPDATE: se zero linhas
  // mudaram, outra passada do cron já pegou esta ação e está executando. Sem
  // isto, um cron lento sobrepondo o seguinte manda a mesma mensagem duas
  // vezes para o grupo inteiro — o dano que não tem desfazer.
  const reserva = await env.DB.prepare(
    "UPDATE whatsapp_group_actions SET status = 'executando' WHERE id = ? AND status = 'agendada'"
  ).bind(n).run();
  if (reserva.meta.changes === 0) return { id: n, status: 'ignorada' };

  const acao = await env.DB.prepare('SELECT * FROM whatsapp_group_actions WHERE id = ?').bind(n).first();
  if (!acao) return { id: n, status: 'ignorada' };

  // JANELA DE ATRASO. Passou de 30 min da hora marcada (VPS caiu, deploy
  // travado, fila parada), a ação não sai. Aviso de live que chega depois da
  // live é pior que aviso nenhum.
  const atraso = agora - acao.agendada_para;
  if (atraso > ATRASO_MAX_SEG) {
    return finalizar(env, acao, agora, {
      ok: false,
      erro: `Não foi executada: venceu há ${Math.round(atraso / 60)} min e passou da janela de ${ATRASO_MAX_SEG / 60} min.`,
      atrasada: true,
    });
  }

  let payload = {};
  try { payload = JSON.parse(acao.payload || '{}'); } catch { payload = {}; }

  let resultado;
  if (acao.tipo === 'mensagem') {
    resultado = await enviarTexto(env, acao.group_jid, payload.texto, fetchImpl);
    if (resultado.ok) resultado.resumo = 'Mensagem enviada.';
  } else if (acao.tipo === 'renomear') {
    resultado = await renomearGrupo(env, acao, payload, fetchImpl);
  } else {
    resultado = { ok: false, erro: `Tipo de ação desconhecido: ${acao.tipo}` };
  }

  return finalizar(env, acao, agora, resultado);
}

// Renomeia o grupo e, se pedido, o par da Comunidade. Os dois grupos vêm com
// o mesmo nome: renomear só um deixa a Comunidade com metade do título velho,
// e isso passa despercebido porque o WhatsApp mostra os dois em lugares
// diferentes. Sequencial, não em paralelo: são duas escritas no mesmo número,
// e a Evolution responde melhor a uma de cada vez.
async function renomearGrupo(env, acao, payload, fetchImpl) {
  const alvos = [acao.group_jid];
  if (payload.aplicar_no_par) {
    const grupo = await grupoMonitorado(env, acao.group_jid);
    if (!grupo?.parent_jid) return { ok: false, erro: 'O grupo par não está identificado — renomeio só este.' };
    alvos.push(grupo.parent_jid);
  }
  const feitos = [];
  for (const jid of alvos) {
    const r = await renomear(env, jid, payload.titulo, fetchImpl);
    if (!r.ok) return { ok: false, erro: `${r.erro} (já renomeados: ${feitos.length} de ${alvos.length})` };
    feitos.push(jid);
  }
  return { ok: true, resumo: feitos.length > 1 ? 'Grupo e par renomeados.' : 'Grupo renomeado.' };
}

/**
 * Grava o desfecho. Aqui mora a regra de retentativa, e ela é assimétrica de
 * propósito:
 *
 * - `mensagem` NUNCA volta para a fila. Reenviar para centenas de pessoas é
 *   como um erro vira dano irreversível, e "não tenho certeza se saiu" é
 *   exatamente o caso em que ele acontece. Falhou, fica vermelho, a decisão é
 *   humana.
 * - `renomear` volta, até MAX_TENTATIVAS. É idempotente: aplicar duas vezes dá
 *   o mesmo grupo com o mesmo nome.
 * - Ação atrasada nunca volta, seja qual for o tipo — o problema dela é a
 *   hora, e ela só ficaria mais atrasada.
 */
async function finalizar(env, acao, agora, resultado) {
  const tentativas = (acao.tentativas || 0) + 1;

  if (resultado.ok) {
    await env.DB.prepare(
      "UPDATE whatsapp_group_actions SET status='concluida', tentativas=?, erro=NULL, resultado=?, executada_em=? WHERE id=?"
    ).bind(tentativas, resultado.resumo || 'Concluída.', agora, acao.id).run();
    return { id: acao.id, status: 'concluida', resultado: resultado.resumo };
  }

  const podeRetentar = acao.tipo === 'renomear' && !resultado.atrasada && tentativas < MAX_TENTATIVAS;
  const status = podeRetentar ? 'agendada' : 'falhou';

  await env.DB.prepare(
    'UPDATE whatsapp_group_actions SET status=?, tentativas=?, erro=?, executada_em=? WHERE id=?'
  ).bind(status, tentativas, resultado.erro, podeRetentar ? null : agora, acao.id).run();

  return { id: acao.id, status, erro: resultado.erro, tentativas };
}

/**
 * Todas as ações vencidas, uma a uma. Sequencial de propósito: são escritas no
 * mesmo número de WhatsApp, e disparar em paralelo é justamente o padrão de
 * tráfego que faz a Meta olhar torto para um número.
 *
 * Uma ação que falha não interrompe as outras — senão uma mensagem quebrada
 * seguraria o renomear da semana seguinte.
 */
export async function executarVencidas(env, agora, fetchImpl = fetch) {
  const { results } = await env.DB.prepare(
    "SELECT id FROM whatsapp_group_actions WHERE status = 'agendada' AND agendada_para <= ? ORDER BY agendada_para ASC LIMIT 20"
  ).bind(agora).all();

  const executadas = [];
  for (const { id } of results || []) {
    try {
      executadas.push(await executarAcao(env, id, agora, fetchImpl));
    } catch (e) {
      console.error('grupos-acoes: ação', id, 'quebrou:', e?.message || e);
      executadas.push({ id, status: 'falhou', erro: String(e?.message || e) });
    }
  }

  return {
    executadas,
    total: executadas.filter((e) => e.status !== 'ignorada').length,
    falhas: executadas.filter((e) => e.status === 'falhou').length,
  };
}
