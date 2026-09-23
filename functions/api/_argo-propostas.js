// Propostas do Argo: o que ele sugere e a gestora decide na aba
// (spec-argo-aprovar-propostas.md, issue 301).
//
// Módulo puro, testado por `node --test`: toda a regra de apresentação —
// rótulos, números formatados, "como vamos saber se funcionou", situação de
// cada proposta resolvida — mora aqui. A aba só desenha o que recebe.

// Quantos dias um alvo decidido fica sem nova proposta. Mesmo número do
// `INTERVALO_MIN_DIAS` do argo_estado.py (VPS) até a régua ir para o banco
// (issue 304) — lá ele decide, aqui ele só é mostrado.
export const INTERVALO_MIN_DIAS = 3;

export const DECISOES = Object.freeze({ aprovar: 'aprovada', rejeitar: 'rejeitada' });
export const MAX_POR_QUE = 300;

export const ERRO_VERSAO_NOVA = 'O Argo atualizou esta proposta com números novos enquanto a tela estava aberta. Confira a versão nova e decida de novo.';
export const ERRO_VENCIDA = 'Esta proposta venceu — o Argo reavalia na próxima rodada.';
export const ERRO_NAO_EXISTE = 'Proposta não encontrada.';

const ROTULOS_ACAO = {
  pausar_campanha_trafego: 'Pausar campanha',
  pausar_anuncio: 'Pausar anúncio',
};

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const INT = new Intl.NumberFormat('pt-BR');
const reais = (v) => (typeof v === 'number' && Number.isFinite(v) ? BRL.format(v) : null);
const inteiro = (v) => (typeof v === 'number' && Number.isFinite(v) ? INT.format(v) : null);

function dataCurta(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
}

function quantosAnuncios(p) {
  const ids = p.detalhe && Array.isArray(p.detalhe.ad_ids) ? p.detalhe.ad_ids : null;
  return p.tipo === 'pausar_anuncio' && ids ? ids.length : null;
}

// Os números que sustentam o motivo. Número ausente some da lista em vez de
// virar "R$ 0,00": ausência não é zero.
function numerosDa(p) {
  const d = p.detalhe || {};
  const lista = p.tipo === 'pausar_campanha_trafego'
    ? [
        { rotulo: 'Gasto 7d', valor: reais(d.gasto_7d) },
        { rotulo: 'Custo por visita', valor: reais(d.cpv), referencia: reais(d.corte_cpv) ? `corte ${reais(d.corte_cpv)}` : undefined },
        { rotulo: 'Visitas 7d', valor: inteiro(d.visitas_7d) },
      ]
    : [
        { rotulo: 'Gasto', valor: reais(d.gasto) },
        { rotulo: 'Leads maduros', valor: inteiro(d.leads_maduros) },
        { rotulo: 'Qualificados', valor: inteiro(d.qualificados) },
      ];
  return lista.filter((n) => n.valor !== null).map((n) => (n.referencia ? n : { rotulo: n.rotulo, valor: n.valor }));
}

function verificacaoDa(p) {
  if (p.tipo === 'pausar_campanha_trafego') {
    return 'A campanha deve aparecer pausada no Gerenciador e o gasto dela parar.';
  }
  const n = quantosAnuncios(p);
  return n > 1
    ? `Os ${n} anúncios com este nome devem aparecer pausados e o gasto deles parar.`
    : 'O anúncio deve aparecer pausado e o gasto dele parar.';
}

function base(p) {
  return {
    id: String(p.id),
    versao: p.versao,
    acao: p.tipo,
    acao_rotulo: ROTULOS_ACAO[p.tipo] || p.tipo,
    alvo_nome: p.alvo_nome || p.alvo_id,
    qtd_anuncios: quantosAnuncios(p),
    motivo: p.motivo,
    numeros: numerosDa(p),
  };
}

// Situação de uma proposta resolvida. A execução (issue 302) acrescenta os
// estados "executada"; até lá, aprovada é "aguardando execução".
function situacaoDa(p) {
  if (p.decisao === 'aprovada') {
    return ['aguardando_execucao', 'Aprovada — aguardando execução', 'o Argo executa em até ~10 min'];
  }
  if (p.decisao === 'rejeitada') {
    const volta = new Date(new Date(p.decidida_em).getTime() + INTERVALO_MIN_DIAS * 86400000);
    return ['rejeitada', 'Rejeitada', `volta a ser avaliada a partir de ${dataCurta(volta)}`];
  }
  const detalhe = p.decidida_por === 'argo'
    ? 'deixou de ser candidata ou passou da validade sem decisão'
    : p.decidida_por && p.decidida_por.startsWith('migracao')
      ? 'descartada na atualização do Argo (rodada de teste)'
      : 'passou da validade sem decisão';
  return ['vencida', 'Venceu sem decisão', detalhe];
}

export function montarPropostas({ pendentes = [], historico = [], parada_geral = false } = {}) {
  return {
    parada_geral: Boolean(parada_geral),
    pendentes: pendentes.map((p) => ({
      ...base(p),
      verificacao: verificacaoDa(p),
      criada_em: p.atualizada_em || p.criada_em,
      vence_em: p.vence_em,
      vezes_proposta: p.versao,
      primeira_vez_em: p.criada_em,
    })),
    historico: historico.map((p) => {
      const [situacao, rotulo, detalhe] = situacaoDa(p);
      return {
        ...base(p),
        criada_em: p.criada_em,
        situacao,
        situacao_rotulo: rotulo,
        situacao_detalhe: detalhe,
        // Quem decidiu. A vencida pelo Argo não foi "decidida" por ninguém.
        decidida_por: p.decisao === 'vencida' ? null : p.decidida_por,
        decidida_em: p.decidida_em,
        por_que: p.por_que || null,
        execucao: null,
        desfeita: null,
        pode_desfazer: false,
      };
    }),
  };
}

// Corpo do POST: {id, versao, decisao: 'aprovar'|'rejeitar', por_que?}.
export function validarDecisao(corpo) {
  const erros = [];
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    return { ok: false, erros: ['Corpo inválido.'] };
  }
  const id = Number(corpo.id);
  if (!Number.isInteger(id) || id <= 0) erros.push('Proposta inválida.');
  const versao = Number(corpo.versao);
  if (!Number.isInteger(versao) || versao <= 0) erros.push('Versão da proposta ausente — recarregue a aba.');
  const decisao = DECISOES[corpo.decisao];
  if (!decisao) erros.push('Decisão desconhecida.');
  let porQue = null;
  if (corpo.por_que !== undefined && corpo.por_que !== null) {
    if (typeof corpo.por_que !== 'string') erros.push('O "por quê" precisa ser texto.');
    else {
      porQue = corpo.por_que.trim() || null;
      if (porQue && porQue.length > MAX_POR_QUE) erros.push(`O "por quê" pode ter até ${MAX_POR_QUE} caracteres.`);
    }
  }
  if (decisao === 'aprovada') porQue = null;
  return erros.length ? { ok: false, erros } : { ok: true, valores: { id, versao, decisao, por_que: porQue } };
}

// Por que a gravação não aconteceu, lido da linha atual. Mensagem específica
// para cada caso: "já decidida", "versão nova" e "venceu" pedem reações
// diferentes da gestora.
export function motivoDaRecusa(linha, versaoVista, agora = new Date()) {
  if (!linha) return { status: 404, erro: ERRO_NAO_EXISTE };
  if (linha.decisao) {
    if (linha.decisao === 'vencida') return { status: 409, erro: ERRO_VENCIDA };
    const quem = linha.decidida_por || 'alguém';
    const quando = new Date(linha.decidida_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return { status: 409, erro: `Esta proposta já foi ${linha.decisao} por ${quem} em ${quando}.` };
  }
  if (new Date(linha.vence_em) <= agora) return { status: 409, erro: ERRO_VENCIDA };
  if (Number(linha.versao) !== Number(versaoVista)) return { status: 409, erro: ERRO_VERSAO_NOVA };
  return { status: 409, erro: 'A proposta mudou enquanto a tela estava aberta — recarregue e decida de novo.' };
}
