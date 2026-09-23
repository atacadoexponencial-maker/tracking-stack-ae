# Spec: Régua do Argo editável pelo dash

> **Aprovada pela usuária em 23/09/2026.** Entrega 2 de 2 — a entrega 1 é
> `spec-argo-aprovar-propostas.md`. Respostas dela incorporadas abaixo.

## Visão Geral

Hoje as regras que decidem o que o Argo pausa são **números fixos escritos no
código**: piso de R$ 100, "+30% acima das outras campanhas", "zero
qualificados". Mudar qualquer um exige programador. E duas dessas regras
contrariam o que a gestora faz na prática: o monitor de tráfego compara uma
campanha com **outras campanhas**, que podem ser de funis diferentes; e o
monitor de anúncios julga anúncio de lead com piso de R$ 100 e nenhum piso de
entrega.

Esta entrega leva **todas as regras para o banco**, editáveis na aba Argo, e
troca a régua pela forma como a gestora decide:

- anúncio de lead só é julgado depois de gastar **3× o CPL médio do funil nos últimos 30 dias** e ter
  **3.000 impressões**;
- campanha é comparada com **o próprio passado**, não com outras;
- nada mexe em quem está em **fase de aprendizado**;
- um **intervalo mínimo** impede mexer de novo no mesmo alvo logo depois de uma
  mudança — do Argo ou de uma pessoa — e ele **avalia o resultado** do que foi
  feito;
- onde há orçamento, ele **reduz antes de pausar**;
- **reativar** o que pausou existe como regra, desligada por padrão.

A lógica de cada regra continua em código (previsível e testável); o que fica
editável são os **números** e o **liga/desliga** de cada uma. O Argo continua
100% código, sem IA decidindo.

**Para quem:** a gestora de tráfego da AE.

**Fora do escopo:** outras contas (a régua é por conta, então acrescentar
depois é cadastro, não reescrita); regras com lógica nova que não esteja aqui;
backtest.

## Páginas / Módulos

### 1. Aba Controle — bloco "Régua"

**Descrição:** Um bloco novo na aba Controle, entre a grade de permissões e os
Limites, com as regras agrupadas por tipo de campanha. Cada regra tem nome, uma
frase dizendo o que faz, seus números e um liga/desliga quando fizer sentido.
Salva junto com o resto, pelo mesmo Salvar, e vale a partir da próxima rodada.

**Componentes:**
- **Grupo "Anúncios de lead"**
  - Multiplicador do CPL médio para julgar (padrão **3×**).
  - Impressões mínimas para julgar (padrão **3.000**).
  - CPL médio: o do **mesmo funil** do anúncio nos **últimos 30 dias** (janela
    editável, padrão 30).
  - Candidato, depois de passar dos pisos: **nenhum lead** → candidato; **tem
    lead** → segunda avaliação por MQL (funil julgado por MQL: zero
    qualificados maduros → candidato).
- **Grupo "Campanhas de tráfego"**
  - Janela recente, em dias (padrão **7**).
  - Janela de comparação — o passado da própria campanha, em dias (padrão
    **21**, os 21 dias antes da janela recente).
  - Tolerância acima do próprio passado (padrão **+30%**).
  - Gasto mínimo na janela recente para julgar (padrão **R$ 30**).
  - Campanha sem passado suficiente (menos dias no ar que as duas janelas
    somadas): **não é julgada** até ter passado; o relatório diz isso.
- **Grupo "Travas para todos"**
  - Não mexer em fase de aprendizado — liga/desliga (padrão **ligado**) e
    depois de quantos dias no ar o aprendizado deixa de travar (padrão **7**).
  - Intervalo mínimo depois de qualquer mudança no mesmo alvo — inclusive uma
    rejeição de proposta —, em dias (padrão **3**).
  - Reduzir antes de pausar — liga/desliga (padrão **ligado**) e quanto reduzir
    (padrão **30%**).
  - Reativar o que ele pausou — liga/desliga (padrão **desligado**) e a
    tolerância de custo para religar.
- Texto de ajuda em cada campo com o valor padrão ("padrão: 3×").
- Linha "Régua alterada por <quem> em <quando>".

**Comportamentos:**
- Ver os valores atuais de cada regra ao abrir a aba.
- Alterar um número e ver "Alterações não salvas".
- Ligar ou desligar uma regra que tem liga/desliga.
- Salvar a régua junto com a grade.
- Tentar salvar um valor fora do permitido (negativo, zero onde não pode,
  multiplicador absurdo): a tela diz qual campo e por quê, e nada é gravado.
- Tentar salvar quando outra pessoa mudou a régua nesse intervalo: a tela
  recusa e pede para recarregar, sem gravar por cima.
- Voltar uma regra ao valor padrão.
- Ver na faixa de estado quando a régua foi mudada pela última vez.

### 2. Julgamento de anúncios de lead (Argo, fora da tela)

**Comportamentos:**
- Só julga anúncio de funil julgável (como hoje: a régua por funil continua).
- Anúncio com gasto abaixo de **multiplicador × CPL médio** (do funil, últimos
  30 dias) não é julgado.
- Passou dos pisos e **não tem nenhum lead**: candidato.
- Passou dos pisos e **tem lead**: segunda avaliação — no funil julgado por MQL,
  zero qualificados entre os leads maduros é candidato; com qualificado, não.
- Anúncio com menos impressões que o mínimo não é julgado.
- O relatório diz, para cada anúncio não julgado, qual piso faltou.
- O relatório mostra o CPL médio usado e de onde veio.
- Sem CPL médio disponível (ex.: primeiros dias do mês sem lead), ninguém é
  julgado e o relatório diz por quê — dado ruim não vira ação.

### 3. Julgamento de campanhas de tráfego (Argo, fora da tela)

**Comportamentos:**
- Compara o custo por visita da janela recente com o **da própria campanha** na
  janela de comparação.
- Vira candidata quando o custo recente passa do próprio passado mais a
  tolerância e o gasto recente passa do mínimo.
- Deixa de comparar com as outras campanhas.
- O relatório mostra, para cada campanha, o custo recente, o do próprio passado
  e o corte.

### 4. Travas (Argo, fora da tela)

**Comportamentos:**
- **Fase de aprendizado:** antes de propor ou agir, consulta na conta se o
  conjunto do alvo está **aprendendo**; se estiver, e estiver no ar há menos
  que o limite de dias (padrão 7), não mexe e o relatório diz "em aprendizado".
  **Aprendizado limitado não trava.** Passado o limite de dias, nem o
  aprendizado trava — o que nunca sai dele não fica intocável para sempre.
- **Intervalo mínimo:** se o alvo (ou o conjunto dele) mudou nos últimos N dias —
  pelo Argo ou por uma pessoa no Gerenciador —, não mexe e o relatório diz
  "mudou em <data>, reavalia a partir de <data>".
- **Avaliar o resultado:** para cada mudança recente no alvo (de quem for), o
  relatório mostra o indicador antes e depois da mudança.
- **Reduzir antes de pausar:** onde há orçamento para reduzir (conjunto ou
  campanha com orçamento próprio), a primeira ação é reduzir; só depois do
  intervalo, se continuar ruim, vem a pausa. Anúncio não tem orçamento próprio
  e vai direto para a pausa.
- **Reativar** (quando ligada): um alvo pausado pelo Argo é reativado se os
  resultados que chegaram depois da pausa deixarem o custo dele dentro da média
  mais a tolerância. **Lead que chegou depois da pausa, mas com custo acima da
  média, não reativa.** Cada alvo é reativado no máximo uma vez.
- Tudo o que as travas seguram aparece no relatório — nada fica em silêncio.
- Reduzir e reativar respeitam a grade: seguem o estado da ação (Desligado,
  Propor, Executar) e, em Propor, viram propostas da entrega 1.

### 5. Relatório do Slack

**Comportamentos:**
- Mostra a régua usada na rodada (os números, não só "padrão").
- Separa: candidatos, segurados por trava (e qual), não julgados (e qual piso
  faltou) e ações executadas.
- Aparece em toda rodada, mesmo sem nada a fazer.
