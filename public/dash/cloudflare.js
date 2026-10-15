// Aba Cloudflare: requisições de Functions da conta × teto do plano Free
// (spec-uso-cloudflare.md, série S1).
//
// Tudo vem pronto de /api/cloudflare-uso (S1-02 e S1-03): hoje, por projeto,
// os 30 dias, o mês, a faixa de cor, a palavra e o motivo de falha são
// decididos lá; aqui só se desenha.
//
// O index.html chama `CloudflareUso.abrir(raiz, ctx)` quando a aba aparece;
// ctx traz { esc, fmtInt, fmtPct, barras, api } do próprio dash.
(() => {
  'use strict';

  const dataBR = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

  const CARIMBO = { folga: 'alta', atencao: 'alerta', perto: 'queda' };

  function desenhar(raiz, ctx, d) {
    const { esc, fmtInt, fmtPct } = ctx;
    if (d.indisponivel) {
      raiz.innerHTML = `<div class="aviso falha">Números de uso indisponíveis: ${esc(d.motivo)}.</div>`;
      return;
    }
    const linhasProjetos = d.projetos.length
      ? d.projetos.map((p) => `<tr><td>${esc(p.nome)}</td><td class="num">${fmtInt(p.requisicoes)}</td></tr>`).join('')
        + `<tr class="cf-total"><td>Total da conta</td><td class="num">${fmtInt(d.hoje.requisicoes)}</td></tr>`
      : `<tr><td colspan="2" class="semdado">nenhuma requisição desde as ${esc(d.hoje.zera_as)}</td></tr>`;
    raiz.innerHTML = `
      <div class="bloco">
        <h2>Hoje contra o teto <small>requisições de Functions da conta inteira · zera às ${esc(d.hoje.zera_as)}</small></h2>
        <div class="grid-etiquetas">
          <div class="etiqueta heroi">
            <div class="ref">Hoje</div>
            <div class="valor">${fmtInt(d.hoje.requisicoes)} <span class="cf-de">de ${fmtInt(d.teto)}</span></div>
            <div class="regua cf-regua ${esc(d.hoje.faixa)}" role="img" aria-label="${fmtPct(d.hoje.porcentagem, 0)} do teto diário"><i style="width:${Math.min(100, d.hoje.porcentagem)}%"></i></div>
            <div class="rodape"><span class="carimbo ${CARIMBO[d.hoje.faixa] || 'neutro'}">${esc(d.hoje.palavra)}</span><span class="nota">${fmtPct(d.hoje.porcentagem, 0)} usado · restam ${fmtInt(d.hoje.restam)}</span></div>
          </div>
        </div>
      </div>
      <div class="bloco">
        <h2>Por projeto hoje <small>do maior para o menor</small></h2>
        <div class="tabela-wrap"><table>
          <thead><tr><th>Projeto</th><th class="num">Requisições</th></tr></thead>
          <tbody>${linhasProjetos}</tbody>
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
  }

  window.CloudflareUso = {
    async abrir(raiz, ctx) {
      raiz.innerHTML = '<p class="mini">Lendo o uso na Cloudflare…</p>';
      desenhar(raiz, ctx, await ctx.api('/api/cloudflare-uso'));
    },
  };
})();
