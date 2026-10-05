// GET  /api/argo/contexto?key=...  — o contexto do negócio, pronto para a aba
// POST /api/argo/contexto?key=...  — criar, editar, revisar ou arquivar um item
//
// Issue 402 (spec-relatorio-semanal-argo.md, módulo 1). A regra mora em
// `_argo-contexto.js`; aqui só valida, grava e devolve a lista inteira de
// novo, para a aba redesenhar sem calcular nada.
import { conectar, CONTA } from '../_argo-db.js';
import { recusarSemChave } from '../_argo-auth.js';
import { validarContexto, montarContexto, hojeBrt } from '../_argo-contexto.js';

export async function lerItensContexto(sql) {
  return sql`
    SELECT id, tipo, titulo, texto, funil, inicio, fim, validade_dias,
           revisado_em, arquivado_em
      FROM argo.contexto_itens
     WHERE conta = ${CONTA}
     ORDER BY id DESC
  `;
}

async function responderLista(sql) {
  return Response.json(montarContexto(await lerItensContexto(sql), hojeBrt()));
}

export async function onRequestGet({ request, env }) {
  const recusa = recusarSemChave(request, env);
  if (recusa) return recusa;
  try {
    return await responderLista(conectar(env));
  } catch {
    return Response.json({ erro: 'Não foi possível ler o contexto agora.' }, { status: 500 });
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
  const v = validarContexto(corpo);
  if (!v.ok) return Response.json({ erro: v.erro }, { status: 400 });

  try {
    const sql = conectar(env);
    if (v.acao === 'criar') {
      const x = v.valores;
      await sql`
        INSERT INTO argo.contexto_itens (conta, tipo, titulo, texto, funil, inicio, fim, validade_dias)
        VALUES (${CONTA}, ${x.tipo}, ${x.titulo}, ${x.texto}, ${x.funil}, ${x.inicio}, ${x.fim}, ${x.validade_dias})
      `;
      return await responderLista(sql);
    }

    const atual = await sql`SELECT id, arquivado_em FROM argo.contexto_itens WHERE conta = ${CONTA} AND id = ${v.id}`;
    if (!atual.length) return Response.json({ erro: 'Item não encontrado.' }, { status: 404 });
    if (atual[0].arquivado_em) return Response.json({ erro: 'Este item já foi arquivado.' }, { status: 409 });

    if (v.acao === 'editar') {
      const x = v.valores;
      // Editar conta como revisar: a gestora acabou de olhar o item.
      await sql`
        UPDATE argo.contexto_itens
           SET tipo = ${x.tipo}, titulo = ${x.titulo}, texto = ${x.texto}, funil = ${x.funil},
               inicio = ${x.inicio}, fim = ${x.fim}, validade_dias = ${x.validade_dias},
               revisado_em = now(), atualizado_por = 'painel'
         WHERE conta = ${CONTA} AND id = ${v.id}
      `;
    } else if (v.acao === 'revisar') {
      await sql`UPDATE argo.contexto_itens SET revisado_em = now(), atualizado_por = 'painel' WHERE conta = ${CONTA} AND id = ${v.id}`;
    } else if (v.acao === 'arquivar') {
      await sql`UPDATE argo.contexto_itens SET arquivado_em = now(), atualizado_por = 'painel' WHERE conta = ${CONTA} AND id = ${v.id}`;
    }
    return await responderLista(sql);
  } catch {
    return Response.json({ erro: 'Não foi possível gravar o contexto agora.' }, { status: 500 });
  }
}
