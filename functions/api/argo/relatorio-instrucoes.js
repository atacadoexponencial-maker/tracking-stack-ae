// GET  /api/argo/relatorio-instrucoes?key=...  — versões das instruções, a que vale e os testes feitos
// POST /api/argo/relatorio-instrucoes?key=...  — acao: testar { versao } | ativar { versao }
//
// Issue 410. Antes de uma versão nova das instruções da análise valer, ela
// escreve de novo as últimas semanas guardadas e passa pela mesma checagem
// (`_argo-relatorio-avaliacao.js`). "Ativar" só aceita versão com teste
// aprovado. Sem chave da API, o teste vira pedidos na fila e o próprio Argo
// reescreve as semanas (resultado em até algumas dezenas de minutos).
import { conectar, CONTA } from '../_argo-db.js';
import { recusarSemChave } from '../_argo-auth.js';
import { VERSOES_INSTRUCOES } from '../_argo-relatorio-instrucoes.js';
import { analisarPacote, versaoAtiva } from '../_argo-relatorio-analise.js';
import { avaliarCandidata } from '../_argo-relatorio-avaliacao.js';

const SEMANAS_NO_TESTE = 4;
const erro = (m, s) => Response.json({ erro: m }, { status: s });

async function estado(sql) {
  const [ativa, avaliacoes] = await Promise.all([
    versaoAtiva(sql),
    sql`SELECT id, versao, versao_base, situacao, resultado, criado_em, ativada_em FROM argo.instrucoes_avaliacoes WHERE conta = ${CONTA} ORDER BY criado_em DESC LIMIT 20`,
  ]);
  return {
    ativa,
    versoes: Object.entries(VERSOES_INSTRUCOES).map(([v, x]) => ({ versao: v, descricao: x.descricao })),
    avaliacoes: avaliacoes.map((a) => ({ id: Number(a.id), versao: a.versao, versao_base: a.versao_base, situacao: a.situacao, resultado: a.resultado, criado_em: new Date(a.criado_em).toISOString(), ativada_em: a.ativada_em ? new Date(a.ativada_em).toISOString() : null })),
  };
}

export async function onRequestGet({ request, env }) {
  const recusa = recusarSemChave(request, env);
  if (recusa) return recusa;
  try {
    return Response.json(await estado(conectar(env)));
  } catch {
    return erro('Não foi possível ler as instruções agora.', 500);
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
  const versao = String(corpo.versao || '');
  if (!VERSOES_INSTRUCOES[versao]) return erro('Versão de instruções desconhecida.', 400);
  try {
    const sql = conectar(env);
    const ativa = await versaoAtiva(sql);
    if (corpo.acao === 'ativar') {
      const ok = await sql`SELECT id FROM argo.instrucoes_avaliacoes WHERE conta = ${CONTA} AND versao = ${versao} AND situacao = 'aprovada' ORDER BY criado_em DESC LIMIT 1`;
      if (!ok.length && versao !== ativa) return erro('Esta versão ainda não passou no teste das semanas passadas.', 409);
      await sql`
        INSERT INTO argo.relatorio_config (conta, instrucoes_ativa) VALUES (${CONTA}, ${versao})
        ON CONFLICT (conta) DO UPDATE SET instrucoes_ativa = EXCLUDED.instrucoes_ativa, atualizada_em = now()`;
      if (ok.length) await sql`UPDATE argo.instrucoes_avaliacoes SET ativada_em = now() WHERE id = ${ok[0].id}`;
      return Response.json(await estado(sql));
    }
    if (corpo.acao !== 'testar') return erro('Ação desconhecida.', 400);
    if (versao === ativa) return erro('Esta já é a versão que vale.', 409);

    const rels = await sql`
      SELECT id, pacote, analise, situacao FROM argo.relatorios
       WHERE conta = ${CONTA} AND substituido_em IS NULL AND situacao IN ('verificada', 'parcial', 'nao_passou')
       ORDER BY semana_inicio DESC LIMIT ${SEMANAS_NO_TESTE}`;
    if (!rels.length) return erro('Não há semanas guardadas com análise para comparar.', 409);

    // Sem chave da API: quem reescreve as semanas é o próprio Argo, pela fila.
    // O resultado sai quando o último pedido for conferido (argo/analise-pedidos.js).
    if (!env.ANTHROPIC_API_KEY) {
      const pend = await sql`SELECT id FROM argo.instrucoes_avaliacoes WHERE conta = ${CONTA} AND versao = ${versao} AND situacao = 'pendente'`;
      if (pend.length) return erro('Já há um teste desta versão esperando o Argo.', 409);
      const av = await sql`
        INSERT INTO argo.instrucoes_avaliacoes (conta, versao, versao_base, situacao) VALUES (${CONTA}, ${versao}, ${ativa}, 'pendente') RETURNING id`;
      for (const r of rels) {
        await sql`INSERT INTO argo.analise_pedidos (conta, tipo, relatorio_id, avaliacao_id, versao) VALUES (${CONTA}, 'avaliacao', ${r.id}, ${av[0].id}, ${versao})`;
      }
      return Response.json(await estado(sql));
    }

    const semanas = [];
    for (const r of rels) {
      const errados = (await sql`SELECT bloco FROM argo.relatorio_reacoes WHERE relatorio_id = ${r.id} AND tipo = 'errado'`).map((x) => x.bloco);
      const candidata = await analisarPacote(env, sql, r.pacote, { versao });
      semanas.push({ relatorio_id: Number(r.id), rotulo: r.pacote.semana ? r.pacote.semana.rotulo : '', publicado: { situacao: r.situacao, analise: r.analise }, errados, candidata });
    }
    const resultado = avaliarCandidata(semanas);
    await sql`
      INSERT INTO argo.instrucoes_avaliacoes (conta, versao, versao_base, situacao, resultado)
      VALUES (${CONTA}, ${versao}, ${ativa}, ${resultado.situacao}, ${JSON.stringify(resultado)}::jsonb)`;
    return Response.json(await estado(sql));
  } catch {
    return erro('Não foi possível concluir agora.', 500);
  }
}
