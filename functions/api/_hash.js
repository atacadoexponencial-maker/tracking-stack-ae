// Normalização e hash de PII para o Meta CAPI.
//
// Vivia dentro de `onRequestPost` em functions/tracker.js e não era importável.
// Saiu para cá quando a conversão "EntrouGrupo" passou a precisar das mesmas
// regras: o telefone de quem entra no grupo tem que ser normalizado e hasheado
// EXATAMENTE como o do formulário, senão o Meta trata a mesma pessoa como duas.
// O tracker importa daqui — não existem duas cópias.

import { padronizarTelefone } from '../_telefone.js';

export async function sha256(value) {
  if (!value) return '';
  const normalized = value.toLowerCase().trim();
  const encoded = new TextEncoder().encode(normalized);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Meta CAPI expects phone digits INCLUDING country code + area code
// (ex: `16505554444` or `5511987654321`). Users typing their own
// number into a lead form almost never include the country code, so
// we prepend a default. `countryCode` defaults to 55 (Brazil);
// recipients elsewhere set `env.DEFAULT_COUNTRY_CODE` — see the
// "decisions the recipient must make" table in CLAUDE.md.
//
// Detection is length-based and best-effort. A recipient whose
// audience mixes country codes (rare for the target audience) gets
// marginal mismatches; fixing that requires a real phone-parsing
// library which is too heavy for an edge worker.
// Regra única de telefone (spec-protecoes-integracoes.md): 55 + DDD + nono dígito
// para celular brasileiro, estrangeiro preservado, impossível como veio.
// `countryCode` fica na assinatura por compatibilidade com quem chama; a regra
// já trata o Brasil como padrão.
export function normalizePhone(ph, countryCode) {
  return padronizarTelefone(ph).digitos;
}

// Meta Advanced Matching spec for fn/ln is lowercase only — do NOT
// strip punctuation/accents. Meta's graph preserves apostrophes,
// hyphens, and diacritics; stripping them breaks hash matches for
// names like "O'Brien", "Garcia-Rodriguez", "João".
export function normalizeName(name) {
  if (!name) return '';
  return name.trim().toLowerCase();
}
