// GET /api/argo/registro?limite=N
//
// Registro do que o Argo viu e fez na conta do Atacado Exponencial.
// Janela limitada por construção: `limite` no máximo 50. A aba nunca pede
// "tudo" e nunca consulta em laço.
import { conectar, CONTA } from '../_argo-db.js';
import { montarRegistro, CAMPOS_ACAO } from '../_argo-registro.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const bruto = Number.parseInt(url.searchParams.get('limite') ?? '20', 10);
  const limite = Number.isFinite(bruto) ? Math.min(Math.max(bruto, 1), 50) : 20;

  try {
    const sql = conectar(env);
    const rodadas = await sql`
      SELECT id, executor, iniciada_em, ok, conclusao, leitura
        FROM argo.rodadas
       WHERE conta = ${CONTA}
       ORDER BY iniciada_em DESC
       LIMIT ${limite}
    `;
    const ids = rodadas.map((r) => r.id);
    // Colunas vêm de CAMPOS_ACAO (_argo-registro.js): fonte única, para o
    // SELECT nunca divergir dos campos que montarRegistro lê e repassa.
    const acoes = ids.length
      ? await sql`
          SELECT ${sql.unsafe(CAMPOS_ACAO.join(', '))}
            FROM argo.acoes
           WHERE rodada_id = ANY(${ids})
           ORDER BY criada_em DESC
        `
      : [];

    return Response.json(montarRegistro({ rodadas, acoes }));
  } catch {
    return Response.json(
      { erro: 'Não foi possível ler o registro do Argo agora.' },
      { status: 500 },
    );
  }
}
