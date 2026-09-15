// Validação do cadastro de funis do relatório de marketing
// (spec-feedback-marketing.md, módulo 1).
//
// Módulo PURO: recebe o que o formulário mandou e as linhas já lidas de
// `funis_relatorio`, e devolve o valor limpo para gravar ou a mensagem de
// recusa pronta. Sem `env.DB`, sem `fetch` — o endpoint só faz I/O e a tela só
// exibe a mensagem do servidor.
//
// Convenção de todas as funções: `{ valor }` quando passou, `{ erro }` quando
// foi recusado. `outros` = as DEMAIS linhas do cadastro (na edição, a própria
// linha fica de fora para não conflitar consigo mesma).

import { TIPOS, ORIGENS, lerOpcoesCrmGravadas } from './_funis-relatorio.js';
import { CANAL_AQUISICAO } from './_canal.js';

export const NOME_MAX = 40;

// Quais campos do formulário valem em cada tipo de medição. Fonte ÚNICA: a
// validação descarta o que não se aplica e a tela esconde o mesmo campo lendo
// esta tabela pelo servidor, sem repetir a regra no front.
//   - funil do tracking não existe no venda_greenn (decisão 9 da spec);
//   - origem do lead só existe no lead_mql.
export const CAMPOS_POR_TIPO = {
  lead_mql: { funil_tracking: true, origem_lead: true },
  manual: { funil_tracking: true, origem_lead: false },
  venda_greenn: { funil_tracking: false, origem_lead: false },
};

export function campoAplica(tipo, campo) {
  return !!(CAMPOS_POR_TIPO[tipo] && CAMPOS_POR_TIPO[tipo][campo]);
}

// Nome do bloco do que não casou com nenhum funil: um funil com esse nome
// deixaria o relatório com dois blocos "sem funil" indistinguíveis.
const NOME_RESERVADO = 'sem funil';

// Sem caixa, sem acento e com espaços internos colapsados: "AQUISIÇÃO" e
// "aquisicao" são o mesmo bloco para quem lê a mensagem no Slack.
export function normalizarNome(v) {
  return (v == null ? '' : String(v))
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// `contraArquivados: false` na reativação: lá a spec revalida só contra os
// ativos (a regra "reative em vez de criar" não faz sentido para quem já está
// reativando).
export function validarNome(nome, outros = [], { contraArquivados = true } = {}) {
  const valor = (nome == null ? '' : String(nome)).trim();
  if (!valor) return { erro: 'Informe o nome no relatório.' };
  // Caracteres, não unidades UTF-16: acento e emoji contam como um.
  if ([...valor].length > NOME_MAX) return { erro: `Nome no relatório deve ter até ${NOME_MAX} caracteres.` };

  const chave = normalizarNome(valor);
  // "sem-funil" é o slug do balde em _funil-campanha.js; hífen e sublinhado
  // contam como espaço só aqui, para nenhuma grafia escapar da reserva.
  if (chave.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() === NOME_RESERVADO) {
    return { erro: 'Esse nome é reservado para o bloco do que não foi classificado.' };
  }

  const mesmos = (outros || []).filter((l) => normalizarNome(l.nome) === chave);
  if (mesmos.some((l) => l.situacao === 'ativo')) return { erro: 'Já existe um funil com esse nome.' };
  if (contraArquivados && mesmos.length) {
    return { erro: 'Existe um funil arquivado com esse nome — reative-o em vez de criar outro.' };
  }
  return { valor };
}

// Tipo obrigatório; a origem só é exigida (e só é guardada) no lead_mql. Nos
// outros tipos o valor que veio é descartado, não recusado: o campo some da
// tela e não pode barrar a gravação.
export function validarTipoEOrigem({ tipo, origem_lead } = {}) {
  const t = (tipo == null ? '' : String(tipo)).trim();
  if (!Object.hasOwn(TIPOS, t)) return { erro: 'Escolha o tipo de medição.' };

  if (!campoAplica(t, 'origem_lead')) return { valor: { tipo: t, origem_lead: null } };

  const o = (origem_lead == null ? '' : String(origem_lead)).trim();
  if (!Object.hasOwn(ORIGENS, o)) return { erro: 'Escolha a origem do lead.' };
  return { valor: { tipo: t, origem_lead: o } };
}

// Funil do tracking: só nos tipos em que se aplica. Um mesmo funil do tracking
// em dois blocos ativos faria o mesmo investimento contar duas vezes.
//
// `funisConhecidos` = listarFunisConhecidos(env.DB); `aquisicao` entra aqui,
// como em /api/campaign-funnel. Com null, a existência não é conferida — a
// reativação só revalida unicidade.
export function validarFunilTracking(tipo, funilTracking, outros = [], { funisConhecidos = null } = {}) {
  if (!campoAplica(tipo, 'funil_tracking')) return { valor: null };

  const valor = (funilTracking == null ? '' : String(funilTracking)).trim();
  if (!valor) return { erro: 'Escolha o funil do tracking.' };

  if (Array.isArray(funisConhecidos) && !new Set([...funisConhecidos, CANAL_AQUISICAO]).has(valor)) {
    return { erro: 'Funil do tracking desconhecido.' };
  }

  const dono = (outros || []).find((l) => l.situacao === 'ativo' && l.funil_tracking && l.funil_tracking === valor);
  if (dono) return { erro: `Esse funil do tracking já pertence ao bloco ${dono.nome}.` };
  return { valor };
}

// Duas origens pegam o mesmo card? Só "Tráfego pago" × "Qualquer origem exceto
// tráfego pago" é disjunto; "Qualquer origem" cobre as outras duas.
export function origensSobrepoem(a, b) {
  return a === b || a === 'qualquer' || b === 'qualquer';
}

// Opções do campo "🔻 Funil" do CRM. Um mesmo card não pode contar em dois
// blocos: a mesma opção só convive em dois funis ativos se os dois forem
// lead_mql com origens disjuntas (decisão 5 da spec — SE e AQUISIÇÃO). Manual e
// venda na Greenn não têm origem, então ocupam a opção inteira.
//
// `opcoes` = ids marcados (ou objetos { id }). `opcoesCrm` = opções atuais do
// CRM; o nome gravado é o do CRM, não o que a tela mandou. Com null (reativação)
// a existência não é conferida e o nome que veio é mantido.
export function validarOpcoesCrm({ tipo, origem_lead } = {}, opcoes, outros = [], { opcoesCrm = null } = {}) {
  const vistos = new Set();
  const escolhidas = [];
  for (const o of Array.isArray(opcoes) ? opcoes : []) {
    const objeto = o && typeof o === 'object';
    const id = String((objeto ? o.id : o) ?? '').trim();
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    escolhidas.push({ id, nome: objeto && o.nome != null ? String(o.nome) : '' });
  }
  if (!escolhidas.length) return { erro: 'Escolha ao menos uma opção do campo Funil do CRM.' };

  let valor = escolhidas;
  if (Array.isArray(opcoesCrm)) {
    const doCrm = new Map(opcoesCrm.map((o) => [String(o.id), o.nome]));
    if (escolhidas.some((o) => !doCrm.has(o.id))) return { erro: 'Essa opção não existe no CRM.' };
    valor = escolhidas.map((o) => ({ id: o.id, nome: doCrm.get(o.id) }));
  }

  for (const opcao of valor) {
    const dono = (outros || []).find((l) => l.situacao === 'ativo'
      && lerOpcoesCrmGravadas(l.opcoes_crm).some((x) => x.id === opcao.id)
      && (tipo !== 'lead_mql' || l.tipo !== 'lead_mql' || origensSobrepoem(origem_lead, l.origem_lead)));
    if (dono) return { erro: `A opção ${opcao.nome} com essa origem já pertence ao bloco ${dono.nome}.` };
  }
  return { valor };
}

export const TRECHO_MIN = 4;

// Trecho do nome da campanha (opcional). Curto demais capturaria campanhas de
// outros funis; contido no trecho de outro bloco ativo faria a mesma campanha
// casar com os dois. Sem caixa, como o reconhecimento na campanha
// (`campanhaDoProduto` em _greenn-metricas.js).
export function validarTrecho(trecho, outros = []) {
  const valor = (trecho == null ? '' : String(trecho)).trim();
  if (!valor) return { valor: null };
  if ([...valor.replace(/\s+/g, '')].length < TRECHO_MIN) {
    return { erro: `O trecho precisa ter ao menos ${TRECHO_MIN} caracteres.` };
  }

  const meu = valor.toLowerCase();
  const dono = (outros || []).find((l) => {
    const dele = l.situacao === 'ativo' && l.trecho_campanha ? String(l.trecho_campanha).trim().toLowerCase() : '';
    return dele && (dele.includes(meu) || meu.includes(dele));
  });
  if (dono) return { erro: `Esse trecho se sobrepõe ao do bloco ${dono.nome}.` };
  return { valor };
}

// Só um funil ativo de venda na Greenn (decisão 7 da spec): as vendas da Greenn
// não são separadas por produto, então dois blocos contariam a mesma venda.
export function validarVendaGreennUnica(tipo, outros = []) {
  if (tipo !== 'venda_greenn') return { valor: tipo };
  const dono = (outros || []).find((l) => l.situacao === 'ativo' && l.tipo === 'venda_greenn');
  if (dono) {
    return { erro: `Já existe um funil de venda na Greenn (${dono.nome}). Hoje as vendas da Greenn não são separadas por produto.` };
  }
  return { valor: tipo };
}

// Funil inteiro, na ordem do formulário: nome → tipo e origem → funil do
// tracking → opções do CRM → trecho → venda na Greenn única. Devolve a primeira
// recusa ou a linha limpa para gravar (campos que não se aplicam ao tipo já
// descartados como null; `opcoes_crm` como lista { id, nome } do CRM).
export function validarFunil(corpo = {}, { outros = [], funisConhecidos = null, opcoesCrm = null } = {}) {
  const entrada = corpo || {};
  const nome = validarNome(entrada.nome, outros);
  if (nome.erro) return nome;

  const tipoOrigem = validarTipoEOrigem(entrada);
  if (tipoOrigem.erro) return tipoOrigem;
  const { tipo, origem_lead } = tipoOrigem.valor;

  const funil = validarFunilTracking(tipo, entrada.funil_tracking, outros, { funisConhecidos });
  if (funil.erro) return funil;

  const opcoes = validarOpcoesCrm({ tipo, origem_lead }, entrada.opcoes_crm, outros, { opcoesCrm });
  if (opcoes.erro) return opcoes;

  const trecho = validarTrecho(entrada.trecho_campanha, outros);
  if (trecho.erro) return trecho;

  const venda = validarVendaGreennUnica(tipo, outros);
  if (venda.erro) return venda;

  return {
    valor: {
      nome: nome.valor,
      tipo,
      funil_tracking: funil.valor,
      opcoes_crm: opcoes.valor,
      origem_lead,
      trecho_campanha: trecho.valor,
    },
  };
}

export const NOTA_MANUAL = 'O relatório vai trazer só o investimento deste funil; leads e custo aparecem como contagem manual.';
export const AVISO_VENDA_SEM_TRECHO = "Sem trecho, as campanhas deste produto podem cair em 'sem funil'.";

// O que o formulário mostra em cada tipo, pronto para a tela só aplicar: quais
// campos existem (a MESMA tabela que a validação usa para descartar) e os
// textos de nota. `aviso_sem_trecho` aparece enquanto o trecho estiver vazio.
export function formularioPorTipo() {
  return Object.fromEntries(Object.keys(TIPOS).map((tipo) => [tipo, {
    rotulo: TIPOS[tipo],
    funil_tracking: campoAplica(tipo, 'funil_tracking'),
    origem_lead: campoAplica(tipo, 'origem_lead'),
    nota: tipo === 'manual' ? NOTA_MANUAL : null,
    aviso_sem_trecho: tipo === 'venda_greenn' ? AVISO_VENDA_SEM_TRECHO : null,
  }]));
}

export const CONFIRMACAO_EDICAO = 'Esta mudança também altera os números de relatórios passados, se forem consultados de novo.';

// A edição mexe no que decide os números (tipo, funil do tracking, opções do
// CRM, origem, trecho)? O endpoint aceita qualquer período passado, então todo
// funil gravado já pode ter aparecido num relatório. Só o nome não muda número.
// `atual` = linha gravada; `novo` = valor devolvido por validarFunil.
export function precisaConfirmarEdicao(atual, novo) {
  const texto = (v) => (v == null ? '' : String(v));
  const ids = (lista) => [...new Set(lista.map((o) => o.id))].sort().join('|');
  return texto(atual.tipo) !== texto(novo.tipo)
    || texto(atual.funil_tracking) !== texto(novo.funil_tracking)
    || texto(atual.origem_lead) !== texto(novo.origem_lead)
    // Sem caixa: o reconhecimento na campanha também não diferencia.
    || texto(atual.trecho_campanha).toLowerCase() !== texto(novo.trecho_campanha).toLowerCase()
    || ids(lerOpcoesCrmGravadas(atual.opcoes_crm)) !== ids(novo.opcoes_crm || []);
}

// Reativar: as mesmas regras de unicidade da criação, com os valores GRAVADOS
// do funil e só contra os ativos. Não confere se o funil do tracking ou a
// opção ainda existem — a spec revalida só unicidade; opção sumida continua
// marcada na lista e avisada no relatório.
export function validarReativacao(linha, outros = []) {
  const ativos = (outros || []).filter((l) => l.situacao === 'ativo');
  const checagens = [
    () => validarNome(linha.nome, ativos, { contraArquivados: false }),
    () => validarFunilTracking(linha.tipo, linha.funil_tracking, ativos),
    () => validarOpcoesCrm(
      { tipo: linha.tipo, origem_lead: linha.origem_lead },
      lerOpcoesCrmGravadas(linha.opcoes_crm),
      ativos,
    ),
    () => validarTrecho(linha.trecho_campanha, ativos),
    () => validarVendaGreennUnica(linha.tipo, ativos),
  ];
  for (const checar of checagens) {
    const r = checar();
    if (r.erro) return r;
  }
  return { valor: true };
}
