// Registro e leitura do horário das integrações (spec-protecoes-integracoes.md, módulo 2).
// Regras puras em _horario-fontes.js.
//
// Barato por construção: cada evento atualiza UMA linha de resumo (fonte, hora);
// suspeitos entram numa amostra limitada. Ler a aba e avaliar o critério usam só
// os resumos das últimas 24 h — nunca os eventos originais.

import {
  FONTES, AMOSTRA_SUSPEITOS, lerHorario, desvioMin, ehSuspeito, somarEvento, juntar, avaliarFonte,
} from './_horario-fontes.js';

const RETENCAO_SEG = 30 * 86400;

/**
 * Registra o horário informado por uma fonte. Nunca lança: o evento segue o
 * processamento normal mesmo se isto falhar.
 * `ref`: identificador do evento, sem dado pessoal.
 */
export async function registrarHorario(env, fonte, informado, { chegadaMs = Date.now(), ref = '' } = {}) {
  if (!env.DB || !FONTES[fonte]) return;
  try {
    const informadoMs = lerHorario(informado);
    const desvio = informadoMs === null ? null : desvioMin(informadoMs, chegadaMs);
    const hora = Math.floor(chegadaMs / 3600000) * 3600;

    const linha = await env.DB.prepare(
      'SELECT eventos, sem_horario, suspeitos, hist, horas FROM integracao_horario_resumo WHERE fonte = ? AND hora = ?'
    ).bind(fonte, hora).first();
    const resumo = linha
      ? { eventos: linha.eventos, sem_horario: linha.sem_horario, suspeitos: linha.suspeitos, hist: JSON.parse(linha.hist || '[]'), horas: JSON.parse(linha.horas || '{}') }
      : undefined;
    const novo = somarEvento(resumo, fonte, desvio);
    await env.DB.prepare(
      `INSERT INTO integracao_horario_resumo (fonte, hora, eventos, sem_horario, suspeitos, hist, horas)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(fonte, hora) DO UPDATE SET eventos = excluded.eventos, sem_horario = excluded.sem_horario,
         suspeitos = excluded.suspeitos, hist = excluded.hist, horas = excluded.horas`
    ).bind(fonte, hora, novo.eventos, novo.sem_horario, novo.suspeitos, JSON.stringify(novo.hist), JSON.stringify(novo.horas)).run();

    if (desvio !== null && ehSuspeito(fonte, desvio)) {
      await env.DB.prepare(
        'INSERT INTO integracao_horario_suspeitos (fonte, informado, chegada, desvio_min, ref) VALUES (?, ?, ?, ?, ?)'
      ).bind(fonte, Math.floor(informadoMs / 1000), Math.floor(chegadaMs / 1000), desvio, String(ref || '').slice(0, 120)).run();
      await env.DB.prepare(
        `DELETE FROM integracao_horario_suspeitos WHERE fonte = ? AND id <= (
           SELECT id FROM integracao_horario_suspeitos WHERE fonte = ? ORDER BY id DESC LIMIT 1 OFFSET ?)`
      ).bind(fonte, fonte, AMOSTRA_SUSPEITOS).run();
    }
  } catch (e) {
    console.error(`horário: falha ao registrar (${fonte})`, e.message);
  }
}

/** Avaliação de todas as fontes visíveis sobre as últimas 24 h. */
export async function avaliarFontes(env, agora = Math.floor(Date.now() / 1000)) {
  const { results } = await env.DB.prepare(
    'SELECT fonte, eventos, sem_horario, suspeitos, hist, horas FROM integracao_horario_resumo WHERE hora >= ?'
  ).bind(agora - 24 * 3600).all();
  const porFonte = {};
  for (const r of results) {
    (porFonte[r.fonte] = porFonte[r.fonte] || []).push({
      eventos: r.eventos, sem_horario: r.sem_horario, suspeitos: r.suspeitos,
      hist: JSON.parse(r.hist || '[]'), horas: JSON.parse(r.horas || '{}'),
    });
  }
  const { results: ultimos } = await env.DB.prepare(
    `SELECT s.fonte, s.informado, s.chegada, s.desvio_min FROM integracao_horario_suspeitos s
      WHERE s.id = (SELECT MAX(id) FROM integracao_horario_suspeitos WHERE fonte = s.fonte)`
  ).all();
  const ultimoPorFonte = Object.fromEntries(ultimos.map((u) => [u.fonte, u]));

  const lista = [];
  for (const [fonte, cfg] of Object.entries(FONTES)) {
    if (cfg.oculta) continue;
    const resumo = juntar(porFonte[fonte] || []);
    const a = avaliarFonte(resumo);
    const item = {
      fonte, rotulo: cfg.rotulo, eventos: resumo.eventos, semHorario: resumo.sem_horario,
      suspeitos: resumo.suspeitos, medianaMin: a.medianaMin, fracaoSuspeitos: a.fracaoSuspeitos,
      situacao: a.situacao, diagnostico: a.diagnostico, ultimoSuspeito: ultimoPorFonte[fonte] || null,
    };
    if (cfg.correcao) {
      const depois = avaliarFonte(juntar(porFonte[cfg.correcao] || []));
      item.depoisDaCorrecao = { medianaMin: depois.medianaMin, situacao: depois.situacao };
      // O defeito da fonte existe, mas a correção já o resolve: sem alerta.
      if (a.situacao === 'suspeito' && depois.situacao !== 'suspeito') {
        item.situacao = 'corrigido';
        item.diagnostico = `${a.diagnostico} Defeito conhecido, corrigido na entrada.`;
      } else if (depois.situacao === 'suspeito') {
        item.situacao = 'suspeito';
        item.diagnostico = 'Continua deslocado mesmo depois da correção.';
      }
    }
    lista.push(item);
  }
  return lista;
}

export async function suspeitosDaFonte(env, fonte) {
  const { results } = await env.DB.prepare(
    'SELECT informado, chegada, desvio_min, ref FROM integracao_horario_suspeitos WHERE fonte = ? ORDER BY id DESC LIMIT 20'
  ).bind(fonte).all();
  return results;
}

export async function limparHorarioAntigo(env, agora = Math.floor(Date.now() / 1000)) {
  await env.DB.prepare('DELETE FROM integracao_horario_resumo WHERE hora < ?').bind(agora - RETENCAO_SEG).run();
}
