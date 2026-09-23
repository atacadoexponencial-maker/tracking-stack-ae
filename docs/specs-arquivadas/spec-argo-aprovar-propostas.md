# Spec: Aprovar propostas do Argo pelo dash

> Entrega 1 de 2 — a entrega 2 é `spec-argo-regua-editavel.md`.
>
> **Aprovada pela usuária em 23/09**, com estes esclarecimentos:
> - aprovação é executada na próxima verificação, que roda a cada ~10 min;
> - rejeitar conta como mudança no alvo: vale o **intervalo mínimo** da régua
>   (3 dias, editável); depois disso ele pode propor de novo, com números novos;
> - proposta sem decisão é substituída pela da rodada seguinte;
> - "Pausar anúncio" em **Executar executa** — mas só é ligado depois que a
>   régua nova de anúncio (entrega 2) estiver no ar.

## Visão Geral

O Argo vigia a conta de anúncios do Atacado Exponencial e encontra o que está
gastando mal. Hoje ele só tem dois jeitos de agir: **pausar sozinho**
(Executar) ou **só avisar no Slack** (Desligado e Propor, que hoje fazem a
mesma coisa). Não existe o meio-termo "ele sugere, a gestora decide".

Esta entrega cria esse meio-termo **dentro da aba Argo que já existe**, como
uma aba interna — nenhuma tela nova. Com uma ação em Propor, cada sugestão vira
uma **proposta** no dash, com alvo, motivo e números. A gestora aprova ou
rejeita ali. O aprovado é executado pelo próprio Argo, com as mesmas travas das
pausas automáticas, e o resultado é **conferido depois** e fica registrado. Uma
pausa executada pode ser **desfeita** pela tela, e o desfazer vira um registro
novo, sem apagar o anterior.

**Para quem:** a gestora de tráfego da AE, que decide investimento pelo dash.

**Problemas que resolve:**
1. Seguir uma sugestão do Argo hoje exige ler o Slack, abrir o Gerenciador e
   pausar à mão — e nada fica registrado.
2. O estado Propor existe na tela e não faz nada.
3. As propostas de pausa de anúncio são gravadas e ninguém as vê.

**Fora do escopo:** aprovar pelo Slack; realocar verba e mexer em orçamento
(entram pela régua, entrega 2); outras contas; IA decidindo ou executando.

## Páginas / Módulos

### 1. Aba Argo — navegação interna

**Descrição:** A aba Argo passa a ter duas abas internas logo abaixo da faixa
de estado: **Controle** (grade, limites, parada geral e registro, como hoje) e
**Propostas**. A faixa de estado continua visível nas duas.

**Componentes:**
- Abas internas "Controle" e "Propostas", em pílulas no padrão do dash.
- Contador ao lado de "Propostas" com quantas aguardam decisão; some no zero.
- Linha na faixa de estado "N propostas aguardando você", quando houver.

**Comportamentos:**
- Abrir a aba Argo: abre em Controle.
- Trocar para Propostas sem recarregar a página.
- Voltar para Controle e encontrar a grade como estava, inclusive alterações
  ainda não salvas.
- Clicar em "N propostas aguardando você" e cair em Propostas.
- Abrir o dash por link direto para Propostas e cair nela.
- Recarregar a página estando em Propostas e continuar em Propostas.

### 2. Propostas pendentes

**Descrição:** As propostas que aguardam decisão, da que vence primeiro para a
que vence por último, com tudo o que é preciso para decidir sem sair do dash.

**Componentes:**
- Cartão de proposta:
  - **Ação:** "Pausar campanha" ou "Pausar anúncio".
  - **Alvo:** nome da campanha ou do anúncio; para anúncio, quantos anúncios
    têm aquele nome (todos serão pausados).
  - **Motivo:** a frase do Argo.
  - **Números que sustentam o motivo:** gasto no período e o indicador que
    decidiu (custo por visita para tráfego; leads e qualificados para lead).
  - **Como vamos saber se funcionou:** a frase do que será conferido depois
    (ex.: "a campanha deve aparecer pausada; o gasto dela deve parar").
  - **Quando foi proposta** e **até quando vale**.
  - Botões **Aprovar** e **Rejeitar**.
- Selo "proposta pela Nª vez desde <data>" quando o alvo já foi proposto antes.
- Estado vazio: "Nenhuma proposta aguardando você", com a última rodada.

**Comportamentos:**
- Ver as pendentes ao abrir a aba interna.
- Ver o motivo completo de uma proposta com texto longo.
- Aprovar: pede confirmação na própria linha, sem janela sobreposta.
- Confirmar a aprovação: a proposta sai das pendentes e vai para o histórico
  como "Aprovada — aguardando execução".
- Cancelar a aprovação: nada é gravado.
- Rejeitar: pede confirmação na própria linha, com campo opcional "por quê?".
- Confirmar a rejeição: vai para o histórico como "Rejeitada".
- Cancelar a rejeição: nada é gravado.
- **A aprovação vale para a versão exata que ela viu.** Se o Argo tiver
  atualizado a proposta (números novos) enquanto a tela estava aberta, a tela
  recusa a decisão, mostra a versão nova e pede para decidir de novo.
- Decidir uma proposta que outra pessoa já decidiu: a tela avisa quem decidiu e
  quando, e não grava por cima.
- Decidir uma proposta que venceu: a tela avisa que venceu e não grava.
- Aprovar com a parada geral ligada: a tela avisa que nada será executado
  enquanto ela estiver ligada e pede confirmação explícita.
- Falha ao gravar (rede, servidor): a tela diz que não dá para afirmar se
  gravou e pede para recarregar — nunca mostra "aprovado" sem o servidor
  confirmar.

### 3. Histórico de propostas

**Descrição:** As propostas resolvidas nos últimos 30 dias, para saber o que
aconteceu com cada uma.

**Componentes:**
- Linha compacta: data, ação, alvo e selo de situação:
  - **Aprovada — aguardando execução**
  - **Executada e conferida** (a pausa aconteceu e foi confirmada depois)
  - **Executada — não conferida** (agiu, mas a conferência falhou ou não
    confirmou; pede para olhar a conta)
  - **Aprovada — não executou** (alvo já pausado, parada geral, erro), com o
    motivo
  - **Rejeitada**, com o "por quê?" se houver
  - **Venceu sem decisão**
  - **Desfeita**, com quem desfez e quando
- Detalhe ao clicar: motivo, versão aprovada, quem decidiu e quando, estado
  antes e depois, resultado da conferência e o desfazer, se houve.
- Botão **Desfazer** nas pausas executadas que ainda podem ser desfeitas.

**Comportamentos:**
- Ver as resolvidas dos últimos 30 dias, da mais recente para trás.
- Abrir e fechar o detalhe de uma proposta.
- Ver que uma aprovada foi executada e conferida, sem abrir o Slack.
- Ver que uma aprovada **não** foi executada, e por quê.
- Desfazer uma pausa executada: pede confirmação na linha ("Reativar
  '<alvo>'?"); confirmado, o Argo reativa o alvo em até ~10 min.
- Ver o desfazer como um registro novo ligado à ação original; o registro da
  pausa continua intacto.
- Tentar desfazer algo que alguém já reativou no Gerenciador: o Argo registra
  "já estava ativo" e não mexe.

### 4. Execução do que foi aprovado (Argo, fora da tela)

**Descrição:** O Argo executa as decisões da tela. A tela só registra; quem age
na conta é o executor do Argo.

**Comportamentos:**
- Aprovação ou desfazer é executado em até ~10 minutos.
- Antes de agir, confere se a parada geral está desligada; se estiver ligada,
  não executa e mantém "aguardando".
- Antes de agir, confere o estado atual do alvo; se já estiver como deveria
  ficar, registra isso e não mexe.
- Grava a intenção e o estado anterior **antes** de agir e o desfecho depois,
  como as pausas automáticas já fazem.
- Cada decisão é executada **uma única vez**, mesmo com o executor rodando duas
  vezes ao mesmo tempo.
- Pausar anúncio pausa todos os anúncios com aquele nome e registra quantos.
- **Conferência depois de agir:** relê o alvo na conta e marca o resultado como
  conferido, falhou ou desconhecido.
- Uma pausa executada por aprovação entra no **intervalo mínimo** do alvo
  (entrega 2), como qualquer outra ação.

### 5. Geração de propostas (Argo, fora da tela)

**Comportamentos:**
- **Monitor de tráfego** com "Pausar campanha de tráfego" em Propor: cada
  candidata vira proposta e continua listada no Slack.
- Monitor de tráfego em Desligado: só relata no Slack; em Executar: pausa
  sozinho, como hoje.
- **Monitor de anúncios** passa a ler o estado de "Pausar anúncio": Propor grava
  proposta; Desligado só relata; Executar pausa sozinho, com as mesmas travas
  e registro das pausas de tráfego. Enquanto a régua nova de anúncio (entrega
  2) não estiver no ar, Executar é recusado ao salvar, com a explicação.
- O **monitor de anúncios passa a rodar sozinho** em dias úteis, logo depois do
  monitor de tráfego. (Hoje ele não está agendado — só rodou à mão.)
- Enquanto há proposta pendente para um alvo, o Argo não cria outra: gera uma
  **nova versão** da mesma, e a versão anterior deixa de poder ser aprovada.
- Alvo rejeitado entra no intervalo mínimo (3 dias, editável na régua); depois
  dele, se continuar ruim, é proposto de novo com números novos.
- Proposta sem decisão vence na próxima rodada do mesmo monitor.
- **Resumo em toda rodada:** o Slack sempre diz quantas propostas estão
  pendentes, inclusive "0 aguardando", com link para a aba Propostas.

### 6. Aba Controle — ajustes de texto

**Comportamentos:**
- Ver, nas duas ações de pausa, que Propor manda as sugestões para a aba
  Propostas.
- Ver "Pausar anúncio" fora do grupo "Ainda não implementadas".
- Ver, na faixa de estado, "Propõe: …" com as ações em Propor.
