// GET  /api/argo/analise-pedidos   — o próximo pedido de análise, com a consulta pronta
// POST /api/argo/analise-pedidos   — a resposta do Argo para um pedido
// Autenticação: `Authorization: Bearer <ARGO_KEY>` (ver `_argo-auth.js`).
//
// Cliente único: `argo_relatorio_semanal.py` no perfil gestor-ia da VPS. O
// Argo escreve; aqui se confere (`_argo-relatorio-pedidos.js`) e publica. Um
// pedido parado em andamento há mais de 30 minutos volta para a fila.
import { conectar, CONTA } from '../_argo-db.js';
import { recusarSemChaveArgo } from '../_argo-auth.js';
import { montarConsulta, processarResposta } from '../_argo-relatorio-pedidos.js';
import { textoSlack } from '../_argo-relatorio-gerar.js';
import { avaliarCandidata } from '../_argo-relatorio-avaliacao.js';

const MODELO = 'Argo (perfil gestor-ia do Hermes)';
const erro = (m, s) => Response.json({ erro: m }, { status: s });

export async function onRequestGet({ request, env }) {
  const recusa = recusarSemChaveArgo(request, env);
  if (recusa) return recusa;
  try {
    const sql = conectar(env);
    const r = await sql`
      UPDATE argo.analise_pedidos SET estado = 'em_andamento', atualizado_em = now()
       WHERE id = (
         SELECT id FROM argo.analise_pedidos
          WHERE conta = ${CONTA}
            AND (estado = 'pendente' OR (estado = 'em_andamento' AND atualizado_em < now() - interval '30 minutes'))
          ORDER BY criado_em LIMIT 1 FOR UPDATE SKIP LOCKED)
      RETURNING id, tipo, relatorio_id, versao, historico`;
    if (!r.length) return Response.json({ pedido: null });
    const p = r[0];
    const rel = await sql`SELECT pacote FROM argo.relatorios WHERE id = ${p.relatorio_id}`;
    const hist = p.historico || [];
    const ultimo = hist[hist.length - 1];
    const anterior = ultimo && ultimo.violacoes.length ? { saida: ultimo.saida || {}, violacoes: ultimo.violacoes } : null;
    return Response.json({ pedido: { id: Number(p.id), tipo: p.tipo, tentativa: hist.length + 1, consulta: montarConsulta(p.versao, rel[0].pacote, anterior) } });
  } catch {
    return erro('Não foi possível ler a fila de análise agora.', 500);
  }
}

async function concluirAvaliacao(sql, avaliacaoId) {
  const pedidos = await sql`
    SELECT p.estado, p.resultado, p.relatorio_id, r.situacao, r.analise, r.pacote
      FROM argo.analise_pedidos p JOIN argo.relatorios r ON r.id = p.relatorio_id
     WHERE p.avaliacao_id = ${avaliacaoId}`;
  if (pedidos.some((p) => p.estado !== 'concluido')) return null;
  const semanas = [];
  for (const p of pedidos) {
    const errados = (await sql`SELECT bloco FROM argo.relatorio_reacoes WHERE relatorio_id = ${p.relatorio_id} AND tipo = 'errado'`).map((x) => x.bloco);
    semanas.push({ relatorio_id: Number(p.relatorio_id), rotulo: p.pacote.semana ? p.pacote.semana.rotulo : '', publicado: { situacao: p.situacao, analise: p.analise }, errados, candidata: p.resultado || { situacao: 'nao_passou', blocos: [] } });
  }
  const resultado = avaliarCandidata(semanas);
  await sql`UPDATE argo.instrucoes_avaliacoes SET situacao = ${resultado.situacao}, resultado = ${JSON.stringify(resultado)}::jsonb WHERE id = ${avaliacaoId}`;
  return resultado;
}

export async function onRequestPost({ request, env }) {
  const recusa = recusarSemChaveArgo(request, env);
  if (recusa) return recusa;
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return erro('Corpo inválido.', 400);
  }
  const id = Number(corpo.pedido_id);
  if (!Number.isInteger(id) || id <= 0) return erro('Pedido inválido.', 400);
  const link = `${new URL(request.url).origin}/dash/#argo?v=relatorio`;
  try {
    const sql = conectar(env);
    const r = await sql`SELECT * FROM argo.analise_pedidos WHERE conta = ${CONTA} AND id = ${id}`;
    if (!r.length) return erro('Pedido não encontrado.', 404);
    const p = r[0];
    if (p.estado !== 'em_andamento') return erro('Este pedido não está em andamento.', 409);
    const rel = await sql`SELECT * FROM argo.relatorios WHERE id = ${p.relatorio_id}`;
    const pacote = rel[0].pacote;
    const x = processarResposta({ historico: p.historico || [], pacote, saida: corpo.saida, erro: corpo.erro });

    if (!x.final) {
      await sql`UPDATE argo.analise_pedidos SET historico = ${JSON.stringify(x.historico)}::jsonb, tentativas = ${x.historico.length}, atualizado_em = now() WHERE id = ${id}`;
      return Response.json({ final: false, tentativa: x.historico.length + 1, consulta: montarConsulta(p.versao, pacote, x.anterior) });
    }

    const pub = x.publicado;
    await sql`UPDATE argo.analise_pedidos SET historico = ${JSON.stringify(x.historico)}::jsonb, tentativas = ${x.historico.length},
                     estado = 'concluido', resultado = ${JSON.stringify({ situacao: pub.situacao, blocos: pub.blocos })}::jsonb, atualizado_em = now()
               WHERE id = ${id}`;

    if (p.tipo === 'avaliacao') {
      const fim = await concluirAvaliacao(sql, p.avaliacao_id);
      return Response.json({ final: true, texto: fim ? `*Teste das instruções ${p.versao} da análise do Argo*: ${fim.situacao}. ${fim.motivo}\n${link}` : null });
    }
    await sql`
      UPDATE argo.relatorios
         SET situacao = ${pub.situacao}, analise = ${JSON.stringify(pub.blocos)}::jsonb, removidos = ${JSON.stringify(pub.removidos)}::jsonb,
             checagem = ${JSON.stringify(x.checagem)}::jsonb, modelo = ${MODELO}, instrucoes_versao = ${p.versao}, erro = NULL
       WHERE id = ${p.relatorio_id}`;
    const texto = textoSlack({ situacao: pub.situacao, semana: pacote.semana, pacote }, link);
    return Response.json({ final: true, situacao: pub.situacao, texto });
  } catch {
    return erro('Não foi possível registrar a resposta agora.', 500);
  }
}
