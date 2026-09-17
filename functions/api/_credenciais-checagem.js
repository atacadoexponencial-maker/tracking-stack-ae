// Rodada de checagem das credenciais (spec-protecoes-integracoes.md, módulo 1).
// Regras puras em _credenciais.js. Aqui: testes de aceitação, banco e trava.
//
// NUNCA grava, loga ou devolve valor de credencial. A resposta dos serviços é
// reduzida a status/categoria antes de qualquer uso.

import { CATALOGO, examinarForma, situacaoDoItem } from './_credenciais.js';

export const INTERVALO_AUTOMATICO_SEG = 24 * 3600;
export const INTERVALO_MANUAL_SEG = 60;
const TRAVA_SEG = 120;
const TIMEOUT_MS = 8000;

async function comTempoLimite(promessa) {
  let t;
  const limite = new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS); });
  try { return await Promise.race([promessa, limite]); } finally { clearTimeout(t); }
}

// Meta: consulta o próprio pixel com o token. Sem efeito colateral.
async function testarMeta(env, fetchImpl) {
  try {
    const r = await comTempoLimite(fetchImpl(
      `https://graph.facebook.com/v25.0/${String(env.META_PIXEL_ID_2).trim()}?fields=id&access_token=${String(env.META_ACCESS_TOKEN_2).trim()}`
    ));
    if (r.ok) return 'aceita';
    if (r.status >= 500 || r.status === 429) return 'sem_resposta';
    return 'recusada';
  } catch {
    return 'sem_resposta';
  }
}

// ClickUp: quem é o dono do token. Sem efeito colateral.
async function testarClickUp(env, fetchImpl) {
  try {
    const r = await comTempoLimite(fetchImpl('https://api.clickup.com/api/v2/user', {
      headers: { Authorization: String(env.CLICKUP_API_TOKEN).trim() },
    }));
    if (r.ok) return 'aceita';
    if (r.status >= 500 || r.status === 429) return 'sem_resposta';
    return 'recusada';
  } catch {
    return 'sem_resposta';
  }
}

/**
 * Executa uma rodada. `origem`: 'automatica' | 'manual'.
 * Devolve { executada, motivo?, total, problemas, mudancas: [{nome, de, para}] }.
 */
export async function executarChecagem(env, { origem = 'automatica', agora = Math.floor(Date.now() / 1000), fetchImpl = fetch } = {}) {
  const ultima = await env.DB.prepare(
    'SELECT iniciada_em, terminada_em FROM credenciais_rodadas ORDER BY iniciada_em DESC LIMIT 1'
  ).first();
  if (ultima && !ultima.terminada_em && agora - ultima.iniciada_em < TRAVA_SEG) {
    return { executada: false, motivo: 'Já existe uma checagem em andamento.' };
  }
  if (origem === 'manual' && ultima && agora - ultima.iniciada_em < INTERVALO_MANUAL_SEG) {
    return { executada: false, motivo: 'Aguarde um minuto para checar de novo.' };
  }

  const ins = await env.DB.prepare(
    `INSERT INTO credenciais_rodadas (iniciada_em, origem, total, problemas) VALUES (?, ?, 0, 0)`
  ).bind(agora, origem).run();
  const rodadaId = ins.meta?.last_row_id;

  const { results: anteriores } = await env.DB.prepare(
    'SELECT nome, situacao, desde, nao_confirmado_seguidas FROM credenciais_estado'
  ).all();
  const antes = Object.fromEntries(anteriores.map((a) => [a.nome, a]));

  const formas = Object.fromEntries(CATALOGO.map((item) => [item.nome, examinarForma(env[item.nome], item)]));
  const limpa = (...nomes) => nomes.every((n) => formas[n].length === 0);

  // Testes de aceitação só quando a forma está limpa (o defeito já explica a falha).
  const aceitacao = {};
  if (limpa('META_PIXEL_ID_2', 'META_ACCESS_TOKEN_2')) {
    aceitacao.meta = await testarMeta(env, fetchImpl);
  }
  if (limpa('CLICKUP_API_TOKEN')) {
    aceitacao.clickup = await testarClickUp(env, fetchImpl);
  }

  let problemas = 0;
  const mudancas = [];
  for (const item of CATALOGO) {
    const anterior = antes[item.nome];
    const r = situacaoDoItem(item, formas[item.nome], item.teste ? aceitacao[item.teste] : undefined, {
      automatica: origem === 'automatica',
      naoConfirmadoAntes: anterior?.nao_confirmado_seguidas || 0,
    });
    if (r.situacao === 'problema') problemas++;
    const desde = anterior && anterior.situacao === r.situacao ? anterior.desde : agora;
    if (anterior && anterior.situacao !== r.situacao) mudancas.push({ nome: item.nome, de: anterior.situacao, para: r.situacao });
    await env.DB.prepare(
      `INSERT INTO credenciais_estado (nome, integracao, situacao, motivos, nota, desde, checado_em, nao_confirmado_seguidas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(nome) DO UPDATE SET integracao = excluded.integracao, situacao = excluded.situacao,
         motivos = excluded.motivos, nota = excluded.nota, desde = excluded.desde,
         checado_em = excluded.checado_em, nao_confirmado_seguidas = excluded.nao_confirmado_seguidas`
    ).bind(item.nome, item.integracao, r.situacao, JSON.stringify(r.motivos), r.nota || null, desde, agora,
      r.naoConfirmadoSeguidas ?? 0).run();
    if (r.situacao === 'problema') console.warn(`credencial com problema: ${item.nome} (${r.motivos.length} motivo(s))`);
  }

  // Itens que saíram do catálogo não ficam assombrando a tela.
  const nomes = CATALOGO.map((c) => c.nome);
  for (const nome of Object.keys(antes)) {
    if (!nomes.includes(nome)) await env.DB.prepare('DELETE FROM credenciais_estado WHERE nome = ?').bind(nome).run();
  }

  await env.DB.prepare('UPDATE credenciais_rodadas SET total = ?, problemas = ?, terminada_em = ? WHERE id = ?')
    .bind(CATALOGO.length, problemas, Math.floor(Date.now() / 1000), rodadaId).run();

  return { executada: true, total: CATALOGO.length, problemas, mudancas };
}

/** Roda a checagem automática se a última automática tiver mais de 24 h. */
export async function talvezChecarAutomatico(env, agora = Math.floor(Date.now() / 1000), fetchImpl = fetch) {
  const ult = await env.DB.prepare(
    `SELECT MAX(iniciada_em) AS ts FROM credenciais_rodadas WHERE origem = 'automatica'`
  ).first();
  if (ult?.ts && agora - ult.ts < INTERVALO_AUTOMATICO_SEG) return { executada: false, motivo: 'fora do horário' };
  return executarChecagem(env, { origem: 'automatica', agora, fetchImpl });
}

/** Estado atual para a aba e para o alerta. */
export async function lerCredenciais(env) {
  const { results } = await env.DB.prepare(
    'SELECT nome, integracao, situacao, motivos, nota, desde, checado_em FROM credenciais_estado'
  ).all();
  const ordem = { problema: 0, nao_confirmado: 1, ok: 2, nao_se_aplica: 3 };
  const itens = results.map((r) => ({ ...r, motivos: JSON.parse(r.motivos || '[]') }))
    .sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || a.integracao.localeCompare(b.integracao) || a.nome.localeCompare(b.nome));
  const rodada = await env.DB.prepare(
    'SELECT iniciada_em, origem, total, problemas, terminada_em FROM credenciais_rodadas ORDER BY iniciada_em DESC LIMIT 1'
  ).first();
  return { itens, ultimaRodada: rodada || null };
}
