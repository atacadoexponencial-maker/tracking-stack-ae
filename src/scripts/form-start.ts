/**
 * Dispara o evento `FormStart` no primeiro toque do visitante num formulário.
 *
 * Existe por causa da amostra: com ~1% de conversão, esperar o `Lead` para
 * comparar duas versões de página leva meses. Quem COMEÇA a preencher é um
 * sinal 3 a 5 vezes mais frequente — não decide o teste A/B (isso continua
 * sendo do `Lead`), mas mostra a tendência muito antes.
 *
 * O evento é interno: o /tracker grava no event_log e não repassa a Meta,
 * GA4, ClickUp nem GoHighLevel.
 */
export function ativarFormStart(elemento: HTMLElement, dados: { funnel: string; material?: string }) {
  if (!elemento) return;

  // `once` porque o interesse é no PRIMEIRO toque: o listener se remove
  // sozinho depois de disparar, sem estado para controlar.
  elemento.addEventListener(
    'input',
    () => {
      fetch('/tracker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'FormStart',
          // Mesmo padrão de event_id dos demais pontos (pv-, fs-).
          event_id: 'fs-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
          event_time: Math.floor(Date.now() / 1000),
          event_source_url: window.location.href,
          lead_data: { funnel: dados.funnel, material: dados.material || '' },
        }),
      }).catch(function () {
        /* silencioso: sinal de apoio nunca pode atrapalhar quem está preenchendo */
      });
    },
    { once: true }
  );
}
