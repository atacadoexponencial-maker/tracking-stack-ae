# 308: Protótipo — bloco "Régua" na aba Controle

**Tipo:** Protótipo
**Página:** Aba Argo → Controle — spec `spec-argo-regua-editavel.md`, módulo 1

## Descrição

Desenhar, com valores fictícios, o bloco Régua entre a grade de permissões e os Limites: grupos "Anúncios de lead", "Campanhas de tráfego" e "Travas para todos", cada regra com frase, números, liga/desliga, valor padrão e "voltar ao padrão".

## Pronto quando

O bloco aparece na aba Controle local com todos os campos da spec, erros de validação de exemplo e a linha "Régua alterada por… em…", no computador e no celular — e a usuária aprovou o visual.

## Onde o protótipo vive

Mesmo esquema da 298: a tela de verdade em `public/dash/index.html`, na branch
`argo-propostas`, alimentada pelo proxy local, que acrescenta um campo `regua`
fictício à resposta real de `GET /api/argo/config`. Nada de dado fictício no
repositório. Salvar continua indo só até o proxy, que recusa gravação.

### Contrato (a 304 implementa no backend)

`GET /api/argo/config` passa a trazer, além do que já traz:

```json
"regua": {
  "valores": { "lead_multiplicador_cpl": 3, "lead_impressoes_min": 3000, "lead_janela_cpl_dias": 30,
    "trafego_janela_recente_dias": 7, "trafego_janela_passado_dias": 21, "trafego_tolerancia_pct": 30,
    "trafego_gasto_min_reais": 30, "trava_aprendizado": true, "trava_aprendizado_dias": 7,
    "intervalo_min_dias": 3, "reduzir_antes": true, "reduzir_pct": 30,
    "reativar": false, "reativar_tolerancia_pct": 20 },
  "padroes": { "...mesmas chaves...": "..." },
  "limites": { "lead_multiplicador_cpl": { "min": 1, "max": 10, "passo": 0.5 }, "...": {} },
  "alterada_em": "2026-09-23T15:10:00Z", "alterada_por": "painel"
}
```

Quais regras existem, padrões e limites vêm do backend (uma fonte da verdade,
como o `contrato` da grade). A tela só tem os rótulos e as frases. A validação
que vale é a do servidor; a tela usa `limites` só para avisar antes.

## Cenários

### Happy Path
1. Na aba Controle, entre a grade e Limites, aparece o bloco **Régua** com três
   grupos: Anúncios de lead, Campanhas de tráfego, Travas para todos.
2. Cada regra: nome, frase curta, campo numérico com a unidade dentro (×, %,
   dias, R$, impressões) e "padrão: X" embaixo.
3. Regras com liga/desliga (aprendizado, reduzir antes, reativar) têm a chave;
   desligada, os números dela ficam esmaecidos, mas editáveis.
4. Mudar um número acende "Alterações não salvas" e o Salvar (mesmo rodapé).
5. Valor diferente do padrão ganha o link "voltar ao padrão".
6. Embaixo do bloco: "Régua alterada por painel em hoje às 12:10".

### Edge Cases
- Valor fora de `limites`: o campo fica marcado e a linha diz "entre 1 e 10";
  o Salvar fica travado enquanto houver campo fora.
- Campo vazio: tratado como fora do limite, nunca como zero.
- Resposta sem `regua` (backend antigo): o bloco mostra "A régua ainda não está
  disponível" e o resto da aba funciona igual.
- Celular: campos em uma coluna.

### Cenário de Erro
- Servidor recusa (validação ou gravação por cima): a mensagem dele aparece no
  rodapé, como já acontece com a grade.

## Banco de Dados

Não se aplica (a coluna da régua é da 304).

## Arquivos

- **Modificar:** `public/dash/index.html`
  - CSS do bloco (reusar `.argo-bloco`, `.argo-campo`, `.argo-entrada`,
    `.argo-chave`, `.argo-grupo-titulo`).
  - JS: `ARGO_REGRAS` (rótulos, frases e unidades por chave), `desenharReguaArgo(regua)`
    chamado de dentro de `desenharGradeArgo`; `argoFotografia` passa a incluir
    os campos da régua; `sincronizarSalvarArgo` trava com campo fora do limite.
- **Não versionado:** o proxy local injeta `regua` fictícia.

## Checklist

- [x] Bloco Régua entre a grade e Limites, com os três grupos
- [x] Campos com unidade, "padrão: X" e "voltar ao padrão"
- [x] Chaves das regras com liga/desliga, esmaecendo os números quando desligadas
- [x] Alteração na régua acende "Alterações não salvas"; campo fora do limite trava o Salvar com a mensagem na linha
- [x] Linha "Régua alterada por … em …"
- [x] Sem `regua` na resposta: aviso e resto da aba intacto
- [x] Prints 1440px e 390px para a usuária aprovar (aprovação pendente)
- [x] `npm test` verde
