// Relatório semanal do Argo (spec-relatorio-semanal-argo.md). PROTÓTIPO da issue 399.
//
// Só front, com dados de exemplo gerados aqui mesmo: nada chama a API, nada é
// salvo nem gerado. Serve para a gestora navegar pelo relatório na prévia e
// aprovar o desenho antes das issues de construção (405–410).
//
// Mora na aba Argo, vista `#argo?v=relatorio`. O index.html só chama
// `ArgoRelatorio.abrir(raiz)` quando a vista aparece.
//
// No sistema de verdade os números, os sinais e as marcas (amostra pequena,
// semana atípica, indisponível) chegam prontos do servidor. Aqui eles são
// montados no navegador só porque não existe servidor ainda.
//
// Padrões copiados do email-mkt.js: faixa "Protótipo" com seletor de estado
// (CSS em-proto*), aviso curto (CSS ag-toast), gaveta lateral (CSS ag-gaveta).
(() => {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const int = (n) => Number(n || 0).toLocaleString('pt-BR');
  const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const pct = (n, c = 1) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: c, minimumFractionDigits: c }) + '%';

  // ---------------------------------------------------------------------------
  // Estados do protótipo
  // ---------------------------------------------------------------------------
  const ESTADOS = [
    ['verificada', 'Verificada'],
    ['parcial', 'Parcial'],
    ['naopassou', 'Não passou na checagem'],
    ['primeira', 'Primeira semana (sem histórico)'],
    ['fontes', 'Fontes com problema'],
  ];
  const SITUACAO = {
    verificada: ['Análise verificada', 'alta'],
    parcial: ['Análise parcial', 'alerta'],
    naopassou: ['Não passou na checagem', 'queda'],
    substituida: ['Substituída', 'neutro'],
    falhou: ['Falhou', 'queda'],
  };

  let estado = 'verificada';
  let modo = 'relatorio'; // relatorio | historico | comparar
  let semanaAberta = 5;
  let comparar = [4, 5];
  const reacoes = {};      // bloco -> { tipo, comentario }
  const descartes = {};    // sugestão -> motivo
  let raizAtual = null;

  // ---------------------------------------------------------------------------
  // Dados de exemplo (fixos: a mesma prévia mostra sempre o mesmo)
  // ---------------------------------------------------------------------------
  const SEMANAS = [
    { de: '24/08', ate: '30/08', gerado: '31/08 07h00', situacao: 'verificada' },
    { de: '31/08', ate: '06/09', gerado: '07/09 07h00', situacao: 'falhou', motivo: 'O Meta não respondeu às 07h00 e de novo às 07h30. Nada foi gerado nesta semana.' },
    { de: '07/09', ate: '13/09', gerado: '14/09 07h00', situacao: 'parcial', atipica: 'Feriado de 07/09 (contexto).' },
    { de: '14/09', ate: '20/09', gerado: '21/09 09h12', situacao: 'verificada', substituida: '21/09 07h00' },
    { de: '21/09', ate: '27/09', gerado: '28/09 07h00', situacao: 'verificada', atipica: 'Workshop Black ao vivo em 23/09 (contexto).' },
    { de: '28/09', ate: '04/10', gerado: '05/10 07h00', situacao: null, atipica: 'Live de lançamento da SE em 01/10 (contexto).' },
  ];

  // [gasto, leads, MQLs] por semana, da mais antiga para a mais recente.
  const FUNIS = [
    { id: 'se', nome: 'Sessão estratégica', meta: { cpl: 35, cpmql: 130 },
      s: [[2050, 55, 14], [1980, 49, 12], [2200, 58, 16], [2400, 60, 15], [2310, 62, 15], [2480, 74, 21]] },
    { id: 'wg', nome: 'Workshop gratuito', meta: { cpl: 6, cpmql: 60 },
      s: [[1100, 198, 15], [1050, 176, 12], [1400, 260, 20], [1350, 251, 24], [1290, 240, 22], [1320, 225, 18]] },
    { id: 'wp', nome: 'Workshop pago', meta: { cpl: 25, cpmql: 110 },
      s: [[700, 30, 6], [650, 22, 4], [820, 35, 8], [760, 31, 6], [900, 37, 7], [860, 41, 9]] },
    { id: 'am', nome: 'Aplicação mentoria', meta: null,
      s: [[300, 7, 4], [350, 8, 5], [420, 5, 3], [390, 6, 4], [380, 9, 5], [410, 6, 4]] },
  ];
  // Piso do Argo usado no exemplo: abaixo disso a análise não pode concluir.
  const PISO_LEADS = 10;

  const METRICAS = [
    { id: 'gasto', nome: 'Gasto', fmt: brl, menorMelhor: null },
    { id: 'leads', nome: 'Leads', fmt: int, menorMelhor: false },
    { id: 'mqls', nome: 'MQLs', fmt: int, menorMelhor: false, crm: true },
    { id: 'cpl', nome: 'CPL', fmt: brl, menorMelhor: true },
    { id: 'cpmql', nome: 'Custo por MQL', fmt: brl, menorMelhor: true, crm: true },
  ];

  // Soma antes de dividir: média de razões mente quando o volume muda.
  function numeros(funil, semanas) {
    const t = semanas.reduce((a, i) => { const [g, l, m] = funil.s[i]; return [a[0] + g, a[1] + l, a[2] + m]; }, [0, 0, 0]);
    const n = semanas.length;
    return { gasto: t[0] / n, leads: t[1] / n, mqls: t[2] / n, cpl: t[1] ? t[0] / t[1] : null, cpmql: t[2] ? t[0] / t[2] : null };
  }

  const semHistorico = () => estado === 'primeira';
  const crmFora = () => estado === 'fontes';

  // ---------------------------------------------------------------------------
  // Pacote de fatos: cada número com etiqueta, nome, período e fonte
  // ---------------------------------------------------------------------------
  let FATOS = {};
  let ORDEM = [];
  function montarFatos(sem) {
    FATOS = {}; ORDEM = [];
    let n = 0;
    const add = (chave, grupo, nome, valor, extra = {}) => {
      const id = 'F' + (++n);
      FATOS[chave] = { id, chave, grupo, nome, valor, ...extra };
      ORDEM.push(chave);
    };
    const s = SEMANAS[sem];
    const periodo = `${s.de} a ${s.ate}`;
    const anteriores = [sem - 4, sem - 3, sem - 2, sem - 1].filter((i) => i >= 0);
    for (const f of FUNIS) {
      const atual = numeros(f, [sem]);
      const ant = sem > 0 ? numeros(f, [sem - 1]) : null;
      const media = anteriores.length === 4 ? numeros(f, anteriores) : null;
      const pequena = atual.leads < PISO_LEADS;
      for (const m of METRICAS) {
        const fora = m.crm && crmFora() && sem === 5;
        const fonte = m.crm ? 'CRM (ClickUp)' : (m.id === 'gasto' ? 'Meta' : 'Tracking');
        const base = { fonte, funil: f.id, metrica: m.id, fora, pequena: pequena && !fora && m.id !== 'gasto' };
        add(`${f.id}.${m.id}`, 'Resultados por funil', `${m.nome} · ${f.nome}`, fora ? null : atual[m.id], { ...base, periodo });
        if (!semHistorico()) {
          if (ant) add(`${f.id}.${m.id}.ant`, 'Comparações', `${m.nome} · ${f.nome} · semana anterior`, fora ? null : ant[m.id], { ...base, periodo: `${SEMANAS[sem - 1].de} a ${SEMANAS[sem - 1].ate}`, pequena: false });
          if (media) add(`${f.id}.${m.id}.media`, 'Comparações', `${m.nome} · ${f.nome} · média das 4 semanas anteriores`, fora ? null : media[m.id], { ...base, periodo: `${SEMANAS[anteriores[0]].de} a ${SEMANAS[sem - 1].ate}`, pequena: false });
        }
        if (f.meta && f.meta[m.id] != null) add(`${f.id}.${m.id}.meta`, 'Metas', `Meta de ${m.nome} · ${f.nome}`, f.meta[m.id], { fonte: 'Metas por funil (dash)', periodo: 'outubro', funil: f.id, metrica: m.id });
      }
    }
    // Ações e vereditos da semana
    for (const a of ACOES) add(`acao.${a.id}`, 'O que foi feito na conta', `${a.tipo}: ${a.alvo}`, null, { texto: a.resumo, fonte: a.manual ? 'Pausas manuais (Argo)' : 'Propostas do Argo', periodo: a.quando });
    for (const a of ACOES.filter((x) => x.veredito)) add(`ver.${a.id}`, 'Vereditos', `Veredito: ${a.tipo.toLowerCase()} ${a.alvo}`, null, { texto: a.veredito.texto, fonte: 'Vereditos do Argo', periodo: a.veredito.quando });
    // Testes
    for (const t of TESTES) add(`teste.${t.id}`, 'Testes', t.nome, null, { texto: numerosTeste(t), fonte: t.fonte, periodo: t.periodo, pequena: t.situacao === 'rodando' });
    // Contexto e marcas da semana
    for (const c of CONTEXTO) add(`ctx.${c.id}`, 'Contexto do negócio', c.titulo, null, { texto: c.texto, fonte: 'Contexto do negócio', periodo: c.revisao, vencido: c.vencido });
    if (s.atipica) add('marca.atipica', 'Marcas da semana', 'Semana atípica', null, { texto: s.atipica, fonte: 'Contexto do negócio', periodo });
    if (sem > 0 && !semHistorico()) add('marca.mix', 'Marcas da semana', 'Mudança do CPL geral: preço e mix', null, { texto: textoMix(sem), fonte: 'Cálculo do relatório', periodo });
    if (crmFora() && sem === 5) add('fonte.crm', 'Fontes com problema', 'CRM indisponível', null, { texto: 'O ClickUp não respondeu às 07h00 nem às 07h10. MQLs e custo por MQL ficaram sem número.', fonte: 'Geração do relatório', periodo: '05/10 07h10' });
  }

  // Separa a mudança do CPL geral em preço (cada funil ficou mais caro ou mais
  // barato) e mix (a verba mudou de funil), segurando a divisão da verba da
  // semana anterior. No sistema de verdade este cálculo vem do servidor.
  function textoMix(sem) {
    const tot = (i) => FUNIS.reduce((a, f) => [a[0] + f.s[i][0], a[1] + f.s[i][1]], [0, 0]);
    const [gA, lA] = tot(sem - 1); const [gB, lB] = tot(sem);
    const cplA = gA / lA; const cplB = gB / lB;
    const cplPreco = 1 / FUNIS.reduce((a, f) => a + (f.s[sem - 1][0] / gA) / (f.s[sem][0] / f.s[sem][1]), 0);
    const sinalBrl = (n) => (n < 0 ? '−' : '+') + brl(Math.abs(n));
    return `O CPL geral foi de ${brl(cplA)} para ${brl(cplB)}. Preço dos funis: ${sinalBrl(cplPreco - cplA)}. Verba mudando de funil: ${sinalBrl(cplB - cplPreco)}.`;
  }

  const ACOES = [
    { id: 'a1', tipo: 'Pausar anúncio', grupo: 'Pausas', alvo: 'ad13_tweet-se-322_img', funil: 'Sessão estratégica', quando: 'aprovada 29/09, executada 29/09 09h10',
      resumo: 'Gastou R$ 412 sem MQL (piso R$ 380).', estadoAcao: 'Executada',
      veredito: { tipo: 'acertou', texto: 'CPL do conjunto: R$ 41,20 nos 7 dias antes, R$ 33,90 nos 5 dias depois.', quando: 'saiu 04/10' } },
    { id: 'a2', tipo: 'Pausar anúncio', grupo: 'Pausas', alvo: 'ad07_carrossel-wg_v2', funil: 'Workshop gratuito', quando: 'aprovada 30/09, executada 30/09 10h00',
      resumo: 'Custo por MQL 2,1× a média do funil.', estadoAcao: 'Executada', veredito: null, aguardando: 'veredito até 07/10' },
    { id: 'a3', tipo: 'Reduzir orçamento', grupo: 'Orçamento', alvo: 'WG | Interesses atacado', funil: 'Workshop gratuito', quando: 'aprovada 01/10, executada 01/10 08h50',
      resumo: 'De R$ 150 para R$ 110 por dia.', estadoAcao: 'Executada',
      veredito: { tipo: 'inconclusivo', texto: 'O orçamento do conjunto mudou de novo em 03/10, dentro da janela.', quando: 'saiu 04/10' } },
    { id: 'a4', tipo: 'Realocar verba', grupo: 'Orçamento', alvo: 'WP | Remarketing → SE | Lookalike 2%', funil: 'Sessão estratégica', quando: 'aprovada 29/09, executada 29/09 09h12',
      resumo: 'R$ 40 por dia saíram do remarketing do workshop pago.', estadoAcao: 'Executada',
      veredito: { tipo: 'acertou', texto: 'CPL do Lookalike 2%: R$ 31,80 na janela, contra R$ 38,82 de média do funil nas 4 semanas anteriores.', quando: 'saiu 03/10' } },
    { id: 'a5', tipo: 'Pausar campanha de tráfego', grupo: 'Recusadas', alvo: 'Tráfego | Reels Felipe', funil: 'Tráfego', quando: 'recusada 30/09',
      resumo: 'Você recusou: "campanha de marca, não mede por visita".', estadoAcao: 'Recusada', veredito: null },
    { id: 'a6', tipo: 'Pausa manual', grupo: 'Pausas manuais', alvo: 'ad02_video-wp_depoimento', funil: 'Workshop pago', quando: 'pausado à mão 02/10 16h40', manual: true,
      resumo: 'Fora do Argo, pelo Gerenciador de Anúncios.', estadoAcao: 'Manual', veredito: null },
  ];
  const VEREDITO = { acertou: ['Acertou', 'alta'], errou: ['Errou', 'queda'], inconclusivo: ['Inconclusivo', 'neutro'] };

  const TESTES = [
    { id: 't1', nome: 'Gancho com pergunta x gancho com número (SE)', tipo: 'Criativo', situacao: 'rodando', periodo: 'desde 25/09',
      numeros: 'Pergunta: 31 leads, 9 MQLs. Número: 28 leads, 7 MQLs. Faltam 5 dias e 18 leads para ler.',
      semCrm: 'Pergunta: 31 leads. Número: 28 leads. MQLs indisponíveis (CRM fora). Faltam 5 dias e 18 leads para ler.', fonte: 'Meta + tracking', falta: 'faltam 5 dias e 18 leads' },
    { id: 't2', nome: '/workshop-gratuito selos x stories', tipo: 'Página', situacao: 'pronto', periodo: '14/09 a 04/10',
      numeros: 'A (selos): 17,9% de conversão em 1.204 visitas. B (stories): 21,4% em 1.188 visitas.', fonte: 'Teste A/B do dash' },
    { id: 't3', nome: 'Lookalike 2% x Interesses (SE)', tipo: 'Público', situacao: 'concluido', periodo: '07/09 a 02/10', resultado: 'Variante ganhou',
      numeros: 'Lookalike 2%: CPL R$ 31,80, 19 MQLs. Interesses: CPL R$ 39,10, 12 MQLs.',
      semCrm: 'Lookalike 2%: CPL R$ 31,80. Interesses: CPL R$ 39,10. MQLs indisponíveis (CRM fora).', fonte: 'Meta + tracking' },
  ];
  // Com o CRM fora, nenhum número de MQL aparece, nem dentro dos testes.
  const numerosTeste = (t) => (crmFora() && t.semCrm ? t.semCrm : t.numeros);
  const SITUACAO_TESTE = { rodando: ['Rodando', 'neutro'], pronto: ['Pronto para ler', 'alerta'], concluido: ['Concluído na semana', 'alta'] };

  const CONTEXTO = [
    { id: 'c1', titulo: 'Prioridade: SE é o funil principal em outubro', texto: 'Workshop gratuito segue como apoio.', revisao: 'revisado há 4 dias' },
    { id: 'c2', titulo: 'Oferta: workshop pago a R$ 47', texto: 'Preço do ingresso do workshop pago.', revisao: 'revisado há 41 dias', vencido: true },
    { id: 'c3', titulo: 'Restrição: não mexer no remarketing do workshop pago até 15/10', texto: 'Teste de público da Meta em andamento.', revisao: 'revisado há 9 dias' },
  ];

  // ---------------------------------------------------------------------------
  // Citação e marcas
  // ---------------------------------------------------------------------------
  const fato = (chave) => FATOS[chave];
  const valorFato = (f) => {
    if (!f) return '';
    if (f.valor == null) return f.fora ? 'indisponível' : (f.texto || '');
    const m = METRICAS.find((x) => x.id === f.metrica);
    return m ? m.fmt(f.valor) : String(f.valor);
  };
  const v = (chave) => esc(valorFato(fato(chave)));
  const cita = (...chaves) => chaves.map(fato).filter(Boolean)
    .map((f) => `<button type="button" class="ar-cita" data-fato="${esc(f.chave)}" aria-label="Fonte ${f.id}: ${esc(f.nome)}">${f.id}</button>`).join('');

  const carimbo = (mapa, k) => { const [r, c] = mapa[k] || [k, 'neutro']; return `<span class="carimbo ${c}">${esc(r)}</span>`; };

  // Sinal frente à meta (quando há) ou à média: ▲ ▼ sempre com a palavra.
  function sinal(funil, m, sem) {
    if (m.menorMelhor == null) return '';
    const atual = fato(`${funil.id}.${m.id}`);
    if (!atual || atual.valor == null) return '';
    if (atual.pequena) return '<span class="carimbo neutro">amostra pequena</span>';
    const ref = fato(`${funil.id}.${m.id}.meta`) || fato(`${funil.id}.${m.id}.media`);
    if (!ref || ref.valor == null) return '';
    const d = (atual.valor - ref.valor) / ref.valor;
    if (Math.abs(d) < 0.05) return '<span class="carimbo neutro">estável</span>';
    const melhor = m.menorMelhor ? d < 0 : d > 0;
    const seta = d < 0 ? '▼' : '▲';
    const contra = ref.chave.endsWith('.meta') ? 'meta' : 'média';
    return `<span class="carimbo ${melhor ? 'alta' : 'queda'}">${seta} ${pct(Math.abs(d) * 100, 0)} ${melhor ? 'melhor' : 'pior'} que a ${contra}</span>`;
  }

  // ---------------------------------------------------------------------------
  // Textos da leitura (exemplo). Cada bloco tem chave para reação e checagem.
  // ---------------------------------------------------------------------------
  function blocosLeitura() {
    const resumoNormal = `<p>A SE teve a melhor semana do mês: CPL de ${v('se.cpl')} ${cita('se.cpl', 'se.cpl.meta')}, abaixo da meta, com ${v('se.mqls')} MQLs ${cita('se.mqls', 'se.mqls.ant')} contra ${v('se.mqls.ant')} na semana anterior. Parte disso veio da verba realocada para o Lookalike 2%, que o veredito confirmou ${cita('ver.a4')}.</p>
      <p>O workshop gratuito ficou mais caro por MQL (${v('wg.cpmql')} ${cita('wg.cpmql', 'wg.cpmql.media')}) mesmo com o CPL perto do normal ${cita('wg.cpl', 'wg.cpl.media')}: o problema parece ser a qualidade do lead, não o preço.</p>
      <p>A semana teve a live de lançamento da SE ${cita('marca.atipica')}, então compare com cuidado.</p>`;
    const resumoFontes = `<p>A SE teve CPL de ${v('se.cpl')} ${cita('se.cpl', 'se.cpl.meta')}, abaixo da meta, com ${v('se.leads')} leads ${cita('se.leads', 'se.leads.ant')} contra ${v('se.leads.ant')} na semana anterior.</p>
      <p>O CRM não respondeu na geração ${cita('fonte.crm')}: sem MQLs, esta análise não diz nada sobre qualidade de lead nesta semana.</p>`;
    const resumoPrimeira = `<p>Primeiro relatório: ainda não há semanas anteriores para comparar. A SE fechou com CPL de ${v('se.cpl')} ${cita('se.cpl', 'se.cpl.meta')}, abaixo da meta, e o workshop gratuito com CPL de ${v('wg.cpl')} ${cita('wg.cpl', 'wg.cpl.meta')}, também dentro da meta.</p>`;

    return [
      { chave: 'resumo', titulo: 'Resumo da semana', html: crmFora() ? resumoFontes : (semHistorico() ? resumoPrimeira : resumoNormal) },
      { chave: 'acoes', titulo: 'Leitura das ações', html: `<p>Duas ações da semana deram certo segundo o veredito: a pausa do <b>ad13</b> ${cita('acao.a1', 'ver.a1')} e a realocação para o Lookalike 2% ${cita('acao.a4', 'ver.a4')}. A redução no conjunto de interesses do workshop gratuito ficou sem resposta porque o orçamento mudou de novo dentro da janela ${cita('ver.a3')}.</p>
        <p>A pausa do <b>ad07</b> ainda não tem veredito ${cita('acao.a2')}: só dá para ler a partir de 07/10.</p>` },
      { chave: 'testes', titulo: 'Leitura dos testes', html: `<p>O teste de página do workshop gratuito está pronto para ler ${cita('teste.t2')}: a versão com stories converteu mais, com volume parecido nos dois lados. Vale encerrar e registrar o aprendizado.</p>
        <p>O teste de gancho da SE ${cita('teste.t1')} ainda não tem volume: nenhuma conclusão até completar o mínimo.</p>` },
      { chave: 'atencao', titulo: 'Pontos de atenção', html: (crmFora() || semHistorico())
        ? `<ul><li>A aplicação mentoria trouxe ${v('am.leads')} leads ${cita('am.leads')}, abaixo do piso: não dá para concluir nada sobre ela.</li>
           <li>O item "${esc(CONTEXTO[1].titulo)}" está sem revisão há 41 dias ${cita('ctx.c2')}. Se a oferta mudou, a leitura do workshop pago pode estar errada.</li></ul>`
        : `<ul><li>Workshop gratuito: custo por MQL subiu com o CPL quase estável ${cita('wg.cpmql', 'wg.cpl')}. Se continuar na próxima semana, o problema está no público ou na isca, não no leilão.</li>
           <li>A aplicação mentoria trouxe ${v('am.leads')} leads ${cita('am.leads')}, abaixo do piso: não dá para concluir nada sobre ela.</li>
           <li>O item "${esc(CONTEXTO[1].titulo)}" está sem revisão há 41 dias ${cita('ctx.c2')}. Se a oferta mudou, a leitura do workshop pago pode estar errada.</li></ul>` },
    ];
  }

  const SUGESTOES = [
    { id: 's1', tipo: 'Criativo', funil: 'Sessão estratégica',
      hipotese: 'Acreditamos que um gancho de dor ("estoque parado no atacado") traz MQL mais barato que o gancho de autoridade, porque o ad13, pausado, era de autoridade.',
      mudar: 'Dois anúncios novos no conjunto Lookalike 2%: dor contra autoridade, mesmo formato.',
      metrica: 'Custo por MQL', criterio: 'Dor com custo por MQL 15% menor', duracao: '14 dias e 30 leads por lado',
      porque: () => `O ad13 foi pausado e o CPL do conjunto caiu ${cita('ver.a1')}.`,
      parecido: 'Gancho com pergunta x gancho com número (SE), rodando' },
    { id: 's2', tipo: 'Oferta e funil', funil: 'Workshop gratuito',
      hipotese: 'Acreditamos que perguntar o faturamento no formulário do workshop gratuito melhora a taxa de MQL, porque o custo por MQL subiu com o CPL estável.',
      mudar: 'Uma pergunta de faixa de faturamento na versão B do formulário.',
      metrica: 'Taxa de MQL', criterio: 'Taxa de MQL 3 pontos maior sem CPL subir mais que 10%', duracao: '14 dias e 150 leads por lado',
      porque: () => `Custo por MQL ${v('wg.cpmql')} contra ${v('wg.cpmql.media')} de média ${cita('wg.cpmql', 'wg.cpmql.media')}.`,
      parecido: 'Nenhum teste parecido no registro' },
    { id: 's3', tipo: 'Página', funil: 'Sessão estratégica',
      hipotese: 'Acreditamos que o hero com foto da /se-v3 converte mais que o da /se-v2, porque a live trouxe tráfego mais frio.',
      mudar: 'Teste A/B /se-v2 contra /se-v3 no tráfego pago.',
      metrica: 'Conversão da página', criterio: 'Conversão 2 pontos maior', duracao: '14 dias e 800 visitas por lado',
      porque: () => `A semana teve a live de lançamento ${cita('marca.atipica')}.`,
      parecido: '/workshop-gratuito selos x stories, pronto para ler', removida: true },
  ];

  const CHECAGEM = {
    verificada: [
      { tentativa: 1, resultado: 'reprovou', violacoes: [{ regra: 'Números', trecho: 'Leitura dos testes', motivo: 'O texto citava "9,8%", que não existe no pacote de fatos.' }] },
      { tentativa: 2, resultado: 'passou', violacoes: [] },
    ],
    parcial: [
      { tentativa: 1, resultado: 'reprovou', violacoes: [
        { regra: 'Leitura antecipada', trecho: 'Leitura dos testes', motivo: 'Declarava vencedor o teste de gancho da SE, que ainda está rodando.' },
        { regra: 'Números', trecho: 'Teste proposto 3', motivo: 'O texto dizia que a /se-v3 "converte 2,3× mais", número que não existe no pacote.' }] },
      { tentativa: 2, resultado: 'reprovou', violacoes: [
        { regra: 'Números', trecho: 'Teste proposto 3', motivo: 'Continuou citando "2,3×" sem fato que sustente. Bloco removido, o resto passou.' }] },
    ],
    naopassou: [
      { tentativa: 1, resultado: 'reprovou', violacoes: [
        { regra: 'Causa sem veredito', trecho: 'Resumo da semana', motivo: 'Atribuía a queda do CPL da SE à pausa do ad07, que ainda não tem veredito.' },
        { regra: 'Leitura antecipada', trecho: 'Leitura dos testes', motivo: 'Declarava vencedor o teste de gancho da SE, que ainda está rodando.' }] },
      { tentativa: 2, resultado: 'reprovou', violacoes: [
        { regra: 'Amostra', trecho: 'Pontos de atenção', motivo: 'Concluía que a aplicação mentoria "está piorando" com 6 leads, abaixo do piso.' },
        { regra: 'Causa sem veredito', trecho: 'Resumo da semana', motivo: 'Manteve a pausa do ad07 como causa da melhora.' }] },
    ],
  };
  CHECAGEM.primeira = CHECAGEM.verificada.slice(1);
  CHECAGEM.fontes = [
    { tentativa: 1, resultado: 'reprovou', violacoes: [{ regra: 'Fonte indisponível', trecho: 'Pontos de atenção', motivo: 'Falava em "qualidade do lead caindo" sem os MQLs, que estavam indisponíveis.' }] },
    { tentativa: 2, resultado: 'passou', violacoes: [] },
  ];

  // Painel de qualidade: [útil, óbvio, errado] por semana publicada.
  const QUALIDADE = [
    { semana: 0, r: [5, 3, 2] }, { semana: 2, r: [4, 3, 1] }, { semana: 3, r: [6, 2, 1] }, { semana: 4, r: [7, 2, 0] },
  ];

  // ---------------------------------------------------------------------------
  // Toast e gaveta (mesmo desenho do email-mkt.js, CSS ag-*)
  // ---------------------------------------------------------------------------
  let toastTempo = null;
  function avisar(texto) {
    let t = document.getElementById('ar-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'ar-toast';
      t.className = 'ag-toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
    }
    const g = document.getElementById('ar-gaveta');
    (g && g.open ? g : document.body).appendChild(t);
    t.textContent = texto;
    void t.offsetWidth;
    t.classList.add('visivel');
    clearTimeout(toastTempo);
    toastTempo = setTimeout(() => t.classList.remove('visivel'), 3200);
  }
  const avisarProto = (oQueFaria) => avisar(`Protótipo: nada foi salvo. ${oQueFaria}`);

  function gaveta({ titulo, sub = '', corpo }) {
    let g = document.getElementById('ar-gaveta');
    if (!g) {
      g = document.createElement('dialog');
      g.id = 'ar-gaveta';
      g.className = 'ag-gaveta em-gaveta em-gaveta--larga';
      g.addEventListener('click', (ev) => { if (ev.target === g) g.close(); });
      document.body.appendChild(g);
    }
    g.innerHTML = `<div class="ag-gaveta__form ag-gaveta__form--simples">
      <header class="ag-gaveta__topo">
        <div><h2>${titulo}</h2>${sub ? `<p class="mini">${sub}</p>` : ''}</div>
        <button class="ag-gaveta__fechar" type="button" data-fechar aria-label="Fechar">×</button>
      </header>
      <div class="ag-gaveta__corpo">${corpo}</div>
    </div>`;
    g.querySelector('[data-fechar]').onclick = () => g.close();
    if (!g.open) g.showModal();
    return g;
  }

  // ---------------------------------------------------------------------------
  // Balão da citação: mouse e foco mostram, toque alterna. No celular vira folha.
  // ---------------------------------------------------------------------------
  function balao() {
    let b = document.getElementById('ar-balao');
    if (!b) {
      b = document.createElement('div');
      b.id = 'ar-balao';
      b.className = 'ar-balao';
      b.setAttribute('role', 'tooltip');
      b.hidden = true;
      document.body.appendChild(b);
    }
    return b;
  }
  function htmlFato(f) {
    const marcas = [];
    if (f.fora) marcas.push('<span class="carimbo queda">indisponível</span>');
    if (f.pequena) marcas.push(`<span class="carimbo neutro">amostra pequena</span>`);
    if (f.vencido) marcas.push('<span class="carimbo alerta">contexto vencido</span>');
    const explica = f.fora ? 'A fonte não respondeu na geração. Nada foi preenchido no lugar.'
      : f.pequena ? `Abaixo do piso de ${PISO_LEADS} leads do Argo: a análise não pode concluir nada daqui.`
      : f.vencido ? 'Passou do prazo de validade de 30 dias sem revisão.' : '';
    const valor = f.valor != null ? `<b class="ar-balao__valor">${esc(valorFato(f))}</b>` : (f.texto ? `<p class="ar-balao__texto">${esc(f.texto)}</p>` : '');
    return `<div class="ar-balao__id">${f.id} · ${esc(f.grupo)}</div>
      <div class="ar-balao__nome">${esc(f.nome)}</div>
      ${valor}
      ${marcas.length ? `<div class="ar-balao__marcas">${marcas.join(' ')}</div>` : ''}
      ${explica ? `<p class="mini">${esc(explica)}</p>` : ''}
      <div class="mini">${esc(f.periodo || '')} · fonte: ${esc(f.fonte || '')}</div>`;
  }
  let balaoDono = null;
  function mostrarBalao(btn) {
    const f = fato(btn.dataset.fato);
    if (!f) return;
    const b = balao();
    b.innerHTML = htmlFato(f);
    b.hidden = false;
    balaoDono = btn;
    if (window.matchMedia('(max-width: 640px)').matches) {
      b.classList.add('ar-balao--folha');
      b.style.left = ''; b.style.top = '';
      return;
    }
    b.classList.remove('ar-balao--folha');
    const r = btn.getBoundingClientRect();
    const larg = b.offsetWidth;
    const esq = Math.min(Math.max(8, r.left + r.width / 2 - larg / 2), window.innerWidth - larg - 8);
    const cabeEmbaixo = r.bottom + b.offsetHeight + 12 < window.innerHeight;
    b.style.left = `${esq + window.scrollX}px`;
    b.style.top = `${(cabeEmbaixo ? r.bottom + 8 : r.top - b.offsetHeight - 8) + window.scrollY}px`;
  }
  function esconderBalao() { const b = document.getElementById('ar-balao'); if (b) b.hidden = true; balaoDono = null; }

  // ---------------------------------------------------------------------------
  // Desenho
  // ---------------------------------------------------------------------------
  function seloProto() {
    return `<div class="em-proto" role="note">
      <span class="em-proto__selo">Protótipo</span>
      <span>Dados de exemplo. Nada aqui é salvo nem gerado.</span>
      <label class="em-proto__cen">Ver estado
        <select data-ar-estado aria-label="Estado de exemplo">${ESTADOS.map(([val, r]) => `<option value="${val}"${val === estado ? ' selected' : ''}>${r}</option>`).join('')}</select></label>
    </div>`;
  }

  function navegacao() {
    const b = (m, r) => `<button type="button" class="tipo-pill" data-ar-modo="${m}" aria-pressed="${modo === m}">${r}</button>`;
    return `<div class="ar-nav" role="group" aria-label="Parte do relatório">
      ${b('relatorio', 'Esta semana')}${semHistorico() ? '' : b('historico', 'Histórico') + b('comparar', 'Comparar semanas')}
      <button type="button" class="btn sec ar-nav__pacote" data-ar-pacote>Ver pacote de fatos</button>
    </div>`;
  }

  function situacaoAtual() { return estado === 'primeira' || estado === 'fontes' ? 'verificada' : estado; }

  function cabecalho(sem) {
    const s = SEMANAS[sem];
    const sit = sem === 5 ? situacaoAtual() : s.situacao;
    const [rot, cls] = SITUACAO[sit];
    const avisos = [];
    if (sem === 5 && estado === 'naopassou') avisos.push(['falha', 'A análise escrita não passou na checagem depois de 2 tentativas. Abaixo, só a parte calculada. <button type="button" class="ar-link" data-ar-checagem>Ver por quê</button>']);
    if (sem === 5 && estado === 'parcial') avisos.push(['alerta', '1 bloco removido pela checagem: o teste proposto 3. <button type="button" class="ar-link" data-ar-checagem>Ver por quê</button>']);
    if (sem === 5 && crmFora()) avisos.push(['falha', 'CRM indisponível na geração (05/10 07h10): MQLs e custo por MQL ficaram sem número e fora da análise.']);
    if (sem === 5) avisos.push(['alerta', `1 item do contexto sem revisão há 41 dias: <b>${esc(CONTEXTO[1].titulo)}</b>. O relatório usou mesmo assim.`]);
    if (s.atipica) avisos.push(['alerta', `Semana atípica: ${esc(s.atipica)} Compare com cuidado.`]);
    if (semHistorico()) avisos.push(['explica', 'Primeira semana: ainda não há semanas anteriores para comparar nem reações para aprender.']);
    return `<header class="ar-cabeca">
      <div class="ar-cabeca__linha">
        <div>
          <div class="ar-cabeca__rotulo">Relatório semanal do Argo</div>
          <h2 class="ar-cabeca__titulo">Semana de ${s.de} a ${s.ate}</h2>
          <div class="mini">Gerado ${esc(s.gerado)}${s.substituida ? ` · substitui a versão de ${esc(s.substituida)}` : ''}</div>
        </div>
        <div class="ar-cabeca__acoes">
          <span class="carimbo ${cls}">${rot}</span>
          ${sem === 5 ? '<button type="button" class="btn sec" data-ar-gerar>Gerar de novo</button>' : ''}
        </div>
      </div>
      ${avisos.map(([t, h]) => `<p class="aviso ${t === 'falha' ? 'falha ar-aviso' : t}">${h}</p>`).join('')}
    </header>`;
  }

  function painelFunis(sem) {
    return `<section class="bloco"><h2>Resultados por funil <small>semana anterior · média das 4 semanas anteriores · meta</small></h2>
      <div class="ar-funis">${FUNIS.map((f) => `<article class="ar-funil">
        <h3>${esc(f.nome)}</h3>
        ${METRICAS.map((m) => {
          const atual = fato(`${f.id}.${m.id}`);
          const ant = fato(`${f.id}.${m.id}.ant`);
          const med = fato(`${f.id}.${m.id}.media`);
          const meta = fato(`${f.id}.${m.id}.meta`);
          const valor = atual.valor == null ? '<span class="semdado">indisponível</span>' : esc(valorFato(atual));
          const comp = [];
          if (semHistorico() || sem === 0) comp.push('sem histórico ainda');
          else {
            comp.push(`anterior ${ant ? (ant.valor == null ? 'indisponível' : esc(valorFato(ant))) : 'sem histórico'}`);
            comp.push(`média 4 sem. ${med ? (med.valor == null ? 'indisponível' : esc(valorFato(med))) : 'sem histórico ainda'}`);
          }
          if (m.menorMelhor != null && m.id !== 'leads' && m.id !== 'mqls') comp.push(meta ? `meta ${esc(valorFato(meta))}` : 'sem meta cadastrada');
          return `<div class="ar-met">
            <span class="ar-met__nome">${m.nome}</span>
            <span class="ar-met__valor">${valor} ${cita(`${f.id}.${m.id}`)}</span>
            <span class="ar-met__comp">${comp.join(' · ')}</span>
            <span class="ar-met__sinal">${sinal(f, m, sem)}</span>
          </div>`;
        }).join('')}
      </article>`).join('')}</div>
    </section>`;
  }

  function oQueFoiFeito() {
    const grupos = ['Pausas', 'Orçamento', 'Recusadas', 'Pausas manuais'];
    const aprovadas = ACOES.filter((a) => a.estadoAcao === 'Executada').length;
    const recusadas = ACOES.filter((a) => a.estadoAcao === 'Recusada').length;
    return `<section class="bloco"><h2>O que foi feito na conta <small>${aprovadas} aprovadas · ${recusadas} recusada · 0 pendentes</small></h2>
      ${grupos.map((g) => {
        const itens = ACOES.filter((a) => a.grupo === g);
        if (!itens.length) return '';
        return `<div class="argo-grupo"><div class="argo-grupo-titulo">${g}</div>
          ${itens.map((a) => `<div class="argo-acao">
            <div>
              <span class="argo-acao-nome">${esc(a.tipo)}: ${esc(a.alvo)} ${cita(`acao.${a.id}`)}</span>
              <span class="argo-acao-desc">${esc(a.funil)} · ${esc(a.resumo)} · ${esc(a.quando)}</span>
              ${a.veredito ? `<span class="argo-acao-desc">${esc(a.veredito.texto)} ${cita(`ver.${a.id}`)}</span>` : ''}
            </div>
            <div class="ar-acao-lado">
              ${a.veredito ? carimbo(VEREDITO, a.veredito.tipo) : (a.aguardando ? `<span class="mini">${esc(a.aguardando)}</span>` : '')}
              ${a.manual ? '' : '<button type="button" class="ar-link" data-argo-vista="propostas">ver proposta</button>'}
            </div>
          </div>`).join('')}</div>`;
      }).join('')}
    </section>`;
  }

  function testesCalculados() {
    return `<section class="bloco"><h2>Testes <small>rodando, prontos para ler e concluídos na semana</small></h2>
      ${TESTES.map((t) => `<div class="argo-acao">
        <div>
          <span class="argo-acao-nome">${esc(t.nome)} ${cita(`teste.${t.id}`)}</span>
          <span class="argo-acao-desc">${esc(t.tipo)} · ${esc(t.periodo)}${t.resultado ? ` · ${esc(t.resultado)}` : ''}</span>
          <span class="argo-acao-desc">${esc(numerosTeste(t))}</span>
        </div>
        <div class="ar-acao-lado">${carimbo(SITUACAO_TESTE, t.situacao)}<button type="button" class="ar-link" data-ar-teste="${t.id}">abrir ficha</button></div>
      </div>`).join('')}
    </section>`;
  }

  // Leitura da IA: fio lateral e rótulo próprio, nunca com cara de número calculado.
  function reacao(chave) {
    const r = reacoes[chave] || {};
    const b = (tipo, rot) => `<button type="button" class="ar-reacao__btn" data-ar-reagir="${tipo}" data-bloco="${chave}" aria-pressed="${r.tipo === tipo}">${rot}</button>`;
    const pedindo = r.pedindo;
    return `<div class="ar-reacao" data-reacao="${chave}">
      ${b('util', 'Útil')}${b('obvio', 'Óbvio')}${b('errado', 'Errado')}
      <button type="button" class="ar-link" data-ar-comentar="${chave}">Comentar</button>
      ${r.comentario ? `<button type="button" class="ar-link" data-ar-contexto="${chave}">Virar item de contexto</button>` : ''}
      ${r.comentario && !pedindo ? `<p class="ar-reacao__coment">“${esc(r.comentario)}”</p>` : ''}
      ${pedindo ? `<form class="ar-reacao__form" data-ar-form="${chave}">
        <label class="mini" for="ar-c-${chave}">${pedindo === 'errado' ? 'O que está errado? (obrigatório)' : 'Comentário'}</label>
        <textarea id="ar-c-${chave}" rows="2" ${pedindo === 'errado' ? 'required' : ''}>${esc(r.comentario || '')}</textarea>
        <div class="ar-reacao__acoes"><button type="submit" class="btn">Salvar</button><button type="button" class="btn sec" data-ar-cancelar="${chave}">Cancelar</button></div>
      </form>` : ''}
    </div>`;
  }

  function leitura(bloco) {
    return `<section class="bloco"><h2>${bloco.titulo}</h2>
      <div class="ar-leitura"><div class="ar-leitura__rotulo">Leitura do Argo</div>${bloco.html}${reacao(bloco.chave)}</div>
    </section>`;
  }

  function sugestoes() {
    const lista = SUGESTOES.filter((s) => !(s.removida && estado === 'parcial'));
    const removida = estado === 'parcial'
      ? `<p class="aviso alerta ar-removido">Removido pela checagem: teste proposto 3 (página da SE). O texto citava um número que não existe no pacote de fatos. <button type="button" class="ar-link" data-ar-checagem>Ver por quê</button></p>` : '';
    if (estado === 'primeira') {
      return `<section class="bloco"><h2>Testes propostos</h2><div class="ar-leitura"><div class="ar-leitura__rotulo">Leitura do Argo</div><p>Sem base para sugerir teste nesta semana: sem histórico, não há como saber o que mudou nem o que já foi testado.</p></div></section>`;
    }
    return `<section class="bloco"><h2>Testes propostos <small>sugestão é só texto: nada é criado na conta</small></h2>
      <div class="ar-sugs">${lista.map((s, i) => {
        const motivo = descartes[s.id];
        return `<article class="ar-sug ar-leitura${motivo ? ' ar-sug--descartada' : ''}">
          <div class="ar-leitura__rotulo">Teste proposto ${i + 1} · ${esc(s.tipo)} · ${esc(s.funil)}</div>
          <p class="ar-sug__hip">${esc(s.hipotese)}</p>
          <dl class="ar-sug__ficha">
            <dt>O que mudar</dt><dd>${esc(s.mudar)}</dd>
            <dt>Métrica</dt><dd>${esc(s.metrica)}</dd>
            <dt>Sucesso</dt><dd>${esc(s.criterio)}</dd>
            <dt>Mínimo</dt><dd>${esc(s.duracao)}</dd>
            <dt>Por que agora</dt><dd>${s.porque()}</dd>
            <dt>Parecido no registro</dt><dd>${esc(s.parecido)}</dd>
          </dl>
          ${motivo != null
            ? `<p class="mini">Descartada: “${esc(motivo)}”. Na semana seguinte a análise lê esse motivo.</p>`
            : `<div class="ar-sug__acoes" data-sug="${s.id}">
                <button type="button" class="btn" data-ar-virar="${s.id}">Virar teste</button>
                <button type="button" class="btn sec" data-ar-descartar="${s.id}">Descartar</button>
              </div>`}
          ${reacao('sug-' + s.id)}
        </article>`;
      }).join('')}</div>
      ${removida}
    </section>`;
  }

  function qualidade() {
    if (semHistorico()) {
      return `<section class="bloco"><h2>Qualidade do relatório</h2><p class="aviso">Ainda vazio: as suas reações (útil, óbvio, errado) aparecem aqui a partir desta semana, e a tendência a partir da terceira.</p></section>`;
    }
    const linhas = QUALIDADE.map((q) => {
      const tot = q.r[0] + q.r[1] + q.r[2];
      const s = SEMANAS[q.semana];
      const barra = q.r.map((n, i) => `<i class="ar-q__${['util', 'obvio', 'errado'][i]}" style="width:${(n / tot) * 100}%"></i>`).join('');
      return `<div class="ar-q"><span class="ar-q__sem">${s.de} a ${s.ate}</span><span class="ar-q__barra" aria-hidden="true">${barra}</span>
        <span class="ar-q__num">${q.r[0]} útil · ${q.r[1]} óbvio · ${q.r[2]} errado</span></div>`;
    }).join('');
    return `<section class="bloco"><h2>Qualidade do relatório <small>suas reações por semana · errado caindo de 2 para 0</small></h2>
      <div class="ar-qs">${linhas}</div>
      <p class="mini">A semana de 31/08 a 06/09 falhou e não tem reações.</p>
    </section>`;
  }

  function relatorio(sem) {
    montarFatos(sem);
    const atual = sem === 5;
    const semTexto = atual && estado === 'naopassou';
    let corpo = cabecalho(sem);
    if (atual && !semTexto) corpo += leitura(blocosLeitura()[0]);
    if (!atual) corpo += `<section class="bloco"><h2>Resumo da semana</h2><div class="ar-leitura"><div class="ar-leitura__rotulo">Leitura do Argo</div><p class="mini">No sistema de verdade aqui aparece o texto desta semana exatamente como foi publicado. O protótipo só tem o texto da semana mais recente.</p></div></section>`;
    corpo += painelFunis(sem);
    if (atual) {
      const blocos = blocosLeitura();
      corpo += oQueFoiFeito();
      if (!semTexto) corpo += leitura(blocos[1]);
      corpo += testesCalculados();
      if (!semTexto) corpo += leitura(blocos[2]) + sugestoes() + leitura(blocos[3]);
      corpo += qualidade();
      corpo += `<p class="ar-rodape"><button type="button" class="ar-link" data-ar-checagem>Registro de checagem desta semana</button></p>`;
    }
    return corpo;
  }

  function historico() {
    return `<section class="bloco"><h2>Histórico <small>da semana mais recente para trás</small></h2>
      <div class="tabela-wrap"><table>
        <thead><tr><th>Semana</th><th>Gerado</th><th>Situação</th><th></th></tr></thead>
        <tbody>${SEMANAS.map((s, i) => i).reverse().map((i) => {
          const s = SEMANAS[i];
          const sit = i === 5 ? situacaoAtual() : s.situacao;
          const linhas = [`<tr><td><b>${s.de} a ${s.ate}</b>${s.atipica ? ' <span class="mini">atípica</span>' : ''}</td><td>${esc(s.gerado)}</td><td>${carimbo(SITUACAO, sit)}</td>
            <td>${sit === 'falhou' ? `<span class="mini">${esc(s.motivo)}</span>` : `<button type="button" class="ar-link" data-ar-abrir="${i}">abrir</button>`}</td></tr>`];
          if (s.substituida) linhas.push(`<tr class="ar-substituida"><td class="mini">versão anterior</td><td>${esc(s.substituida)}</td><td>${carimbo(SITUACAO, 'substituida')}</td><td><button type="button" class="ar-link" data-ar-abrir-antiga="${i}">abrir</button></td></tr>`);
          return linhas.join('');
        }).join('')}</tbody>
      </table></div>
    </section>`;
  }

  function comparacao() {
    const [a, b] = comparar;
    const opcoes = (sel) => SEMANAS.map((s, i) => s.situacao === 'falhou' ? '' : `<option value="${i}"${i === sel ? ' selected' : ''}>${s.de} a ${s.ate}</option>`).join('');
    const iguais = a === b;
    const tab = iguais ? '<p class="aviso">Escolha duas semanas diferentes.</p>' : FUNIS.map((f) => {
      const na = numeros(f, [a]); const nb = numeros(f, [b]);
      return `<article class="ar-funil"><h3>${esc(f.nome)}</h3>
        <div class="tabela-wrap"><table class="ar-comp">
          <thead><tr><th>Métrica</th><th class="num">${SEMANAS[a].de}</th><th class="num">${SEMANAS[b].de}</th><th class="num">Diferença</th></tr></thead>
          <tbody>${METRICAS.map((m) => {
            const x = na[m.id]; const y = nb[m.id];
            const d = x ? (y - x) / x : 0;
            let cls = 'neutro';
            if (m.menorMelhor != null && Math.abs(d) >= 0.05) cls = (m.menorMelhor ? d < 0 : d > 0) ? 'alta' : 'queda';
            return `<tr><td>${m.nome}</td><td class="num">${m.fmt(x)}</td><td class="num">${m.fmt(y)}</td><td class="num"><span class="delta ${cls === 'alta' ? 'up' : cls === 'queda' ? 'down' : 'neutro'}">${d >= 0 ? '▲' : '▼'} ${pct(Math.abs(d) * 100, 0)}</span></td></tr>`;
          }).join('')}</tbody>
        </table></div></article>`;
    }).join('');
    return `<section class="bloco"><h2>Comparar semanas</h2>
      <div class="ar-comp-esc">
        <label>Semana A <select data-ar-comp="0">${opcoes(a)}</select></label>
        <label>Semana B <select data-ar-comp="1">${opcoes(b)}</select></label>
      </div>
      <div class="ar-funis">${tab}</div>
    </section>`;
  }

  function desenhar() {
    if (!raizAtual) return;
    esconderBalao();
    let corpo = '';
    if (modo === 'historico' && !semHistorico()) corpo = historico();
    else if (modo === 'comparar' && !semHistorico()) corpo = comparacao();
    else { modo = 'relatorio'; corpo = relatorio(semanaAberta); }
    const voltar = modo === 'relatorio' && semanaAberta !== 5
      ? '<p><button type="button" class="ar-link" data-ar-voltar>← voltar para a semana mais recente</button></p>' : '';
    raizAtual.innerHTML = seloProto() + navegacao() + voltar + corpo;
  }

  function abrirPacote() {
    montarFatos(semanaAberta);
    const grupos = [...new Set(ORDEM.map((k) => FATOS[k].grupo))];
    const corpo = `<input type="search" class="ar-pacote__busca" placeholder="Procurar por etiqueta ou nome (ex.: F12, CPL, ad13)" aria-label="Procurar no pacote de fatos">
      <div class="ar-pacote">${grupos.map((g) => `<section data-grupo>
        <h3 class="argo-grupo-titulo">${esc(g)}</h3>
        ${ORDEM.filter((k) => FATOS[k].grupo === g).map((k) => {
          const f = FATOS[k];
          return `<div class="ar-pacote__fato" data-busca="${esc((f.id + ' ' + f.nome + ' ' + (f.texto || '')).toLowerCase())}">
            <span class="ar-pacote__id">${f.id}</span>
            <span class="ar-pacote__nome">${esc(f.nome)}${f.pequena ? ' <span class="carimbo neutro">amostra pequena</span>' : ''}${f.fora ? ' <span class="carimbo queda">indisponível</span>' : ''}${f.vencido ? ' <span class="carimbo alerta">vencido</span>' : ''}</span>
            <span class="ar-pacote__valor">${esc(valorFato(f))}</span>
          </div>`;
        }).join('')}
      </section>`).join('')}</div>`;
    const g = gaveta({ titulo: 'Pacote de fatos', sub: `Semana de ${SEMANAS[semanaAberta].de} a ${SEMANAS[semanaAberta].ate} · ${ORDEM.length} fatos · é tudo o que a análise pôde ver`, corpo });
    const busca = g.querySelector('.ar-pacote__busca');
    busca.oninput = () => {
      const q = busca.value.trim().toLowerCase();
      g.querySelectorAll('.ar-pacote__fato').forEach((el) => { el.hidden = q && !el.dataset.busca.includes(q); });
      g.querySelectorAll('[data-grupo]').forEach((sec) => { sec.hidden = ![...sec.querySelectorAll('.ar-pacote__fato')].some((el) => !el.hidden); });
    };
  }

  function abrirChecagem() {
    const tentativas = CHECAGEM[estado];
    const final = { verificada: 'Publicada como verificada.', primeira: 'Publicada como verificada.', fontes: 'Publicada como verificada, sem nada sobre MQLs.',
      parcial: 'Publicada como parcial: o bloco reprovado foi removido.', naopassou: 'Publicada só a parte calculada.' }[estado];
    const corpo = `<p class="mini">Regras: números, citações, formato, amostra, leitura antecipada, causa sem veredito, semana atípica, fonte indisponível e restrição.</p>
      ${tentativas.map((t) => `<section class="ar-chec">
        <h3>Tentativa ${t.tentativa} ${t.resultado === 'passou' ? '<span class="carimbo alta">passou</span>' : '<span class="carimbo queda">reprovou</span>'}</h3>
        ${t.violacoes.length ? `<ul>${t.violacoes.map((x) => `<li><b>${esc(x.regra)}</b> · ${esc(x.trecho)}<br><span class="mini">${esc(x.motivo)}</span></li>`).join('')}</ul>` : '<p class="mini">Nenhuma violação.</p>'}
      </section>`).join('')}
      <p><b>${esc(final)}</b></p>`;
    gaveta({ titulo: 'Registro de checagem', sub: `Semana de ${SEMANAS[5].de} a ${SEMANAS[5].ate}`, corpo });
  }

  // ---------------------------------------------------------------------------
  // Eventos
  // ---------------------------------------------------------------------------
  function ligar(raiz) {
    raiz.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.matches('[data-ar-estado]')) {
        estado = t.value; semanaAberta = 5;
        if (semHistorico()) modo = 'relatorio';
        desenhar();
        avisar(`Mostrando: ${ESTADOS.find((e) => e[0] === estado)[1].toLowerCase()}.`);
      } else if (t.matches('[data-ar-comp]')) {
        comparar[Number(t.dataset.arComp)] = Number(t.value);
        desenhar();
      }
    });
    raiz.addEventListener('submit', (ev) => {
      const form = ev.target.closest('[data-ar-form]');
      if (!form) return;
      ev.preventDefault();
      const chave = form.dataset.arForm;
      const texto = form.querySelector('textarea').value.trim();
      const r = reacoes[chave] || {};
      if (r.pedindo === 'errado' && !texto) { avisar('Diga o que está errado para marcar este trecho.'); return; }
      if (r.pedindo === 'errado') r.tipo = 'errado';
      r.comentario = texto; r.pedindo = null;
      reacoes[chave] = r;
      desenhar();
      avisarProto('No sistema de verdade isto entra no relatório da semana que vem.');
    });
    raiz.addEventListener('click', (ev) => {
      const t = ev.target.closest('button');
      if (!t || !raiz.contains(t)) return;
      const d = t.dataset;
      if (d.arModo) { modo = d.arModo; if (modo === 'relatorio') semanaAberta = 5; desenhar(); }
      else if ('arPacote' in d) abrirPacote();
      else if ('arChecagem' in d) abrirChecagem();
      else if ('arGerar' in d) avisarProto('No sistema de verdade isto refaz a semana e guarda esta versão como substituída.');
      else if ('arVoltar' in d) { semanaAberta = 5; desenhar(); }
      else if (d.arAbrir) { semanaAberta = Number(d.arAbrir); modo = 'relatorio'; desenhar(); window.scrollTo({ top: raiz.offsetTop - 20 }); }
      else if (d.arAbrirAntiga) avisarProto('No sistema de verdade isto abre a versão substituída como foi publicada.');
      else if (d.arTeste) avisarProto('No sistema de verdade isto abre a ficha do teste no registro (protótipo 401).');
      else if (d.arReagir) {
        const r = reacoes[d.bloco] || {};
        if (d.arReagir === 'errado') { r.pedindo = 'errado'; reacoes[d.bloco] = r; desenhar(); focar(d.bloco); return; }
        r.tipo = r.tipo === d.arReagir ? null : d.arReagir; r.pedindo = null;
        reacoes[d.bloco] = r;
        desenhar();
        if (r.tipo) avisarProto(`Trecho marcado como ${r.tipo === 'util' ? 'útil' : 'óbvio'}.`);
      } else if (d.arComentar) { const r = reacoes[d.arComentar] || {}; r.pedindo = 'livre'; reacoes[d.arComentar] = r; desenhar(); focar(d.arComentar); }
      else if (d.arCancelar) { reacoes[d.arCancelar].pedindo = null; desenhar(); }
      else if (d.arContexto) avisarProto('No sistema de verdade isto abre um item novo no contexto do negócio, já preenchido com o comentário.');
      else if (d.arVirar) avisarProto('No sistema de verdade isto cria um teste planejado no registro, com a ficha preenchida.');
      else if (d.arDescartar) pedirMotivo(d.arDescartar);
      else if (d.arConfDescarte) {
        const caixa = t.closest('[data-sug]');
        const motivo = caixa.querySelector('input').value.trim();
        if (!motivo) { avisar('Escreva o motivo do descarte.'); return; }
        descartes[d.arConfDescarte] = motivo;
        desenhar();
        avisarProto('O motivo entra no pacote da semana que vem.');
      } else if (d.arCancDescarte) desenhar();
    });
    // Citações: mouse e foco mostram; clique (toque) alterna.
    raiz.addEventListener('mouseover', (ev) => { const c = ev.target.closest('.ar-cita'); if (c && !window.matchMedia('(max-width: 640px)').matches) mostrarBalao(c); });
    raiz.addEventListener('mouseout', (ev) => { const c = ev.target.closest('.ar-cita'); if (c && !c.contains(ev.relatedTarget)) esconderBalao(); });
    raiz.addEventListener('focusin', (ev) => { const c = ev.target.closest('.ar-cita'); if (c) mostrarBalao(c); });
    raiz.addEventListener('focusout', (ev) => { if (ev.target.closest('.ar-cita')) esconderBalao(); });
    raiz.addEventListener('click', (ev) => {
      const c = ev.target.closest('.ar-cita');
      if (!c) return;
      ev.stopPropagation();
      if (balaoDono === c && !balao().hidden) esconderBalao(); else mostrarBalao(c);
    });
    document.addEventListener('click', (ev) => { if (!ev.target.closest('.ar-cita') && !ev.target.closest('#ar-balao')) esconderBalao(); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') esconderBalao(); });
    window.addEventListener('scroll', () => { if (balaoDono && !balao().classList.contains('ar-balao--folha')) esconderBalao(); }, { passive: true });
  }

  function focar(chave) {
    const ta = raizAtual && raizAtual.querySelector(`#ar-c-${chave}`);
    if (ta) ta.focus();
  }

  function pedirMotivo(id) {
    const caixa = raizAtual.querySelector(`[data-sug="${id}"]`);
    if (!caixa) return;
    caixa.innerHTML = `<label class="mini" for="ar-m-${id}">Por que descartar? (entra na semana que vem)</label>
      <input id="ar-m-${id}" type="text" maxlength="200" placeholder="Ex.: já testamos gancho de dor em julho">
      <div class="ar-reacao__acoes"><button type="button" class="btn" data-ar-conf-descarte="${id}">Descartar</button><button type="button" class="btn sec" data-ar-canc-descarte="${id}">Cancelar</button></div>`;
    caixa.querySelector('input').focus();
  }

  window.ArgoRelatorio = {
    abrir(raiz) {
      if (raizAtual === raiz) return;
      raizAtual = raiz;
      ligar(raiz);
      desenhar();
    },
  };
})();
