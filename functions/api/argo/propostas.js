// GET  /api/argo/propostas?key=...  — pendentes válidas + resolvidas nos últimos 30 dias
// POST /api/argo/propostas?key=...  — grava a decisão da gestora sobre UMA proposta
//
// A tela só registra a decisão; quem age na conta é o executor do Argo na VPS
// (issue 311). Toda a apresentação sai pronta de `_argo-propostas.js`.
//
// Janela limitada por construção (teto de linhas) — mesma regra das outras
// rotas do Argo: a aba carrega ao abrir, nunca "tudo", nunca em laço.
import { conectar, CONTA } from '../_argo-db.js';
import { recusarSemChave } from '../_argo-auth.js';
import { montarPropostas, validarDecisao, motivoDaRecusa, ERRO_DESFAZER_INVALIDO } from '../_argo-propostas.js';

const MAX_PENDENTES = 50;
const MAX_HISTORICO = 100;

export async function onRequestGet({ request, env }) {
  const recusa = recusarSemChave(request, env);
  if (recusa) return recusa;

  try {
    const sql = conectar(env);
    const [pendentes, historico, grade] = await Promise.all([
      sql`
        SELECT id, versao, tipo, alvo_id, alvo_nome, motivo, detalhe,
               criada_em, atualizada_em, vence_em
          FROM argo.propostas
         WHERE conta = ${CONTA} AND decisao IS NULL AND vence_em > now()
         ORDER BY vence_em ASC
         LIMIT ${MAX_PENDENTES}
      `,
      sql`
        SELECT id, versao, tipo, alvo_id, alvo_nome, motivo, detalhe, criada_em,
               decisao, decidida_por, decidida_em, por_que,
               execucao_estado, execucao_em, execucao_detalhe,
               desfazer_pedido_em, desfazer_pedido_por, desfazer_estado,
               desfazer_em, desfazer_detalhe
          FROM argo.propostas
         WHERE conta = ${CONTA} AND decisao IS NOT NULL
           AND decidida_em > now() - interval '30 days'
         ORDER BY decidida_em DESC
         LIMIT ${MAX_HISTORICO}
      `,
      sql`SELECT parada_geral FROM argo.config_conta WHERE conta = ${CONTA}`,
    ]);
    return Response.json(montarPropostas({
      pendentes,
      historico,
      parada_geral: grade[0]?.parada_geral ?? false,
    }));
  } catch {
    return Response.json(
      { erro: 'Não foi possível ler as propostas do Argo agora.' },
      { status: 500 },
    );
  }
}

export async function onRequestPost({ request, env }) {
  const recusa = recusarSemChave(request, env);
  if (recusa) return recusa;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Corpo inválido.' }, { status: 400 });
  }
  const validacao = validarDecisao(corpo);
  if (!validacao.ok) {
    return Response.json({ erro: validacao.erros.join(' ') }, { status: 400 });
  }
  const { id, versao, decisao, por_que } = validacao.valores;

  if (decisao === 'desfazer') {
    try {
      const sql = conectar(env);
      // Só a pausa executada e conferida, e uma vez: a guarda inteira na
      // instrução, como na decisão. Quem reativa é o executor na VPS.
      const pedidos = await sql`
        UPDATE argo.propostas
           SET desfazer_pedido_em = now(), desfazer_pedido_por = 'painel'
         WHERE id = ${id} AND conta = ${CONTA}
           AND decisao = 'aprovada' AND execucao_estado = 'conferida'
           AND desfazer_pedido_em IS NULL
        RETURNING id
      `;
      if (!pedidos.length) return Response.json({ erro: ERRO_DESFAZER_INVALIDO }, { status: 409 });
      return Response.json({ ok: true, id: String(id), decisao });
    } catch {
      return Response.json(
        { erro: 'Não foi possível pedir o desfazer agora. Não dá para afirmar se gravou — recarregue a aba e confira.' },
        { status: 500 },
      );
    }
  }

  try {
    const sql = conectar(env);
    // A guarda inteira numa só instrução: grava só se a proposta ainda está
    // pendente, válida e NA VERSÃO QUE A GESTORA VIU. Aprovar a versão de
    // ontem com os números de hoje é justamente o que isto impede.
    const gravadas = await sql`
      UPDATE argo.propostas
         SET decisao = ${decisao}, decidida_por = 'painel',
             decidida_em = now(), por_que = ${por_que}
       WHERE id = ${id} AND conta = ${CONTA}
         AND decisao IS NULL AND vence_em > now() AND versao = ${versao}
      RETURNING id
    `;
    if (!gravadas.length) {
      const linha = await sql`
        SELECT decisao, decidida_por, decidida_em, vence_em, versao
          FROM argo.propostas WHERE id = ${id} AND conta = ${CONTA}
      `;
      const { status, erro } = motivoDaRecusa(linha[0] ?? null, versao);
      return Response.json({ erro }, { status });
    }
    return Response.json({ ok: true, id: String(id), decisao });
  } catch {
    return Response.json(
      { erro: 'Não foi possível gravar a decisão agora. Não dá para afirmar se gravou — recarregue a aba e confira.' },
      { status: 500 },
    );
  }
}
