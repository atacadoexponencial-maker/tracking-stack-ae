// Catálogo dos materiais ricos entregues via ManyChat (issue 146).
//
// Fonte única de verdade: a página /materiais/[slug] gera uma rota por entrada
// daqui, e o /tracker resolve o destino do redirect pelo mesmo catálogo — por
// isso este arquivo é .js puro, consumível tanto pelo Astro quanto pelas Pages
// Functions (mesmo precedente de config/products.js em functions/webhook/_core.js).
//
// Lançar material novo é acrescentar uma entrada e fazer deploy. Todos
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
      'O framework completo para marcas de atacado definirem, estruturarem e ativarem seu perfil de cliente ideal com dados reais — não achismo.',
    destino: 'https://drive.google.com/file/d/1vxZUBN71vJF7SUbuN7GtkV6TQYL03rMz/view',
  },
];

export function materialPorSlug(slug) {
  const alvo = (slug || '').toString().toLowerCase().trim();
  if (!alvo) return null;
  return MATERIAIS.find((m) => m.slug === alvo) || null;
}
