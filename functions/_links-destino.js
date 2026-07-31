// Regra de escolha do destino do /links, isolada e PURA: sem I/O, sem D1, sem
// env. Recebe as linhas de short_links e um instante, devolve quem atende.
//
// Vive aqui, e não dentro da rota, porque DUAS coisas precisam da mesma resposta:
// o redirect (functions/links.js) e o dash (functions/api/links.js, que mostra
// "o que está no ar agora"). Duplicar a regra faria o painel um dia discordar do
// que o link realmente entrega — e é justamente o painel que a usuária consulta
// antes de disparar para o grupo.
//
// Prefixo "_" no nome: o Cloudflare Pages não transforma o arquivo em rota
// (mesmo mecanismo de functions/api/webhooks/_classificar.js).

// UTMs repassadas ao destino final. Lista fechada de propósito: repassar a query
// inteira mandaria parâmetros internos (e o fbclid do visitante) para domínios
// de terceiros, já que o destino costuma ser fora do site.
export const UTMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

const ehPadrao = (l) => l.starts_at == null && l.ends_at == null;

// Situação de um destino no instante dado. Calculada aqui (backend) e não na
// tela, para o rótulo exibido nunca divergir da decisão real do redirect.
export function situacaoDe(linha, agora) {
  if (ehPadrao(linha)) return 'padrao';
  if (agora < linha.starts_at) return 'agendado';
  if (agora > linha.ends_at) return 'encerrado';
  return 'no-ar';
}

// Ordem: janela válida → destino padrão → nada (o chamador cai em '/').
// `linhas` deve vir SEM os apagados.
export function escolherDestino(linhas, agora) {
  const lista = Array.isArray(linhas) ? linhas : [];

  const naJanela = lista
    .filter((l) => !ehPadrao(l) && l.starts_at <= agora && agora <= l.ends_at)
    // Sobreposição acidental de janelas é possível (a API aceita, porque
    // recusá-la atrapalharia mais do que ajuda). O desempate é fixo — a que
    // COMEÇOU MAIS TARDE vence — para nunca existir escolha ambígua.
    .sort((a, b) => b.starts_at - a.starts_at);
  if (naJanela.length) return { link: naJanela[0], motivo: 'janela' };

  // A API garante um só padrão; ordenar por criação é defesa contra um estado
  // inconsistente que tenha entrado por escrita manual no banco.
  const padroes = lista.filter(ehPadrao).sort((a, b) => (b.criado_em || 0) - (a.criado_em || 0));
  if (padroes.length) return { link: padroes[0], motivo: 'padrao' };

  return { link: null, motivo: 'nenhum' };
}

// Monta a URL final repassando as UTMs que vieram no clique.
//
// O que a usuária cadastrou no destino VENCE o que veio na URL: o valor
// cadastrado é uma escolha explícita, o herdado é acidente de como o link foi
// compartilhado.
export function montarUrlFinal(destino, urlDoClique) {
  let alvo;
  try {
    alvo = new URL(destino);
  } catch {
    // Destino que não parseia (só deveria existir se tiver entrado por escrita
    // manual no banco — a API valida na gravação). Redireciona cru em vez de
    // falhar: o visitante vale mais do que a UTM.
    return destino;
  }

  for (const nome of UTMS) {
    const valor = urlDoClique.searchParams.get(nome);
    if (valor && !alvo.searchParams.has(nome)) alvo.searchParams.set(nome, valor);
  }
  return alvo.toString();
}
