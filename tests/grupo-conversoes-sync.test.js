import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/sync/grupo-conversoes.js';

// Regressão do incidente de 2026-09-04: com o token do pixel 2 inválido, a
// fila de pendências nunca esvazia (erro de credencial não consome tentativa,
// e isso é intencional). O lote precisa ABORTAR na primeira falha de
// credencial — sem isso, cada rodada do cron refazia a busca cara de lead
// (varredura de lead_dispatch) para TODAS as pendências, 96x por dia.

function fakeDb({ pendentes }) {
  const chamadas = { buscarLead: 0 };

  const prepare = (sql) => ({
    bind: (...binds) => prepare(sql)._com(binds),
    _com: () => prepare(sql),
    all: async () => {
      if (sql.includes('whatsapp_groups_tracked')) return { results: [] };
      if (sql.includes('FROM whatsapp_group_conversions')) return { results: pendentes };
      return { results: [] };
    },
    first: async () => {
      if (sql.includes('FROM lead_dispatch')) { chamadas.buscarLead++; return null; }
      if (sql.includes('MAX(received_at)')) return { ts: Math.floor(Date.now() / 1000) };
      return null;
    },
    run: async () => ({ meta: { changes: 1 } }),
  });

  return { db: { prepare }, chamadas };
}

test('aborta o lote na primeira falha de credencial, sem repetir a busca cara', async () => {
  const pendentes = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1, group_jid: '120363427499061913@g.us', phone: '5511987654321',
    event_id: `grupo:x:${i}`, occurred_at: '2026-09-01T12:00:00Z', tentativas: 0,
  }));
  const { db, chamadas } = fakeDb({ pendentes });

  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: { message: 'Invalid OAuth access token', code: 190 } }),
    { status: 400 }
  );

  try {
    const resp = await onRequestPost({
      request: new Request('https://x/api/sync/grupo-conversoes', {
        method: 'POST', headers: { 'x-sync-secret': 's3cr3t' },
      }),
      env: {
        DB: db, SYNC_SECRET: 's3cr3t',
        META_PIXEL_ID_2: '2800317883678788', META_ACCESS_TOKEN_2: 'token-invalido',
      },
    });
    const body = await resp.json();

    assert.equal(body.credencial_invalida, true, 'deve sinalizar credencial inválida');
    assert.equal(chamadas.buscarLead, 1,
      `busca de lead deve rodar 1x e parar, rodou ${chamadas.buscarLead}x`);
  } finally {
    globalThis.fetch = original;
  }
});
