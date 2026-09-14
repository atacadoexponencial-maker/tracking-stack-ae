import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agregarSaude } from '../functions/api/events.js';

// Linhas como o GROUP BY (browser, is_bot, is_junk) do /api/events devolve.
const linha = (extra) => ({
  browser: 'Chrome', is_bot: 0, is_junk: 0, total: 0, meta_ok: 0, meta_fail: 0, blocked: 0,
  fbp_from_pixel: 0, fbp_from_middleware: 0, fbp_from_session: 0, fbp_none: 0,
  fbc_from_middleware: 0, fbclid_from_server: 0, ...extra,
});

test('summary conta bots junto; recovery e browsers só o que é real', () => {
  const r = agregarSaude([
    linha({ browser: 'Chrome', total: 10, meta_ok: 8, meta_fail: 2, blocked: 3, fbp_from_middleware: 4, fbp_from_pixel: 5, fbp_none: 1 }),
    linha({ browser: 'Safari', total: 5, meta_ok: 5, fbp_from_middleware: 5, blocked: 1 }),
    linha({ browser: 'Chrome', is_bot: 1, total: 7, meta_fail: 7, blocked: 7, fbp_from_middleware: 7 }),
    linha({ browser: 'Chrome', is_junk: 1, total: 2, meta_ok: 2, fbp_from_pixel: 2 }),
  ]);

  assert.deepEqual(r.summary, [{ event_name: 'Lead', total: 24, meta_ok: 15, meta_fail: 9, bots: 7 }]);

  assert.equal(r.recovery.total_events, 24);
  assert.equal(r.recovery.real_events, 17, 'junk não é bot: entra em real_events como antes');
  assert.equal(r.recovery.adblock_recovered, 4);
  assert.equal(r.recovery.itp_recovered, 9);
  assert.equal(r.recovery.fbp_from_middleware, 9);
  assert.equal(r.recovery.fbp_from_pixel, 7);
  assert.equal(r.recovery.fbp_none, 1);

  // browsers: nem bot nem junk, somados por navegador, maior primeiro.
  assert.deepEqual(r.browsers, [
    { browser: 'Chrome', total: 10, blocked: 3, itp_recovered: 4 },
    { browser: 'Safari', total: 5, blocked: 1, itp_recovered: 5 },
  ]);
});

test('sem linhas: summary vazio (como o GROUP BY antigo), recovery zerado, browsers vazio', () => {
  const r = agregarSaude([]);
  assert.deepEqual(r.summary, []);
  assert.equal(r.recovery.total_events, 0);
  assert.equal(r.recovery.real_events, 0);
  assert.deepEqual(r.browsers, []);
});

test('valores vindos como texto ou null do D1 não quebram a soma', () => {
  const r = agregarSaude([linha({ browser: null, total: '3', meta_ok: null, is_bot: '0' })]);
  assert.equal(r.summary[0].total, 3);
  assert.equal(r.browsers[0].browser, null);
  assert.equal(r.browsers[0].total, 3);
});
