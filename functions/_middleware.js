import { escolherVariante } from './_ab-sorteio.js';
import { carregarTestesAtivos, normalizarPath } from './_ab-consulta.js';

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // Only intercept HTML page requests, skip static assets, API endpoints,
  // and the operator-facing dashboard (we don't want tracking cookies set
  // when an admin checks metrics).
  const isPageRequest = !url.pathname.match(
    /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map|json|webp|avif|mp4|webm|pdf|xml|txt|robots)$/i
  ) && !url.pathname.startsWith('/tracker')
    && !url.pathname.startsWith('/analytics')
    && !url.pathname.startsWith('/scripts/')
    && !url.pathname.startsWith('/webhook/')
    && !url.pathname.startsWith('/checkout-session')
    && !url.pathname.startsWith('/api/')
    && !url.pathname.startsWith('/dash')
    // /links só redireciona para fora (grupo de WhatsApp, checkout, LP). Criar
    // sessão e cookies aqui encheria o dashboard de visitas que nunca existiram:
    // clicar num link de disparo não é visitar o site. A contagem de cliques
    // vive em short_link_clicks, não nas sessões.
    && !url.pathname.startsWith('/links');

  if (!isPageRequest) {
    return next();
  }

  const caminho = normalizarPath(url.pathname);

  // As páginas de variante são detalhe interno: quem chega em /aplicacao-mentoria
  // recebe uma delas por reescrita, sem nunca ver este endereço. Deixá-las
  // abertas criaria conteúdo duplicado para o Google e, pior, permitiria entrar
  // na variante por fora do sorteio — visitas que sujariam a medição sem
  // aparecer como anomalia.
  //
  // O preview é a exceção: serve para conferir a variante antes de ligar o
  // teste, e a sessão que o usa é marcada e excluída da estatística.
  const ehPathDeVariante = caminho.startsWith('/ab/');
  const querPreview = url.searchParams.get('ab_preview') === '1';
  if (ehPathDeVariante && !querPreview) {
    return new Response('Not found', { status: 404 });
  }

  // --- Extract tracking parameters from URL ---
  // CRITICAL: Use raw query string extraction, NOT url.searchParams.get().
  // searchParams.get() URL-decodes the value, but Meta expects the exact
  // raw fbclid as it appears in the URL.
  const fbclid = getRawParam(url.search, 'fbclid');
  const gclid = getRawParam(url.search, 'gclid');
  const msclkid = getRawParam(url.search, 'msclkid');

  // --- Extract UTM parameters ---
  const utmSource = url.searchParams.get('utm_source') || '';
  const utmMedium = url.searchParams.get('utm_medium') || '';
  const utmCampaign = url.searchParams.get('utm_campaign') || '';
  const utmContent = url.searchParams.get('utm_content') || '';
  const utmTerm = url.searchParams.get('utm_term') || '';

  // --- Funil ---
  // Marcador próprio (fora dos UTMs) que diz QUAL oferta/jornada o lead entrou.
  // Necessário porque um mesmo funil pode compartilhar página com outros
  // (ex.: home), então não dá para deduzir só de landing_url, e os UTMs já
  // carregam origem/campanha/criativo. Persiste como first-touch (igual UTMs).
  const funnel = url.searchParams.get('funnel') || '';

  // --- Read existing cookies ---
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  let sessionId = cookies['_krob_sid'] || '';
  let externalId = cookies['_krob_eid'] || '';
  let existingFbc = cookies['_fbc'] || '';
  let existingFbp = cookies['_fbp'] || '';

  // --- Generate identifiers if missing ---
  const isNewSession = !sessionId;
  if (!sessionId) sessionId = crypto.randomUUID();
  if (!externalId) externalId = crypto.randomUUID();

  // --- Compute sub_domain_index per Meta SDK spec ---
  // Index = number of labels in the ETLD+1 minus 1.
  //   example.com     → 2 → index 1
  //   example.com.br  → 3 → index 2  (country-code second-level domain)
  // Computed from the Host header so the same code works for every recipient
  // without configuration. Falls back to 1 if the host can't be parsed.
  const SUB_DOMAIN_INDEX = computeSubDomainIndex(request.headers.get('host') || '');

  // --- Build _fbc from fbclid ---
  let fbc = existingFbc;
  if (fbclid) {
    const existingPayload = existingFbc ? extractFbcPayload(existingFbc) : '';
    if (!existingFbc || existingPayload !== fbclid) {
      fbc = `fb.${SUB_DOMAIN_INDEX}.${Date.now()}.${fbclid}`;
    }
  }

  // --- Generate _fbp if missing ---
  let fbp = existingFbp;
  if (!fbp) {
    fbp = `fb.${SUB_DOMAIN_INDEX}.${Date.now()}.${Math.floor(Math.random() * 9000000000) + 1000000000}`;
  }

  // --- Teste A/B ---
  // Toda esta seção é inerte quando não há teste ativo para o path.
  let abTeste = null;
  let abVariante = 'a';
  let abPreviewDoTeste = null;

  try {
    const testes = await carregarTestesAtivos(env);

    if (ehPathDeVariante) {
      // Preview: /ab/<slug>/b?ab_preview=1 → descobre o teste pelo slug para
      // marcar a sessão como contaminada.
      const slug = caminho.split('/')[2] || '';
      abPreviewDoTeste = testes.find((t) => t.slug === slug) || null;
    } else {
      abTeste = testes.find((t) => t.path === caminho) || null;
    }
  } catch (e) {
    // D1 indisponível não pode derrubar o site: sem teste, a página original.
    console.error('AB: falha ao ler testes ativos:', e.message);
  }

  if (abTeste) {
    // O cookie vem ANTES do sorteio: quem já foi exposto continua onde estava,
    // mesmo que os pesos mudem no meio do teste. Trocar alguém de variante em
    // andamento creditaria a conversão à página errada.
    const salva = lerCookieAb(cookies['_krob_ab'] || '')[abTeste.slug];
    abVariante = salva === 'a' || salva === 'b' ? salva : escolherVariante(abTeste, sessionId);
  }

  // --- Capture request metadata ---
  const clientIp = request.headers.get('cf-connecting-ip') || '';
  const userAgent = request.headers.get('user-agent') || '';
  const referrer = request.headers.get('referer') || '';
  const now = Math.floor(Date.now() / 1000);

  // --- Serve the page FIRST, then write to D1 in background ---
  let response;
  if (abTeste && abVariante === 'b') {
    const destino = (abTeste.variantes.find((v) => v.chave === 'b') || {}).page_path || '';
    const alvo = new URL(url);
    alvo.pathname = destino;
    response = await next(new Request(alvo.toString(), request));
    // Variante apontando para página inexistente (deploy pela metade, slug
    // renomeado): cai para a original em vez de entregar 404 a metade do
    // tráfego pago.
    if (response.status === 404) {
      console.error('AB: variante B sem página em', destino, '— servindo A');
      abVariante = 'a';
      response = await next();
    }
  } else {
    response = await next();
  }

  // --- Set HTTP cookies ---
  const maxAge = 34560000; // 400 days
  const cookieBase = `Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`;

  const newHeaders = new Headers(response.headers);
  newHeaders.append('Set-Cookie', `_krob_sid=${sessionId}; ${cookieBase}`);
  newHeaders.append('Set-Cookie', `_krob_eid=${externalId}; ${cookieBase}`);
  newHeaders.append('Set-Cookie', `_fbp=${fbp}; ${cookieBase}`);

  if (fbc) {
    newHeaders.append('Set-Cookie', `_fbc=${fbc}; ${cookieBase}`);
  }

  if (abTeste) {
    // 30 dias, e não os 400 dos cookies de atribuição: passado o teste, a
    // marca não serve mais para nada e só atrapalharia o próximo.
    const abAtual = lerCookieAb(cookies['_krob_ab'] || '');
    abAtual[abTeste.slug] = abVariante;
    newHeaders.append('Set-Cookie', `_krob_ab=${escreverCookieAb(abAtual)}; Path=/; Max-Age=2592000; SameSite=Lax; Secure`);

    // Duas versões da mesma URL: um cache intermediário que guardasse uma
    // delas serviria a variante errada para o visitante errado. O Set-Cookie
    // acima já impede o cache de borda da Cloudflare; o cabeçalho explícito
    // cobre proxies no caminho.
    newHeaders.set('Cache-Control', 'private, no-store');
  }

  const newResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });

  // --- D1 UPSERT (background, non-blocking) ---
  // Não gravar sessão quando a página respondida é 404: scanners de
  // vulnerabilidade varrem paths inexistentes (/wp-admin, /.env, /.git/HEAD...)
  // e tomam 404 em massa — não devem virar linhas lixo em `sessions`.
  // Somente 404 é excluído; 500 e afins continuam gravando (visitante real
  // com erro transitório ainda merece atribuição). Cookies já foram setados
  // acima, então o mesmo _krob_sid cria a sessão se ele navegar p/ página real.
  if (response.status !== 404) {
    context.waitUntil(
      (async () => {
        try {
          if (env.DB) {
            await env.DB.prepare(`
              INSERT INTO sessions (session_id, external_id, fbclid, gclid, msclkid, fbc, fbp, ip_address, user_agent, referrer, landing_url, utm_source, utm_medium, utm_campaign, utm_content, utm_term, funnel, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(session_id) DO UPDATE SET
                fbclid = CASE WHEN excluded.fbclid != '' THEN excluded.fbclid ELSE sessions.fbclid END,
                gclid = CASE WHEN excluded.gclid != '' THEN excluded.gclid ELSE sessions.gclid END,
                msclkid = CASE WHEN excluded.msclkid != '' THEN excluded.msclkid ELSE sessions.msclkid END,
                fbc = CASE WHEN excluded.fbc != '' THEN excluded.fbc ELSE sessions.fbc END,
                utm_source = CASE WHEN excluded.utm_source != '' THEN excluded.utm_source ELSE sessions.utm_source END,
                utm_medium = CASE WHEN excluded.utm_medium != '' THEN excluded.utm_medium ELSE sessions.utm_medium END,
                utm_campaign = CASE WHEN excluded.utm_campaign != '' THEN excluded.utm_campaign ELSE sessions.utm_campaign END,
                utm_content = CASE WHEN excluded.utm_content != '' THEN excluded.utm_content ELSE sessions.utm_content END,
                utm_term = CASE WHEN excluded.utm_term != '' THEN excluded.utm_term ELSE sessions.utm_term END,
                funnel = CASE WHEN excluded.funnel != '' THEN excluded.funnel ELSE sessions.funnel END,
                updated_at = excluded.updated_at
            `).bind(sessionId, externalId, fbclid, gclid, msclkid, fbc, fbp, clientIp, userAgent, referrer, url.toString(), utmSource, utmMedium, utmCampaign, utmContent, utmTerm, funnel, now, now).run();

            // Exposição ao teste. ON CONFLICT DO NOTHING garante o
            // first-touch no banco: o visitante entra uma vez e fica.
            if (abTeste) {
              await env.DB.prepare(`
                INSERT INTO ab_assignments (session_id, test_id, variante, assigned_at, is_preview)
                VALUES (?, ?, ?, ?, 0)
                ON CONFLICT(session_id, test_id) DO NOTHING
              `).bind(sessionId, abTeste.id, abVariante, now).run();
            }

            // Preview marca a sessão como contaminada — inclusive se ela já
            // tinha sido sorteada antes. Quem espiou a variante não pode
            // continuar valendo como visitante do teste.
            if (abPreviewDoTeste) {
              await env.DB.prepare(`
                INSERT INTO ab_assignments (session_id, test_id, variante, assigned_at, is_preview)
                VALUES (?, ?, 'b', ?, 1)
                ON CONFLICT(session_id, test_id) DO UPDATE SET is_preview = 1
              `).bind(sessionId, abPreviewDoTeste.id, now).run();
            }
          }
        } catch (e) {
          console.error('Middleware D1 error:', e.message);
        }
      })()
    );
  }

  return newResponse;
}

function parseCookies(cookieHeader) {
  const cookies = {};
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) cookies[name.trim()] = rest.join('=');
  });
  return cookies;
}

// O cookie guarda VÁRIOS testes ('slug:variante|outro:variante') porque o
// visitante pode atravessar mais de um teste em páginas diferentes, e um
// cookie por teste encheria o cabeçalho de toda requisição.
function lerCookieAb(valor) {
  const mapa = {};
  for (const par of (valor || '').split('|')) {
    const [slug, variante] = par.split(':');
    if (slug && (variante === 'a' || variante === 'b')) mapa[slug] = variante;
  }
  return mapa;
}

function escreverCookieAb(mapa) {
  return Object.entries(mapa)
    .map(([slug, variante]) => `${slug}:${variante}`)
    .join('|');
}

function getRawParam(search, name) {
  const match = (search || '').match(new RegExp('[?&]' + name + '=([^&]*)'));
  return match ? match[1] : '';
}

function extractFbcPayload(fbc) {
  if (!fbc) return '';
  const parts = fbc.split('.');
  return parts.length >= 4 ? parts[3] : '';
}

// Country-code second-level domains where the ETLD+1 has three labels.
// A full public-suffix list is too heavy for an edge worker; this covers
// the common cases. Anything not listed defaults to the 2-label assumption
// (example.com → index 1), which is correct for .com / .net / .org / etc.
const CC_TLDS = new Set([
  'com.br', 'com.ar', 'com.mx', 'com.co', 'com.pe', 'com.ve', 'com.ec',
  'com.au', 'com.pt', 'com.pl', 'com.tr', 'com.ua', 'com.ru',
  'com.cn', 'com.tw', 'com.hk', 'com.sg', 'com.my', 'com.ph', 'com.vn',
  'co.uk', 'co.jp', 'co.kr', 'co.nz', 'co.za', 'co.in', 'co.id',
]);

function computeSubDomainIndex(host) {
  if (!host) return 1;
  const hostname = host.split(':')[0].toLowerCase();
  const parts = hostname.split('.');
  if (parts.length < 2) return 0;
  const lastTwo = parts.slice(-2).join('.');
  // Known country-code 2-label TLD → ETLD+1 has 3 labels → index 2
  if (CC_TLDS.has(lastTwo)) return 2;
  // Standard case: example.com → ETLD+1 has 2 labels → index 1
  return 1;
}
