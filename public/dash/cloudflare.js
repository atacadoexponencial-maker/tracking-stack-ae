// Aba Cloudflare: requisições de Functions da conta × teto do plano Free
// (spec-uso-cloudflare.md, série S1).
//
// PROTÓTIPO (issue S1-01): todos os números abaixo são EXEMPLO fixo, só para
// aprovar o visual. Na S1-02/S1-03 eles saem e os números, a faixa de cor e o
// texto de falha passam a vir prontos do backend; aqui só se desenha.
//
// O index.html chama `CloudflareUso.abrir(raiz, ctx)` quando a aba aparece;
// ctx traz { esc, fmtInt, fmtPct, barras } do próprio dash.
(() => {
  'use strict';

  const TETO = 100000;

  // 30 dias de exemplo terminando em 15/10 (12/10 = 9.649 e 874, como na spec;
  // 02/10 com zero para mostrar que dia vazio não some).
  const DIAS_EXEMPLO = (() => {
    const base = [7700, 7820, 8105, 7990, 8340, 8012, 7655, 7410, 8230, 8475, 8120,
      7980, 8310, 8650, 8840, 9120, 9480, 9905, 0, 9310, 9560,
      9820, 10240, 10410, 9980, 10560, 9649, 6120, 5890, 5710];
    const estouros = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 40, 131,
      340, 241, 179, 210, 592, 874, 163, 22, 8];
    const fim = new Date(Date.UTC(2026, 9, 15));
    return base.map((req, i) => {
      const d = new Date(fim.getTime() - (29 - i) * 86400000);
      return { dia: d.toISOString().slice(0, 10), requisicoes: req, estouros: estouros[i] };
    });
  })();

  const ESTADOS = {
    folga: { hoje: 35000, faixa: 'folga' },
    atencao: { hoje: 70000, faixa: 'atencao' },
    perto: { hoje: 92000, faixa: 'perto' },
    indisponivel: { erro: 'credencial recusada pela Cloudflare' },
  };
  const FAIXAS = {
    folga: { palavra: 'folga', carimbo: 'alta' },
    atencao: { palavra: 'atenção', carimbo: 'alerta' },
    perto: { palavra: 'perto do teto', carimbo: 'queda' },
  };

  const exemplo = (estado) => {
    const e = ESTADOS[estado];
    if (e.erro) return { erro: e.erro };
    const trackingAe = Math.round((e.hoje * 6) / 7 / 1000) * 1000;
    const projetos = [
      { nome: 'tracking-ae', requisicoes: trackingAe },
      { nome: 'painel', requisicoes: e.hoje - trackingAe },
    ];
    return {
      teto: TETO,
      hoje: { requisicoes: e.hoje, faixa: e.faixa, porcentagem: (e.hoje / TETO) * 100, zera_as: '21h de Brasília' },
      projetos,
      dias: DIAS_EXEMPLO,
      mes: {
        requisicoes: DIAS_EXEMPLO.slice(-15).reduce((s, d) => s + d.requisicoes, 0),
        estouros: DIAS_EXEMPLO.slice(-15).reduce((s, d) => s + d.estouros, 0),
      },
      lido_as: '14:05',
    };
  };

  const dataBR = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

  function desenhar(raiz, ctx, estado) {
    const { esc, fmtInt, fmtPct } = ctx;
    const d = exemplo(estado);
    const seletor = `
      <div class="em-proto">
        <span class="em-proto__selo">Protótipo</span>
        <span>números de exemplo, não são da conta</span>
        <label class="cf-estado">ver estado do exemplo
          <select id="cf-estado">
            ${Object.keys(ESTADOS).map((k) => `<option value="${k}"${k === estado ? ' selected' : ''}>${{ folga: 'folga', atencao: 'atenção', perto: 'perto do teto', indisponivel: 'indisponível' }[k]}</option>`).join('')}
          </select>
        </label>
      </div>`;

    if (d.erro) {
      raiz.innerHTML = `${seletor}<div class="aviso falha">Números de uso indisponíveis: ${esc(d.erro)}.</div>`;
      ligar(raiz, ctx);
      return;
    }

    const f = FAIXAS[d.hoje.faixa];
    const totalProjetos = d.projetos.reduce((s, p) => s + p.requisicoes, 0);
    raiz.innerHTML = `${seletor}
      <div class="bloco">
        <h2>Hoje contra o teto <small>requisições de Functions da conta inteira · zera às ${esc(d.hoje.zera_as)}</small></h2>
        <div class="grid-etiquetas">
          <div class="etiqueta heroi">
            <div class="ref">Hoje</div>
            <div class="valor">${fmtInt(d.hoje.requisicoes)} <span class="cf-de">de ${fmtInt(d.teto)}</span></div>
            <div class="regua cf-regua ${esc(d.hoje.faixa)}" role="img" aria-label="${fmtPct(d.hoje.porcentagem, 0)} do teto diário"><i style="width:${Math.min(100, d.hoje.porcentagem)}%"></i></div>
            <div class="rodape"><span class="carimbo ${f.carimbo}">${esc(f.palavra)}</span><span class="nota">${fmtPct(d.hoje.porcentagem, 0)} usado · restam ${fmtInt(Math.max(0, d.teto - d.hoje.requisicoes))}</span></div>
          </div>
        </div>
      </div>
      <div class="bloco">
        <h2>Por projeto hoje <small>do maior para o menor</small></h2>
        <div class="tabela-wrap"><table>
          <thead><tr><th>Projeto</th><th class="num">Requisições</th></tr></thead>
          <tbody>
            ${d.projetos.map((p) => `<tr><td>${esc(p.nome)}</td><td class="num">${fmtInt(p.requisicoes)}</td></tr>`).join('')}
            <tr class="cf-total"><td>Total da conta</td><td class="num">${fmtInt(totalProjetos)}</td></tr>
          </tbody>
        </table></div>
      </div>
      <div class="bloco">
        <h2>Últimos 30 dias <small>teto: ${fmtInt(d.teto)} por dia · para cima, requisições · para baixo, estouros de CPU</small></h2>
        <div class="grafico" id="cf-grafico"></div>
        <details class="cf-dias">
          <summary class="mini">ver os 30 dias em tabela</summary>
          <div class="tabela-wrap"><table class="cf-tabela-dias">
            <thead><tr><th>Dia</th><th class="num">Requisições</th><th class="num">Estouros de CPU</th></tr></thead>
            <tbody>${d.dias.slice().reverse().map((x) => `<tr><td data-rot="Dia">${dataBR(x.dia)}</td><td class="num" data-rot="Requisições">${fmtInt(x.requisicoes)}</td><td class="num" data-rot="Estouros de CPU">${fmtInt(x.estouros)}</td></tr>`).join('')}</tbody>
          </table></div>
        </details>
      </div>
      <div class="bloco">
        <h2>Mês corrente <small>acumulado desde o dia 1º · o plano Free não tem limite mensal</small></h2>
        <div class="grid-etiquetas">
          <div class="etiqueta"><div class="ref">Requisições no mês</div><div class="valor">${fmtInt(d.mes.requisicoes)}</div></div>
          <div class="etiqueta"><div class="ref">Estouros de CPU no mês</div><div class="valor">${fmtInt(d.mes.estouros)}</div></div>
        </div>
      </div>
      <p class="mini cf-lido">lido às ${esc(d.lido_as)} (horário de Brasília)</p>`;

    ctx.barras(raiz.querySelector('#cf-grafico'), d.dias.map((x) => ({
      v: x.requisicoes,
      v2: x.estouros,
      rot: dataBR(x.dia),
      dica: `${dataBR(x.dia)}<b>${fmtInt(x.requisicoes)} requisições</b><b>${fmtInt(x.estouros)} estouros de CPU</b>`,
    })), { resumo: 'Requisições e estouros de CPU por dia, últimos 30 dias' });
    ligar(raiz, ctx);
  }

  function ligar(raiz, ctx) {
    raiz.querySelector('#cf-estado').addEventListener('change', (ev) => desenhar(raiz, ctx, ev.target.value));
  }

  window.CloudflareUso = {
    abrir(raiz, ctx) { desenhar(raiz, ctx, 'folga'); },
  };
})();
