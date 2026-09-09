import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectBot, detectBotPorIp, BOT_UA_SUBSTRINGS, clausulasBotSql } from '../functions/_bots.js';

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

test('user-agent de navegador real não é bot', () => {
  const r = detectBot(CHROME);
  assert.equal(r.isBot, false);
  assert.equal(r.botReason, '');
});

test('user-agent ausente ou curto é bot', () => {
  assert.equal(detectBot('').isBot, true);
  assert.equal(detectBot('curto').isBot, true);
});

test('crawlers conhecidos são identificados com o motivo certo', () => {
  assert.equal(detectBot('Googlebot/2.1 (+http://www.google.com/bot.html)').botReason, 'Googlebot');
  assert.equal(detectBot('facebookexternalhit/1.1').botReason, 'Facebook crawler');
  assert.equal(detectBot('WhatsApp/2.19.81 A').botReason, 'WhatsApp preview');
  assert.equal(detectBot('curl/8.4.0 aaaaaa').botReason, 'HTTP library');
});

test('cada substring da lista SQL casa com o detectBot', () => {
  // Protege a equivalência entre a checagem em JS (escrita) e a em SQL
  // (leitura). Sem isso, um bot poderia entrar no event_log como humano e
  // continuar sendo filtrado no dash — ou o contrário.
  for (const s of BOT_UA_SUBSTRINGS) {
    const ua = `Agente-${s}-de-teste/1.0`;
    assert.equal(detectBot(ua).isBot, true, `"${s}" deveria ser bot`);
  }
});

test('clausulasBotSql usa o alias pedido e cobre a lista inteira', () => {
  const sql = clausulasBotSql('s');
  assert.equal(sql.split('\n').length, BOT_UA_SUBSTRINGS.length);
  assert.ok(sql.includes("AND s.user_agent NOT LIKE '%googlebot%'"));
  assert.ok(clausulasBotSql('a').includes("AND a.user_agent NOT LIKE '%curl%'"));
});

// --- Bots por IP (09/09/2026) -----------------------------------------------

test('os IPs medidos no incidente de 09/09 são bot, com o motivo certo', () => {
  // Um representante de cada família, como observado em `sessions`.
  assert.match(detectBotPorIp('82.197.67.74').botReason, /Scraper da lives-semanais-v1/);
  assert.match(detectBotPorIp('45.148.10.246').botReason, /45\.148\.10\.0\/24/);
  assert.match(detectBotPorIp('195.178.110.72').botReason, /195\.178\.110\.0\/24/);
  assert.match(detectBotPorIp('93.123.109.165').botReason, /93\.123\.109\.0\/24/);
  assert.match(detectBotPorIp('2605:a143:2218:7058::200').botReason, /lead falso/);
});

test('o /24 pega os quatro endereços que o scanner alternou', () => {
  // Ele trocou o último octeto entre rajadas; barrar só o exato não resolveria.
  for (const ip of ['45.148.10.12', '45.148.10.40', '45.148.10.201', '45.148.10.246']) {
    assert.equal(detectBotPorIp(ip).isBot, true, `deveria ser bot: ${ip}`);
  }
});

test('o /64 do bot de lead falso vale para qualquer sufixo', () => {
  for (const ip of [
    '2605:a143:2218:7058::200',
    '2605:a143:2218:7058::1',
    '2605:a143:2218:7058:0:0:0:200',
    '2605:0a143:2218:7058::ff',
  ]) {
    assert.equal(detectBotPorIp(ip).isBot, true, `deveria ser bot: ${ip}`);
  }
});

// O vizinho é outra pessoa: um dígito de diferença já é outro assinante.
test('não pega blocos vizinhos dos barrados', () => {
  for (const ip of [
    '45.148.11.12',        // /24 ao lado
    '45.148.1.12',
    '195.178.111.72',
    '93.123.108.165',
    '82.197.67.75',        // vizinho do IP exato: não é o scraper
    '2605:a143:2218:7059::200',
    '2604:a143:2218:7058::200',
  ]) {
    assert.equal(detectBotPorIp(ip).isBot, false, `não deveria ser bot: ${ip}`);
  }
});

// Mesma lista de IPs de leads REAIS que segura o _lead-bloqueio.js. Se um
// destes cair, o corte por IP passou a comer visitante de verdade — que é o
// erro caro: métrica suja se conserta, lead perdido não volta.
test('não pega os IPs dos leads reais da mesma LP', () => {
  for (const ip of [
    '2804:1dc:8207:ec00:8449:a5c0:5519:53c6',
    '2804:18:789d:384e:797f:3667:c362:b63e',
    '2804:1530:681:f434:bc68:7677:d5e7:c9bd',
    '2804:214:996a:20cd:18d2:19b2:3b24:5d0a',
    '2804:8ed4:100:3100:94be:cbe1:3cdd:b1fe',
    '189.113.240.107',
    '45.229.120.253',
    '179.179.10.34',
  ]) {
    assert.equal(detectBotPorIp(ip).isBot, false, `não deveria ser bot: ${ip}`);
  }
});

// Ausência de IP não é prova de nada: presumir bot mataria visitante real.
test('IP ausente ou incomparável não vira bot', () => {
  for (const ip of ['', null, undefined, '   ', 'não-é-ip', '::1', '::', '45.148.10', '999.148.10.1']) {
    assert.equal(detectBotPorIp(ip).isBot, false, `não deveria ser bot: ${JSON.stringify(ip)}`);
  }
});

test('detectBotPorIp devolve a mesma forma do detectBot', () => {
  // Quem chama os dois trata o resultado igual; se as formas divergirem, o
  // motivo some do event_log sem ninguém perceber.
  for (const r of [detectBotPorIp('82.197.67.74'), detectBotPorIp('8.8.8.8')]) {
    assert.deepEqual(Object.keys(r).sort(), ['botReason', 'isBot']);
    assert.equal(typeof r.isBot, 'boolean');
    assert.equal(typeof r.botReason, 'string');
  }
});
