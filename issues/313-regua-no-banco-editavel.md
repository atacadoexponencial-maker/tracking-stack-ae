# 313: Régua guardada no banco e editável na aba

**Tipo:** Implementação
**Página:** Aba Argo → Controle + monitores — spec `spec-argo-regua-editavel.md`, módulos 1 e 5

## Descrição

Guardar todas as regras da régua no banco, por conta, com os padrões da spec; ligar o protótipo 299 (editar, validar, recusar gravação por cima, voltar ao padrão, salvar junto com a grade); fazer os monitores lerem os números do banco em vez das constantes do código e mostrarem no Slack a régua usada na rodada.

## Pronto quando

Mudar um número na aba (ex.: gasto mínimo de tráfego de R$ 30 para R$ 40) e salvar faz a rodada seguinte usar e mostrar R$ 40 no Slack; valor inválido é recusado com o campo nomeado.

## Decisão de desenho

A régua mostra TODAS as regras da spec, mas só algumas já têm efeito nesta
issue — as outras ganham lógica nas 305–309. Para a tela nunca dizer que um
número vale quando não vale, o backend marca cada regra como `ativa` ou não
(mesmo padrão do `acoes_com_consumidor` da grade), e a tela esmaece as
inativas com "entra em vigor com a régua nova".

Ativas nesta issue (já existem na lógica de hoje):
- `trafego_tolerancia_pct` e `trafego_gasto_min_reais` (monitor de tráfego);
- `intervalo_min_dias` (quanto tempo um alvo decidido fica sem proposta).

## Cenários

### Happy Path
1. A aba lê `regua` no `GET /api/argo/config`: valores salvos sobre os padrões,
   limites, quais estão ativas, quem mudou e quando.
2. A gestora muda o gasto mínimo de tráfego de 30 para 40 e salva (mesmo
   Salvar da grade, mesma guarda de concorrência).
3. Na rodada seguinte, o monitor de tráfego usa R$ 40 e o relatório mostra
   "Régua: tolerância +30% · gasto mínimo R$ 40,00 · intervalo 3 dias".

### Edge Cases
- Banco sem régua salva: valem os padrões (= os números de hoje); nada muda.
- Chave desconhecida, número fora do limite, booleano inválido: 400 nomeando
  o campo; nada gravado.
- Cliente antigo que não manda `regua`: a régua salva fica como está.
- Grade lida do markdown (Neon fora): monitor usa as constantes de hoje.

### Cenário de Erro
- Régua ilegível no banco (JSON estranho): o monitor ignora a chave inválida
  e usa o padrão dela, avisando no relatório.

## Banco de Dados

Migration `gestor-ae/migrations/argo/0005_regua.sql`, em `argo.config_conta`:
- `regua` (JSONB NOT NULL DEFAULT '{}') — o objeto inteiro salvo pela tela
- `regua_atualizada_em` (TIMESTAMPTZ), `regua_atualizada_por` (TEXT)

## Arquivos

- **Criar:** `functions/api/_argo-regua.js` — `REGRAS` (padrão, limites, tipo,
  ativa), `montarRegua(salva, em, por)`, `validarRegua(obj)`; e
  `tests/argo-regua.test.js`.
- **Modificar:** `functions/api/argo/config.js` — lê/grava as colunas novas;
  resposta com `regua` montada.
- **Modificar:** `public/dash/index.html` — `salvarGradeArgo` envia `regua`;
  regras inativas esmaecidas com a nota.
- **Criar:** `gestor-ae/migrations/argo/0005_regua.sql`.
- **Modificar:** `gestor-ae/.../argo_estado.py` — `ler_grade` devolve `regua`;
  `regua_valor(grade, chave, padrao)`.
- **Modificar:** `gestor-ae/.../ae_trafego_monitor.py` — `load_config` aplica
  tolerância e gasto mínimo da régua; relatório mostra a régua usada.
- **Modificar:** `gestor-ae/.../ae_anuncios_monitor.py` e
  `ae_trafego_monitor.py` — `intervalo_min_dias` da régua ao gravar proposta.
- Testes correspondentes nos dois repos.

## Checklist

- [x] Migration 0005 aplicada
- [x] `_argo-regua.js` + testes; config GET/POST com régua
- [x] Tela: salva a régua; inativas esmaecidas
- [x] Monitores leem a régua e mostram no relatório
- [x] Testes verdes nos dois repos
