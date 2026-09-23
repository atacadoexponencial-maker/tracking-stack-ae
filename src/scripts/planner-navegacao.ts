// Navegação por blocos do planner (issue 298, revisão de 21/09).
//
// Mostra um bloco por vez. A marcação nasce com os quatro blocos VISÍVEIS e a
// barra escondida: assim, sem JavaScript, a pessoa encontra o planner inteiro
// empilhado e preenchível, em vez de uma barra que não clica e três blocos que
// nunca aparecem. Este script inverte isso ao carregar — revela a barra e
// esconde os blocos inativos.
//
// Esconder NUNCA é apagar. Os blocos inativos continuam no documento, com tudo
// o que foi preenchido, e continuam saindo na impressão (issue 304) e no PDF
// (305). É por isso que a troca mexe em `hidden`, e nunca remove nó.

const ABA_ATIVA = 'pl-aba--ativa';

export function ativarNavegacaoDoPlanner(): void {
  const barra = document.getElementById('planner-abas');
  const abas = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-aba]'));
  const blocos = Array.from(document.querySelectorAll<HTMLElement>('[data-bloco]'));

  // Planner incompleto (ou outra página): não faz nada em vez de quebrar.
  if (!barra || abas.length === 0 || blocos.length === 0) return;

  // A partir daqui existe navegação, então a barra pode aparecer.
  barra.hidden = false;

  function irPara(id: string, rolar = true): void {
    for (const bloco of blocos) {
      const ehOAtivo = bloco.id === `bloco-${id}`;
      // `hidden` some da tela mas continua no documento — e o CSS de impressão
      // o traz de volta na folha.
      bloco.hidden = !ehOAtivo;
    }

    for (const aba of abas) {
      const ehADoAtivo = aba.dataset.aba === id;
      aba.classList.toggle(ABA_ATIVA, ehADoAtivo);
      aba.setAttribute('aria-selected', ehADoAtivo ? 'true' : 'false');
    }

    // O rodapé com o fecho e as duas saídas só faz sentido no último bloco:
    // oferecer "sua Black está montada" no bloco 1 seria mentira.
    const rodape = document.querySelector<HTMLElement>('[data-rodape-planner]');
    if (rodape) rodape.hidden = id !== blocos[blocos.length - 1].id.replace('bloco-', '');

    // Trocar de bloco sem voltar ao topo deixaria a pessoa no meio do bloco
    // novo, sem ver o título — parecendo que a página não mudou.
    if (rolar) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  for (const aba of abas) {
    aba.addEventListener('click', () => {
      const id = aba.dataset.aba;
      if (id) irPara(id);
    });
  }

  // Botão "Próximo: <nome>" no fim de cada bloco.
  for (const botao of document.querySelectorAll<HTMLButtonElement>('[data-avancar-para]')) {
    botao.addEventListener('click', () => {
      const id = botao.dataset.avancarPara;
      if (id) irPara(id);
    });
  }

  // Estado inicial: bloco 1, sem rolar (a pessoa acabou de chegar).
  const primeiro = abas[0].dataset.aba;
  if (primeiro) irPara(primeiro, false);
}

// Exposta para a issue 306, que precisa levar a pessoa até o bloco onde faltam
// campos — ela pode estar em outra aba e não ter como saber onde está o buraco.
export function abrirBloco(id: string): void {
  const aba = document.querySelector<HTMLButtonElement>(`[data-aba="${id}"]`);
  aba?.click();
}
