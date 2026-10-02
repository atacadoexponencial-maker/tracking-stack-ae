// Regras da agenda própria (spec-agenda-propria.md), sem D1 e sem Google:
// funções puras, testadas em tests/agenda-regras.test.js. As rotas só leem,
// chamam estas funções e gravam.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

import { ymdBrt, inicioDoDiaBrt } from './_data-brt.js';

export const SITUACOES = ['marcada', 'remarcada', 'cancelada', 'realizada', 'faltou', 'sem_info'];
// Reunião que ainda vai acontecer (ou aconteceu sem leitura de presença ainda).
export const SITUACOES_ATIVAS = ['marcada', 'remarcada'];

// google_user_id da equipe interna: quem entra na sala e NÃO conta como lead
// presente. Mesma lista de scripts/workshop-sync/team.py (VPS) — se alguém
// entrar ou sair da equipe, mudar nos dois lugares.
export const EQUIPE_GOOGLE = new Set([
  'users/103248863365309849873', // Marcelle
  'users/111082220125504877803', // Day Maciel
  'users/102068618279730112556', // Felipe Santos
  'users/104184629372232050312', // Bárbara
]);

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const minutos = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// ---------------------------------------------------------------------------
// Grades
// ---------------------------------------------------------------------------

function validarFaixas(lista, onde) {
  if (!Array.isArray(lista)) return `${onde}: formato inválido.`;
  const ordenadas = [];
  for (const f of lista) {
    if (!Array.isArray(f) || f.length !== 2 || !HHMM.test(f[0]) || !HHMM.test(f[1])) {
      return `${onde}: use horários no formato HH:MM.`;
    }
    if (minutos(f[0]) >= minutos(f[1])) return `${onde}: o fim (${f[1]}) precisa ser depois do início (${f[0]}).`;
    ordenadas.push([minutos(f[0]), minutos(f[1])]);
  }
  ordenadas.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < ordenadas.length; i++) {
    if (ordenadas[i][0] < ordenadas[i - 1][1]) return `${onde}: há faixas sobrepostas.`;
  }
  return null;
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Valida e normaliza uma grade. Devolve { erro } ou { grade }. */
export function validarGrade(entrada) {
  const nome = String(entrada?.nome || '').trim();
  if (!nome) return { erro: 'Dê um nome à grade.' };
  if (nome.length > 80) return { erro: 'Nome da grade muito longo (máx. 80).' };
  const faixas = {};
  for (const [dia, lista] of Object.entries(entrada?.faixas || {})) {
    if (!/^[0-6]$/.test(dia)) return { erro: 'Dia da semana inválido.' };
    const erro = validarFaixas(lista, DIAS[dia]);
    if (erro) return { erro };
    if (lista.length) faixas[dia] = [...lista].sort((a, b) => minutos(a[0]) - minutos(b[0]));
  }
  const datas = {};
  for (const [ymd, lista] of Object.entries(entrada?.datas || {})) {
    if (!YMD.test(ymd)) return { erro: `Data inválida: ${ymd}.` };
    const erro = validarFaixas(lista, ymd.split('-').reverse().join('/'));
    if (erro) return { erro };
    datas[ymd] = [...lista].sort((a, b) => minutos(a[0]) - minutos(b[0]));
  }
  return { grade: { nome, faixas, datas } };
}

/** "seg 14:00–21:00 · ter a qui 09:30–12:00, 13:00–21:00" */
export function resumoGrade(faixas) {
  const abrev = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const porDia = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ d, txt: (faixas[d] || []).map((f) => `${f[0]}–${f[1]}`).join(', ') }));
  const grupos = [];
  for (const x of porDia) {
    if (!x.txt) continue;
    const ult = grupos[grupos.length - 1];
    const vizinho = ult && ult.txt === x.txt && ((ult.fim + 1) % 7 === x.d);
    if (vizinho) ult.fim = x.d; else grupos.push({ ini: x.d, fim: x.d, txt: x.txt });
  }
  if (!grupos.length) return 'sem horários';
  return grupos.map((g) => `${abrev[g.ini]}${g.fim !== g.ini ? ' a ' + abrev[g.fim] : ''} ${g.txt}`).join(' · ');
}

// ---------------------------------------------------------------------------
// Tipos de reunião
// ---------------------------------------------------------------------------

const inteiro = (v, min, max) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/**
 * Valida e normaliza um tipo de reunião. `contexto` traz o que o banco sabe:
 * { calendarios: Set(ids), grades: Set(ids), funis: Set(nomes) }.
 */
export function validarTipo(entrada, contexto) {
  const e = entrada || {};
  const nome = String(e.nome || '').trim();
  if (!nome) return { erro: 'Dê um nome ao tipo de reunião.' };
  const slug = String(e.slug || '').trim().toLowerCase();
  if (!SLUG.test(slug) || slug.length > 60) {
    return { erro: 'Endereço do link: use só letras minúsculas, números e hífen (ex.: consultoria-individual).' };
  }
  const duracao = inteiro(e.duracao_min, 5, 480);
  if (duracao === null) return { erro: 'Duração: entre 5 e 480 minutos.' };
  if (!contexto.calendarios.has(e.destino_cal)) return { erro: 'Escolha a agenda de destino entre as agendas conectadas.' };
  const conflitos = Array.isArray(e.conflito_cals) ? [...new Set(e.conflito_cals)] : [];
  for (const c of conflitos) if (!contexto.calendarios.has(c)) return { erro: 'Uma agenda de conflito não está mais conectada.' };
  const gradeId = Number(e.grade_id);
  if (!contexto.grades.has(gradeId)) return { erro: 'Escolha uma grade de disponibilidade.' };
  const folgaAntes = inteiro(e.folga_antes_min ?? 0, 0, 240);
  const folgaDepois = inteiro(e.folga_depois_min ?? 0, 0, 240);
  if (folgaAntes === null || folgaDepois === null) return { erro: 'Folga: entre 0 e 240 minutos.' };
  const antecedencia = inteiro(e.antecedencia_min ?? 0, 0, 60 * 24 * 30);
  if (antecedencia === null) return { erro: 'Antecedência mínima inválida.' };
  const janela = inteiro(e.janela_dias, 1, 365);
  if (janela === null) return { erro: 'Até quantos dias no futuro: entre 1 e 365.' };
  const limite = e.limite_dia === '' || e.limite_dia == null ? null : inteiro(e.limite_dia, 1, 100);
  if (e.limite_dia !== '' && e.limite_dia != null && limite === null) return { erro: 'Limite por dia: entre 1 e 100 (ou vazio).' };
  const intervalo = inteiro(e.intervalo_min, 5, 240);
  if (intervalo === null) return { erro: 'Os horários começam a cada: entre 5 e 240 minutos.' };

  const perguntas = [];
  for (const p of Array.isArray(e.perguntas) ? e.perguntas : []) {
    const texto = String(p?.texto || '').trim();
    if (!texto) return { erro: 'Pergunta extra sem texto.' };
    const tipo = p.tipo === 'escolha' ? 'escolha' : 'texto';
    const opcoes = tipo === 'escolha' ? (p.opcoes || []).map((o) => String(o).trim()).filter(Boolean) : [];
    if (tipo === 'escolha' && opcoes.length < 2) return { erro: `A pergunta "${texto}" precisa de pelo menos 2 opções.` };
    perguntas.push({ texto, tipo, opcoes, obrigatoria: !!p.obrigatoria });
  }

  const comercial = e.comercial === false || e.comercial === 0 || e.comercial === '0' ? 0 : 1;
  const funil = comercial ? String(e.funil || '').trim() : null;
  if (comercial && !funil) return { erro: 'Reunião comercial precisa de um funil.' };
  if (comercial && contexto.funis && !contexto.funis.has(funil)) return { erro: `Funil desconhecido: ${funil}.` };
  const paginaPos = String(e.pagina_pos || '').trim();
  if (paginaPos && !/^\/[\w\-/]*$/.test(paginaPos)) return { erro: 'Página depois de confirmar: use um caminho do site, ex.: /obrigada.' };
  const titulo = String(e.titulo_modelo || '').trim() || '{nome} e Atacado Exponencial';

  return {
    tipo: {
      nome, slug, duracao_min: duracao, destino_cal: e.destino_cal,
      conflito_cals_json: JSON.stringify(conflitos),
      grade_id: gradeId, folga_antes_min: folgaAntes, folga_depois_min: folgaDepois,
      antecedencia_min: antecedencia, janela_dias: janela, limite_dia: limite, intervalo_min: intervalo,
      perguntas_json: JSON.stringify(perguntas), titulo_modelo: titulo.slice(0, 200),
      comercial, funil, pagina_pos: paginaPos || null,
      contato_alternativo: String(e.contato_alternativo || '').trim().slice(0, 200) || null,
    },
  };
}

/** Linha do D1 → objeto de tipo usado pelas rotas e pela tela. */
export function tipoDaLinha(l) {
  if (!l) return null;
  return {
    ...l,
    conflito_cals: JSON.parse(l.conflito_cals_json || '[]'),
    perguntas: JSON.parse(l.perguntas_json || '[]'),
    comercial: !!l.comercial,
    ativo: !!l.ativo,
  };
}

// ---------------------------------------------------------------------------
// Horários livres
// ---------------------------------------------------------------------------

/** Dia da semana (0 = domingo) de 'YYYY-MM-DD'. */
function diaDaSemana(ymd) {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}

function somarDias(ymd, n) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Horários livres de um tipo. Tudo em unix (segundos).
 *   tipo: { duracao_min, intervalo_min, folga_antes_min, folga_depois_min,
 *           antecedencia_min, janela_dias, limite_dia }
 *   grade: { faixas, datas }
 *   ocupados: [{ ini, fim }] — das agendas de conflito
 *   reunioesNoDia: { 'YYYY-MM-DD': n } — reuniões ativas DESTE tipo por dia
 *   de / ate: recorte pedido (dias de Brasília 'YYYY-MM-DD', inclusivos)
 *   ignorar: { ini, fim } — o próprio horário de quem está remarcando
 * Devolve { 'YYYY-MM-DD': [inicioUnix, ...] } só com dias que têm horário.
 */
export function horariosLivres({ tipo, grade, ocupados = [], reunioesNoDia = {}, agora, de, ate, ignorar = null }) {
  const hoje = ymdBrt(agora);
  const ultimoDia = somarDias(hoje, tipo.janela_dias);
  const primeiro = de && de > hoje ? de : hoje;
  const ultimo = ate && ate < ultimoDia ? ate : ultimoDia;
  const minimo = agora + tipo.antecedencia_min * 60;
  const dur = tipo.duracao_min * 60;
  const passo = tipo.intervalo_min * 60;
  const antes = (tipo.folga_antes_min || 0) * 60;
  const depois = (tipo.folga_depois_min || 0) * 60;
  const bloqueios = ignorar
    ? ocupados.filter((o) => !(o.ini === ignorar.ini && o.fim === ignorar.fim))
    : ocupados;

  const resultado = {};
  for (let ymd = primeiro; ymd <= ultimo; ymd = somarDias(ymd, 1)) {
    if (tipo.limite_dia && (reunioesNoDia[ymd] || 0) >= tipo.limite_dia) continue;
    const faixas = Object.prototype.hasOwnProperty.call(grade.datas || {}, ymd)
      ? grade.datas[ymd]
      : (grade.faixas || {})[diaDaSemana(ymd)] || [];
    const meiaNoite = inicioDoDiaBrt(ymd);
    const dia = [];
    for (const [a, b] of faixas) {
      const iniFaixa = meiaNoite + minutos(a) * 60;
      const fimFaixa = meiaNoite + minutos(b) * 60;
      for (let t = iniFaixa; t + dur <= fimFaixa; t += passo) {
        if (t < minimo) continue;
        const bi = t - antes;
        const bf = t + dur + depois;
        if (bloqueios.some((o) => o.ini < bf && o.fim > bi)) continue;
        dia.push(t);
      }
    }
    if (dia.length) resultado[ymd] = dia;
  }
  return resultado;
}

// ---------------------------------------------------------------------------
// Formulário do agendamento
// ---------------------------------------------------------------------------

/** Valida os dados do lead e as respostas. Devolve { erros: {campo: msg} } ou { dados }. */
export function validarDadosAgendamento(entrada, perguntas, padronizarTelefone) {
  const erros = {};
  const nome = String(entrada?.nome || '').trim();
  const email = String(entrada?.email || '').trim().toLowerCase();
  const telBruto = String(entrada?.telefone || '').trim();
  if (nome.length < 2) erros.nome = 'Informe seu nome.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) erros.email = 'E-mail inválido.';
  const tel = padronizarTelefone(telBruto);
  const telefone = tel && !['impossivel', 'ausente'].includes(tel.situacao) ? tel.digitos : '';
  if (!telefone) erros.telefone = 'WhatsApp inválido. Use DDD + número.';
  const respostas = [];
  (perguntas || []).forEach((p, i) => {
    const valor = String(entrada?.respostas?.[i] ?? '').trim();
    if (p.obrigatoria && !valor) { erros['p' + i] = 'Resposta obrigatória.'; return; }
    if (valor && p.tipo === 'escolha' && !p.opcoes.includes(valor)) { erros['p' + i] = 'Escolha uma das opções.'; return; }
    respostas.push({ pergunta: p.texto, resposta: valor.slice(0, 1000) });
  });
  if (Object.keys(erros).length) return { erros };
  return { dados: { nome: nome.slice(0, 120), email, telefone, respostas } };
}

/** Título do evento a partir do modelo ("{nome} e Atacado Exponencial"). */
export function tituloDoEvento(modelo, nome) {
  return String(modelo || '{nome} e Atacado Exponencial').replace(/\{nome\}/g, nome);
}

// ---------------------------------------------------------------------------
// Presença
// ---------------------------------------------------------------------------

/**
 * Situação depois da leitura do Meet.
 *   participantes: null (o Google não guardou a sala) ou [{ usuario, nome }]
 * Entrou alguém de fora da equipe → realizada. Sala aberta só pela equipe →
 * faltou. Sem registro da sala → sem_info (não marca falta no escuro).
 */
export function situacaoPelaPresenca(participantes) {
  if (participantes == null) return 'sem_info';
  const deFora = participantes.some((p) => !p.usuario || !EQUIPE_GOOGLE.has(p.usuario));
  if (deFora) return 'realizada';
  return 'faltou';
}

/** Mudança em cima da hora: abaixo da antecedência mínima do tipo. */
export function emCimaDaHora(inicio, antecedenciaMin, agora) {
  return inicio - agora < antecedenciaMin * 60;
}

// ---------------------------------------------------------------------------
// Números do período (aba Agendamentos)
// ---------------------------------------------------------------------------

export function numerosDoPeriodo(reunioes) {
  const n = { agendados: reunioes.length, cancelados: 0, faltas: 0, realizadas: 0, sem_info: 0 };
  for (const r of reunioes) {
    if (r.situacao === 'cancelada') n.cancelados++;
    else if (r.situacao === 'faltou') n.faltas++;
    else if (r.situacao === 'realizada') n.realizadas++;
    else if (r.situacao === 'sem_info') n.sem_info++;
  }
  const conhecidas = n.realizadas + n.faltas;
  n.taxa_comparecimento = conhecidas ? n.realizadas / conhecidas : null;
  return n;
}
