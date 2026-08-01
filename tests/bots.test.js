import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectBot, BOT_UA_SUBSTRINGS, clausulasBotSql } from '../functions/_bots.js';

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
