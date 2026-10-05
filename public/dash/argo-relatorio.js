// Relatório semanal do Argo (spec-relatorio-semanal-argo.md; issues 399 e 405 a 410).
//
// Mora na aba Argo, vista `#argo?v=relatorio`; o index.html chama
// `ArgoRelatorio.abrir(raiz, { argoApi })` quando a vista aparece.
//
// A aba NÃO decide nada: números, sinais (melhor, pior, estável), marcas
// (amostra pequena, indisponível, semana atípica), o texto que passou na
// checagem e o que foi removido vêm prontos de /api/argo/relatorio. Aqui só se
// desenha e se manda o que a gestora fez (reagir, decidir um teste proposto,
// gerar de novo).
//
// Desenho aprovado no protótipo 399: fato e leitura nunca se confundem (o
// texto da IA mora em .ar-leitura, com fio lateral e rótulo), etiquetas de
// citação abrem o fato, pacote de fatos e registro de checagem em gaveta.
(() => {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (x) => `${Math.round(Math.abs(x) * 100)}%`;
  const dataBR = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }) : '');
  const dataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às') : '');
  const rotuloSemana = (s) => (s.rotulo || `${dataBR(s.inicio + 'T12:00:00Z')} a ${dataBR(s.fim + 'T12:00:00Z')}`);

  const SITUACAO = {
    aguardando_analise: ['Argo escrevendo a análise', 'neutro'],
    verificada: ['Análise verificada', 'alta'], parcial: ['Análise parcial', 'alerta'], nao_passou: ['Não passou na checagem', 'queda'],
    sem_analise: ['Só a parte calculada', 'neutro'], falhou: ['Falhou', 'queda'], substituida: ['Substituída', 'neutro'],
  };
  const VEREDITO = { acertou: ['Acertou', 'alta'], errou: ['Errou', 'queda'], inconclusivo: ['Inconclusivo', 'neutro'] };
  const SITUACAO_TESTE = { rodando: ['Rodando', 'neutro'], pronto: ['Pronto para ler', 'alerta'], concluido: ['Concluído', 'alta'], abandonado: ['Abandonado', 'queda'], planejado: ['Planejado', 'neutro'] };
  const ROTULO_TIPO_FRASE = { fato: 'fato', leitura: 'leitura', sem_conclusao: 'sem conclusão' };
  const TIPO_TESTE = { criativo: 'Criativo', publico: 'Público ou conjunto', pagina: 'Página', oferta: 'Oferta ou funil' };

  let painel = null;
  let erroCarga = '';
  let modo = 'relatorio';
  let comparar = [null, null];
  let comparacao = null;
  let gerando = false;
  let pedindo = {};      // bloco -> 'errado' | 'livre'
  let descartando = null;
  let instrucoes = null;  // issue 410
  let testandoInstrucoes = false;
  let raizAtual = null;
  let ctx = null;

  const rel = () => (painel ? painel.relatorio : null);
  const fatos = () => (rel() && rel().pacote && rel().pacote.fatos) || {};

  // ---------------------------------------------------------------------------
  // Aviso curto e gaveta
  // ---------------------------------------------------------------------------
  let toastTempo = null;
  function avisar(texto, tipo = 'ok') {
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
    t.dataset.tipo = tipo;
    void t.offsetWidth;
    t.classList.add('visivel');
    clearTimeout(toastTempo);
    toastTempo = setTimeout(() => t.classList.remove('visivel'), 3600);
  }

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
      <header class="ag-gaveta__topo"><div><h2>${titulo}</h2>${sub ? `<p class="mini">${sub}</p>` : ''}</div>
        <button class="ag-gaveta__fechar" type="button" data-fechar aria-label="Fechar">×</button></header>
      <div class="ag-gaveta__corpo">${corpo}</div></div>`;
    g.querySelector('[data-fechar]').onclick = () => g.close();
    if (!g.open) g.showModal();
    return g;
  }

  const post = (corpo) => ctx.argoApi('/api/argo/relatorio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });

  // ---------------------------------------------------------------------------
  // Citação: balão no computador, folha embaixo no celular
  // ---------------------------------------------------------------------------
  const cita = (ids) => (ids || []).filter((id) => fatos()[id])
    .map((id) => `<button type="button" class="ar-cita" data-fato="${esc(id)}" aria-label="Fonte ${esc(id)}: ${esc(fatos()[id].nome)}">${esc(id)}</button>`).join('');
  const valor = (id) => (id && fatos()[id] ? fatos()[id].valor_texto : '');

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
  const MARCA = { indisponivel: ['indisponível', 'queda'], amostra_pequena: ['amostra pequena', 'neutro'], vencido: ['contexto vencido', 'alerta'], nao_pronto: ['ainda não pode ser lido', 'neutro'] };
  const EXPLICA = {
    indisponivel: 'A fonte não respondeu na geração. Nada foi preenchido no lugar.',
    amostra_pequena: 'Abaixo do piso de leads do Argo: a análise não pode concluir nada daqui.',
    vencido: 'Passou do prazo de validade sem revisão.',
    nao_pronto: 'O teste ainda não atingiu os mínimos: ninguém declara vencedor.',
  };
  function htmlFato(f) {
    const marcas = (f.marcas || []).filter((m) => MARCA[m]);
    return `<div class="ar-balao__id">${esc(f.id)} · ${esc(f.grupo)}</div>
      <div class="ar-balao__nome">${esc(f.nome)}</div>
      ${f.unidade && f.unidade !== 'texto' ? `<b class="ar-balao__valor">${esc(f.valor_texto)}</b>` : `<p class="ar-balao__texto">${esc(f.valor_texto)}</p>`}
      ${marcas.length ? `<div class="ar-balao__marcas">${marcas.map((m) => `<span class="carimbo ${MARCA[m][1]}">${MARCA[m][0]}</span>`).join(' ')}</div>` : ''}
      ${marcas.map((m) => `<p class="mini">${EXPLICA[m]}</p>`).join('')}
      <div class="mini">${esc(f.periodo || '')}${f.fonte ? ` · fonte: ${esc(f.fonte)}` : ''}</div>`;
  }
  let balaoDono = null;
  function mostrarBalao(btn) {
    const f = fatos()[btn.dataset.fato];
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
  // Blocos
  // ---------------------------------------------------------------------------
  function navegacao() {
    const b = (m, r) => `<button type="button" class="tipo-pill" data-ar-modo="${m}" aria-pressed="${modo === m}">${r}</button>`;
    const temHistorico = painel && painel.historico && painel.historico.length > 1;
    return `<div class="ar-nav" role="group" aria-label="Parte do relatório">
      ${b('relatorio', 'Esta semana')}${temHistorico ? b('historico', 'Histórico') + b('comparar', 'Comparar semanas') : ''}
      ${rel() && rel().pacote && rel().pacote.ordem ? '<button type="button" class="btn sec ar-nav__pacote" data-ar-pacote>Ver pacote de fatos</button>' : ''}
    </div>`;
  }

  function cabecalho(r) {
    const p = r.pacote || {};
    const sit = r.substituido_em ? 'substituida' : r.situacao;
    const [rot, cls] = SITUACAO[sit] || [sit, 'neutro'];
    const avisos = [];
    if (r.substituido_em) avisos.push(['explica', `Esta versão foi substituída em ${dataHora(r.substituido_em)} por uma geração mais nova.`]);
    if (r.situacao === 'falhou') avisos.push(['falha', esc(r.erro || 'A geração falhou.')]);
    if (r.situacao === 'aguardando_analise') avisos.push(['explica', 'Os números abaixo já valem. A análise escrita está com o Argo: o job dele roda a cada 10 minutos, escreve, e o texto só aparece aqui depois de passar na checagem. Recarregue em alguns minutos.']);
    if (r.situacao === 'sem_analise') avisos.push(['explica', `${esc(r.erro || 'Sem análise escrita nesta semana.')} Os números abaixo valem normalmente.`]);
    if (r.situacao === 'nao_passou') avisos.push(['falha', 'A análise escrita não passou na checagem depois de 2 tentativas. Abaixo, só a parte calculada. <button type="button" class="ar-link" data-ar-checagem>Ver por quê</button>']);
    if (r.situacao === 'parcial') avisos.push(['alerta', `${r.removidos.length === 1 ? '1 bloco removido' : `${r.removidos.length} blocos removidos`} pela checagem: ${r.removidos.map((x) => esc(x.titulo.toLowerCase())).join(', ')}. <button type="button" class="ar-link" data-ar-checagem>Ver por quê</button>`]);
    for (const f of p.fontes_com_problema || []) avisos.push(['falha', `${esc(f.fonte)}: ${esc(f.aviso)}`]);
    const vencidos = (p.contexto && p.contexto.vencidos) || [];
    if (vencidos.length) avisos.push(['alerta', `${vencidos.length === 1 ? '1 item do contexto' : `${vencidos.length} itens do contexto`} sem revisão: ${vencidos.map((v) => `<b>${esc(v.titulo)}</b> (${v.dias} dias)`).join(', ')}. O relatório usou mesmo assim. <button type="button" class="ar-link" data-argo-vista="contexto">Revisar</button>`]);
    if (p.contexto && p.contexto.vazio) avisos.push(['explica', 'Sem contexto do negócio: a análise não sabe o momento da empresa. <button type="button" class="ar-link" data-argo-vista="contexto">Escrever o contexto</button>']);
    if (p.marcas && p.marcas.atipica) avisos.push(['alerta', `Semana atípica: ${p.marcas.atipica.motivos.map(esc).join(' ')} Compare com cuidado.`]);
    if (p.primeira) avisos.push(['explica', 'Primeiro relatório: ainda não há reações suas para a análise aprender.']);
    const atual = painel.historico && painel.historico.find((h) => !h.substituido_em);
    const ehAtual = atual && atual.id === r.id;
    return `<header class="ar-cabeca">
      <div class="ar-cabeca__linha">
        <div>
          <div class="ar-cabeca__rotulo">Relatório semanal do Argo</div>
          <h2 class="ar-cabeca__titulo">Semana de ${esc(rotuloSemana(r.semana))}</h2>
          <div class="mini">Gerado ${esc(dataHora(r.gerado_em))}${r.origem === 'manual' ? ' (pedido na aba)' : r.origem === 'agendado' ? ' (segunda às 07h)' : ''}</div>
        </div>
        <div class="ar-cabeca__acoes">
          <span class="carimbo ${cls}">${rot}</span>
          ${ehAtual ? `<button type="button" class="btn sec" data-ar-gerar${gerando ? ' disabled' : ''}>${gerando ? 'Gerando…' : 'Gerar de novo'}</button>` : ''}
        </div>
      </div>
      ${avisos.map(([t, h]) => `<p class="aviso ${t === 'falha' ? 'falha ar-aviso' : t}">${h}</p>`).join('')}
    </header>`;
  }

  function reacao(chave) {
    const r = rel();
    const x = (r.reacoes || []).find((y) => y.bloco === chave) || {};
    const pd = pedindo[chave];
    const b = (tipo, rot) => `<button type="button" class="ar-reacao__btn" data-ar-reagir="${tipo}" data-bloco="${chave}" aria-pressed="${x.tipo === tipo}">${rot}</button>`;
    return `<div class="ar-reacao">
      ${b('util', 'Útil')}${b('obvio', 'Óbvio')}${b('errado', 'Errado')}
      <button type="button" class="ar-link" data-ar-comentar="${chave}">Comentar</button>
      ${x.comentario ? `<button type="button" class="ar-link" data-ar-contexto="${chave}">Virar item de contexto</button>` : ''}
      ${x.comentario && !pd ? `<p class="ar-reacao__coment">“${esc(x.comentario)}”</p>` : ''}
      ${pd ? `<form class="ar-reacao__form" data-ar-form="${chave}">
        <label class="mini" for="ar-c-${chave}">${pd === 'errado' ? 'O que está errado? (obrigatório)' : 'Comentário'}</label>
        <textarea id="ar-c-${chave}" rows="2"${pd === 'errado' ? ' required' : ''}>${esc(x.comentario || '')}</textarea>
        <div class="ar-reacao__acoes"><button type="submit" class="btn">Salvar</button><button type="button" class="btn sec" data-ar-cancelar="${chave}">Cancelar</button></div>
      </form>` : ''}
    </div>`;
  }

  const frasesHtml = (frases) => frases.map((f) => `<p class="ar-frase ar-frase--${esc(f.tipo)}"><span class="ar-frase__tipo">${ROTULO_TIPO_FRASE[f.tipo] || ''}</span> ${esc(f.texto)} ${cita(f.citacoes)}</p>`).join('');

  function leitura(chave) {
    const b = (rel().analise || []).find((x) => x.chave === chave);
    if (!b) return '';
    const corpo = b.frases.length ? frasesHtml(b.frases) : '<p class="mini">Nada a dizer nesta semana.</p>';
    return `<section class="bloco"><h2>${esc(b.titulo)}</h2>
      <div class="ar-leitura"><div class="ar-leitura__rotulo">Leitura do Argo</div>${corpo}${reacao(chave)}</div></section>`;
  }

  function sinalHtml(m) {
    const s = m.sinal;
    if (!s) return '';
    if (s.tipo === 'amostra') return '<span class="carimbo neutro">amostra pequena</span>';
    if (s.tipo === 'estavel') return '<span class="carimbo neutro">estável</span>';
    const seta = s.pct < 0 ? '▼' : '▲';
    return `<span class="carimbo ${s.tipo === 'melhor' ? 'alta' : 'queda'}">${seta} ${pct(s.pct)} ${s.tipo} que a ${s.contra === 'meta' ? 'meta' : 'média'}</span>`;
  }

  function painelFunis(p) {
    if (!p.funis || !p.funis.length) return `<section class="bloco"><h2>Resultados por funil</h2><p class="aviso">Sem números por funil nesta semana.</p></section>`;
    return `<section class="bloco"><h2>Resultados por funil <small>semana anterior · média das 4 semanas anteriores · meta</small></h2>
      <div class="ar-funis">${p.funis.map((f) => `<article class="ar-funil${f.sem_investimento ? ' ar-funil--parado' : ''}">
        <h3>${esc(f.nome)}${f.sem_investimento ? ' <span class="mini">sem gasto na semana</span>' : ''}</h3>
        ${f.metricas.map((m) => {
          const comp = [];
          comp.push(m.ant_id ? `anterior ${esc(valor(m.ant_id))}` : 'sem semana anterior');
          comp.push(m.media_id ? `média 4 sem. ${esc(valor(m.media_id))}` : 'sem histórico ainda');
          if (m.meta_id) comp.push(`meta ${esc(valor(m.meta_id))}`);
          else if (m.tem_meta_possivel) comp.push('sem meta cadastrada');
          const v = valor(m.fato_id);
          return `<div class="ar-met">
            <span class="ar-met__nome">${esc(m.nome)}</span>
            <span class="ar-met__valor">${v === 'indisponível' ? '<span class="semdado">indisponível</span>' : esc(v)} ${cita([m.fato_id])}</span>
            <span class="ar-met__comp">${comp.join(' · ')}</span>
            <span class="ar-met__sinal">${sinalHtml(m)}</span>
          </div>`;
        }).join('')}
      </article>`).join('')}</div></section>`;
  }

  function oQueFoiFeito(p) {
    const a = p.acoes;
    if (!a) return '';
    const grupos = [...new Set(a.itens.map((i) => i.grupo))];
    const resumo = `${a.aprovadas} ${a.aprovadas === 1 ? 'aprovada' : 'aprovadas'} · ${a.recusadas} ${a.recusadas === 1 ? 'recusada' : 'recusadas'} · ${a.pendentes} ${a.pendentes === 1 ? 'pendente' : 'pendentes'}`;
    return `<section class="bloco"><h2>O que foi feito na conta <small>${resumo}</small></h2>
      ${a.itens.length ? grupos.map((g) => `<div class="argo-grupo"><div class="argo-grupo-titulo">${esc(g)}</div>
        ${a.itens.filter((i) => i.grupo === g).map((i) => `<div class="argo-acao">
          <div>
            <span class="argo-acao-nome">${esc(i.tipo)}: ${esc(i.alvo)} ${cita([i.fato_id])}</span>
            <span class="argo-acao-desc">${esc(i.motivo)}${i.quando ? ` · ${dataBR(i.quando)}` : ''}</span>
            ${i.veredito && i.veredito.texto ? `<span class="argo-acao-desc">${esc(i.veredito.texto)} ${i.veredito_fato_id !== i.fato_id ? cita([i.veredito_fato_id]) : ''}</span>` : ''}
          </div>
          <div class="ar-acao-lado">
            ${i.veredito ? `<span class="carimbo ${(VEREDITO[i.veredito.situacao] || ['', 'neutro'])[1]}">${(VEREDITO[i.veredito.situacao] || [i.veredito.situacao])[0]}</span>` : (i.aguardando ? `<span class="mini">${esc(i.aguardando)}</span>` : '')}
            ${i.proposta_id ? '<button type="button" class="ar-link" data-argo-vista="propostas">ver proposta</button>' : ''}
          </div>
        </div>`).join('')}</div>`).join('') : '<p class="aviso">Nenhuma ação na conta nesta semana.</p>'}
    </section>`;
  }

  function anuncios(p) {
    const a = p.anuncios;
    if (!a || !a.itens.length) return '';
    return `<section class="bloco"><h2>Anúncios com mais gasto ${a.juncao ? `<small>${esc(valor(a.juncao.fato_id))} dos leads pagos casam com um anúncio ${cita([a.juncao.fato_id])}</small>` : ''}</h2>
      <div class="tabela-wrap"><table class="ar-anuncios">
        <thead><tr><th>Anúncio</th><th class="num">Gasto</th><th class="num">Leads</th><th class="num">MQLs</th><th class="num">CPL</th><th></th></tr></thead>
        <tbody>${a.itens.map((x) => `<tr><td class="nome">${esc(x.nome)}<span class="mini"> · ${esc(x.conjunto)}</span></td>
          <td class="num">${(x.gasto / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td class="num">${x.leads}</td><td class="num">${x.mqls}</td>
          <td class="num">${x.cpl ? (x.cpl / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '<span class="semdado">sem leads</span>'}</td><td>${cita([x.fato_id])}</td></tr>`).join('')}</tbody>
      </table></div></section>`;
  }

  function testesCalculados(p) {
    const itens = (p.testes ? p.testes.itens : []).filter((t) => !t.historico);
    const novos = p.anuncios_sem_teste || [];
    return `<section class="bloco"><h2>Testes <small>rodando, prontos para ler, planejados e fechados na semana</small></h2>
      ${itens.length ? itens.map((t) => `<div class="argo-acao">
        <div>
          <span class="argo-acao-nome">${esc(t.nome)} ${cita([t.fato_id])}</span>
          <span class="argo-acao-desc">${esc(TIPO_TESTE[t.tipo] || t.tipo)}${t.resultado ? ` · resultado: ${esc(t.resultado)}` : ''}</span>
          ${t.numeros ? `<span class="argo-acao-desc">${esc(t.numeros)}</span>` : ''}
          ${t.leitura ? `<span class="argo-acao-desc">${esc(t.leitura)}</span>` : ''}
        </div>
        <div class="ar-acao-lado"><span class="carimbo ${(SITUACAO_TESTE[t.situacao] || ['', 'neutro'])[1]}">${(SITUACAO_TESTE[t.situacao] || [t.situacao])[0]}</span><button type="button" class="ar-link" data-argo-vista="testes">abrir no registro</button></div>
      </div>`).join('') : '<p class="aviso">Nenhum teste rodando ou fechado nesta semana. <button type="button" class="ar-link" data-argo-vista="testes">Registrar um teste</button></p>'}
      ${novos.length ? `<div class="argo-grupo"><div class="argo-grupo-titulo">Anúncios novos que não estão em nenhum teste</div>
        <p class="argo-grupo-nota">Algum destes faz parte de um teste? Se sim, ligue no registro para o relatório ler os números.</p>
        ${novos.map((n) => `<div class="argo-acao"><div><span class="argo-acao-nome">${esc(n.nome)} ${cita([n.fato_id])}</span><span class="argo-acao-desc">criado em ${dataBR(n.criado_em + 'T12:00:00Z')}</span></div>
          <div class="ar-acao-lado"><button type="button" class="ar-link" data-argo-vista="testes">ligar a um teste</button></div></div>`).join('')}</div>` : ''}
    </section>`;
  }

  function sugestoes(r) {
    const blocos = (r.analise || []).filter((b) => b.tipo === 'sugestao');
    const sem = (r.analise || []).find((b) => b.tipo === 'sem_sugestao');
    const removidas = (r.removidos || []).filter((x) => x.chave.startsWith('sug-'));
    if (!blocos.length && !sem && !removidas.length) return '';
    const cartao = (b) => {
      const s = b.sugestao;
      const d = (r.decisoes || []).find((x) => x.chave === b.chave);
      const fim = d ? (d.decisao === 'aceita'
        ? `<p class="mini">Virou teste planejado no registro. <button type="button" class="ar-link" data-argo-vista="testes">Abrir</button></p>`
        : `<p class="mini">Descartado: “${esc(d.motivo)}”. Na semana seguinte a análise lê esse motivo.</p>`)
        : descartando === b.chave
          ? `<div class="ar-sug__acoes" data-sug="${b.chave}"><label class="mini" for="ar-m-${b.chave}">Por que descartar? (entra na semana que vem)</label>
              <input id="ar-m-${b.chave}" type="text" maxlength="300" placeholder="Ex.: já testamos gancho de dor em julho">
              <div class="ar-reacao__acoes"><button type="button" class="btn" data-ar-conf-descarte="${b.chave}">Descartar</button><button type="button" class="btn sec" data-ar-canc-descarte>Cancelar</button></div></div>`
          : `<div class="ar-sug__acoes"><button type="button" class="btn" data-ar-virar="${b.chave}">Virar teste</button><button type="button" class="btn sec" data-ar-descartar="${b.chave}">Descartar</button></div>`;
      return `<article class="ar-sug ar-leitura${d && d.decisao === 'descartada' ? ' ar-sug--descartada' : ''}">
        <div class="ar-leitura__rotulo">${esc(b.titulo)} · ${esc(TIPO_TESTE[s.tipo] || s.tipo)} · ${esc(s.funil)}</div>
        <p class="ar-sug__hip">${esc(s.hipotese)}</p>
        <dl class="ar-sug__ficha">
          <dt>O que mudar</dt><dd>${esc(s.mudar)}</dd>
          <dt>Métrica</dt><dd>${esc(s.metrica)}</dd>
          <dt>Sucesso</dt><dd>${esc(s.criterio)}</dd>
          <dt>Mínimo</dt><dd>${esc(s.minimo)}</dd>
          <dt>Por que agora</dt><dd>${s.porque ? `${esc(s.porque.texto)} ${cita(s.porque.citacoes)}` : ''}</dd>
          <dt>Parecido no registro</dt><dd>${esc(s.parecido)}</dd>
        </dl>
        ${fim}
        ${reacao(b.chave)}
      </article>`;
    };
    return `<section class="bloco"><h2>Testes propostos <small>sugestão é só texto: nada é criado na conta</small></h2>
      ${blocos.length ? `<div class="ar-sugs">${blocos.map(cartao).join('')}</div>` : ''}
      ${sem ? `<div class="ar-leitura"><div class="ar-leitura__rotulo">Leitura do Argo</div><p>${esc(sem.texto || 'Sem base para sugerir teste nesta semana.')}</p></div>` : ''}
      ${removidas.map((x) => `<p class="aviso alerta ar-removido">Removido pela checagem: ${esc(x.titulo.toLowerCase())}. ${x.motivos.map(esc).join(' ')} <button type="button" class="ar-link" data-ar-checagem>Ver o registro</button></p>`).join('')}
    </section>`;
  }

  function qualidade() {
    const q = painel.qualidade || [];
    if (!q.length) return `<section class="bloco"><h2>Qualidade do relatório</h2><p class="aviso">Ainda vazio: as suas reações (útil, óbvio, errado) aparecem aqui semana a semana.</p></section>`;
    return `<section class="bloco"><h2>Qualidade do relatório <small>suas reações por semana</small></h2>
      <div class="ar-qs">${q.map((x) => {
        const tot = x.util + x.obvio + x.errado;
        const barra = tot ? [['util', x.util], ['obvio', x.obvio], ['errado', x.errado]].map(([k, n]) => `<i class="ar-q__${k}" style="width:${(n / tot) * 100}%"></i>`).join('') : '';
        return `<div class="ar-q"><span class="ar-q__sem">semana de ${dataBR(x.semana_inicio + 'T12:00:00Z')}</span><span class="ar-q__barra" aria-hidden="true">${barra}</span>
          <span class="ar-q__num">${tot ? `${x.util} útil · ${x.obvio} óbvio · ${x.errado} errado` : 'sem reações'}</span></div>`;
      }).join('')}</div></section>`;
  }

  // Issue 410: uma versão nova das instruções só vale depois de rodar nas semanas passadas sem piorar.
  function blocoInstrucoes() {
    if (!instrucoes) return '';
    const fmt = (x) => `${Math.round(x * 100)}%`;
    const linhas = instrucoes.avaliacoes.map((a) => {
      const r = a.resultado || {};
      return `<tr><td>${esc(a.versao)} <span class="mini">contra ${esc(a.versao_base)}</span></td><td>${esc(dataHora(a.criado_em))}</td>
        <td class="num">${r.base ? fmt(r.base.aprovacao) : ''} → ${r.candidata ? fmt(r.candidata.aprovacao) : ''}</td>
        <td class="num">${r.candidata ? `${r.candidata.repetidos} de ${r.base.errados}` : ''}</td>
        <td><span class="carimbo ${a.situacao === 'aprovada' ? 'alta' : a.situacao === 'pendente' ? 'neutro' : 'queda'}">${a.situacao === 'pendente' ? 'esperando o Argo' : a.situacao}</span>${a.ativada_em ? ' <span class="mini">ativada</span>' : ''}</td></tr>`;
    }).join('');
    const outras = instrucoes.versoes.filter((v) => v.versao !== instrucoes.ativa);
    const aprovada = (v) => instrucoes.avaliacoes.some((a) => a.versao === v && a.situacao === 'aprovada');
    return `<section class="bloco"><h2>Instruções da análise <small>vale a versão ${esc(instrucoes.ativa)}</small></h2>
      <p class="mini">Uma versão nova das instruções só passa a valer depois de escrever de novo as últimas semanas guardadas sem passar menos na checagem nem repetir trechos que você marcou como errado. Quem reescreve é o próprio Argo, pela fila dele: o resultado aparece aqui em até algumas dezenas de minutos.</p>
      ${outras.length ? `<div class="ar-sug__acoes">${outras.map((v) => `<button type="button" class="btn sec" data-ar-testar="${esc(v.versao)}"${testandoInstrucoes ? ' disabled' : ''}>${testandoInstrucoes ? 'Testando…' : `Testar ${esc(v.versao)} nas semanas passadas`}</button>${aprovada(v.versao) ? `<button type="button" class="btn" data-ar-ativar="${esc(v.versao)}">Ativar ${esc(v.versao)}</button>` : ''}`).join('')}</div>` : '<p class="mini">Nenhuma versão nova esperando teste.</p>'}
      ${linhas ? `<div class="tabela-wrap"><table><thead><tr><th>Versão</th><th>Testada</th><th class="num">Aprovação na checagem</th><th class="num">Erros repetidos</th><th>Resultado</th></tr></thead><tbody>${linhas}</tbody></table></div>` : ''}
    </section>`;
  }

  function relatorio(r) {
    if (r.situacao === 'falhou') return cabecalho(r);
    const p = r.pacote;
    return [
      cabecalho(r),
      leitura('resumo'),
      painelFunis(p),
      oQueFoiFeito(p),
      leitura('acoes'),
      anuncios(p),
      testesCalculados(p),
      leitura('testes'),
      sugestoes(r),
      leitura('atencao'),
      qualidade(),
      blocoInstrucoes(),
      r.checagem && r.checagem.length ? '<p class="ar-rodape"><button type="button" class="ar-link" data-ar-checagem>Registro de checagem desta semana</button></p>' : '',
    ].join('');
  }

  function historico() {
    return `<section class="bloco"><h2>Histórico <small>da semana mais recente para trás</small></h2>
      <div class="tabela-wrap"><table>
        <thead><tr><th>Semana</th><th>Gerado</th><th>Situação</th><th></th></tr></thead>
        <tbody>${painel.historico.map((h) => {
          const sit = h.substituido_em ? 'substituida' : h.situacao;
          const [rot, cls] = SITUACAO[sit] || [sit, 'neutro'];
          return `<tr${h.substituido_em ? ' class="ar-substituida"' : ''}><td><b>${esc(rotuloSemana(h.semana))}</b>${h.atipica ? ' <span class="mini">atípica</span>' : ''}</td>
            <td>${esc(dataHora(h.gerado_em))}</td><td><span class="carimbo ${cls}">${rot}</span></td>
            <td><button type="button" class="ar-link" data-ar-abrir="${h.id}">abrir</button></td></tr>`;
        }).join('')}</tbody>
      </table></div></section>`;
  }

  function comparacaoHtml() {
    const opcoes = (sel) => painel.historico.filter((h) => h.situacao !== 'falhou').map((h) => `<option value="${h.id}"${h.id === sel ? ' selected' : ''}>${esc(rotuloSemana(h.semana))}${h.substituido_em ? ' (substituída)' : ''}</option>`).join('');
    let corpo = '<p class="aviso">Escolha duas semanas diferentes.</p>';
    if (comparacao && comparacao.erro) corpo = `<p class="aviso falha">${esc(comparacao.erro)}</p>`;
    else if (comparacao) {
      corpo = `<div class="ar-funis">${comparacao.funis.map((f) => `<article class="ar-funil"><h3>${esc(f.nome)}</h3>
        <div class="tabela-wrap"><table class="ar-comp">
          <thead><tr><th>Métrica</th><th class="num">${esc(comparacao.a.semana.rotulo)}</th><th class="num">${esc(comparacao.b.semana.rotulo)}</th><th class="num">Diferença</th></tr></thead>
          <tbody>${f.metricas.map((m) => `<tr><td>${esc(m.nome)}</td><td class="num">${esc(m.a)}</td><td class="num">${esc(m.b)}</td>
            <td class="num">${m.diferenca == null ? '<span class="semdado">sem dado</span>' : `<span class="delta ${m.sinal === 'melhor' ? 'up' : m.sinal === 'pior' ? 'down' : 'neutro'}">${m.diferenca >= 0 ? '▲' : '▼'} ${pct(m.diferenca)}</span>`}</td></tr>`).join('')}</tbody>
        </table></div></article>`).join('')}</div>`;
    }
    return `<section class="bloco"><h2>Comparar semanas</h2>
      <div class="ar-comp-esc">
        <label>Semana A <select data-ar-comp="0"><option value="">Escolha</option>${opcoes(comparar[0])}</select></label>
        <label>Semana B <select data-ar-comp="1"><option value="">Escolha</option>${opcoes(comparar[1])}</select></label>
      </div>${corpo}</section>`;
  }

  function desenhar() {
    if (!raizAtual) return;
    esconderBalao();
    if (erroCarga) { raizAtual.innerHTML = `<p class="aviso falha">${esc(erroCarga)}</p>`; return; }
    if (!painel) { raizAtual.innerHTML = '<div class="esq-tabela" role="status" aria-label="Carregando…"><span class="esq esq-linha"></span><span class="esq esq-linha"></span><span class="esq esq-linha"></span></div>'; return; }
    if (!rel()) {
      raizAtual.innerHTML = `<div class="ac-vazio"><h3>Ainda não há relatório semanal</h3>
        <p>O relatório sai sozinho toda segunda às 07h, cobrindo os 7 dias anteriores. Você pode gerar agora o da semana que terminou ontem.</p>
        <button type="button" class="btn" data-ar-gerar${gerando ? ' disabled' : ''}>${gerando ? 'Gerando… pode levar alguns minutos' : 'Gerar agora'}</button></div>`;
      return;
    }
    let corpo;
    if (modo === 'historico') corpo = historico();
    else if (modo === 'comparar') corpo = comparacaoHtml();
    else corpo = relatorio(rel());
    const atual = painel.historico.find((h) => !h.substituido_em);
    const voltar = modo === 'relatorio' && atual && rel().id !== atual.id ? '<p><button type="button" class="ar-link" data-ar-voltar>← voltar para a semana mais recente</button></p>' : '';
    raizAtual.innerHTML = navegacao() + voltar + corpo;
  }

  // ---------------------------------------------------------------------------
  // Gavetas: pacote e checagem
  // ---------------------------------------------------------------------------
  function abrirPacote() {
    const p = rel().pacote;
    const grupos = [...new Set(p.ordem.map((id) => p.fatos[id].grupo))];
    const corpo = `<input type="search" class="ar-pacote__busca" placeholder="Procurar por etiqueta ou nome (ex.: F12, CPL, ad13)" aria-label="Procurar no pacote de fatos">
      <div class="ar-pacote">${grupos.map((g) => `<section data-grupo>
        <h3 class="argo-grupo-titulo">${esc(g)}</h3>
        ${p.ordem.filter((id) => p.fatos[id].grupo === g).map((id) => {
          const f = p.fatos[id];
          const marcas = (f.marcas || []).filter((m) => MARCA[m]).map((m) => ` <span class="carimbo ${MARCA[m][1]}">${MARCA[m][0]}</span>`).join('');
          return `<div class="ar-pacote__fato" data-busca="${esc((f.id + ' ' + f.nome + ' ' + f.valor_texto).toLowerCase())}">
            <span class="ar-pacote__id">${f.id}</span><span class="ar-pacote__nome">${esc(f.nome)}${marcas}</span><span class="ar-pacote__valor">${esc(f.valor_texto)}</span></div>`;
        }).join('')}</section>`).join('')}</div>`;
    const g = gaveta({ titulo: 'Pacote de fatos', sub: `Semana de ${esc(rotuloSemana(rel().semana))} · ${p.ordem.length} fatos · é tudo o que a análise pôde ver`, corpo });
    const busca = g.querySelector('.ar-pacote__busca');
    busca.oninput = () => {
      const q = busca.value.trim().toLowerCase();
      g.querySelectorAll('.ar-pacote__fato').forEach((el) => { el.hidden = q && !el.dataset.busca.includes(q); });
      g.querySelectorAll('[data-grupo]').forEach((sec) => { sec.hidden = ![...sec.querySelectorAll('.ar-pacote__fato')].some((el) => !el.hidden); });
    };
  }

  function abrirChecagem() {
    const r = rel();
    const final = { verificada: 'Publicada como verificada.', parcial: 'Publicada como parcial: os blocos reprovados saíram.', nao_passou: 'Publicada só a parte calculada.', sem_analise: 'Sem análise escrita nesta semana.' }[r.situacao] || '';
    const corpo = `<p class="mini">Regras: números, citações, formato, amostra, leitura antecipada, causa sem veredito, semana atípica, fonte indisponível e restrição.${r.modelo ? ` Modelo: ${esc(r.modelo)}; instruções ${esc(r.instrucoes_versao || '')}.` : ''}</p>
      ${(r.checagem || []).map((t) => `<section class="ar-chec">
        <h3>Tentativa ${t.tentativa} ${t.resultado === 'passou' ? '<span class="carimbo alta">passou</span>' : '<span class="carimbo queda">reprovou</span>'}</h3>
        ${t.violacoes.length ? `<ul>${t.violacoes.map((x) => `<li><b>${esc(x.regra)}</b> · ${esc(x.bloco)}${x.trecho ? `<br><span class="mini">“${esc(x.trecho)}”</span>` : ''}<br><span class="mini">${esc(x.motivo)}</span></li>`).join('')}</ul>` : '<p class="mini">Nenhuma violação.</p>'}
      </section>`).join('') || '<p class="mini">Nenhuma tentativa registrada.</p>'}
      ${(r.removidos || []).length ? `<h3 class="argo-grupo-titulo">Removidos</h3><ul>${r.removidos.map((x) => `<li>${esc(x.titulo)}: ${x.motivos.map(esc).join(' ')}</li>`).join('')}</ul>` : ''}
      <p><b>${esc(final)}</b></p>`;
    gaveta({ titulo: 'Registro de checagem', sub: `Semana de ${esc(rotuloSemana(r.semana))}`, corpo });
  }

  // ---------------------------------------------------------------------------
  // Ações
  // ---------------------------------------------------------------------------
  async function carregar(id = null) {
    try {
      painel = await ctx.argoApi(`/api/argo/relatorio${id ? `?id=${id}` : ''}`);
      erroCarga = '';
    } catch (e) {
      erroCarga = e.mensagemUsuario || 'Não foi possível ler o relatório agora.';
    }
    desenhar();
    // As instruções carregam à parte: falha aqui não derruba o relatório.
    ctx.argoApi('/api/argo/relatorio-instrucoes').then((r) => { instrucoes = r; desenhar(); }).catch(() => {});
  }

  async function instrucaoAcao(acao, versao) {
    if (acao === 'testar') { testandoInstrucoes = true; desenhar(); }
    try {
      instrucoes = await ctx.argoApi('/api/argo/relatorio-instrucoes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acao, versao }) });
      avisar(acao === 'ativar' ? `A versão ${versao} passou a valer a partir do próximo relatório.` : 'Teste enviado ao Argo. O resultado aparece na tabela quando ele terminar as semanas.');
    } catch (e) {
      avisar(e.mensagemUsuario || 'Não foi possível concluir agora.', 'erro');
    }
    testandoInstrucoes = false;
    desenhar();
  }

  async function enviar(corpo, msg, botao) {
    if (botao) botao.disabled = true;
    try {
      painel = await post(corpo);
      desenhar();
      if (msg) avisar(msg);
      return true;
    } catch (e) {
      if (botao) botao.disabled = false;
      avisar(e.mensagemUsuario || 'Não foi possível concluir agora.', 'erro');
      return false;
    }
  }

  async function gerar() {
    gerando = true;
    desenhar();
    avisar('Gerando os números da semana que terminou ontem. A análise escrita vem depois, pelo Argo.');
    try {
      painel = await post({ acao: 'gerar' });
      modo = 'relatorio';
      avisar('Números prontos. O Argo escreve a análise em até 10 minutos; a versão anterior ficou no histórico como substituída.');
    } catch (e) {
      avisar(e.mensagemUsuario || 'Não foi possível gerar agora.', 'erro');
    }
    gerando = false;
    desenhar();
  }

  async function atualizarComparacao() {
    const [a, b] = comparar;
    if (!a || !b || a === b) { comparacao = null; desenhar(); return; }
    try {
      const r = await ctx.argoApi(`/api/argo/relatorio?comparar=${a},${b}`);
      comparacao = r.comparacao;
    } catch (e) {
      comparacao = { erro: e.mensagemUsuario || 'Não foi possível comparar agora.' };
    }
    desenhar();
  }

  function ligar(raiz) {
    raiz.addEventListener('change', (ev) => {
      const t = ev.target;
      if (t.matches('[data-ar-comp]')) { comparar[Number(t.dataset.arComp)] = t.value ? Number(t.value) : null; atualizarComparacao(); }
    });
    raiz.addEventListener('submit', async (ev) => {
      const form = ev.target.closest('[data-ar-form]');
      if (!form) return;
      ev.preventDefault();
      const chave = form.dataset.arForm;
      const comentario = form.querySelector('textarea').value.trim();
      const atual = (rel().reacoes || []).find((x) => x.bloco === chave) || {};
      const tipo = pedindo[chave] === 'errado' ? 'errado' : (atual.tipo || null);
      if (tipo === 'errado' && !comentario) { avisar('Diga o que está errado para marcar este trecho.', 'erro'); return; }
      const ok = await enviar({ acao: 'reagir', relatorio_id: rel().id, bloco: chave, tipo, comentario }, 'Anotado. Isso entra no relatório da semana que vem.', form.querySelector('[type="submit"]'));
      if (ok) { delete pedindo[chave]; desenhar(); }
    });
    raiz.addEventListener('click', async (ev) => {
      const t = ev.target.closest('button');
      if (!t || !raiz.contains(t) || t.classList.contains('ar-cita')) return;
      const d = t.dataset;
      if (d.arModo) { modo = d.arModo; if (modo === 'comparar' && !comparar[0]) { const ids = painel.historico.filter((h) => h.situacao !== 'falhou' && !h.substituido_em).map((h) => h.id); comparar = [ids[1] || null, ids[0] || null]; atualizarComparacao(); } desenhar(); }
      else if ('arPacote' in d) abrirPacote();
      else if ('arChecagem' in d) abrirChecagem();
      else if ('arGerar' in d) { if (!gerando) gerar(); }
      else if (d.arTestar) { if (!testandoInstrucoes) instrucaoAcao('testar', d.arTestar); }
      else if (d.arAtivar) instrucaoAcao('ativar', d.arAtivar);
      else if ('arVoltar' in d) { modo = 'relatorio'; await carregar(); }
      else if (d.arAbrir) { modo = 'relatorio'; await carregar(Number(d.arAbrir)); window.scrollTo({ top: raiz.offsetTop - 20 }); }
      else if (d.arReagir) {
        const chave = d.bloco;
        const atual = (rel().reacoes || []).find((x) => x.bloco === chave) || {};
        if (d.arReagir === 'errado') { pedindo[chave] = 'errado'; desenhar(); const ta = raiz.querySelector(`#ar-c-${chave}`); if (ta) ta.focus(); return; }
        const tipo = atual.tipo === d.arReagir ? null : d.arReagir;
        enviar({ acao: 'reagir', relatorio_id: rel().id, bloco: chave, tipo, comentario: atual.comentario || '' }, tipo ? `Trecho marcado como ${tipo === 'util' ? 'útil' : 'óbvio'}.` : 'Marcação retirada.', t);
      } else if (d.arComentar) { pedindo[d.arComentar] = 'livre'; desenhar(); const ta = raiz.querySelector(`#ar-c-${d.arComentar}`); if (ta) ta.focus(); }
      else if (d.arCancelar) { delete pedindo[d.arCancelar]; desenhar(); }
      else if (d.arContexto) {
        const x = (rel().reacoes || []).find((y) => y.bloco === d.arContexto);
        if (!x || !x.comentario) return;
        t.disabled = true;
        try {
          await ctx.argoApi('/api/argo/contexto', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acao: 'criar', tipo: 'observacao', titulo: x.comentario.slice(0, 120), texto: x.comentario.length > 120 ? x.comentario : '' }) });
          avisar('Virou uma observação no contexto do negócio. Ajuste o texto na parte Contexto, se quiser.');
        } catch (e) { avisar(e.mensagemUsuario || 'Não foi possível criar o item agora.', 'erro'); }
        t.disabled = false;
      } else if (d.arVirar) enviar({ acao: 'decidir', relatorio_id: rel().id, chave: d.arVirar, decisao: 'aceita' }, 'Virou teste planejado no registro. Escolha os lados antes de iniciar.', t);
      else if (d.arDescartar) { descartando = d.arDescartar; desenhar(); const i = raiz.querySelector(`#ar-m-${d.arDescartar}`); if (i) i.focus(); }
      else if ('arCancDescarte' in d) { descartando = null; desenhar(); }
      else if (d.arConfDescarte) {
        const motivo = raiz.querySelector(`#ar-m-${d.arConfDescarte}`).value.trim();
        if (!motivo) { avisar('Escreva o motivo do descarte.', 'erro'); return; }
        if (await enviar({ acao: 'decidir', relatorio_id: rel().id, chave: d.arConfDescarte, decisao: 'descartada', motivo }, 'Descartado. O motivo entra no pacote da semana que vem.', t)) descartando = null;
      }
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

  window.ArgoRelatorio = {
    abrir(raiz, contexto) {
      ctx = contexto;
      if (raizAtual !== raiz) { raizAtual = raiz; ligar(raiz); }
      if (!painel) { desenhar(); carregar(); }
    },
  };
})();
