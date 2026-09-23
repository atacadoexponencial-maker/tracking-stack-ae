# 303: Desfazer uma pausa pela tela

**Tipo:** Implementação
**Página:** Aba Propostas (histórico) + executor na VPS — spec `spec-argo-aprovar-propostas.md`, módulos 3 e 4

## Descrição

Botão Desfazer nas pausas executadas, com confirmação na linha; o executor reativa o alvo a partir do estado anterior gravado e registra o desfazer como entrada nova ligada à ação original, sem alterar o registro da pausa. Alvo já ativo vira "já estava ativo".

## Pronto quando

Desfazer uma pausa no dash reativa o alvo no Gerenciador em até ~10 min, a linha mostra "Desfeita" com quem e quando, e o registro original da pausa continua intacto.

## Cenários

### Happy Path
1. No histórico, uma proposta "Executada e conferida" mostra **Desfazer**.
2. Confirmar na linha → `POST /api/argo/propostas {id, versao, decisao: "desfazer"}`
   grava o pedido (`desfazer_pedido_em/por`).
3. O executor (mesmo job de 10 min) reivindica o pedido, lê cada objeto que ELE
   pausou, grava a intenção como **ação nova** (`tipo = desfazer_pausa`,
   `desfaz_acao_id` → ação original), volta o status ao `estado_anterior`
   gravado, relê e confere.
4. Histórico: "Desfeita" com quem e quando; o registro da aba Controle mostra a
   pausa original intacta e a reativação como linha própria ("reativada").

### Edge Cases
- Alguém já reativou no Gerenciador: registra "já estava ativa", não mexe;
  situação "Desfeita — já estava ativa".
- Estado anterior diferente de ACTIVE/PAUSED: não restaura; "não conferida".
- Pedir desfazer duas vezes, ou de algo não executado: 409 explicado.
- Parada geral ligada: o desfazer também espera (é uma ação na conta).
- Anúncio com vários ids: reativa só os que o Argo pausou (resultado "pausou").

### Cenário de Erro
- Meta falha depois da intenção: "Desfazer não conferido — confira no Gerenciador".
- Rede no POST: mesma mensagem honesta das decisões.

## Banco de Dados

Migration `gestor-ae/migrations/argo/0004_desfazer.sql`:
- `argo.acoes.desfaz_acao_id` (BIGINT → argo.acoes) — a ação que esta desfaz
- `argo.propostas.desfazer_pedido_em` (TIMESTAMPTZ), `desfazer_pedido_por` (TEXT),
  `desfazer_estado` (executando/conferida/nao_conferida/nao_executou),
  `desfazer_em` (TIMESTAMPTZ), `desfazer_detalhe` (JSONB)

## Arquivos

- **Criar:** `gestor-ae/migrations/argo/0004_desfazer.sql`
- **Modificar:** `gestor-ae/.../argo_estado.py` — `registrar_acao(..., desfaz_acao_id=None)`,
  `reivindicar_desfazer`, `liberar_desfazer`, `concluir_desfazer`
- **Modificar:** `gestor-ae/.../argo_executor.py` (+ testes) — processa pedidos de desfazer
- **Modificar:** `functions/api/_argo-propostas.js`, `functions/api/argo/propostas.js`
  (+ `tests/argo-propostas.test.js`) — decisão `desfazer`, situação "desfeita", `pode_desfazer`
- **Modificar:** `functions/api/_argo-registro.js` (+ teste) — desfecho da ação
  `desfazer_pausa` ("reativada", "já estava ativa")
- **Modificar:** `public/dash/index.html` — botão Desfazer faz o POST

## Checklist

- [x] Migration 0004 aplicada
- [x] Executor desfaz com write-ahead e ação nova ligada à original
- [x] Endpoint aceita `desfazer` só de pausa conferida e ainda não desfeita
- [x] Histórico e registro mostram o desfazer sem alterar a pausa original
- [x] Testes verdes nos dois repos
