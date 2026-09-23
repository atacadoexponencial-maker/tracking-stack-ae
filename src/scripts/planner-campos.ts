// Os campos que respondem ao que a pessoa digita (issues 300, 301, 302, 303).
//
// A marcação dos blocos nasceu inerte, com ganchos (`data-marca`,
// `data-espelho`, `data-alvo`, `data-condicional`, `#planner-salvo`,
// `#planner-tema`). Este arquivo liga todos eles:
//
// - 301: o nome da marca nas narrativas, o pedido mínimo espelhado no bloco 2
//   e a soma da base no painel do bloco 1;
// - 302: narrativa própria desmarca a escolhida, Black VIP condicional,
//   dinheiro formatado, texto longo que cresce, data de hoje;
// - 300: rascunho gravado sozinho no navegador;
// - 303: troca de tema.
//
// As contas em si são puras e moram em `planner-contas.js`.

import { BLOCO_1, BLOCO_2, LACUNA_MARCA } from '../data/planner-black.js';
import { dinheiroPorExtenso } from './planner-formato.js';
import { somaDaBase, fraseDaBase, textoDoMinimo } from './planner-contas.js';

const CHAVE_RASCUNHO = 'planner-black:rascunho';
const CHAVE_TEMA = 'planner-black:tema';

type Controle = HTMLInputElement | HTMLTextAreaElement;

function controles(raiz: ParentNode): Controle[] {
  return Array.from(raiz.querySelectorAll<Controle>('input[name], textarea[name]'));
}

function valorDe(nome: string): string {
  return document.querySelector<Controle>(`[name="${nome}"]:not([type="radio"])`)?.value ?? '';
}

function marcadoEm(nome: string): string {
  return document.querySelector<HTMLInputElement>(`input[name="${nome}"]:checked`)?.value ?? '';
}

// ---------------------------------------------------------------------------
// Armazenamento: modo privado ou gravação bloqueada fazem o acesso lançar erro.
// O planner continua funcionando; só não guarda.
// ---------------------------------------------------------------------------
function ler(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: string): boolean {
  try {
    window.localStorage.setItem(chave, valor);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// 301 — contas e amarrados entre blocos
// ---------------------------------------------------------------------------
function atualizarMarca(): void {
  const nome = valorDe('marca').trim();
  for (const alvo of document.querySelectorAll<HTMLElement>('[data-marca]')) {
    alvo.textContent = nome || LACUNA_MARCA;
  }
}

function atualizarEspelhos(): void {
  const unidade = marcadoEm('pedidoMinimoUnidade');
  for (const alvo of document.querySelectorAll<HTMLElement>('[data-espelho]')) {
    const origem = alvo.dataset.espelho;
    if (!origem) continue;
    alvo.textContent = textoDoMinimo(valorDe(origem), unidade) || '—';
  }
}

function atualizarBase(): void {
  const painel = BLOCO_1.painelBase;
  const total = somaDaBase(painel.formula.map(valorDe));

  const numero = document.querySelector<HTMLElement>('[data-alvo="base-total"]');
  const frase = document.querySelector<HTMLElement>('[data-alvo="base-frase"]');
  if (numero) numero.textContent = total === null ? '—' : Math.round(total).toLocaleString('pt-BR');
  if (frase) frase.textContent = fraseDaBase(painel.frase, total, valorDe('ativosHoje'));
}

// ---------------------------------------------------------------------------
// 302 — campos que reagem
// ---------------------------------------------------------------------------

// Escrever a narrativa própria desmarca a sugerida daquele pico.
function ligarNarrativaPropria(): void {
  for (const pico of BLOCO_2.picos) {
    const propria = document.querySelector<Controle>(`[name="${pico.narrativa.propria.chave}"]`);
    propria?.addEventListener('input', () => {
      if (propria.value.trim() === '') return;
      for (const radio of document.querySelectorAll<HTMLInputElement>(`input[name="${pico.narrativa.chave}"]`)) {
        radio.checked = false;
      }
    });
  }
}

// Responder "não" tira dia e local da VIP da tela; "sim" traz de volta, com a
// data sugerida posta se o campo tiver ficado vazio.
function atualizarCondicionais(): void {
  for (const regiao of document.querySelectorAll<HTMLElement>('[data-condicional]')) {
    const nome = regiao.dataset.condicional;
    if (!nome) continue;
    const resposta = marcadoEm(nome);
    regiao.hidden = resposta === 'nao';

    if (resposta === 'sim') {
      const vip = BLOCO_2.picos.find((pico) => pico.vip?.chave === nome)?.vip;
      for (const campo of vip?.detalhes ?? []) {
        const controle = document.querySelector<Controle>(`[name="${campo.chave}"]`);
        if (controle && campo.sugerida && controle.value === '') controle.value = campo.sugerida;
      }
    }
  }
}

// Dinheiro aparece como R$ 12.500,00 depois de digitado.
function ligarDinheiro(): void {
  for (const campo of document.querySelectorAll<HTMLElement>('[data-campo][data-tipo="dinheiro"]')) {
    const controle = campo.querySelector<HTMLInputElement>('input');
    if (!controle) continue;
    const formatar = () => {
      const formatado = dinheiroPorExtenso(controle.value);
      if (formatado) controle.value = formatado;
    };
    controle.addEventListener('blur', formatar);
    formatar();
  }
}

// Texto longo cresce com o conteúdo, sem barra de rolagem interna.
function crescer(caixa: HTMLTextAreaElement): void {
  caixa.style.height = 'auto';
  caixa.style.height = `${caixa.scrollHeight}px`;
}

function ligarTextosLongos(): void {
  for (const caixa of document.querySelectorAll<HTMLTextAreaElement>('textarea')) {
    caixa.style.overflow = 'hidden';
    caixa.style.resize = 'none';
    caixa.addEventListener('input', () => crescer(caixa));
    crescer(caixa);
  }
}

// A data de hoje depende do dia em que a pessoa abre: o site é estático e a
// data do build não serve. Dia local, não UTC.
function preencherHoje(): void {
  const agora = new Date();
  const hoje = [
    agora.getFullYear(),
    String(agora.getMonth() + 1).padStart(2, '0'),
    String(agora.getDate()).padStart(2, '0'),
  ].join('-');
  for (const campo of document.querySelectorAll<HTMLInputElement>('input[data-hoje]')) {
    if (campo.value === '') campo.value = hoje;
  }
}

// ---------------------------------------------------------------------------
// 300 — rascunho no navegador
// ---------------------------------------------------------------------------
type Rascunho = Record<string, string | string[]>;

function coletar(): Rascunho {
  const rascunho: Rascunho = {};
  for (const controle of controles(document)) {
    const { name } = controle;
    if (controle instanceof HTMLInputElement && controle.type === 'radio') {
      if (controle.checked) rascunho[name] = controle.value;
    } else if (controle instanceof HTMLInputElement && controle.type === 'checkbox') {
      const lista = (rascunho[name] as string[] | undefined) ?? [];
      // Caixa sem `value` (canais) vale "on"; o que importa é estar marcada.
      if (controle.checked) lista.push(controle.value);
      rascunho[name] = lista;
    } else {
      rascunho[name] = controle.value;
    }
  }
  return rascunho;
}

function restaurar(): void {
  const cru = ler(CHAVE_RASCUNHO);
  if (!cru) return;

  let rascunho: Rascunho;
  try {
    rascunho = JSON.parse(cru);
  } catch {
    return;
  }

  for (const controle of controles(document)) {
    if (!(controle.name in rascunho)) continue;
    const salvo = rascunho[controle.name];
    if (controle instanceof HTMLInputElement && controle.type === 'radio') {
      controle.checked = salvo === controle.value;
    } else if (controle instanceof HTMLInputElement && controle.type === 'checkbox') {
      controle.checked = Array.isArray(salvo) && salvo.includes(controle.value);
    } else if (typeof salvo === 'string') {
      controle.value = salvo;
    }
  }
}

function ligarSalvamento(): () => void {
  const indicador = document.getElementById('planner-salvo');
  let espera: number | undefined;

  const salvar = () => {
    const ok = gravar(CHAVE_RASCUNHO, JSON.stringify(coletar()));
    if (indicador) {
      indicador.textContent = ok
        ? 'Salvo agora há pouco'
        : 'Este navegador não deixa guardar o rascunho. Salve em PDF antes de fechar.';
    }
  };

  return () => {
    window.clearTimeout(espera);
    espera = window.setTimeout(salvar, 500);
  };
}

// ---------------------------------------------------------------------------
// 303 — tema
// ---------------------------------------------------------------------------
function aplicarTema(tema: string, botao: HTMLButtonElement | null): void {
  document.documentElement.dataset.tema = tema;
  if (!botao) return;
  const claro = tema === 'claro';
  botao.textContent = claro ? 'Tema escuro' : 'Tema claro';
  botao.setAttribute('aria-pressed', claro ? 'true' : 'false');
}

function ligarTema(): void {
  const botao = document.querySelector<HTMLButtonElement>('#planner-tema');
  aplicarTema(ler(CHAVE_TEMA) === 'claro' ? 'claro' : 'escuro', botao);
  botao?.addEventListener('click', () => {
    const novo = document.documentElement.dataset.tema === 'claro' ? 'escuro' : 'claro';
    aplicarTema(novo, botao);
    gravar(CHAVE_TEMA, novo);
  });
}

// ---------------------------------------------------------------------------

function recalcular(): void {
  atualizarMarca();
  atualizarEspelhos();
  atualizarBase();
  atualizarCondicionais();
}

export function ativarCamposDoPlanner(): void {
  const raiz = document.querySelector<HTMLElement>('.pl-pagina');
  if (!raiz) return;

  ligarTema();
  restaurar();
  preencherHoje();

  ligarNarrativaPropria();
  ligarDinheiro();
  ligarTextosLongos();

  const agendarSalvamento = ligarSalvamento();

  // Um ouvinte só na página: qualquer campo novo entra nas contas e no
  // rascunho sem ninguém precisar lembrar.
  const aoMudar = () => {
    recalcular();
    agendarSalvamento();
  };
  raiz.addEventListener('input', aoMudar);
  raiz.addEventListener('change', aoMudar);

  recalcular();

  // Textos restaurados precisam crescer depois que o bloco aparece; bloco
  // escondido tem altura zero e o cálculo acima sai errado.
  for (const aba of document.querySelectorAll<HTMLElement>('[data-aba], [data-avancar-para]')) {
    aba.addEventListener('click', () => {
      for (const caixa of document.querySelectorAll<HTMLTextAreaElement>('textarea')) crescer(caixa);
    });
  }
}
