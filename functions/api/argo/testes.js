// GET  /api/argo/testes?key=...  — o registro de testes, pronto para a aba
// POST /api/argo/testes?key=...  — criar, editar, iniciar, concluir ou abandonar
//
// Issues 403 e 404 (spec-relatorio-semanal-argo.md, módulo 2). A regra mora em
// `_argo-testes.js`; os números de cada lado em `_argo-testes-numeros.js`.
// Aqui só se valida, grava e devolve a lista inteira de novo.
import { conectar, CONTA } from '../_argo-db.js';
import { recusarSemChave } from '../_argo-auth.js';
import { validarTeste, validarEdicao, transicao, mudancasDaEdicao, montarTestes } from '../_argo-testes.js';
import { hojeBrt } from '../_argo-contexto.js';
import { lerTestesComNumeros } from '../_argo-testes-numeros.js';

async function responderLista(sql, env) {
  return Response.json(await lerTestesComNumeros(sql, env, hojeBrt()));
}

export async function onRequestGet({ request, env }) {
  const recusa = recusarSemChave(request, env);
  if (recusa) return recusa;
  try {
    return await responderLista(conectar(env), env);
  } catch {
    return Response.json({ erro: 'Não foi possível ler o registro de testes agora.' }, { status: 500 });
  }
}

const historico = (sql, testeId, texto, destaque = false) =>
  sql`INSERT INTO argo.testes_historico (teste_id, texto, destaque) VALUES (${testeId}, ${texto}, ${destaque})`;

const ROTULO_RESULTADO = { variante: 'variante ganhou', controle: 'controle ganhou', empate: 'empate', inconclusivo: 'inconclusivo' };

export async function onRequestPost({ request, env }) {
  const recusa = recusarSemChave(request, env);
  if (recusa) return recusa;

  let corpo;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: 'Corpo inválido.' }, { status: 400 });
  }
  const v = validarTeste(corpo);
  if (!v.ok) return Response.json({ erro: v.erro }, { status: 400 });

  try {
    const sql = conectar(env);
    if (v.acao === 'criar') {
      const x = v.valores;
      const rodando = x.comeca === 'rodando';
      const linhas = await sql`
        INSERT INTO argo.testes (conta, nome, tipo, funil, situacao, hipotese, mudou, controle, variante, ab_test_id,
                                 metrica, criterio, min_dias, min_amostra, inicio)
        VALUES (${CONTA}, ${x.nome}, ${x.tipo}, ${x.funil}, ${rodando ? 'rodando' : 'planejado'}, ${x.hipotese}, ${x.mudou},
                ${JSON.stringify(x.controle)}::jsonb, ${JSON.stringify(x.variante)}::jsonb, ${x.ab_test_id},
                ${x.metrica}, ${x.criterio}, ${x.min_dias}, ${x.min_amostra},
                ${rodando ? hojeBrt() : null})
        RETURNING id
      `;
      await historico(sql, linhas[0].id, rodando ? 'Teste registrado e iniciado.' : 'Teste registrado como planejado.');
      return await responderLista(sql, env);
    }

    const atuais = await sql`SELECT * FROM argo.testes WHERE conta = ${CONTA} AND id = ${v.id}`;
    if (!atuais.length) return Response.json({ erro: 'Teste não encontrado.' }, { status: 404 });
    const atual = atuais[0];

    if (v.acao === 'editar') {
      const e = validarEdicao(v.valores, atual);
      if (!e.ok) return Response.json({ erro: e.erro }, { status: e.erro.startsWith('Teste fechado') ? 409 : 400 });
      const x = e.valores;
      await sql`
        UPDATE argo.testes
           SET nome = ${x.nome}, funil = ${x.funil}, hipotese = ${x.hipotese}, mudou = ${x.mudou},
               controle = ${JSON.stringify(x.controle)}::jsonb, variante = ${JSON.stringify(x.variante)}::jsonb,
               ab_test_id = ${x.ab_test_id}, metrica = ${x.metrica}, criterio = ${x.criterio},
               min_dias = ${x.min_dias}, min_amostra = ${x.min_amostra}, atualizado_em = now()
         WHERE conta = ${CONTA} AND id = ${v.id}
      `;
      for (const m of mudancasDaEdicao(atual, x)) await historico(sql, v.id, m.texto, m.destaque);
      return await responderLista(sql, env);
    }

    const t = transicao(v.acao, atual.situacao);
    if (!t.ok) return Response.json({ erro: t.erro }, { status: 409 });
    if (v.acao === 'iniciar') {
      await sql`UPDATE argo.testes SET situacao = 'rodando', inicio = ${hojeBrt()}, atualizado_em = now() WHERE conta = ${CONTA} AND id = ${v.id}`;
      await historico(sql, v.id, 'Teste iniciado.');
    } else if (v.acao === 'concluir') {
      const x = v.valores;
      await sql`
        UPDATE argo.testes SET situacao = 'concluido', resultado = ${x.resultado}, aprendizado = ${x.aprendizado},
               fim = ${hojeBrt()}, atualizado_em = now()
         WHERE conta = ${CONTA} AND id = ${v.id}
      `;
      await historico(sql, v.id, `Concluído: ${ROTULO_RESULTADO[x.resultado]}.`);
    } else {
      await sql`
        UPDATE argo.testes SET situacao = 'abandonado', motivo_abandono = ${v.valores.motivo}, fim = ${hojeBrt()}, atualizado_em = now()
         WHERE conta = ${CONTA} AND id = ${v.id}
      `;
      await historico(sql, v.id, `Abandonado: ${v.valores.motivo}`);
    }
    return await responderLista(sql, env);
  } catch {
    return Response.json({ erro: 'Não foi possível gravar o teste agora.' }, { status: 500 });
  }
}
