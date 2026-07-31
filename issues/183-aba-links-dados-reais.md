# 183: Aba "Links" com dados reais

**Tipo:** Implementação
**Página:** /dash — aba Links

## Descrição

Ligar a aba Links às APIs: carregar destinos, cliques e o que está no ar pelo `GET`, e criar, editar e apagar pelo `POST`, exibindo os horários em -03:00 e deixando toda a validação no backend.

## Cenários

### Happy Path
Abrir `/dash#links` carrega o `GET /api/links`, mostra o destino no ar com o motivo e a tabela de destinos com seus cliques. Salvar no formulário chama o `POST` e recarrega a aba com o dado novo.

### Edge Cases
- **Estado vazio:** mensagem orientando cadastrar o destino padrão primeiro.
- **Datas:** exibidas em Brasília (`toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })`) e enviadas ao backend como unix seconds.
- **Marcar "é o destino padrão"** esconde os campos de data — é conveniência de tela; quem garante a regra é o backend.
- **Copiar o link:** botão que copia a URL pública completa.

### Cenário de Erro
`POST` que volta erro → mostra a mensagem que o backend mandou, sem inventar validação própria no formulário. Falha de carga já é tratada pelo `render()` existente.

## Arquivos

- **Modificar:** `public/dash/index.html` — trocar os dados fictícios de `R.links` (issue 175) pelas chamadas reais e ligar o formulário e os botões ao `POST`.

## Código reutilizável

- `fetchJson()` (linha 278) — já anexa `key=` sozinho.
- Padrão de `POST` de `R.metaads` (linha ~671) — `fetch` com `key` na query, `Content-Type: application/json`, e `await R.<secao>()` para redesenhar.
- `tabela()` e `esc()`.

## Checklist

- [x] Carregar destinos e destino no ar via `fetchJson('/api/links')`
- [x] Renderizar rótulo, URL, janela, situação e cliques
- [x] Ligar o formulário de criar ao `POST`
- [x] Ligar editar e apagar ao `POST`
- [x] Exibir horários em Brasília e enviar unix seconds
- [x] Mostrar a mensagem de erro vinda do backend
- [x] Escapar com `esc()` tudo que vier do banco
- [x] Não replicar no formulário nenhuma regra de negócio validada no backend
