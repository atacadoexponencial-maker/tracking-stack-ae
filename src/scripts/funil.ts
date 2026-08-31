/**
 * Eventos internos do funil de micro-conversões (spec 2026-08-31).
 *
 * "Interno" tem significado técnico aqui: o /tracker grava estes eventos no
 * event_log e NÃO os repassa a Meta, GA4, ClickUp ou GoHighLevel (a lista
 * `EVENTOS_INTERNOS` em functions/tracker.js). Um clique em botão não é
 * conversão — mandá-lo ao pixel poluiria a otimização das campanhas.
 *
 * O envio vive aqui, num lugar só, porque três eventos o usam: `FormStart`
 * (src/scripts/form-start.ts), `CTAClick` e `FormStep`. Antes desta issue o
 * `fetch` estava escrito à mão dentro do form-start.
 */

/**
 * Envia um evento interno ao /tracker.
 *
 * PREFERE `navigator.sendBeacon`: o `CTAClick` é disparado num clique que
 * NAVEGA, e o navegador cancela `fetch` pendente quando a página é
 * descarregada. Sem o beacon, justamente os cliques mais importantes — os que
 * levam ao checkout — seriam os que menos apareceriam no funil. O `fetch` de
 * reserva vai com `keepalive: true` pelo mesmo motivo.
 *
 * Nunca lança e nunca rejeita: um evento de medição não pode travar quem está
 * preenchendo o formulário nem atrasar a ida ao checkout. Consequência aceita:
 * quem perde a conexão no meio some do funil — o erro sempre subnotifica,
 * nunca infla.
 */
export function enviarEventoInterno(
  nome: string,
  prefixo: string,
  extras: Record<string, unknown> = {}
) {
  try {
    const corpo = JSON.stringify({
      event_name: nome,
      // Mesmo padrão de event_id dos demais pontos (pv-, fs-, cta-, stp-).
      event_id: prefixo + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: window.location.href,
      ...extras,
    });

    // sendBeacon devolve `false` quando a fila do navegador está cheia — nesse
    // caso o evento NÃO foi enfileirado, então cair para o fetch em vez de
    // perdê-lo em silêncio.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const enfileirado = navigator.sendBeacon(
        '/tracker',
        new Blob([corpo], { type: 'application/json' })
      );
      if (enfileirado) return;
    }

    fetch('/tracker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: corpo,
      keepalive: true,
    }).catch(function () {
      /* silencioso: sinal de apoio nunca pode atrapalhar o visitante */
    });
  } catch (e) {
    /* idem — inclui o TypeError que alguns navegadores lançam no sendBeacon */
  }
}
