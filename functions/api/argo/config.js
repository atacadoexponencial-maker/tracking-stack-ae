// GET  /api/argo/config  — a grade atual da conta
// POST /api/argo/config  — grava a grade
//
// A aba NÃO decide nada: a regra de proteção — quais ações existem, quais
// estados são permitidos, e o formato de cada campo — mora em
// `_argo-config.js`, testada por `node --test`. Este arquivo só valida (via
// `validarConfig`) e faz I/O; nunca corrige um valor em silêncio.
import { conectar, CONTA } from '../_argo-db.js';
import { ERRO_SEM_GRADE } from '../_argo-registro.js';
import { validarConfig } from '../_argo-config.js';

async function lerGrade(sql) {
  const linhas = await sql`
    SELECT conta, permissoes, teto_mensal_meta_centavos,
           limite_por_acao_centavos, max_pausas_por_rodada,
           parada_geral, atualizada_em, atualizada_por
      FROM argo.config_conta WHERE conta = ${CONTA}
  `;
  return linhas[0] ?? null;
}

export async function onRequestGet({ env }) {
  try {
    const grade = await lerGrade(conectar(env));
    if (!grade) return Response.json({ erro: ERRO_SEM_GRADE }, { status: 404 });
    return Response.json(grade);
  } catch {
    return Response.json(
      { erro: 'Não foi possível ler a configuração do Argo agora.' },
      { status: 500 },
    );
  }
}

export async function onRequestPost({ request, env }) {
  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Corpo inválido.' }, { status: 400 });
  }

  const validacao = validarConfig(corpo);
  if (!validacao.ok) {
    return Response.json({ erro: validacao.erros.join(' ') }, { status: 400 });
  }
  const { permissoes, teto_mensal_meta_centavos, limite_por_acao_centavos, max_pausas_por_rodada, parada_geral } =
    validacao.valores;

  try {
    const sql = conectar(env);
    await sql`
      UPDATE argo.config_conta
         SET permissoes = ${JSON.stringify(permissoes)}::jsonb,
             teto_mensal_meta_centavos = ${teto_mensal_meta_centavos},
             limite_por_acao_centavos = ${limite_por_acao_centavos},
             max_pausas_por_rodada = ${max_pausas_por_rodada},
             parada_geral = ${parada_geral},
             atualizada_em = now(),
             atualizada_por = 'painel'
       WHERE conta = ${CONTA}
    `;
    return Response.json(await lerGrade(sql));
  } catch {
    return Response.json(
      { erro: 'Não foi possível salvar a configuração agora.' },
      { status: 500 },
    );
  }
}
