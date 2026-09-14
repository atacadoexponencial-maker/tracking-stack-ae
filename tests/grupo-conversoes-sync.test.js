import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/sync/grupo-conversoes.js';

// Regressão do incidente de 2026-09-04: com o token do pixel 2 inválido, a
// fila de pendências nunca esvazia (erro de credencial não consome tentativa,
// e isso é intencional). Cada rodada do cron refazia a busca cara de lead
// (varredura de lead_dispatch) para TODAS as pendências, 96x por dia. Desde a
// revisão de 2026-09-13 o token é validado ANTES da primeira busca: rodada com
// token quebrado custa zero leituras de lead_dispatch.

function fakeDb({ pendentes }) {
  const chamadas = { buscarLead: 0, syncLog: 0 };

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
    run: async () => {
      if (sql.includes('INSERT INTO sync_log')) chamadas.syncLog++;
      // Nenhuma pendência expirada no cenário: o varredor não muda nada.
      if (sql.includes('expirada')) return { meta: { changes: 0 } };
      return { meta: { changes: 1 } };
    },
  });

  const batch = async (stmts) => stmts.map(() => ({ meta: { changes: 1 } }));

  return { db: { prepare, batch }, chamadas };
}

function pendentesFake(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1, group_jid: '120363427499061913@g.us', phone: '5511987654321',
    event_id: `grupo:x:${i}`, occurred_at: new Date().toISOString(), tentativas: 0,
  }));
}

function chamar(db) {
  return onRequestPost({
    request: new Request('https://x/api/sync/grupo-conversoes', {
      method: 'POST', headers: { 'x-sync-secret': 's3cr3t' },
    }),
    env: {
      DB: db, SYNC_SECRET: 's3cr3t',
      META_PIXEL_ID_2: '2800317883678788', META_ACCESS_TOKEN_2: 'token',
    },
  });
}

test('token inválido: aborta antes de qualquer busca de lead e registra no sync_log', async () => {
  const { db, chamadas } = fakeDb({ pendentes: pendentesFake(20) });

  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ error: { message: 'Invalid OAuth access token', code: 190 } }),
    { status: 400 }
  );

  try {
    const body = await (await chamar(db)).json();

    assert.equal(body.credencial_invalida, true, 'deve sinalizar credencial inválida');
    assert.equal(body.enviadas, 0);
    assert.equal(chamadas.buscarLead, 0,
      `busca de lead não deve rodar com token inválido, rodou ${chamadas.buscarLead}x`);
    assert.equal(chamadas.syncLog, 1, 'erro de credencial precisa ficar registrado');
  } finally {
    globalThis.fetch = original;
  }
});

test('token válido: valida uma vez, busca lead por pendência e envia todas', async () => {
  const { db, chamadas } = fakeDb({ pendentes: pendentesFake(3) });

  const original = globalThis.fetch;
  const metodos = [];
  globalThis.fetch = async (url, init) => {
    metodos.push((init && init.method) || 'GET');
    return new Response(JSON.stringify({ events_received: 1 }), { status: 200 });
  };

  try {
    const body = await (await chamar(db)).json();

    assert.equal(body.credencial_invalida, false);
    assert.equal(body.enviadas, 3);
    assert.equal(chamadas.buscarLead, 3);
    // 1 GET de validação + 1 POST por pendência — a validação não se repete.
    assert.deepEqual(metodos, ['GET', 'POST', 'POST', 'POST']);
  } finally {
    globalThis.fetch = original;
  }
});

test('rodada sem trabalho não grava sync_log', async () => {
  const { db, chamadas } = fakeDb({ pendentes: [] });

  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('não deveria chamar a rede'); };

  try {
    const body = await (await chamar(db)).json();
    assert.equal(body.ok, true);
    assert.equal(chamadas.syncLog, 0);
  } finally {
    globalThis.fetch = original;
  }
});
