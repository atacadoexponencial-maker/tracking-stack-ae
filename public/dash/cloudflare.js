// Aba Cloudflare: requisições de Functions da conta × teto do plano Free
// (spec-uso-cloudflare.md, série S1).
//
// Hoje, por projeto e o horário da leitura vêm prontos de /api/cloudflare-uso
// (S1-02): números, faixa de cor, palavra e motivo de falha são decididos lá;
// aqui só se desenha. Últimos 30 dias e mês ainda são EXEMPLO fixo, marcados
// na tela, até a S1-03.
//
// O index.html chama `CloudflareUso.abrir(raiz, ctx)` quando a aba aparece;
// ctx traz { esc, fmtInt, fmtPct, barras, api } do próprio dash.
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

  // Mês de exemplo (S1-03 troca pelo real): soma dos dias de outubro do exemplo.
  const MES_EXEMPLO = {
    requisicoes: DIAS_EXEMPLO.slice(-15).reduce((s, d) => s + d.requisicoes, 0),
    estouros: DIAS_EXEMPLO.slice(-15).reduce((s, d) => s + d.estouros, 0),
  };

  const dataBR = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

  const CARIMBO = { folga: 'alta', atencao: 'alerta', perto: 'queda' };
  const seloExemplo = '<span class="em-proto__selo">Exemplo</span>';

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
        <h2><span>Últimos 30 dias ${seloExemplo}</span> <small>teto: ${fmtInt(d.teto)} por dia · para cima, requisições · para baixo, estouros de CPU</small></h2>
        <div class="grafico" id="cf-grafico"></div>
        <details class="cf-dias">
          <summary class="mini">ver os 30 dias em tabela</summary>
          <div class="tabela-wrap"><table class="cf-tabela-dias">
            <thead><tr><th>Dia</th><th class="num">Requisições</th><th class="num">Estouros de CPU</th></tr></thead>
            <tbody>${DIAS_EXEMPLO.slice().reverse().map((x) => `<tr><td data-rot="Dia">${dataBR(x.dia)}</td><td class="num" data-rot="Requisições">${fmtInt(x.requisicoes)}</td><td class="num" data-rot="Estouros de CPU">${fmtInt(x.estouros)}</td></tr>`).join('')}</tbody>
          </table></div>
        </details>
      </div>
      <div class="bloco">
        <h2><span>Mês corrente ${seloExemplo}</span> <small>acumulado desde o dia 1º · o plano Free não tem limite mensal</small></h2>
        <div class="grid-etiquetas">
          <div class="etiqueta"><div class="ref">Requisições no mês</div><div class="valor">${fmtInt(MES_EXEMPLO.requisicoes)}</div></div>
          <div class="etiqueta"><div class="ref">Estouros de CPU no mês</div><div class="valor">${fmtInt(MES_EXEMPLO.estouros)}</div></div>
        </div>
      </div>
      <p class="mini cf-lido">lido às ${esc(d.lido_as)} (horário de Brasília)</p>`;

    ctx.barras(raiz.querySelector('#cf-grafico'), DIAS_EXEMPLO.map((x) => ({
      v: x.requisicoes,
      v2: x.estouros,
      rot: dataBR(x.dia),
      dica: `${dataBR(x.dia)}<b>${fmtInt(x.requisicoes)} requisições</b><b>${fmtInt(x.estouros)} estouros de CPU</b>`,
    })), { resumo: 'Exemplo: requisições e estouros de CPU por dia, últimos 30 dias' });
  }

  window.CloudflareUso = {
    async abrir(raiz, ctx) {
      raiz.innerHTML = '<p class="mini">Lendo o uso na Cloudflare…</p>';
      desenhar(raiz, ctx, await ctx.api('/api/cloudflare-uso'));
    },
  };
})();
