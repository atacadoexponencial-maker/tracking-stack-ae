// GET /api/argo/leads-por-anuncio?dias=N&maturacao_dias=M
// Autenticação: `Authorization: Bearer <ARGO_KEY>` (ver `_argo-auth.js`).
//
// A metade do dado que o tracking tem: leads e MQLs por `utm_content`, que é o
// nome do anúncio no Meta. SEM gasto — o tracking só sincroniza o Meta em
// `level=campaign` (functions/api/sync/meta-ads.js), então quem tem gasto por
// anúncio é o Argo, que já consulta a Graph API com o token do profile. Ele faz
// a junção e mede a taxa de acerto dela.
//
// Janela de maturação: leads criados nos últimos `maturacao_dias` entram em
// `leads_recentes` e ficam fora da conta de qualificados.
//
// Cliente único: `argo_anuncios.ler_leads_por_anuncio()` no profile
// `gestor-ia` da VPS. O contrato de resposta é consumido por `juntar()` lá.

import { recusarSemChaveArgo } from '../_argo-auth.js';
import { lerCardsCriadosNoPeriodo, lerTaskIdsDeTesteOuBot } from '../_feedback-marketing-crm.js';
import { agruparPorAnuncio } from '../_argo-leads-anuncio.js';

const DIA_MS = 86400000;
const SEGUNDO_MS = 1000;

function inteiroNaFaixa(bruto, padrao, minimo, maximo) {
  const n = Number.parseInt(bruto ?? '', 10);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(Math.max(n, minimo), maximo);
}

export async function onRequestGet({ request, env }) {
  const naoAutorizado = recusarSemChaveArgo(request, env);
  if (naoAutorizado) return naoAutorizado;

  const url = new URL(request.url);
  const dias = inteiroNaFaixa(url.searchParams.get('dias'), 30, 1, 92);
  const maturacaoDias = inteiroNaFaixa(url.searchParams.get('maturacao_dias'), 5, 0, 30);

  const agora = Date.now();
  const desde = agora - dias * DIA_MS;
  const maduroAte = agora - maturacaoDias * DIA_MS;

  try {
    // `lerCardsCriadosNoPeriodo` recebe SEGUNDOS (ela multiplica por 1000 para
    // a API do ClickUp) e devolve `{ ok, cards }` ou `{ ok: false, aviso }` —
    // CRM fora do ar vira aviso, nunca exceção. Ler errado aqui devolveria
    // "nenhum lead" com cara de resposta boa, e o Argo pausaria a conta
    // inteira.
    const crm = await lerCardsCriadosNoPeriodo(env, {
      desde: Math.floor(desde / SEGUNDO_MS),
      ate: Math.ceil(agora / SEGUNDO_MS),
    });
    if (!crm.ok) {
      return Response.json({ erro: crm.aviso }, { status: 503 });
    }

    // Mesmo corte de teste e bot que a aba de leads e o /api/feedback-marketing
    // usam. Sem ele um lead de bot faria um anúncio morto parecer vivo, e o
    // Argo deixaria de propor a pausa — além de a conta do Argo divergir da
    // que a gestora vê no painel.
    const excluidos = new Set(
      await lerTaskIdsDeTesteOuBot(env.DB, crm.cards.map((c) => c.id)),
    );
    const cards = crm.cards.filter((c) => !excluidos.has(String(c.id)));

    // A régua de cada funil sai do cadastro, não de uma lista no código: se a
    // gestora criar um funil novo no relatório, ele já chega aqui com o tipo
    // certo. Sem esta leitura nenhum anúncio é julgável — silêncio em vez de
    // julgar todo mundo por MQL, que foi o erro de 22/09.
    const funisRes = await env.DB.prepare(
      `SELECT id, nome, tipo, opcoes_crm FROM funis_relatorio WHERE situacao = 'ativo'`,
    ).all();
    const funis = funisRes.results || [];

    const agrupado = agruparPorAnuncio({ cards, maduroAteMs: maduroAte, funis });
    return Response.json({
      ...agrupado,
      descartados_teste_ou_bot: excluidos.size,
      julgaveis: agrupado.anuncios.filter((a) => a.julgavel).length,
      janela: {
        desde: new Date(desde).toISOString(),
        ate: new Date(agora).toISOString(),
        maduro_ate: new Date(maduroAte).toISOString(),
        maturacao_dias: maturacaoDias,
      },
    });
  } catch {
    // A mensagem nunca carrega o erro original: ele pode trazer a URL do
    // ClickUp com o token no cabeçalho, ou o corpo da resposta deles.
    return Response.json(
      { erro: 'Não foi possível ler os leads por anúncio agora.' },
      { status: 500 },
    );
  }
}
