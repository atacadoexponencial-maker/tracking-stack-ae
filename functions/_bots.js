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

import { prefixo24, prefixo64 } from './_ip.js';

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

// --- Bots por IP ------------------------------------------------------------
//
// O detectBot() acima só sabe julgar quem se identifica. Um script que manda
// UA de Chrome passa liso por ele — e foi exatamente o que aconteceu: em
// 09/09/2026, medindo `sessions` nos 7 dias anteriores, 73% das sessões da
// /lives-semanais-v1 (672 de 920) vinham de bots com UA de navegador real, e
// entravam inteiras no denominador da Conversão por LP. A taxa de conversão
// daquela LP estava sendo dividida por quase 4.
//
// O corte é por IP porque é o que esses têm de estável: o user-agent eles
// rotacionam de graça (a família A abaixo alterna 4), o IP custa dinheiro.
// Mesma lição do bloqueio de lead falso de 08/09 — ver _lead-bloqueio.js.
//
// É lista negra, não defesa: no dia em que trocarem de servidor, voltam a
// passar. Serve para estancar o que está sangrando na métrica.
const IPS_DE_BOT = [
  // Família A — scraper dedicado. IP único da Hostinger (NL), 556 sessões em
  // 7 dias, 100% na /lives-semanais-v1 e em nenhuma outra página, rotacionando
  // 4 user-agents mobile (SM-J610F, iPhone 17_5_1, SM-S926B, Pixel 7). Nunca
  // envia formulário — não gerava lead falso, só inflava o denominador. É o
  // "segundo bot" que o commit 12d6de1 deixou de fora por não gerar lead.
  { r: 'Scraper da lives-semanais-v1 (82.197.67.74)', exato: '82.197.67.74' },

  // Famílias B/C/D — scanner de exploit WordPress. Três /24 diferentes com os
  // MESMOS user-agents, incluindo o literal 'WordPress/6.4.3', em rajadas de
  // ~233 sessões em ~2 minutos, caçando wp-json/batch/v1 em /, /blog/, /wp/ e
  // /wordpress/. ~1.594 sessões em 7 dias. O site é Astro: não há WordPress
  // para explorar, mas as batidas na home (200) viravam sessão.
  //
  // O recorte é /24 e não o endereço exato porque eles já trocam o último
  // octeto entre rajadas (45.148.10.12, .40, .201, .246).
  { r: 'Scanner WordPress (45.148.10.0/24)', prefixo24: '45.148.10' },
  { r: 'Scanner WordPress (195.178.110.0/24)', prefixo24: '195.178.110' },
  { r: 'Scanner WordPress (93.123.109.0/24)', prefixo24: '93.123.109' },

  // Família E — o bot de lead falso de 08/09. O lead dele já é barrado no
  // _lead-bloqueio.js, mas a VISITA continuava sendo gravada: 117 sessões nos
  // mesmos 7 dias, a última no dia da medição. Barrar aqui fecha o outro lado.
  { r: 'Bot de lead falso (2605:a143:2218:7058::/64)', prefixo64: '2605:a143:2218:7058' },
];

/**
 * Julga o IP de origem, com a mesma forma de retorno do detectBot() para que
 * quem chama os dois possa tratar o resultado igual.
 *
 * IP desconhecido ou vazio devolve "não é bot": a ausência do
 * `cf-connecting-ip` não é prova de nada, e presumir bot mataria visitante
 * real. Errar liberando bot é uma métrica suja; errar bloqueando é um lead
 * perdido, que é pior.
 */
export function detectBotPorIp(ip) {
  const cru = (ip || '').trim().toLowerCase();
  if (!cru) return { isBot: false, botReason: '' };
  const p24 = prefixo24(cru);
  const p64 = prefixo64(cru);
  for (const regra of IPS_DE_BOT) {
    if (regra.exato && cru === regra.exato) return { isBot: true, botReason: regra.r };
    if (regra.prefixo24 && p24 && p24 === regra.prefixo24) return { isBot: true, botReason: regra.r };
    if (regra.prefixo64 && p64 && p64 === regra.prefixo64) return { isBot: true, botReason: regra.r };
  }
  return { isBot: false, botReason: '' };
}

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
