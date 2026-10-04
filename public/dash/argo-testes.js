// Registro de testes do Argo (spec-relatorio-semanal-argo.md, módulo 2). PROTÓTIPO da issue 401.
//
// Só front, com testes de exemplo gerados aqui: nada chama a API, nada é salvo.
// Mora na aba Argo, vista `#argo?v=testes`; o index.html só chama
// `ArgoTestes.abrir(raiz)` quando a vista aparece.
//
// No sistema de verdade os números de cada lado, o indicador de leitura e a
// passagem para "pronto para ler" vêm prontos do servidor (issue 404). Aqui
// são montados no navegador só porque não existe servidor ainda.
//
// Padrões copiados do argo-contexto.js: faixa "Protótipo" (CSS em-proto*),
// aviso curto (CSS ag-toast), gaveta (CSS ag-gaveta, ag-campo) e tipos em
// cartão (CSS ac-tipo).
(() => {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const int = (n) => Number(n || 0).toLocaleString('pt-BR');
  const HOJE = '2026-10-04';
  const dias = (de, ate = HOJE) => Math.round((Date.parse(ate) - Date.parse(de)) / 86400000);
  const dataBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

  const TIPOS = {
    criativo: { rotulo: 'Criativo', exemplo: 'Gancho, formato ou copy do anúncio.' },
    publico: { rotulo: 'Público ou conjunto', exemplo: 'Segmentação, Advantage+, estrutura de campanha.' },
    pagina: { rotulo: 'Página', exemplo: 'Teste A/B de LP que já existe no dash.' },
    oferta: { rotulo: 'Oferta ou funil', exemplo: 'Isca, pergunta no formulário, corte de faturamento.' },
  };
  const SITUACOES = {
    planejado: ['Planejado', 'neutro'], rodando: ['Rodando', 'neutro'], pronto: ['Pronto para ler', 'alerta'],
    concluido: ['Concluído', 'alta'], abandonado: ['Abandonado', 'queda'],
  };
  const RESULTADOS = { variante: 'Variante ganhou', controle: 'Controle ganhou', empate: 'Empate', inconclusivo: 'Inconclusivo' };
  const FUNIS = ['Sessão estratégica', 'Workshop gratuito', 'Workshop pago', 'Aplicação mentoria'];

  // O que existe na conta para escolher (exemplo).
  const ALVOS = [
    { id: 'ad09', nome: 'ad09_pergunta-se_reels', tipo: 'anúncio', funil: 'Sessão estratégica' },
    { id: 'ad11', nome: 'ad11_numero-se_reels', tipo: 'anúncio', funil: 'Sessão estratégica' },
    { id: 'ad15', nome: 'ad15_reels-wg_bastidores', tipo: 'anúncio', funil: 'Workshop gratuito' },
    { id: 'ad16', nome: 'ad16_carrossel-wg_prova', tipo: 'anúncio', funil: 'Workshop gratuito' },
    { id: 'ad20', nome: 'ad20_video-wp_felipe', tipo: 'anúncio', funil: 'Workshop pago' },
    { id: 'ad21', nome: 'ad21_img-wp_preco', tipo: 'anúncio', funil: 'Workshop pago' },
    { id: 'cj1', nome: 'SE | Lookalike 2%', tipo: 'conjunto', funil: 'Sessão estratégica' },
    { id: 'cj2', nome: 'SE | Interesses atacado', tipo: 'conjunto', funil: 'Sessão estratégica' },
    { id: 'cj3', nome: 'WG | Advantage+', tipo: 'conjunto', funil: 'Workshop gratuito' },
    { id: 'cj4', nome: 'WG | Interesses atacado', tipo: 'conjunto', funil: 'Workshop gratuito' },
  ];
  const ABS = [
    { id: 'ab1', nome: '/workshop-gratuito selos x stories', a: ['A: selos', 1204, 17.9], b: ['B: stories', 1188, 21.4] },
    { id: 'ab2', nome: '/se-v2 x /se-v3', a: ['A: /se-v2', 640, 6.1], b: ['B: /se-v3', 652, 6.4] },
  ];
  const nomeAlvo = (id) => (ALVOS.find((a) => a.id === id) || { nome: id }).nome;

  const TESTES_EXEMPLO = () => [
    { id: 1, nome: 'Gancho com pergunta x gancho com número', tipo: 'criativo', funil: 'Sessão estratégica', situacao: 'rodando', inicio: '2026-09-25', origem: 'gestora',
      hipotese: 'Acreditamos que abrir com uma pergunta traz MQL mais barato que abrir com um número, porque o público de atacado reage a dor e não a promessa.',
      mudou: 'Mesmo vídeo, só a primeira frase muda.', controle: ['ad11'], variante: ['ad09'], metrica: 'Custo por MQL', criterio: 'Variante com custo por MQL 15% menor',
      minDias: 14, minAmostra: 80, numeros: { controle: [28, 7, 'R$ 141,00'], variante: [31, 9, 'R$ 118,20'] },
      historico: [['25/09', 'Teste registrado e iniciado.'], ['26/09', 'Critério mudou de "custo por MQL 10% menor" para "15% menor".', true]] },
    { id: 2, nome: '/workshop-gratuito selos x stories', tipo: 'pagina', funil: 'Workshop gratuito', situacao: 'pronto', inicio: '2026-09-14', origem: 'gestora', ab: 'ab1',
      hipotese: 'Acreditamos que prova social em stories converte mais que selos, porque mostra gente real do atacado.',
      mudou: 'Bloco de prova social da LP.', metrica: 'Conversão da página', criterio: 'B com 2 pontos a mais de conversão',
      minDias: 14, minAmostra: 1000, historico: [['14/09', 'Teste registrado e iniciado.'], ['04/10', 'Atingiu os mínimos: pronto para ler.']] },
    { id: 3, nome: 'Lookalike 2% x Interesses', tipo: 'publico', funil: 'Sessão estratégica', situacao: 'concluido', inicio: '2026-09-07', fim: '2026-10-02', origem: 'gestora',
      hipotese: 'Acreditamos que o Lookalike 2% dos MQLs traz CPL menor que interesses, porque o pixel já tem volume de MQL.',
      mudou: 'Mesmo criativo em dois conjuntos.', controle: ['cj2'], variante: ['cj1'], metrica: 'CPL', criterio: 'Lookalike com CPL 10% menor',
      minDias: 14, minAmostra: 60, numeros: { controle: [41, 12, 'R$ 39,10'], variante: [53, 19, 'R$ 31,80'] },
      resultado: 'variante', aprendizado: 'Lookalike de MQL bateu interesses com folga (CPL 19% menor). Próximo passo: testar lookalike 1% contra 2%.',
      historico: [['07/09', 'Teste registrado e iniciado.'], ['02/10', 'Concluído: variante ganhou.']] },
    { id: 4, nome: 'Pergunta de faturamento no formulário', tipo: 'oferta', funil: 'Workshop gratuito', situacao: 'planejado', origem: 'relatorio',
      hipotese: 'Acreditamos que perguntar o faturamento no formulário do workshop gratuito melhora a taxa de MQL, porque o custo por MQL subiu com o CPL estável.',
      mudou: 'Uma pergunta de faixa de faturamento na versão B do formulário.', controle: ['cj3'], variante: ['cj3'], metrica: 'Taxa de MQL', criterio: 'Taxa de MQL 3 pontos maior sem CPL subir mais que 10%',
      minDias: 14, minAmostra: 300, historico: [['05/10', 'Criado a partir do teste proposto 2 do relatório de 28/09 a 04/10.']] },
    { id: 5, nome: 'Vídeo do Felipe x imagem com preço', tipo: 'criativo', funil: 'Workshop pago', situacao: 'rodando', inicio: '2026-10-01', origem: 'gestora',
      hipotese: 'Acreditamos que o vídeo do Felipe vende mais ingresso que a imagem com preço, porque o workshop pago depende de confiança.',
      mudou: 'Formato e mensagem.', controle: ['ad21'], variante: ['ad20'], metrica: 'CPL', criterio: 'Vídeo com CPL 15% menor',
      minDias: 14, minAmostra: 60, numeros: { controle: [7, 2, 'R$ 27,40'], variante: [5, 1, 'R$ 31,00'] }, historico: [['01/10', 'Teste registrado e iniciado.']] },
    { id: 6, nome: 'Advantage+ x interesses no workshop gratuito', tipo: 'publico', funil: 'Workshop gratuito', situacao: 'abandonado', inicio: '2026-08-18', fim: '2026-08-27', origem: 'gestora',
      hipotese: 'Acreditamos que o Advantage+ acha público mais barato que interesses.', mudou: 'Conjunto Advantage+ contra conjunto de interesses.', controle: ['cj4'], variante: ['cj3'],
      metrica: 'CPL', criterio: 'Advantage+ com CPL 10% menor', minDias: 14, minAmostra: 300, motivo: 'A verba do funil foi cortada no meio do teste.',
      historico: [['18/08', 'Teste registrado e iniciado.'], ['27/08', 'Abandonado: a verba do funil foi cortada no meio do teste.']] },
    { id: 7, nome: 'Gancho de dor x gancho de autoridade', tipo: 'criativo', funil: 'Sessão estratégica', situacao: 'concluido', inicio: '2026-07-20', fim: '2026-08-08', origem: 'gestora',
      hipotese: 'Acreditamos que gancho de dor traz MQL mais barato que autoridade.', mudou: 'Primeira frase do anúncio.', controle: ['ad11'], variante: ['ad09'],
      metrica: 'Custo por MQL', criterio: 'Dor com custo por MQL 15% menor', minDias: 14, minAmostra: 60, numeros: { controle: [38, 11, 'R$ 125,00'], variante: [35, 9, 'R$ 148,00'] },
      resultado: 'controle', aprendizado: 'Em julho, autoridade ganhou de dor. Mas o público era só interesses; vale repetir no Lookalike.',
      historico: [['20/07', 'Teste registrado e iniciado.'], ['08/08', 'Concluído: controle ganhou.']] },
    { id: 8, nome: '/se-v2 x /se-v3', tipo: 'pagina', funil: 'Sessão estratégica', situacao: 'concluido', inicio: '2026-08-25', fim: '2026-09-15', origem: 'gestora', ab: 'ab2',
      hipotese: 'Acreditamos que o hero com foto converte mais.', mudou: 'Hero da página.', metrica: 'Conversão da página', criterio: 'B com 1 ponto a mais',
      minDias: 14, minAmostra: 600, resultado: 'empate', aprendizado: 'Diferença de 0,3 ponto, dentro do ruído. Ficamos com a v2, que é mais leve.',
      historico: [['25/08', 'Teste registrado e iniciado.'], ['15/09', 'Concluído: empate.']] },
  ];

  let testes = TESTES_EXEMPLO();
  let estado = 'com';
  const filtros = { situacao: 'todos', tipo: '', funil: '', periodo: 'tudo', busca: '' };
  let raizAtual = null;
  let proximoId = 100;

  // Amostra: leads nos testes de conta, visitas nos de página.
  const unidade = (t) => (t.tipo === 'pagina' ? 'visitas' : 'leads');
  function progresso(t) {
    const d = t.inicio ? dias(t.inicio) : 0;
    let amostra = 0;
    if (t.tipo === 'pagina' && t.ab) { const ab = ABS.find((x) => x.id === t.ab); amostra = Math.min(ab.a[1], ab.b[1]); }
    else if (t.numeros) amostra = t.numeros.controle[0] + t.numeros.variante[0];
    return { d, amostra, faltaDias: Math.max(0, t.minDias - d), faltaAmostra: Math.max(0, t.minAmostra - amostra) };
  }

  // ---------------------------------------------------------------------------
  // Aviso curto e gaveta (mesmo desenho do argo-contexto.js)
  // ---------------------------------------------------------------------------
  let toastTempo = null;
  function avisar(texto) {
    let t = document.getElementById('at-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'at-toast';
      t.className = 'ag-toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
    }
    const g = document.getElementById('at-gaveta');
    (g && g.open ? g : document.body).appendChild(t);
    t.textContent = texto;
    void t.offsetWidth;
    t.classList.add('visivel');
    clearTimeout(toastTempo);
    toastTempo = setTimeout(() => t.classList.remove('visivel'), 3200);
  }
  const avisarProto = (texto) => avisar(`Protótipo: nada foi salvo. ${texto}`);

  function gaveta(html) {
    let g = document.getElementById('at-gaveta');
    if (!g) {
      g = document.createElement('dialog');
      g.id = 'at-gaveta';
      g.className = 'ag-gaveta em-gaveta em-gaveta--larga';
      g.addEventListener('click', (ev) => { if (ev.target === g) g.close(); });
      document.body.appendChild(g);
    }
    g.innerHTML = html;
    g.querySelectorAll('[data-fechar]').forEach((b) => { b.onclick = () => g.close(); });
    if (!g.open) g.showModal();
    return g;
  }
  const topo = (titulo, sub) => `<header class="ag-gaveta__topo"><div><h2>${titulo}</h2>${sub ? `<p class="mini">${sub}</p>` : ''}</div>
    <button class="ag-gaveta__fechar" type="button" data-fechar aria-label="Fechar">×</button></header>`;

  // ---------------------------------------------------------------------------
  // Ficha
  // ---------------------------------------------------------------------------
  function regua(rotulo, feito, total, unid) {
    const p = Math.min(100, Math.round((feito / total) * 100));
    return `<div class="at-regua"><span class="at-regua__rot">${rotulo}</span><span class="at-regua__barra"><i style="width:${p}%"></i></span><span class="at-regua__num">${int(feito)} de ${int(total)} ${unid}</span></div>`;
  }
  function leitura(t) {
    if (!['rodando', 'pronto'].includes(t.situacao)) return '';
    const p = progresso(t);
    const falta = t.situacao === 'pronto' ? '<b>Atingiu os mínimos: dá para ler.</b>'
      : `Faltam ${[p.faltaDias ? `${p.faltaDias} ${p.faltaDias === 1 ? 'dia' : 'dias'}` : '', p.faltaAmostra ? `${int(p.faltaAmostra)} ${unidade(t)}` : ''].filter(Boolean).join(' e ')} para ler.`;
    return `<div class="at-leitura">${regua('Dias', Math.min(p.d, t.minDias), t.minDias, 'dias')}${regua(unidade(t) === 'leads' ? 'Leads' : 'Visitas', Math.min(p.amostra, t.minAmostra), t.minAmostra, unidade(t))}<p class="mini">${falta}</p></div>`;
  }

  function lados(t) {
    if (t.tipo === 'pagina') {
      const ab = ABS.find((x) => x.id === t.ab);
      if (!ab) return '<p class="mini">Nenhum A/B ligado.</p>';
      const lado = ([n, v, c]) => `<div class="at-lado"><b>${esc(n)}</b><span>${int(v)} visitas · ${c.toLocaleString('pt-BR')}% de conversão</span></div>`;
      return `<p class="mini">Ligado ao A/B <b>${esc(ab.nome)}</b> · <button type="button" class="ar-link" data-at-ab>abrir no A/B</button></p><div class="at-lados">${lado(ab.a)}${lado(ab.b)}</div>`;
    }
    const lado = (rot, ids, n) => `<div class="at-lado"><b>${rot}</b><span>${ids.map((i) => esc(nomeAlvo(i))).join(', ')}</span>${n ? `<span class="mini">${int(n[0])} leads · ${int(n[1])} MQLs · ${esc(n[2])}</span>` : ''}</div>`;
    return `<div class="at-lados">${lado('Controle', t.controle || [], t.numeros && t.numeros.controle)}${lado('Variante', t.variante || [], t.numeros && t.numeros.variante)}</div>`;
  }

  function abrirFicha(t, modo = '') {
    const [rot, cls] = SITUACOES[t.situacao];
    const acoes = {
      planejado: [['iniciar', 'Iniciar', 'btn'], ['editar', 'Editar', 'btn sec'], ['abandonar', 'Abandonar', 'btn perigo']],
      rodando: [['concluir', 'Concluir', 'btn'], ['editar', 'Editar', 'btn sec'], ['abandonar', 'Abandonar', 'btn perigo']],
    };
    acoes.pronto = acoes.rodando;
    let rodape = (acoes[t.situacao] || []).map(([a, r, c]) => `<button type="button" class="${c}" data-at-acao="${a}">${r}</button>`).join('');
    if (modo === 'concluir') {
      rodape = `<form class="at-mini-form" data-at-concluir>
        <fieldset class="at-resultados"><legend class="ag-campo__rotulo">Resultado</legend>${Object.entries(RESULTADOS).map(([k, r], i) => `<label><input type="radio" name="resultado" value="${k}"${i === 0 ? ' checked' : ''}> ${r}</label>`).join('')}</fieldset>
        <label class="ag-campo"><span class="ag-campo__rotulo">O que aprendemos (obrigatório)</span><textarea name="aprendizado" rows="3" placeholder="Ex.: pergunta ganhou de número no Lookalike; repetir em interesses."></textarea><span class="ac-erro" data-erro hidden>Escreva o aprendizado: é o que o relatório usa para não repetir o teste.</span></label>
        <div class="ac-rodape"><button type="submit" class="btn">Concluir teste</button><button type="button" class="btn sec" data-at-acao="voltar">Cancelar</button></div></form>`;
    } else if (modo === 'abandonar') {
      rodape = `<form class="at-mini-form" data-at-abandonar>
        <label class="ag-campo"><span class="ag-campo__rotulo">Por que abandonar? (obrigatório)</span><input type="text" name="motivo" maxlength="200" placeholder="Ex.: a verba do funil foi cortada"><span class="ac-erro" data-erro hidden>Escreva o motivo.</span></label>
        <div class="ac-rodape"><button type="submit" class="btn perigo">Abandonar teste</button><button type="button" class="btn sec" data-at-acao="voltar">Cancelar</button></div></form>`;
    }
    const campo = (r, v) => (v ? `<dt>${r}</dt><dd>${v}</dd>` : '');
    const g = gaveta(`<div class="ag-gaveta__form ag-gaveta__form--simples">
      ${topo(esc(t.nome), `${TIPOS[t.tipo].rotulo} · ${esc(t.funil)} · ${t.inicio ? `desde ${dataBR(t.inicio)}` : 'ainda não começou'}${t.fim ? ` até ${dataBR(t.fim)}` : ''}`)}
      <div class="ag-gaveta__corpo at-ficha">
        <div class="at-ficha__sit"><span class="carimbo ${cls}">${rot}</span>${t.origem === 'relatorio' ? '<span class="carimbo neutro">sugerido pelo relatório</span>' : ''}${t.resultado ? `<span class="carimbo alta">${RESULTADOS[t.resultado]}</span>` : ''}</div>
        ${leitura(t)}
        <p class="at-ficha__hip">${esc(t.hipotese)}</p>
        <dl class="ar-sug__ficha">
          ${campo('O que muda', esc(t.mudou))}
          ${campo('Métrica', esc(t.metrica))}
          ${campo('Sucesso', esc(t.criterio))}
          ${campo('Mínimos', `${t.minDias} dias e ${int(t.minAmostra)} ${unidade(t)}`)}
        </dl>
        <h3 class="argo-grupo-titulo">Os dois lados</h3>${lados(t)}
        ${t.aprendizado ? `<h3 class="argo-grupo-titulo">Aprendizado</h3><p class="at-ficha__aprend">${esc(t.aprendizado)}</p>` : ''}
        ${t.motivo ? `<h3 class="argo-grupo-titulo">Por que foi abandonado</h3><p>${esc(t.motivo)}</p>` : ''}
        <h3 class="argo-grupo-titulo">Histórico da ficha</h3>
        <ul class="at-hist">${t.historico.map(([d, txt, destaque]) => `<li${destaque ? ' class="at-hist--destaque"' : ''}><span class="at-hist__data">${d}</span>${esc(txt)}</li>`).join('')}</ul>
      </div>
      ${rodape ? `<footer class="ag-gaveta__rodape"><div class="ac-rodape">${rodape}</div></footer>` : ''}
    </div>`);
    g.onclick = (ev) => {
      if (ev.target === g) { g.close(); return; }
      const b = ev.target.closest('[data-at-acao]');
      if (b) {
        const a = b.dataset.atAcao;
        if (a === 'iniciar') { t.situacao = 'rodando'; t.inicio = HOJE; t.numeros = { controle: [0, 0, 'sem dados'], variante: [0, 0, 'sem dados'] }; t.historico.push([dataBR(HOJE), 'Teste iniciado.']); desenhar(); abrirFicha(t); avisarProto('O teste passou a rodando, com início hoje.'); }
        else if (a === 'editar') abrirFormulario(t);
        else if (a === 'voltar') abrirFicha(t);
        else abrirFicha(t, a);
      }
      if (ev.target.closest('[data-at-ab]')) avisarProto('No sistema de verdade isto abre o teste na aba de A/B.');
    };
    const fc = g.querySelector('[data-at-concluir]');
    if (fc) fc.onsubmit = (ev) => {
      ev.preventDefault();
      const d = Object.fromEntries(new FormData(fc));
      const erro = fc.querySelector('[data-erro]');
      erro.hidden = !!d.aprendizado.trim();
      if (!erro.hidden) return;
      Object.assign(t, { situacao: 'concluido', resultado: d.resultado, aprendizado: d.aprendizado.trim(), fim: HOJE });
      t.historico.push([dataBR(HOJE), `Concluído: ${RESULTADOS[d.resultado].toLowerCase()}.`]);
      desenhar(); abrirFicha(t); avisarProto('O aprendizado entra no pacote da próxima semana.');
    };
    const fa = g.querySelector('[data-at-abandonar]');
    if (fa) fa.onsubmit = (ev) => {
      ev.preventDefault();
      const motivo = new FormData(fa).get('motivo').trim();
      const erro = fa.querySelector('[data-erro]');
      erro.hidden = !!motivo;
      if (!motivo) return;
      Object.assign(t, { situacao: 'abandonado', motivo, fim: HOJE });
      t.historico.push([dataBR(HOJE), `Abandonado: ${motivo}`]);
      desenhar(); abrirFicha(t); avisarProto('O teste saiu dos ativos e o motivo fica na ficha.');
    };
  }

  // ---------------------------------------------------------------------------
  // Formulário de registro e edição
  // ---------------------------------------------------------------------------
  function abrirFormulario(t) {
    const v = t || { tipo: 'criativo', funil: FUNIS[0], nome: '', hipotese: '', mudou: '', metrica: '', criterio: '', minDias: 14, minAmostra: 60, controle: [], variante: [], ab: '' };
    const marcas = (lado, sel) => `<fieldset class="at-escolha"><legend class="ag-campo__rotulo">${lado === 'controle' ? 'Controle' : 'Variante'}</legend>
      ${ALVOS.map((a) => `<label class="at-escolha__item"><input type="checkbox" name="${lado}" value="${a.id}"${(sel || []).includes(a.id) ? ' checked' : ''}><span>${esc(a.nome)} <span class="mini">${a.tipo} · ${esc(a.funil)}</span></span></label>`).join('')}</fieldset>`;
    const g = gaveta(`<form class="ag-gaveta__form ag-gaveta__form--simples" novalidate data-at-form>
      ${topo(t ? 'Editar teste' : 'Registrar teste', t && t.situacao !== 'planejado' ? 'O teste já começou: mudar hipótese, métrica ou critério fica registrado no histórico.' : 'Hipótese, os dois lados e como se mede.')}
      <div class="ag-gaveta__corpo">
        <label class="ag-campo"><span class="ag-campo__rotulo">Nome</span><input type="text" name="nome" maxlength="120" value="${esc(v.nome)}" placeholder="Ex.: Gancho de dor x autoridade (SE)"><span class="ac-erro" data-erro="nome" hidden>Dê um nome ao teste.</span></label>
        <fieldset class="ac-tipos"><legend class="ag-campo__rotulo">Tipo</legend>
          ${Object.entries(TIPOS).map(([k, x]) => `<label class="ac-tipo"><input type="radio" name="tipo" value="${k}"${k === v.tipo ? ' checked' : ''}${t ? ' disabled' : ''}><span><b>${x.rotulo}</b><span class="mini">${x.exemplo}</span></span></label>`).join('')}
        </fieldset>
        <label class="ag-campo"><span class="ag-campo__rotulo">Funil</span><select name="funil">${FUNIS.map((f) => `<option${f === v.funil ? ' selected' : ''}>${f}</option>`).join('')}</select></label>
        <label class="ag-campo"><span class="ag-campo__rotulo">Hipótese</span><textarea name="hipotese" rows="3" placeholder="Acreditamos que X porque Y.">${esc(v.hipotese)}</textarea><span class="ac-erro" data-erro="hipotese" hidden>Escreva a hipótese.</span></label>
        <label class="ag-campo"><span class="ag-campo__rotulo">O que muda entre os lados</span><input type="text" name="mudou" value="${esc(v.mudou)}"></label>
        <div data-lados-conta${v.tipo === 'pagina' ? ' hidden' : ''}>${marcas('controle', v.controle)}${marcas('variante', v.variante)}<span class="ac-erro" data-erro="lados" hidden>Escolha pelo menos um anúncio ou conjunto em cada lado.</span></div>
        <label class="ag-campo" data-lados-pagina${v.tipo === 'pagina' ? '' : ' hidden'}><span class="ag-campo__rotulo">Teste A/B ligado</span>
          <select name="ab"><option value="">Escolha um A/B do dash</option>${ABS.map((a) => `<option value="${a.id}"${a.id === v.ab ? ' selected' : ''}>${esc(a.nome)}</option>`).join('')}</select><span class="ac-erro" data-erro="ab" hidden>Escolha o A/B.</span></label>
        <label class="ag-campo"><span class="ag-campo__rotulo">Métrica principal</span><input type="text" name="metrica" value="${esc(v.metrica)}" placeholder="Ex.: Custo por MQL"><span class="ac-erro" data-erro="metrica" hidden>Escolha a métrica.</span></label>
        <label class="ag-campo"><span class="ag-campo__rotulo">Critério de sucesso</span><input type="text" name="criterio" value="${esc(v.criterio)}" placeholder="Ex.: variante com custo por MQL 15% menor"></label>
        <div class="ac-datas">
          <label class="ag-campo"><span class="ag-campo__rotulo">Duração mínima (dias)</span><input type="number" name="minDias" min="1" value="${v.minDias}"></label>
          <label class="ag-campo"><span class="ag-campo__rotulo">Amostra mínima (<span data-unid>${v.tipo === 'pagina' ? 'visitas' : 'leads'}</span>)</span><input type="number" name="minAmostra" min="1" value="${v.minAmostra}"></label>
          <p class="mini ac-datas__nota">Padrão das réguas do Argo. O relatório só lê o teste depois dos dois mínimos.</p>
        </div>
        ${t ? '' : `<fieldset class="at-resultados"><legend class="ag-campo__rotulo">Começa</legend><label><input type="radio" name="comeca" value="planejado" checked> Planejado, começo depois</label><label><input type="radio" name="comeca" value="rodando"> Rodando, a partir de hoje</label></fieldset>`}
      </div>
      <footer class="ag-gaveta__rodape"><div class="ac-rodape"><button type="submit" class="btn">${t ? 'Salvar' : 'Registrar teste'}</button><button type="button" class="btn sec" data-fechar>Cancelar</button></div></footer>
    </form>`);
    const form = g.querySelector('[data-at-form]');
    g.onclick = (ev) => { if (ev.target === g) g.close(); };
    form.onchange = (ev) => {
      if (ev.target.name !== 'tipo') return;
      const pag = ev.target.value === 'pagina';
      form.querySelector('[data-lados-conta]').hidden = pag;
      form.querySelector('[data-lados-pagina]').hidden = !pag;
      form.querySelector('[data-unid]').textContent = pag ? 'visitas' : 'leads';
    };
    form.onsubmit = (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const tipo = t ? t.tipo : fd.get('tipo');
      const d = { nome: fd.get('nome').trim(), funil: fd.get('funil'), hipotese: fd.get('hipotese').trim(), mudou: fd.get('mudou').trim(), metrica: fd.get('metrica').trim(),
        criterio: fd.get('criterio').trim(), minDias: Number(fd.get('minDias')) || 14, minAmostra: Number(fd.get('minAmostra')) || 60,
        controle: fd.getAll('controle'), variante: fd.getAll('variante'), ab: fd.get('ab') };
      const erros = { nome: !d.nome, hipotese: !d.hipotese, metrica: !d.metrica,
        lados: tipo !== 'pagina' && (!d.controle.length || !d.variante.length), ab: tipo === 'pagina' && !d.ab };
      Object.entries(erros).forEach(([k, e]) => { form.querySelector(`[data-erro="${k}"]`).hidden = !e; });
      if (Object.values(erros).some(Boolean)) return;
      if (t) {
        if (t.situacao !== 'planejado') {
          [['hipotese', 'Hipótese'], ['metrica', 'Métrica'], ['criterio', 'Critério']].forEach(([k, r]) => {
            if (d[k] !== t[k]) t.historico.push([dataBR(HOJE), `${r} mudou de "${t[k]}" para "${d[k]}".`, true]);
          });
        }
        Object.assign(t, d);
        desenhar(); abrirFicha(t); avisarProto('Ficha atualizada.');
      } else {
        const comeca = fd.get('comeca');
        const novo = { id: ++proximoId, tipo, ...d, situacao: comeca, origem: 'gestora', inicio: comeca === 'rodando' ? HOJE : undefined,
          numeros: comeca === 'rodando' && tipo !== 'pagina' ? { controle: [0, 0, 'sem dados'], variante: [0, 0, 'sem dados'] } : undefined,
          historico: [[dataBR(HOJE), comeca === 'rodando' ? 'Teste registrado e iniciado.' : 'Teste registrado como planejado.']] };
        testes.unshift(novo);
        estado = 'com';
        g.close(); desenhar(); avisarProto(`O teste entrou como ${comeca === 'rodando' ? 'rodando' : 'planejado'}.`);
      }
    };
    form.querySelector('[name="nome"]').focus();
  }

  // ---------------------------------------------------------------------------
  // Lista
  // ---------------------------------------------------------------------------
  function seloProto() {
    return `<div class="em-proto" role="note">
      <span class="em-proto__selo">Protótipo</span>
      <span>Testes de exemplo. Nada aqui é salvo.</span>
      <label class="em-proto__cen">Ver estado
        <select data-at-estado aria-label="Estado de exemplo">
          <option value="com"${estado === 'com' ? ' selected' : ''}>Com testes</option>
          <option value="vazio"${estado === 'vazio' ? ' selected' : ''}>Vazio</option>
        </select></label>
    </div>`;
  }

  function filtrados() {
    const q = filtros.busca.trim().toLowerCase();
    const limite = { '30': 30, '90': 90 }[filtros.periodo];
    return testes.filter((t) => (filtros.situacao === 'todos' || t.situacao === filtros.situacao)
      && (!filtros.tipo || t.tipo === filtros.tipo) && (!filtros.funil || t.funil === filtros.funil)
      && (!limite || !t.inicio || dias(t.inicio) <= limite)
      && (!q || [t.nome, t.hipotese, t.aprendizado || ''].join(' ').toLowerCase().includes(q)));
  }

  function cartao(t) {
    const [rot, cls] = SITUACOES[t.situacao];
    const quando = t.inicio ? `desde ${dataBR(t.inicio)}${['rodando', 'pronto'].includes(t.situacao) ? ` · ${dias(t.inicio)} dias rodando` : ''}${t.fim ? ` até ${dataBR(t.fim)}` : ''}` : 'ainda não começou';
    return `<article class="at-cartao${t.situacao === 'pronto' ? ' at-cartao--pronto' : ''}" data-at-abrir="${t.id}">
      <span class="at-cartao__topo"><span class="mini">${TIPOS[t.tipo].rotulo} · ${esc(t.funil)} · ${quando}</span><span class="carimbo ${cls}">${rot}</span></span>
      <button type="button" class="at-cartao__nome" data-at-abrir="${t.id}">${esc(t.nome)}</button>
      ${t.origem === 'relatorio' ? '<span class="mini">sugerido pelo relatório</span>' : ''}
      ${t.resultado ? `<span class="at-cartao__res">${RESULTADOS[t.resultado]}${t.aprendizado ? `: ${esc(t.aprendizado)}` : ''}</span>` : ''}
      ${t.situacao === 'abandonado' ? `<span class="mini">Abandonado: ${esc(t.motivo)}</span>` : ''}
      ${leitura(t)}
    </article>`;
  }

  function desenhar() {
    if (!raizAtual) return;
    if (estado === 'vazio') {
      raizAtual.innerHTML = `${seloProto()}<div class="ac-topo"><div><h2 class="ac-topo__titulo">Testes</h2><p class="mini">Nenhum teste registrado.</p></div><button type="button" class="btn" data-at-novo>Registrar teste</button></div>
        <div class="ac-vazio"><h3>O registro de testes está vazio</h3>
          <p>Aqui fica a memória do que já foi testado na conta e no funil: hipótese, os dois lados, o resultado e o que se aprendeu. É com isso que o relatório semanal diz "esse teste já pode ser lido" ou "isso já foi testado em julho e perdeu", e evita sugerir de novo o que já deu errado.</p>
          <button type="button" class="btn" data-at-novo>Registrar o primeiro teste</button></div>`;
      return;
    }
    const conta = (s) => testes.filter((t) => t.situacao === s).length;
    const resumo = [['rodando', 'rodando'], ['pronto', 'pronto para ler'], ['planejado', 'planejado'], ['concluido', 'concluídos']]
      .filter(([s]) => conta(s)).map(([s, r]) => `${conta(s)} ${r}`).join(' · ');
    const lista = filtrados();
    const pill = (k, r) => `<button type="button" class="tipo-pill" data-at-sit="${k}" aria-pressed="${filtros.situacao === k}">${r}</button>`;
    raizAtual.innerHTML = `${seloProto()}
      <div class="ac-topo"><div><h2 class="ac-topo__titulo">Testes</h2><p class="mini">${resumo}</p></div><button type="button" class="btn" data-at-novo>Registrar teste</button></div>
      <div class="at-filtros">
        <input type="search" data-at-busca value="${esc(filtros.busca)}" placeholder="Procurar no nome, hipótese ou aprendizado" aria-label="Procurar testes">
        <select data-at-f="tipo" aria-label="Tipo"><option value="">Todos os tipos</option>${Object.entries(TIPOS).map(([k, x]) => `<option value="${k}"${filtros.tipo === k ? ' selected' : ''}>${x.rotulo}</option>`).join('')}</select>
        <select data-at-f="funil" aria-label="Funil"><option value="">Todos os funis</option>${FUNIS.map((f) => `<option${filtros.funil === f ? ' selected' : ''}>${f}</option>`).join('')}</select>
        <select data-at-f="periodo" aria-label="Período"><option value="tudo">Desde sempre</option><option value="30"${filtros.periodo === '30' ? ' selected' : ''}>Começaram nos últimos 30 dias</option><option value="90"${filtros.periodo === '90' ? ' selected' : ''}>Começaram nos últimos 90 dias</option></select>
      </div>
      <div class="ac-filtros" role="group" aria-label="Situação">${pill('todos', 'Todos')}${Object.entries(SITUACOES).map(([k, [r]]) => pill(k, r)).join('')}</div>
      ${lista.length ? `<div class="at-lista">${lista.map(cartao).join('')}</div>`
        : `<p class="aviso">Nenhum teste com esses filtros${filtros.busca ? ` e "${esc(filtros.busca)}"` : ''}. <button type="button" class="ar-link" data-at-limpar>Limpar filtros</button></p>`}`;
  }

  function ligar(raiz) {
    raiz.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.matches('[data-at-estado]')) {
        estado = t.value; testes = estado === 'vazio' ? [] : TESTES_EXEMPLO();
        Object.assign(filtros, { situacao: 'todos', tipo: '', funil: '', periodo: 'tudo', busca: '' });
        desenhar(); avisar(`Mostrando: ${estado === 'vazio' ? 'registro vazio' : 'com testes'}.`);
      } else if (t.matches('[data-at-f]')) { filtros[t.dataset.atF] = t.value; desenhar(); }
    });
    let tempo = null;
    raiz.addEventListener('input', (ev) => {
      if (!ev.target.matches('[data-at-busca]')) return;
      filtros.busca = ev.target.value;
      clearTimeout(tempo);
      tempo = setTimeout(() => {
        const pos = ev.target.selectionStart;
        desenhar();
        const b = raiz.querySelector('[data-at-busca]'); b.focus(); b.setSelectionRange(pos, pos);
      }, 200);
    });
    raiz.addEventListener('click', (ev) => {
      // O cartão inteiro abre a ficha; o nome é o botão para teclado e leitor de tela.
      const b = ev.target.closest('button') || ev.target.closest('[data-at-abrir]');
      if (!b || !raiz.contains(b)) return;
      const d = b.dataset;
      if ('atNovo' in d) abrirFormulario(null);
      else if (d.atSit) { filtros.situacao = d.atSit; desenhar(); }
      else if (d.atAbrir) abrirFicha(testes.find((t) => t.id === Number(d.atAbrir)));
      else if ('atLimpar' in d) { Object.assign(filtros, { situacao: 'todos', tipo: '', funil: '', periodo: 'tudo', busca: '' }); desenhar(); }
    });
  }

  window.ArgoTestes = {
    abrir(raiz) {
      if (raizAtual === raiz) return;
      raizAtual = raiz;
      ligar(raiz);
      desenhar();
    },
  };
})();
