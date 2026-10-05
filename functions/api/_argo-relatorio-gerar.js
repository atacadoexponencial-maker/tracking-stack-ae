// Geração do relatório semanal do Argo (issues 405 a 407).
//
// Coleta as fontes, monta o pacote de fatos e grava uma linha nova em
// `argo.relatorios`. A análise escrita é do próprio Argo (perfil gestor-ia do
// Hermes, decisão da gestora em 05/10): o relatório nasce "aguardando_analise"
// com um pedido na fila (`argo/analise-pedidos.js`), e só o que passar na
// checagem é publicado. Com `ANTHROPIC_API_KEY` configurada, a análise é
// escrita direto pela API (`_argo-relatorio-analise.js`), com a mesma checagem. "Gerar de novo" nunca sobrescreve: a versão
// anterior da mesma semana fica marcada como substituída, com quem a substituiu.
import { CONTA } from './_argo-db.js';
import { coletarFontes } from './_argo-relatorio-fontes.js';
import { montarPacote } from './_argo-relatorio-pacote.js';
import { janelasDoRelatorio } from './_argo-relatorio-semana.js';
import { analisarPacote, versaoAtiva } from './_argo-relatorio-analise.js';

export const ROTULO_SITUACAO = {
  aguardando_analise: 'números prontos; o Argo está escrevendo a análise',
  verificada: 'análise verificada', parcial: 'análise parcial', nao_passou: 'a análise escrita não passou na checagem',
  sem_analise: 'só a parte calculada', falhou: 'falhou',
};

/** Mensagem curta do Slack: situação, até 3 destaques e o link. Pura. */
export function textoSlack(rel, link) {
  const s = rel.semana;
  if (rel.situacao === 'falhou') return `*Relatório semanal do Argo (${s.rotulo})*: não foi gerado. ${rel.erro || ''}\n${link}`.trim();
  const destaques = [];
  const p = rel.pacote;
  for (const f of p.funis || []) {
    const cpl = f.metricas.find((m) => m.metrica === 'cpl' || m.metrica === 'cpa');
    if (cpl && cpl.sinal && ['melhor', 'pior'].includes(cpl.sinal.tipo)) {
      destaques.push(`${f.nome}: ${cpl.nome} ${p.fatos[cpl.fato_id].valor_texto} (${cpl.sinal.tipo} que a ${cpl.sinal.contra === 'meta' ? 'meta' : 'média'})`);
    }
  }
  const prontos = (p.testes ? p.testes.itens : []).filter((t) => t.situacao === 'pronto');
  if (prontos.length) destaques.push(`${prontos.length} ${prontos.length === 1 ? 'teste pronto' : 'testes prontos'} para ler`);
  if (p.fontes_com_problema && p.fontes_com_problema.length) destaques.unshift(`fonte com problema: ${p.fontes_com_problema.map((x) => x.fonte).join(', ')}`);
  const lista = destaques.slice(0, 3).map((d) => `• ${d}`).join('\n');
  return `*Relatório semanal do Argo (${s.rotulo})*: ${ROTULO_SITUACAO[rel.situacao]}.${lista ? `\n${lista}` : ''}\n${link}`;
}

async function gravar(sql, linha) {
  const r = await sql`
    INSERT INTO argo.relatorios (conta, semana_inicio, semana_fim, situacao, origem, pacote, analise, removidos, checagem, erro, modelo, instrucoes_versao, uso)
    VALUES (${CONTA}, ${linha.semana.inicio}, ${linha.semana.fim}, ${linha.situacao}, ${linha.origem},
            ${JSON.stringify(linha.pacote || {})}::jsonb, ${JSON.stringify(linha.analise || [])}::jsonb,
            ${JSON.stringify(linha.removidos || [])}::jsonb, ${JSON.stringify(linha.checagem || [])}::jsonb,
            ${linha.erro || null}, ${linha.modelo || null}, ${linha.instrucoes_versao || null}, ${JSON.stringify(linha.uso || {})}::jsonb)
    RETURNING id, gerado_em
  `;
  const id = r[0].id;
  // A versão anterior da mesma semana continua guardada, marcada.
  await sql`
    UPDATE argo.relatorios SET substituido_em = now(), substituido_por = ${id}
     WHERE conta = ${CONTA} AND semana_inicio = ${linha.semana.inicio} AND id <> ${id} AND substituido_em IS NULL
  `;
  return { id: Number(id), gerado_em: r[0].gerado_em };
}

/**
 * Gera e grava o relatório da semana que termina ontem. Nunca lança: falha
 * geral vira uma linha `falhou` com o motivo, para a aba e o Slack dizerem.
 */
export async function gerarRelatorio(env, sql, { origem, hoje, cliente = null }) {
  const semana = janelasDoRelatorio(hoje).semana;
  try {
    const fontes = await coletarFontes(env, sql, hoje);
    const pacote = montarPacote(fontes);
    if (!cliente && !env.ANTHROPIC_API_KEY) {
      const versao = await versaoAtiva(sql);
      const linha = { semana, origem, pacote, situacao: 'aguardando_analise', instrucoes_versao: versao };
      const g = await gravar(sql, linha);
      await sql`INSERT INTO argo.analise_pedidos (conta, tipo, relatorio_id, versao) VALUES (${CONTA}, 'relatorio', ${g.id}, ${versao})`;
      return { ...linha, ...g };
    }
    const a = await analisarPacote(env, sql, pacote, cliente ? { cliente } : {});
    const linha = {
      semana, origem, pacote, situacao: a.situacao, analise: a.blocos, removidos: a.removidos, checagem: a.checagem,
      erro: a.erro, modelo: a.modelo, instrucoes_versao: a.instrucoes_versao, uso: a.uso,
    };
    const g = await gravar(sql, linha);
    return { ...linha, ...g };
  } catch (e) {
    // O detalhe vai só para o log: a mensagem do erro pode carregar URL ou corpo de resposta de terceiros.
    console.error('relatorio do Argo — falha na geração:', e && e.message ? e.message : e);
    const linha = { semana, origem, situacao: 'falhou', erro: 'A geração parou no meio por um erro interno. Tente gerar de novo.' };
    try {
      const g = await gravar(sql, linha);
      return { ...linha, ...g };
    } catch {
      return { ...linha, id: null };
    }
  }
}
