# 149: Card no ClickUp e notificação de WhatsApp para leads de isca

**Tipo:** Implementação
**Página:** backend (`functions/tracker.js`)
**Spec:** `docs/superpowers/specs/2026-07-27-paginas-materiais-iscas-design.md`
**Bloqueada por:** ID da opção **ISCA** no dropdown 🔻 Funil (passo manual da usuária)

## Descrição

Leads de material viram card no CRM como os demais funis, carimbados com a opção
🔻 Funil = **ISCA**, e disparam a mesma notificação interna de WhatsApp. Em ambos,
o nome do material precisa aparecer — sem isso o time vê um lead sem saber de
onde veio.

## Cenários

### Happy Path
1. Lead do funil `iscas-manychat` chega ao `/tracker`.
2. `sendToClickUp` cria a task com 🔻 Funil = ISCA e 🛒 Produto = AE (default).
3. A descrição do card inclui o material baixado (`icp`).
4. A notificação de WhatsApp sai como nos demais funis, citando o material.

### Edge Cases
- Lead repetido → comentário na task existente, como já acontece hoje, também
  citando o material.
- `material` vazio → card criado normalmente, sem a linha do material.
- Falha no ClickUp → caminho de retry/`clickup_sync_failures`/alerta já existente,
  sem alteração.

## Arquivos

- **Modificar:** `functions/tracker.js`:
  - constante `CU_FUNIL_ISCA` com o ID da opção nova;
  - `mapFunnelToOption` (linha ~647) mapeando `iscas-manychat` → `CU_FUNIL_ISCA`;
  - linha do material na descrição do card e no comentário de lead repetido;
  - nome do material no texto da notificação (`sendEvolutionMessage`, linhas
    ~908 e ~966).

## Restrições

- Não alterar o mapeamento dos funis existentes nem o default
  `CU_FUNIL_SESSAO`.
- `mapProdutoToOption` fica como está — isca segue no produto AE.

## Checklist

- [ ] Opção **ISCA** criada no ClickUp e ID obtido
- [ ] `CU_FUNIL_ISCA` + mapeamento em `mapFunnelToOption`
- [ ] Material na descrição do card e no comentário de repetido
- [ ] Material no texto da notificação de WhatsApp
- [ ] Lead de teste cria card com 🔻 Funil = ISCA e notifica
