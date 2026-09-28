// Catálogo dos materiais ricos entregues via ManyChat (issue 146).
//
// Fonte única de verdade: a página /materiais/[slug] gera uma rota por entrada
// daqui, e o /tracker resolve o destino do redirect pelo mesmo catálogo — por
// isso este arquivo é .js puro, consumível tanto pelo Astro quanto pelas Pages
// Functions (mesmo precedente de config/products.js em functions/webhook/_core.js).
//
// Lançar material novo é acrescentar uma entrada, colocar a capa (1ª página do
// PDF) em src/assets/materiais/<slug>.png e fazer deploy. `itens` é a lista
// "o que você vai encontrar" da folha de rosto. Todos
// compartilham o funil 'iscas-manychat'; o que distingue um do outro no
// tracking é o `slug`, gravado em event_log.material.
//
// O `destino` NÃO é exposto ao frontend: a página conhece só o próprio slug e
// recebe o link do backend na resposta do /tracker.

export const FUNIL_MATERIAIS = 'iscas-manychat';

export const MATERIAIS = [
  {
    slug: 'icp',
    titulo: 'Mapeie seu Cliente Ideal (ICP)',
    subtitulo:
      'O framework completo para marcas de atacado definirem, estruturarem e ativarem seu perfil de cliente ideal com dados reais, não achismo.',
    itens: [
      'Quadro do cliente ideal: dados firmográficos, tecnográficos e comportamentais',
      'Referências de mercado: 3 perfis para estudar e se inspirar',
      'Mapa de dores, desejos, medos e crenças limitantes do seu cliente',
      'Consolidado do mercado: total de empresas, ativas e com contato',
    ],
    destino: 'https://drive.google.com/file/d/1vxZUBN71vJF7SUbuN7GtkV6TQYL03rMz/view',
  },
  {
    slug: 'catalogo-primeira-compra',
    titulo: 'Catálogo de Primeira Compra',
    subtitulo:
      'Como transformar a ferramenta mais tradicional do atacado em uma máquina de novos revendedores.',
    itens: [
      'Por que cliente nova precisa de um catálogo só para a primeira compra',
      'Os 7 elementos que não podem faltar no seu catálogo',
      'Os 5 erros que matam a conversão',
      'Como usar o catálogo na sequência comercial, com checklist final',
    ],
    destino: 'https://drive.google.com/file/d/1BhwUlvIC2uEdFjB2CLYSDrfXzr9B8npN/view',
  },
  {
    slug: 'sell-out',
    titulo: 'Sell-Out: a venda depois da venda',
    subtitulo:
      'Como ajudar o seu revendedor a vender mais e transformar o sucesso dele em recompra para a sua marca.',
    itens: [
      'Sell-in × sell-out e o ciclo da felicidade do método',
      'As 4 vantagens que o sell-out constrói para a marca',
      'O arsenal em 3 níveis: dos materiais essenciais aos eventos',
      'Onde o sell-out entra na sua operação, com checklist',
    ],
    destino: 'https://drive.google.com/file/d/1UdFjtfgGX-bQEFUwBdVcSGMYIPC_fovl/view',
  },
];

export function materialPorSlug(slug) {
  const alvo = (slug || '').toString().toLowerCase().trim();
  if (!alvo) return null;
  return MATERIAIS.find((m) => m.slug === alvo) || null;
}
