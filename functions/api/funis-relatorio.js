// GET  /api/funis-relatorio?key=...&situacao=ativos|todos  → lista do cadastro
// POST /api/funis-relatorio?key=...                        → grava no cadastro
//
// Cadastro de funis do relatório de marketing, para a aba "Funis do
// relatório" (spec-feedback-marketing.md). Ativos na ordem do relatório; com
// `situacao=todos`, os arquivados vêm abaixo deles.
//
// Endpoint ADITIVO: nenhum endpoint existente foi alterado. Ordem, rótulos,
// estado vazio e a marca "não existe mais no CRM" vêm prontos de
// _funis-relatorio.js; toda regra de gravação vem de
// _funis-relatorio-validacao.js — a tela só coleta e desenha.

import { montarListaFunis, trocaDePosicao, confirmacaoArquivar } from './_funis-relatorio.js';
import {
  validarFunil, precisaConfirmarEdicao, CONFIRMACAO_EDICAO, validarReativacao, validarVendaGreennUnica,
} from './_funis-relatorio-validacao.js';
import { lerOpcoesFunilCrm, ERRO_LEITURA_CRM } from './_crm-opcoes-funil.js';
import { listarFunisConhecidos } from './_funil-campanha.js';

const COLUNAS = `id, nome, tipo, funil_tracking, opcoes_crm, origem_lead, trecho_campanha,
             situacao, posicao, versao, alterado_em`;

export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const situacao = url.searchParams.get('situacao') === 'todos' ? 'todos' : 'ativos';

  // O CRM só serve para marcar opção que sumiu: falha dele não esconde a lista
  // (lerOpcoesFunilCrm nunca lança; devolve { ok: false }).
  const [consulta, crm] = await Promise.all([
    env.DB.prepare(`
      SELECT ${COLUNAS}
      FROM funis_relatorio
      ${situacao === 'todos' ? '' : "WHERE situacao = 'ativo'"}
    `).all(),
    lerOpcoesFunilCrm(env),
  ]);

  return json({
    situacao,
    ...montarListaFunis(consulta.results || [], { situacao, opcoesCrm: crm.ok ? crm.opcoes : null }),
    crm_lido: crm.ok,
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
  if (!corpo || typeof corpo !== 'object') return json({ error: 'JSON inválido' }, 400);

  const agora = Math.floor(Date.now() / 1000);
  if (corpo.acao === 'editar') return editarFunil(env, corpo, agora);
  if (corpo.acao === 'subir' || corpo.acao === 'descer') return moverFunil(env, corpo);
  if (corpo.acao === 'arquivar') return arquivarFunil(env, corpo, agora);
  if (corpo.acao === 'reativar') return reativarFunil(env, corpo, agora);
  return criarFunil(env, corpo, agora);
}

const ERRO_ALTERADO = 'Este funil foi alterado por outra pessoa. Recarregue antes de salvar.';

// --- criar ---
// Validação inteira no backend (_funis-relatorio-validacao.js), contra TODAS as
// linhas: o nome também é conferido contra os arquivados.
async function criarFunil(env, corpo, agora) {
  const [linhas, funisConhecidos, crm] = await Promise.all([
    lerLinhas(env),
    listarFunisConhecidos(env.DB),
    lerOpcoesFunilCrm(env),
  ]);
  // Sem o CRM não dá para saber se a opção existe: recusar é melhor que gravar
  // uma opção que talvez não exista mais.
  if (!crm.ok) return json({ error: ERRO_LEITURA_CRM }, 503);

  const { valor: f, erro } = validarFunil(corpo, { outros: linhas, funisConhecidos, opcoesCrm: crm.opcoes });
  if (erro) return json({ error: erro }, 400);

  // Última posição calculada no próprio INSERT, e não lida antes e gravada
  // depois: duas criações ao mesmo tempo não pegam o mesmo número.
  let r;
  try {
    r = await env.DB.prepare(`
      INSERT INTO funis_relatorio
        (nome, tipo, funil_tracking, opcoes_crm, origem_lead, trecho_campanha,
         situacao, posicao, versao, criado_em, alterado_em)
      SELECT ?, ?, ?, ?, ?, ?, 'ativo', COALESCE(MAX(posicao), 0) + 1, 1, ?, ?
      FROM funis_relatorio WHERE situacao = 'ativo'
    `).bind(
      f.nome, f.tipo, f.funil_tracking, JSON.stringify(f.opcoes_crm), f.origem_lead, f.trecho_campanha,
      agora, agora,
    ).run();
  } catch (e) {
    return conflitoVendaGreenn(env, e);
  }

  return json({ ok: true, id: r.meta ? r.meta.last_row_id : null });
}

// --- editar ---
// Concorrência otimista: a tela manda a `versao` que leu. Se outra pessoa
// gravou (ou arquivou) no meio do caminho, a versão mudou e nada é sobrescrito.
// A posição não é tocada: editar não muda a ordem do relatório.
async function editarFunil(env, corpo, agora) {
  const id = parseInt(corpo.id, 10);
  if (!Number.isFinite(id)) return json({ error: 'id obrigatório' }, 400);

  const [linhas, funisConhecidos, crm] = await Promise.all([
    lerLinhas(env),
    listarFunisConhecidos(env.DB),
    lerOpcoesFunilCrm(env),
  ]);
  const atual = linhas.find((l) => l.id === id);
  if (!atual) return json({ error: 'Funil não encontrado.' }, 404);
  if (atual.situacao !== 'ativo' || parseInt(corpo.versao, 10) !== atual.versao) {
    return json({ error: ERRO_ALTERADO }, 409);
  }
  if (!crm.ok) return json({ error: ERRO_LEITURA_CRM }, 503);

  const outros = linhas.filter((l) => l.id !== id);
  const { valor: f, erro } = validarFunil(corpo, { outros, funisConhecidos, opcoesCrm: crm.opcoes });
  if (erro) return json({ error: erro }, 400);

  // Mudança que altera números de relatórios passados: nada é gravado até quem
  // editou confirmar. Vem DEPOIS da validação — ninguém confirma algo que seria
  // recusado em seguida.
  if (corpo.confirmado !== true && precisaConfirmarEdicao(atual, f)) {
    return json({ confirmar: CONFIRMACAO_EDICAO });
  }

  // O WHERE repete a versão: entre a leitura acima e este UPDATE ainda pode
  // ter havido outra gravação.
  let r;
  try {
    r = await env.DB.prepare(`
      UPDATE funis_relatorio
      SET nome = ?, tipo = ?, funil_tracking = ?, opcoes_crm = ?, origem_lead = ?, trecho_campanha = ?,
          versao = versao + 1, alterado_em = ?
      WHERE id = ? AND versao = ? AND situacao = 'ativo'
    `).bind(
      f.nome, f.tipo, f.funil_tracking, JSON.stringify(f.opcoes_crm), f.origem_lead, f.trecho_campanha,
      agora, id, atual.versao,
    ).run();
  } catch (e) {
    return conflitoVendaGreenn(env, e);
  }
  if (!(r.meta && r.meta.changes)) return json({ error: ERRO_ALTERADO }, 409);

  return json({ ok: true, id });
}

// --- subir / descer ---
// Troca a posição com o vizinho num UPDATE só, que grava as duas linhas ou
// nenhuma: se a ordem mudou desde a leitura, o COUNT não fecha em 2 e nada é
// tocado — nunca ficam dois funis na mesma posição. `versao` e `alterado_em`
// ficam como estão: reordenar não é editar o funil, e não pode fazer a edição
// aberta por outra pessoa ser recusada.
async function moverFunil(env, corpo) {
  const id = parseInt(corpo.id, 10);
  if (!Number.isFinite(id)) return json({ error: 'id obrigatório' }, 400);

  const troca = trocaDePosicao(await lerLinhas(env), id, corpo.acao);
  if (!troca) return json({ ok: true, movido: false });

  const { a, b } = troca;
  const r = await env.DB.prepare(`
    UPDATE funis_relatorio
    SET posicao = CASE id WHEN ? THEN ? ELSE ? END
    WHERE situacao = 'ativo' AND id IN (?, ?)
      AND (SELECT COUNT(*) FROM funis_relatorio
           WHERE situacao = 'ativo' AND ((id = ? AND posicao = ?) OR (id = ? AND posicao = ?))) = 2
  `).bind(a.id, b.posicao, a.posicao, a.id, b.id, a.id, a.posicao, b.id, b.posicao).run();

  return json({ ok: true, movido: !!(r.meta && r.meta.changes) });
}

// --- arquivar ---
// Funil nunca é apagado (o trigger da migration 0039 aborta DELETE): sai da
// ordem e as posições seguintes sobem. Arquivar e compactar são UM UPDATE só,
// condicionado a o funil ainda estar ativo na posição lida: se já foi
// arquivado (dois cliques no mesmo segundo) ou a posição mudou, nenhuma linha
// é tocada. Em duas gravações separadas, a segunda não sabia QUAL requisição
// arquivou e compactava duas vezes (posições 1, 2, 2).
async function arquivarFunil(env, corpo, agora) {
  const id = parseInt(corpo.id, 10);
  if (!Number.isFinite(id)) return json({ error: 'id obrigatório' }, 400);

  const atual = (await lerLinhas(env)).find((l) => l.id === id);
  if (!atual) return json({ error: 'Funil não encontrado.' }, 404);
  if (atual.situacao !== 'ativo') return json({ ok: true, arquivado: false });

  if (corpo.confirmado !== true) return json({ confirmar: confirmacaoArquivar(atual.nome) });

  // O EXISTS é avaliado antes de qualquer linha mudar: ou arquiva e compacta
  // junto, ou não toca em nada.
  const r = await env.DB.prepare(`
    UPDATE funis_relatorio
    SET situacao    = CASE WHEN id = ? THEN 'arquivado' ELSE situacao END,
        posicao     = CASE WHEN id = ? THEN NULL ELSE posicao - 1 END,
        versao      = CASE WHEN id = ? THEN versao + 1 ELSE versao END,
        alterado_em = CASE WHEN id = ? THEN ? ELSE alterado_em END
    WHERE situacao = 'ativo' AND (id = ? OR posicao > ?)
      AND EXISTS (SELECT 1 FROM funis_relatorio WHERE id = ? AND situacao = 'ativo' AND posicao = ?)
  `).bind(id, id, id, id, agora, id, atual.posicao, id, atual.posicao).run();

  return json({ ok: true, arquivado: !!(r.meta && r.meta.changes) });
}

// --- reativar ---
// Revalida a unicidade contra os ativos (validarReativacao) e volta o funil na
// ÚLTIMA posição, calculada no próprio UPDATE.
async function reativarFunil(env, corpo, agora) {
  const id = parseInt(corpo.id, 10);
  if (!Number.isFinite(id)) return json({ error: 'id obrigatório' }, 400);

  const linhas = await lerLinhas(env);
  const alvo = linhas.find((l) => l.id === id);
  if (!alvo) return json({ error: 'Funil não encontrado.' }, 404);
  if (alvo.situacao === 'ativo') return json({ ok: true, reativado: false });

  const { erro } = validarReativacao(alvo, linhas.filter((l) => l.id !== id));
  if (erro) return json({ error: erro }, 400);

  let r;
  try {
    r = await env.DB.prepare(`
      UPDATE funis_relatorio
      SET situacao = 'ativo',
          posicao = (SELECT COALESCE(MAX(posicao), 0) + 1 FROM funis_relatorio WHERE situacao = 'ativo'),
          versao = versao + 1, alterado_em = ?
      WHERE id = ? AND situacao = 'arquivado'
    `).bind(agora, id).run();
  } catch (e) {
    return conflitoVendaGreenn(env, e);
  }

  return json({ ok: true, reativado: !!(r.meta && r.meta.changes) });
}

// Duas gravações simultâneas podem passar juntas pela validação de venda única;
// o índice único parcial da migration 0039 recusa a segunda. Devolve a mesma
// mensagem da validação (com o nome de quem ganhou) em vez de 500. Qualquer
// outro erro segue adiante.
async function conflitoVendaGreenn(env, e) {
  if (!/UNIQUE constraint failed: funis_relatorio\.tipo/.test(String(e && e.message))) throw e;
  const { erro } = validarVendaGreennUnica('venda_greenn', await lerLinhas(env));
  if (!erro) throw e;
  return json({ error: erro }, 400);
}

async function lerLinhas(env) {
  const { results } = await env.DB.prepare(`SELECT ${COLUNAS} FROM funis_relatorio`).all();
  return results || [];
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
