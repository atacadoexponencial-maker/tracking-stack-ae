// GET  /api/argo/config  — a grade atual da conta
// POST /api/argo/config  — grava a grade
//
// A aba NÃO decide nada: a lista de ações válidas e os estados permitidos são
// validados aqui. Valor fora da lista é recusado, não corrigido em silêncio.
import { conectar, CONTA } from '../_argo-db.js';
import { ERRO_SEM_GRADE } from '../_argo-registro.js';

const ACOES = [
  'pausar_campanha_trafego',
  'pausar_anuncio',
  'pausar_conjunto',
  'realocar_verba',
  'reduzir_orcamento',
  'aumentar_orcamento',
];
const ESTADOS = ['desligado', 'propor', 'executar'];

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
  } catch (erro) {
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
  } catch (erro) {
    return Response.json({ erro: 'Corpo inválido.' }, { status: 400 });
  }

  const permissoes = corpo.permissoes ?? {};
  for (const [acao, estado] of Object.entries(permissoes)) {
    if (!ACOES.includes(acao)) {
      return Response.json({ erro: `Ação desconhecida: ${acao}` }, { status: 400 });
    }
    if (!ESTADOS.includes(estado)) {
      return Response.json({ erro: `Estado inválido: ${estado}` }, { status: 400 });
    }
  }

  const teto = corpo.teto_mensal_meta_centavos ?? null;
  const limite = corpo.limite_por_acao_centavos ?? null;
  const maxPausas = Number.parseInt(corpo.max_pausas_por_rodada ?? 3, 10);
  const parada = Boolean(corpo.parada_geral);

  if (!Number.isFinite(maxPausas) || maxPausas < 0) {
    return Response.json({ erro: 'Máximo de pausas inválido.' }, { status: 400 });
  }

  try {
    const sql = conectar(env);
    await sql`
      UPDATE argo.config_conta
         SET permissoes = ${JSON.stringify(permissoes)}::jsonb,
             teto_mensal_meta_centavos = ${teto},
             limite_por_acao_centavos = ${limite},
             max_pausas_por_rodada = ${maxPausas},
             parada_geral = ${parada},
             atualizada_em = now(),
             atualizada_por = 'painel'
       WHERE conta = ${CONTA}
    `;
    return Response.json(await lerGrade(sql));
  } catch (erro) {
    return Response.json(
      { erro: 'Não foi possível salvar a configuração agora.' },
      { status: 500 },
    );
  }
}
