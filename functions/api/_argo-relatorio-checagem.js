// Checagem da análise escrita do relatório semanal do Argo: os guardrails
// (spec-relatorio-semanal-argo.md, módulo 7; issue 407).
//
// A barreira entre o que a IA escreveu e o que a gestora vê. Não depende de a
// IA obedecer às instruções: confere o resultado contra o pacote de fatos.
// Regras: números, citações, formato, amostra, leitura antecipada, causa sem
// veredito, semana atípica, fonte indisponível e restrição.
// Módulo puro, testado por `node --test`.

export const BLOCOS_TEXTO = [
  ['resumo', 'resumo', 'Resumo da semana'],
  ['leitura_acoes', 'acoes', 'Leitura das ações'],
  ['leitura_testes', 'testes', 'Leitura dos testes'],
  ['pontos_atencao', 'atencao', 'Pontos de atenção'],
];

// Contagens pequenas ("duas ações", "3 testes") não precisam estar nos fatos.
const INTEIRO_LIVRE = 10;

const CONCLUSAO = /\b(melhor(ou|aram)?|pior(ou|aram)?|venc(eu|edor|endo)|ganh(ou|ando|ador)|super(ou|ando)|caiu|caíram|subiu|subiram|cresce(u|ram)|deu certo|funcion(ou|a)|por causa|graças|devido)\b/i;
const VENCEDOR = /\b(venc(eu|edor|endo|e)|ganh(ou|ando|ador|a)|super(ou|ando)|(é|foi|está|ficou) melhor|melhor (que|do que)|lado (melhor|vencedor))\b/i;
const CAUSA = /\b(por causa d|graças a|devido a|em razão d|(é|foi) (o )?(resultado|efeito) d|levou a|provocou|causou|fez (o|a|os|as)\b.*\b(cair|subir|melhorar|piorar)|depois d[aoe]s? (pausa|realoca|redu|aument))/i;
const ACAO = /\b(pausa|pausad|pausar|realoca|redu[zç]|aument|reativ|verba|orçamento|ação|ações)\w*/i;
const DATA = /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g;
// Número solto: dígito colado em letra (ad13, v2, lkl1) é nome, não número.
const NUMERO = /(?<![\p{L}\d_])(R\$\s?)?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?%?(?![\p{L}\d])/gu;

const PARADAS = new Set(['para', 'pelo', 'pela', 'como', 'mais', 'menos', 'sobre', 'entre', 'antes', 'depois', 'quando', 'nosso', 'nossa', 'todo', 'toda', 'outubro', 'setembro', 'novembro', 'campanha', 'conjunto', 'anúncio', 'funil', 'mexer', 'pode', 'deve', 'até']);

function numerosDoTexto(texto) {
  const semDatas = String(texto || '').replace(DATA, ' ');
  return (semDatas.match(NUMERO) || []).map((bruto) => {
    const limpo = bruto.replace(/R\$\s?/, '').replace('%', '').replace(/\./g, '').replace(',', '.');
    const tipo = bruto.includes('%') ? 'pct' : /R\$/.test(bruto) ? 'moeda' : 'simples';
    return { bruto: bruto.trim(), valor: Number(limpo), tipo, inteiro: !/[.,]/.test(bruto.replace(/R\$\s?/, '').replace(/\.\d{3}/g, '')) };
  }).filter((n) => Number.isFinite(n.valor));
}
const datasDoTexto = (texto) => String(texto || '').match(DATA) || [];

/** Números e datas que existem no pacote (valor, nome e período de cada fato). */
export function universoDoPacote(pacote) {
  const numeros = [];
  const datas = new Set();
  for (const id of pacote.ordem) {
    const f = pacote.fatos[id];
    for (const t of [f.valor_texto, f.nome, f.periodo]) {
      for (const n of numerosDoTexto(t)) numeros.push(n);
      for (const d of datasDoTexto(t)) datas.add(d);
    }
  }
  if (pacote.semana && pacote.semana.rotulo) for (const d of datasDoTexto(pacote.semana.rotulo)) datas.add(d);
  return { numeros, datas };
}

function numeroExiste(n, universo) {
  if (n.tipo === 'simples' && n.inteiro && n.valor <= INTEIRO_LIVRE) return true;
  // Tolerância de arredondamento: "21%" para 21,4% e "R$ 33,5" para R$ 33,51
  // passam. Porcentagem só casa com porcentagem e reais só com reais.
  const folga = (b) => Math.max(Math.abs(b) * 0.006, n.inteiro ? 0.5 : 0.01);
  const mesmoTipo = (b) => (n.tipo === 'simples' ? b.tipo !== 'pct' : b.tipo === n.tipo);
  return universo.numeros.some((b) => mesmoTipo(b) && Math.abs(n.valor - b.valor) <= folga(b.valor));
}

function checarFrase(frase, bloco, pacote, universo, violacoes) {
  const v = (regra, motivo) => violacoes.push({ regra, bloco, trecho: String(frase.texto || '').slice(0, 160), motivo });
  const citados = (frase.citacoes || []).map((id) => pacote.fatos[id]);
  const inexistentes = (frase.citacoes || []).filter((id) => !pacote.fatos[id]);
  if (inexistentes.length) v('Citações', `Cita etiqueta que não existe no pacote: ${inexistentes.join(', ')}.`);
  const fatos = citados.filter(Boolean);
  if (frase.tipo !== 'sem_conclusao' && !(frase.citacoes || []).length) v('Citações', 'Afirmação sem nenhuma etiqueta de fato.');
  for (const n of numerosDoTexto(frase.texto)) {
    if (!numeroExiste(n, universo)) v('Números', `O número "${n.bruto}" não existe no pacote de fatos.`);
  }
  for (const d of datasDoTexto(frase.texto)) {
    if (!universo.datas.has(d)) v('Números', `A data "${d}" não existe no pacote de fatos.`);
  }
  const texto = String(frase.texto || '');
  const conclusiva = frase.tipo !== 'sem_conclusao' && CONCLUSAO.test(texto);
  if (conclusiva && fatos.some((f) => f.marcas.includes('amostra_pequena'))) v('Amostra', 'Tira conclusão de um fato marcado como amostra pequena.');
  if (frase.tipo !== 'sem_conclusao' && VENCEDOR.test(texto) && fatos.some((f) => f.marcas.includes('nao_pronto'))) v('Leitura antecipada', 'Declara vencedor ou lado melhor num teste que ainda não está pronto para ler.');
  if (CAUSA.test(texto) && ACAO.test(texto) && !fatos.some((f) => f.grupo === 'Vereditos')) v('Causa sem veredito', 'Atribui um resultado a uma ação sem citar o veredito dela.');
  if (frase.tipo !== 'sem_conclusao' && fatos.some((f) => f.marcas.includes('indisponivel') && f.grupo !== 'Fontes com problema')) v('Fonte indisponível', 'Afirma algo sobre um dado que estava indisponível.');
}

function palavrasChave(texto) {
  return new Set(String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9|]+/).filter((p) => p.length >= 4 && !PARADAS.has(p)));
}

/**
 * Confere a saída da análise contra o pacote. Devolve as violações, cada uma
 * com a regra, o bloco (resumo, acoes, testes, atencao, sug-N, formato), o
 * trecho e o motivo.
 */
export function checarAnalise(saida, pacote) {
  const violacoes = [];
  const universo = universoDoPacote(pacote);
  if (!saida || typeof saida !== 'object') return [{ regra: 'Formato', bloco: 'formato', trecho: '', motivo: 'A resposta não veio no formato esperado.' }];
  for (const [campo, chave] of BLOCOS_TEXTO) {
    if (!Array.isArray(saida[campo])) { violacoes.push({ regra: 'Formato', bloco: chave, trecho: '', motivo: `Falta o bloco ${campo}.` }); continue; }
    for (const frase of saida[campo]) checarFrase(frase, chave, pacote, universo, violacoes);
  }
  if (Array.isArray(saida.resumo) && !saida.resumo.length) violacoes.push({ regra: 'Formato', bloco: 'resumo', trecho: '', motivo: 'O resumo veio vazio.' });

  // Semana atípica: o resumo tem que trazer o aviso.
  if (pacote.marcas && pacote.marcas.atipica && Array.isArray(saida.resumo)) {
    const id = pacote.marcas.atipica.fato_id;
    if (!saida.resumo.some((f) => (f.citacoes || []).includes(id))) violacoes.push({ regra: 'Semana atípica', bloco: 'resumo', trecho: '', motivo: `A semana é atípica e o resumo não cita o aviso (${id}).` });
  }

  const sugestoes = Array.isArray(saida.sugestoes) ? saida.sugestoes : [];
  if (sugestoes.length > 3) violacoes.push({ regra: 'Formato', bloco: 'sugestoes', trecho: '', motivo: `Vieram ${sugestoes.length} testes propostos; o máximo é 3.` });
  if (!sugestoes.length && !String(saida.sem_sugestao_motivo || '').trim()) violacoes.push({ regra: 'Formato', bloco: 'sugestoes', trecho: '', motivo: 'Sem testes propostos e sem dizer por quê.' });
  const restricoes = (pacote.contexto ? pacote.contexto.itens : []).filter((i) => i.tipo === 'restricao');
  sugestoes.slice(0, 3).forEach((s, i) => {
    const bloco = `sug-${i + 1}`;
    for (const campo of ['funil', 'hipotese', 'mudar', 'metrica', 'criterio', 'minimo']) {
      if (!String(s[campo] || '').trim()) violacoes.push({ regra: 'Formato', bloco, trecho: '', motivo: `O teste proposto está sem o campo ${campo}.` });
    }
    if (s.porque) checarFrase(s.porque, bloco, pacote, universo, violacoes);
    for (const campo of ['hipotese', 'mudar', 'criterio', 'minimo']) {
      for (const n of numerosDoTexto(s[campo])) {
        if (campo !== 'minimo' && campo !== 'criterio' && !numeroExiste(n, universo)) violacoes.push({ regra: 'Números', bloco, trecho: String(s[campo]).slice(0, 160), motivo: `O número "${n.bruto}" não existe no pacote de fatos.` });
      }
    }
    // Restrição: a sugestão mexe no que a gestora disse para não mexer.
    const alvo = palavrasChave(`${s.hipotese} ${s.mudar}`);
    for (const r of restricoes) {
      const termos = [...palavrasChave(r.titulo)];
      const comuns = termos.filter((t) => alvo.has(t));
      if (comuns.length >= 2) violacoes.push({ regra: 'Restrição', bloco, trecho: String(s.mudar || '').slice(0, 160), motivo: `Parece contrariar a restrição "${r.titulo}".` });
    }
  });
  return violacoes;
}

/**
 * Monta o que vai ao ar a partir da saída e das violações finais: blocos com
 * violação saem (e ficam registrados em `removidos`). Sem o resumo não há
 * relatório escrito: tudo sai e a situação é "não passou".
 */
export function publicar(saida, violacoes) {
  const blocos = [];
  for (const [campo, chave, titulo] of BLOCOS_TEXTO) blocos.push({ chave, titulo, tipo: 'texto', frases: (saida && saida[campo]) || [] });
  const sugestoes = saida && Array.isArray(saida.sugestoes) ? saida.sugestoes.slice(0, 3) : [];
  sugestoes.forEach((s, i) => blocos.push({ chave: `sug-${i + 1}`, titulo: `Teste proposto ${i + 1}`, tipo: 'sugestao', sugestao: s }));
  if (!sugestoes.length) blocos.push({ chave: 'sem_sugestao', titulo: 'Testes propostos', tipo: 'sem_sugestao', texto: String((saida && saida.sem_sugestao_motivo) || '') });

  const reprovados = new Set(violacoes.map((v) => (v.bloco === 'sugestoes' ? 'sem_sugestao' : v.bloco)));
  if (reprovados.has('formato') || reprovados.has('resumo')) {
    return { situacao: 'nao_passou', blocos: [], removidos: blocos.map((b) => ({ chave: b.chave, titulo: b.titulo, motivos: violacoes.filter((v) => v.bloco === b.chave).map((v) => v.motivo) })) };
  }
  if (reprovados.has('sem_sugestao')) for (const b of blocos) if (b.tipo === 'sugestao') reprovados.add(b.chave);
  const aprovados = blocos.filter((b) => !reprovados.has(b.chave));
  const removidos = blocos.filter((b) => reprovados.has(b.chave)).map((b) => ({ chave: b.chave, titulo: b.titulo, motivos: violacoes.filter((v) => v.bloco === b.chave || (b.tipo === 'sugestao' && v.bloco === 'sugestoes')).map((v) => v.motivo) }));
  return { situacao: removidos.length ? 'parcial' : 'verificada', blocos: aprovados, removidos };
}
