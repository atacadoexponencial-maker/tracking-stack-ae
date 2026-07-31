// Redireciona /links para o destino que estiver valendo AGORA (spec 2026-07-31).
//
// É o endereço fixo usado nos disparos do grupo: a mensagem já enviada continua
// funcionando quando o destino muda, porque quem decide o destino é este código,
// no instante do clique, e não o texto da mensagem.
//
// O agendamento não usa cron: o Cloudflare Pages não tem cron trigger, e como a
// rota consulta o D1 a cada clique, basta guardar a janela e resolver na leitura.
//
// Vive em functions/ (e não em src/pages/) porque as Pages Functions têm
// prioridade sobre os assets estáticos do Astro — mesmo padrão de grupo-da-live.js.
import { escolherDestino, montarUrlFinal } from './_links-destino.js';
import { diaLocalDeUnix } from './api/webhooks/_classificar.js';

export async function onRequestGet(context) {
  const { env, request, waitUntil } = context;
  const url = new URL(request.url);
  const agora = Math.floor(Date.now() / 1000);

  let escolha = { link: null, motivo: 'nenhum' };
  try {
    const { results } = await env.DB.prepare(`
      SELECT id, target_url, starts_at, ends_at, criado_em
      FROM short_links
      WHERE apagado_em IS NULL
    `).all();
    escolha = escolherDestino(results || [], agora);
  } catch {
    // D1 fora do ar: sem destino conhecido, cai em '/' logo abaixo. Quem clicou
    // nunca vê erro nosso — uma página de falha no meio de um disparo custa
    // muito mais do que um redirect para a home.
  }

  const destino = escolha.link ? montarUrlFinal(escolha.link.target_url, url) : '/';

  // O clique é gravado DEPOIS de a resposta ser montada e fora do caminho
  // crítico: contar é secundário a redirecionar. Inclusive quando não há destino
  // cadastrado (link_id NULL), porque é esse o caso que precisa aparecer no dash.
  if (waitUntil) waitUntil(registrarClique(env, url, request, escolha.link, agora));

  return new Response(null, {
    status: 302,
    headers: {
      Location: destino,
      // Sem cache é obrigatório: com cache, o Cloudflare continuaria servindo o
      // destino antigo depois da virada da janela — exatamente o que esta
      // feature existe para evitar.
      'Cache-Control': 'no-store',
    },
  });
}

async function registrarClique(env, url, request, link, agora) {
  try {
    await env.DB.prepare(`
      INSERT INTO short_link_clicks
        (link_id, occurred_at, day_local, utm_source, utm_medium, utm_campaign, utm_content, user_agent, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      link ? link.id : null,
      agora,
      diaLocalDeUnix(agora),
      url.searchParams.get('utm_source') || null,
      url.searchParams.get('utm_medium') || null,
      url.searchParams.get('utm_campaign') || null,
      url.searchParams.get('utm_content') || null,
      request.headers.get('user-agent') || null,
      request.headers.get('cf-connecting-ip') || null,
    ).run();
  } catch {
    // Silencioso de propósito: o visitante já foi redirecionado, e uma exceção
    // aqui não pode derrubar nada.
  }
}
