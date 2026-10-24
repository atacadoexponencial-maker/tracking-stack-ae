# Spec: Aplicação para o plano de ação ao vivo (workshop de 07/10)

## Visão Geral

No workshop de quarta, 07/10, às 19h (Google Meet), o Felipe monta ao vivo o
plano de ação de 2 marcas de atacado reais. Esta página recebe as aplicações das
marcas que querem concorrer a essas 2 vagas.

A pessoa chega pelo link do disparo (grupo do workshop e e-mail). Primeiro vê uma
folha de rosto, no mesmo estilo das páginas de materiais (iscas), e depois
responde um formulário em etapas, no mesmo estilo de /aplicacao-mentoria. No fim
aparece uma mensagem de agradecimento.

Cada aplicação vira **uma linha numa planilha Google**. A equipe usa a planilha
para comparar as marcas e escolher as 2. O escolhido recebe o aviso pelo WhatsApp
na quarta, 07/10, até o meio-dia.

**Fica de fora, por decisão:**
- A aplicação **não vira lead**: não vai ao CRM (ClickUp, Supabase) nem ao GHL.
  O ManyChat entrou depois (decisão de 03/10, ver "Mensagem no ManyChat").
- **Não aparece no dash**: não conta em nenhum número, funil ou painel.
- **Não vai ao Meta nem ao GA4**: nenhum evento de conversão.
- Nenhuma outra página, formulário ou integração existente muda.

Página de uso único: depois do workshop ela sai do ar e esta spec vai para
`docs/specs-arquivadas/`.

## Páginas / Módulos

### Página de aplicação

**Descrição:** página pública, fora do menu do site, sem cabeçalho nem rodapé,
que não aparece no Google. Abre na folha de rosto e segue para o formulário em
etapas dentro do mesmo cartão. Funciona no celular, que é onde a maioria vai
abrir pelo link do WhatsApp.

**Componentes:**
- **Folha de rosto:** fica no lugar da capa do material, com o texto da arte do
  disparo:
  - Selo: "PLANO DE AÇÃO AO VIVO"
  - Título: "Dos 100 aos 500 mil por mês"
  - Subtítulo: "O Felipe monta ao vivo o plano de 2 atacados reais. O seu pode
    ser um deles."
  - Pílula: "Quarta, 07/10 às 19h · Google Meet"
  - Texto de abertura: "Preencha para concorrer a uma das 2 vagas do plano de
    ação ao vivo. O preenchimento não garante a vaga."
  - Botão para começar a aplicação
  - Nota curta sobre o tempo de preenchimento
- **Cartão do formulário:** título, indicador "N de N", botões de voltar e
  avançar, e um botão de enviar na última etapa. Visual igual ao de
  /aplicacao-mentoria.
- **Etapa "A marca":**
  1. Seu nome (texto, obrigatório)
  2. WhatsApp (telefone, obrigatório)
  3. Nome da marca e @ do Instagram (texto, obrigatório)
  4. O que a sua marca vende? (texto, obrigatório, com o exemplo "moda feminina,
     semijoias, moda íntima" como dica)
- **Etapa "Porte e entrada de revendedor":**
  5. Faturamento médio por mês (uma opção): até R$ 30 mil · R$ 30 a 70 mil ·
     R$ 70 a 150 mil · R$ 150 a 300 mil · acima de R$ 300 mil
  6. Para quem você vende principalmente? (várias opções): lojista ·
     revendedora/sacoleira · empreendedora começando · distribuidor
  7. Como chegam os seus revendedores novos hoje? (várias opções): anúncio pago ·
     Instagram orgânico · indicação · vendedor ou representante · outro
  8. Quanto você investe em anúncio por mês? (uma opção): não invisto · até R$ 3
     mil · R$ 3 a 10 mil · acima de R$ 10 mil
  9. Quantas pessoas atendem no comercial? (uma opção): só eu · 1 pessoa · 2 a 4
     · 5 ou mais
- **Etapa "Recompra e o que trava":**
  10. Quanto do seu faturamento vem de quem já comprou antes? (uma opção): menos
      da metade · mais ou menos metade · mais da metade · não sei
  11. O que mais trava o crescimento do seu atacado hoje? (texto livre,
      obrigatório, em caixa de várias linhas)
- **Etapa "Ao vivo":**
  12. Se a sua marca for escolhida, você topa mostrar ao vivo o anúncio, o perfil
      e os números? (uma opção): sim · sim, mas sem números exatos · não
  13. Você consegue estar ao vivo na quarta, 07/10, às 19h, com câmera e
      microfone? (uma opção): sim · não
- **Tela de agradecimento:** ocupa o lugar do cartão depois do envio, com o
  texto:
  > Recebemos sua aplicação. Se a sua marca for escolhida, avisamos pelo WhatsApp
  > na quarta, 07/10, até o meio-dia.
  >
  > Se a sua não for escolhida, você assiste ao plano sendo montado do zero e leva
  > o raciocínio para o seu atacado. E quem ficar até o fim ainda tem uma surpresa
  > que só liberamos ao vivo.
  >
  > Quarta, 07/10, às 19h, no Google Meet. O link chega no grupo de WhatsApp e por
  > aqui.
  >
  > Equipe Atacado Exponencial
- **Mensagens de erro por campo:** aparecem embaixo do campo inválido.

Todas as 13 perguntas são obrigatórias. Nas de várias opções, é preciso marcar
pelo menos uma.

**Comportamentos:**
- **Abrir a página:** a pessoa vê a folha de rosto. O formulário ainda não
  aparece.
- **Começar a aplicação:** o botão da folha de rosto troca para a primeira etapa
  e leva o topo do cartão para a tela.
- **Avançar de etapa:** se os campos da etapa estão preenchidos, passa para a
  próxima e o indicador "N de N" muda.
- **Avançar com campo faltando:** não avança. Mostra o erro embaixo de cada campo
  inválido e coloca o foco no primeiro deles.
- **Voltar uma etapa:** volta sem apagar nada do que foi respondido.
- **Corrigir um campo com erro:** o erro some assim que o campo fica válido.
- **WhatsApp inválido:** um número que não seja telefone brasileiro (DDD + número)
  aparece como inválido.
- **Escolher uma opção:** nas perguntas de uma opção, marcar outra desmarca a
  anterior.
- **Marcar várias opções:** nas perguntas 6 e 7, a pessoa marca e desmarca
  quantas quiser.
- **Apertar Enter num campo de texto:** nas etapas intermediárias, funciona como
  avançar, não como enviar. Na caixa da pergunta 11, o Enter quebra a linha.
- **Enviar:** na última etapa, com tudo válido, o botão fica desabilitado e mostra
  que está enviando. Isso evita envio duplo.
- **Envio com sucesso:** o cartão dá lugar à tela de agradecimento.
- **Envio com falha** (sem internet ou erro do servidor): a pessoa vê uma
  mensagem pedindo para tentar de novo. As respostas continuam preenchidas e o
  botão volta a funcionar.
- **Enviar de novo com o mesmo WhatsApp:** a aplicação é aceita e vira outra
  linha. A equipe vê as duplicatas na planilha, e a mais recente vale.
- **Recarregar a página no meio:** começa de novo pela folha de rosto. Nada fica
  salvo no navegador.

### Registro das aplicações na planilha

**Descrição:** cada aplicação enviada vira uma linha nova na planilha com ID `1tWAeZMaAp_hSE-6vymyN8Cx3kAqVo-zKEZfGySHuOHU`, aba
`Página1`. O envio só dá sucesso para a pessoa depois que a linha foi gravada. A
página nunca fala direto com o Google: quem grava é o servidor do site.

**Componentes:**
- **Linha de cabeçalho:** criada uma vez, antes do primeiro envio, com uma coluna
  por informação, nesta ordem: Data/hora (horário de Brasília) · Nome · WhatsApp
  · Marca e Instagram · O que vende · Faturamento · Para quem vende · Como chegam
  os revendedores · Investimento em anúncio · Pessoas no comercial · Recompra · O
  que trava · Topa mostrar ao vivo · Disponível 07/10 19h · Origem (UTMs do link,
  se vierem)
- **Linha por aplicação:** valores como a pessoa escolheu, com o texto da opção e
  não um código. As respostas de várias opções ficam numa célula só, separadas
  por vírgula.

**Comportamentos:**
- **Aplicação recebida:** acrescenta uma linha no fim da planilha, sem mexer nas
  linhas anteriores. Nem as que a equipe editou, coloriu ou ordenou são tocadas.
- **Dados vindos da página são conferidos de novo no servidor:** campo
  obrigatório vazio, opção que não existe na lista ou texto longo demais fazem o
  envio ser recusado. Nada é gravado e a página mostra erro.
- **Texto que começa com `=`, `+`, `-` ou `@`:** é gravado como texto puro, nunca
  como fórmula da planilha.
- **Envio de robô:** passa pelas mesmas barreiras de robô que o site já usa nos
  formulários. O que for barrado não vira linha.
- **Google fora do ar ou acesso negado:** o envio falha para a pessoa, com o
  pedido de tentar de novo, e a falha fica registrada para a equipe ver. Nada
  some em silêncio.
- **Nada além da planilha e do ManyChat:** a aplicação não gera lead, evento no
  Meta ou no GA4, card no CRM nem contagem no dash.

### Mensagem no ManyChat (decisão de 03/10)

**Descrição:** depois que a linha foi gravada, a pessoa entra no ManyChat e
recebe a mensagem do fluxo "Aplicação Plano de Ação ao Vivo".

**Comportamentos:**
- **Pessoa nova no ManyChat:** vira contato pelo WhatsApp, com a tag
  `aplicou-wo07-10`, e recebe o fluxo.
- **Pessoa que já está no ManyChat** (com ou sem o nono dígito): não vira
  contato duplicado. Ganha a tag e recebe o fluxo.
- **Fluxo aceito pelo ManyChat:** a pessoa ganha também a tag
  `aplicou-wo07-10-enviado`. Quem tem a primeira tag e não tem esta ficou sem a
  mensagem.
- **ManyChat fora do ar:** a aplicação continua gravada e a pessoa vê o
  agradecimento normalmente. A falha fica no log.

### Encerramento das aplicações

**Descrição:** as aplicações fecham sozinhas na terça, 06/10, às 23h59 (horário
de Brasília). A página continua no ar, mas no lugar do formulário mostra que as
aplicações foram encerradas.

**Componentes:**
- **Aviso de encerradas:** no lugar do botão da folha de rosto e do formulário
  aparece "As aplicações foram encerradas." e o lembrete "Quarta, 07/10, às 19h,
  no Google Meet. O link chega no grupo de WhatsApp."

**Comportamentos:**
- **Abrir a página depois das 23h59 de 06/10:** a folha de rosto aparece com o
  aviso de encerradas. Não há como abrir o formulário.
- **Enviar depois das 23h59 de 06/10** (a página foi aberta antes e o envio sai
  depois): o servidor recusa e nada é gravado. A pessoa vê o aviso de encerradas,
  não um erro de "tente de novo".
- **Quem decide se está aberto é o servidor:** mudar o relógio do celular não
  reabre o formulário.

### Depois do workshop

- **Endereço:** `/aplicacao-plano-ao-vivo`. O `[link]` das duas tasks de disparo
  no ClickUp é trocado por ele.
- **Saída do ar:** depois do workshop, a página passa a redirecionar para
  /workshop-gratuito, como as LPs da live. Isso é uma troca manual depois de
  07/10, fora desta entrega.
