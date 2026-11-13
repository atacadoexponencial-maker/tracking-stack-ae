// POST /api/webhooks/zouti → compras da Imersão 2027 vindas da Zouti
//
// Spec spec-popup-checkout-imersao.md, série S10. Regras em ../_imersao-zouti.js;
// aqui só se lê a requisição (corpo BRUTO, que é o que a Zouti assina) e se
// devolve a resposta. O segredo fica em ZOUTI_WEBHOOK_SECRET, no servidor.
//
// Cadastro no painel da Zouti: Integrações → Webhooks → Criar Webhook, com este
// endereço e os eventos de pedido (pago, estornado, cancelado, em chargeback).
import { processarAviso } from '../_imersao-zouti.js';

const json = (dados, status = 200) => Response.json(dados, { status });

export async function onRequestPost({ request, env }) {
  const corpo = await request.text();
  const h = request.headers;
  try {
    const r = await processarAviso({
      env,
      corpo,
      cab: {
        assinatura: h.get('x-zouti-signature'),
        tipo: h.get('x-zouti-event-type') || '',
        eventoId: h.get('x-zouti-event-id') || '',
        entregaId: h.get('x-zouti-webhook-delivery-id') || '',
        objetoId: h.get('x-zouti-object-id') || '',
      },
    });
    return json(r.corpo, r.status);
  } catch (e) {
    // Falha do banco: 500 para a Zouti tentar de novo (ela reenvia por até 4 dias).
    console.error('[zouti] falha ao processar aviso:', e && e.message);
    return json({ erro: 'falha ao gravar' }, 500);
  }
}
