# 147: Redirect por material no /tracker (funil iscas-manychat)

**Tipo:** Implementação
**Página:** backend (`functions/tracker.js`)
**Spec:** `docs/superpowers/specs/2026-07-27-paginas-materiais-iscas-design.md`
**Depende de:** issue 146 (catálogo)

## Descrição

Ensinar o roteamento pós-captação do `/tracker` a atender o funil
`iscas-manychat`: o destino do lead é o link do Drive do material que ele baixou,
resolvido pelo `material` enviado no `lead_data`.

## Cenários

### Happy Path
1. Chega um `Lead` com `lead_data.funnel === 'iscas-manychat'` e
   `lead_data.material === 'icp'`.
2. O tracker resolve o destino via `materialPorSlug('icp').destino`.
3. Responde `{ ok: true, redirect: '<link do Drive>' }`.

### Edge Cases
- `material` ausente, vazio ou fora do catálogo → `redirect: '/obrigada'`
  (fallback silencioso, sem quebrar o fluxo do lead).
- Funil `iscas-manychat` continua passando normalmente por Meta CAPI, GA4 e CRM
  Supabase — nenhum ramo novo nesses caminhos.

## Arquivos

- **Modificar:** `functions/tracker.js` — importar `materialPorSlug` de
  `src/data/materiais.js`; novo ramo no bloco de roteamento pós-captação
  (por volta da linha 316, junto de `workshop`, `lives-semanais-v1` e
  `trafego-atacado`) para `iscas-manychat`.

## Restrições

- Não alterar o comportamento de nenhum funil existente.
- O catálogo é a única fonte do destino — nada de URL hardcoded no tracker.

## Checklist

- [x] Ramo `iscas-manychat` no roteamento pós-captação
- [x] Destino resolvido pelo catálogo, via `materialPorSlug`
- [x] Slug ausente/desconhecido cai em `/obrigada`
- [x] Comentário explicando o ramo, no padrão dos vizinhos
- [x] `tests/materiais.test.js`: slug válido, slug desconhecido, slugs únicos
- [x] `npm test` passando
