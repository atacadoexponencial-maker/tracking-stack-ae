// Conteúdo do Planner da Black Atacado — Workshop Black Exponencial, 23/09/2026.
//
// Fonte única da copy. A página (`src/pages/planner-workshop-black.astro`) e os
// componentes de `src/components/planner/` renderizam a partir daqui: não há
// texto solto no HTML. Corrigir uma frase é mexer neste arquivo, não na
// marcação — mesmo padrão de `materiais.js` e `lotes-workshop.js`.
//
// ⚠️ A `chave` de cada campo é CONTRATO, não detalhe. É ela que nomeia o
// controle no HTML, que o salvamento automático (issue 300) usa para guardar o
// rascunho no navegador de quem preencheu, e que a impressão (304) e o PDF
// (305) leem. Trocar uma chave depois que alguém preencheu apaga o rascunho
// dessa pessoa, sem aviso e sem recuperação. Renomeie rótulo à vontade; chave,
// não.

// ---------------------------------------------------------------------------
// Datas de 2026
// ---------------------------------------------------------------------------
// Conferidas contra o calendário e travadas por teste em
// `tests/planner-black-dados.test.js`. A Black Friday de 2026 cai em 27/11,
// sexta; a janela de antecipação de 45 a 30 dias antes dela vai de 13/10 a
// 28/10, e o Dia das Crianças (12/10) é a segunda-feira que abre tudo.
export const DATAS_2026 = {
  aquecimentoInicio: '2026-09-28',   // segunda — abre o aquecimento
  prazoArte: '2026-09-25',           // sexta — arte pronta antes do aquecimento
  pico1Inicio: '2026-10-12',         // segunda — Dia das Crianças
  pico1MinimoAte: '2026-10-25',      // domingo — fecha a semana da urgência
  pico2Inicio: '2026-11-09',         // segunda — varejo já em movimento
  blackVip: '2026-11-11',            // quarta — a data clássica
  blackFriday: '2026-11-27',         // sexta
  cyberMonday: '2026-11-30',         // segunda
  vendasFim: '2026-11-30',
  posVendaInicio: '2026-12-01',      // terça
};

// Marcador que aparece no lugar do nome da marca enquanto ela não foi escrita.
// A issue 301 é que troca isto pelo nome digitado; aqui ele é só texto.
export const LACUNA_MARCA = '[sua marca]';

// ---------------------------------------------------------------------------
// Cabeçalho
// ---------------------------------------------------------------------------
export const CABECALHO = {
  titulo: 'Planner da Black Atacado',
  apoio: 'Preencha durante o workshop. No fim, imprima ou salve.',
  aviso:
    'Seu preenchimento fica salvo neste navegador. Se você trocar de aparelho ou ' +
    'limpar o histórico, perde. Clique em Salvar antes de fechar.',
  campos: [
    { chave: 'marca', rotulo: 'Nome da sua marca', tipo: 'texto' },
    { chave: 'dataHoje', rotulo: 'Data de hoje', tipo: 'data', hoje: true },
  ],
};

// ---------------------------------------------------------------------------
// Bloco 1 — Onde você está e onde quer chegar
// ---------------------------------------------------------------------------
export const BLOCO_1 = {
  numero: 1,
  id: 'onde-voce-esta',
  titulo: 'Onde você está e onde quer chegar',
  // Rótulo curto da barra de blocos: os quatro precisam caber lado a lado na
  // largura de um celular. O título completo continua aparecendo dentro do
  // bloco.
  curto: 'Onde',
  secoes: [
    {
      titulo: 'Onde você está hoje',
      apoio:
        'Três números que você trouxe. Eles são a régua do resto do planner, e ' +
        'são o que você vai comparar em dezembro.',
      campos: [
        {
          chave: 'pedidoMinimoHoje',
          rotulo: 'Seu pedido mínimo de primeira compra hoje',
          tipo: 'numero',
          sufixo: 'peças',
        },
        {
          chave: 'ativosHoje',
          rotulo: 'Quantos revendedores ativos você tem na base hoje',
          tipo: 'numero',
          apoio: 'Ativo é quem comprou nos últimos 90 dias.',
        },
        {
          chave: 'faturamentoUltimaBlack',
          rotulo: 'Quanto sua marca faturou na última Black',
          tipo: 'dinheiro',
          apoio: 'Se você nunca rodou uma, escreva 0. Serve igual.',
        },
      ],
    },
    {
      titulo: 'Suas metas',
      apoio: 'Sem número aqui, oferta e calendário viram palpite.',
      campos: [
        {
          chave: 'metaNovos',
          rotulo: 'Quantos revendedores novos você quer conquistar nesta Black?',
          tipo: 'numero',
          apoio: 'Conte só quem nunca comprou de você.',
          meta: true,
        },
        {
          chave: 'metaReativados',
          rotulo: 'Quantos clientes inativos você quer reativar?',
          tipo: 'numero',
          apoio:
            'Quem já comprou e parou. Puxe da sua lista de quem não compra há ' +
            'mais de 90 dias.',
          meta: true,
        },
        {
          chave: 'metaSegundaCompra',
          rotulo: 'Quantos revendedores você quer fazer comprar duas vezes?',
          tipo: 'numero',
          apoio:
            'Comprou no pico de outubro, vendeu, e volta em novembro para ' +
            'repor. É esse número que separa uma Black de uma base maior.',
          meta: true,
        },
        {
          chave: 'metaFaturamento',
          rotulo: 'Quanto você quer faturar no período?',
          tipo: 'dinheiro',
          apoio: 'Outubro e novembro somados.',
          meta: true,
        },
      ],
    },
  ],
  // Painel derivado. Soma pura: ativos + novos + reativados. Nenhum percentual,
  // nenhuma projeção — decisão registrada na spec. A issue 301 é que calcula;
  // aqui está só o texto e a identificação do alvo.
  painelBase: {
    id: 'planner-base-final',
    titulo: 'Sua base no fim da Black',
    formula: ['ativosHoje', 'metaNovos', 'metaReativados'],
    frase:
      'Você quer terminar a Black com {total} revendedores ativos, contra ' +
      '{ativos} que tem hoje. Anote esse número. É ele que você vai conferir ' +
      'na virada do ano.',
  },
};

// ---------------------------------------------------------------------------
// Bloco 2 — Suas ofertas
// ---------------------------------------------------------------------------
export const BLOCO_2 = {
  numero: 2,
  id: 'ofertas',
  titulo: 'Suas ofertas',
  curto: 'Ofertas',
  abertura:
    'Você vai montar duas: uma para quem ainda não compra de você, outra para ' +
    'quem já compra.',
  margem: {
    chave: 'margemBruta',
    rotulo: 'Antes de escolher desconto, escreva sua margem bruta hoje',
    tipo: 'percentual',
    apoio:
      'Quanto sobra em cima do custo do produto, antes das despesas. Desconto ' +
      'maior que essa margem não é promoção, é prejuízo com movimento.',
  },
  picos: [
    {
      id: 'pico1',
      titulo: 'Pico 1 · Outubro · Conquistar revendedor novo',
      inicio: {
        chave: 'pico1Inicio',
        rotulo: 'Quando começa',
        tipo: 'data',
        sugerida: DATAS_2026.pico1Inicio,
        apoio:
          'De 30 a 45 dias antes da Black do varejo. Em 2026 essa janela vai ' +
          'de 13/10 a 28/10, e o Dia das Crianças, 12/10, é a segunda-feira ' +
          'que abre tudo. É o momento em que o lojista ainda tem dinheiro para ' +
          'arriscar uma marca que ele não conhece.',
      },
      narrativa: {
        chave: 'pico1Narrativa',
        rotulo: 'Sua narrativa',
        apoio: 'Escolha uma e adapte com o nome da sua marca:',
        opcoes: [
          {
            valor: 'antecipacao',
            angulo: 'Antecipação',
            texto:
              'a Black da {marca} começa em outubro, porque quem compra agora ' +
              'vende na Black inteira, e não só na sexta',
          },
          {
            valor: 'porta-de-entrada',
            angulo: 'Porta de entrada',
            texto:
              'esta é a única época do ano em que dá para começar a revender ' +
              '{marca} com pedido menor',
          },
          {
            valor: 'estoque-limitado',
            angulo: 'Estoque limitado',
            texto:
              'separamos uma quantidade para a Black e ela não será reposta. ' +
              'Quando acabar a grade, acabou',
          },
        ],
        propria: {
          chave: 'pico1NarrativaPropria',
          rotulo: 'Ou escreva a sua',
          tipo: 'texto-longo',
        },
      },
      // Espelho só de leitura do que foi digitado no bloco 1. A issue 301 liga.
      espelho: {
        id: 'planner-minimo-hoje-espelho',
        origem: 'pedidoMinimoHoje',
        rotulo: 'Seu mínimo de primeira compra hoje',
        sufixo: 'peças',
      },
      minimoReduzido: {
        chave: 'pico1MinimoReduzido',
        rotulo: 'Mínimo reduzido da campanha',
        tipo: 'numero',
        sufixo: 'peças',
        apoio:
          'Reduza um pouco, não muito. E defina prazo, senão vira vício e você ' +
          'perde a mão do seu mínimo.',
      },
      minimoAte: {
        chave: 'pico1MinimoReduzidoAte',
        rotulo: 'Até quando o mínimo reduzido vale',
        tipo: 'data',
        sugerida: DATAS_2026.pico1MinimoAte,
      },
      // Lista do Felipe (23/09/2026). Cada grupo tem a própria chave para a
      // folha impressa listar fixas e extras separadas. Os campos do mínimo
      // reduzido ficam sempre na tela, sob o título abaixo — decisão da
      // usuária de mexer só na copy, sem mostrar/esconder novo.
      minimoTitulo: 'Se marcou mínimo reduzido:',
      oferta: {
        rotulo: 'Sua oferta da Black Antecipada',
        apoio: 'Marque as que você vai usar',
        grupos: [
          {
            chave: 'pico1OfertaFixas',
            titulo: 'Ofertas fixas',
            opcoes: [
              { valor: 'minimo-reduzido', texto: 'Mínimo reduzido' },
              {
                valor: 'pagamento-facilitado',
                texto: 'Condição de pagamento facilitada',
                exemplo: 'exemplo: 3x sem juros',
              },
              { valor: 'categoria-desconto', texto: 'Categoria de produtos com desconto' },
            ],
          },
          {
            chave: 'pico1OfertaExtras',
            titulo: 'Ofertas extras',
            opcoes: [
              {
                valor: 'frete-especial',
                texto: 'Frete especial para novos revendedores',
                exemplo: 'frete grátis ou subsidiado, só no primeiro pedido',
              },
              {
                valor: 'credito-primeira-compra',
                texto: 'Crédito da primeira compra',
                exemplo:
                  '"Compre e ganhe R$ 100 para usar na sua primeira reposição até o dia X."',
              },
              {
                valor: 'sorteio-kit',
                texto: 'Sorteio de kit reposição',
                exemplo: 'compre e concorra a um kit de primeira reposição',
              },
              {
                valor: 'compre-e-ganhe',
                texto: 'Compre e ganhe',
                exemplo: 'faça seu cadastro e ganhe Y',
              },
              {
                valor: 'cashback-reposicao',
                texto: 'Cashback especial de reposição',
                exemplo:
                  'compre e ganhe X% de cashback na sua próxima reposição até o dia X',
              },
              { valor: 'outra', texto: 'Outra oferta' },
            ],
          },
        ],
        outra: {
          chave: 'pico1OutraOferta',
          rotulo: 'Outra oferta: escreva a sua',
          tipo: 'texto-longo',
        },
      },
      condicao: {
        chave: 'pico1Condicao',
        rotulo: 'Descreva como a sua oferta vai funcionar',
        tipo: 'texto-longo',
      },
    },
    {
      id: 'pico2',
      titulo: 'Pico 2 · Novembro · Fazer a base repor',
      inicio: {
        chave: 'pico2Inicio',
        rotulo: 'Quando começa',
        tipo: 'data',
        sugerida: DATAS_2026.pico2Inicio,
        apoio:
          'Durante o movimento do varejo. Quem comprou em outubro já vendeu e ' +
          'está sem produto.',
      },
      narrativa: {
        chave: 'pico2Narrativa',
        rotulo: 'Sua narrativa',
        apoio: 'Escolha uma e adapte:',
        opcoes: [
          {
            valor: 'reposicao',
            angulo: 'Reposição',
            texto:
              'vendeu tudo em outubro? A Reposição Black da {marca} chega para ' +
              'você não ficar sem grade na semana que mais vende',
          },
          {
            valor: 'ultima-hora',
            angulo: 'Última hora',
            texto:
              'não deu para se antecipar? A Black Última Hora garante que você ' +
              'ainda entre na festa',
          },
          {
            valor: 'base-primeiro',
            angulo: 'Base primeiro',
            texto:
              'quem já é cliente da {marca} compra antes, com uma condição que ' +
              'não vai para fora',
          },
        ],
        propria: {
          chave: 'pico2NarrativaPropria',
          rotulo: 'Ou escreva a sua',
          tipo: 'texto-longo',
        },
      },
      oferta: {
        rotulo: 'Sua oferta da Black Reposição',
        apoio: 'Marque as que você vai usar',
        grupos: [
          {
            chave: 'pico2OfertaFixas',
            titulo: 'Ofertas fixas',
            opcoes: [
              {
                valor: 'pagamento-facilitado',
                texto: 'Condição especial de pagamento facilitada',
                exemplo: 'exemplo: 3x sem juros',
              },
              { valor: 'categoria-desconto', texto: 'Categoria de produtos com desconto' },
            ],
          },
          {
            chave: 'pico2OfertaExtras',
            titulo: 'Ofertas extras',
            opcoes: [
              {
                valor: 'combo-reposicao',
                texto: 'Combo de reposição com desconto',
                exemplo: 'mix pronto com os produtos de maior giro, com desconto',
              },
              {
                valor: 'minimo-recuperacao',
                texto: 'Mínimo reduzido para recuperação',
                exemplo: 'com gatilho de urgência',
              },
              {
                valor: 'cupom-reativacao',
                texto: 'Cupom de reativação',
                exemplo: 'cupom especial para revendedores inativos ou perdidos',
              },
              {
                valor: 'credito-retorno',
                texto: 'Crédito de retorno',
                exemplo:
                  '"Volte a comprar agora e receba R$ X de crédito para sua próxima reposição."',
              },
              {
                valor: 'produto-bonus',
                texto: 'Produto bônus',
                exemplo: 'brinde ou mercadoria adicional acima de determinado ticket',
              },
              { valor: 'outra', texto: 'Outra oferta' },
            ],
          },
        ],
        outra: {
          chave: 'pico2OutraOferta',
          rotulo: 'Outra oferta: escreva a sua',
          tipo: 'texto-longo',
        },
      },
      condicao: {
        chave: 'pico2Condicao',
        rotulo: 'Descreva como a sua oferta vai funcionar',
        tipo: 'texto-longo',
      },
      // Região condicional: responder "não" tira o dia e o local da tela e da
      // impressão. A issue 302 é que liga o mostrar/esconder.
      vip: {
        chave: 'blackVip',
        rotulo: 'Você vai fazer Black VIP?',
        apoio:
          'A Black VIP é um dia só, exclusivo para quem está no seu grupo de ' +
          'ativos, antes da Black Friday. Muita urgência e muita exclusividade.',
        regiaoId: 'planner-vip-detalhes',
        opcoes: [
          { valor: 'sim', texto: 'Sim' },
          { valor: 'nao', texto: 'Não' },
        ],
        detalhes: [
          {
            chave: 'blackVipDia',
            rotulo: 'Se sim, em que dia',
            tipo: 'data',
            sugerida: DATAS_2026.blackVip,
            apoio:
              'O 11/11 é a data clássica, mas qualquer dia antes da Black ' +
              'funciona.',
          },
          {
            chave: 'blackVipOnde',
            rotulo: 'Onde ela acontece',
            tipo: 'texto-longo',
            apoio: 'Grupo de WhatsApp, comunidade, lista fechada.',
          },
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Bloco 3 — Seu calendário
// ---------------------------------------------------------------------------
export const BLOCO_3 = {
  numero: 3,
  id: 'calendario',
  titulo: 'Seu calendário',
  curto: 'Agenda',
  abertura:
    'Uma Black parada vende menos que uma Black com movimento toda semana. As ' +
    'datas de 2026 já vêm posicionadas: a Black Friday cai em 27/11, uma sexta, ' +
    'e a janela de antecipação de 30 a 45 dias vai de 13/10 a 28/10. Ajuste o ' +
    'que quiser, mas o esqueleto já está de pé.',
  trilhas: [
    {
      id: 'outubro',
      titulo: 'Trilha de outubro · trazer gente nova',
      semanas: [
        {
          chave: 'semanaOut1',
          periodo: '28/09 a 04/10',
          funcao: 'Aquecimento. Avise que vem, sem contar a condição.',
        },
        {
          chave: 'semanaOut2',
          periodo: '05/10 a 11/10',
          funcao:
            'Última semana de expectativa. Abra lista ou grupo de quem quer ' +
            'saber primeiro.',
        },
        {
          chave: 'semanaOut3',
          periodo: '12/10 a 18/10',
          funcao: 'Abertura do pico 1. Mínimo reduzido no ar.',
        },
        {
          chave: 'semanaOut4',
          periodo: '19/10 a 25/10',
          funcao: 'Prazo do mínimo reduzido acabando. Aqui entra urgência.',
        },
        {
          chave: 'semanaOut5',
          periodo: '26/10 a 01/11',
          funcao:
            'Fechamento do pico 1 e primeira conversa de reposição com quem ' +
            'comprou.',
        },
      ],
    },
    {
      id: 'novembro',
      titulo: 'Trilha de novembro · fazer a base repor',
      semanas: [
        {
          chave: 'semanaNov1',
          periodo: '02/11 a 08/11',
          funcao: 'Convite para o grupo VIP. Só para quem já é cliente.',
        },
        {
          chave: 'semanaNov2',
          periodo: '09/11 a 15/11',
          funcao: 'Black VIP, 11/11. Um dia, condição que não vai para fora.',
        },
        {
          chave: 'semanaNov3',
          periodo: '16/11 a 22/11',
          funcao: 'Pré-Black. Mostre o que entra e deixe o carrinho pronto.',
        },
        {
          chave: 'semanaNov4',
          periodo: '23/11 a 29/11',
          funcao:
            'Black Week, com a Friday em 27/11 e a Cyber Monday em 30/11.',
        },
        {
          chave: 'semanaNov5',
          periodo: '30/11 a 06/12',
          funcao:
            'Black November e virada de dezembro. Última reposição do ano.',
        },
      ],
    },
  ],
  destaques: [
    {
      chave: 'diferencialBlackWeek',
      rotulo: 'Seu diferencial da Black Week',
      tipo: 'texto-longo',
      apoio:
        'Crie um diferencial para a Week, mas guarde o destaque para a Friday.',
    },
    {
      chave: 'acaoBlackFriday',
      rotulo: 'O que você faz no dia 27/11',
      tipo: 'texto-longo',
      apoio: 'Aqui é urgência e escassez, sem economia.',
    },
  ],
  fases: {
    titulo: 'Suas três fases',
    lista: [
      {
        id: 'aquecimento',
        nome: 'Aquecimento',
        datas: [
          {
            chave: 'aquecimentoInicio',
            rotulo: 'começa em',
            tipo: 'data',
            sugerida: DATAS_2026.aquecimentoInicio,
          },
        ],
        campo: {
          chave: 'aquecimentoComo',
          rotulo: 'Como você vai preparar a base',
          tipo: 'texto-longo',
        },
        apoio:
          'Um evento não pode simplesmente acontecer do nada. Antecipe, gere ' +
          'curiosidade e crie expectativa. Muitas vezes a expectativa sobre o ' +
          'que vai acontecer vale mais que o acontecimento. Repare na data: é ' +
          'semana que vem.',
      },
      {
        id: 'vendas',
        nome: 'Vendas',
        datas: [
          {
            chave: 'vendasInicio',
            rotulo: 'de',
            tipo: 'data',
            sugerida: DATAS_2026.pico1Inicio,
          },
          {
            chave: 'vendasFim',
            rotulo: 'a',
            tipo: 'data',
            sugerida: DATAS_2026.vendasFim,
          },
        ],
        apoio: 'É aqui que sai a maior parte do seu investimento.',
      },
      {
        id: 'pos-venda',
        nome: 'Pós-venda',
        datas: [
          {
            chave: 'posVendaInicio',
            rotulo: 'a partir de',
            tipo: 'data',
            sugerida: DATAS_2026.posVendaInicio,
          },
        ],
        campo: {
          chave: 'posVendaMede',
          rotulo: 'O que você mede depois',
          tipo: 'texto-longo',
        },
        apoio:
          'O que acertamos, o que precisamos melhorar, e o que fazer para o ' +
          'cliente novo comprar de novo em dezembro. Volte no bloco 1 e ' +
          'compare a base de hoje com a base de agora.',
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Bloco 4 — Seus canais
// ---------------------------------------------------------------------------
export const BLOCO_4 = {
  numero: 4,
  id: 'canais',
  titulo: 'Seus canais',
  curto: 'Canais',
  abertura: 'Marque os canais que você vai usar e quem responde por cada um.',
  canais: [
    { id: 'live-boom', nome: 'Live Boom' },
    { id: 'trafego-pago', nome: 'Tráfego pago' },
    { id: 'redes-sociais', nome: 'Redes sociais' },
    { id: 'whatsapp', nome: 'WhatsApp' },
    { id: 'email-marketing', nome: 'E-mail marketing' },
    { id: 'influenciadores', nome: 'Influenciadores' },
    { id: 'live-commerce', nome: 'Live commerce' },
    { id: 'acoes-offline', nome: 'Ações offline' },
  ],
  recado:
    'Se é você quem faz tudo, escreva seu nome em todas. Ver o próprio nome ' +
    'oito vezes é a informação mais útil desta tabela.',
  campos: [
    {
      chave: 'nomeCampanha',
      rotulo: 'Nome da campanha',
      tipo: 'texto-longo',
      apoio:
        'Sua Black precisa de nome próprio. Black Atacado da {marca}, Black ' +
        'Antecipada, Reposição Black.',
    },
    {
      chave: 'prazoArte',
      rotulo: 'Prazo para a arte ficar pronta',
      tipo: 'data',
      sugerida: DATAS_2026.prazoArte,
      apoio:
        'Conte para trás a partir do aquecimento, não a partir da venda. Se o ' +
        'aquecimento começa em 28/09, a arte fica pronta nesta semana.',
    },
  ],
};

// Cada canal vira dois controles: a marcação de usar e o nome do responsável.
// Derivado, e não escrito à mão, para as chaves nunca saírem de sincronia com
// a lista de canais acima.
export function chavesDoCanal(canal) {
  const sufixo = canal.id
    .split('-')
    .map((parte, i) => (i === 0 ? parte : parte[0].toUpperCase() + parte.slice(1)))
    .join('');
  return {
    usar: `canal_${sufixo}_usar`,
    responsavel: `canal_${sufixo}_responsavel`,
  };
}

// ---------------------------------------------------------------------------
// Rodapé
// ---------------------------------------------------------------------------
export const RODAPE = {
  fecho: 'Sua Black está montada.',
  instrucao: 'Imprima, cole na parede da expedição e vá executar.',
  botoes: [
    { id: 'planner-imprimir', texto: 'Imprimir meu planner', papel: 'imprimir' },
    { id: 'planner-baixar-pdf', texto: 'Salvar', papel: 'pdf' },
  ],
  aviso: 'Seu preenchimento fica só neste navegador',
};

// ---------------------------------------------------------------------------
// Microcopy de interface
// ---------------------------------------------------------------------------
// Os textos que as issues 300 a 306 exibem. Moram aqui para a copy inteira
// ficar num lugar só, mesmo a que ainda não é exibida por ninguém.
export const MICROCOPY = {
  salvo: 'Salvo agora há pouco',
  semArmazenamento:
    'Este navegador não está deixando guardar o rascunho. Você pode preencher e ' +
    'baixar o PDF normalmente, mas não feche a página antes de baixar.',
  blocoIncompleto: 'Faltam campos no bloco {bloco}. Imprimir assim mesmo?',
  metaVazia:
    'Coloque um número, mesmo que seja chute. Meta redonda é melhor que meta ' +
    'nenhuma.',
  dataSugerida: 'Data sugerida para 2026. Clique para trocar.',
  sairSemLevar:
    'Você preencheu o planner e ainda não imprimiu. Sair mesmo?',
  senhaIncorreta: 'Senha incorreta. Confira e tente de novo.',
  senhaVazia: 'Digite a senha que você recebeu.',
};

export const BLOCOS = [BLOCO_1, BLOCO_2, BLOCO_3, BLOCO_4];
