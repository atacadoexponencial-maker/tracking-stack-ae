// Rastreamento de botão de compra em página de vendas.
//
// Mesma lógica da /workshop-black-exponencial-2026 (issue 188), tirada para um
// módulo para a /imersao-planejamento-atacado não copiar 140 linhas. A página
// da Black continua com a própria cópia: o evento dela já passou e mexer ali
// agora só traria risco.
//
// O que faz, nesta ordem:
//   1. obtém/cria o identificador de compra (`trk`) da visita;
//   2. grava em `checkout_sessions` (POST /checkout-session) já no carregamento,
//      para o webhook da plataforma ter o que consultar depois;
//   3. no clique em qualquer `[data-checkout]`, dispara `InitiateCheckout`
//      (beacon + pixel com o MESMO event_id) e navega para o destino com o
//      `trk` anexado no parâmetro publicado em `data-checkout-param`.
//
// REGRA QUE MANDA EM TUDO: a compra vem antes do rastreamento. Nenhuma falha
// aqui pode impedir a ida ao checkout. Os `href` continuam intactos: sem JS a
// página segue navegável, só perde o `trk`.
//
// Botão cujo `href` começa com `#` (checkout ainda não configurado, rola até o
// preço) é ignorado: nada de evento nem de `trk` para um destino que não é
// checkout.

export function ligarCheckout(wrapper: HTMLElement) {
  try {
    let trkMemoria: string | null = null;

    const novoId = () => {
      try {
        return crypto.randomUUID();
      } catch (e) {
        return Date.now() + '-' + Math.random().toString(16).slice(2);
      }
    };

    const obterTrk = () => {
      try {
        const salvo = sessionStorage.getItem('krob_trk');
        if (salvo) return salvo;
      } catch (e) {
        /* storage indisponível */
      }
      if (trkMemoria) return trkMemoria;
      const gerado = novoId();
      trkMemoria = gerado;
      try {
        sessionStorage.setItem('krob_trk', gerado);
      } catch (e) {
        /* fica só em memória */
      }
      return gerado;
    };

    const trk = obterTrk();
    const params = new URLSearchParams(location.search);

    fetch('/checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trk,
        utm_source: params.get('utm_source') || '',
        utm_medium: params.get('utm_medium') || '',
        utm_campaign: params.get('utm_campaign') || '',
        utm_content: params.get('utm_content') || '',
        utm_term: params.get('utm_term') || '',
        event_source_url: location.href,
      }),
    }).catch(() => {
      /* falha muda: vender importa mais que rastrear */
    });

    let jaDisparou = false;

    document.addEventListener('click', (evento) => {
      const alvo = evento.target as Element | null;
      const botao = alvo && alvo.closest ? alvo.closest('[data-checkout]') : null;
      if (!botao) return;

      if (wrapper.dataset.vendas === 'encerradas') return;

      const base = botao.getAttribute('href');
      if (!base || base.startsWith('#')) return;

      const nomeParam = wrapper.dataset.checkoutParam || 'trk';
      const separador = base.includes('?') ? '&' : '?';
      const destino = base + separador + nomeParam + '=' + encodeURIComponent(trk);

      evento.preventDefault();

      if (!jaDisparou) {
        jaDisparou = true;
        const eventId = novoId();
        try {
          navigator.sendBeacon(
            '/tracker',
            new Blob(
              [
                JSON.stringify({
                  event_name: 'InitiateCheckout',
                  event_id: eventId,
                  event_time: Math.floor(Date.now() / 1000),
                  event_source_url: location.href,
                  user_data: {},
                }),
              ],
              { type: 'application/json' },
            ),
          );
        } catch (e) {
          /* sem beacon o evento se perde, a venda não */
        }
        try {
          (window as any).fbq('track', 'InitiateCheckout', {}, { eventID: eventId });
        } catch (e) {
          /* pixel ausente ou bloqueado */
        }
      }

      // 80ms para a fila do beacon esvaziar antes de a aba sair.
      setTimeout(() => {
        window.location.href = destino;
      }, 80);
    });
  } catch (e) {
    console.error('[checkout] rastreamento indisponível', e);
  }
}
