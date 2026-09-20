// Conexão com a Neon a partir das Functions do Pages.
// Uma consulta por chamada: sem polling, sem laço — a aba carrega ao abrir.
import { neon } from '@neondatabase/serverless';

export const CONTA = 'atacado-exponencial';

export function conectar(env) {
  if (!env.ARGO_DATABASE_URL) {
    throw new Error('ARGO_DATABASE_URL ausente no ambiente');
  }
  return neon(env.ARGO_DATABASE_URL);
}
