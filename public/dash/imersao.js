// Aba Imersão 2027 (spec-imersao-2027.md, série S8).
//
// Só desenha: toda conta vem pronta de /api/imersao (functions/api/_imersao.js).
// O index.html chama `Imersao.abrir(raiz, ctx)` quando a aba aparece; ctx traz
// { esc, fmtInt, fmtPct, fmtNum, money, fetchJson } do próprio dash.
(() => {
  'use strict';

  const SUBABAS = [
    { id: 'visao', rotulo: 'Visão geral do lançamento' },
    { id: 'simulacao', rotulo: 'Simulação' },
  ];
  const COR_TEXTO = { forte: 'superou muito', claro: 'superou', vermelho: 'abaixo' };

  let estado = { aba: 'visao', ordem: 'vendas', resposta: null };

  const dia = (ymd) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
  const vazio = (v) => v === null || v === undefined;

  function fmt(ctx) {
    return {
      pct: (v, c = 1) => (vazio(v) ? null : ctx.fmtPct(v, c)),
      brl: (v) => (vazio(v) ? null : ctx.money(v)),
      num: (v, c = 1) => (vazio(v) ? null : ctx.fmtNum(v, c)),
      int: (v) => (vazio(v) ? null : ctx.fmtInt(v)),
    };
  }

  /** Card no padrão "etiqueta" do dash. `valor` null → "—"; `faltaMeta` → "defina a meta". */
  function card(ctx, { rotulo, valor, nota, ref, faltaMeta, alerta, grande, extra }) {
    const v = faltaMeta
      ? '<span class="im-falta-meta">defina a meta</span>'
      : vazio(valor) ? '<span class="semdado">—</span>' : ctx.esc(valor);
    const rodape = nota || ref
      ? `<div class="rodape">${ref ? `<span class="im-ref"><b>referência</b> ${ctx.esc(ref)}</span>` : ''}${nota ? `<span class="nota">${ctx.esc(nota)}</span>` : ''}</div>`
      : '';
    return `<div class="etiqueta${grande ? ' heroi' : ''}${alerta ? ' im-alerta' : ''}" data-im-card="${ctx.esc(rotulo)}">
      <div class="ref">${ctx.esc(rotulo)}</div>
      <div class="valor">${v}</div>${extra || ''}${rodape}
    </div>`;
  }

  function cabecalho(ctx, r) {
    const abas = SUBABAS.map((a) => `<button type="button" role="tab" data-im-aba="${a.id}" aria-selected="${estado.aba === a.id}">${ctx.esc(a.rotulo)}</button>`).join('');
    const faixa = r && r.exemplo
      ? `<div class="im-faixa-exemplo" role="status"><b>Dados de exemplo</b> · números fictícios, como se hoje fosse ${dia(r.hoje)}. Somem sozinhos quando a primeira venda real chegar da Zouti.</div>`
      : '';
    return `<div class="im-subabas" role="tablist" aria-label="Imersão 2027">${abas}</div>${faixa}`;
  }

  // ── Bloco 1 ────────────────────────────────────────────────────────────
  function blocoIngressos(ctx, b) {
    const f = fmt(ctx);
    const p = b.pacing;
    const pacingNota = p.encerrada ? 'venda encerrada' : `${p.faltam} ingressos em ${p.dias_corridos} dias corridos / ${p.dias_uteis} úteis`;
    const barra = `<div class="im-barra" aria-hidden="true"><span style="width:${Math.min(100, b.vendidos.pct || 0)}%"></span></div>`;
    const cards = [
      card(ctx, { rotulo: 'Ingressos vendidos', valor: `${f.int(b.vendidos.valor)} de ${f.int(b.vendidos.meta)}`, nota: `${f.pct(b.vendidos.pct, 0)} da meta`, extra: barra }),
      p.meta_batida
        ? card(ctx, { rotulo: 'Pacing', valor: 'Meta batida', nota: 'nenhum ingresso faltando' })
        : card(ctx, { rotulo: 'Pacing por dia corrido', valor: vazio(p.por_dia_corrido) ? null : `${f.num(p.por_dia_corrido)}/dia`, nota: pacingNota }),
      p.meta_batida ? '' : card(ctx, { rotulo: 'Pacing por dia útil', valor: vazio(p.por_dia_util) ? null : `${f.num(p.por_dia_util)}/dia`, nota: 'seg. a sex.' }),
      card(ctx, { rotulo: 'Ritmo realizado', valor: vazio(p.ritmo_realizado) ? null : `${f.num(p.ritmo_realizado)}/dia`, nota: 'média desde 09/11, para comparar com o pacing' }),
    ].join('');

    const linhasDia = b.faturamento_dia.slice().reverse().map((d) => `<tr>
        <td>${dia(d.dia)}</td><td class="num">${f.int(d.ingressos)}</td><td class="num">${f.int(d.bumps)}</td>
        <td class="num">${f.brl(d.previsto) ?? '—'}</td>
        <td class="num"><span class="im-cor im-cor--${d.cor || 'neutra'}" title="${ctx.esc(COR_TEXTO[d.cor] || '')}">${f.brl(d.realizado)}</span></td>
      </tr>`).join('');
    const legenda = '<p class="mini im-legenda"><span class="im-cor im-cor--forte">verde forte</span> 20% ou mais acima do previsto · <span class="im-cor im-cor--claro">verde claro</span> acima ou igual · <span class="im-cor im-cor--vermelho">vermelho</span> abaixo</p>';

    const lotes = b.lotes.map((l) => `<div class="im-lote${l.atual ? ' im-lote--atual' : ''}">
        <small>${ctx.esc(l.rotulo)}${l.atual ? ' · atual' : ''}</small><b>${f.int(l.vendidos)}</b><span>${f.brl(l.preco)} · até ${ctx.esc(l.ate)}</span>
      </div>`).join('');

    const origem = b.origem.linhas.map((o) => `<tr><td>${ctx.esc(o.rotulo)}</td><td class="num">${f.int(o.quantidade)}</td><td class="num">${f.pct(o.pct) ?? '—'}</td></tr>`).join('');

    return `<div class="bloco im-bloco" data-im-bloco="ingressos">
      <h2>1. Venda de ingressos <small>meta: ${f.int(b.vendidos.meta)} ingressos</small></h2>
      <div class="grid-etiquetas">${cards}</div>
      <div class="im-duas">
        <div><h3 class="im-h3">Faturamento por dia <small>ingressos + bump · previsto pela meta</small></h3>
          <div class="tabela-wrap im-rolagem"><table><thead><tr><th>Dia</th><th class="num">Ingressos</th><th class="num">Bumps</th><th class="num">Previsto</th><th class="num">Realizado</th></tr></thead><tbody>${linhasDia || '<tr><td colspan="5" class="mini">Nenhum dia de venda ainda.</td></tr>'}</tbody></table></div>${legenda}</div>
        <div><h3 class="im-h3">Vendas por origem <small>pela UTM</small></h3>
          <div class="tabela-wrap"><table><thead><tr><th>Origem</th><th class="num">Ingressos</th><th class="num">%</th></tr></thead><tbody>${origem}</tbody></table></div>
          <p class="im-ref im-ref--linha"><b>referência</b> ${ctx.esc(b.origem.referencia)}</p></div>
      </div>
      <h3 class="im-h3">Vendas por lote</h3>
      <div class="im-lotes">${lotes}</div>
    </div>`;
  }

  // ── Bloco 2 ────────────────────────────────────────────────────────────
  function tabelaRanking(ctx, rk) {
    const f = fmt(ctx);
    const lista = estado.ordem === 'custo' ? rk.por_custo : rk.por_vendas;
    if (!lista.length) return '<p class="mini">Sem anúncios com investimento no período.</p>';
    return `<div class="tabela-wrap"><table data-im-ranking="${estado.ordem}"><thead><tr><th>#</th><th>Anúncio</th><th class="num">Vendas</th><th class="num">Custo por venda</th><th class="num">Investimento</th></tr></thead><tbody>${
      lista.map((a, i) => `<tr><td>${i + 1}</td><td class="nome">${ctx.esc(a.anuncio)}<div class="mini">${ctx.esc(a.campanha)}</div></td><td class="num">${f.int(a.vendas)}</td><td class="num">${f.brl(a.custo_por_venda) ?? '—'}</td><td class="num">${f.brl(a.investimento)}</td></tr>`).join('')
    }</tbody></table></div>`;
  }

  function blocoTrafego(ctx, t) {
    const f = fmt(ctx);
    const cards = [
      card(ctx, { rotulo: 'CAC do ingresso', valor: f.brl(t.cac.valor), alerta: t.cac.alerta, nota: t.cac.alerta ? 'acima do teto antes da reta final' : `${f.int(t.ingressos_trafego)} ingressos do tráfego` }),
      card(ctx, { rotulo: 'CPA teto', valor: f.brl(t.cpa_teto.valor), faltaMeta: t.cpa_teto.falta_meta, nota: `verba ÷ ${f.num(t.cpa_teto.esperados_trafego)} ingressos do tráfego`, ref: t.cpa_teto.referencia }),
      card(ctx, { rotulo: 'CPM', valor: f.brl(t.cpm.valor) }),
      card(ctx, { rotulo: 'CTR', valor: f.pct(t.ctr.valor, 2), ref: t.ctr.referencia }),
      card(ctx, { rotulo: 'Connect rate', valor: f.pct(t.connect.valor), ref: t.connect.referencia }),
      card(ctx, { rotulo: 'Page to checkout', valor: f.pct(t.page_checkout.valor), ref: t.page_checkout.referencia }),
      card(ctx, { rotulo: 'Checkout to compra', valor: f.pct(t.checkout_compra.valor), ref: t.checkout_compra.referencia }),
    ].join('');
    const botoes = [['vendas', 'por vendas'], ['custo', 'por custo por venda']]
      .map(([id, rot]) => `<button type="button" data-im-ordem="${id}" aria-pressed="${estado.ordem === id}">${rot}</button>`).join('');
    return `<div class="bloco im-bloco" data-im-bloco="trafego">
      <h2>2. Tráfego e página <small>investimento em anúncios de ingresso: ${f.brl(t.investimento) ?? '—'}</small></h2>
      <div class="grid-etiquetas">${cards}</div>
      <h3 class="im-h3">Ranking de criativos <small>atualiza todo dia; revisar a cada 2 ou 3 dias</small></h3>
      <div class="abas im-ordem">${botoes}</div>
      <div data-im-ranking-wrap>${tabelaRanking(ctx, t.ranking)}</div>
    </div>`;
  }

  // ── Bloco 3 ────────────────────────────────────────────────────────────
  function blocoBump(ctx, b) {
    const f = fmt(ctx);
    const m = b.mentoria;
    const linhas = b.por_dia.slice().reverse().map((d) => `<tr><td>${dia(d.dia)}</td><td class="num">${f.int(d.ingressos)}</td><td class="num">${f.int(d.bumps)}</td><td class="num">${f.pct(d.conversao) ?? '—'}</td></tr>`).join('');
    const dif = vazio(m.diferenca_pct) ? null : `${m.diferenca_pct > 0 ? '+' : ''}${f.num(m.diferenca_pct, 0)}%`;
    const cards = [
      card(ctx, { rotulo: 'Conversão do bump', valor: f.pct(b.total.conversao), nota: `${f.int(b.total.bumps)} de ${f.int(b.total.ingressos)} · meta ${vazio(b.meta) ? 'a definir' : f.pct(b.meta, 0)}`, faltaMeta: false }),
      card(ctx, { rotulo: 'Mentoria · com bump', valor: f.pct(m.com_bump.conversao), nota: `${f.int(m.com_bump.mentorias)} de ${f.int(m.com_bump.compradores)}` }),
      card(ctx, { rotulo: 'Mentoria · sem bump', valor: f.pct(m.sem_bump.conversao), nota: `${f.int(m.sem_bump.mentorias)} de ${f.int(m.sem_bump.compradores)}` }),
      card(ctx, { rotulo: 'Diferença', valor: dif, ref: m.referencia }),
    ].join('');
    return `<div class="bloco im-bloco" data-im-bloco="bump">
      <h2>3. Order bump <small>aulas da Imersão · R$ 297</small></h2>
      <div class="grid-etiquetas">${cards}</div>
      <h3 class="im-h3">Conversão do bump por dia</h3>
      <div class="tabela-wrap im-rolagem"><table><thead><tr><th>Dia</th><th class="num">Ingressos</th><th class="num">Bumps</th><th class="num">Conversão</th></tr></thead><tbody>${linhas || '<tr><td colspan="4" class="mini">Nenhum dia de venda ainda.</td></tr>'}</tbody></table></div>
    </div>`;
  }

  // ── Bloco 4 ────────────────────────────────────────────────────────────
  const indisponivel = '<p class="im-indisponivel">Disponível a partir de 05/12.</p>';

  function blocoEvento(ctx, e) {
    const f = fmt(ctx);
    const corpo = !e.disponivel ? indisponivel : `<div class="grid-etiquetas">${[
      card(ctx, { rotulo: 'Comparecimento', valor: f.pct(e.comparecimento.valor), nota: vazio(e.comparecimento.presentes) ? 'pelo Meet' : `${f.int(e.comparecimento.presentes)} pessoas no Meet`, ref: e.comparecimento.referencia }),
      card(ctx, { rotulo: 'Pessoas ao vivo no pitch', valor: f.int(e.pico.valor), faltaMeta: e.pico.falta_meta, nota: e.pico.horario ? `pico entre ${e.pico.horario} e 30 min depois` : 'grave o horário da oferta', ref: e.pico.referencia }),
    ].join('')}</div>`;
    return `<div class="bloco im-bloco" data-im-bloco="evento"><h2>4. Evento <small>sábado 05/12 · 9h30 às 17h30 · Google Meet</small></h2>${corpo}</div>`;
  }

  // ── Bloco 5 ────────────────────────────────────────────────────────────
  function blocoResultado(ctx, r) {
    const f = fmt(ctx);
    if (!r.disponivel) return `<div class="bloco im-bloco" data-im-bloco="resultado"><h2>5. Venda depois do evento</h2>${indisponivel}</div>`;
    const d = r.destaque;
    const herois = [
      card(ctx, { rotulo: 'Pessoas ao vivo', valor: f.int(d.pessoas_ao_vivo), grande: true, nota: 'no momento da oferta' }),
      card(ctx, { rotulo: 'Ticket médio', valor: f.brl(d.ticket_medio), grande: true, nota: 'faturamento ÷ compradores' }),
      card(ctx, { rotulo: 'Conversão na Mentoria', valor: f.pct(d.conversao_mentoria), grande: true, nota: `meta ${vazio(d.meta_mentoria) ? 'a definir' : f.pct(d.meta_mentoria, 0)}`, ref: r.conversao_mentoria.referencia }),
    ].join('');
    const dx = r.dia_x_seguintes;
    const cards = [
      card(ctx, { rotulo: 'Mentoria no dia do pitch', valor: f.pct(dx.no_dia.conversao), nota: `${f.int(dx.no_dia.mentorias)} vendas em 05/12` }),
      card(ctx, { rotulo: 'Mentoria nos 14 dias seguintes', valor: f.pct(dx.seguintes.conversao), nota: `${f.int(dx.seguintes.mentorias)} vendas de 06/12 a 19/12`, ref: dx.referencia }),
      card(ctx, { rotulo: 'Faturamento total', valor: f.brl(r.faturamento.total), nota: `ingressos ${f.brl(r.faturamento.ingressos)} · bump ${f.brl(r.faturamento.bump)} · Mentoria ${f.brl(r.faturamento.mentoria)}` }),
      card(ctx, { rotulo: 'ROAS', valor: f.num(r.roas, 2), nota: 'faturamento ÷ investimento em anúncios' }),
    ].join('');
    return `<div class="bloco im-bloco" data-im-bloco="resultado">
      <h2>5. Venda depois do evento <small>resultado</small></h2>
      <div class="grid-heroi im-herois">${herois}</div>
      <div class="grid-etiquetas">${cards}</div>
    </div>`;
  }

  /** HTML da Visão geral inteira (sem as subabas). */
  function desenharVisao(r, ctx) {
    return blocoIngressos(ctx, r.ingressos) + blocoTrafego(ctx, r.trafego) + blocoBump(ctx, r.bump)
      + blocoEvento(ctx, r.evento) + blocoResultado(ctx, r.resultado);
  }

  /** Cabeçalho + conteúdo da subaba atual. */
  function desenhar(raiz, r, ctx) {
    const conteudo = estado.aba === 'visao'
      ? desenharVisao(r, ctx)
      : '<div class="bloco"><h2>Simulação</h2><p class="mini">Em construção.</p></div>';
    raiz.innerHTML = `<div class="im">${cabecalho(ctx, r)}<div class="im-conteudo" data-im-conteudo="${estado.aba}">${conteudo}</div></div>`;
  }

  async function abrir(raiz, ctx) {
    raiz.innerHTML = '<p class="mini">Carregando a Imersão 2027…</p>';
    let r;
    try {
      r = await ctx.fetchJson('/api/imersao');
    } catch (e) {
      raiz.innerHTML = '<p class="aviso alerta">Não foi possível carregar a Imersão 2027 agora.</p>';
      return;
    }
    estado.resposta = r;
    desenhar(raiz, r, ctx);
    if (raiz.dataset.imLigado) return;
    raiz.dataset.imLigado = '1';
    raiz.addEventListener('click', (ev) => {
      const aba = ev.target.closest('[data-im-aba]');
      if (aba) { estado.aba = aba.dataset.imAba; desenhar(raiz, estado.resposta, ctx); return; }
      const ordem = ev.target.closest('[data-im-ordem]');
      if (ordem) { estado.ordem = ordem.dataset.imOrdem; desenhar(raiz, estado.resposta, ctx); }
    });
  }

  window.Imersao = { abrir, desenhar, desenharVisao, _estado: () => estado, _definir: (e) => { estado = { ...estado, ...e }; } };
})();
