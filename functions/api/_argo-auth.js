// Guarda de acesso das rotas do Argo (`/api/argo/*`).
//
// Mesma regra das outras rotas do dash (`bloqueios.js`, `ab-tests.js`,
// `links.js`): `?key=` tem que bater com a `DASH_KEY` do ambiente, senão 401.
// `functions/_middleware.js` exclui `/api/` de propósito — não existe guarda a
// montante. Se ela não estiver na primeira linha do handler, não existe.
//
// O que está em jogo aqui não é leitura de relatório: um POST em
// `/api/argo/config` com as seis permissões em `desligado` desliga a pausa
// automática de campanhas de Meta Ads que roda todo dia útil às 8h50 — sem
// nada gritar, e só percebido no dia seguinte. E o GET expõe nomes de
// campanha, motivos com valores de gasto e o teto da conta.
//
// Mora num módulo próprio, e não copiado dentro de cada handler, por um
// motivo específico: assim é testável por `node --test`. A decisão anterior
// de tratar endpoint como "só fiação, dispensa teste" é exatamente o motivo
// de a falta de autenticação ter passado por toda a suíte.

export const ERRO_NAO_AUTORIZADO = 'Unauthorized';

// `true` só quando a variável existe, não está vazia e a chave da requisição
// é idêntica a ela. Ambiente sem `DASH_KEY` recusa tudo (nunca "sem chave
// configurada = liberado", que transformaria um deploy incompleto em porta
// aberta).
export function chaveAutorizada(request, env) {
  const esperada = env && env.DASH_KEY ? String(env.DASH_KEY) : '';
  if (!esperada) return false;
  return new URL(request.url).searchParams.get('key') === esperada;
}

// Devolve a Response de recusa, ou `null` quando pode seguir. O handler faz
// `const recusa = recusarSemChave(request, env); if (recusa) return recusa;`
// na primeira linha — antes de tocar no banco.
export function recusarSemChave(request, env) {
  if (chaveAutorizada(request, env)) return null;
  return Response.json({ erro: ERRO_NAO_AUTORIZADO }, { status: 401 });
}

// ---------------------------------------------------------------------------
// Guarda da rota que o Argo chama de fora (`/api/argo/leads-por-anuncio`).
//
// Chave PRÓPRIA (`ARGO_KEY`), e não a `DASH_KEY`, por dois motivos medidos
// neste projeto: a `DASH_KEY` abre o dashboard inteiro e já vazou uma vez, e
// esta rota é chamada por um script na VPS — uma chave só para ela pode ser
// trocada sem derrubar o painel.
//
// Vem por `Authorization: Bearer`, nunca por `?key=`: query string fica
// gravada em log de acesso do Cloudflare e no histórico de shell de quem
// testar com curl. O cliente é o `argo_anuncios.py` do profile `gestor-ia`.
//
// Ambiente sem `ARGO_KEY` recusa tudo, como a guarda de cima: deploy
// incompleto nunca vira porta aberta.

export function chaveArgoAutorizada(request, env) {
  const esperada = env && env.ARGO_KEY ? String(env.ARGO_KEY) : '';
  if (!esperada) return false;
  const cabecalho = request.headers.get('Authorization') || '';
  const prefixo = 'Bearer ';
  if (!cabecalho.startsWith(prefixo)) return false;
  return cabecalho.slice(prefixo.length).trim() === esperada;
}

// Devolve a Response de recusa, ou `null` quando pode seguir — mesmo formato
// de `recusarSemChave`, para o handler usar na primeira linha.
export function recusarSemChaveArgo(request, env) {
  if (chaveArgoAutorizada(request, env)) return null;
  return Response.json({ erro: ERRO_NAO_AUTORIZADO }, { status: 401 });
}
