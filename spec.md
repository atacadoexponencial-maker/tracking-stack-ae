# Spec: Entrada no grupo de WhatsApp como conversão personalizada no Meta

## Visão Geral

Hoje a entrada real de uma pessoa no grupo de WhatsApp da live é registrada e
aparece na aba **Grupos** do painel, mas morre ali: o Meta não fica sabendo que
ela aconteceu. A única conversão que o Meta enxerga é o **Lead** (preenchimento
de formulário) — e a LP `/lives-semanais-v2`, que manda o visitante direto para o
grupo sem formulário, não gera nenhuma conversão mensurável do lado do anúncio.

Este projeto fecha esse buraco: **cada entrada nova em grupo monitorado passa a
ser enviada ao Meta como uma conversão**, com o nome próprio de evento, para que
a operação possa montar uma conversão personalizada no gerenciador e finalmente
comparar campanhas pelo resultado real (pessoa dentro do grupo) e não só pela
intenção (clique ou formulário).

**Para quem é:** a operação de marketing, que hoje não consegue responder "qual
anúncio trouxe gente para dentro do grupo da live".

**Deduplicação:** a mesma pessoa entrando várias vezes no mesmo grupo vale **uma
única conversão, para sempre**. Se ela sai e volta, o Meta não recebe de novo. A
deduplicação vale **somente para o envio ao Meta** — a aba Grupos do painel
continua contando exatamente como hoje, entradas e saídas, sem nenhuma mudança
visual ou numérica.

**Identificação da pessoa:** o registro de entrada traz apenas o telefone. Quando
esse telefone corresponder a um lead que o tracking já conhece, a conversão é
**enriquecida** com os identificadores de navegação daquela pessoa, o que aumenta
muito a taxa de correspondência no Meta. Quando não houver correspondência, a
conversão é enviada mesmo assim, apenas com o telefone protegido.

**Limites conhecidos e aceitos (não são problemas a resolver aqui):**

- **Volume baixo.** São cerca de 7 entradas em 3 dias no grupo da live. Isso é
  suficiente para *medir*, não para o Meta *otimizar* campanha (que pede ordem de
  50 conversões semanais por conjunto de anúncios). A conversão personalizada vai
  reportar corretamente, mas não deve ser usada como evento de otimização por
  enquanto.
- **Fonte frágil.** O registro de entradas depende da integração de WhatsApp que
  está em processo de substituição. Se ela cair, o Meta simplesmente para de
  receber essa conversão. O projeto deve deixar essa parada **visível**, nunca
  silenciosa.
- **Sem atribuição própria de campanha.** A conversão informa que a pessoa entrou;
  quem decide a qual anúncio isso pertence é o Meta, pela correspondência de
  identidade. As UTMs do site não participam dessa decisão quando não há
  correspondência com lead conhecido.

**Fora do escopo (não fazer):** medir o clique no botão do grupo; alterar a aba
Grupos do painel; alterar as landing pages; alterar o redirecionador do grupo;
criar a conversão personalizada dentro do gerenciador do Meta (é configuração
manual da operação, feita depois que os eventos começarem a chegar); enviar
conversão para saídas ou remoções do grupo; enviar as entradas já registradas
antes da ativação.

## Decisões assumidas (confirmar antes do /break)

1. **Nome do evento:** `EntrouGrupo`, com o grupo identificado dentro do próprio
   evento — assim a operação cria uma conversão personalizada por grupo (live ou
   workshop) sem precisar de eventos diferentes.
2. **Quais grupos entram:** apenas os grupos explicitamente marcados como
   "manda conversão". Na ativação, só o grupo das **Lives Semanais** fica marcado;
   Workshops fica registrado no painel como hoje, mas sem enviar nada.
3. **Marco de corte:** as entradas já registradas antes da ativação **não** são
   enviadas. Só valem entradas novas, a partir do momento em que o recurso entra
   no ar.
4. **Chave de deduplicação:** telefone + grupo, sem prazo de expiração.

**Conversão personalizada já criada no Meta:** ID `1595278292393579`, com o nome
de evento `EntrouGrupo`. O ID **não** entra no envio — o que o código manda é o
evento com esse nome, e a conversão personalizada é a regra que casa com ele do
lado do Meta. O ID serve à operação, para escolher a conversão nos relatórios e
na configuração de campanha. Fica registrado aqui só para rastreabilidade.

**Pixel de destino: `2800317883678788`** — o pixel da conta de anúncios nova,
que no projeto é `META_PIXEL_ID_2`/`META_ACCESS_TOKEN_2`. É onde a conversão
personalizada foi criada, então é o único destino do `EntrouGrupo`. **Não**
replicar o evento para o pixel antigo (`META_PIXEL_ID`): lá a conversão não
existe, e o evento só faria ruído. Isso difere do evento de Lead, que hoje vai
para os dois pixels em paralelo — aqui o envio é deliberadamente único.

Consequência operacional: se um dia a operação promover o pixel novo a único
(removendo as vars `_2`, como prevê a migração dos pixels), este envio precisa
migrar junto para `META_PIXEL_ID` — caso contrário para de funcionar em silêncio.

## Páginas / Módulos

### Módulo 1 — Seleção das entradas que viram conversão

**Descrição:** decide, entre tudo que é registrado de movimentação nos grupos, o
que merece virar conversão no Meta. É o filtro que protege o Meta de receber
ruído e de contar a mesma pessoa duas vezes.

**Componentes:**
- Marcação de grupo elegível: indicação, por grupo monitorado, de que aquele
  grupo envia conversão ao Meta. Grupos não marcados são ignorados por completo.
- Registro de pessoas já convertidas: memória de quais telefones já geraram
  conversão em quais grupos, para nunca repetir.
- Marco de corte: momento a partir do qual as entradas passam a valer.

**Comportamentos:**
- Selecionar somente movimentações do tipo "entrou", descartando saídas e
  remoções.
- Descartar entrada em grupo que não está marcado como elegível.
- Descartar entrada anterior ao marco de corte.
- Descartar entrada cujo telefone já gerou conversão naquele mesmo grupo.
- Aceitar como conversão nova a entrada de um telefone que ainda não converteu
  naquele grupo.
- Registrar o telefone como já convertido assim que a conversão é aceita, para
  que uma reentrada posterior não gere outra.
- Tratar entrada sem telefone identificável como não elegível, sem interromper o
  processamento das demais.

### Módulo 2 — Enriquecimento pelo lead conhecido

**Descrição:** tenta descobrir se quem entrou no grupo é alguém que o tracking já
conhece, para mandar ao Meta uma conversão com muito mais chance de ser
reconhecida.

**Componentes:**
- Busca por correspondência: procura do telefone da pessoa entre os leads já
  registrados.
- Conjunto de identificadores da pessoa: dados de navegação e identificação
  associados ao lead encontrado.

**Comportamentos:**
- Procurar o telefone da pessoa entre os leads conhecidos, tolerando diferenças
  de formatação de número.
- Quando houver exatamente uma correspondência, anexar à conversão os
  identificadores daquele lead.
- Quando houver mais de uma correspondência, usar a mais recente.
- Quando não houver correspondência, seguir com a conversão contendo apenas o
  telefone protegido.
- Nunca impedir o envio da conversão por causa de falha na busca — sem
  correspondência, a conversão vai assim mesmo.
- Registrar, para cada conversão, se ela foi enriquecida ou não, para a operação
  saber a qualidade do que está sendo enviado.

### Módulo 3 — Envio da conversão ao Meta

**Descrição:** entrega ao Meta a conversão já filtrada e enriquecida, protegendo
os dados pessoais e permitindo que o Meta reconheça reenvios como o mesmo evento.

**Componentes:**
- Conversão montada: o evento com nome próprio, momento em que a entrada
  aconteceu, identificação do grupo e os identificadores da pessoa.
- Proteção dos dados pessoais: telefone e demais identificadores nunca trafegam
  legíveis.
- Identificador único do evento: permite que uma eventual repetição de envio seja
  reconhecida pelo Meta como o mesmo acontecimento, não como duas conversões.

**Comportamentos:**
- Enviar a conversão usando o momento real da entrada no grupo, não o momento do
  envio.
- Identificar no evento a qual grupo a entrada pertence.
- Proteger o telefone e os demais identificadores antes de enviar.
- Atribuir a cada conversão um identificador único e estável, derivado da própria
  entrada.
- Registrar o resultado de cada envio, incluindo a resposta recebida em caso de
  recusa.
- Não enviar conversão quando a integração com o Meta não estiver configurada,
  registrando o motivo.

### Módulo 4 — Falhas e reprocessamento

**Descrição:** garante que uma indisponibilidade momentânea não faça a conversão
se perder para sempre, e que a operação saiba quando algo parou.

**Componentes:**
- Fila de pendências: conversões aceitas que ainda não foram confirmadas pelo
  Meta.
- Histórico de tentativas: quantas vezes cada conversão foi tentada e com qual
  resultado.
- Aviso de interrupção: sinal para a operação quando as conversões param de
  chegar.

**Comportamentos:**
- Manter como pendente a conversão cujo envio falhou, sem marcá-la como enviada.
- Tentar novamente as conversões pendentes em execuções posteriores.
- Parar de tentar após um número máximo de tentativas, deixando a conversão
  marcada como falha definitiva.
- Não gerar conversão duplicada ao reprocessar uma pendência.
- Avisar a operação quando houver falhas repetidas de envio.
- Avisar a operação quando deixar de chegar qualquer movimentação de grupo por um
  período anormalmente longo, que é o sintoma de a fonte ter caído.

### Módulo 5 — Visibilidade para a operação

**Descrição:** deixa claro, sem precisar abrir o gerenciador do Meta, quantas
conversões foram enviadas e se o mecanismo está saudável.

**Componentes:**
- Contagem de conversões enviadas no período.
- Indicação de quantas foram enriquecidas com lead conhecido.
- Indicação de pendências e falhas.
- Registro da última execução bem-sucedida.

**Comportamentos:**
- Exibir quantas entradas viraram conversão no período selecionado.
- Exibir quantas entradas foram descartadas por já terem convertido antes.
- Exibir a proporção de conversões enriquecidas.
- Exibir quando foi a última conversão enviada com sucesso.
- Sinalizar visualmente quando houver falhas definitivas aguardando atenção.
- Manter a aba Grupos existente exatamente como está, sem alterar suas contagens.
