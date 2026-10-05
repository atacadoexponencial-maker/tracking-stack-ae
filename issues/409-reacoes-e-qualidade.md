# 409: Reações da gestora e painel de qualidade

**Tipo:** Implementação
**Página:** Aba Argo › Relatório da semana (spec `spec-relatorio-semanal-argo.md`, módulo 6)

## Descrição

Cada trecho da análise ganha as reações útil, óbvio e errado (errado exige comentário) e o comentário livre; as reações e comentários entram no pacote da semana seguinte; o painel de qualidade mostra a proporção de cada reação por semana e a tendência; um comentário pode virar item do contexto do negócio.

## Pronto quando

Ela reage a trechos e eles continuam marcados ao recarregar; no relatório seguinte a análise trata o que foi marcado como errado em vez de repetir; o painel mostra as proporções das semanas; um comentário vira item de contexto já preenchido.

## Cenários

### Happy Path
Em cada bloco da análise: Útil, Óbvio, Errado (exige comentário) e Comentar (`POST acao=reagir`, uma linha por relatório e bloco). As reações e os descartes do relatório anterior entram no pacote seguinte como fatos. O painel de qualidade mostra, por semana publicada, quantos trechos foram marcados de cada jeito. "Virar item de contexto" cria uma observação no contexto do negócio com o comentário.

### Edge Cases
- Clicar de novo na mesma reação retira a marcação.
- Bloco que não existe no relatório: 400.

### Cenário de Erro
Falha ao gravar: aviso, a marcação não muda.

## Banco de Dados

- `argo.relatorio_reacoes` (migration 0010; "errado" sem comentário é recusado pela tabela).

## Arquivos

- **Modificar:** `functions/api/argo/relatorio.js`, `functions/api/_argo-relatorio-leitura.js`, `functions/api/_argo-relatorio-fontes.js` (lê o relatório anterior), `public/dash/argo-relatorio.js`.
- **Criar:** `tests/argo-relatorio-leitura.test.js`.

## Checklist

- [x] Reações com comentário obrigatório no errado
- [x] Reações e descartes entram no pacote seguinte
- [x] Painel de qualidade
- [x] Comentário vira item de contexto
- [x] Conferido na tela com o Neon real
