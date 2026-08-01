// Assinaturas de bot em UM lugar só. Antes existiam duas cópias — o regex de
// detectBot() em tracker.js (usado na ESCRITA de event_log) e a lista de
// substrings em api/conversion.js (usada na LEITURA, em SQL) — com um
// comentário pedindo sincronia manual. Duas listas que precisam concordar e
// não se falam divergem: um bot marcado como humano na escrita e filtrado na
// leitura some das duas contas, e ninguém percebe.
//
// A forma canônica é a lista de SUBSTRINGS, porque é a que o SQL consegue
// expressar (LIKE não faz regex). O detectBot é construído a partir dela.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

// Ordem importa: o primeiro que casar define o motivo registrado no
// event_log, e os específicos precisam vir antes do genérico 'bot'.
const GRUPOS = [
  { r: 'Googlebot', s: ['googlebot', 'google-inspectiontool'] },
  { r: 'Bingbot', s: ['bingbot', 'msnbot'] },
  { r: 'Facebook crawler', s: ['facebookexternalhit', 'facebot'] },
  { r: 'Twitter crawler', s: ['twitterbot'] },
  { r: 'LinkedIn crawler', s: ['linkedinbot'] },
  { r: 'Slackbot', s: ['slackbot'] },
  { r: 'WhatsApp preview', s: ['whatsapp'] },
  { r: 'Generic bot', s: ['bot', 'crawler', 'spider', 'scraper', 'headless'] },
  { r: 'HTTP library', s: ['python-requests', 'axios', 'node-fetch', 'curl', 'wget', 'httpie'] },
  { r: 'Automation tool', s: ['phantomjs', 'selenium', 'puppeteer', 'playwright'] },
  // Scanners de vulnerabilidade vistos em produção ('TLM-Audit-Scanner/1.0',
  // 'pathscan/1.0'). Estava só na lista da conversion.js; ao unificar, passa a
  // valer também na escrita — bot é bot nos dois lados.
  { r: 'Scanner', s: ['scan'] },
];

export const BOT_UA_SUBSTRINGS = GRUPOS.flatMap((g) => g.s);

export function detectBot(userAgent) {
  if (!userAgent || userAgent.length < 10) {
    return { isBot: true, botReason: 'Missing or short user-agent' };
  }
  const ua = userAgent.toLowerCase();
  for (const grupo of GRUPOS) {
    if (grupo.s.some((sub) => ua.includes(sub))) {
      return { isBot: true, botReason: grupo.r };
    }
  }
  return { isBot: false, botReason: '' };
}

// Cláusulas de exclusão para o WHERE. As substrings são literais estáticos
// deste módulo, nunca entrada do request — sem risco de injeção. O LIKE do
// SQLite é case-insensitive para ASCII, o que preserva a semântica do
// toLowerCase() acima. A regra "UA ausente ou < 10 chars" NÃO está aqui:
// vira `IS NOT NULL AND LENGTH(...) >= 10`, que cada consulta escreve.
export function clausulasBotSql(alias) {
  return BOT_UA_SUBSTRINGS
    .map((s) => `AND ${alias}.user_agent NOT LIKE '%${s}%'`)
    .join('\n');
}
