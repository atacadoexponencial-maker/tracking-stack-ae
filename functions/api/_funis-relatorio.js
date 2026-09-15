// Cadastro de funis do relatório de marketing (spec-feedback-marketing.md).
//
// Módulo PURO: recebe as linhas já lidas de `funis_relatorio` (migration 0039)
// e as opções atuais do CRM, e devolve a lista pronta para a aba desenhar. Sem
// `env.DB`, sem `fetch`, sem `Date.now()` — mesmo contrato de _cpl-calculo.js e
// _greenn-metricas.js: o endpoint só faz I/O e o dashboard só desenha.

export const TIPOS = {
  lead_mql: 'Lead do formulário + MQL',
  manual: 'Manual',
  venda_greenn: 'Venda na Greenn',
};

export const ORIGENS = {
  trafego_pago: 'Tráfego pago',
  exceto_trafego_pago: 'Qualquer origem exceto tráfego pago',
  qualquer: 'Qualquer origem',
};

export const AVISO_VAZIO = "Nenhum funil cadastrado — todo o investimento do relatório vai aparecer em 'sem funil'.";

// `opcoes_crm` é JSON gravado pelo servidor; ainda assim, uma linha ilegível
// não pode derrubar a aba inteira — vira lista vazia só naquela linha.
export function lerOpcoesCrmGravadas(texto) {
  try {
    const lista = JSON.parse(texto);
    return Array.isArray(lista)
      ? lista.filter((o) => o && o.id).map((o) => ({ id: String(o.id), nome: String(o.nome == null ? '' : o.nome) }))
      : [];
  } catch {
    return [];
  }
}

// Ativos na ordem do relatório; arquivados ABAIXO deles, do mais recente para o
// mais antigo. `situacao` = 'todos' inclui os arquivados; qualquer outro valor
// é o padrão 'ativos'.
//
// `opcoesCrm` = opções atuais do CRM ([{ id, nome }]) ou null quando o CRM não
// respondeu. Com null, `existe` fica null em todas as opções: sem ler o CRM não
// dá para afirmar que uma opção sumiu de lá.
export function montarListaFunis(linhas, { situacao = 'ativos', opcoesCrm = null } = {}) {
  const todas = linhas || [];
  const ativos = todas
    .filter((l) => l.situacao === 'ativo')
    .sort((a, b) => ordemNula(a.posicao, b.posicao) || a.id - b.id);
  const arquivados = situacao === 'todos'
    ? todas
      .filter((l) => l.situacao !== 'ativo')
      .sort((a, b) => (b.alterado_em || 0) - (a.alterado_em || 0) || a.id - b.id)
    : [];

  const idsCrm = Array.isArray(opcoesCrm) ? new Set(opcoesCrm.map((o) => String(o.id))) : null;

  const rows = [...ativos, ...arquivados].map((l) => ({
    id: l.id,
    posicao: l.situacao === 'ativo' ? l.posicao : null,
    nome: l.nome,
    tipo: l.tipo,
    tipo_rotulo: TIPOS[l.tipo] || l.tipo,
    // NULL no tipo venda_greenn: não se aplica (decisão 9 da spec).
    funil_tracking: l.funil_tracking || null,
    opcoes_crm: lerOpcoesCrmGravadas(l.opcoes_crm)
      .map((o) => ({ ...o, existe: idsCrm ? idsCrm.has(o.id) : null })),
    origem_lead: l.origem_lead || null,
    origem_rotulo: l.origem_lead ? (ORIGENS[l.origem_lead] || l.origem_lead) : null,
    trecho_campanha: l.trecho_campanha || null,
    situacao: l.situacao,
    versao: l.versao,
    alterado_em: l.alterado_em,
  }));

  return {
    rows,
    total_ativos: ativos.length,
    aviso_vazio: ativos.length ? null : AVISO_VAZIO,
  };
}

function ordemNula(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a - b;
}

// Subir/descer: com qual vizinho ATIVO o funil troca de posição. Devolve null
// quando não há o que trocar (primeira linha subindo, última descendo, funil
// arquivado ou inexistente) — nesse caso nada é gravado.
export function trocaDePosicao(linhas, id, direcao) {
  const ativos = (linhas || [])
    .filter((l) => l.situacao === 'ativo')
    .sort((a, b) => ordemNula(a.posicao, b.posicao) || a.id - b.id);
  const i = ativos.findIndex((l) => l.id === id);
  if (i === -1) return null;
  const j = direcao === 'subir' ? i - 1 : direcao === 'descer' ? i + 1 : -1;
  if (j < 0 || j >= ativos.length) return null;
  return {
    a: { id: ativos[i].id, posicao: ativos[i].posicao },
    b: { id: ativos[j].id, posicao: ativos[j].posicao },
  };
}

// Texto que o dashboard mostra antes de arquivar. Montado aqui para a tela não
// escrever regra: quem explica a consequência é o servidor.
export function confirmacaoArquivar(nome) {
  return `O bloco ${nome} sai do relatório. O investimento e os leads dele passam a aparecer em 'sem funil', inclusive se um dia passado for consultado de novo.`;
}
