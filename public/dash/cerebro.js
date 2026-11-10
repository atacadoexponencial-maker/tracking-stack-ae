// Aba Cérebro (série S9 do gestor-ae, issue S9-04).
//
// Só desenha: o painel vem pronto de /api/cerebro (montado na VPS pela coleta das 3h).
// O index.html chama `Cerebro.abrir(raiz, ctx)` quando a aba aparece; ctx traz
// { esc, fmtInt, fetchJson } do próprio dash. Só números: nenhuma conversa chega aqui.
(() => {
  'use strict';

  const SUBABAS = [
    { id: 'visao', rotulo: 'Visão geral' },
    { id: 'agentes', rotulo: 'Por agente' },
    { id: 'historico', rotulo: 'Histórico' },
    { id: 'problemas', rotulo: 'Problemas da semana' },
  ];
  const NUMEROS = [
    { id: 'buscas', rotulo: 'Buscas no cérebro', parte: 'vazias', nota: 'a parte clara são as buscas vazias' },
    { id: 'respostas_que_usaram', rotulo: 'Respostas que usaram o cérebro' },
    { id: 'repeticoes', rotulo: 'Pedidos repetidos ao índice' },
    { id: 'propostos', rotulo: 'Itens propostos pela digestão' },
  ];
  const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  let estado = { aba: 'visao', semana: 0, numero: 'buscas', resposta: null };

  const vazio = (v) => v === null || v === undefined;
  const ddmm = (ymd) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
  const pct = (parte, todo) => (todo ? Math.round((parte * 100) / todo) : null);

  function quando(iso) {
    const d = new Date(iso);
    const p = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(d);
    const v = Object.fromEntries(p.map((x) => [x.type, x.value]));
    return `${v.day}/${v.month} às ${v.hour}h${v.minute}`;
  }

  function n(ctx, v) {
    return vazio(v) ? '<span class="semdado">—</span>' : ctx.esc(ctx.fmtInt(v));
  }

  function diferenca(ctx, c) {
    if (!c) return '';
    const sinal = c.diferenca > 0 ? '+' : '';
    const classe = c.diferenca > 0 ? 'alta' : c.diferenca < 0 ? 'queda' : 'neutro';
    const p = vazio(c.pct) ? '' : ` (${sinal}${c.pct}%)`;
    return `<span class="dif ${classe}">${ctx.esc(`${sinal}${ctx.fmtInt(c.diferenca)}${p}`)} vs semana anterior</span>`;
  }

  function card(ctx, { rotulo, valor, linhas, cmp }) {
    const corpo = (linhas || []).filter(Boolean).map((l) => `<div class="cb-linha">${l}</div>`).join('');
    return `<div class="etiqueta cb-card">
      <div class="ref">${ctx.esc(rotulo)}</div>
      <div class="valor">${valor}</div>
      ${cmp ? `<div class="cb-cmp">${cmp}</div>` : ''}
      <div class="cb-linhas">${corpo}</div>
    </div>`;
  }

  function visao(ctx, s) {
    const b = s.busca || {};
    const sinc = s.sincronizacao || {};
    const rot = s.rotinas || {};
    const dg = s.digestao || {};
    const sl = dg.slack;
    const wa = dg.whatsapp;
    const propostos = [sl, wa].reduce((t, x) => (x ? (t || 0) + x.propostos : t), null);
    const c = s.comparacao || {};
    const tempo = vazio(b.tempo_medio_s) ? null : `busca leva em média ${String(b.tempo_medio_s).replace('.', ',')} s`;
    const usaram = pct(b.respostas_que_usaram, b.respostas_com_busca);
    return `<div class="grid-etiquetas cb-grid">
      ${card(ctx, {
        rotulo: 'Os agentes usam o cérebro?', valor: n(ctx, b.buscas), cmp: diferenca(ctx, c.buscas),
        linhas: [
          vazio(b.buscas) ? null : `${n(ctx, b.vazias)} voltaram vazias${vazio(pct(b.vazias, b.buscas)) ? '' : ` <b>(${pct(b.vazias, b.buscas)}%)</b>`}`,
          vazio(b.erros) ? null : `${n(ctx, b.erros)} deram erro`,
          tempo && ctx.esc(tempo),
        ],
      })}
      ${card(ctx, {
        rotulo: 'As rotinas estão saudáveis?', valor: vazio(rot.rodadas) ? n(ctx, null) : n(ctx, rot.falhas),
        linhas: [
          vazio(rot.rodadas) ? null : `falhas nas ${n(ctx, rot.rodadas)} rodadas das 17h`,
          vazio(sinc.reindexacoes) ? null : `${n(ctx, sinc.reindexacoes)} reindexações da busca`,
          vazio(sinc.repeticoes) ? null : `${n(ctx, sinc.repeticoes)} pedidos repetidos ao serviço de índice`,
          vazio(sinc.puladas) ? null : `${n(ctx, sinc.puladas)} sincronizações puladas por trava`,
          vazio(s.maior_atraso_min) ? '<span class="semdado">atraso até a busca: sem dados nesta semana</span>' : `maior atraso até a busca: ${n(ctx, s.maior_atraso_min)} min`,
        ],
      })}
      ${card(ctx, {
        rotulo: 'A digestão está boa?', valor: n(ctx, propostos),
        linhas: [
          sl ? ctx.esc(`Slack: ${sl.propostos} propostos, ${sl.aprovados} aprovados, ${sl.recusados} recusados, ${sl.pendentes} esperando`) : null,
          wa ? ctx.esc(`WhatsApp: ${wa.propostos} propostos, ${wa.aprovados} aprovados, ${wa.recusados} recusados${wa.feedbacks ? `, ${wa.feedbacks} feedbacks` : ''}`) : null,
          vazio(s.hot_saiu) ? null : `${n(ctx, s.hot_saiu)} itens saíram do hot na limpeza`,
        ],
      })}
      ${card(ctx, {
        rotulo: 'O cérebro ajuda nas respostas?', valor: vazio(usaram) ? n(ctx, null) : ctx.esc(`${usaram}%`), cmp: diferenca(ctx, c.respostas_que_usaram),
        linhas: [
          vazio(b.respostas_com_busca) ? null : `${n(ctx, b.respostas_que_usaram)} de ${n(ctx, b.respostas_com_busca)} respostas no Slack usaram algo que a busca trouxe`,
          '<span class="semdado">Estimativa: conta a resposta que repete um nome ou número vindo da busca.</span>',
        ],
      })}
    </div>`;
  }

  function agentes(ctx, s, nomes) {
    const linhas = Object.entries(s.agentes || {}).filter(([, a]) => a).sort((x, y) => y[1].buscas - x[1].buscas);
    if (!linhas.length) return '<p class="semdado">Sem buscas nesta semana.</p>';
    const c = (s.comparacao || {}).agentes || {};
    const corpo = linhas.map(([nome, a]) => {
      const pv = pct(a.vazias, a.buscas);
      return `<tr>
        <th scope="row">${ctx.esc(nome)} <span class="semdado">${ctx.esc(nomes[nome] || '')}</span></th>
        <td class="num">${n(ctx, a.buscas)}${c[nome] ? `<br>${diferenca(ctx, c[nome])}` : ''}</td>
        <td class="num${pv >= 50 && a.buscas >= 10 ? ' cb-ruim' : ''}">${n(ctx, a.vazias)}${vazio(pv) ? '' : ` (${pv}%)`}</td>
        <td class="num">${n(ctx, a.erros)}</td>
        <td class="num">${vazio(a.tempo_medio_s) ? n(ctx, null) : ctx.esc(String(a.tempo_medio_s).replace('.', ',') + ' s')}</td>
        <td class="num">${n(ctx, a.respostas_que_usaram)} de ${n(ctx, a.respostas_com_busca)}</td>
      </tr>`;
    }).join('');
    return `<div class="tabela-wrap"><table>
      <thead><tr><th scope="col">Agente</th><th scope="col" class="num">Buscas</th><th scope="col" class="num">Vazias</th><th scope="col" class="num">Erros</th><th scope="col" class="num">Tempo médio</th><th scope="col" class="num">Respostas que usaram o cérebro</th></tr></thead>
      <tbody>${corpo}</tbody></table></div>`;
  }

  function historico(ctx, dias) {
    const escolha = NUMEROS.find((x) => x.id === estado.numero) || NUMEROS[0];
    const opcoes = NUMEROS.map((x) => `<option value="${x.id}"${x.id === escolha.id ? ' selected' : ''}>${ctx.esc(x.rotulo)}</option>`).join('');
    const maior = Math.max(1, ...dias.map((d) => d[escolha.id] || 0));
    const barras = dias.map((d) => {
      const dt = new Date(d.dia + 'T12:00:00Z');
      const rotulo = `${DIAS[dt.getUTCDay()]} ${d.dia.slice(8, 10)}`;
      if (d.sem_dados || vazio(d[escolha.id])) {
        return `<div class="cb-dia"><span class="cb-num semdado">sem dados</span><div class="cb-barra"></div><span class="cb-rot">${ctx.esc(rotulo)}</span></div>`;
      }
      const v = d[escolha.id];
      const altura = Math.round((v * 160) / maior);
      const clara = escolha.parte && d[escolha.parte] ? Math.round((d[escolha.parte] * 160) / maior) : 0;
      return `<div class="cb-dia"><span class="cb-num">${ctx.esc(ctx.fmtInt(v))}</span>
        <div class="cb-barra" style="height:${altura}px"><div class="cb-escura" style="flex:${Math.max(0, altura - clara)}"></div><div class="cb-clara" style="flex:${clara}"></div></div>
        <span class="cb-rot">${ctx.esc(rotulo)}</span></div>`;
    }).join('');
    const resumo = dias.map((d) => `${ddmm(d.dia)}: ${d.sem_dados || vazio(d[escolha.id]) ? 'sem dados' : d[escolha.id]}`).join(', ');
    return `<label class="cb-escolha">Número <select data-cb-numero aria-label="Número do histórico">${opcoes}</select></label>
      ${escolha.nota ? `<p class="semdado cb-nota">${ctx.esc(escolha.nota)}</p>` : ''}
      <div class="cb-grafico tabela-wrap"><div class="cb-barras" role="img" aria-label="${ctx.esc(escolha.rotulo + ' por dia — ' + resumo)}">${barras}</div></div>`;
  }

  function problemas(ctx, s) {
    if (!(s.problemas || []).length) return '<p class="semdado">Nenhum problema nesta semana.</p>';
    return `<p class="semdado cb-nota">Nenhum destes é grave; avisos graves vão para o #notif-mah na hora.</p>
      <ul class="cb-problemas">${s.problemas.map((p) => `<li><b>${ctx.esc(p.quem)}</b><span>${ctx.esc(p.texto)}</span></li>`).join('')}</ul>`;
  }

  function desenhar(raiz, ctx) {
    const r = estado.resposta;
    if (!r || !r.painel) {
      raiz.innerHTML = '<div class="bloco"><h2>Cérebro</h2><p class="semdado">Ainda sem coleta. A primeira roda às 3h.</p></div>';
      return;
    }
    const semanas = r.painel.semanas || [];
    const s = semanas[estado.semana] || semanas[0];
    const opcoes = semanas.map((x, i) => `<option value="${i}"${i === estado.semana ? ' selected' : ''}>${ddmm(x.inicio)} a ${ddmm(x.fim)}${x.em_andamento ? ' (em andamento)' : ''}</option>`).join('');
    const atraso = r.atrasada ? '<div class="im-faixa-exemplo" role="status"><b>Números atrasados</b> · a coleta das 3h não rodou depois desta data; peça ao Claude para olhar a VPS.</div>' : '';
    const abas = SUBABAS.map((a) => `<button type="button" role="tab" data-cb-aba="${a.id}" aria-selected="${estado.aba === a.id}">${ctx.esc(a.rotulo)}</button>`).join('');
    const notaSemana = !s ? '' : s.em_andamento ? 'semana em andamento: sem comparação até ela fechar'
      : s.comparacao ? '' : 'sem semana anterior para comparar';
    let corpo = '';
    if (!s) corpo = '<p class="semdado">Sem semanas coletadas.</p>';
    else if (estado.aba === 'visao') corpo = visao(ctx, s);
    else if (estado.aba === 'agentes') corpo = agentes(ctx, s, r.painel.agentes || {});
    else if (estado.aba === 'historico') corpo = historico(ctx, r.painel.historico || []);
    else corpo = problemas(ctx, s);
    raiz.innerHTML = `<div class="bloco">
      <h2>Cérebro <small>se o segundo cérebro está sendo usado e se está ajudando · só números, nenhuma conversa fica guardada</small></h2>
      <div class="cb-topo">
        <label class="cb-escolha">Semana <select data-cb-semana aria-label="Semana">${opcoes}</select></label>
        <span class="semdado">Última coleta: ${ctx.esc(quando(r.gerado_em))}</span>
      </div>
      ${atraso}
      <div class="im-subabas" role="tablist" aria-label="Cérebro">${abas}</div>
      ${notaSemana && estado.aba !== 'historico' ? `<p class="semdado cb-nota">${ctx.esc(notaSemana)}</p>` : ''}
      ${corpo}
    </div>`;
  }

  function ligar(raiz, ctx) {
    raiz.onclick = (ev) => {
      const aba = ev.target.closest('[data-cb-aba]');
      if (aba) { estado.aba = aba.dataset.cbAba; desenhar(raiz, ctx); }
    };
    raiz.onchange = (ev) => {
      if (ev.target.matches('[data-cb-semana]')) estado.semana = Number(ev.target.value) || 0;
      else if (ev.target.matches('[data-cb-numero]')) estado.numero = ev.target.value;
      else return;
      desenhar(raiz, ctx);
    };
  }

  async function abrir(raiz, ctx) {
    if (!raiz) return;
    ligar(raiz, ctx);
    if (!estado.resposta) raiz.innerHTML = '<div class="bloco"><h2>Cérebro</h2><p class="semdado">Carregando…</p></div>';
    try {
      estado.resposta = await ctx.fetchJson('/api/cerebro');
    } catch {
      raiz.innerHTML = '<div class="bloco"><h2>Cérebro</h2><p class="semdado">Não consegui carregar o painel do cérebro.</p></div>';
      return;
    }
    desenhar(raiz, ctx);
  }

  window.Cerebro = { abrir };
})();
