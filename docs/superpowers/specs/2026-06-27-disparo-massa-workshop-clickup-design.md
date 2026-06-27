# Design — Disparo em massa do workshop (MQLs do ClickUp → WhatsApp)

**Data:** 2026-06-27
**Status:** Aprovado (aguardando inputs de execução)
**Prazo:** workshop em 30/06; disparo planejado para hoje (27/06).

## Objetivo

Disparar, em massa e com template aprovado, um convite do workshop (30/06) para os **MQLs** do CRM no ClickUp, via WhatsApp API oficial, orquestrado pelo n8n. Reusa a credencial de envio do WhatsApp e a do ClickUp que o n8n já possui.

## Fonte de dados (ClickUp)

- Lista **🤑 CRM** — id `205126080` (space "1 SETE ACELERADORA" → folder Comercial).
- **Filtro (quem recebe):** tarefas com o campo **`🥇 MQL`** marcado (custom field id `818e9198-e84a-4695-b4da-b902ef363ea9`, tipo emoji ✅) **E** status em um dos **8 permitidos**:
  - leads de entrada · qualificação · cynthia · follow ra · reunião · follow rr · follow futuro · nutrição (follow infinito)
- **Excluídos** (não recebem): proposta/negociação · contrato · desqualificado · proposta recusada · contrato assinado.
  - Obs.: alguns excluídos são tipo done/closed, e "nutrição" (permitido) é tipo done — por isso o filtro vai por **lista explícita de status permitidos**, não por "incluir concluídos".
- **Campos extraídos por tarefa:**
  - Telefone → **`☎️ Whatsapp`** (custom field id `754a41c9-2835-48d5-a70e-8b61841e0037`, tipo phone).
  - Nome → **`👤 Nome`** (custom field id `7f70363f-9fc4-4d34-aab1-0a81d4a6f45d`) — só para log (template não tem variável).

## Arquitetura (workflow n8n novo)

Workflow "Disparos em massa click-up", **gatilho manual**. Separado do barramento de lead novo.

```
Manual Trigger
 → ClickUp: busca tarefas da lista 205126080
      - filtra pelos 8 status permitidos (server-side)
      - filtra 🥇 MQL (via custom_fields na API, OU nó Filter no n8n)
      - paginação (~100/página) até esgotar
 → Code: normaliza telefone (mesma normalizePhone do tracker — tira não-dígitos,
         remove zeros à esquerda, prefixa 55) + dedup (telefones repetidos/ inválidos)
 → Loop com ritmo controlado (intervalo entre envios)
      → HTTP Request → Graph API WhatsApp: envia o template do workshop
          - components: header com a IMAGEM (link público); sem body params
          - Continue on Fail ligado
 → Log: quem recebeu / quem falhou (evita reenvio duplicado)
```

## Envio (WhatsApp Graph API)

- Endpoint: `https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages`. Credencial `WhatsApp account` (a mesma da live).
- Template **aprovado**, **sem variáveis de corpo**, com **imagem no header** → cada envio precisa mandar a imagem (a Meta não reusa a do template no disparo). Imagem hospedada em **URL pública** (subir nos assets do site ou enviar como media e usar o id).
- Body do template: `type: template`, `name: <TEMPLATE>`, `language: { code: <LANG> }`, `components: [{ type: 'header', parameters: [{ type: 'image', image: { link: <IMG_URL> } }] }]`.

## Cuidados (WhatsApp)

- **Limite por faixa de qualidade do número** (250 / 1k / 10k por 24h). Como é hoje, o volume precisa caber na faixa; o ritmo segura para não estourar.
- **Ritmo:** intervalo entre disparos para preservar a nota de qualidade.
- **Opt-in:** MQLs têm relação prévia (base legítima); evitar quem nunca interagiu.

## Inputs de execução (pendentes)

1. **Template:** nome exato + idioma (ex.: `pt_BR`).
2. **Phone Number ID** do remetente (o mesmo usado no disparo da live).
3. **Imagem** do header (arquivo ou URL pública).
4. **Volume aproximado de MQLs** (para checar limite/ritmo de hoje).

## Entrega

Fluxo montado como **JSON importável** no n8n (importar no workflow "Disparos em massa click-up" e selecionar as credenciais). Alternativa: montagem guiada nó a nó.

## Fora de escopo

- Receber resposta/conversa (é só disparo).
- Recorrência (é pontual para este workshop).
- Segmentação além de MQL + status.

## Critérios de sucesso

1. n8n busca do ClickUp **apenas** MQLs nos 8 status permitidos.
2. Telefone normalizado igual ao padrão do tracker (55+DDD).
3. Cada MQL recebe o template do workshop com a imagem.
4. Falhas individuais não travam o lote (Continue on Fail) e ficam logadas.
5. Ritmo respeita o limite do número (sem derrubar qualidade).
