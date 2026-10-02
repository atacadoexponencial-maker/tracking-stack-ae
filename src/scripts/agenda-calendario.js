// Calendário de horários da agenda própria (spec-agenda-propria.md, módulo 4).
// Usado pela página de agendar (/agendar/<tipo>) e pela de remarcar
// (/reuniao/<token>). Só desenha: os horários livres chegam prontos do
// servidor; aqui eles são agrupados por dia no fuso que o lead escolheu.

const FUSOS = [
  ['America/Sao_Paulo', 'Brasília (GMT-3)'],
  ['America/Manaus', 'Manaus (GMT-4)'],
  ['America/Rio_Branco', 'Rio Branco (GMT-5)'],
  ['America/Noronha', 'Fernando de Noronha (GMT-2)'],
  ['Europe/Lisbon', 'Lisboa'],
  ['America/New_York', 'Nova York'],
];

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function fusoDoNavegador() {
  try {
    const f = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return f || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

const ymdNoFuso = (unix, fuso) => new Date(unix * 1000).toLocaleDateString('sv-SE', { timeZone: fuso });
export const horaNoFuso = (unix, fuso) => new Date(unix * 1000).toLocaleTimeString('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit' });
export const dataLonga = (unix, fuso) => new Date(unix * 1000).toLocaleDateString('pt-BR', { timeZone: fuso, weekday: 'long', day: 'numeric', month: 'long' });

/**
 * Monta o calendário dentro de `raiz`.
 *   dias: { 'YYYY-MM-DD': [unix, ...] } do servidor (dias de Brasília)
 *   aoEscolher(unix, fuso): chamado ao tocar num horário
 * Devolve { definirDias(dias) } para recarregar depois de um conflito.
 */
export function montarCalendario(raiz, { dias, aoEscolher }) {
  // O calendário é desenhado por innerHTML, fora do CSS com escopo do Astro.
  if (!document.getElementById('cal-estilo')) {
    const s = document.createElement('style');
    s.id = 'cal-estilo';
    s.textContent = ESTILO_CALENDARIO;
    document.head.appendChild(s);
  }
  let fuso = fusoDoNavegador();
  if (!FUSOS.some(([f]) => f === fuso)) FUSOS.unshift([fuso, fuso.replace(/_/g, ' ')]);
  let porDia = {};
  let mesAtual = null;
  let diaEscolhido = null;

  raiz.innerHTML = `
    <div class="cal-wrap"><div class="cal">
      <div class="cal__esq">
        <div class="cal__mes">
          <button type="button" class="cal__nav" data-nav="-1" aria-label="Mês anterior"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
          <strong class="cal__titulo" aria-live="polite"></strong>
          <button type="button" class="cal__nav" data-nav="1" aria-label="Próximo mês"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
        </div>
        <div class="cal__grade" role="grid"></div>
        <label class="cal__fuso">Fuso horário
          <select>${FUSOS.map(([f, n]) => `<option value="${f}">${n}</option>`).join('')}</select>
        </label>
      </div>
      <div class="cal__horarios" aria-live="polite"></div>
    </div></div>`;
  const sel = raiz.querySelector('select');
  sel.value = fuso;

  function agrupar(diasServidor) {
    porDia = {};
    for (const lista of Object.values(diasServidor)) {
      for (const t of lista) {
        const d = ymdNoFuso(t, fuso);
        (porDia[d] = porDia[d] || []).push(t);
      }
    }
    for (const d of Object.keys(porDia)) porDia[d].sort((a, b) => a - b);
  }

  function mesesDisponiveis() {
    return [...new Set(Object.keys(porDia).map((d) => d.slice(0, 7)))].sort();
  }

  function desenharMes() {
    const meses = mesesDisponiveis();
    if (!meses.length) {
      raiz.querySelector('.cal__titulo').textContent = '';
      raiz.querySelector('.cal__grade').innerHTML = '';
      raiz.querySelector('.cal__horarios').innerHTML = '<p class="cal__vazio">Não há horários livres no momento.</p>';
      raiz.querySelectorAll('.cal__nav').forEach((b) => { b.disabled = true; });
      return;
    }
    if (!mesAtual || !meses.includes(mesAtual)) mesAtual = meses[0];
    const [ano, mes] = mesAtual.split('-').map(Number);
    raiz.querySelector('.cal__titulo').textContent = `${MESES[mes - 1]} ${ano}`;
    const primeiro = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
    const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    let html = SEMANA.map((s) => `<span class="cal__sem">${s}</span>`).join('');
    for (let i = 0; i < primeiro; i++) html += '<span></span>';
    for (let d = 1; d <= total; d++) {
      const ymd = `${mesAtual}-${String(d).padStart(2, '0')}`;
      const tem = !!porDia[ymd];
      html += `<button type="button" class="cal__dia${tem ? ' cal__dia--livre' : ''}${ymd === diaEscolhido ? ' cal__dia--ativo' : ''}"
        data-dia="${ymd}" ${tem ? '' : 'disabled'} aria-label="${d} de ${MESES[mes - 1]}${tem ? ', com horários' : ', sem horários'}">${d}</button>`;
    }
    raiz.querySelector('.cal__grade').innerHTML = html;
    const i = meses.indexOf(mesAtual);
    raiz.querySelector('[data-nav="-1"]').disabled = i <= 0;
    raiz.querySelector('[data-nav="1"]').disabled = i >= meses.length - 1;
    if (!diaEscolhido || !porDia[diaEscolhido]) {
      diaEscolhido = Object.keys(porDia).sort().find((x) => x.startsWith(mesAtual)) || null;
      if (diaEscolhido) return desenharMes();
    }
    desenharHorarios();
  }

  function desenharHorarios() {
    const el = raiz.querySelector('.cal__horarios');
    if (!diaEscolhido || !porDia[diaEscolhido]) { el.innerHTML = ''; return; }
    const [y, m, d] = diaEscolhido.split('-').map(Number);
    const titulo = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
    el.innerHTML = `<p class="cal__dia-titulo">${titulo}</p>
      <div class="cal__lista">${porDia[diaEscolhido].map((t) => `<button type="button" class="cal__hora" data-hora="${t}">${horaNoFuso(t, fuso)}</button>`).join('')}</div>`;
  }

  raiz.addEventListener('click', (ev) => {
    const nav = ev.target.closest('[data-nav]');
    if (nav) {
      const meses = mesesDisponiveis();
      mesAtual = meses[Math.max(0, Math.min(meses.length - 1, meses.indexOf(mesAtual) + Number(nav.dataset.nav)))];
      diaEscolhido = null;
      return desenharMes();
    }
    const dia = ev.target.closest('[data-dia]');
    if (dia && !dia.disabled) {
      diaEscolhido = dia.dataset.dia;
      desenharMes();
      // Calendário estreito (celular): os horários ficam abaixo; desce até eles.
      const lista = raiz.querySelector('.cal__horarios');
      if (raiz.querySelector('.cal').offsetWidth < 544 && lista) lista.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    const hora = ev.target.closest('[data-hora]');
    if (hora) aoEscolher(Number(hora.dataset.hora), fuso);
  });
  sel.addEventListener('change', () => {
    fuso = sel.value;
    agrupar(ultimo);
    diaEscolhido = null;
    desenharMes();
  });

  let ultimo = dias;
  agrupar(dias);
  desenharMes();
  return {
    definirDias(novos) { ultimo = novos; agrupar(novos); desenharMes(); },
    fuso: () => fuso,
    nomeDoFuso: () => (FUSOS.find(([f]) => f === fuso) || [fuso, fuso])[1],
  };
}

// Largura decide o desenho (container query, não a tela): na página de
// agendar o calendário divide o painel com o texto do evento; na de remarcar
// ocupa um cartão estreito. Largo: calendário à esquerda e horários em coluna
// à direita, tudo numa tela. Estreito: horários embaixo, em grade.
export const ESTILO_CALENDARIO = `
.cal-wrap { container-type: inline-size; }
.cal { display: grid; gap: 1.25rem; }
.cal__esq { display: grid; gap: .9rem; align-content: start; }
.cal__mes { display: flex; align-items: center; justify-content: space-between; }
.cal__titulo { font-size: 1.05rem; }
.cal__titulo::first-letter { text-transform: uppercase; }
.cal__nav { width: 2.5rem; height: 2.5rem; display: inline-grid; place-items: center; border-radius: 9999px; border: 1px solid rgba(30,30,30,.2); background: none; cursor: pointer; color: inherit; }
.cal__nav svg { width: 1.1rem; height: 1.1rem; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.cal__nav:disabled { opacity: .3; cursor: default; }
.cal__grade { display: grid; grid-template-columns: repeat(7, 1fr); gap: .3rem; text-align: center; }
.cal__sem { font-size: .7rem; text-transform: uppercase; letter-spacing: .08em; color: rgba(30,30,30,.55); padding-bottom: .2rem; }
.cal__dia { aspect-ratio: 1; max-height: 2.9rem; width: 100%; justify-self: center; border: none; border-radius: 9999px; background: none; font: inherit; color: rgba(30,30,30,.35); }
.cal__dia--livre { background: rgba(30,30,30,.08); color: #1e1e1e; font-weight: 700; cursor: pointer; }
.cal__dia--livre:hover { background: rgba(30,30,30,.16); }
.cal__dia--ativo, .cal__dia--ativo:hover { background: #1e1e1e; color: #fff; }
.cal__fuso { display: grid; gap: .3rem; font-size: .75rem; text-transform: uppercase; letter-spacing: .08em; color: rgba(30,30,30,.6); }
.cal__fuso select { font: inherit; text-transform: none; letter-spacing: 0; font-size: .95rem; padding: .6rem .8rem; border-radius: .6rem; border: 1px solid rgba(30,30,30,.2); background: #fff; color: #1e1e1e; }
.cal__dia-titulo { margin: 0 0 .6rem; font-weight: 700; }
.cal__dia-titulo::first-letter { text-transform: uppercase; }
.cal__lista { display: grid; grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr)); gap: .5rem; }
.cal__hora { padding: .75rem .5rem; border-radius: .6rem; border: 1px solid #1e1e1e; background: #fff; color: #1e1e1e; font: inherit; font-weight: 700; cursor: pointer; }
.cal__hora:hover { background: #1e1e1e; color: #fff; }
.cal__vazio { margin: 0; color: rgba(30,30,30,.7); }
@container (min-width: 34rem) {
  .cal { grid-template-columns: minmax(0, 1fr) 10.5rem; gap: 1.75rem; }
  .cal__horarios { border-left: 1px solid rgba(30,30,30,.1); padding-left: 1.5rem; max-height: 27rem; overflow-y: auto; }
  .cal__lista { grid-template-columns: 1fr; }
}
`;
