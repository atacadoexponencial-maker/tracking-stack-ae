# 332: Protótipo — metas na Visão geral, na aba Leads e em Funis do relatório

**Tipo:** Protótipo
**Página:** Dash → Visão geral, Leads e Funis do relatório — spec `spec-metas-funil.md`, módulos 1, 2 e 3

## Descrição

Desenhar, com dados fictícios servidos pelo proxy local do scratchpad (nunca no repo), o cartão compacto de metas na Visão geral, o cartão detalhado no topo da aba Leads e o bloco "Metas" na linha da Sessão Estratégica na aba Funis do relatório. A gestora aprova o visual antes do backend.

## Pronto quando

Com o proxy de fixtures, as três telas mostram: título "Metas de <mês>" com "dados até DD/MM · faltam N dias"; os quatro indicadores (CPL, leads novos, MQLs, custo por MQL) com realizado, meta e cor (verde/âmbar/coral); na aba Leads, barras de progresso, projeção e "precisa de N por dia"; os estados "—", "sem meta", "meta atingida", "nenhuma meta cadastrada", CRM fora do ar e investimento não sincronizado; a nota "as metas mostram sempre o mês corrente" com filtro diferente; e, em Funis do relatório, os quatro campos, a última alteração, o histórico e os outros funis desabilitados. Segue o DESIGN.md. Prints em 1440px e 390px.

## Checklist

- [x] Contrato de dados do cartão e do cadastro fixado aqui (a 333 e a 334 implementam).
- [x] Cartão compacto na Visão geral.
- [x] Cartão detalhado na aba Leads.
- [x] Bloco Metas em Funis do relatório (card próprio "Metas mensais", desvio anotado acima).
- [x] Todos os estados de borda com fixture (modos cheio, sem-meta, crm-fora, dia-1, atingida, falha; validação e erro do servidor no salvar).
- [x] Prints 1440/390 (`.playwright-mcp/metas-*.png`). Aprovação: a gestora autorizou seguir até o fim (28/09); o visual segue o do Argo aprovado.

## Onde o protótipo vive

Tela de verdade em `public/dash/index.html`, na branch `metas-funil`, como nas
issues 307 e 325. O proxy local do scratchpad serve `public/` e responde
`GET /api/metas` e `GET /api/metas/acompanhamento` com fixtures; as outras
rotas voltam `{}`. `POST /api/metas` no proxy recusa gravação. Nenhuma
fixture no repositório.

Desvio da spec, decidido aqui: em Funis do relatório as metas ficam num card
próprio "Metas mensais", abaixo do formulário, com uma linha por funil de
lead. O formulário atual edita um funil por vez e não tem onde caber um
histórico; um card separado não mexe nele.

## Contrato de dados (a 333 e a 334 implementam)

Thin client: a tela não calcula projeção, cor, "precisa de N por dia" nem
"—". Tudo chega pronto.

### `GET /api/metas` — cadastro (só D1, não depende do CRM)

```json
{
  "mes": "2026-09",
  "funis": [
    { "funil_id": 1, "nome": "SE", "editavel": true, "motivo_bloqueio": null,
      "meta": { "cpl_max_centavos": 9000, "leads_novos": 70, "mqls": 35, "custo_mql_max_centavos": 18000 },
      "vigente_desde": "2026-09", "alterada_em": "2026-09-28T12:00:00Z", "alterada_por": "painel",
      "versao": "2026-09-28T12:00:00Z",
      "historico": [ { "mes": "2026-09", "em": "2026-09-28T12:00:00Z", "por": "painel",
                       "antes": { "cpl_max_centavos": null, "leads_novos": null, "mqls": null, "custo_mql_max_centavos": null },
                       "depois": { "cpl_max_centavos": 9000, "leads_novos": 70, "mqls": 35, "custo_mql_max_centavos": 18000 } } ] },
    { "funil_id": 4, "nome": "AQUISIÇÃO", "editavel": false,
      "motivo_bloqueio": "metas só para a Sessão Estratégica por enquanto", "meta": null, "historico": [] }
  ]
}
```

`POST /api/metas` recebe `{ funil_id, meta: {…quatro campos, null = sem meta}, versao }` e devolve o mesmo objeto do funil. Erro de validação: `400 { erro, campos: { cpl_max_centavos: "motivo" } }`. Concorrência: `409 { erro: "as metas mudaram desde que você abriu a aba, recarregue" }`.

### `GET /api/metas/acompanhamento` — mês corrente até ontem

```json
{
  "mes": "2026-09", "mes_rotulo": "setembro", "dados_ate": "2026-09-27", "dias_restantes": 3,
  "dias_fechados": 27, "dias_no_mes": 30,
  "avisos": ["investimento de 27/09 ainda não sincronizado"],
  "funis": [{
    "funil_id": 1, "nome": "SE", "investido_centavos": 543383,
    "meta_alterada_no_mes_em": null, "alterada_em": "2026-09-28T12:00:00Z", "alterada_por": "painel",
    "crm_ok": true,
    "indicadores": [
      { "chave": "cpl", "rotulo": "CPL", "tipo": "custo", "realizado": "R$ 90,56", "meta": "R$ 90,00",
        "situacao": "perto", "diferenca": "+R$ 0,56 (+0,6%)" },
      { "chave": "leads_novos", "rotulo": "Leads novos", "tipo": "volume", "realizado": "60", "meta": "70",
        "situacao": "perto", "pct": 86, "projecao": "67", "por_dia": "precisa de 3,3 por dia", "atingida": false },
      { "chave": "mqls", "rotulo": "MQLs", "tipo": "volume", "realizado": "31", "meta": "35",
        "situacao": "dentro", "pct": 89, "projecao": "34", "por_dia": "precisa de 1,3 por dia", "atingida": false },
      { "chave": "custo_mql", "rotulo": "Custo por MQL", "tipo": "custo", "realizado": "R$ 175,28", "meta": "R$ 180,00",
        "situacao": "dentro", "diferenca": "−R$ 4,72 (−2,6%)" }
    ]
  }]
}
```

`situacao` ∈ `dentro` (verde), `perto` (âmbar), `fora` (coral), `sem_meta` (neutro), `sem_dado` (neutro, "—"). Com `crm_ok: false`, leads e MQLs vêm com `realizado: null` e a tela diz "não foi possível ler os leads agora". Sem funil com meta: `funis: []` e a tela mostra "nenhuma meta cadastrada — cadastre em Funis do relatório".

## Arquivos

- **Modificar:** `public/dash/index.html`
  - HTML: `#visao-metas` (entre `#visao-herois` e `#visao-kpis`), `#leads-metas` (primeiro card de `#secao-leads`), card "Metas mensais" com `#funisrel-metas` em `#secao-funis-relatorio`.
  - CSS: `.metas-card`, `.metas-linha`, `.meta-ind` com variantes `dentro`/`perto`/`fora`/`neutro` (cores do DESIGN.md: `--up`, `--warn`, `--down`, `--muted`), `.meta-barra`, formulário `.metas-form`.
  - JS: `carregarMetasAcompanhamento()` (uma chamada, cacheada por render; falha própria não derruba a aba), `desenharMetasCompacto(dados)` e `desenharMetasDetalhe(dados)`; `carregarMetasCadastro()` e `desenharMetasCadastro(dados)` com salvar/validação/concorrência como na régua do Argo. Chamadas a partir de `R.visao`, `R.leads` e `R['funis-relatorio']`, fora do `Promise.all` de cada uma.
  - Reusar: `fetchJson`, `esc`, `$`, `argoQuando`, `fmtPct`, `money`, `.kpi`/`.grid-kpi`, a defesa por forma de dinheiro (`ARGO_DINHEIRO`, `centavosDoCampo`).
- **Não versionado (scratchpad):** `proxy-metas.mjs` + fixtures com modos `cheio`, `sem-meta`, `crm-fora`, `dia-1`, `atingida`.

## Cenários

### Happy Path
1. Visão geral: cartão compacto com os quatro indicadores da SE, cores e nota do filtro quando o preset não é "Este mês".
2. Leads: cartão detalhado com barras, projeção e "precisa de N por dia".
3. Funis do relatório: linha da SE com os quatro campos preenchidos, última alteração e histórico; AQUISIÇÃO desabilitada.

### Edge Cases
- Dia 1º: projeção "—".
- Meta atingida: "meta atingida" no lugar de "precisa de N por dia".
- Campo sem meta: "sem meta" no indicador.
- Nenhuma meta cadastrada: a frase com o atalho.
- Celular: indicadores em duas colunas.

### Cenário de Erro
- `crm_ok: false`: "não foi possível ler os leads agora".
- `GET /api/metas/acompanhamento` falhando: "não foi possível ler as metas" e o resto da aba segue.
