// POST /webhook/ghl-probe — SONDA TEMPORÁRIA (diagnóstico da feature #2).
//
// Não é a feature de verdade: só registra CRU o que o GoHighLevel manda quando
// um workflow (Email Opened / Clicked → Custom Webhook) dispara pra cá. Guarda
// corpo + headers em config_kv sob uma chave com timestamp, pra eu ler de volta
// de forma confiável (o tail do Pages perde requests no meio do lixo de
// scanners). Depois de descobrir o formato do payload, este arquivo é removido
// e a feature #2 real é construída com base no que o GHL de fato envia.
export async function onRequestPost(context) {
  const { request, env } = context;
  const corpo = await request.text();

  // Headers que podem trazer autenticação ou metadados do evento.
  const headers = {};
  for (const [k, v] of request.headers) {
    if (/type|event|signature|auth|ghl|highlevel|webhook|user-agent/i.test(k)) headers[k] = v;
  }

  try {
    if (env.DB && corpo) {
      await env.DB.prepare(
        `INSERT INTO config_kv (chave, valor) VALUES (?, ?)
         ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`
      ).bind(
        'ghl_probe:' + Date.now(),
        JSON.stringify({ headers, body: corpo.slice(0, 8000) })
      ).run();
    }
  } catch (e) {
    console.error('ghl-probe store error:', e.message);
  }

  // GHL espera um 200 rápido.
  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}

// GET só pra confirmar que a rota está no ar (sem gravar nada).
export function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, probe: 'ghl-email', hint: 'POST aqui' }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
}
