// GET /api/argo/registro?limite=N
//
// Registro do que o Argo viu e fez na conta do Atacado Exponencial.
// Janela limitada por construção: `limite` no máximo 50. A aba nunca pede
// "tudo" e nunca consulta em laço.
import { conectar, CONTA } from '../_argo-db.js';
import { recusarSemChave } from '../_argo-auth.js';
import { montarRegistro, CAMPOS_ACAO } from '../_argo-registro.js';
import { montarRegua } from '../_argo-regua.js';

// Teto explícito das ações. As rodadas já são limitadas; sem limite aqui uma
// única rodada muito movimentada poderia devolver uma resposta sem tamanho
// previsível. 50 rodadas × 20 ações é folgado para a tela, que mostra 20.
const MAX_ACOES = 1000;

// "Desfeita" não é coluna: o desfazer é uma AÇÃO nova ligada à original por
// `desfaz_acao_id` (issue 312). A coluna `desfeita_em` da tabela nunca é
// escrita; o campo com esse nome sai desta subconsulta — mesma regra do
// monitor (`argo_estado.fila_de_avaliacao`, gestor-ae).
const SQL_DESFEITA_EM =
  '(SELECT MIN(d.criada_em) FROM argo.acoes d WHERE d.desfaz_acao_id = a.id AND d.aplicada = true)';
// Reativação (issue 318) é um `desfazer_pausa` do próprio Argo: veio de uma
// proposta `reativar_anuncio` ou do monitor ("proposta reativação").
const SQL_REATIVACAO =
  "(a.tipo = 'desfazer_pausa' AND (a.motivo LIKE '%proposta reativação%' "
  + "OR EXISTS (SELECT 1 FROM argo.propostas p WHERE p.acao_id = a.id AND p.tipo = 'reativar_anuncio')))";
// Só literais do código-fonte entram aqui (ver o comentário no SELECT).
const COLUNAS_ACAO = CAMPOS_ACAO
  .map((c) => (c === 'desfeita_em' ? `${SQL_DESFEITA_EM} AS desfeita_em` : `a.${c}`))
  .concat([`${SQL_REATIVACAO} AS reativacao`])
  .join(', ');

export async function onRequestGet({ request, env }) {
  const recusa = recusarSemChave(request, env);
  if (recusa) return recusa;

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
    // Janela da avaliação (issue 329) vem da régua salva, com o padrão do
    // catálogo quando não há valor — a mesma fonte que a aba edita (328).
    const [config] = await sql`SELECT regua FROM argo.config_conta WHERE conta = ${CONTA}`;
    const janelaDias = montarRegua(config?.regua).valores.avaliacao_janela_dias;
    // Colunas vêm de CAMPOS_ACAO (_argo-registro.js): fonte única, para o
    // SELECT nunca divergir dos campos que montarRegistro lê e repassa.
    // `sql.unsafe` é seguro AQUI e só aqui: COLUNAS_ACAO é montada de
    // literais fixos no código-fonte, nunca alimentada por requisição,
    // variável de ambiente, rede ou banco. Nada computado de fora deste
    // arquivo pode entrar nessa lista — não copie este padrão para um
    // valor que venha de `request`, `env` ou de uma consulta anterior.
    const acoes = ids.length
      ? await sql`
          SELECT ${sql.unsafe(COLUNAS_ACAO)},
                 v.situacao    AS v_situacao,
                 v.motivo      AS v_motivo,
                 v.numeros     AS v_numeros,
                 v.janela_dias AS v_janela_dias,
                 v.avaliada_em AS v_avaliada_em,
                 v.origem      AS v_origem,
                 v.ultimo_erro AS v_ultimo_erro
            FROM argo.acoes a
            LEFT JOIN argo.vereditos v ON v.acao_id = a.id
           WHERE a.rodada_id = ANY(${ids})
           ORDER BY a.criada_em DESC
           LIMIT ${MAX_ACOES}
        `
      : [];

    return Response.json(montarRegistro({ rodadas, acoes, janelaDias }));
  } catch {
    return Response.json(
      { erro: 'Não foi possível ler o registro do Argo agora.' },
      { status: 500 },
    );
  }
}
