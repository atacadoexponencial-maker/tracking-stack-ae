// GET  /api/argo/config?key=...  — a grade atual da conta + o contrato dela
// POST /api/argo/config?key=...  — grava a grade
//
// A aba NÃO decide nada: a regra de proteção — quais ações existem, quais
// estados são permitidos, e o formato de cada campo — mora em
// `_argo-config.js`, testada por `node --test`. Este arquivo só valida (via
// `validarConfig`) e faz I/O; nunca corrige um valor em silêncio.
//
// A guarda de acesso é a primeira linha dos dois handlers (`_argo-auth.js`):
// `functions/_middleware.js` exclui `/api/`, então não há guarda a montante.
import { conectar, CONTA } from '../_argo-db.js';
import { recusarSemChave } from '../_argo-auth.js';
import {
  validarConfig,
  CONTRATO_GRADE,
  ERRO_SEM_GRADE,
  ERRO_GRADE_MUDOU,
} from '../_argo-config.js';
import { montarRegua, validarRegua } from '../_argo-regua.js';

async function lerGrade(sql) {
  const linhas = await sql`
    SELECT conta, permissoes, teto_mensal_meta_centavos,
           limite_por_acao_centavos, max_pausas_por_rodada,
           parada_geral, atualizada_em, atualizada_por,
           regua, regua_atualizada_em, regua_atualizada_por
      FROM argo.config_conta WHERE conta = ${CONTA}
  `;
  return linhas[0] ?? null;
}

// A resposta carrega o contrato junto com a grade: a aba desenha as linhas a
// partir de `contrato.acoes`/`contrato.estados`, em vez de manter uma segunda
// cópia da lista que pode divergir desta sem ninguém notar.
function respostaGrade(grade) {
  const { regua, regua_atualizada_em, regua_atualizada_por, ...resto } = grade;
  return Response.json({
    ...resto,
    contrato: CONTRATO_GRADE,
    // A régua sai montada (valores sobre padrões, limites, quais já têm
    // efeito) — a aba não conhece padrão nem limite por conta própria.
    regua: montarRegua(regua, regua_atualizada_em, regua_atualizada_por),
  });
}

export async function onRequestGet({ request, env }) {
  const recusa = recusarSemChave(request, env);
  if (recusa) return recusa;

  try {
    const grade = await lerGrade(conectar(env));
    if (!grade) return Response.json({ erro: ERRO_SEM_GRADE }, { status: 404 });
    return respostaGrade(grade);
  } catch {
    return Response.json(
      { erro: 'Não foi possível ler a configuração do Argo agora.' },
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

  const validacao = validarConfig(corpo);
  if (!validacao.ok) {
    return Response.json({ erro: validacao.erros.join(' ') }, { status: 400 });
  }
  // Régua é opcional no corpo: cliente antigo que não a manda não apaga a
  // salva. Quando vem, vem inteira e validada.
  let regua = null;
  if (corpo.regua !== undefined) {
    const r = validarRegua(corpo.regua);
    if (!r.ok) return Response.json({ erro: r.erros.join(' ') }, { status: 400 });
    regua = r.valores;
  }
  const reguaJson = regua === null ? null : JSON.stringify(regua);
  const {
    permissoes, teto_mensal_meta_centavos, limite_por_acao_centavos,
    max_pausas_por_rodada, parada_geral, atualizada_em,
  } = validacao.valores;

  try {
    const sql = conectar(env);
    // Concorrência otimista: só grava se a linha ainda estiver na versão que
    // a tela leu. Sem isso, uma aba aberta de manhã e salva à tarde
    // sobrescreve o que foi feito no intervalo — inclusive uma parada de
    // emergência, que voltaria a `false` sem ninguém pedir.
    //
    // A comparação é truncada ao milissegundo de propósito: o carimbo vai e
    // volta pelo JSON como Date/ISO, que só carrega milissegundos, enquanto
    // `now()` no Postgres tem microssegundos. Comparar cru daria 409 eterno
    // e travaria a única tela de controle do agente. Duas gravações no mesmo
    // milissegundo não acontecem numa tela operada à mão.
    const linhas = await sql`
      UPDATE argo.config_conta
         SET permissoes = ${JSON.stringify(permissoes)}::jsonb,
             teto_mensal_meta_centavos = ${teto_mensal_meta_centavos},
             limite_por_acao_centavos = ${limite_por_acao_centavos},
             max_pausas_por_rodada = ${max_pausas_por_rodada},
             parada_geral = ${parada_geral},
             regua = COALESCE(${reguaJson}::jsonb, regua),
             -- "Régua alterada em" só anda quando a régua mudou de fato:
             -- salvar a grade não pode fingir que alguém mexeu na régua.
             regua_atualizada_em = CASE
               WHEN ${reguaJson}::jsonb IS NOT NULL
                AND ${reguaJson}::jsonb IS DISTINCT FROM regua
               THEN now() ELSE regua_atualizada_em END,
             regua_atualizada_por = CASE
               WHEN ${reguaJson}::jsonb IS NOT NULL
                AND ${reguaJson}::jsonb IS DISTINCT FROM regua
               THEN 'painel' ELSE regua_atualizada_por END,
             atualizada_em = now(),
             atualizada_por = 'painel'
       WHERE conta = ${CONTA}
         AND (${atualizada_em}::timestamptz IS NULL
              OR date_trunc('milliseconds', atualizada_em)
                 = date_trunc('milliseconds', ${atualizada_em}::timestamptz))
      RETURNING conta
    `;

    // Zero linhas afetadas tem dois significados, e responder 200 com corpo
    // nulo (como antes) faria a aba estourar sem dizer nada à usuária.
    if (!linhas.length) {
      const existe = await lerGrade(sql);
      return existe
        ? Response.json({ erro: ERRO_GRADE_MUDOU }, { status: 409 })
        : Response.json({ erro: ERRO_SEM_GRADE }, { status: 404 });
    }

    return respostaGrade(await lerGrade(sql));
  } catch {
    return Response.json(
      { erro: 'Não foi possível salvar a configuração agora.' },
      { status: 500 },
    );
  }
}
