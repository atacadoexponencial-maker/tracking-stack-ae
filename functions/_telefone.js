// Regra única de telefone (spec-protecoes-integracoes.md, módulo 5).
//
// Antes havia quatro regras parecidas (normalizePhone no _hash.js e uma cópia
// no _core.js, toClickUpPhone, comNonoDigito) e nenhuma completava o nono
// dígito: o WhatsApp entrega `558496078857` e o lead digita `5584996078857`, e
// o mesmo celular virava duas pessoas. Toda porta de entrada passa a usar esta.
//
// Nunca inventa: número que não fecha um padrão fica como veio (só sem a
// formatação) e é sinalizado "impossivel" — o lead segue o fluxo normal.
//
// Prefixo "_": o Cloudflare Pages não transforma o arquivo em rota.

// DDDs brasileiros em uso (Anatel).
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * @returns {{ digitos: string, situacao: 'celular'|'fixo'|'estrangeiro'|'impossivel'|'ausente', original: string }}
 *   `digitos`: padronizado com DDI (ex.: 5511987654321). Em "impossivel", os
 *   dígitos como vieram.
 */
export function padronizarTelefone(bruto) {
  const original = bruto == null ? '' : String(bruto);
  let d = original.replace(/\D/g, '');
  if (!d) return { digitos: '', situacao: 'ausente', original };
  const comoVeio = d;
  const impossivel = { digitos: comoVeio, situacao: 'impossivel', original };

  // Prefixo de discagem internacional (00 55 11...).
  if (d.startsWith('00')) d = d.slice(2);
  // Zero de discagem nacional, sozinho (0 11 9...) ou com código de operadora (0 15 11 9...).
  else if (d.startsWith('0')) {
    if (d.length - 1 === 10 || d.length - 1 === 11) d = d.slice(1);
    else if (d.length - 3 === 10 || d.length - 3 === 11) d = d.slice(3);
  }

  if (/^(\d)\1+$/.test(d)) return impossivel;

  const comDdi = d.startsWith('55') && (d.length === 12 || d.length === 13);
  const nacional = comDdi ? d.slice(2) : d;

  if (nacional.length === 10 || nacional.length === 11) {
    const ddd = Number(nacional.slice(0, 2));
    const resto = nacional.slice(2);
    const celular9 = resto.length === 9 && resto[0] === '9';
    const celularSem9 = resto.length === 8 && /[6-9]/.test(resto[0]);
    const fixo = resto.length === 8 && /[2-5]/.test(resto[0]);
    const caraDeBrasileiro = celular9 || celularSem9 || fixo;

    if (caraDeBrasileiro) {
      if (!DDDS.has(ddd)) return impossivel;
      if (celular9) return { digitos: '55' + nacional, situacao: 'celular', original };
      if (celularSem9) return { digitos: '55' + nacional.slice(0, 2) + '9' + resto, situacao: 'celular', original };
      return { digitos: '55' + nacional, situacao: 'fixo', original };
    }
  }

  // Começa com 55 e não fechou nenhum padrão brasileiro.
  if (d.startsWith('55')) return impossivel;
  // Número internacional com código de outro país.
  if (d.length >= 8 && d.length <= 15) return { digitos: d, situacao: 'estrangeiro', original };
  return impossivel;
}

/**
 * Formas em que o MESMO celular pode estar gravado em sistemas antigos: o
 * padronizado e, para celular, a versão sem o nono dígito. Usado para achar o
 * lead que já existe e não duplicar.
 */
export function variantesTelefone(bruto) {
  const p = padronizarTelefone(bruto);
  if (!p.digitos) return [];
  if (p.situacao !== 'celular') return [p.digitos];
  return [p.digitos, p.digitos.slice(0, 4) + p.digitos.slice(5)];
}
