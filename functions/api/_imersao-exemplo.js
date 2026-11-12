// Dados de exemplo da Imersão 2027 (spec-imersao-2027.md, S8, PER-S8-08).
//
// Usados enquanto a Zouti não registrar nenhum ingresso pago. Fictícios mas
// coerentes entre si (CA-S8-31): compras ≤ inícios de checkout ≤ visualizações
// ≤ cliques ≤ impressões, mentorias ≤ compradores. "Hoje" é fixo em 26/11 14h,
// no meio da venda; o evento e o pós-evento vêm preenchidos mesmo assim, para
// a usuária ver o desenho dos blocos 4 e 5.
import { LOTES_IMERSAO } from '../../src/data/lotes-imersao.js';
import { diasEntre, indiceDoLote, PRECO_BUMP } from './_imersao.js';

export const AGORA_EXEMPLO = Date.parse('2026-11-26T14:00:00-03:00') / 1000;

export const METAS_EXEMPLO = {
  verba_ingresso: 3500,
  pct_trafego: 75,
  meta_bump: 25,
  meta_mentoria: 20,
  horario_oferta: '16:00',
};

// Ingressos por dia, de 09/11 a 26/11 (o último dia vai até 14h).
const POR_DIA = [1, 2, 2, 3, 2, 2, 3, 6, 3, 3, 4, 7, 4, 3, 4, 7, 8, 2];

// Visitas na página por dia (soma = 960 visualizações), para a conversão do dia.
const VISITAS_DIA = [30, 38, 40, 45, 42, 40, 48, 70, 52, 50, 58, 80, 60, 55, 62, 78, 92, 20];

const ANUNCIOS = [
  { anuncio: 'Planejamento 2027 · vídeo Felipe', campanha: '[IMERSAO] Ingresso · Vídeos', investimento: 720 },
  { anuncio: 'Erros de coleção · carrossel', campanha: '[IMERSAO] Ingresso · Estáticos', investimento: 410 },
  { anuncio: 'Depoimento Valentt', campanha: '[IMERSAO] Ingresso · Vídeos', investimento: 380 },
  { anuncio: 'Lote subindo · stories', campanha: '[IMERSAO] Ingresso · Remarketing', investimento: 390 },
  { anuncio: 'Bastidores do método', campanha: '[IMERSAO] Ingresso · Vídeos', investimento: 280 },
];
// Peso de cada anúncio nas vendas pagas (o primeiro vende mais).
const RODIZIO_ANUNCIO = [0, 0, 1, 0, 2, 3, 0, 1, 4, 0, 2, 0];

const em = (ymd, hora, minuto = 0) => Date.parse(`${ymd}T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00-03:00`) / 1000;
const preco = (unix) => Number(String(LOTES_IMERSAO[indiceDoLote(unix)].valor).replace(/\D/g, ''));

export function dadosDeExemplo() {
  const vendas = [];
  const dias = diasEntre('2026-11-09', '2026-11-26');
  let n = 0;
  dias.forEach((dia, i) => {
    for (let k = 0; k < POR_DIA[i]; k++) {
      n += 1;
      const hora = dia === '2026-11-26' ? 9 + k : 9 + ((k * 4 + i) % 13);
      const quando = em(dia, hora, (n * 7) % 60);
      const email = `pessoa${n}@exemplo.com`;
      // 3 de cada 4 pelo tráfego pago; o resto entre bio, base e sem UTM.
      const r = n % 20;
      let utm;
      if (r < 15) utm = { utm_source: 'facebookads', utm_medium: 'cpc', utm_campaign: 'imersao-ingresso', utm_content: ANUNCIOS[RODIZIO_ANUNCIO[n % RODIZIO_ANUNCIO.length]].anuncio };
      else if (r < 17) utm = { utm_source: 'instagram', utm_campaign: 'bioperfil-imersao' };
      else if (r < 19) utm = { utm_source: 'whatsapp', utm_medium: 'disparo', utm_campaign: 'base-imersao' };
      else utm = {};
      vendas.push({ id: `i${n}`, produto: 'ingresso', valor: preco(quando), pago_em: quando, email, ...utm, situacao: 'paga' });
      // Cerca de 1 em 4 leva o bump.
      if (n % 4 === 1) vendas.push({ id: `b${n}`, produto: 'bump', valor: PRECO_BUMP, pago_em: quando, email, situacao: 'paga' });
    }
  });
  // Uma compra cancelada, para mostrar que não entra nos números.
  vendas.push({ id: 'i-cancelada', produto: 'ingresso', valor: 39, pago_em: em('2026-11-20', 11), email: 'cancelou@exemplo.com', situacao: 'cancelada' });

  // Mentoria: 5 no dia do pitch e 6 nos 14 dias seguintes, mais vendida a
  // quem levou o bump.
  const mentoria = [
    [1, '2026-12-12', 16, 40], [5, '2026-12-12', 16, 52], [9, '2026-12-12', 17, 5], [22, '2026-12-12', 17, 20], [30, '2026-12-12', 17, 41],
    [13, '2026-12-14', 10, 0], [17, '2026-12-15', 15, 30], [40, '2026-12-16', 11, 15], [44, '2026-12-18', 14, 0], [25, '2026-12-21', 9, 45], [51, '2026-12-24', 16, 10],
  ];
  for (const [p, dia, h, m] of mentoria) {
    vendas.push({ id: `m${p}`, produto: 'mentoria', valor: 9700, pago_em: em(dia, h, m), email: `pessoa${p}@exemplo.com`, situacao: 'paga' });
  }

  // Meet do dia 12/12: 43 pessoas; parte sai antes da oferta das 16h.
  const meet = [];
  for (let p = 1; p <= 43; p++) {
    const entrou = em('2026-12-12', 9, 25 + (p % 20));
    const saiu = p <= 31 ? em('2026-12-12', 17, 30) : em('2026-12-12', 11 + (p % 4), 10 * (p % 5));
    meet.push({ pessoa: `pessoa${p}`, entrou, saiu });
  }

  return {
    vendas,
    trafego: { investimento: ANUNCIOS.reduce((s, a) => s + a.investimento, 0), impressoes: 112000, cliques: 1150 },
    visualizacoes: VISITAS_DIA.reduce((a, b) => a + b, 0),
    visitas_por_dia: Object.fromEntries(dias.map((d, i) => [d, VISITAS_DIA[i]])),
    inicios_checkout: 140,
    anuncios: ANUNCIOS,
    meet,
  };
}
