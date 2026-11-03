// Aplicação para o plano de ação ao vivo. 1ª edição: workshop de 07/10/2026
// (spec-aplicacao-plano-ao-vivo.md, issues 370–372). 2ª edição: 11/11/2026.
//
// Fonte única das perguntas: a página monta as etapas daqui e o servidor
// (functions/api/aplicacao-plano-ao-vivo.js) confere as respostas pelas mesmas
// listas antes de gravar na planilha. Por isso é .js puro, consumível pelo
// Astro e pelas Pages Functions (mesmo precedente de materiais.js).
//
// A ordem do array é a ordem das colunas na planilha (depois de Data/hora).

// Segunda, 09/11/2026, 23h59 em Brasília. A partir deste instante as
// aplicações estão encerradas. Quem decide é o servidor, nunca o navegador.
export const ENCERRA_EM_MS = Date.parse('2026-11-10T03:00:00Z');

export function aplicacoesAbertas(agoraMs = Date.now()) {
  return agoraMs < ENCERRA_EM_MS;
}

// Etapa 1 junta os dados da marca; da pergunta 5 em diante, uma por tela
// (pedido dela em 03/10: a etapa de 5 perguntas ficou longa demais).
export const TOTAL_ETAPAS = 10;

export const PERGUNTAS = [
  { name: 'nome', etapa: 1, tipo: 'texto', rotulo: 'Seu nome', coluna: 'Nome', placeholder: 'Nome', autocomplete: 'name' },
  { name: 'telefone', etapa: 1, tipo: 'telefone', rotulo: 'WhatsApp', coluna: 'WhatsApp', placeholder: 'WhatsApp com DDD', autocomplete: 'tel' },
  { name: 'marca', etapa: 1, tipo: 'texto', rotulo: 'Nome da marca e @ do Instagram', coluna: 'Marca e Instagram', placeholder: 'Marca e @suamarca' },
  { name: 'vende', etapa: 1, tipo: 'texto', rotulo: 'O que a sua marca vende?', coluna: 'O que vende', placeholder: 'Ex.: moda feminina, semijoias, moda íntima' },
  {
    name: 'faturamento', etapa: 2, tipo: 'uma', rotulo: 'Faturamento médio por mês', coluna: 'Faturamento',
    opcoes: ['Até R$ 30 mil', 'R$ 30 a 70 mil', 'R$ 70 a 150 mil', 'R$ 150 a 300 mil', 'Acima de R$ 300 mil'],
  },
  {
    name: 'publico', etapa: 3, tipo: 'varias', rotulo: 'Para quem você vende principalmente?', dica: 'Pode marcar mais de uma.', coluna: 'Para quem vende',
    opcoes: ['Lojista', 'Revendedora/sacoleira', 'Empreendedora começando', 'Distribuidor'],
  },
  {
    name: 'entrada', etapa: 4, tipo: 'varias', rotulo: 'Como chegam os seus revendedores novos hoje?', dica: 'Pode marcar mais de uma.', coluna: 'Como chegam os revendedores',
    opcoes: ['Anúncio pago', 'Instagram orgânico', 'Indicação', 'Vendedor ou representante', 'Outro'],
  },
  {
    name: 'investimento', etapa: 5, tipo: 'uma', rotulo: 'Quanto você investe em anúncio por mês?', coluna: 'Investimento em anúncio',
    opcoes: ['Não invisto', 'Até R$ 3 mil', 'R$ 3 a 10 mil', 'Acima de R$ 10 mil'],
  },
  {
    name: 'comercial', etapa: 6, tipo: 'uma', rotulo: 'Quantas pessoas atendem no comercial?', coluna: 'Pessoas no comercial',
    opcoes: ['Só eu', '1 pessoa', '2 a 4', '5 ou mais'],
  },
  {
    name: 'recompra', etapa: 7, tipo: 'uma', rotulo: 'Quanto do seu faturamento vem de quem já comprou antes?', coluna: 'Recompra',
    opcoes: ['Menos da metade', 'Mais ou menos metade', 'Mais da metade', 'Não sei'],
  },
  { name: 'trava', etapa: 8, tipo: 'caixa', rotulo: 'O que mais trava o crescimento do seu atacado hoje?', coluna: 'O que trava', placeholder: 'Conte com as suas palavras' },
  {
    name: 'ao_vivo', etapa: 9, tipo: 'uma', rotulo: 'Se a sua marca for escolhida, você topa mostrar ao vivo o anúncio, o perfil e os números?', coluna: 'Topa mostrar ao vivo',
    opcoes: ['Sim', 'Sim, mas sem números exatos', 'Não'],
  },
  {
    name: 'disponivel', etapa: 10, tipo: 'uma', rotulo: 'Você consegue estar ao vivo na quarta, 11/11, às 19h, com câmera e microfone?', coluna: 'Disponível 11/11 19h',
    opcoes: ['Sim', 'Não'],
  },
];

// Limite de tamanho por resposta de texto (o servidor recusa acima disso).
export const MAX_TEXTO = 120;
export const MAX_CAIXA = 2000;

export const CABECALHO = ['Data/hora', ...PERGUNTAS.map((p) => p.coluna), 'Origem'];

export const TEXTOS = {
  selo: 'Plano de Ação · ao vivo',
  titulo: 'Análise individual ao vivo + checklist do seu atacado',
  subtitulo: 'Na quarta, o Felipe analisa 2 atacados ao vivo, olhando perfil, anúncio e comercial, e monta o plano de ação de cada um. O seu pode ser um deles.',
  naoEscolhida: 'Se a sua marca não for escolhida, você assiste às duas análises e leva o checklist do plano de ação para aplicar no seu atacado (liberado ao vivo para quem ficar até o fim).',
  quando: 'Quarta, 11/11 · 19h',
  onde: 'Google Meet · ao vivo',
  cta: 'Quero aplicar a minha marca',
  nota: 'Só 2 vagas. Aplicar não garante a vaga. Leva uns 3 minutos.',
  prazo: 'Aplicações abertas até segunda, 09/11, às 23h59.',
  lembrete: 'O link do Meet chega no grupo de WhatsApp.',
  obrigado: {
    titulo: 'Aplicação recebida',
    escolhidaRotulo: 'Se a sua marca for escolhida',
    escolhida: 'Avisamos pelo WhatsApp na quarta, 11/11, até o meio-dia.',
    naoEscolhidaRotulo: 'Se não for',
    naoEscolhida: 'Você assiste às duas análises e leva o checklist do plano de ação para aplicar no seu atacado (liberado ao vivo para quem ficar até o fim).',
    data: 'Quarta, 11/11 · 19h · Google Meet',
    link: 'O link chega no grupo de WhatsApp e por aqui.',
  },
  encerradas: 'As aplicações foram encerradas.',
  encerradasLembrete: 'O link do Meet chega no grupo de WhatsApp.',
};

/**
 * Confere as respostas (mesmas listas da página). O formato do telefone é
 * conferido à parte pela regra única do servidor (functions/_telefone.js). Devolve
 * { ok: true, valores } com os textos prontos para a planilha, ou
 * { ok: false, campo } com o primeiro campo inválido.
 */
export function validarAplicacao(respostas) {
  const r = respostas && typeof respostas === 'object' ? respostas : {};
  const valores = {};
  for (const p of PERGUNTAS) {
    const bruto = r[p.name];
    if (p.tipo === 'varias') {
      const lista = Array.isArray(bruto) ? bruto.map((x) => String(x)) : [];
      if (!lista.length || lista.some((x) => !p.opcoes.includes(x))) return { ok: false, campo: p.name };
      valores[p.name] = p.opcoes.filter((o) => lista.includes(o)).join(', ');
    } else if (p.tipo === 'uma') {
      const v = String(bruto ?? '');
      if (!p.opcoes.includes(v)) return { ok: false, campo: p.name };
      valores[p.name] = v;
    } else {
      const v = String(bruto ?? '').trim();
      const max = p.tipo === 'caixa' ? MAX_CAIXA : MAX_TEXTO;
      if (v.length < 2 || v.length > max) return { ok: false, campo: p.name };
      valores[p.name] = v;
    }
  }
  return { ok: true, valores };
}
