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
 *
 * O envio em si mora em src/scripts/funil.ts, compartilhado com o `CTAClick` e
 * o `FormStep` — este módulo continua com uma responsabilidade só: decidir
 * QUANDO o primeiro toque aconteceu.
 */
import { enviarEventoInterno } from './funil';

export function ativarFormStart(elemento: HTMLElement, dados: { funnel: string; material?: string }) {
  if (!elemento) return;

  // `once` porque o interesse é no PRIMEIRO toque: o listener se remove
  // sozinho depois de disparar, sem estado para controlar.
  elemento.addEventListener(
    'input',
    () => {
      enviarEventoInterno('FormStart', 'fs-', {
        lead_data: { funnel: dados.funnel, material: dados.material || '' },
      });
    },
    { once: true }
  );
}
