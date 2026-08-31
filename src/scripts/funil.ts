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

// Etapas já anunciadas neste carregamento. Quem volta da etapa 2 para a 1 e
// avança de novo passa pela mesma etapa duas vezes — e o funil conta sessões,
// não idas e vindas. A dedup definitiva vive na LEITURA (COUNT DISTINCT no
// dashboard); esta aqui só evita engordar a event_log à toa.
const etapasEnviadas = new Set<number>();

/**
 * Dispara `FormStep` quando o visitante CONCLUI uma etapa de um formulário
 * multi-etapas — no avanço, depois de a validação passar, nunca na chegada.
 *
 * A diferença é o que torna o dado acionável: medindo a chegada saberíamos
 * quantos VIRAM a pergunta do faturamento; medindo a conclusão sabemos quantos
 * PASSARAM dela, e a desistência aparece como queda entre duas etapas.
 *
 * A última etapa não deve chamar esta função: concluí-la é enviar o
 * formulário, o que já é o `Lead`.
 */
export function enviarFormStep(etapa: number, dados: { funnel: string } = { funnel: '' }) {
  if (!Number.isFinite(etapa) || etapa < 1) return;
  if (etapasEnviadas.has(etapa)) return;
  etapasEnviadas.add(etapa);

  enviarEventoInterno('FormStep', 'stp-', {
    step: Math.trunc(etapa),
    lead_data: { funnel: dados.funnel || '' },
  });
}

/**
 * Dispara `CTAClick` no primeiro clique do visitante num botão de ação.
 *
 * Ligado UMA vez no BaseLayout, por delegação no `document`: assim toda LP
 * existente e toda LP futura entram no funil sem instrumentação própria —
 * não há o que esquecer de ligar numa página nova.
 *
 * O seletor exclui `[data-checkout]` de propósito. Na LP do workshop esses
 * botões já disparam `InitiateCheckout` (que vai ao Meta, porque ali é
 * conversão de verdade); emitir `CTAClick` no mesmo dedo daria dois eventos
 * para um clique só, e o número de cliques da página passaria a depender de
 * qual dos dois o leitor escolhesse. O dashboard lê o degrau como
 * "`CTAClick` OU `InitiateCheckout`".
 */
export function ativarCtaClick() {
  // Um evento por carregamento de página: o funil conta SESSÕES, não dedos.
  // Quem clica em três botões é uma pessoa só, e gravar os três só engordaria
  // a event_log sem mudar nenhum número na tela.
  let jaDisparou = false;

  document.addEventListener(
    'click',
    (evento) => {
      if (jaDisparou) return;

      const alvo = evento.target as Element | null;
      if (!alvo || typeof alvo.closest !== 'function') return;
      if (!alvo.closest('.btn-cta:not([data-checkout])')) return;

      jaDisparou = true;
      enviarEventoInterno('CTAClick', 'cta-');
    },
    // Captura: o clique costuma navegar, e um handler da página pode chamar
    // stopPropagation antes de o evento chegar ao document na fase de bolha.
    true
  );
}
