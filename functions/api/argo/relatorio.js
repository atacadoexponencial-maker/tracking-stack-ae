// GET  /api/argo/relatorio?key=...                 — relatório mais recente + histórico + qualidade
// GET  /api/argo/relatorio?key=...&id=N            — um relatório (inclusive substituído)
// GET  /api/argo/relatorio?key=...&comparar=A,B    — duas semanas lado a lado
// POST /api/argo/relatorio?key=...                 — acao: gerar | reagir | decidir
//
// Issues 405 a 409 (spec-relatorio-semanal-argo.md, módulos 3 a 7). A geração
// mora em `_argo-relatorio-gerar.js`; a montagem e as validações em
// `_argo-relatorio-leitura.js`. A aba só desenha.
import { conectar, CONTA } from '../_argo-db.js';
import { recusarSemChave } from '../_argo-auth.js';
import { hojeBrt } from '../_argo-contexto.js';
import { gerarRelatorio } from '../_argo-relatorio-gerar.js';
import { compararPacotes } from '../_argo-relatorio-comparar.js';
import { montarRelatorio, montarHistorico, montarQualidade, validarReacao, validarDecisao } from '../_argo-relatorio-leitura.js';

const erro = (mensagem, status) => Response.json({ erro: mensagem }, { status });

async function lerUm(sql, id) {
  const r = await sql`SELECT * FROM argo.relatorios WHERE conta = ${CONTA} AND id = ${id}`;
  if (!r.length) return null;
  const [reacoes, decisoes] = await Promise.all([
    sql`SELECT bloco, tipo, comentario FROM argo.relatorio_reacoes WHERE relatorio_id = ${id}`,
    sql`SELECT sugestao_chave, decisao, motivo, teste_id FROM argo.sugestoes_decisoes WHERE relatorio_id = ${id}`,
  ]);
  return montarRelatorio(r[0], reacoes, decisoes);
}

async function lerPainel(sql, id) {
  const [historico, qualidade] = await Promise.all([
    sql`SELECT id, semana_inicio, semana_fim, situacao, origem, gerado_em, substituido_em, erro,
               (pacote -> 'marcas' -> 'atipica') IS NOT NULL AND (pacote -> 'marcas' -> 'atipica') <> 'null'::jsonb AS atipica
          FROM argo.relatorios WHERE conta = ${CONTA}
         ORDER BY semana_inicio DESC, id DESC LIMIT 60`,
    sql`SELECT r.id, r.semana_inicio,
               count(*) FILTER (WHERE x.tipo = 'util') AS util,
               count(*) FILTER (WHERE x.tipo = 'obvio') AS obvio,
               count(*) FILTER (WHERE x.tipo = 'errado') AS errado
          FROM argo.relatorios r LEFT JOIN argo.relatorio_reacoes x ON x.relatorio_id = r.id
         WHERE r.conta = ${CONTA} AND r.substituido_em IS NULL AND r.situacao IN ('verificada', 'parcial')
         GROUP BY r.id, r.semana_inicio
         ORDER BY r.semana_inicio DESC LIMIT 12`,
  ]);
  let alvo = id;
  if (!alvo) {
    const atual = historico.find((h) => !h.substituido_em);
    alvo = atual ? atual.id : null;
  }
  return {
    relatorio: alvo ? await lerUm(sql, alvo) : null,
    historico: montarHistorico(historico),
    qualidade: montarQualidade(qualidade),
  };
}

export async function onRequestGet({ request, env }) {
  const recusa = recusarSemChave(request, env);
  if (recusa) return recusa;
  const url = new URL(request.url);
  try {
    const sql = conectar(env);
    const comparar = url.searchParams.get('comparar');
    if (comparar) {
      const [a, b] = comparar.split(',').map(Number);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) return erro('Escolha duas semanas diferentes.', 400);
      const r = await sql`SELECT id, pacote FROM argo.relatorios WHERE conta = ${CONTA} AND id IN (${a}, ${b})`;
      const pa = r.find((x) => Number(x.id) === a);
      const pb = r.find((x) => Number(x.id) === b);
      if (!pa || !pb || !pa.pacote.funis || !pb.pacote.funis) return erro('Uma das semanas não tem números para comparar.', 404);
      return Response.json({ comparacao: compararPacotes(pa.pacote, pb.pacote) });
    }
    const id = url.searchParams.get('id') ? Number(url.searchParams.get('id')) : null;
    if (id !== null && (!Number.isInteger(id) || id <= 0)) return erro('Relatório inválido.', 400);
    const painel = await lerPainel(sql, id);
    if (id && !painel.relatorio) return erro('Relatório não encontrado.', 404);
    return Response.json(painel);
  } catch {
    return erro('Não foi possível ler o relatório agora.', 500);
  }
}

export async function onRequestPost({ request, env }) {
  const recusa = recusarSemChave(request, env);
  if (recusa) return recusa;
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return erro('Corpo inválido.', 400);
  }
  try {
    const sql = conectar(env);
    if (corpo.acao === 'gerar') {
      const r = await gerarRelatorio(env, sql, { origem: 'manual', hoje: hojeBrt() });
      return Response.json(await lerPainel(sql, r.id || null));
    }

    if (corpo.acao === 'reagir') {
      const rel = await sql`SELECT id, analise, substituido_em FROM argo.relatorios WHERE conta = ${CONTA} AND id = ${Number(corpo.relatorio_id) || 0}`;
      if (!rel.length) return erro('Relatório não encontrado.', 404);
      const blocos = (rel[0].analise || []).map((b) => b.chave);
      const v = validarReacao(corpo, blocos);
      if (!v.ok) return erro(v.erro, 400);
      const x = v.valores;
      await sql`
        INSERT INTO argo.relatorio_reacoes (relatorio_id, bloco, tipo, comentario)
        VALUES (${x.relatorio_id}, ${x.bloco}, ${x.tipo}, ${x.comentario})
        ON CONFLICT (relatorio_id, bloco) DO UPDATE SET tipo = EXCLUDED.tipo, comentario = EXCLUDED.comentario, atualizado_em = now()
      `;
      return Response.json(await lerPainel(sql, x.relatorio_id));
    }

    if (corpo.acao === 'decidir') {
      const rel = await sql`SELECT id, analise FROM argo.relatorios WHERE conta = ${CONTA} AND id = ${Number(corpo.relatorio_id) || 0}`;
      if (!rel.length) return erro('Relatório não encontrado.', 404);
      const v = validarDecisao(corpo, rel[0].analise);
      if (!v.ok) return erro(v.erro, 400);
      const ja = await sql`SELECT id FROM argo.sugestoes_decisoes WHERE relatorio_id = ${v.valores.relatorio_id} AND sugestao_chave = ${v.valores.chave}`;
      if (ja.length) return erro('Este teste proposto já foi decidido.', 409);
      let testeId = null;
      if (v.teste) {
        // Entra como planejado, sem os lados: a gestora escolhe os anúncios ao editar, antes de iniciar.
        const t = v.teste;
        const novo = await sql`
          INSERT INTO argo.testes (conta, nome, tipo, funil, situacao, hipotese, mudou, metrica, criterio, origem, relatorio_id, sugestao_chave)
          VALUES (${CONTA}, ${t.nome}, ${t.tipo}, ${t.funil}, 'planejado', ${t.hipotese}, ${t.mudou}, ${t.metrica}, ${t.criterio}, 'relatorio', ${v.valores.relatorio_id}, ${v.valores.chave})
          RETURNING id
        `;
        testeId = novo[0].id;
        await sql`INSERT INTO argo.testes_historico (teste_id, texto) VALUES (${testeId}, 'Criado a partir de um teste proposto pelo relatório semanal. Escolha os lados antes de iniciar.')`;
      }
      await sql`
        INSERT INTO argo.sugestoes_decisoes (relatorio_id, sugestao_chave, decisao, motivo, teste_id)
        VALUES (${v.valores.relatorio_id}, ${v.valores.chave}, ${v.valores.decisao}, ${v.valores.motivo}, ${testeId})
      `;
      return Response.json(await lerPainel(sql, v.valores.relatorio_id));
    }
    return erro('Ação desconhecida.', 400);
  } catch {
    return erro('Não foi possível concluir agora.', 500);
  }
}
