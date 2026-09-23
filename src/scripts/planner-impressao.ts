// Montagem da folha impressa do planner (issue 304).
//
// O problema que este arquivo resolve: na tela, cada valor vive dentro de um
// `<input>`. Mandar isso para o papel entrega caixas com borda e texto miúdo —
// a cara de formulário fotocopiado que reprovou a primeira versão.
//
// A folha quer o inverso da tela: a RESPOSTA em corpo grande e escuro, o
// RÓTULO pequeno e claro, como legenda. Então, antes de imprimir, este script
// escreve cada resposta como texto ao lado do controle, e o `@media print`
// troca quem aparece.
//
// Por que inserir os elementos aqui em vez de já deixá-los na marcação: assim
// os sete componentes de bloco não carregam marcação duplicada, e um campo
// novo entra na folha sozinho, sem ninguém precisar lembrar. O custo é que a
// folha depende de JavaScript — aceitável, porque imprimir já é um ato
// deliberado num navegador moderno.

import { formatarResposta, listaPorExtenso } from './planner-formato.js';

const CLASSE_RESPOSTA = 'pl-resposta';
const CLASSE_SEM_RESPOSTA = 'pl-sem-resposta';

// Texto visível de um rótulo, sem o que for só de tela.
function textoDoRotulo(controle: HTMLInputElement): string {
  const label = controle.closest('label');
  if (label) return (label.textContent || '').trim();

  const porId = controle.id
    ? document.querySelector<HTMLLabelElement>(`label[for="${controle.id}"]`)
    : null;
  return (porId?.textContent || '').trim();
}

// Cria (ou reaproveita) o elemento onde a resposta impressa aparece, logo
// depois do controle. Reaproveitar importa: imprimir duas vezes não pode
// empilhar duas respostas.
function elementoDeResposta(depoisDe: Element, chave: string): HTMLElement {
  const existente = depoisDe.parentElement?.querySelector<HTMLElement>(
    `[data-resposta-de="${chave}"]`,
  );
  if (existente) return existente;

  const novo = document.createElement('p');
  novo.className = CLASSE_RESPOSTA;
  novo.dataset.respostaDe = chave;
  depoisDe.insertAdjacentElement('afterend', novo);
  return novo;
}

function escrever(alvo: HTMLElement, texto: string): void {
  const limpo = texto.trim();
  alvo.textContent = limpo || '—';
  alvo.classList.toggle(CLASSE_SEM_RESPOSTA, limpo === '');
}

// Campos de uma resposta só: texto, número, dinheiro, percentual, data.
function montarCamposSimples(raiz: ParentNode): void {
  const controles = raiz.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input[name]:not([type="radio"]):not([type="checkbox"]), textarea[name]',
  );

  for (const controle of controles) {
    const campo = controle.closest<HTMLElement>('[data-campo]');
    const tipo = campo?.dataset.tipo || 'texto';
    escrever(
      elementoDeResposta(controle, controle.name),
      formatarResposta(tipo, controle.value),
    );
  }
}

// Escolha única: narrativa dos dois picos, Black VIP. Sai o texto da opção
// marcada, não o valor interno.
function montarEscolhas(raiz: ParentNode): void {
  const grupos = new Map<string, HTMLInputElement[]>();

  for (const radio of raiz.querySelectorAll<HTMLInputElement>('input[type="radio"][name]')) {
    const lista = grupos.get(radio.name) || [];
    lista.push(radio);
    grupos.set(radio.name, lista);
  }

  for (const [nome, radios] of grupos) {
    const marcado = radios.find((radio) => radio.checked);
    const ancora = radios[0].closest('label') || radios[0];
    const destino = ancora.parentElement;
    if (!destino) continue;

    let alvo = destino.querySelector<HTMLElement>(`[data-resposta-de="${nome}"]`);
    if (!alvo) {
      alvo = document.createElement('p');
      alvo.className = CLASSE_RESPOSTA;
      alvo.dataset.respostaDe = nome;
      destino.append(alvo);
    }
    escrever(alvo, marcado ? textoDoRotulo(marcado) : '');
  }
}

// Marcação múltipla: itens da oferta. As marcadas viram uma frase; nenhuma
// marcada não vira linha em branco.
function montarMarcacoes(raiz: ParentNode): void {
  const grupos = new Map<string, HTMLInputElement[]>();

  for (const caixa of raiz.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name]')) {
    // Os canais têm tratamento próprio: lá a marcação some a linha inteira.
    if (caixa.name.startsWith('canal_')) continue;
    const lista = grupos.get(caixa.name) || [];
    lista.push(caixa);
    grupos.set(caixa.name, lista);
  }

  for (const [nome, caixas] of grupos) {
    const marcadas = caixas.filter((caixa) => caixa.checked).map(textoDoRotulo);
    const ancora = caixas[0].closest('label') || caixas[0];
    const destino = ancora.parentElement;
    if (!destino) continue;

    let alvo = destino.querySelector<HTMLElement>(`[data-resposta-de="${nome}"]`);
    if (!alvo) {
      alvo = document.createElement('p');
      alvo.className = CLASSE_RESPOSTA;
      alvo.dataset.respostaDe = nome;
      destino.append(alvo);
    }
    escrever(alvo, listaPorExtenso(marcadas));
  }
}

// Canal desmarcado não aparece na folha: a tabela da parede mostra só quem
// tem dono. `data-fora-da-folha` é o que o CSS de impressão esconde.
function montarCanais(raiz: ParentNode): void {
  for (const linha of raiz.querySelectorAll<HTMLTableRowElement>('[data-canal]')) {
    const usar = linha.querySelector<HTMLInputElement>('input[type="checkbox"]');
    linha.toggleAttribute('data-fora-da-folha', !usar?.checked);
  }
}

// Black VIP respondida com "não" sai inteira da folha — dia e local incluídos.
function montarCondicionais(raiz: ParentNode): void {
  for (const regiao of raiz.querySelectorAll<HTMLElement>('[data-condicional]')) {
    const nome = regiao.dataset.condicional;
    if (!nome) continue;
    const marcado = raiz.querySelector<HTMLInputElement>(`input[name="${nome}"]:checked`);
    regiao.toggleAttribute('data-fora-da-folha', marcado?.value === 'nao');
  }
}

// A capa nomeia a marca, a campanha e a data. Sem nome de marca, a capa
// continua saindo — só não afirma de quem é.
function montarCapa(raiz: ParentNode): void {
  const capa = document.getElementById('planner-capa');
  if (!capa) return;

  const valorDe = (nome: string) =>
    (raiz.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${nome}"]`)?.value || '').trim();

  const marca = valorDe('marca');
  const campanha = valorDe('nomeCampanha');
  const data = formatarResposta('data', valorDe('dataHoje'));

  const escreverEm = (seletor: string, texto: string) => {
    const alvo = capa.querySelector<HTMLElement>(seletor);
    if (!alvo) return;
    alvo.textContent = texto;
    alvo.toggleAttribute('data-fora-da-folha', texto === '');
  };

  escreverEm('[data-capa="marca"]', marca);
  escreverEm('[data-capa="campanha"]', campanha);
  escreverEm('[data-capa="data"]', data ? `Montado em ${data}` : '');
}

// Monta a folha inteira. Roda a cada impressão, e não uma vez só: o que foi
// preenchido depois da primeira impressão precisa sair na segunda.
export function montarFolha(): void {
  const raiz = document.querySelector<HTMLElement>('.pl-pagina');
  if (!raiz) return;

  montarCamposSimples(raiz);
  montarEscolhas(raiz);
  montarMarcacoes(raiz);
  montarCanais(raiz);
  montarCondicionais(raiz);
  montarCapa(raiz);
}

export function prepararImpressao(): void {
  // `beforeprint` cobre quem imprime pelo menu ou pelo Ctrl+P, sem passar
  // pelo botão da página.
  window.addEventListener('beforeprint', montarFolha);

  const botao = document.querySelector<HTMLButtonElement>('[data-saida="imprimir"]');
  botao?.addEventListener('click', () => {
    montarFolha();
    window.print();
  });
}
