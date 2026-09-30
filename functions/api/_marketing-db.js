// Conexão com a Neon (schema `marketing`) a partir das Functions do Pages.
// Papel `marketing_ro`: só lê, e não enxerga `public` nem `argo`. As coletas
// que escrevem moram na VPS (gestor-ae, issues 337–339).
// Uma consulta por chamada da tela: sem polling, sem laço.
import { neon } from '@neondatabase/serverless';

export function conectar(env) {
  if (!env.MARKETING_RO_DATABASE_URL) {
    throw new Error('MARKETING_RO_DATABASE_URL ausente no ambiente');
  }
  return neon(env.MARKETING_RO_DATABASE_URL);
}

export const ERRO_LEITURA = 'Não foi possível ler os dados do Instagram agora.';

export function falhaDeLeitura() {
  return Response.json({ erro: ERRO_LEITURA }, { status: 502 });
}

export function periodoInvalido() {
  return Response.json({ erro: 'Período inválido.' }, { status: 400 });
}
