// Novos leads do CRM (ClickUp) para GET /api/feedback-marketing
// (spec-feedback-marketing.md, módulo 2, tipo "Lead do formulário + MQL").
//
// UMA leitura do CRM por consulta: os cards CRIADOS no período, pelos filtros
// de data da própria API (nunca a lista inteira), compartilhada por todos os
// blocos e pelo "sem funil". Só leitura — nada é escrito no ClickUp.
//
// As regras de leitura de campo e de card estrutural são porte fiel do
// relatório atual (/root/ae_weekly_comparative_report.py, na VPS), para o
// número não mudar por critério no dia da troca. A diferença intencional é a
// atribuição: opção fora do cadastro vai para "sem funil" (decisão 6).
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

import { CU_FIELD, CU_DEFAULT_LIST, clickupFetch } from './_clickup.js';
import { canalDeLead } from './_canal.js';
import { lerOpcoesCrmGravadas } from './_funis-relatorio.js';
import { clausulasBotIpSql } from '../_bots.js';

export const AVISO_CRM_INDISPONIVEL = 'Não foi possível ler o CRM — leads e MQLs não informados.';

// O Worker recusa passar de 50 subrequests ("Too many subrequests" já derrubou
// outro sync). 30 páginas = 3.000 cards, com folga para as demais chamadas da
// consulta. Medido em 15/09/2026: ~150 cards em 30 dias → 92 dias ≈ 5 páginas.
export const TETO_PAGINAS_CRM = 30;
const CARDS_POR_PAGINA = 100;
export const AVISO_CRM_TETO = `O CRM tem mais de ${TETO_PAGINAS_CRM * CARDS_POR_PAGINA} cards criados no período — leads e MQLs não informados; divida o período em consultas menores.`;

export const ROTULO_SEM_OPCAO = 'sem opção de funil no CRM';

export const CAMPO_UTM_SOURCE = { id: CU_FIELD.utmSource, nomes: ['utm_source'] };

// Cards de organização da lista, não leads (mesmos padrões do relatório atual).
const ESTRUTURAIS = [/^FUNIL\b/i, /^GERAL\b/i, /^LEADS\s+M[ÊE]S\s+ANTERIOR\b/i];

// Sem acento, minúsculo, espaços colapsados (normalize_text do relatório atual).
export function normalizarTexto(valor) {
  return String(valor == null ? '' : valor)
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Valor legível de um custom field do card (parse_custom_field_value). Dropdown
// guarda `orderindex` (conferido no CRM real) ou `id`; os dois são resolvidos
// pelas opções que vêm no próprio card.
export function valorDoCampo(campo) {
  const valor = campo ? campo.value : null;
  if (valor == null || valor === '' || (Array.isArray(valor) && !valor.length)) return '';
  const opcoes = campo.type_config && Array.isArray(campo.type_config.options) ? campo.type_config.options : [];
  const nomeDaOpcao = (bruto) => {
    const o = opcoes.find((x) => x && (String(x.id) === String(bruto) || String(x.orderindex) === String(bruto)));
    return o ? String(o.name == null ? '' : o.name) : null;
  };
  if (typeof valor === 'string') return nomeDaOpcao(valor) || valor;
  if (typeof valor === 'number') return nomeDaOpcao(valor) || String(valor);
  if (Array.isArray(valor)) return valor.map((item) => nomeDaOpcao(item) || String(item)).join(', ');
  if (typeof valor === 'object') {
    for (const chave of ['name', 'label', 'text', 'value']) {
      if (valor[chave] != null && valor[chave] !== '') return String(valor[chave]);
    }
    return JSON.stringify(valor);
  }
  return String(valor);
}

// Primeiro valor não vazio do campo, achado pelo id ou por um dos nomes
// (field_value do relatório atual).
export function lerCampo(card, { id = null, nomes = [] } = {}) {
  for (const campo of (card && card.custom_fields) || []) {
    if (!campo) continue;
    if ((id && campo.id === id) || nomes.includes(campo.name)) {
      const valor = valorDoCampo(campo);
      if (valor) return valor;
    }
  }
  return '';
}

export function cardEstrutural(nome) {
  const texto = String(nome == null ? '' : nome).trim();
  if (!texto) return true;
  return ESTRUTURAIS.some((re) => re.test(texto));
}

// Opção do "🔻 Funil" do card, sempre pelo ID do campo: a lista tem também um
// campo de texto "🔻 FUNIL", que não é este. { id, nome } ou null.
export function opcaoFunilDoCard(card) {
  const campo = ((card && card.custom_fields) || []).find((c) => c && c.id === CU_FIELD.funil);
  if (!campo || campo.value == null || campo.value === '') return null;
  const opcoes = campo.type_config && Array.isArray(campo.type_config.options) ? campo.type_config.options : [];
  const o = opcoes.find((x) => x && (String(x.id) === String(campo.value) || String(x.orderindex) === String(campo.value)));
  return o ? { id: String(o.id), nome: String(o.name == null ? '' : o.name).trim() } : null;
}

// Mesma regra de canal do CPL por canal: só utm_source reconhecido como anúncio.
// Card sem utm_source não é tráfego pago.
export function ehTrafegoPago(utmSource) {
  return canalDeLead({ utm_source: utmSource }) === 'meta-ads';
}

function origemCabe(origemLead, trafegoPago) {
  if (origemLead === 'trafego_pago') return trafegoPago;
  if (origemLead === 'exceto_trafego_pago') return !trafegoPago;
  return origemLead === 'qualquer';
}

// Distribui os cards entre os blocos do tipo lead e o "sem funil".
// `cards` = tasks do ClickUp; `funisAtivos` = linhas ativas de funis_relatorio
// (com `opcoes_crm` em JSON e `origem_lead`); `limites` = { desde, ate } em unix
// segundos ([desde, ate)); `taskIdsExcluidos` = cards de teste/bot;
// `funisDeVenda` = linhas venda_greenn de QUALQUER situação (só `opcoes_crm`).
// Devolve { blocos: Map(id do funil lead_mql → cards[]), sem_funil: [{ opcao, cards }] }.
export function atribuirCards({ cards = [], funisAtivos = [], limites, taskIdsExcluidos = [], funisDeVenda = [] }) {
  const excluidos = new Set((taskIdsExcluidos || []).map(String));
  const funis = (funisAtivos || []).map((f) => ({
    ...f,
    idsOpcoes: new Set(lerOpcoesCrmGravadas(f.opcoes_crm).map((o) => o.id)),
  }));
  const opcoesDeVenda = new Set((funisDeVenda || []).flatMap((f) => lerOpcoesCrmGravadas(f.opcoes_crm).map((o) => o.id)));
  const blocos = new Map(funis.filter((f) => f.tipo === 'lead_mql').map((f) => [f.id, []]));
  const semFunil = new Map();
  const vistos = new Set();
  const inicioMs = limites.desde * 1000;
  const fimMs = limites.ate * 1000;

  for (const card of cards || []) {
    if (!card || card.id == null) continue;
    const id = String(card.id);
    // Card criado durante a paginação pode aparecer em duas páginas.
    if (vistos.has(id)) continue;
    vistos.add(id);

    // Lead que voltou tem card antigo: fora do período, não é novo lead.
    const criado = Number(card.date_created);
    if (!Number.isFinite(criado) || criado < inicioMs || criado >= fimMs) continue;
    if (cardEstrutural(card.name)) continue;
    if (excluidos.has(id)) continue;

    const opcao = opcaoFunilDoCard(card);
    const donos = opcao ? funis.filter((f) => f.idsOpcoes.has(opcao.id)) : [];
    // Comprador (venda na Greenn) nunca é lead; opção de funil Manual é contada
    // pela equipe — nenhum dos dois entra em bloco nem em "sem funil".
    if (donos.some((f) => f.tipo === 'venda_greenn' || f.tipo === 'manual')) continue;
    // Opção que é ou FOI de funil de venda (arquivado) segue sendo de comprador:
    // não vira "sem funil". Se hoje um funil ativo a usa, o ativo vence.
    if (opcao && !donos.length && opcoesDeVenda.has(opcao.id)) continue;

    let rotulo;
    if (!opcao) {
      rotulo = ROTULO_SEM_OPCAO;
    } else if (!donos.length) {
      rotulo = opcao.nome;
    } else {
      const pago = ehTrafegoPago(lerCampo(card, CAMPO_UTM_SOURCE));
      const cabem = donos.filter((f) => origemCabe(f.origem_lead, pago));
      if (cabem.length === 1) {
        blocos.get(cabem[0].id).push(card);
        continue;
      }
      // Mais de um nunca é resolvido pelo "primeiro que casou" (o cadastro já
      // impede origens sobrepostas; aqui é só a garantia).
      rotulo = cabem.length ? `opção ${opcao.nome} em mais de um funil` : `opção ${opcao.nome} com origem não cadastrada`;
    }
    if (!semFunil.has(rotulo)) semFunil.set(rotulo, []);
    semFunil.get(rotulo).push(card);
  }

  return {
    blocos,
    sem_funil: [...semFunil]
      .map(([opcao, lista]) => ({ opcao, cards: lista }))
      .sort((a, b) => b.cards.length - a.cards.length || a.opcao.localeCompare(b.opcao)),
  };
}

// "A opção <x> do bloco <nome> não existe mais no CRM." para cada opção
// cadastrada que sumiu. `opcoesCrm` null (CRM não respondeu) → nenhum aviso:
// sem ler o CRM não dá para afirmar que a opção sumiu.
export function avisosOpcoesInexistentes(funisAtivos, opcoesCrm) {
  if (!Array.isArray(opcoesCrm)) return [];
  const existentes = new Set(opcoesCrm.map((o) => String(o.id)));
  const avisos = [];
  for (const f of funisAtivos || []) {
    for (const o of lerOpcoesCrmGravadas(f.opcoes_crm)) {
      if (!existentes.has(o.id)) avisos.push(`A opção ${o.nome} do bloco ${f.nome} não existe mais no CRM.`);
    }
  }
  return avisos;
}

// Cards criados em [desde, ate) (unix segundos, limites de Brasília), página a
// página até `last_page`. { ok: true, cards } ou { ok: false, aviso }. Nunca
// lança: CRM fora do ar não derruba o relatório — leads vêm vazios, não zero.
export async function lerCardsCriadosNoPeriodo(env, { desde, ate }, { tetoPaginas = TETO_PAGINAS_CRM } = {}) {
  if (!env || !env.CLICKUP_API_TOKEN) return { ok: false, aviso: AVISO_CRM_INDISPONIVEL };
  const listId = env.CLICKUP_LIST_ID || CU_DEFAULT_LIST;
  const cards = [];
  try {
    for (let page = 0; page < tetoPaginas; page++) {
      const qs = new URLSearchParams({
        include_closed: 'true',
        subtasks: 'false',
        page: String(page),
        // A API compara estritamente (maior/menor que), em milissegundos.
        date_created_gt: String(desde * 1000 - 1),
        date_created_lt: String(ate * 1000),
      });
      const res = await clickupFetch(`/list/${listId}/task?${qs}`, { method: 'GET' }, env);
      if (!res.ok) throw new Error(`ClickUp tasks ${res.status}`);
      const data = await res.json();
      const lote = data && Array.isArray(data.tasks) ? data.tasks : null;
      if (!lote) throw new Error('resposta sem tasks');
      cards.push(...lote);
      const ultima = typeof data.last_page === 'boolean' ? data.last_page : lote.length < CARDS_POR_PAGINA;
      if (ultima) return { ok: true, cards };
    }
    console.error(`CRM — leitura dos cards passou do teto de ${tetoPaginas} páginas`);
    return { ok: false, aviso: AVISO_CRM_TETO };
  } catch (e) {
    console.error('CRM — leitura dos cards do período falhou:', e.message);
    return { ok: false, aviso: AVISO_CRM_INDISPONIVEL };
  }
}

// Cards de teste ou de bot pelo mesmo critério da aba de leads: o card está em
// lead_dispatch ligado a evento com is_junk = 1, is_bot = 1 ou vindo de IP de
// bot (clausulasBotIpSql, como em leads.js). Uma consulta só, com os ids num
// único bind JSON (sem estourar o limite de parâmetros do D1), por
// idx_lead_dispatch_task, idx_event_log_event_id e a chave de sessions.
//
// clausulasBotIpSql EXCLUI bots ("AND ip <> ... AND ip NOT LIKE ..."); aqui é
// preciso SELECIONAR os bots, então o bloco inteiro vai negado: NOT (1 = 1 AND
// ...). Negar é seguro porque cada cláusula usa COALESCE(ip, '') e nunca dá
// NULL — sem sessão (LEFT JOIN vazio) vira '' e o card não é tido como bot.
export async function lerTaskIdsDeTesteOuBot(db, taskIds) {
  const ids = [...new Set((taskIds || []).filter((id) => id != null && id !== '').map(String))];
  if (!ids.length) return [];
  const { results } = await db.prepare(`
    SELECT DISTINCT d.task_id
    FROM lead_dispatch d
    JOIN event_log e ON e.event_id = d.event_id
    LEFT JOIN sessions s ON s.session_id = e.session_id
    WHERE d.task_id IN (SELECT value FROM json_each(?))
      AND (e.is_junk = 1 OR e.is_bot = 1 OR NOT (1 = 1
        ${clausulasBotIpSql('s')}
      ))
  `).bind(JSON.stringify(ids)).all();
  return (results || []).map((r) => String(r.task_id));
}
