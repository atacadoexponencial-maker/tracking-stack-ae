// Aba Imersão 2027 (spec-imersao-2027.md, série S8).
//
// Só desenha: toda conta vem pronta de /api/imersao (functions/api/_imersao.js).
// O index.html chama `Imersao.abrir(raiz, ctx)` quando a aba aparece; ctx traz
// { esc, fmtInt, fmtPct, fmtNum, money, fetchJson } do próprio dash.
(() => {
  'use strict';

  // Revisão de 10/11 (S8-04): Resumo para bater o olho + uma subaba por bloco.
  const SUBABAS = [
    { id: 'resumo', rotulo: 'Resumo' },
    { id: 'ingressos', rotulo: 'Ingressos' },
    { id: 'trafego', rotulo: 'Tráfego e página' },
    { id: 'bump', rotulo: 'Bump' },
    { id: 'evento', rotulo: 'Evento e pós' },
    { id: 'simulacao', rotulo: 'Simulação' },
    { id: 'metas', rotulo: 'Metas' },
  ];
  const COR_TEXTO = { forte: 'superou muito', claro: 'superou', vermelho: 'abaixo' };

  let estado = { aba: 'resumo', ordem: 'vendas', resposta: null };

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
      <h2>Venda de ingressos <small>meta: ${f.int(b.vendidos.meta)} ingressos</small></h2>
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
      card(ctx, {
        rotulo: 'Cadastros na janela',
        valor: f.int(t.cadastros.total),
        nota: t.cadastros.total > 0
          ? `${f.int(t.cadastros.compraram)} ${t.cadastros.compraram === 1 ? 'comprou' : 'compraram'} o ingresso (${f.pct(t.cadastros.conversao)})`
          : 'ninguém preencheu a janela antes do checkout ainda',
      }),
    ].join('');
    const botoes = [['vendas', 'por vendas'], ['custo', 'por custo por venda']]
      .map(([id, rot]) => `<button type="button" data-im-ordem="${id}" aria-pressed="${estado.ordem === id}">${rot}</button>`).join('');
    return `<div class="bloco im-bloco" data-im-bloco="trafego">
      <h2>Tráfego e página <small>investimento em anúncios de ingresso: ${f.brl(t.investimento) ?? '—'}</small></h2>
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
      <h2>Order bump <small>aulas da Imersão · R$ 297</small></h2>
      <div class="grid-etiquetas">${cards}</div>
      <h3 class="im-h3">Conversão do bump por dia</h3>
      <div class="tabela-wrap im-rolagem"><table><thead><tr><th>Dia</th><th class="num">Ingressos</th><th class="num">Bumps</th><th class="num">Conversão</th></tr></thead><tbody>${linhas || '<tr><td colspan="4" class="mini">Nenhum dia de venda ainda.</td></tr>'}</tbody></table></div>
    </div>`;
  }

  // ── Bloco 4 ────────────────────────────────────────────────────────────
  const indisponivel = '<p class="im-indisponivel">Disponível a partir de 12/12.</p>';

  function blocoEvento(ctx, e) {
    const f = fmt(ctx);
    const corpo = !e.disponivel ? indisponivel : `<div class="grid-etiquetas">${[
      card(ctx, { rotulo: 'Comparecimento', valor: f.pct(e.comparecimento.valor), nota: vazio(e.comparecimento.presentes) ? 'pelo Meet' : `${f.int(e.comparecimento.presentes)} pessoas no Meet`, ref: e.comparecimento.referencia }),
      card(ctx, { rotulo: 'Pessoas ao vivo no pitch', valor: f.int(e.pico.valor), faltaMeta: e.pico.falta_meta, nota: e.pico.horario ? `pico entre ${e.pico.horario} e 30 min depois` : 'grave o horário da oferta', ref: e.pico.referencia }),
    ].join('')}</div>`;
    return `<div class="bloco im-bloco" data-im-bloco="evento"><h2>Evento <small>sábado 12/12 · 9h30 às 17h30 · Google Meet</small></h2>${corpo}</div>`;
  }

  // ── Bloco 5 ────────────────────────────────────────────────────────────
  function blocoResultado(ctx, r) {
    const f = fmt(ctx);
    if (!r.disponivel) return `<div class="bloco im-bloco" data-im-bloco="resultado"><h2>Venda depois do evento</h2>${indisponivel}</div>`;
    const d = r.destaque;
    const herois = [
      card(ctx, { rotulo: 'Pessoas ao vivo', valor: f.int(d.pessoas_ao_vivo), grande: true, nota: 'no momento da oferta' }),
      card(ctx, { rotulo: 'Ticket médio', valor: f.brl(d.ticket_medio), grande: true, nota: 'faturamento ÷ compradores' }),
      card(ctx, { rotulo: 'Conversão na Mentoria', valor: f.pct(d.conversao_mentoria), grande: true, nota: `meta ${vazio(d.meta_mentoria) ? 'a definir' : f.pct(d.meta_mentoria, 0)}`, ref: r.conversao_mentoria.referencia }),
    ].join('');
    const dx = r.dia_x_seguintes;
    const cards = [
      card(ctx, { rotulo: 'Mentoria no dia do pitch', valor: f.pct(dx.no_dia.conversao), nota: `${f.int(dx.no_dia.mentorias)} vendas em 12/12` }),
      card(ctx, { rotulo: 'Mentoria nos 14 dias seguintes', valor: f.pct(dx.seguintes.conversao), nota: `${f.int(dx.seguintes.mentorias)} vendas de 13/12 a 26/12`, ref: dx.referencia }),
      card(ctx, { rotulo: 'Faturamento total', valor: f.brl(r.faturamento.total), nota: `ingressos ${f.brl(r.faturamento.ingressos)} · bump ${f.brl(r.faturamento.bump)} · Mentoria ${f.brl(r.faturamento.mentoria)}` }),
      card(ctx, { rotulo: 'ROAS', valor: f.num(r.roas, 2), nota: 'faturamento ÷ investimento em anúncios' }),
    ].join('');
    return `<div class="bloco im-bloco" data-im-bloco="resultado">
      <h2>Venda depois do evento <small>resultado</small></h2>
      <div class="grid-heroi im-herois">${herois}</div>
      <div class="grid-etiquetas">${cards}</div>
    </div>`;
  }

  // ── Metas editáveis (S8-02) ────────────────────────────────────────────
  const CAMPOS = [
    { id: 'verba_ingresso', rotulo: 'Verba de anúncios de ingresso (R$)', tipo: 'text', modo: 'decimal' },
    { id: 'pct_trafego', rotulo: '% de ingressos esperado do tráfego pago', tipo: 'text', modo: 'decimal', padrao: '75' },
    { id: 'meta_bump', rotulo: 'Meta de conversão do bump (%)', tipo: 'text', modo: 'decimal' },
    { id: 'meta_mentoria', rotulo: 'Meta de conversão na Mentoria (%)', tipo: 'text', modo: 'decimal' },
    { id: 'horario_oferta', rotulo: 'Horário da oferta no dia 12/12', tipo: 'text', modo: 'text', dica: 'HH:MM' },
  ];

  function formMetas(ctx, m) {
    const erros = estado.erros || {};
    const campos = CAMPOS.map((c) => {
      const salvo = m.origem && m.origem[c.id] === 'salva' ? m[c.id] : '';
      const valor = estado.digitado && c.id in estado.digitado ? estado.digitado[c.id] : (vazio(salvo) ? '' : salvo);
      const exemplo = m.origem && m.origem[c.id] === 'exemplo' ? `exemplo: ${m[c.id]}` : (c.padrao ? `padrão: ${c.padrao}` : (c.dica || 'sem meta'));
      return `<label class="im-campo${erros[c.id] ? ' im-campo--erro' : ''}"><span>${ctx.esc(c.rotulo)}</span>
        <input name="${c.id}" type="${c.tipo}" inputmode="${c.modo}" value="${ctx.esc(valor)}" placeholder="${ctx.esc(exemplo)}">
        ${erros[c.id] ? `<small class="im-erro" data-im-erro="${c.id}">${ctx.esc(erros[c.id])}</small>` : ''}</label>`;
    }).join('');
    const msg = estado.msgMetas ? `<p class="im-msg${estado.msgMetasErro ? ' im-msg--erro' : ''}" role="status">${ctx.esc(estado.msgMetas)}</p>` : '';
    return `<div class="bloco im-bloco im-metas" data-im-bloco="metas"><h2>Metas do lançamento <small>meta de ingressos: ${ctx.fmtInt(m.meta_ingressos)} · fixa</small></h2>
      <form data-im-form-metas novalidate>${campos}
        <div class="im-metas-acoes"><button type="submit" class="botao">Salvar metas</button>${msg}</div>
        <p class="mini">Vale para todo mundo que abre o dash. Campo vazio = sem meta.</p>
      </form></div>`;
  }

  async function salvarMetas(raiz, form, ctx) {
    const corpo = {};
    for (const c of CAMPOS) corpo[c.id] = form.elements[c.id].value;
    estado.digitado = corpo;
    let res;
    try {
      res = await ctx.postJson('/api/imersao/metas', corpo);
    } catch {
      res = { ok: false, status: 0, dados: {} };
    }
    if (res.ok) {
      estado = { ...estado, resposta: res.dados, erros: null, digitado: null, msgMetas: 'Metas salvas.', msgMetasErro: false };
    } else if (res.status === 400 && res.dados && res.dados.erros) {
      estado = { ...estado, erros: res.dados.erros, msgMetas: res.dados.erro || 'Confira os campos marcados.', msgMetasErro: true };
    } else {
      estado = { ...estado, erros: null, msgMetas: 'Não foi possível salvar as metas agora.', msgMetasErro: true };
    }
    desenhar(raiz, estado.resposta, ctx);
  }

  // ── Resumo (S8-04) ─────────────────────────────────────────────────────
  /** Gráfico de barras: ingressos por dia + marca da meta do dia. Só desenha o que veio pronto. */
  function graficoVendaDia(ctx, linhas) {
    if (!linhas.length) return '<p class="mini">Nenhum dia de venda ainda.</p>';
    const f = fmt(ctx);
    const W = 640, H = 170, base = H - 22, topo = 12, esq = 26;
    const max = Math.max(1, ...linhas.map((l) => Math.max(l.ingressos, l.meta_ingressos || 0)));
    const passo = (W - esq) / linhas.length;
    const larg = Math.max(4, Math.min(22, passo - 4));
    const y = (v) => base - ((base - topo) * v) / max;
    const salto = Math.ceil(linhas.length / 9);
    const colunas = linhas.map((l, i) => {
      const cx = esq + passo * i + passo / 2;
      const alto = base - y(l.ingressos);
      const raio = Math.min(4, alto, larg / 2);
      const barra = l.ingressos > 0
        ? `<path class="im-graf-barra" d="M${cx - larg / 2},${base} V${y(l.ingressos) + raio} q0,-${raio} ${raio},-${raio} h${larg - 2 * raio} q${raio},0 ${raio},${raio} V${base} Z"/>` : '';
      const meta = l.meta_ingressos ? `<line class="im-graf-meta" x1="${cx - larg / 2 - 3}" x2="${cx + larg / 2 + 3}" y1="${y(l.meta_ingressos)}" y2="${y(l.meta_ingressos)}"/>` : '';
      const rot = i % salto === 0 ? `<text class="im-graf-eixo" x="${cx}" y="${H - 6}" text-anchor="middle">${dia(l.dia)}</text>` : '';
      const dica = `${dia(l.dia)}: ${f.int(l.ingressos)} ingressos · meta do dia ${vazio(l.meta_ingressos) ? '—' : f.num(l.meta_ingressos)} · ${f.brl(l.faturamento)}`;
      return `<g class="im-graf-col">${barra}${meta}${rot}<rect class="im-graf-alvo" x="${cx - passo / 2}" y="${topo}" width="${passo}" height="${base - topo}"><title>${ctx.esc(dica)}</title></rect></g>`;
    }).join('');
    const grade = `<line class="im-graf-base" x1="${esq}" x2="${W}" y1="${base}" y2="${base}"/><text class="im-graf-eixo" x="${esq - 6}" y="${topo + 4}" text-anchor="end">${f.int(Math.round(max))}</text><text class="im-graf-eixo" x="${esq - 6}" y="${base}" text-anchor="end">0</text>`;
    return `<div class="im-graf-legenda"><span><i class="im-leg-barra"></i>ingressos vendidos</span><span><i class="im-leg-meta"></i>meta de ingressos do dia</span></div>
      <svg class="im-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingressos vendidos por dia e meta do dia" data-im-grafico>${grade}${colunas}</svg>`;
  }

  function desenharResumo(r, ctx) {
    const f = fmt(ctx);
    const z = r.resumo;
    const c = z.cards;
    const barra = `<div class="im-barra" aria-hidden="true"><span style="width:${Math.min(100, c.vendidos.pct || 0)}%"></span></div>`;
    const porDia = c.por_dia.encerrada ? card(ctx, { rotulo: 'Precisa vender por dia', valor: 'Venda encerrada' })
      : c.por_dia.meta_batida ? card(ctx, { rotulo: 'Precisa vender por dia', valor: 'Meta batida' })
      : card(ctx, { rotulo: 'Precisa vender por dia', valor: vazio(c.por_dia.valor) ? null : `${f.num(c.por_dia.valor)}/dia`, nota: `${f.int(c.por_dia.faltam)} ingressos em ${f.int(c.por_dia.dias)} dias` });
    const cards = [
      card(ctx, { rotulo: 'Vendidos x meta', valor: `${f.int(c.vendidos.valor)} de ${f.int(c.vendidos.meta)}`, nota: `${f.pct(c.vendidos.pct, 0)} da meta`, extra: barra }),
      card(ctx, { rotulo: 'Faturamento até agora', valor: f.brl(c.faturamento_ate_agora), nota: 'ingressos + bump' }),
      porDia,
      card(ctx, { rotulo: 'CAC x CPA teto', valor: f.brl(c.cac.valor), alerta: c.cac.alerta, nota: c.cac.falta_meta ? 'teto: defina a verba em Metas' : `teto ${f.brl(c.cac.teto) ?? '—'}${c.cac.alerta ? ' · acima do teto' : ''}` }),
      card(ctx, { rotulo: 'Bump x meta', valor: f.pct(c.bump.conversao), nota: `meta ${vazio(c.bump.meta) ? 'a definir' : f.pct(c.bump.meta, 0)}` }),
    ].join('');

    const p = z.projecao;
    const projecao = p.encerrada ? '' : `<p class="im-projecao" data-im-projecao>No ritmo atual (${f.num(p.ritmo_atual)}/dia) a venda termina com <b>${f.int(Math.round(p.projetado_fim))} ingressos</b> · ${p.bate_meta
      ? `<span class="im-cor im-cor--forte">bate a meta em ${dia(p.bate_em)}</span>`
      : `<span class="im-cor im-cor--vermelho">não bate a meta · faltam ${f.int(p.faltam_no_fim)}</span>`}</p>`;

    const alertas = z.alertas.length
      ? `<ul class="im-alertas" data-im-alertas>${z.alertas.map((a) => `<li data-im-alerta="${ctx.esc(a.chave)}"><b aria-hidden="true">!</b> ${ctx.esc(a.texto)}</li>`).join('')}</ul>`
      : '<p class="im-alertas-ok" data-im-alertas>Nada fora do previsto.</p>';

    const linhas = z.venda_por_dia.slice().reverse().map((d) => `<tr>
        <td>${dia(d.dia)}</td><td class="num">${f.int(d.ingressos)}</td><td class="num">${vazio(d.meta_ingressos) ? '—' : f.num(d.meta_ingressos)}</td>
        <td class="num">${f.brl(d.faturamento)}</td><td class="num">${f.pct(d.conversao, 2) ?? '—'}</td>
        <td class="num">${vazio(d.atingimento) ? '—' : `<span class="im-cor im-cor--${d.cor || 'neutra'}" title="${ctx.esc(COR_TEXTO[d.cor] || '')}">${f.pct(d.atingimento, 0)}</span>`}</td>
      </tr>`).join('');

    return `<div class="bloco im-bloco" data-im-bloco="resumo">
      <h2>Estado do lançamento <small>meta: ${f.int(c.vendidos.meta)} ingressos até 12/12</small></h2>
      <div class="grid-etiquetas">${cards}</div>
      ${projecao}
      <h3 class="im-h3">Alertas</h3>${alertas}
      <h3 class="im-h3">Venda por dia</h3>
      ${graficoVendaDia(ctx, z.venda_por_dia)}
      <div class="tabela-wrap im-rolagem"><table data-im-venda-dia><thead><tr><th>Dia</th><th class="num">Ingressos</th><th class="num">Meta do dia</th><th class="num">Faturamento</th><th class="num">Conversão</th><th class="num">Atingimento</th></tr></thead><tbody>${linhas || '<tr><td colspan="6" class="mini">Nenhum dia de venda ainda.</td></tr>'}</tbody></table></div>
      <p class="mini im-legenda">Conversão = ingressos ÷ visitas da página no dia · atingimento = faturamento ÷ previsto do dia: <span class="im-cor im-cor--forte">verde forte</span> 20% ou mais acima · <span class="im-cor im-cor--claro">verde claro</span> acima ou igual · <span class="im-cor im-cor--vermelho">vermelho</span> abaixo</p>
    </div>`;
  }

  /** HTML de uma subaba (sem o cabeçalho). */
  function desenharAba(aba, r, ctx) {
    if (aba === 'ingressos') return blocoIngressos(ctx, r.ingressos);
    if (aba === 'trafego') return blocoTrafego(ctx, r.trafego);
    if (aba === 'bump') return blocoBump(ctx, r.bump);
    if (aba === 'evento') return blocoEvento(ctx, r.evento) + blocoResultado(ctx, r.resultado);
    if (aba === 'metas') return formMetas(ctx, r.metas);
    if (aba === 'simulacao') return cascaSimulacao(ctx);
    return desenharResumo(r, ctx);
  }

  // ── Simulação (S8-03) ──────────────────────────────────────────────────
  /** Resultado da projeção (sem o campo de ajuste). */
  function desenharSimulacao(s, ctx) {
    const f = fmt(ctx);
    if (!s) return '<p class="mini">Calculando a projeção…</p>';
    if (s.erro) return `<p class="aviso alerta">${ctx.esc(s.erro)}</p>`;
    const veredito = s.bate_meta
      ? `<span class="im-cor im-cor--forte">Bate a meta em ${dia(s.bate_em)}</span>`
      : `<span class="im-cor im-cor--vermelho">Não bate a meta · faltam ${f.int(s.faltam_no_fim)}</span>`;
    const cards = [
      card(ctx, { rotulo: 'Ingressos no fim', valor: f.int(Math.round(s.projetado_fim)), grande: true, nota: `${f.int(s.vendidos)} hoje + ${f.num(s.ritmo_usado)}/dia × ${f.int(s.dias)} dias`, extra: `<div class="im-veredito">${veredito}</div>` }),
      card(ctx, { rotulo: 'Ritmo atual', valor: `${f.num(s.ritmo_atual)}/dia`, nota: 'média dos últimos 3 dias de venda' }),
      card(ctx, { rotulo: 'Ritmo necessário', valor: vazio(s.ritmo_necessario) ? null : `${f.num(s.ritmo_necessario)}/dia`, nota: 'para bater 100 ingressos' }),
      card(ctx, { rotulo: 'Faturamento projetado', valor: f.brl(s.faturamento.total), nota: `realizado ${f.brl(s.faturamento.realizado)} + ingressos ${f.brl(s.faturamento.ingressos_projetados)} + bump ${f.brl(s.faturamento.bump_projetado)}` }),
    ].join('');
    const linhas = s.linhas.map((l) => `<tr${l.dia === s.bate_em ? ' class="im-linha-meta"' : ''}><td>${dia(l.dia)}</td><td class="num">${f.brl(l.preco)}</td><td class="num">${f.num(l.ingressos)}</td><td class="num">${f.num(l.acumulado)}</td></tr>`).join('');
    return `<div class="grid-etiquetas">${cards}</div>
      <h3 class="im-h3">Dia a dia <small>até sexta 11/12 · o sábado 12/12 só tem a manhã</small></h3>
      <div class="tabela-wrap im-rolagem"><table><thead><tr><th>Dia</th><th class="num">Lote</th><th class="num">Ingressos</th><th class="num">Acumulado</th></tr></thead><tbody>${linhas || '<tr><td colspan="4" class="mini">Venda encerrada.</td></tr>'}</tbody></table></div>`;
  }

  function cascaSimulacao(ctx) {
    return `<div class="bloco im-bloco" data-im-bloco="simulacao">
      <h2>Projeção até o fim <small>se o ritmo continuar; nada aqui é gravado</small></h2>
      <div class="im-ajuste">
        <label for="im-ajuste">Ajuste de ritmo (%)</label>
        <input id="im-ajuste" type="number" step="5" value="${ctx.esc(estado.ajuste || 0)}" data-im-ajuste>
        <button type="button" data-im-zerar>Voltar ao ritmo atual</button>
      </div>
      <div data-im-sim>${desenharSimulacao(estado.sim, ctx)}</div>
    </div>`;
  }

  async function carregarSimulacao(raiz, ctx) {
    const pedido = (estado.pedidoSim || 0) + 1;
    estado.pedidoSim = pedido;
    let s;
    try {
      s = await ctx.fetchJson(`/api/imersao/simulacao?ajuste=${encodeURIComponent(estado.ajuste || 0)}`);
    } catch {
      s = { erro: 'Não foi possível calcular a simulação agora.' };
    }
    if (pedido !== estado.pedidoSim) return; // chegou uma resposta mais nova
    estado.sim = s;
    const alvo = raiz.querySelector && raiz.querySelector('[data-im-sim]');
    if (alvo) alvo.innerHTML = desenharSimulacao(s, ctx);
  }

  /** Cabeçalho + conteúdo da subaba atual. */
  function desenhar(raiz, r, ctx) {
    if (!SUBABAS.some((a) => a.id === estado.aba)) estado.aba = 'resumo';
    const conteudo = desenharAba(estado.aba, r, ctx);
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
    if (estado.aba === 'simulacao') carregarSimulacao(raiz, ctx);
    if (raiz.dataset.imLigado) return;
    raiz.dataset.imLigado = '1';
    raiz.addEventListener('click', (ev) => {
      const aba = ev.target.closest('[data-im-aba]');
      if (aba) {
        estado.aba = aba.dataset.imAba;
        desenhar(raiz, estado.resposta, ctx);
        if (estado.aba === 'simulacao') carregarSimulacao(raiz, ctx);
        return;
      }
      if (ev.target.closest('[data-im-zerar]')) {
        estado.ajuste = 0;
        const campo = raiz.querySelector('[data-im-ajuste]');
        if (campo) campo.value = '0';
        carregarSimulacao(raiz, ctx);
        return;
      }
      const ordem = ev.target.closest('[data-im-ordem]');
      if (ordem) { estado.ordem = ordem.dataset.imOrdem; desenhar(raiz, estado.resposta, ctx); }
    });
    let espera = null;
    raiz.addEventListener('input', (ev) => {
      if (!ev.target.matches('[data-im-ajuste]')) return;
      estado.ajuste = ev.target.value === '' ? 0 : Number(ev.target.value);
      clearTimeout(espera);
      espera = setTimeout(() => carregarSimulacao(raiz, ctx), 300);
    });
    raiz.addEventListener('submit', (ev) => {
      const form = ev.target.closest('[data-im-form-metas]');
      if (!form) return;
      ev.preventDefault();
      salvarMetas(raiz, form, ctx);
    });
  }

  window.Imersao = { abrir, desenhar, desenharAba, desenharResumo, desenharSimulacao, salvarMetas, _estado: () => estado, _definir: (e) => { estado = { ...estado, ...e }; } };
})();
