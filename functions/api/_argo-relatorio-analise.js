// Análise escrita do relatório semanal do Argo, com checagem antes de
// publicar (spec-relatorio-semanal-argo.md, módulos 4 e 7; issue 407).
//
// Fluxo: a IA lê só o pacote de fatos e responde num formato fixo
// (structured outputs). A checagem (`_argo-relatorio-checagem.js`) confere a
// resposta. Reprovou: a IA recebe a lista de violações e escreve de novo, uma
// vez. Reprovou de novo: os blocos com violação saem (parcial) ou, sem o
// resumo, só a parte calculada vai ao ar (não passou). Texto reprovado nunca
// é publicado.
//
// A IA só escreve: nada aqui toca a conta de anúncios.
// Sem `ANTHROPIC_API_KEY`, o relatório sai só com a parte calculada e diz por
// quê. O cliente é injetável para os testes e para a issue 410.
import Anthropic from '@anthropic-ai/sdk';
import { CONTA } from './_argo-db.js';
import { VERSOES_INSTRUCOES, VERSAO_PADRAO, montarMensagem } from './_argo-relatorio-instrucoes.js';
import { checarAnalise, publicar } from './_argo-relatorio-checagem.js';

export const MODELO_ANALISE = 'claude-opus-5-5';

const semAnalise = (erro, extra = {}) => ({ situacao: 'sem_analise', blocos: [], removidos: [], checagem: [], erro, modelo: null, instrucoes_versao: null, uso: {}, ...extra });

export async function versaoAtiva(sql) {
  try {
    const r = await sql`SELECT instrucoes_ativa FROM argo.relatorio_config WHERE conta = ${CONTA}`;
    const v = r[0] && r[0].instrucoes_ativa;
    return VERSOES_INSTRUCOES[v] ? v : VERSAO_PADRAO;
  } catch {
    return VERSAO_PADRAO;
  }
}

/**
 * Uma chamada ao modelo. Devolve `{ saida, uso, modelo }` ou lança um erro com
 * `motivoUsuario` (recusa, resposta cortada, JSON inválido).
 */
export async function chamarModelo(cliente, instrucoes, mensagem) {
  const stream = cliente.beta.messages.stream({
    model: MODELO_ANALISE,
    max_tokens: 32000,
    // Recusa do modelo principal: o servidor refaz no modelo certo, na mesma chamada.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: { type: 'json_schema', schema: instrucoes.esquema } },
    system: [{ type: 'text', text: instrucoes.sistema, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: mensagem }],
  });
  const msg = await stream.finalMessage();
  const falha = (motivoUsuario) => Object.assign(new Error(motivoUsuario), { motivoUsuario });
  if (msg.stop_reason === 'refusal') throw falha('O modelo recusou escrever a análise.');
  if (msg.stop_reason === 'max_tokens') throw falha('A resposta do modelo veio cortada.');
  const texto = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let saida;
  try {
    saida = JSON.parse(texto);
  } catch {
    throw falha('A resposta do modelo não veio em JSON válido.');
  }
  return { saida, uso: msg.usage || {}, modelo: msg.model || MODELO_ANALISE };
}

const somarUso = (a, b) => {
  const r = { ...a };
  for (const [k, v] of Object.entries(b || {})) if (typeof v === 'number') r[k] = (r[k] || 0) + v;
  return r;
};

/**
 * Escreve, confere e decide o que vai ao ar. Nunca lança.
 * `opcoes.cliente` substitui o SDK (testes); `opcoes.versao` força uma versão
 * das instruções (issue 410).
 */
export async function analisarPacote(env, sql, pacote, opcoes = {}) {
  if (!opcoes.cliente && !(env && env.ANTHROPIC_API_KEY)) {
    return semAnalise('A chave da API da Anthropic não está configurada: o relatório saiu só com a parte calculada.');
  }
  const versao = opcoes.versao || await versaoAtiva(sql);
  const instrucoes = VERSOES_INSTRUCOES[versao] || VERSOES_INSTRUCOES[VERSAO_PADRAO];
  const cliente = opcoes.cliente || new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2 });

  const checagem = [];
  let uso = {};
  let modelo = MODELO_ANALISE;
  let anterior = null;
  let ultima = null;
  for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
    let r;
    try {
      r = await chamarModelo(cliente, instrucoes, montarMensagem(pacote, anterior));
    } catch (e) {
      if (!e.motivoUsuario) {
        // Falha de rede ou da API: sem análise nesta semana, com o motivo.
        console.error('relatorio do Argo — modelo indisponível:', e && e.message ? e.message : e);
        return semAnalise('A IA não respondeu na geração: o relatório saiu só com a parte calculada.', { checagem, instrucoes_versao: versao, uso });
      }
      const violacoes = [{ regra: 'Formato', bloco: 'formato', trecho: '', motivo: e.motivoUsuario }];
      checagem.push({ tentativa, resultado: 'reprovou', violacoes });
      anterior = { saida: {}, violacoes };
      continue;
    }
    uso = somarUso(uso, r.uso);
    modelo = r.modelo;
    const violacoes = checarAnalise(r.saida, pacote);
    checagem.push({ tentativa, resultado: violacoes.length ? 'reprovou' : 'passou', violacoes });
    ultima = { saida: r.saida, violacoes };
    if (!violacoes.length) break;
    anterior = ultima;
  }

  if (!ultima) {
    return { situacao: 'nao_passou', blocos: [], removidos: [], checagem, erro: null, modelo, instrucoes_versao: versao, uso };
  }
  const p = publicar(ultima.saida, ultima.violacoes);
  return { situacao: p.situacao, blocos: p.blocos, removidos: p.removidos, checagem, erro: null, modelo, instrucoes_versao: versao, uso };
}
