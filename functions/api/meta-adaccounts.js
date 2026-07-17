// GET /api/meta-adaccounts?key=<DASH_KEY>
//
// Diagnóstico read-only: lista as contas de anúncio visíveis ao token CAPI
// (META_ACCESS_TOKEN) e testa se dá para ler insights (ads_read) em cada uma.
// Usado para configurar o sync de investimento sem caçar IDs manualmente.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (!env.DASH_KEY || url.searchParams.get('key') !== env.DASH_KEY) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const token = env.META_ADS_ACCESS_TOKEN || env.META_ACCESS_TOKEN;
  if (!token) return json({ error: 'sem token Meta configurado' }, 500);

  const r = await fetch(`https://graph.facebook.com/v25.0/me/adaccounts?fields=id,name,account_status&limit=100&access_token=${token}`);
  const corpo = await r.json();
  if (!r.ok) return json({ error: 'adaccounts falhou', detalhe: corpo }, 502);

  const contas = (corpo.data || []).map((c) => ({ id: c.id, nome: c.name, status: c.account_status }));

  // Testa insights (ads_read) apenas na conta pedida (?testar=<id|trecho do nome>).
  const alvo = (url.searchParams.get('testar') || '').toLowerCase();
  let teste = null;
  if (alvo) {
    const conta = contas.find((c) => c.id === alvo || (c.nome || '').toLowerCase().includes(alvo));
    if (conta) {
      const t = await fetch(`https://graph.facebook.com/v25.0/${conta.id}/insights?fields=spend&date_preset=yesterday&access_token=${token}`);
      teste = { conta: conta.id, nome: conta.nome, insights_ok: t.ok, detalhe: t.ok ? undefined : (await t.json()).error?.message };
    } else {
      teste = { erro: 'conta não encontrada na lista' };
    }
  }
  return json({ total: contas.length, teste, contas });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
