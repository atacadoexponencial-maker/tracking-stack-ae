// Propostas do Argo: o que ele sugere e a gestora decide na aba
// (spec-argo-aprovar-propostas.md, issue 310).
//
// Módulo puro, testado por `node --test`: toda a regra de apresentação —
// rótulos, números formatados, "como vamos saber se funcionou", situação de
// cada proposta resolvida — mora aqui. A aba só desenha o que recebe.

// Quantos dias um alvo decidido fica sem nova proposta. Mesmo número do
// `INTERVALO_MIN_DIAS` do argo_estado.py (VPS) até a régua ir para o banco
// (issue 313) — lá ele decide, aqui ele só é mostrado.
export const INTERVALO_MIN_DIAS = 3;

export const DECISOES = Object.freeze({ aprovar: 'aprovada', rejeitar: 'rejeitada' });
export const MAX_POR_QUE = 300;

export const ERRO_VERSAO_NOVA = 'O Argo atualizou esta proposta com números novos enquanto a tela estava aberta. Confira a versão nova e decida de novo.';
export const ERRO_VENCIDA = 'Esta proposta venceu — o Argo reavalia na próxima rodada.';
export const ERRO_NAO_EXISTE = 'Proposta não encontrada.';

const ROTULOS_ACAO = {
  pausar_campanha_trafego: 'Pausar campanha',
  pausar_anuncio: 'Pausar anúncio',
  reduzir_orcamento: 'Reduzir orçamento',
  reativar_anuncio: 'Reativar anúncio',
};

// Orçamento vem do Meta em centavos (issue 317).
const deCentavos = (v) => (Number.isFinite(Number(v)) && v !== null ? reais(Number(v) / 100) : null);

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
  const orc = d.orcamento || {};
  const lista = p.tipo === 'reduzir_orcamento'
    ? [
        { rotulo: 'Orçamento diário', valor: deCentavos(orc.centavos), referencia: deCentavos(orc.novo_centavos) ? `vai para ${deCentavos(orc.novo_centavos)}` : undefined },
        { rotulo: 'Custo por visita', valor: reais(d.cpv), referencia: reais(d.corte_cpv) ? `corte ${reais(d.corte_cpv)}` : undefined },
        { rotulo: 'Gasto 7d', valor: reais(d.gasto_7d) },
      ]
    : p.tipo === 'pausar_campanha_trafego'
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
  if (p.tipo === 'reativar_anuncio') {
    return 'O anúncio deve voltar a aparecer ativo no Gerenciador e voltar a gastar.';
  }
  if (p.tipo === 'reduzir_orcamento') {
    const novo = deCentavos(((p.detalhe || {}).orcamento || {}).novo_centavos);
    return `O orçamento diário deve aparecer em ${novo || 'valor novo'} no Gerenciador, e a campanha continuar no ar.`;
  }
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

// O executor roda a cada 10 min; "executando" há mais que isto é executor que
// parou no meio — a tela manda conferir, em vez de mostrar "executando" para
// sempre.
const EXECUTANDO_TRAVADO_MS = 15 * 60 * 1000;

function dataHora(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).replace(',', ' às');
}

// Situação de um pedido de desfazer (issue 312), que se sobrepõe à da
// execução: depois de pedido, o que importa é se a campanha voltou.
function situacaoDoDesfazer(p, paradaGeral, agora) {
  const frase = p.desfazer_detalhe && p.desfazer_detalhe.frase;
  switch (p.desfazer_estado) {
    case 'conferida':
      return ['desfeita', 'Desfeita', `${frase || 'reativada e conferida no Meta'} — ${dataHora(p.desfazer_em)}`];
    case 'nao_executou':
      return ['desfeita', 'Desfeita', frase || 'já estava ativa quando o Argo foi desfazer'];
    case 'nao_conferida':
      return ['executada_nao_conferida', 'Desfazer não conferido', frase || 'o Meta não confirmou a reativação — confira no Gerenciador'];
    case 'executando':
      return agora - new Date(p.desfazer_em).getTime() > EXECUTANDO_TRAVADO_MS
        ? ['executada_nao_conferida', 'Desfazer não conferido', 'o executor parou no meio — confira no Gerenciador']
        : ['aguardando_execucao', 'Desfazendo agora', 'o Argo está reativando na conta'];
    default:
      return paradaGeral
        ? ['aguardando_execucao', 'Desfazer pedido', 'a parada geral está ligada: nada é executado até ela ser desligada']
        : ['aguardando_execucao', 'Desfazer pedido', 'o Argo reativa em até ~10 min'];
  }
}

// Situação de uma proposta resolvida: [código, rótulo, detalhe].
function situacaoDa(p, paradaGeral, agora) {
  if (p.decisao === 'aprovada' && p.desfazer_pedido_em) return situacaoDoDesfazer(p, paradaGeral, agora);
  if (p.decisao === 'aprovada') {
    const frase = p.execucao_detalhe && p.execucao_detalhe.frase;
    switch (p.execucao_estado) {
      case 'conferida':
        return ['executada_conferida', 'Executada e conferida', `${frase || 'pausada e conferida no Meta'} — ${dataHora(p.execucao_em)}`];
      case 'nao_conferida':
        return ['executada_nao_conferida', 'Executada — não conferida', frase || 'o Meta não confirmou a pausa — confira no Gerenciador'];
      case 'nao_executou':
        return ['nao_executou', 'Aprovada — não executou', frase || 'o Argo não precisou agir'];
      case 'executando':
        return agora - new Date(p.execucao_em).getTime() > EXECUTANDO_TRAVADO_MS
          ? ['executada_nao_conferida', 'Executada — não conferida', 'o executor parou no meio — confira no Gerenciador']
          : ['aguardando_execucao', 'Aprovada — executando agora', 'o Argo está agindo na conta'];
      default:
        return paradaGeral
          ? ['aguardando_execucao', 'Aprovada — aguardando execução', 'a parada geral está ligada: nada é executado até ela ser desligada']
          : ['aguardando_execucao', 'Aprovada — aguardando execução', 'o Argo executa em até ~10 min'];
    }
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

// Estado antes → depois do primeiro alvo tocado, para o detalhe da tela.
function execucaoDa(p) {
  const objetos = p.execucao_detalhe && Array.isArray(p.execucao_detalhe.objetos) ? p.execucao_detalhe.objetos : [];
  if (!objetos.length) return null;
  const conferencia = { conferida: 'conferido', nao_conferida: 'não confirmado', nao_executou: 'sem ação' }[p.execucao_estado] || null;
  // Na redução, antes e depois são orçamentos em centavos, não status.
  const fmt = p.tipo === 'reduzir_orcamento' ? (v) => deCentavos(v) : (v) => v || null;
  return { antes: fmt(objetos[0].antes) || null, depois: fmt(objetos[0].depois) || null, conferencia };
}

export function montarPropostas({ pendentes = [], historico = [], parada_geral = false, agora = Date.now() } = {}) {
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
      const [situacao, rotulo, detalhe] = situacaoDa(p, parada_geral, agora);
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
        execucao: execucaoDa(p),
        desfeita: p.desfazer_pedido_em ? { por: p.desfazer_pedido_por || 'painel', em: p.desfazer_pedido_em } : null,
        // Só o que o Argo pausou E conferiu, e ainda não pedido: desfazer
        // uma pausa que não aconteceu não tem para onde voltar.
        // Desfazer existe para PAUSA (issue 312); redução de orçamento se
        // desfaz subindo o orçamento no Gerenciador.
        pode_desfazer: p.decisao === 'aprovada' && p.execucao_estado === 'conferida' && !p.desfazer_pedido_em
          && String(p.tipo || '').startsWith('pausar'),
      };
    }),
  };
}

export const ERRO_DESFAZER_INVALIDO = 'Só dá para desfazer uma pausa que o Argo executou e conferiu, e uma vez só.';

// Corpo do POST: {id, versao, decisao: 'aprovar'|'rejeitar', por_que?}
// ou {id, decisao: 'desfazer'} — o desfazer não depende de versão: vale para
// a pausa que já aconteceu.
export function validarDecisao(corpo) {
  const erros = [];
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    return { ok: false, erros: ['Corpo inválido.'] };
  }
  const id = Number(corpo.id);
  if (!Number.isInteger(id) || id <= 0) erros.push('Proposta inválida.');
  if (corpo.decisao === 'desfazer') {
    return erros.length ? { ok: false, erros } : { ok: true, valores: { id, decisao: 'desfazer' } };
  }
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
