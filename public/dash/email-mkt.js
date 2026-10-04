// E-mail próprio no dash (spec-email-proprio.md). PROTÓTIPOS das issues 373–376.
//
// Só front, com dados de exemplo gerados aqui mesmo: nada chama a API, nada é
// salvo nem enviado. Serve para a usuária navegar pelas telas na prévia e
// aprovar o desenho antes das issues de construção (377–388).
//
// - App Marketing, seção `mkt-email`, sub-vistas por `?v=`: campanhas,
//   relatorio, fluxos, contatos, segmentos, modelos, configuracao.
// - App Agenda, seção `agenda-emails`: e-mails da agenda por tipo de reunião
//   (ligada ao backend na 379).
// - O quadro dos fluxos mora em public/dash/email-fluxos.js.
//
// Padrões de UX copiados do agenda.js: gaveta lateral para o que abre de uma
// linha, aviso curto (toast) para cada ação, engrenagem para ações da linha e
// confirmação na própria linha (pedirConfirmacao do dash). Reusa o CSS `ag-*`.
(() => {
  'use strict';

  const VISTAS = ['campanhas', 'relatorio', 'fluxos', 'contatos', 'segmentos', 'modelos', 'configuracao'];
  // Vistas ligadas ao backend (377, 378, 380–385).
  const VISTAS_REAIS = ['campanhas', 'relatorio', 'fluxos', 'contatos', 'segmentos', 'modelos', 'configuracao'];
  const TITULO_VISTA = {
    campanhas: 'Campanhas de e-mail', relatorio: 'Resultados do e-mail', fluxos: 'Fluxos automáticos',
    contatos: 'Contatos de e-mail', segmentos: 'Segmentos', modelos: 'Modelos de e-mail', configuracao: 'Configuração de e-mail',
  };
  const ROTULO_SUBNAV = { campanhas: 'Campanhas', relatorio: 'Resultados', fluxos: 'Fluxos', contatos: 'Contatos', segmentos: 'Segmentos', modelos: 'Modelos', configuracao: 'Configuração' };
  const NOTA_VISTA = {
    campanhas: 'disparos do canal de marketing', relatorio: 'resultado de cada disparo e do canal',
    fluxos: 'sequências que começam sozinhas', contatos: 'quem pode receber marketing',
    segmentos: 'grupos de contatos montados por regra', modelos: 'textos reutilizáveis dos dois canais',
    configuracao: 'remetentes, rodapé e situação do serviço de envio',
  };

  const svg = (corpo) => `<svg viewBox="0 0 24 24" aria-hidden="true">${corpo}</svg>`;
  const ICONE = {
    engrenagem: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    fechar: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    voltar: svg('<path d="M15 6l-6 6 6 6"/>'),
    computador: svg('<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>'),
    celular: svg('<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>'),
  };

  let ctx = null;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const int = (n) => Number(n || 0).toLocaleString('pt-BR');
  const pct = (n, c = 1) => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: c, minimumFractionDigits: c }) + '%';
  const taxa = (a, b, c = 1) => (b ? pct((a / b) * 100, c) : '');

  // ---------------------------------------------------------------------------
  // Cenário do protótipo: deixa ver os estados de erro e de vazio sem backend.
  // ---------------------------------------------------------------------------
  const CENARIOS = [
    ['ok', 'Tudo certo'],
    ['dominio', 'Domínio com problema'],
    ['marketing', 'Marketing não liberado'],
    ['vazio', 'Tudo vazio (primeiro dia)'],
  ];
  let cenario = 'ok';
  const vazio = () => cenario === 'vazio';
  const marketingLiberado = () => cenario !== 'marketing';

  function seloProto(semCenario) {
    return `<div class="em-proto" role="note">
      <span class="em-proto__selo">Protótipo</span>
      <span>Dados de exemplo. Nada aqui é salvo nem enviado.</span>
      ${semCenario ? '' : `<label class="em-proto__cen">Ver estado
        <select data-cenario aria-label="Estado de exemplo">${CENARIOS.map(([v, r]) => `<option value="${v}"${v === cenario ? ' selected' : ''}>${r}</option>`).join('')}</select></label>`}
    </div>`;
  }
  function ligarCenario(raiz, redesenhar) {
    const s = raiz.querySelector('[data-cenario]');
    if (s) s.onchange = () => { cenario = s.value; avisar(`Mostrando: ${CENARIOS.find((c) => c[0] === cenario)[1].toLowerCase()}.`); redesenhar(); };
  }

  // ---------------------------------------------------------------------------
  // Dados de exemplo (determinísticos: a mesma prévia mostra sempre o mesmo)
  // ---------------------------------------------------------------------------
  function aleatorio(semente) {
    let a = semente;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const NOMES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduarda', 'Fábio', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Karina', 'Lucas', 'Mariana', 'Nelson', 'Olívia', 'Paulo', 'Rafaela', 'Sérgio', 'Tatiane', 'Vinícius', 'Juliana', 'Marcos', 'Patrícia', 'Rodrigo', 'Simone', 'Thiago', 'Camila', 'André', 'Letícia', 'Gustavo'];
  const SOBRENOMES = ['Almeida', 'Barbosa', 'Cardoso', 'Duarte', 'Esteves', 'Ferreira', 'Gomes', 'Holanda', 'Lima', 'Machado', 'Nogueira', 'Oliveira', 'Pereira', 'Queiroz', 'Rocha', 'Santana', 'Teixeira', 'Vieira', 'Xavier', 'Moraes'];
  const ORIGENS = ['Meta Ads', 'Google Ads', 'Instagram orgânico', 'ManyChat', 'Direto'];
  const FUNIS = [['workshop-gratuito', 'Workshop gratuito'], ['sessao-estrategica', 'Sessão estratégica'], ['aplicacao-mentoria', 'Aplicação mentoria'], ['trafego-atacado', 'Tráfego atacado'], ['materiais', 'Materiais (iscas)']];
  const ESTAGIOS = ['Lead', 'MQL', 'Reunião agendada', 'Reunião realizada', 'Contrato'];
  const SITUACOES = {
    ativo: ['Ativo', 'alta'], descadastrado: ['Descadastrado', 'neutro'], voltou: ['Voltou', 'queda'],
    denunciou: ['Denunciou spam', 'queda'], invalido: ['Inválido', 'alerta'],
  };
  // Nome de leitura do funil (o tracking grava o nome técnico). Funil novo sem
  // entrada aqui vira "Nome do funil" a partir do próprio nome técnico.
  const NOME_FUNIL = {
    workshop: 'Workshop gratuito', 'workshop-gratuito': 'Workshop gratuito', 'sessao-estrategica': 'Sessão estratégica',
    'lives-semanais-v1': 'Lives semanais', 'aplicacao-mentoria': 'Aplicação mentoria', 'trafego-atacado': 'Tráfego atacado',
    diagnostico: 'Diagnóstico (antigo)', 'iscas-manychat': 'Materiais (iscas)', materiais: 'Materiais (iscas)', calculadora: 'Calculadora do atacado',
  };
  const nomeFunil = (f) => {
    if (!f) return '';
    if (NOME_FUNIL[f]) return NOME_FUNIL[f];
    const t = String(f).replace(/[-_]+/g, ' ').trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  // 20/07/2026 (quando o tracking passou a mandar leads) até hoje, 03/10/2026.
  const INICIO = Date.UTC(2026, 6, 20), HOJE = Date.UTC(2026, 9, 3);
  const dataBR = (t) => new Date(t).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
  const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const CAMPANHAS_BASE = [
    { id: 'c1', nome: 'Convite workshop 08/10', situacao: 'enviada', modelo: 'm6', segmentos: ['s1'], envio: '01/10 às 09:00', dest: 1912, entregues: 1871, voltaram: 17, spam: 2, abertos: 812, clicados: 214, descad: 9 },
    { id: 'c2', nome: 'Novidade: plano ao vivo', situacao: 'enviada', modelo: 'm12', segmentos: ['s2', 's5'], envio: '24/09 às 10:30', dest: 1240, entregues: 1219, voltaram: 11, spam: 1, abertos: 498, clicados: 96, descad: 6 },
    { id: 'c3', nome: 'Convite workshop 22/10', situacao: 'agendada', modelo: 'm6', segmentos: ['s1', 's3'], envio: '20/10 às 09:00', dest: 2050 },
    { id: 'c4', nome: 'Lembrete aplicação plano ao vivo', situacao: 'enviando', modelo: 'm12', segmentos: ['s2'], envio: 'hoje às 14:00', dest: 860, progresso: 63, falhas: 2 },
    { id: 'c5', nome: 'Black do atacado', situacao: 'rascunho', modelo: 'm10', segmentos: ['s3'], envio: '' },
    { id: 'c6', nome: 'Convite workshop 24/09', situacao: 'cancelada', modelo: 'm6', segmentos: ['s1'], envio: 'era 23/09 às 09:00' },
    { id: 'c7', nome: 'Reengajamento de julho', situacao: 'falhou', modelo: 'm12', segmentos: ['s3'], envio: '18/09 às 11:00', motivo: 'O serviço de envio recusou o disparo: o marketing ainda não estava liberado na conta. Nada foi enviado.' },
  ];
  const SITUACAO_CAMP = {
    rascunho: ['Rascunho', 'neutro'], agendada: ['Agendada', 'alerta'], enviando: ['Enviando', 'alerta'],
    enviada: ['Enviada', 'alta'], cancelada: ['Cancelada', 'neutro'], falhou: ['Falhou', 'queda'],
  };

  const SEGMENTOS_BASE = [
    { id: 's1', nome: 'Leads do workshop gratuito', regras: [{ campo: 'funil', op: 'e', valor: 'workshop-gratuito' }] },
    { id: 's2', nome: 'MQLs sem reunião', regras: [{ campo: 'estagio', op: 'e', valor: 'MQL' }] },
    { id: 's3', nome: 'Entraram nos últimos 30 dias', regras: [{ campo: 'entrada', op: 'ultimos', valor: '30' }] },
    { id: 's4', nome: 'Abriram o convite de 01/10', regras: [{ campo: 'abriu', op: 'sim', valor: 'c1' }] },
    { id: 's5', nome: 'Sessão estratégica vindos do Meta', regras: [{ campo: 'origem', op: 'e', valor: 'Meta Ads' }, { campo: 'funil', op: 'e', valor: 'sessao-estrategica' }] },
  ];

  const MODELOS_BASE = [
    { id: 'm1', nome: 'Confirmação de reunião', canal: 'transacional', assunto: 'Sua reunião está confirmada, {{primeiro_nome}}', previa: '{{data_reuniao}} às {{hora_reuniao}}, pelo Google Meet.', editado: '02/10', corpo: 'Oi, {{primeiro_nome}}!\n\nSua **{{tipo_reuniao}}** está confirmada para {{data_reuniao}} às {{hora_reuniao}} (horário de Brasília).\n\n[[Entrar na reunião | {{link_reuniao}}]]\n\nSe precisar mudar o horário, é só [remarcar por aqui]({{link_remarcar}}).\n\nAté lá,\nEquipe Atacado Exponencial' },
    { id: 'm2', nome: 'Lembrete 24h antes', canal: 'transacional', assunto: 'Amanhã: sua {{tipo_reuniao}}', previa: 'Amanhã às {{hora_reuniao}}. Guarde o link.', editado: '02/10', corpo: 'Oi, {{primeiro_nome}}!\n\nPassando para lembrar: sua reunião é **amanhã, às {{hora_reuniao}}**.\n\n[[Entrar na reunião | {{link_reuniao}}]]\n\nEquipe Atacado Exponencial' },
    { id: 'm3', nome: 'Lembrete 1h antes', canal: 'transacional', assunto: 'Começa em 1 hora', previa: 'Às {{hora_reuniao}}, no link de sempre.', editado: '02/10', corpo: 'Oi, {{primeiro_nome}}! Sua reunião começa às **{{hora_reuniao}}**.\n\n[[Entrar na reunião | {{link_reuniao}}]]' },
    { id: 'm4', nome: 'Reunião remarcada', canal: 'transacional', assunto: 'Novo horário: {{data_reuniao}} às {{hora_reuniao}}', previa: 'Sua reunião mudou de horário.', editado: '02/10', corpo: 'Oi, {{primeiro_nome}}!\n\nSua reunião mudou para **{{data_reuniao}} às {{hora_reuniao}}**.\n\n[[Entrar na reunião | {{link_reuniao}}]]' },
    { id: 'm5', nome: 'Reunião cancelada', canal: 'transacional', assunto: 'Sua reunião foi cancelada', previa: 'Quer marcar outro horário?', editado: '02/10', corpo: 'Oi, {{primeiro_nome}}.\n\nSua reunião de {{data_reuniao}} foi cancelada. Se quiser, escolha outro horário:\n\n[[Escolher novo horário | {{link_remarcar}}]]' },
    { id: 'm6', nome: 'Convite workshop gratuito', canal: 'marketing', assunto: '{{primeiro_nome}}, o próximo workshop é dia 22', previa: 'Duas horas sobre como vender mais no atacado. Gratuito.', editado: '30/09', corpo: 'Oi, {{primeiro_nome}}!\n\nNo dia **22/10, às 19h**, tem workshop gratuito ao vivo: como montar uma operação de atacado que vende todo mês.\n\n[[Quero participar | https://atacadoexponencial.com/workshop-gratuito]]\n\nUm abraço,\nFelipe Santos' },
    { id: 'm7', nome: 'Boas-vindas workshop 1', canal: 'marketing', assunto: 'Sua vaga no workshop está garantida', previa: 'Veja o que preparar antes do dia.', editado: '29/09', corpo: 'Oi, {{primeiro_nome}}!\n\nSua vaga está garantida. Antes do workshop, separe 10 minutos para pensar no seu catálogo atual.\n\n[[Entrar no grupo do workshop | https://atacadoexponencial.com/grupo-workshop]]\n\nFelipe' },
    { id: 'm8', nome: 'Boas-vindas workshop 2', canal: 'marketing', assunto: 'O erro que trava 8 em cada 10 atacadistas', previa: 'Antes do workshop, um aquecimento.', editado: '29/09', corpo: 'Oi, {{primeiro_nome}}!\n\nQue bom que você abriu o primeiro e-mail. Hoje, um aquecimento rápido para o workshop.\n\n[[Ler o artigo | https://atacadoexponencial.com/blog]]' },
    { id: 'm9', nome: 'Boas-vindas workshop 1 (outro assunto)', canal: 'marketing', assunto: 'Você ainda não confirmou sua vaga', previa: 'Falta um clique.', editado: '29/09', corpo: 'Oi, {{primeiro_nome}}! Vimos que você ainda não abriu nosso e-mail. Sua vaga no workshop está guardada.\n\n[[Entrar no grupo do workshop | https://atacadoexponencial.com/grupo-workshop]]' },
    { id: 'm10', nome: 'Black do atacado', canal: 'marketing', assunto: 'Black do atacado: só até sexta', previa: 'Condição especial para quem já é da base.', editado: '03/10', corpo: 'Oi, {{nmoe}}!\n\nEsta semana tem condição especial para quem já está na nossa base.\n\n[[Ver a condição | https://atacadoexponencial.com]]' },
    { id: 'm11', nome: 'Convite live semanal', canal: 'marketing', assunto: 'Hoje tem live às 20h', previa: 'Ao vivo no Instagram.', editado: '12/08', arquivado: true, corpo: 'Oi, {{primeiro_nome}}! Hoje tem live às 20h.' },
    { id: 'm12', nome: 'Novidade: plano ao vivo', canal: 'marketing', assunto: 'Abrimos as aplicações do plano ao vivo', previa: 'Vagas limitadas, aplicações até 06/10.', editado: '23/09', corpo: 'Oi, {{primeiro_nome}}!\n\nAbrimos as aplicações para o **plano ao vivo de 07/10**.\n\n[[Quero aplicar | https://atacadoexponencial.com/aplicacao]]' },
  ];

  // Estado mutável do protótipo (vive enquanto a página estiver aberta).
  const D = {
    campanhas: CAMPANHAS_BASE.map((c) => ({ ...c })),
    segmentos: SEGMENTOS_BASE.map((s) => ({ ...s, regras: s.regras.map((r) => ({ ...r })) })),
    modelos: MODELOS_BASE.map((m) => ({ ...m })),
    contatos: gerarContatos(),
    config: {
      transacional: { nome: 'Atacado Exponencial', endereco: 'notify@envio.atacadoexponencial.com', resposta: '' },
      marketing: { nome: 'Felipe Santos | Atacado Exponencial', endereco: 'felipe@news.atacadoexponencial.com', resposta: '' },
      rodape: 'Atacado Exponencial · Seteads Agência Ltda.\nAv. Exemplo, 1000, sala 12, São Paulo, SP, 01000-000',
    },
    usoMes: 7840, limiteMes: 10000,
  };

  function gerarContatos() {
    const r = aleatorio(20260703);
    const lista = [];
    const vistos = new Set();
    for (let i = 0; lista.length < 2400; i++) {
      const n = NOMES[Math.floor(r() * NOMES.length)], s = SOBRENOMES[Math.floor(r() * SOBRENOMES.length)];
      let email = `${semAcento(n)}.${semAcento(s)}${i % 7 ? Math.floor(r() * 90 + 10) : ''}@${['gmail.com', 'hotmail.com', 'outlook.com', 'uol.com.br', 'empresa.com.br'][Math.floor(r() * 5)]}`;
      if (vistos.has(email)) continue;
      const x = r();
      const situacao = x < 0.885 ? 'ativo' : x < 0.94 ? 'descadastrado' : x < 0.965 ? 'voltou' : x < 0.972 ? 'denunciou' : x < 0.99 ? 'invalido' : 'ativo';
      if (situacao === 'invalido') email = email.replace('@', r() < 0.5 ? '@@' : ' @').replace('.com', r() < 0.5 ? '.con' : '.com');
      vistos.add(email);
      const entrada = INICIO + Math.floor(r() * (HOJE - INICIO));
      const fi = r();
      const funil = FUNIS[fi < 0.45 ? 0 : fi < 0.7 ? 1 : fi < 0.8 ? 2 : fi < 0.9 ? 3 : 4][0];
      const e = r();
      const estagio = ESTAGIOS[e < 0.6 ? 0 : e < 0.82 ? 1 : e < 0.92 ? 2 : e < 0.98 ? 3 : 4];
      const abriu = [], clicou = [];
      if (entrada < Date.UTC(2026, 8, 30) && funil === 'workshop-gratuito' && r() < 0.43) { abriu.push('c1'); if (r() < 0.26) clicou.push('c1'); }
      if (r() < 0.2) { abriu.push('c2'); if (r() < 0.2) clicou.push('c2'); }
      lista.push({ id: 'p' + i, nome: `${n} ${s}`, email, origem: ORIGENS[Math.floor(r() ** 1.6 * ORIGENS.length)], funil, entrada, estagio, situacao, abriu, clicou });
    }
    return lista;
  }

  const modelo = (id) => D.modelos.find((m) => m.id === id);
  const segmento = (id) => D.segmentos.find((s) => s.id === id);

  // Regras de segmento (módulo 5): condições combinadas com "e".
  const CAMPOS_REGRA = {
    funil: { rotulo: 'Funil', ops: [['e', 'é'], ['nao', 'não é']], valores: () => FUNIS },
    origem: { rotulo: 'Origem', ops: [['e', 'é'], ['nao', 'não é']], valores: () => ORIGENS.map((o) => [o, o]) },
    entrada: { rotulo: 'Data de entrada', ops: [['ultimos', 'nos últimos'], ['antes', 'há mais de']], valores: () => [['7', '7 dias'], ['15', '15 dias'], ['30', '30 dias'], ['60', '60 dias'], ['90', '90 dias']] },
    estagio: { rotulo: 'Estágio no CRM', ops: [['e', 'é'], ['nao', 'não é']], valores: () => ESTAGIOS.map((e) => [e, e]) },
    abriu: { rotulo: 'Abriu campanha', ops: [['sim', 'abriu'], ['nao', 'não abriu']], valores: () => D.campanhas.filter((c) => c.situacao === 'enviada').map((c) => [c.id, c.nome]) },
    clicou: { rotulo: 'Clicou em campanha', ops: [['sim', 'clicou'], ['nao', 'não clicou']], valores: () => D.campanhas.filter((c) => c.situacao === 'enviada').map((c) => [c.id, c.nome]) },
  };
  function casa(p, r) {
    const v = r.valor;
    switch (r.campo) {
      case 'funil': return (p.funil === v) === (r.op === 'e');
      case 'origem': return (p.origem === v) === (r.op === 'e');
      case 'estagio': return (p.estagio === v) === (r.op === 'e');
      case 'entrada': { const lim = HOJE - Number(v) * 86400000; return r.op === 'ultimos' ? p.entrada >= lim : p.entrada < lim; }
      case 'abriu': return p.abriu.includes(v) === (r.op === 'sim');
      case 'clicou': return p.clicou.includes(v) === (r.op === 'sim');
      default: return true;
    }
  }
  const noSegmento = (regras) => D.contatos.filter((p) => regras.every((r) => casa(p, r)));

  // ---------------------------------------------------------------------------
  // Toast, engrenagem e gaveta (mesmo desenho do agenda.js, CSS ag-*)
  // ---------------------------------------------------------------------------
  let toastTempo = null;
  // `acao` ({ rotulo, fn }) põe um botão no aviso, por exemplo "Desfazer".
  function avisar(texto, tipo = 'ok', acao = null) {
    let t = document.getElementById('em-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'em-toast';
      t.className = 'ag-toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
    }
    const g = document.getElementById('em-gaveta');
    (g && g.open ? g : document.body).appendChild(t);
    t.textContent = texto;
    t.dataset.tipo = tipo;
    if (acao) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ag-toast__acao';
      b.textContent = acao.rotulo;
      b.onclick = () => { t.classList.remove('visivel'); b.remove(); acao.fn(); };
      t.append(' ', b);
    }
    void t.offsetWidth;
    t.classList.add('visivel');
    clearTimeout(toastTempo);
    toastTempo = setTimeout(() => t.classList.remove('visivel'), acao ? 8000 : tipo === 'erro' ? 5200 : 3000);
  }

  function menuHtml(rotulo, itens) {
    return `<div class="ag-menu">
      <button class="ag-engrenagem" type="button" data-menu aria-haspopup="menu" aria-expanded="false" aria-label="Opções de ${esc(rotulo)}">${ICONE.engrenagem}</button>
      <div class="ag-menu__lista" role="menu" hidden>
        ${itens.filter(Boolean).map((i) => `<button type="button" role="menuitem"${i.perigo ? ' class="perigo"' : ''} data-acao="${i.acao}" data-id="${esc(i.id)}">${esc(i.rotulo)}</button>`).join('')}
      </div></div>`;
  }
  function fecharMenus() {
    document.querySelectorAll('.ag-menu__lista').forEach((m) => { m.hidden = true; });
    document.querySelectorAll('[data-menu]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }
  function alternarMenu(botao) {
    const lista = botao.nextElementSibling;
    const abrir = lista.hidden;
    fecharMenus();
    if (!abrir) return;
    lista.hidden = false;
    botao.setAttribute('aria-expanded', 'true');
    const r = botao.getBoundingClientRect();
    const acima = window.innerHeight - r.bottom < lista.offsetHeight + 16;
    lista.style.top = (acima ? r.top - lista.offsetHeight - 4 : r.bottom + 4) + 'px';
    lista.style.left = Math.max(8, r.right - lista.offsetWidth) + 'px';
    lista.querySelector('button').focus();
  }
  document.addEventListener('click', (ev) => { if (!ev.target.closest('.ag-menu')) fecharMenus(); });

  /** Cliques de um contêiner: engrenagem abre o menu; [data-acao] chama acoes[acao](id, botão). */
  function ligarAcoes(container, acoes) {
    container.addEventListener('click', (ev) => {
      const b = ev.target.closest('button, a[data-acao]');
      if (!b || !container.contains(b)) return;
      if (b.hasAttribute('data-menu')) return alternarMenu(b);
      const acao = b.dataset.acao;
      if (!acao || !acoes[acao]) return;
      ev.preventDefault();
      if (!b.classList.contains('perigo') || !b.closest('.ag-menu__lista')) fecharMenus();
      acoes[acao](b.dataset.id, b);
    });
  }

  function abrirGaveta(largura) {
    let g = document.getElementById('em-gaveta');
    if (!g) {
      g = document.createElement('dialog');
      g.id = 'em-gaveta';
      g.className = 'ag-gaveta em-gaveta';
      g.addEventListener('click', (ev) => { if (ev.target === g) g.close(); });
      document.body.appendChild(g);
    }
    g.classList.toggle('em-gaveta--larga', largura === 'larga');
    if (!g.open) g.showModal();
    return g;
  }
  function gaveta({ titulo, sub = '', corpo, rodape = '', largura }) {
    const g = abrirGaveta(largura);
    g.innerHTML = `<div class="ag-gaveta__form ag-gaveta__form--simples">
      <header class="ag-gaveta__topo">
        <div><h2>${titulo}</h2>${sub ? `<p class="mini">${sub}</p>` : ''}</div>
        <button class="ag-gaveta__fechar" type="button" data-fechar aria-label="Fechar">${ICONE.fechar}</button>
      </header>
      <div class="ag-gaveta__corpo">${corpo}</div>
      ${rodape ? `<footer class="ag-gaveta__rodape">${rodape}</footer>` : ''}
    </div>`;
    g.querySelector('[data-fechar]').onclick = () => g.close();
    return g;
  }
  const fecharGaveta = () => { const g = document.getElementById('em-gaveta'); if (g && g.open) g.close(); };

  const carimbo = (mapa, k) => { const [r, c] = mapa[k] || [k, 'neutro']; return `<span class="carimbo ${c}">${esc(r)}</span>`; };
  // Carregando: o esqueleto do dash (fios piscando), com o texto para leitor de tela.
  const carregando = (texto) => `<div class="esq-tabela" role="status" aria-label="${texto}…">${'<span class="esq esq-linha"></span>'.repeat(5)}</div>`;
  const chave = (ligado, attrs, rotulo) => `<label class="em-chave"><input type="checkbox" ${attrs}${ligado ? ' checked' : ''}><span class="em-chave__trilho" aria-hidden="true"></span><span class="em-chave__rot">${rotulo || (ligado ? 'Ligado' : 'Desligado')}</span></label>`;

  // ---------------------------------------------------------------------------
  // Render e navegação
  // ---------------------------------------------------------------------------
  const api = {
    vista: 'campanhas',
    lerVista(v) { api.vista = VISTAS.includes(v) ? v : 'campanhas'; },
    render,
    renderAgenda,
    // Para o quadro dos fluxos (email-fluxos.js).
    util: {
      esc, int, pct, avisar, gaveta, fecharGaveta, menuHtml, ligarAcoes, carimbo, chave, seloProto, ICONE, fecharMenus,
      abrirContato: (id) => detalheContatoReal(id),
      nomeFunil: (f) => nomeFunil(f),
      // Fluxos (385): mesma trava de duplo clique e mesma mensagem de erro das outras vistas.
      ocupado: (b, fn) => ocupado(b, fn), msgErro: (e) => msgErro(e),
    },
    dados: D,
    nomeFunil, FUNIS, ORIGENS, ESTAGIOS,
  };
  window.EmailMkt = api;

  function irPara(v) { api.vista = v; ctx.escreverUrl(); ctx.rerender(); }
  const raiz = () => ctx.$('#mkt-email-conteudo');

  function render(c) {
    ctx = c;
    fecharGaveta();
    ctx.$('#titulo').textContent = TITULO_VISTA[api.vista];
    ctx.$('#subtitulo').textContent = NOTA_VISTA[api.vista] + (VISTAS_REAIS.includes(api.vista) ? '' : ' · protótipo');
    const el = raiz();
    el.className = 'em em--' + api.vista;
    let sub = document.getElementById('em-subnav');
    if (!sub) {
      sub = document.createElement('label');
      sub.id = 'em-subnav';
      sub.className = 'em-subnav';
      el.parentNode.insertBefore(sub, el);
    }
    sub.innerHTML = `<select aria-label="Parte do e-mail">${VISTAS.map((v) => `<option value="${v}"${v === api.vista ? ' selected' : ''}>${esc(ROTULO_SUBNAV[v])}</option>`).join('')}</select>`;
    sub.querySelector('select').onchange = (ev) => irPara(ev.target.value);
    let tit = document.getElementById('em-titulo-vista');
    if (!tit) { tit = document.createElement('h2'); tit.id = 'em-titulo-vista'; tit.className = 'so-leitor'; el.parentNode.insertBefore(tit, el); }
    tit.textContent = TITULO_VISTA[api.vista] || '';
    ({ campanhas, relatorio, fluxos, contatos, segmentos, modelos, configuracao })[api.vista](el);
  }

  // ===========================================================================
  // 382 · Campanhas (ligada ao backend: GET/POST /api/email/campanhas)
  // ===========================================================================
  // Público, resumo, limite do mês, bloqueios, disparo único, envio em lotes e
  // agendamento (383) ficam no servidor; aqui só a tela. O relatório é a 384.
  let filtroCamp = '';
  let campEstado = null;
  let campTimer = null;
  const MES = (t) => new Date(t * 1000).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', month: 'long' });

  function avisoLimite(u) {
    const p = u.limite ? (u.usados / u.limite) * 100 : 0;
    return `<div class="em-limite">
      <div class="em-limite__txt"><b>${int(u.usados)}</b> de ${int(u.limite)} e-mails usados em ${esc(MES(Date.now() / 1000))} <span class="mini">· restam ${int(u.restam)} · renova no dia 1º</span></div>
      <div class="regua" aria-hidden="true"><i style="width:${Math.min(100, p)}%"></i></div>
    </div>`;
  }
  const diaBrt = (t) => new Date(t * 1000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const horaBrt = (t) => new Date(t * 1000).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  const envioTxt = (c) => (c.situacao === 'agendada' && c.agendada_para ? `agendada para ${quando(c.agendada_para)}`
    : c.disparada_em ? quando(c.disparada_em) : c.situacao === 'cancelada' ? 'cancelada' : 'sem data');
  const progresso = (c) => `<span data-prog="${c.id}"><span class="em-progresso" title="${c.percentual}% enviado"><span style="width:${c.percentual}%"></span></span> <b>${c.percentual}%</b></span>`;

  async function campanhas(el) {
    clearTimeout(campTimer);
    if (!campEstado) el.innerHTML = carregando('Carregando as campanhas');
    try {
      campEstado = await ctx.fetchJson(`/api/email/campanhas?${filtroCamp ? `situacao=${filtroCamp}&` : ''}_=${Date.now()}`);
    } catch (e) {
      el.innerHTML = `<div class="aviso falha">Não foi possível carregar as campanhas (${esc(e.message)}). Tente de novo em instantes.</div>`;
      return;
    }
    // Se o usuário saiu da vista enquanto carregava, não desenha por cima.
    if (api.vista !== 'campanhas' || !document.body.contains(el)) return;
    const S = campEstado;
    const total = Object.values(S.por_situacao).reduce((a, b) => a + b, 0);
    el.innerHTML = `<div class="em-barra"><p class="mini">Os números do canal ficam em <a href="#mkt-email?v=relatorio">Resultados</a>.</p>
        <button class="btn" type="button" data-nova>Nova campanha</button>
      </div>
      ${S.marketing_liberado ? '' : '<div class="aviso alerta"><b>Disparos de marketing bloqueados.</b> O marketing está marcado como não liberado. Dá para montar a campanha, mas o disparo só funciona depois de ligar a opção. <a href="#mkt-email?v=configuracao">Ver configuração</a></div>'}
      ${avisoLimite(S.uso)}
      ${total ? `<div class="ag-subvistas" role="group" aria-label="Filtrar por situação">
        <button type="button" class="ag-subvista" data-filtro="" aria-pressed="${!filtroCamp}">Todas <span class="ag-cont">${total}</span></button>
        ${['rascunho', 'agendada', 'enviando', 'enviada', 'cancelada', 'falhou'].filter((k) => S.por_situacao[k] || filtroCamp === k).map((k) => `<button type="button" class="ag-subvista" data-filtro="${k}" aria-pressed="${filtroCamp === k}">${SITUACAO_CAMP[k][0]} <span class="ag-cont${k === 'falhou' && S.por_situacao[k] ? ' alerta' : ''}">${S.por_situacao[k] || 0}</span></button>`).join('')}
      </div>` : ''}
      <div class="tabela-wrap" id="em-camp-lista"></div>`;
    el.querySelector('[data-nova]').onclick = () => formCampanha(null, el);
    el.querySelectorAll('[data-filtro]').forEach((b) => { b.onclick = () => { filtroCamp = b.dataset.filtro; campanhas(el); }; });
    const segNome = (id) => (S.opcoes.segmentos.find((s) => s.id === id) || { nome: 'segmento excluído' }).nome;
    const alvo = el.querySelector('#em-camp-lista');
    ctx.tabela(alvo, [
      { titulo: 'Campanha', campo: 'nome', render: (c) => `<button type="button" class="ag-link-linha" data-acao="abrir" data-id="${c.id}">${esc(c.nome)}</button>` },
      { titulo: 'Situação', campo: 'situacao', render: (c) => (c.situacao === 'enviando' ? progresso(c) : carimbo(SITUACAO_CAMP, c.situacao)) },
      { titulo: 'Segmentos', render: (c) => `<span class="mini">${c.segmentos.map((s) => esc(segNome(s))).join(' + ')}</span>` },
      { titulo: 'Envio', render: (c) => esc(envioTxt(c)) },
      { titulo: 'Destinatários', num: true, render: (c) => (c.total ? int(c.total) : '') },
      { titulo: 'Enviados', num: true, render: (c) => (c.disparada_em ? int(c.enviados) : '') },
      { titulo: 'Falhas', num: true, render: (c) => (c.falhas ? `<span class="carimbo queda">${int(c.falhas)}</span>` : '') },
      { titulo: '', render: (c) => `<div class="ag-acoes ag-acoes--linha">${menuHtml(c.nome, [
        { acao: 'abrir', id: c.id, rotulo: ['rascunho', 'agendada'].includes(c.situacao) ? 'Editar' : 'Abrir' },
        c.disparada_em && { acao: 'relatorio', id: c.id, rotulo: 'Ver relatório' },
        c.modelo_id && { acao: 'teste', id: c.id, rotulo: 'Mandar teste' },
        { acao: 'duplicar', id: c.id, rotulo: 'Duplicar' },
        c.situacao === 'agendada' && { acao: 'cancelar', id: c.id, rotulo: 'Cancelar envio', perigo: true },
        c.situacao === 'rascunho' && { acao: 'excluir', id: c.id, rotulo: 'Excluir rascunho', perigo: true },
      ])}</div>` },
    ], S.campanhas, undefined, total ? 'Nenhuma campanha nesta situação.' : 'Nenhuma campanha ainda. Comece por "Nova campanha": escolha um modelo, um ou mais segmentos e mande um teste antes de disparar.');
    const campanhaReal = (id) => S.campanhas.find((c) => String(c.id) === String(id));
    ligarAcoes(alvo, {
      abrir: (id) => abrirCampanha(campanhaReal(id), el),
      relatorio: (id) => { campanhaRelatorio = Number(id); irPara('relatorio'); },
      teste: (id) => { const c = campanhaReal(id); const m = S.opcoes.modelos.find((x) => x.id === c.modelo_id); pedirTeste({ id: c.modelo_id, nome: m ? m.nome : c.nome, canal: 'marketing' }); },
      duplicar: async (id) => {
        try { const r = await ctx.postJson('/api/email/campanhas', { acao: 'duplicar', id: Number(id) }); filtroCamp = ''; avisar(`Campanha duplicada como rascunho: "${r.campanha.nome}".`); campanhas(el); }
        catch (e) { avisar(msgErro(e), 'erro'); }
      },
      cancelar: (id, b) => ctx.pedirConfirmacao(b, 'Cancelar o envio agendado?', async () => {
        fecharMenus();
        try { await ctx.postJson('/api/email/campanhas', { acao: 'cancelar', id: Number(id) }); avisar('Envio cancelado. Ninguém recebeu.'); campanhas(el); }
        catch (e) { avisar(msgErro(e), 'erro'); }
      }),
      excluir: (id, b) => ctx.pedirConfirmacao(b, 'Excluir este rascunho?', async () => {
        fecharMenus();
        try { await ctx.postJson('/api/email/campanhas', { acao: 'excluir', id: Number(id) }); avisar('Rascunho excluído.'); campanhas(el); }
        catch (e) { avisar(msgErro(e), 'erro'); }
      }),
    });
    // Andamento: enquanto houver campanha enviando, atualiza a cada 3 s, sem
    // redesenhar por cima de menu, gaveta ou confirmação abertos.
    if (S.campanhas.some((c) => c.situacao === 'enviando')) {
      campTimer = setTimeout(() => {
        const ocupado2 = document.querySelector('.ag-menu__lista:not([hidden]), dialog[open], .confirma');
        if (api.vista === 'campanhas' && !ocupado2) campanhas(el);
        else if (api.vista === 'campanhas') campTimer = setTimeout(() => campanhas(el), 3000);
      }, 3000);
    }
  }

  function abrirCampanha(c, el) {
    if (c.situacao === 'rascunho' || c.situacao === 'agendada') return formCampanha(c, el);
    const S = campEstado;
    const m = S.opcoes.modelos.find((x) => x.id === c.modelo_id);
    const segs = c.segmentos.map((id) => (S.opcoes.segmentos.find((s) => s.id === id) || { nome: 'segmento excluído' }).nome);
    let extra = '';
    if (c.situacao === 'enviando') {
      extra = `<div class="em-andamento"><div class="em-andamento__num"><b>${c.percentual}%</b> enviado</div>
        <span class="em-progresso em-progresso--grande"><span style="width:${c.percentual}%"></span></span>
        <p class="mini">${int(c.enviados)} de ${int(c.total)} já saíram · ${int(c.falhas)} falhas até agora. Feche e acompanhe na lista: o número sobe sozinho.</p></div>`;
    } else if (c.situacao === 'falhou') {
      extra = `<div class="aviso falha"><b>Motivo:</b> ${esc(c.motivo || 'sem motivo registrado')}</div><p class="mini">Uma campanha que falha nunca sai pela metade sem aviso: o que não saiu fica marcado, e nada é reenviado sozinho.</p>`;
    } else if (c.situacao === 'cancelada') {
      extra = '<p class="mini">Cancelada antes do horário. Ninguém recebeu.</p>';
    } else if (c.situacao === 'enviada') {
      extra = '<p class="mini">Entregas, aberturas e cliques chegam do serviço de envio conforme acontecem. O relatório mostra tudo, pessoa por pessoa.</p>';
    }
    const g = gaveta({
      titulo: esc(c.nome), sub: 'campanha de marketing',
      corpo: `<dl class="ag-dl">
          <dt>Situação</dt><dd>${carimbo(SITUACAO_CAMP, c.situacao)}</dd>
          <dt>Modelo</dt><dd>${esc(m ? m.nome : 'modelo arquivado')}<br><span class="mini">${esc(c.assunto || (m ? m.assunto : ''))}</span></dd>
          <dt>Segmentos</dt><dd>${segs.map(esc).join('<br>')}</dd>
          <dt>Envio</dt><dd>${esc(envioTxt(c))}</dd>
          <dt>Destinatários</dt><dd>${int(c.total)} · ${int(c.enviados)} enviados · ${int(c.falhas)} falhas</dd>
        </dl>${extra}`,
      rodape: `<div class="ag-acoes">${c.disparada_em ? '<button class="btn" type="button" data-rel>Ver relatório</button>' : ''}<button class="btn sec" type="button" data-dup>Duplicar</button></div>`,
    });
    const vr = g.querySelector('[data-rel]');
    if (vr) vr.onclick = () => { g.close(); campanhaRelatorio = c.id; irPara('relatorio'); };
    g.querySelector('[data-dup]').onclick = async () => {
      try { await ctx.postJson('/api/email/campanhas', { acao: 'duplicar', id: c.id }); g.close(); filtroCamp = ''; avisar('Campanha duplicada como rascunho.'); campanhas(el); }
      catch (e) { avisar(msgErro(e), 'erro'); }
    };
  }

  function formCampanha(c, el) {
    const S = campEstado;
    const agendada = !!(c && c.situacao === 'agendada');
    const corpo = `<form class="ag-form em-form" id="em-camp-form" novalidate>
        <label>Nome interno<input type="text" name="nome" maxlength="100" value="${esc(c ? c.nome : '')}" placeholder="Ex.: Convite workshop 05/11" required></label>
        ${S.opcoes.modelos.length
          ? `<label>Modelo<select name="modelo"><option value="">Escolha um modelo</option>${S.opcoes.modelos.map((m) => `<option value="${m.id}"${c && m.id === c.modelo_id ? ' selected' : ''}>${esc(m.nome)}</option>`).join('')}</select></label>`
          : '<div class="aviso alerta">Ainda não há modelo de marketing (os modelos que existem são da agenda). <a href="#mkt-email?v=modelos">Criar modelo de marketing</a><select name="modelo" hidden><option value=""></option></select></div>'}
        <div class="em-previa-assunto" id="em-camp-assunto"></div>
        <fieldset><legend>Segmentos (um ou mais)</legend>
          ${S.opcoes.segmentos.length ? S.opcoes.segmentos.map((s) => `<label class="marca"><input type="checkbox" name="seg" value="${s.id}"${c && c.segmentos.includes(s.id) ? ' checked' : ''}> ${esc(s.nome)} <span class="mini">${int(s.ativos)} ativos</span></label>`).join('') : '<p class="mini">Nenhum segmento ainda. Crie um em Segmentos.</p>'}
        </fieldset>
        <div class="ag-campo"><span class="ag-campo__rotulo">Remetente</span>${(() => { const m = /^"?(.*?)"?\s*<(.+)>$/.exec(S.remetente) || [null, S.remetente, '']; return `<p class="em-remetente"><b>${esc(m[1])}</b><br><span class="mini">${esc(m[2])} · vem da <a href="#mkt-email?v=configuracao">configuração de e-mail</a></span></p>`; })()}</div>
        <fieldset><legend>Quando enviar</legend>
          <label class="marca"><input type="radio" name="quando" value="agora"${agendada ? '' : ' checked'}${agendada ? ' disabled' : ''}> Agora, depois do resumo</label>
          <label class="marca"><input type="radio" name="quando" value="agendar"${agendada ? ' checked' : ''}> Agendar para data e hora (Brasília)</label>
          <div class="linha" data-quando-campos${agendada ? '' : ' hidden'}>
            <label>Dia<input type="date" name="dia" value="${agendada ? diaBrt(c.agendada_para) : ''}"></label>
            <label>Hora<input type="time" name="hora" value="${agendada ? horaBrt(c.agendada_para) : '09:00'}"></label>
          </div>
          <span class="mini">A lista é recalculada na hora do envio: quem entrar até lá também recebe, e quem se descadastrar não recebe.</span>
        </fieldset>
      </form>
      <div class="em-erro" aria-live="polite"></div>
      <div id="em-camp-resumo"></div>`;
    const g = gaveta({
      titulo: c ? esc(c.nome) : 'Nova campanha',
      sub: agendada ? `agendada para ${esc(quando(c.agendada_para))}: dá para editar até o horário` : 'rascunho: só sai quando você disparar ou agendar',
      corpo,
      rodape: agendada
        ? '<div class="ag-acoes"><button class="btn" type="button" data-salvar>Salvar alterações</button><button class="btn sec" type="button" data-teste>Mandar teste</button><button class="btn perigo" type="button" data-cancelar>Cancelar envio</button></div>'
        : '<div class="ag-acoes"><button class="btn" type="button" data-revisar>Revisar e disparar</button><button class="btn sec" type="button" data-teste>Mandar teste</button><button class="btn sec" type="button" data-salvar>Salvar rascunho</button></div>',
    });
    const f = g.querySelector('#em-camp-form');
    const erro = g.querySelector('.em-erro');
    let atual = c;
    const dados = () => ({ nome: f.nome.value, modelo_id: f.modelo.value ? Number(f.modelo.value) : null, segmentos: [...f.querySelectorAll('[name="seg"]:checked')].map((i) => Number(i.value)) });
    const agendar = () => f.quando.value === 'agendar';
    const quandoTxt = () => `${f.dia.value.split('-').reverse().slice(0, 2).join('/')} às ${f.hora.value}`;
    const mostrarAssunto = () => {
      const m = S.opcoes.modelos.find((x) => String(x.id) === f.modelo.value);
      g.querySelector('#em-camp-assunto').innerHTML = m ? `<span class="mini">Assunto</span> <b>${esc(m.assunto || '(sem assunto)')}</b><br><span class="mini">${esc(m.previa || '')}</span>` : '';
      g.querySelector('#em-camp-resumo').innerHTML = '';
      erro.textContent = '';
      g.querySelector('[data-quando-campos]').hidden = !agendar();
      const br2 = g.querySelector('[data-revisar]');
      if (br2) br2.textContent = agendar() ? 'Revisar e agendar' : 'Revisar e disparar';
    };
    f.addEventListener('change', mostrarAssunto);
    mostrarAssunto();
    const salvarRascunho = async () => {
      const extra = agendada ? { dia: f.dia.value, hora: f.hora.value } : {};
      const r = await ctx.postJson('/api/email/campanhas', { acao: 'salvar', id: atual ? atual.id : undefined, ...dados(), ...extra });
      atual = r.campanha;
      return atual;
    };
    const bs = g.querySelector('[data-salvar]');
    bs.onclick = () => ocupado(bs, async () => {
      try { await salvarRascunho(); g.close(); avisar(agendada ? 'Campanha agendada atualizada.' : 'Rascunho salvo.'); campanhas(el); }
      catch (e) { erro.textContent = msgErro(e); }
    });
    const bc = g.querySelector('[data-cancelar]');
    if (bc) bc.onclick = () => ctx.pedirConfirmacao(bc, 'Cancelar o envio agendado?', async () => {
      try { await ctx.postJson('/api/email/campanhas', { acao: 'cancelar', id: c.id }); g.close(); avisar('Envio cancelado. Ninguém recebeu.'); campanhas(el); }
      catch (e) { erro.textContent = msgErro(e); return false; }
    });
    g.querySelector('[data-teste]').onclick = () => {
      const m = S.opcoes.modelos.find((x) => String(x.id) === f.modelo.value);
      if (!m) return avisar('Escolha o modelo antes de mandar o teste.', 'erro');
      pedirTeste({ id: m.id, nome: m.nome, canal: 'marketing' });
    };
    const br = g.querySelector('[data-revisar]');
    if (br) br.onclick = () => ocupado(br, async () => {
      if (agendar() && (!f.dia.value || !f.hora.value)) { erro.textContent = 'Escolha o dia e a hora do envio.'; return; }
      let r;
      try {
        await salvarRascunho();
        r = await ctx.postJson('/api/email/campanhas', { acao: 'resumo', modelo_id: atual.modelo_id, segmentos: atual.segmentos });
      } catch (e) { erro.textContent = msgErro(e); return; }
      erro.textContent = '';
      const totFora = Object.values(r.fora).reduce((a, b) => a + b, 0);
      g.querySelector('#em-camp-resumo').innerHTML = `<div class="em-resumo">
        <h3 class="ag-h3">Resumo antes de ${agendar() ? 'agendar' : 'disparar'}</h3>
        <div class="em-resumo__grande"><b>${int(r.recebem)}</b> pessoas ${agendar() ? 'receberiam agora' : 'vão receber'}</div>
        ${agendar() ? '<p class="mini">Na hora do envio a lista é recalculada, e o envio é conferido de novo (marketing liberado, limite do mês).</p>' : ''}
        ${r.em_dois ? `<p class="mini">${int(r.em_dois)} estão em mais de um segmento escolhido e recebem uma vez só.</p>` : ''}
        <p><b>${int(totFora)}</b> ficam de fora:</p>
        <ul class="em-fora">
          <li><span>Descadastrados</span><b>${int(r.fora.descadastrado)}</b></li>
          <li><span>Voltaram (endereço não existe)</span><b>${int(r.fora.voltou)}</b></li>
          <li><span>Denunciaram spam</span><b>${int(r.fora.denunciou)}</b></li>
          <li><span>Endereço inválido</span><b>${int(r.fora.invalido)}</b></li>
        </ul>
        ${r.sem_nome ? `<div class="aviso alerta">${int(r.sem_nome)} ${r.sem_nome === 1 ? 'pessoa está' : 'pessoas estão'} sem nome no cadastro: para elas, o nome do e-mail sai em branco.</div>` : ''}
        <p class="mini">Assunto: <b>${esc(r.assunto)}</b> · remetente ${esc(r.remetente)}. Limite do mês: ${int(r.uso.usados)} usados, restam ${int(r.uso.restam)}.</p>
        ${r.bloqueio ? `<div class="aviso alerta">${esc(r.bloqueio)}</div>` : ''}
        <div class="ag-acoes">${agendar()
          ? `<button class="btn" type="button" data-agendar>Agendar para ${esc(quandoTxt())}</button>`
          : `<button class="btn" type="button" data-disparar${r.bloqueio ? ' disabled' : ''}>Disparar para ${int(r.recebem)} pessoas</button>`}</div>
      </div>`;
      const corpoG = g.querySelector('.ag-gaveta__corpo');
      corpoG.scrollTop = corpoG.scrollHeight;
      const ba = g.querySelector('[data-agendar]');
      if (ba) ba.onclick = () => ctx.pedirConfirmacao(ba, `Agendar para ${quandoTxt()}?`, async () => {
        try {
          await ctx.postJson('/api/email/campanhas', { acao: 'agendar', id: atual.id, dia: f.dia.value, hora: f.hora.value });
          g.close();
          filtroCamp = '';
          avisar(`Agendada para ${quandoTxt()}.`);
          campanhas(el);
        } catch (e) { erro.textContent = msgErro(e); avisar(msgErro(e), 'erro'); return false; }
      }, [{ valor: true, rotulo: 'Agendar' }]);
      const b = g.querySelector('[data-disparar]');
      if (b) b.onclick = () => ctx.pedirConfirmacao(b, `Disparar agora para ${int(r.recebem)} pessoas? Não dá para desfazer.`, async () => {
        try {
          await ctx.postJson('/api/email/campanhas', { acao: 'disparar', id: atual.id });
          g.close();
          filtroCamp = '';
          avisar(`Disparo iniciado para ${int(r.recebem)} pessoas.`);
          campanhas(el);
        } catch (e) { erro.textContent = msgErro(e); avisar(msgErro(e), 'erro'); return false; }
      }, [{ valor: true, rotulo: 'Disparar' }]);
    });
  }

  // ===========================================================================
  // 384 · Relatório da campanha e visão geral do canal (GET /api/email/relatorios)
  // ===========================================================================
  // Números, taxas, listas, uso do mês e reputação vêm do servidor; aqui só a
  // tela. Com o relatório aberto, os números são pedidos de novo a cada 30 s.
  let campanhaRelatorio = null;
  let filtroRel = 'abriram';
  let periodoCanal = 'mes';
  let relTimer = null;
  const PERIODOS = [['mes', 'Este mês'], ['mes-passado', 'Mês passado'], ['90', 'Últimos 90 dias']];
  const tx = (v, c = 1) => (v == null ? '–' : pct(v * 100, c));

  async function relatorio(el) {
    clearTimeout(relTimer);
    if (campanhaRelatorio) return relatorioCampanha(el, campanhaRelatorio);
    el.innerHTML = carregando('Carregando a visão geral');
    let v;
    try { v = await ctx.fetchJson(`/api/email/relatorios?periodo=${periodoCanal}&_=${Date.now()}`); }
    catch (e) { el.innerHTML = `<div class="aviso falha">Não foi possível carregar o relatório (${esc(e.message)}). Tente de novo em instantes.</div>`; return; }
    if (api.vista !== 'relatorio' || campanhaRelatorio) return;
    const u = v.uso;
    const perRot = (PERIODOS.find((p) => p[0] === v.periodo) || PERIODOS[0])[1];
    const usoP = u.limite ? (u.usados / u.limite) * 100 : 0;
    const projP = u.limite ? Math.min(100, (u.projecao / u.limite) * 100) : 0;
    const semEnvio = !v.enviados;
    el.innerHTML = `<div class="em-barra"><p class="mini">Uso do limite, entrega e reputação do canal, e o resultado de cada campanha.</p>
        <select data-periodo aria-label="Período">${PERIODOS.map(([k, r]) => `<option value="${k}"${k === periodoCanal ? ' selected' : ''}>${r}</option>`).join('')}</select>
      </div>
      ${v.reputacao.itens.length ? `<div class="aviso alerta"><b>Alerta de reputação.</b> ${v.reputacao.itens.map(esc).join(' · ')}. Revise os segmentos antes do próximo disparo. Este alerta também vai para o aviso de integrações.</div>` : ''}
      <div class="metas em-metas">
        <div class="metas-cabeca"><h2>Limite do plano</h2><span class="mini">${int(u.usados)} de ${int(u.limite)} e-mails neste mês · restam ${int(u.restam)} · renova em ${esc(u.renova)}</span></div>
        <div class="meta"><h3>E-mails enviados no mês <span>${pct(usoP, 0)}</span></h3>
          <div class="regua"><i style="width:${Math.min(100, usoP)}%"></i><b style="left:${projP}%" title="projeção para o fim do mês"></b></div>
          <div class="mini"><span>marketing ${int(u.por_canal.marketing || 0)} · agenda e transacional ${int(u.por_canal.transacional || 0)}</span><span>projeção para o fim do mês: ${int(u.projecao)}</span></div></div>
      </div>
      <div class="grid-etiquetas">
        ${[
          { rotulo: 'E-mails enviados', valor: int(v.enviados), nota: perRot.toLowerCase() + ' · agenda, campanhas e fluxos, sem os testes (a régua do limite conta os testes)' },
          { rotulo: 'Taxa de entrega', valor: semEnvio ? null : tx(v.taxas.entrega), nota: semEnvio ? 'nenhum envio no período' : `${int(v.entregues)} entregues` },
          { rotulo: 'Taxa de spam', valor: semEnvio ? null : tx(v.taxas.spam, 2), nota: 'limite do serviço: 0,10%' },
          { rotulo: 'Devolução', valor: semEnvio ? null : tx(v.taxas.devolucao), nota: 'endereço que não existe · alerta em 5%' },
          { rotulo: 'Descadastro', valor: v.taxas.descadastro == null ? null : tx(v.taxas.descadastro, 2), nota: 'marketing, por e-mail entregue' },
        ].map((k) => ctx.tile(k)).join('')}
      </div>
      <div class="bloco"><h2>Campanhas enviadas <small>clique para abrir o relatório</small></h2><div class="tabela-wrap" id="em-rel-lista"></div></div>`;
    el.querySelector('[data-periodo]').onchange = (e) => { periodoCanal = e.target.value; relatorio(el); };
    ctx.tabela(el.querySelector('#em-rel-lista'), [
      { titulo: 'Campanha', campo: 'nome', render: (c) => `<b>${esc(c.nome)}</b>${c.situacao === 'falhou' ? ' <span class="carimbo queda">falhou</span>' : ''}` },
      { titulo: 'Envio', render: (c) => esc(quando(c.disparada_em)) },
      { titulo: 'Entregues', num: true, campo: 'entregues', render: (c) => int(c.entregues) },
      { titulo: 'Abertura', num: true, render: (c) => tx(c.taxas.abertura) },
      { titulo: 'Clique', num: true, render: (c) => tx(c.taxas.clique) },
      { titulo: 'Descadastro', num: true, render: (c) => tx(c.taxas.descadastro, 2) },
    ], v.campanhas, (c) => { campanhaRelatorio = c.id; relatorio(el); window.scrollTo(0, 0); }, 'Nenhuma campanha enviada no período. Os resultados aparecem aqui conforme o serviço de envio avisa.');
  }

  async function relatorioCampanha(el, id) {
    clearTimeout(relTimer);
    let r;
    try { r = await ctx.fetchJson(`/api/email/relatorios?campanha=${encodeURIComponent(id)}&_=${Date.now()}`); }
    catch (e) {
      // Na atualização automática, mantém o que já está na tela e tenta de novo.
      if (el.querySelector('[data-rel-campanha]')) { relTimer = setTimeout(() => relatorioCampanha(el, id), 30000); return; }
      el.innerHTML = `<div class="aviso falha">Não foi possível carregar o relatório (${esc(e.message)}).</div><button class="btn sec" type="button" data-voltar>Voltar</button>`;
      el.querySelector('[data-voltar]').onclick = () => { campanhaRelatorio = null; relatorio(el); };
      return;
    }
    if (api.vista !== 'relatorio' || String(campanhaRelatorio) !== String(id)) return;
    const c = r.campanha;
    const maior = Math.max(1, ...r.links.map((l) => l.pessoas));
    const ROT = { abriram: ['Abriram', r.abertos], clicaram: ['Clicaram', r.clicados], voltaram: ['Voltaram', r.voltaram], descadastraram: ['Descadastraram', r.descadastros] };
    const atualizado = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    el.innerHTML = `<div class="em-barra" data-rel-campanha><button class="btn sec em-voltar" type="button" data-voltar>${ICONE.voltar} Visão geral</button>
        <span class="mini">atualiza sozinho a cada 30 segundos · última às ${esc(atualizado)}</span></div>
      <div class="em-rel-cabeca"><h2>${esc(c.nome)}</h2><p class="mini">${c.situacao === 'enviando' ? `Enviando: ${c.percentual}% · ` : ''}Enviada em ${esc(quando(c.disparada_em))} · assunto "${esc(c.assunto || '')}"</p></div>
      ${c.situacao === 'falhou' && c.motivo ? `<div class="aviso falha"><b>Falhou:</b> ${esc(c.motivo)}</div>` : ''}
      <div class="grid-etiquetas">${[
        { rotulo: 'Destinatários', valor: int(r.destinatarios) },
        { rotulo: 'Entregues', valor: int(r.entregues), nota: `entrega ${tx(r.taxas.entrega)}` },
        { rotulo: 'Aberturas', valor: int(r.abertos), nota: `${tx(r.taxas.abertura)} · pessoas únicas` },
        { rotulo: 'Cliques', valor: int(r.clicados), nota: `${tx(r.taxas.clique)} · pessoas únicas` },
      ].map((k) => ctx.tile(k, true)).join('')}</div>
      <div class="em-numeros">
        <div><span>Voltaram</span><b>${int(r.voltaram)}</b><small>${tx(r.taxas.devolucao)}</small></div>
        <div><span>Spam</span><b>${int(r.spam)}</b><small>${tx(r.taxas.spam, 2)}</small></div>
        <div><span>Descadastros</span><b>${int(r.descadastros)}</b><small>${tx(r.taxas.descadastro, 2)}</small></div>
        <div><span>Clique sobre abertura</span><b>${tx(r.taxas.clique_sobre_abertura)}</b><small>de quem abriu</small></div>
      </div>
      <div class="duas">
        <div class="bloco"><h2>Quem fez o quê <small>clique no nome para abrir o contato</small></h2>
          <div class="ag-subvistas" role="group" aria-label="Filtrar pessoas">
            ${Object.entries(ROT).map(([k, [rot, n]]) => `<button type="button" class="ag-subvista" data-rel="${k}" aria-pressed="${k === filtroRel}">${rot} <span class="ag-cont">${int(n)}</span></button>`).join('')}
          </div>
          <div class="tabela-wrap" id="em-rel-pessoas"></div>
          <div class="paginacao" id="em-rel-mais"></div>
        </div>
        <div class="bloco"><h2>Links clicados <small>pessoas únicas</small></h2>
          ${r.links.length ? `<table><tbody>${r.links.map((l) => `<tr><td class="em-link-url">${esc(l.link.replace(/^https?:\/\//, ''))}</td><td class="num"><span class="proporcao" style="width:${Math.round((l.pessoas / maior) * 80)}px"></span>${int(l.pessoas)}</td></tr>`).join('')}</tbody></table>` : '<p class="mini">Nenhum clique ainda.</p>'}
        </div>
      </div>`;
    el.querySelector('[data-voltar]').onclick = () => { clearTimeout(relTimer); campanhaRelatorio = null; relatorio(el); };
    const MOTIVO = { HardBounce: 'endereço não existe', BadEmailAddress: 'endereço inválido', ManuallyDeactivated: 'desativado' };
    let pagina = 1, linhas = [];
    const coluna = () => (filtroRel === 'clicaram' ? 'Link' : filtroRel === 'voltaram' ? 'Motivo' : 'Quando');
    const desenhar = (d) => {
      ctx.tabela(el.querySelector('#em-rel-pessoas'), [
        { titulo: 'Pessoa', render: (p) => (p.contato_id
          ? `<button type="button" class="ag-link-linha" data-contato="${p.contato_id}">${esc(p.nome || p.email)}</button><br><span class="mini">${esc(p.email)}</span>`
          : `<b>${esc(p.email)}</b>`) },
        { titulo: coluna(), render: (p) => `<span class="mini">${esc(filtroRel === 'clicaram' ? (p.detalhe || '').replace(/^https?:\/\//, '')
          : filtroRel === 'voltaram' ? (MOTIVO[p.detalhe] || p.detalhe || '') : quando(p.quando))}</span>` },
      ], linhas, undefined, 'Ninguém aqui ainda.');
      const mais = el.querySelector('#em-rel-mais');
      mais.innerHTML = d.total > linhas.length ? `<span class="mini">mostrando ${int(linhas.length)} de ${int(d.total)}</span><button class="btn sec" type="button">Mostrar mais ${d.por_pagina}</button>` : '';
      const b = mais.querySelector('button');
      if (b) b.onclick = () => ocupado(b, () => carregar(pagina + 1));
    };
    const carregar = async (p) => {
      try {
        const d = await ctx.fetchJson(`/api/email/relatorios?campanha=${encodeURIComponent(id)}&lista=${filtroRel}&pagina=${p}&_=${Date.now()}`);
        pagina = p;
        linhas = p === 1 ? d.pessoas : linhas.concat(d.pessoas);
        desenhar(d);
      } catch (e) { avisar(msgErro(e), 'erro'); }
    };
    el.querySelectorAll('[data-rel]').forEach((b) => { b.onclick = () => { filtroRel = b.dataset.rel; el.querySelectorAll('[data-rel]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); carregar(1); }; });
    el.querySelector('#em-rel-pessoas').addEventListener('click', (ev) => { const b = ev.target.closest('[data-contato]'); if (b) detalheContatoReal(b.dataset.contato); });
    await carregar(1);
    // Atualização sozinha: não redesenha com gaveta ou menu abertos.
    relTimer = setTimeout(function tic() {
      if (api.vista !== 'relatorio' || String(campanhaRelatorio) !== String(id)) return;
      if (document.querySelector('.ag-menu__lista:not([hidden]), dialog[open], .confirma')) { relTimer = setTimeout(tic, 30000); return; }
      relatorioCampanha(el, id);
    }, 30000);
  }

  // ===========================================================================
  // 376 · Fluxos (quadro em email-fluxos.js)
  // ===========================================================================
  function fluxos(el) {
    if (!window.EmailFluxos) { el.innerHTML = '<div class="aviso falha">O quadro dos fluxos não carregou.</div>'; return; }
    window.EmailFluxos.render(el, ctx);
  }

  // ===========================================================================
  // 380 · Contatos (ligada ao backend: GET/POST /api/email/contatos)
  // ===========================================================================
  // Busca, filtros, totais, situação e as regras de descadastro e reativação
  // ficam no servidor; aqui só a tela.
  const filtroCont = { busca: '', situacao: '', origem: '', funil: '' };
  const NOME_ORIGEM = { 'meta-ads': 'Meta Ads', bio: 'Bio do Instagram', manychat: 'ManyChat', email: 'E-mail', outro: 'Outra origem', direto: 'Direto' };
  const nomeOrigem = (o) => NOME_ORIGEM[o] || o || '';
  const dataLonga = (ts) => (ts ? new Date(ts * 1000).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '');

  async function contatos(el) {
    el.innerHTML = carregando('Carregando os contatos');
    let pagina = 1;
    let linhas = [];
    let d;
    const qs = () => new URLSearchParams({ ...filtroCont, pagina: String(pagina), _: String(Date.now()) }).toString();
    try {
      d = await ctx.fetchJson('/api/email/contatos?' + qs());
    } catch (e) {
      el.innerHTML = `<div class="aviso falha">Não foi possível carregar os contatos (${esc(e.message)}). Tente de novo em instantes.</div>`;
      return;
    }
    const fora = d.totais.geral - d.totais.ativos;
    el.innerHTML = `<div class="grid-etiquetas">${[
        { rotulo: 'Contatos ativos', valor: int(d.totais.ativos), nota: 'podem receber marketing' },
        { rotulo: 'Total de contatos', valor: int(d.totais.geral), nota: 'leads dos formulários do tracking' },
        { rotulo: 'Fora do marketing', valor: int(fora), nota: 'descadastrados, voltaram, spam e inválidos' },
      ].map((k) => ctx.tile(k)).join('')}</div>
      ${d.totais.geral ? '' : '<div class="aviso explica">Os contatos chegam sozinhos: na primeira carga entram os leads que já existem no tracking, e depois cada lead novo de formulário vira contato na hora. Mesmo e-mail é sempre um contato só.</div>'}
      <div class="em-filtros">
        <input type="search" data-f="busca" placeholder="Buscar por nome ou e-mail" aria-label="Buscar contato" value="${esc(filtroCont.busca)}">
        <select data-f="situacao" aria-label="Situação"><option value="">Todas as situações</option>${Object.entries(SITUACOES).map(([k, [r]]) => `<option value="${k}">${r}</option>`).join('')}</select>
        <select data-f="origem" aria-label="Origem"><option value="">Todas as origens</option>${d.origens.map((o) => `<option value="${esc(o)}">${esc(nomeOrigem(o))}</option>`).join('')}</select>
        <select data-f="funil" aria-label="Funil"><option value="">Todos os funis</option>${d.funis.map((f) => `<option value="${esc(f)}">${esc(nomeFunil(f))}</option>`).join('')}</select>
      </div>
      <div class="em-contagem mini" id="em-cont-total"></div>
      <div class="tabela-wrap em-cont-lista" id="em-cont-lista"></div>
      <div class="paginacao" id="em-cont-mais"></div>`;

    const desenharLista = () => {
      const filtrado = Object.values(filtroCont).some(Boolean);
      el.querySelector('#em-cont-total').textContent = filtrado ? `${int(d.total)} contatos com esses filtros` : `${int(d.total)} contatos, mais recentes primeiro`;
      ctx.tabela(el.querySelector('#em-cont-lista'), [
        // Uma coluna só: nome em cima e e-mail embaixo; sem nome, o e-mail em cima
        // e o aviso (o nome chega do CRM quando o card tem).
        { titulo: 'Contato', campo: 'email', render: (p) => `<button type="button" class="ag-link-linha" data-contato="${p.id}">${esc(p.nome || p.email)}</button><br><span class="mini">${p.nome ? esc(p.email) : 'sem nome'}</span>` },
        { titulo: 'Origem', campo: 'origem', render: (p) => esc(nomeOrigem(p.origem)) },
        { titulo: 'Funil', campo: 'funil', render: (p) => esc(p.funil ? nomeFunil(p.funil) : '') },
        { titulo: 'Entrada', campo: 'entrou_em', render: (p) => esc(dataLonga(p.entrou_em)) },
        { titulo: 'Situação', campo: 'situacao', render: (p) => carimbo(SITUACOES, p.situacao) },
      ], linhas, undefined, d.totais.geral ? 'Nenhum contato com esses filtros.' : 'Nenhum contato ainda.');
      const mais = el.querySelector('#em-cont-mais');
      mais.innerHTML = d.total > linhas.length ? `<span class="mini">mostrando ${int(linhas.length)} de ${int(d.total)}</span><button class="btn sec" type="button">Mostrar mais ${d.por_pagina}</button>` : '';
      const bm = mais.querySelector('button');
      if (bm) bm.onclick = () => ocupado(bm, async () => {
        pagina += 1;
        try { d = await ctx.fetchJson('/api/email/contatos?' + qs()); linhas = linhas.concat(d.contatos); desenharLista(); }
        catch (e) { pagina -= 1; avisar(msgErro(e), 'erro'); }
      });
    };
    const recarregar = async () => {
      pagina = 1;
      try { d = await ctx.fetchJson('/api/email/contatos?' + qs()); linhas = d.contatos; desenharLista(); }
      catch (e) { avisar(msgErro(e), 'erro'); }
    };
    let espera = null;
    el.querySelectorAll('[data-f]').forEach((i) => {
      if (i.tagName === 'SELECT') i.value = filtroCont[i.dataset.f];
      i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', () => {
        filtroCont[i.dataset.f] = i.value;
        clearTimeout(espera);
        espera = setTimeout(recarregar, i.tagName === 'SELECT' ? 0 : 300);
      });
    });
    linhas = d.contatos;
    desenharLista();
    el.querySelector('#em-cont-lista').addEventListener('click', (ev) => { const b = ev.target.closest('[data-contato]'); if (b) detalheContatoReal(b.dataset.contato, () => contatos(el)); });
  }

  // Um passo do caminho no fluxo, em texto (388).
  function passoTxt(c) {
    if (c.tipo === 'entrou') return `entrou (${c.detalhe || 'gatilho'})`;
    if (c.tipo === 'email') return c.message_id ? `recebeu "${c.assunto || ''}"${c.clicado ? ', abriu e clicou' : c.aberto ? ', abriu' : ''}` : `e-mail não saiu${c.detalhe ? `: ${c.detalhe}` : ''}`;
    if (c.tipo === 'espera') return c.saida ? `saiu da espera${c.saida === 'aconteceu' ? ' (aconteceu)' : c.saida === 'nao_aconteceu' ? ' (não aconteceu no prazo)' : ''}` : 'começou a esperar';
    if (c.tipo === 'desvio') return `desvio: seguiu por "${c.saida === 'sim' ? 'sim' : 'não'}"`;
    if (c.tipo === 'objetivo') return 'chegou ao objetivo';
    if (c.tipo === 'ir_fluxo') return c.detalhe || 'foi para outro fluxo';
    if (c.tipo === 'fim') return 'concluiu o fluxo';
    if (c.tipo === 'saiu') return `saiu: ${c.detalhe || ''}`;
    return c.tipo;
  }
  const SITUACAO_NO_FLUXO = { andando: ['Andando', 'alta'], esperando: ['Esperando', 'neutro'], concluiu: ['Concluiu', 'alta'], saiu: ['Saiu', 'neutro'] };

  async function detalheContatoReal(id, aoMudar) {
    let d;
    try { d = await ctx.fetchJson(`/api/email/contatos?id=${encodeURIComponent(id)}&_=${Date.now()}`); }
    catch (e) { return avisar(msgErro(e), 'erro'); }
    const p = d.contato;
    const ORIGEM_ENVIO = { teste: 'Teste', agenda: 'Agenda', campanha: 'Campanha', fluxo: 'Fluxo' };
    const acao = p.situacao === 'ativo' ? '<button class="btn perigo" type="button" data-descad>Descadastrar</button>'
      : p.situacao === 'descadastrado' ? '<button class="btn sec" type="button" data-descad>Confirmar no serviço de envio</button>'
      : p.situacao === 'voltou' ? '<button class="btn sec" type="button" data-reativar>Reativar</button>' : '';
    const g = gaveta({
      titulo: esc(p.nome || p.email), sub: esc(p.email),
      corpo: `<p>${carimbo(SITUACOES, p.situacao)}${p.situacao_em && p.situacao !== 'ativo' ? ` <span class="mini">desde ${esc(dataLonga(p.situacao_em))}</span>` : ''}</p>
        <p class="mini em-explica-sit">${EXPLICA_SITUACAO[p.situacao] || ''}</p>
        <dl class="ag-dl">
          <dt>Origem</dt><dd>${esc(nomeOrigem(p.origem)) || '<span class="mini">sem origem</span>'}</dd>
          <dt>Funil</dt><dd>${esc(p.funil ? nomeFunil(p.funil) : '') || '<span class="mini">sem funil</span>'}</dd>
          <dt>Entrada</dt><dd>${esc(dataLonga(p.entrou_em))}</dd>
        </dl>
        <h3 class="ag-h3">Segmentos em que está</h3>
        ${(d.segmentos || []).length ? `<div class="ag-etiquetas">${d.segmentos.map((x) => `<span class="ag-etiqueta">${esc(x.nome)}</span>`).join('')}</div>` : '<p class="mini">Não está em nenhum segmento agora.</p>'}
        <h3 class="ag-h3">Fluxos</h3>
        ${(d.fluxos || []).length ? `<ol class="ag-hist em-hist">${d.fluxos.map((x) => `<li><div class="em-hist__item"><div><b>${esc(x.nome)}</b> <span class="mini">entrou em ${esc(dataLonga(x.entrou_em))}${x.motivo_saida ? ` · ${esc(x.motivo_saida)}` : ''}</span></div>
          <div>${carimbo(SITUACAO_NO_FLUXO, x.situacao)}${['andando', 'esperando'].includes(x.situacao) ? ` <button type="button" class="btn sec fx-pequeno" data-tirar-fluxo="${x.fluxo_id}">Tirar do fluxo</button>` : ''}</div></div>
          ${(x.caminho || []).length ? `<details class="ag-mais"><summary>Caminho no fluxo (${x.caminho.length} passos)</summary><ol class="mini">${x.caminho.map((c) => `<li>${esc(quando(c.em))} · ${esc(passoTxt(c))}</li>`).join('')}</ol></details>` : ''}</li>`).join('')}</ol>` : '<p class="mini">Não passou por nenhum fluxo.</p>'}
        <h3 class="ag-h3">Formulários preenchidos</h3>
        ${d.entradas.length ? `<ol class="ag-hist em-hist">${d.entradas.map((x) => `<li><b>${esc(x.funil ? nomeFunil(x.funil) : 'Sem funil')}</b> <span class="mini">${esc(dataLonga(x.entrou_em))} · ${esc(nomeOrigem(x.origem))}${x.material ? ` · material ${esc(x.material)}` : ''}</span></li>`).join('')}</ol>` : '<p class="mini">Nenhum formulário registrado.</p>'}
        <h3 class="ag-h3">E-mails recebidos</h3>
        ${d.envios.length ? `<ol class="ag-hist em-hist">${d.envios.map((x) => `<li class="em-hist__item"><div><b>${esc(x.assunto || '(sem assunto)')}</b><br><span class="mini">${esc(ORIGEM_ENVIO[x.origem] || x.origem)} · ${esc(quando(x.enviado_em))}${x.erro ? ` · ${esc(x.erro)}` : ''}</span></div>${carimbo(SITUACAO_ENVIO, x.situacao)}</li>`).join('')}</ol>` : '<p class="mini">Nenhum e-mail ainda.</p>'}
        <div id="em-contato-confirma"></div>`,
      rodape: `<div class="ag-acoes em-acoes-contato"><button class="btn" type="button" data-fechar-contato>Fechar</button>${acao ? `<span class="em-acao-canto">${acao}</span>` : p.situacao === 'ativo' ? '' : '<p class="mini">Quem denunciou spam ou tem endereço inválido não pode ser reativado pela equipe.</p>'}</div>`,
    });
    const fc = g.querySelector('[data-fechar-contato]');
    if (fc) fc.onclick = () => g.close();
    g.querySelectorAll('[data-tirar-fluxo]').forEach((b) => {
      b.onclick = () => ctx.pedirConfirmacao(b, 'Tirar do fluxo?', async () => {
        try {
          await ctx.postJson('/api/email/contatos', { acao: 'tirar_do_fluxo', id: p.id, fluxo_id: Number(b.dataset.tirarFluxo) });
          avisar('Tirado do fluxo. Fica registrado no histórico.');
          detalheContatoReal(p.id, aoMudar);
        } catch (e) { avisar(msgErro(e), 'erro'); return false; }
      });
    });
    const des = g.querySelector('[data-descad]');
    if (des) des.onclick = () => ctx.pedirConfirmacao(des, p.situacao === 'ativo' ? 'Descadastrar? Não tem volta pela equipe: só a própria pessoa volta, preenchendo um formulário.' : 'Tentar de novo no serviço de envio?', async () => {
      try {
        const r = await ctx.postJson('/api/email/contatos', { acao: 'descadastrar', id: p.id });
        avisar(r.aviso || `${p.nome || p.email} foi descadastrado.`, r.aviso ? 'erro' : 'ok');
        detalheContatoReal(p.id, aoMudar);
        if (aoMudar) aoMudar();
      } catch (e) { avisar(msgErro(e), 'erro'); return false; }
    });
    const re = g.querySelector('[data-reativar]');
    if (re) re.onclick = () => {
      g.querySelector('#em-contato-confirma').innerHTML = '<div class="aviso alerta">Só reative se o problema foi resolvido (ex.: a caixa estava cheia e a pessoa liberou). Se o endereço voltar de novo, a reputação do envio cai para todo mundo.</div>';
      ctx.pedirConfirmacao(re, 'Reativar mesmo assim?', async () => {
        try {
          await ctx.postJson('/api/email/contatos', { acao: 'reativar', id: p.id });
          avisar(`${p.nome || p.email} voltou a receber marketing.`);
          detalheContatoReal(p.id, aoMudar);
          if (aoMudar) aoMudar();
        } catch (e) { avisar(msgErro(e), 'erro'); return false; }
      }, [{ valor: true, rotulo: 'Reativar' }]);
    };
  }

  const EXPLICA_SITUACAO = {
    ativo: 'Recebe marketing normalmente.',
    descadastrado: 'Pediu para sair. Nunca mais recebe marketing. Só volta se a própria pessoa se cadastrar de novo.',
    voltou: 'O endereço não existe ou recusou de vez (devolução definitiva). Fora de todos os disparos.',
    denunciou: 'Marcou um e-mail nosso como spam. Fora de todos os disparos, para proteger a entrega de todo mundo.',
    invalido: 'Endereço malformado. Entrou como contato, mas fica fora dos disparos para não derrubar um envio inteiro.',
  };

  // Detalhe de contato do PROTÓTIPO: ainda usado pelas vistas de exemplo
  // (campanhas, relatório e fluxos). O real é detalheContatoReal (380).
  function detalheContato(id, aoMudar) {
    const p = D.contatos.find((x) => x.id === id);
    if (!p) return;
    const segs = D.segmentos.filter((s) => s.regras.every((r) => casa(p, r)));
    const hist = [];
    if (p.abriu.includes('c1') || p.funil === 'workshop-gratuito') hist.push({ nome: 'Convite workshop 08/10', data: '01/10', abriu: p.abriu.includes('c1'), clicou: p.clicou.includes('c1') });
    if (p.abriu.includes('c2') || p.estagio === 'MQL') hist.push({ nome: 'Novidade: plano ao vivo', data: '24/09', abriu: p.abriu.includes('c2'), clicou: p.clicou.includes('c2') });
    const fluxo = p.funil === 'workshop-gratuito' ? [
      ['Entrou', `${dataBR(p.entrada)} · preencheu o formulário do workshop`],
      ['E-mail 1', 'recebeu, ' + (p.abriu.length ? 'abriu' : 'não abriu')],
      ['Desvio', p.abriu.length ? 'seguiu por "sim"' : 'seguiu por "não"'],
      p.situacao === 'ativo' ? ['Agora', 'esperando 1 dia antes do próximo e-mail'] : ['Saiu', p.situacao === 'descadastrado' ? 'descadastrou-se' : p.situacao === 'voltou' ? 'o e-mail voltou' : p.situacao === 'denunciou' ? 'denunciou spam' : 'endereço inválido'],
    ] : [];
    const acao = p.situacao === 'ativo' ? '<button class="btn perigo" type="button" data-descad>Descadastrar</button>'
      : p.situacao === 'voltou' ? '<button class="btn sec" type="button" data-reativar>Reativar</button>' : '';
    const g = gaveta({
      titulo: esc(p.nome), sub: esc(p.email),
      corpo: `<p>${carimbo(SITUACOES, p.situacao)}</p>
        <p class="mini em-explica-sit">${EXPLICA_SITUACAO[p.situacao]}</p>
        <dl class="ag-dl">
          <dt>Origem</dt><dd>${esc(p.origem)}</dd>
          <dt>Funil</dt><dd>${esc(nomeFunil(p.funil))}</dd>
          <dt>Entrada</dt><dd>${dataBR(p.entrada)}/2026</dd>
          <dt>Estágio no CRM</dt><dd>${esc(p.estagio)}</dd>
        </dl>
        <h3 class="ag-h3">Segmentos</h3>
        ${segs.length ? `<div class="ag-etiquetas">${segs.map((s) => `<span class="ag-etiqueta">${esc(s.nome)}</span>`).join('')}</div>` : '<p class="mini">Não está em nenhum segmento agora.</p>'}
        <h3 class="ag-h3">E-mails recebidos</h3>
        ${hist.length ? `<ol class="ag-hist em-hist">${hist.map((h) => `<li><b>${esc(h.nome)}</b> <span class="mini">${h.data}</span><br>${h.abriu ? '<span class="ok">abriu</span>' : '<span class="mini">não abriu</span>'}${h.clicou ? ' · <span class="ok">clicou</span>' : ''}</li>`).join('')}</ol>` : '<p class="mini">Nenhum e-mail de marketing ainda.</p>'}
        <h3 class="ag-h3">Fluxos</h3>
        ${fluxo.length ? `<p><b>Boas-vindas do workshop gratuito</b></p><ol class="ag-hist em-hist">${fluxo.map(([a, b]) => `<li><b>${a}</b> <span class="mini">${b}</span></li>`).join('')}</ol>` : '<p class="mini">Não passou por nenhum fluxo.</p>'}
        <div id="em-contato-confirma"></div>`,
      rodape: acao ? `<div class="ag-acoes">${acao}</div>` : `<p class="mini">${p.situacao === 'ativo' ? '' : 'Quem se descadastrou, denunciou spam ou tem endereço inválido não pode ser reativado pela equipe.'}</p>`,
    });
    const des = g.querySelector('[data-descad]');
    if (des) des.onclick = () => ctx.pedirConfirmacao(des, 'Descadastrar a pedido da pessoa?', () => {
      p.situacao = 'descadastrado'; avisar(`${p.nome} foi descadastrado. Sai também dos fluxos.`); detalheContato(id, aoMudar); if (aoMudar) aoMudar();
    });
    const re = g.querySelector('[data-reativar]');
    if (re) re.onclick = () => {
      g.querySelector('#em-contato-confirma').innerHTML = '<div class="aviso alerta">Só reative se o problema foi resolvido (ex.: a caixa estava cheia e a pessoa liberou). Se o endereço voltar de novo, a reputação do envio cai para todo mundo.</div>';
      ctx.pedirConfirmacao(re, 'Reativar mesmo assim?', () => {
        p.situacao = 'ativo'; avisar(`${p.nome} voltou a receber marketing.`); detalheContato(id, aoMudar); if (aoMudar) aoMudar();
      }, [{ valor: true, rotulo: 'Reativar' }]);
    };
  }

  // ===========================================================================
  // 381 · Segmentos (ligada ao backend: GET/POST /api/email/segmentos)
  // ===========================================================================
  // A regra é avaliada no servidor (contagem, amostra e validação); aqui só a
  // tela. As vistas que ainda são protótipo (campanhas, fluxos) seguem com
  // D.segmentos e noSegmento.
  let segEstado = null; // { segmentos, opcoes }

  // Rótulos do montador. Os valores vêm do servidor (opcoes).
  function camposUi(op) {
    const c = {
      funil: { rotulo: 'Funil', ops: [['e', 'é'], ['nao', 'não é']], valores: op.funis.map((f) => [f, nomeFunil(f)]) },
      origem: { rotulo: 'Origem', ops: [['e', 'é'], ['nao', 'não é']], valores: op.origens.map((o) => [o, nomeOrigem(o)]) },
      entrada: { rotulo: 'Data de entrada', ops: [['ultimos', 'nos últimos'], ['antes', 'há mais de']], valores: op.entrada.map((d) => [String(d), `${d} dias`]) },
      estagio: { rotulo: 'Estágio no CRM', ops: [['e', 'é'], ['nao', 'não é']], valores: op.estagios.map((s) => [s, s]) },
    };
    if (op.campanhas.length) {
      const camp = op.campanhas.map((x) => [String(x.id), x.nome]);
      c.abriu = { rotulo: 'Abriu campanha', ops: [['sim', 'abriu'], ['nao', 'não abriu']], valores: camp };
      c.clicou = { rotulo: 'Clicou em campanha', ops: [['sim', 'clicou'], ['nao', 'não clicou']], valores: camp };
    }
    return c;
  }
  const resumoRegraReal = (regras, campos) => (regras.length ? regras.map((r) => {
    const c = campos[r.campo];
    if (!c) return r.campo;
    const op = (c.ops.find((o) => o[0] === r.op) || ['', ''])[1];
    const val = (c.valores.find((o) => o[0] === String(r.valor)) || ['', r.valor])[1];
    return `${c.rotulo.toLowerCase()} ${op} ${val}`;
  }).join(' e ') : 'todos os contatos');

  async function segmentos(el) {
    el.innerHTML = carregando('Carregando os segmentos');
    try {
      segEstado = await ctx.fetchJson('/api/email/segmentos?_=' + Date.now());
    } catch (e) {
      el.innerHTML = `<div class="aviso falha">Não foi possível carregar os segmentos (${esc(e.message)}). Tente de novo em instantes.</div>`;
      return;
    }
    const campos = camposUi(segEstado.opcoes);
    el.innerHTML = `<div class="em-barra"><p class="mini">Cada segmento é uma regra. A contagem é de contatos ativos agora e é refeita na hora de cada disparo.</p>
        <button class="btn" type="button" data-novo>Novo segmento</button></div>
      <div class="tabela-wrap" id="em-seg-lista"></div>`;
    el.querySelector('[data-novo]').onclick = () => montador(null, () => segmentos(el));
    const alvo = el.querySelector('#em-seg-lista');
    ctx.tabela(alvo, [
      { titulo: 'Segmento', campo: 'nome', render: (s) => `<button type="button" class="ag-link-linha" data-acao="editar" data-id="${s.id}">${esc(s.nome)}</button>` },
      { titulo: 'Regra', render: (s) => `<span class="mini em-regra-curta">${esc(resumoRegraReal(s.regras, campos))}</span>` },
      { titulo: 'Ativos agora', num: true, render: (s) => `<b>${int(s.ativos)}</b>` },
      { titulo: '', render: (s) => `<div class="ag-acoes ag-acoes--linha">${menuHtml(s.nome, [
        { acao: 'editar', id: s.id, rotulo: 'Editar regra' },
        { acao: 'duplicar', id: s.id, rotulo: 'Duplicar' },
        { acao: 'excluir', id: s.id, rotulo: 'Excluir', perigo: true },
      ])}</div>` },
    ], segEstado.segmentos, undefined, `Nenhum segmento ainda. Um segmento junta contatos por funil, origem, data de entrada ou estágio no CRM${segEstado.opcoes.campanhas.length ? ', ou por campanha que abriram ou clicaram' : '. Depois da primeira campanha, também por quem abriu ou clicou'}.`);
    const seg = (id) => segEstado.segmentos.find((s) => String(s.id) === String(id));
    ligarAcoes(alvo, {
      editar: (id) => montador(seg(id), () => segmentos(el)),
      duplicar: async (id) => {
        try { const r = await ctx.postJson('/api/email/segmentos', { acao: 'duplicar', id: Number(id) }); avisar(`Segmento duplicado: "${r.segmento.nome}".`); segmentos(el); }
        catch (e) { avisar(msgErro(e), 'erro'); }
      },
      excluir: (id, b) => ctx.pedirConfirmacao(b, 'Excluir o segmento?', async () => {
        fecharMenus();
        try { await ctx.postJson('/api/email/segmentos', { acao: 'excluir', id: Number(id) }); avisar('Segmento excluído.'); segmentos(el); }
        catch (e) { avisar(msgErro(e), 'erro'); }
      }),
    });
  }

  function montador(s, aoSalvar) {
    const novo = !s;
    const campos = camposUi(segEstado.opcoes);
    const primeiro = (campo) => { const c = campos[campo]; return { campo, op: c.ops[0][0], valor: (c.valores[0] || [''])[0] }; };
    const rascunho = { nome: s ? s.nome : '', regras: s ? s.regras.map((r) => ({ ...r, valor: String(r.valor) })) : [primeiro('funil')] };
    const g = gaveta({
      titulo: novo ? 'Novo segmento' : 'Editar segmento', sub: 'condições combinadas com "e": a pessoa precisa cumprir todas', largura: 'larga',
      corpo: `<label class="ag-campo"><span class="ag-campo__rotulo">Nome</span><input type="text" id="em-seg-nome" maxlength="100" value="${esc(rascunho.nome)}" placeholder="Ex.: Leads do workshop nos últimos 30 dias"></label>
        <div class="em-regras" id="em-regras"></div>
        <button class="btn sec em-mais" type="button" data-add>+ Adicionar condição</button>
        <div class="em-contagem-viva" id="em-seg-conta" aria-live="polite"></div>
        <h3 class="ag-h3">Amostra <small class="mini">primeiros contatos ativos que a regra pega</small></h3>
        <div class="tabela-wrap" id="em-seg-amostra"></div>
        <div class="em-erro" aria-live="polite"></div>`,
      rodape: '<div class="ag-acoes"><button class="btn" type="button" data-salvar>Salvar segmento</button><button class="btn sec" type="button" data-fechar2>Cancelar</button></div>',
    });
    const caixa = g.querySelector('#em-regras');
    const erro = g.querySelector('.em-erro');
    let espera = null, pedido = 0;
    const contar = () => {
      clearTimeout(espera);
      espera = setTimeout(async () => {
        const n = ++pedido;
        const conta = g.querySelector('#em-seg-conta');
        try {
          const p = await ctx.postJson('/api/email/segmentos', { acao: 'previa', regras: rascunho.regras });
          if (n !== pedido) return;
          conta.innerHTML = `<b>${int(p.ativos)}</b> contatos ativos com essa regra${p.fora ? ` <span class="mini">· mais ${int(p.fora)} fora do marketing (descadastrados, voltaram, spam, inválidos)</span>` : ''}`;
          ctx.tabela(g.querySelector('#em-seg-amostra'), [
            { titulo: 'Nome', render: (c) => `<b>${esc(c.nome || c.email)}</b><br><span class="mini">${esc(c.email)}</span>` },
            { titulo: 'Funil', render: (c) => `<span class="mini">${esc(c.funil ? nomeFunil(c.funil) : '')}</span>` },
            { titulo: 'Entrada', render: (c) => esc(dataLonga(c.entrou_em)) },
          ], p.amostra, undefined, 'Ninguém cumpre essa regra agora.');
        } catch (e) {
          if (n === pedido) conta.innerHTML = `<span class="mini">Não foi possível contar agora (${esc(msgErro(e))}).</span>`;
        }
      }, 400);
    };
    const desenhar = () => {
      caixa.innerHTML = rascunho.regras.map((r, i) => {
        const c = campos[r.campo];
        return `<div class="em-regra" data-i="${i}">
          <span class="em-regra__e">${i ? 'e' : 'quem'}</span>
          <select data-k="campo" aria-label="Campo">${Object.entries(campos).map(([k, v]) => `<option value="${k}"${k === r.campo ? ' selected' : ''}>${v.rotulo}</option>`).join('')}</select>
          <select data-k="op" aria-label="Comparação">${c.ops.map(([k, v]) => `<option value="${k}"${k === r.op ? ' selected' : ''}>${v}</option>`).join('')}</select>
          <select data-k="valor" aria-label="Valor">${c.valores.map(([k, v]) => `<option value="${esc(k)}"${k === r.valor ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>
          <button class="ag-icone" type="button" data-tirar aria-label="Tirar condição">${ICONE.fechar}</button>
        </div>`;
      }).join('') || '<p class="mini">Sem condição: o segmento pega todos os contatos ativos.</p>';
      contar();
    };
    caixa.addEventListener('change', (ev) => {
      const linha = ev.target.closest('[data-i]');
      const i = Number(linha.dataset.i);
      if (ev.target.dataset.k === 'campo') rascunho.regras[i] = primeiro(ev.target.value);
      else rascunho.regras[i][ev.target.dataset.k] = ev.target.value;
      erro.textContent = '';
      desenhar();
    });
    caixa.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-tirar]');
      if (b) { rascunho.regras.splice(Number(b.closest('[data-i]').dataset.i), 1); desenhar(); }
    });
    g.querySelector('[data-add]').onclick = () => { rascunho.regras.push(primeiro('origem')); desenhar(); };
    g.querySelector('[data-fechar2]').onclick = () => g.close();
    const salvar = g.querySelector('[data-salvar]');
    salvar.onclick = () => ocupado(salvar, async () => {
      try {
        await ctx.postJson('/api/email/segmentos', { acao: 'salvar', id: s ? s.id : undefined, nome: g.querySelector('#em-seg-nome').value, regras: rascunho.regras });
        g.close();
        avisar(novo ? 'Segmento criado.' : 'Segmento salvo.');
        aoSalvar();
      } catch (e) { erro.textContent = msgErro(e); avisar(msgErro(e), 'erro'); }
    });
    desenhar();
  }

  // ===========================================================================
  // 378 · Modelos (ligada ao backend: GET/POST /api/email/modelos)
  // ===========================================================================
  // Lista, editor, prévia, teste, duplicar e arquivar vêm do servidor: a
  // validação de campos e links, o layout do e-mail e a trava de "em uso"
  // ficam lá. Aqui só a tela.
  let filtroModelo = 'todos';
  let modeloAberto = null;
  let modelosEstado = null; // { modelos, campos }
  let paraTeste = '';

  const NOME_CANAL = { transacional: 'Transacional', marketing: 'Marketing' };
  const dataCurta = (ts) => (ts ? new Date(ts * 1000).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }) : '');

  // Trava o botão enquanto a chamada corre (evita duplo clique).
  async function ocupado(botao, fn) {
    if (botao.disabled) return;
    botao.disabled = true;
    botao.setAttribute('aria-busy', 'true');
    try { await fn(); } finally { botao.disabled = false; botao.removeAttribute('aria-busy'); }
  }

  const postModelos = (corpo) => ctx.postJson('/api/email/modelos', corpo);
  const modeloReal = (id) => modelosEstado.modelos.find((m) => String(m.id) === String(id));
  function trocarModelo(m) {
    const i = modelosEstado.modelos.findIndex((x) => x.id === m.id);
    if (i >= 0) modelosEstado.modelos[i] = m; else modelosEstado.modelos.unshift(m);
  }

  async function modelos(el) {
    if (!modelosEstado) {
      el.innerHTML = carregando('Carregando os modelos');
      try {
        modelosEstado = await ctx.fetchJson('/api/email/modelos?_=' + Date.now());
      } catch (e) {
        el.innerHTML = `<div class="aviso falha">Não foi possível carregar os modelos (${esc(e.message)}). Tente de novo em instantes.</div>`;
        return;
      }
    }
    if (modeloAberto) return editorModelo(el, modeloAberto);
    listaModelos(el);
  }

  function listaModelos(el) {
    const todos = modelosEstado.modelos;
    const casaFiltro = (m, k) => (k === 'arquivados' ? m.arquivado : !m.arquivado && (k === 'todos' || m.canal === k));
    const linhas = todos.filter((m) => casaFiltro(m, filtroModelo));
    const FILTROS_M = [['todos', 'Todos'], ['transacional', 'Transacional'], ['marketing', 'Marketing'], ['arquivados', 'Arquivados']];
    el.innerHTML = `<div class="em-barra">
        <div class="ag-subvistas" role="group" aria-label="Filtrar modelos">${FILTROS_M.map(([k, r]) => `<button type="button" class="ag-subvista" data-fm="${k}" aria-pressed="${k === filtroModelo}">${r} <span class="ag-cont">${todos.filter((m) => casaFiltro(m, k)).length}</span></button>`).join('')}</div>
        <div class="ag-acoes"><button class="btn" type="button" data-novo="marketing">Novo modelo de marketing</button><button class="btn sec" type="button" data-novo="transacional">Novo transacional</button></div>
      </div>
      <div class="tabela-wrap" id="em-mod-lista"></div>`;
    el.querySelectorAll('[data-fm]').forEach((b) => { b.onclick = () => { filtroModelo = b.dataset.fm; listaModelos(el); }; });
    el.querySelectorAll('[data-novo]').forEach((b) => { b.onclick = () => novoModelo(el, b.dataset.novo); });
    const alvo = el.querySelector('#em-mod-lista');
    ctx.tabela(alvo, [
      { titulo: 'Modelo', campo: 'nome', render: (m) => `<button type="button" class="ag-link-linha" data-acao="editar" data-id="${m.id}">${esc(m.nome)}</button>` },
      { titulo: 'Canal', campo: 'canal', render: (m) => NOME_CANAL[m.canal] },
      { titulo: 'Assunto', render: (m) => `<span class="em-assunto-curto">${esc(m.assunto || 'sem assunto')}</span>` },
      { titulo: 'Editado', render: (m) => esc(dataCurta(m.atualizado_em)) },
      { titulo: '', render: (m) => `<div class="ag-acoes ag-acoes--linha">${menuHtml(m.nome, m.arquivado ? [
        { acao: 'desarquivar', id: m.id, rotulo: 'Tirar do arquivo' }, { acao: 'duplicar', id: m.id, rotulo: 'Duplicar' },
      ] : [
        { acao: 'editar', id: m.id, rotulo: 'Editar' },
        { acao: 'teste', id: m.id, rotulo: 'Mandar teste' },
        { acao: 'duplicar', id: m.id, rotulo: 'Duplicar' },
        { acao: 'arquivar', id: m.id, rotulo: 'Arquivar', perigo: true },
      ])}</div>` },
    ], linhas, undefined, filtroModelo === 'arquivados' ? 'Nenhum modelo arquivado.' : 'Nenhum modelo ainda. Crie o primeiro escolhendo o canal: transacional (agenda) ou marketing (campanhas e fluxos).');
    ligarAcoes(alvo, {
      editar: (id) => { modeloAberto = Number(id); modelos(el); window.scrollTo(0, 0); },
      teste: (id) => pedirTeste(modeloReal(id)),
      duplicar: async (id) => {
        try {
          const r = await postModelos({ acao: 'duplicar', id: Number(id) });
          trocarModelo(r.modelo); filtroModelo = 'todos';
          avisar(`Modelo duplicado: "${r.modelo.nome}".`); listaModelos(el);
        } catch (e) { avisar(msgErro(e), 'erro'); }
      },
      desarquivar: async (id) => {
        try {
          const r = await postModelos({ acao: 'desarquivar', id: Number(id) });
          trocarModelo(r.modelo); avisar('Modelo de volta na lista.'); listaModelos(el);
        } catch (e) { avisar(msgErro(e), 'erro'); }
      },
      arquivar: (id, b) => {
        ctx.pedirConfirmacao(b, 'Arquivar?', async () => {
          fecharMenus();
          try {
            const r = await postModelos({ acao: 'arquivar', id: Number(id) });
            trocarModelo(r.modelo); avisar('Modelo arquivado. Ele fica no filtro "Arquivados".'); listaModelos(el);
          } catch (e) { avisar(msgErro(e), 'erro'); }
        });
      },
    });
  }

  function novoModelo(el, canal) {
    const g = gaveta({
      titulo: canal === 'marketing' ? 'Novo modelo de marketing' : 'Novo modelo transacional',
      sub: canal === 'marketing' ? 'sai por news. em campanhas e fluxos' : 'sai por envio. nos e-mails da agenda',
      corpo: `<form class="ag-form" data-novo-form novalidate>
          <label>Nome do modelo<input type="text" name="nome" maxlength="100" placeholder="Ex.: Convite workshop de outubro" autocomplete="off"></label>
          <p class="mini">O nome é só para a equipe achar o modelo. Quem recebe vê o assunto.</p>
          <div class="em-erro" aria-live="polite"></div>
        </form>`,
      rodape: '<button class="btn" type="button" data-criar>Criar e abrir</button>',
    });
    const f = g.querySelector('[data-novo-form]');
    const criar = g.querySelector('[data-criar]');
    f.nome.focus();
    const enviar = () => ocupado(criar, async () => {
      try {
        const r = await postModelos({ acao: 'salvar', modelo: { nome: f.nome.value, canal } });
        trocarModelo(r.modelo);
        fecharGaveta();
        modeloAberto = r.modelo.id;
        avisar('Modelo criado. Escreva o assunto e o corpo e salve.');
        modelos(el);
      } catch (e) { f.querySelector('.em-erro').textContent = msgErro(e); }
    });
    criar.onclick = enviar;
    f.onsubmit = (ev) => { ev.preventDefault(); enviar(); };
  }

  function pedirTeste(m) {
    const g = gaveta({
      titulo: 'Mandar teste',
      sub: `"${esc(m.nome)}" com os dados de exemplo`,
      corpo: `<form class="ag-form" data-teste-form novalidate>
          <label>Para<input type="email" name="para" value="${esc(paraTeste)}" placeholder="seu e-mail" autocomplete="email"></label>
          <p class="mini">Sai pelo remetente do canal ${m.canal}, com os campos preenchidos por dados de exemplo. A entrega aparece em Configuração › Últimos testes.</p>
          <div class="em-erro" aria-live="polite"></div>
        </form>`,
      rodape: '<button class="btn" type="button" data-mandar>Mandar teste</button>',
    });
    const f = g.querySelector('[data-teste-form]');
    const b = g.querySelector('[data-mandar]');
    f.para.focus();
    const enviar = () => ocupado(b, async () => {
      try {
        await postModelos({ acao: 'enviar_teste', id: m.id, para: f.para.value });
        paraTeste = f.para.value.trim();
        fecharGaveta();
        avisar(`Teste mandado para ${paraTeste}.`);
      } catch (e) { f.querySelector('.em-erro').textContent = msgErro(e); }
    });
    b.onclick = enviar;
    f.onsubmit = (ev) => { ev.preventDefault(); enviar(); };
  }

  function editorModelo(el, id) {
    const m = modeloReal(id);
    if (!m) { modeloAberto = null; return listaModelos(el); }
    const CHAVES = ['nome', 'canal', 'assunto', 'previa', 'corpo'];
    const rasc = Object.fromEntries(CHAVES.map((k) => [k, m[k] ?? '']));
    const sujo = () => CHAVES.some((k) => rasc[k] !== (m[k] ?? ''));
    let tamanho = 'computador';
    el.innerHTML = `<div class="em-barra"><button class="btn sec em-voltar" type="button" data-voltar>${ICONE.voltar} Modelos</button>
        <div class="ag-acoes"><button class="btn sec" type="button" data-teste>Mandar teste</button><button class="btn sec" type="button" data-dup>Duplicar</button><button class="btn" type="button" data-salvar>Salvar</button></div></div>
      ${m.arquivado ? '<div class="aviso alerta">Este modelo está arquivado. Ele não aparece na lista principal nem pode ser escolhido em campanhas, fluxos ou na agenda.</div>' : ''}
      <div class="em-editor">
        <form class="ag-form em-editor__form" onsubmit="return false">
          <div class="linha"><label>Nome<input type="text" data-m="nome" maxlength="100" value="${esc(rasc.nome)}"></label>
            <label>Canal<select data-m="canal">${Object.entries(NOME_CANAL).map(([k, r]) => `<option value="${k}"${k === rasc.canal ? ' selected' : ''}>${r} (${k === 'marketing' ? 'news.' : 'envio.'})</option>`).join('')}</select></label></div>
          <label>Assunto<input type="text" data-m="assunto" maxlength="200" value="${esc(rasc.assunto)}" placeholder="O que aparece em negrito na caixa de entrada"></label>
          <label>Texto de pré-visualização<input type="text" data-m="previa" maxlength="200" value="${esc(rasc.previa)}" placeholder="A linha que aparece depois do assunto"></label>
          <div class="ag-campo"><span class="ag-campo__rotulo">Corpo</span>
            <div class="em-ferramentas" role="toolbar" aria-label="Formatação">
              <button type="button" class="btn sec" data-fmt="negrito"><b>N</b> Negrito</button>
              <button type="button" class="btn sec" data-fmt="link">Link</button>
              <button type="button" class="btn sec" data-fmt="botao">Botão</button>
            </div>
            <textarea data-m="corpo" rows="12">${esc(rasc.corpo)}</textarea>
            <span class="mini">**texto** vira negrito · [texto](link) vira link · [[Texto | link]] vira botão. Cabeçalho e rodapé entram sozinhos.</span></div>
          <div class="ag-campo"><span class="ag-campo__rotulo">Campos do canal <span data-nome-canal>${rasc.canal}</span> <span class="mini">(clique para inserir onde está o cursor)</span></span>
            <div class="ag-etiquetas" data-chips></div></div>
          <div id="em-campos-ruins" aria-live="polite"></div>
          <div class="em-erro" aria-live="polite"></div>
        </form>
        <div class="em-editor__previa">
          <div class="em-barra em-barra--previa"><span class="ag-campo__rotulo">Pré-visualização com dados de exemplo</span>
            <div class="em-tamanho" role="group" aria-label="Tamanho da pré-visualização">
              <button type="button" class="ag-icone" data-tam="computador" aria-pressed="true" aria-label="Computador" title="Computador">${ICONE.computador}</button>
              <button type="button" class="ag-icone" data-tam="celular" aria-pressed="false" aria-label="Celular" title="Celular">${ICONE.celular}</button></div></div>
          <div id="em-previa"></div>
        </div>
      </div>`;
    const ta = el.querySelector('[data-m="corpo"]');
    const erro = el.querySelector('.em-editor__form .em-erro');
    let ultimoCampo = ta;
    let ultimaPrevia = null;

    const inserir = (antes, depois = '', padrao = '') => {
      const i = ultimoCampo, a = i.selectionStart ?? i.value.length, z = i.selectionEnd ?? a;
      const sel = i.value.slice(a, z) || padrao;
      i.value = i.value.slice(0, a) + antes + sel + depois + i.value.slice(z);
      i.focus();
      i.selectionStart = i.selectionEnd = a + antes.length + sel.length + depois.length;
      rasc[i.dataset.m] = i.value;
      atualizar();
    };
    const desenharChips = () => {
      el.querySelector('[data-nome-canal]').textContent = rasc.canal;
      el.querySelector('[data-chips]').innerHTML = (modelosEstado.campos[rasc.canal] || [])
        .map((c) => `<button type="button" class="em-campo" data-campo="${esc(c.campo)}" title="${esc(c.rotulo)}">{{${esc(c.campo)}}}</button>`).join('');
      el.querySelectorAll('[data-campo]').forEach((b) => { b.onclick = () => inserir(`{{${b.dataset.campo}}}`); });
    };
    // A prévia é o HTML final montado pelo servidor, isolado num iframe sem scripts.
    const desenharPrevia = () => {
      const p = ultimaPrevia;
      if (!p) return;
      const cfg = D.config[rasc.canal];
      const alvo = el.querySelector('#em-previa');
      alvo.innerHTML = `<div class="em-email em-email--${tamanho}">
          <div class="em-email__caixa"><b>${esc(cfg.nome)}</b> <span class="mini">&lt;${esc(cfg.endereco)}&gt;</span><br>
            <span class="em-email__assunto">${esc(p.assunto || '(sem assunto)')}</span> <span class="mini">${esc(p.previa)}</span></div>
          <iframe title="Pré-visualização do e-mail" sandbox="allow-same-origin" style="display:block;width:100%;border:0;min-height:320px"></iframe>
        </div>`;
      const fr = alvo.querySelector('iframe');
      fr.onload = () => { try { fr.style.height = fr.contentDocument.documentElement.scrollHeight + 'px'; } catch { /* fica a altura mínima */ } };
      fr.srcdoc = p.html;
      el.querySelector('#em-campos-ruins').innerHTML = [
        p.desconhecidos.length ? `<div class="aviso falha"><b>Campo desconhecido:</b> ${p.desconhecidos.map((r) => `{{${esc(r)}}}`).join(', ')}. Os campos deste canal estão logo acima. Não dá para salvar assim.</div>` : '',
        ...p.avisos.map((a) => `<div class="aviso alerta">${esc(a)}</div>`),
      ].join('');
    };
    let espera = null, pedido = 0;
    function atualizar(imediato) {
      clearTimeout(espera);
      espera = setTimeout(async () => {
        const n = ++pedido;
        try {
          const p = await postModelos({ acao: 'previa', modelo: { canal: rasc.canal, assunto: rasc.assunto, previa: rasc.previa, corpo: rasc.corpo } });
          if (n !== pedido) return; // já há um pedido mais novo
          ultimaPrevia = p;
          desenharPrevia();
        } catch (e) {
          if (n === pedido) el.querySelector('#em-previa').innerHTML = `<div class="aviso falha">Não foi possível montar a pré-visualização (${esc(msgErro(e))}).</div>`;
        }
      }, imediato ? 0 : 400);
    }

    el.querySelectorAll('[data-m]').forEach((i) => i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', () => {
      rasc[i.dataset.m] = i.value;
      erro.textContent = '';
      if (i.dataset.m === 'canal') desenharChips();
      if (i.dataset.m !== 'nome') atualizar(i.dataset.m === 'canal');
    }));
    el.querySelectorAll('[data-m="assunto"], [data-m="previa"], [data-m="corpo"]').forEach((i) => i.addEventListener('focus', () => { ultimoCampo = i; }));
    el.querySelectorAll('[data-fmt]').forEach((b) => { b.onclick = () => { ultimoCampo = ta; ({
      negrito: () => inserir('**', '**', 'texto em negrito'),
      link: () => inserir('[', '](https://)', 'texto do link'),
      botao: () => inserir('\n\n[[', ' | https://]]\n\n', 'Texto do botão'),
    })[b.dataset.fmt](); }; });
    el.querySelectorAll('[data-tam]').forEach((b) => { b.onclick = () => { tamanho = b.dataset.tam; el.querySelectorAll('[data-tam]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); desenharPrevia(); }; });

    const voltar = el.querySelector('[data-voltar]');
    voltar.onclick = () => {
      if (!sujo()) { modeloAberto = null; return listaModelos(el); }
      ctx.pedirConfirmacao(voltar, 'Sair sem salvar?', () => { modeloAberto = null; listaModelos(el); });
    };
    el.querySelector('[data-teste]').onclick = () => (sujo() ? avisar('Salve as mudanças antes de mandar o teste.', 'erro') : pedirTeste(m));
    const dup = el.querySelector('[data-dup]');
    dup.onclick = () => {
      if (sujo()) return avisar('Salve as mudanças antes de duplicar.', 'erro');
      ocupado(dup, async () => {
        try {
          const r = await postModelos({ acao: 'duplicar', id: m.id });
          trocarModelo(r.modelo); modeloAberto = r.modelo.id;
          avisar('Modelo duplicado. Você está editando a cópia.'); modelos(el);
        } catch (e) { avisar(msgErro(e), 'erro'); }
      });
    };
    const salvar = el.querySelector('[data-salvar]');
    salvar.onclick = () => ocupado(salvar, async () => {
      try {
        const r = await postModelos({ acao: 'salvar', id: m.id, modelo: rasc });
        trocarModelo(r.modelo);
        Object.assign(m, r.modelo);
        Object.assign(rasc, Object.fromEntries(CHAVES.map((k) => [k, r.modelo[k] ?? ''])));
        erro.textContent = '';
        avisar('Modelo salvo.');
      } catch (e) {
        erro.textContent = msgErro(e);
        avisar(msgErro(e), 'erro');
        erro.scrollIntoView({ block: 'center' });
      }
    });
    desenharChips();
    atualizar(true);
  }

  // ===========================================================================
  // 373 · Configuração (ligada ao backend na 377: GET/POST /api/email/config)
  // ===========================================================================
  // Única vista real: lê e grava pelo backend. Validação de remetente, envio de
  // teste e conexão dos resultados ficam todas no servidor; aqui só a tela.
  const DOMINIO_CANAL = { transacional: 'envio.atacadoexponencial.com', marketing: 'news.atacadoexponencial.com' };
  const SITUACAO_ENVIO = {
    enviado: ['Enviado', 'neutro'], falhou: ['Falhou', 'queda'], entregue: ['Entregue', 'alta'],
    aberto: ['Aberto', 'alta'], clicado: ['Clicado', 'alta'], voltou: ['Voltou', 'queda'],
    voltou_temporario: ['Voltou temporariamente', 'alerta'], spam: ['Marcado como spam', 'queda'], descadastrou: ['Descadastrou', 'alerta'],
  };
  const ROTULO_EVENTO = {
    entregue: 'Entregue', aberto: 'Aberto', clicado: 'Clicado', voltou: 'Voltou',
    voltou_temporario: 'Voltou temporariamente', spam: 'Spam', descadastrou: 'Descadastrou',
  };
  const quando = (ts) => (ts ? new Date(ts * 1000).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '');
  const msgErro = (e) => (e && (e.mensagemUsuario || e.message)) || 'Não foi possível concluir. Tente de novo.';
  const selo = (rotulo, cor) => `<span class="carimbo ${cor}">${esc(rotulo)}</span>`;
  let cfgEstado = null;

  async function configuracao(el) {
    el.innerHTML = carregando('Carregando a configuração');
    try {
      cfgEstado = await ctx.fetchJson('/api/email/config?_=' + Date.now());
    } catch (e) {
      el.innerHTML = `<div class="aviso falha">Não foi possível carregar a configuração (${esc(e.message)}). Tente de novo em instantes.</div>`;
      return;
    }
    desenharConfig(el);
  }

  // Os outros protótipos passam a mostrar os remetentes de verdade.
  function espelharNoPrototipo(C) {
    Object.assign(D.config.transacional, { nome: C.remetente_transacional_nome, endereco: C.remetente_transacional_email, resposta: C.resposta_transacional });
    Object.assign(D.config.marketing, { nome: C.remetente_marketing_nome, endereco: C.remetente_marketing_email, resposta: C.resposta_marketing });
    D.config.rodape = C.rodape;
  }

  function desenharConfig(el) {
    const S = cfgEstado;
    const C = S.config;
    espelharNoPrototipo(C);
    const contaOk = S.conta === 'aceita';
    const mktLiberado = C.marketing_liberado === '1';
    const domRuins = S.dominios.consultado ? S.dominios.itens.filter((d) => !d.dkim) : [];
    const semResultados = contaOk && (S.resultados.transacional === false || S.resultados.marketing === false);
    // Pendências que não impedem o envio, mas não podem passar como "tudo certo".
    const pendencias = [
      !C.resposta_transacional && !C.resposta_marketing && { campo: 'resposta_transacional', texto: 'Sem endereço de resposta: o domínio não recebe e-mail, então as respostas dos leads se perdem.' },
      !C.rodape && { campo: 'rodape', texto: 'Rodapé vazio: todo e-mail de marketing precisa dos dados da empresa e do endereço.' },
    ].filter(Boolean);
    const geral = !contaOk || domRuins.length ? 'incidente' : !mktLiberado || semResultados || pendencias.length ? 'atencao' : 'saudavel';
    const frase = S.conta === 'ausente' || S.conta === 'recusada' ? 'Serviço de envio sem acesso. Confira a chave em Saúde das integrações. Teste e conexão dos resultados ficam indisponíveis.'
      : S.conta === 'sem_resposta' ? 'Não foi possível falar com o serviço de envio agora. Atualize em instantes.'
      : domRuins.length ? `O domínio ${domRuins.map((d) => d.nome).join(' e ')} está sem verificação. Confira o DNS na Cloudflare.`
      : !mktLiberado ? 'Conta aprovada, mas o marketing está marcado como não liberado. A agenda pode mandar e-mails; campanhas e fluxos esperam.'
      : semResultados ? 'Envio funcionando, mas os resultados (entregue, aberto, clicado) ainda não estão conectados.'
      : pendencias.length ? `Os e-mails podem sair, mas há ${pendencias.length === 1 ? 'uma pendência' : `${pendencias.length} pendências`}:`
      : 'Conta aprovada e os dois canais liberados. Os e-mails da agenda e de marketing podem sair.';
    const CHAVE = { aceita: ['Funcionando', 'alta'], recusada: ['Recusada', 'queda'], ausente: ['Não configurada', 'queda'], sem_resposta: ['Sem resposta', 'alerta'] };
    const seloResultado = (v) => (v === true ? selo('Conectado', 'alta') : v === false ? selo('Não conectado', 'alerta') : selo('Não consultado', 'neutro'));
    const linhaDominio = (canal) => {
      let s;
      if (!S.dominios.consultado) s = selo('Não consultado', 'neutro');
      else {
        const d = S.dominios.itens.find((i) => i.canal === canal);
        s = !d || !d.encontrado ? selo('Não cadastrado', 'queda')
          : !d.dkim ? selo('Com problema', 'queda')
          : !d.retorno ? selo('Retorno pendente', 'alerta')
          : selo('Verificado', 'alta');
      }
      return `<tr><td><b>${DOMINIO_CANAL[canal]}</b><br><span class="mini">${canal}</span></td><td class="num">${s}</td></tr>`;
    };
    const MOTIVO_DOM = {
      sem_chave_conta: 'Não consultada (falta a chave da conta).',
      recusada: 'Não consultada: o serviço recusou a chave da conta.',
      sem_resposta: 'Não consultada: o serviço não respondeu agora.',
    };
    const canal = (k, titulo) => `<div class="em-canal">
        <h3>${titulo} <span class="mini">${DOMINIO_CANAL[k]}</span></h3>
        <div class="ag-form">
          <label>Nome do remetente<input type="text" name="remetente_${k}_nome" maxlength="100" value="${esc(C[`remetente_${k}_nome`])}"></label>
          <label>Endereço do remetente<input type="email" name="remetente_${k}_email" value="${esc(C[`remetente_${k}_email`])}"><span class="mini">Só endereços @${DOMINIO_CANAL[k]} são aceitos.</span></label>
          <label>Endereço de resposta<input type="email" name="resposta_${k}" value="${esc(C[`resposta_${k}`])}" placeholder="ex.: contato@seteads.com"><span class="mini">Vazio: as respostas dos leads se perdem, porque o domínio não recebe e-mail. Sugestão: um endereço @seteads.com.</span></label>
        </div></div>`;
    const linhaTeste = (t) => {
      const passos = [`Enviado ${quando(t.enviado_em)}`].concat(t.eventos.map((ev) => `${ROTULO_EVENTO[ev.tipo] || ev.tipo} ${quando(ev.ocorrido_em)}`));
      return `<tr>
        <td>${quando(t.enviado_em)}</td>
        <td>${esc(t.destinatario)}<br><span class="mini">${t.canal}</span></td>
        <td>${carimbo(SITUACAO_ENVIO, t.situacao)}${t.erro && t.situacao === 'falhou' ? `<br><span class="mini">${esc(t.erro)}</span>` : ''}</td>
        <td class="mini">${t.situacao === 'falhou' ? '' : passos.map(esc).join(' · ')}</td>
      </tr>`;
    };
    el.innerHTML = `
      <div class="faixa-estado ${geral}">
        <span class="selo-estado">${geral === 'incidente' ? 'Com problema' : geral === 'atencao' ? (contaOk && mktLiberado && !semResultados && !domRuins.length ? `Funcionando, com ${pendencias.length} ${pendencias.length === 1 ? 'pendência' : 'pendências'}` : 'Pendente') : 'Tudo certo'}</span>
        <div><p>${frase}</p>${geral === 'atencao' && contaOk && mktLiberado && !semResultados && !domRuins.length && pendencias.length
          ? `<ul class="em-pendencias">${pendencias.map((p) => `<li><button type="button" class="ag-link-linha" data-ir-campo="${p.campo}">${esc(p.texto)}</button></li>`).join('')}</ul>` : ''}</div>
      </div>
      <div class="duas-colunas">
        <div class="bloco"><h2>Conta no serviço de envio</h2>
          <table><tbody>
            <tr><td>Chave de acesso</td><td class="num">${carimbo(CHAVE, S.conta)}</td></tr>
            <tr><td>Transacional (agenda)</td><td class="num">${contaOk ? selo('Liberado', 'alta') : selo('Indisponível', 'queda')}</td></tr>
            <tr><td>Marketing (campanhas e fluxos)<br><span class="mini">a equipe marca quando o serviço libera</span></td><td class="num">${chave(mktLiberado, 'data-mkt-liberado', mktLiberado ? 'Liberado' : 'Pendente')}</td></tr>
          </tbody></table>
          <p class="mini em-nota">Se a chave parar de funcionar, o problema entra no aviso diário de credenciais, como as outras integrações.</p>
        </div>
        <div class="bloco"><h2>Domínios <small>assinatura e endereço de retorno</small></h2>
          <table><tbody>${linhaDominio('transacional')}${linhaDominio('marketing')}</tbody></table>
          ${S.dominios.consultado ? '' : `<p class="mini em-nota">${MOTIVO_DOM[S.dominios.motivo] || MOTIVO_DOM.sem_resposta}</p>`}
        </div>
      </div>
      <div class="duas-colunas">
        <div class="bloco"><h2>Resultados <small>entregue, voltou, spam, aberto, clicado e descadastro</small></h2>
          <table><tbody>
            <tr><td>Transacional</td><td class="num">${seloResultado(S.resultados.transacional)}</td></tr>
            <tr><td>Marketing</td><td class="num">${seloResultado(S.resultados.marketing)}</td></tr>
          </tbody></table>
          ${S.resultados.transacional === true && S.resultados.marketing === true
            ? '<p class="mini em-nota">Os dois canais estão conectados. Só conecte de novo se o endereço do dash mudar (por exemplo, ao ir da prévia para produção).</p><div class="ag-acoes"><button class="ag-link-linha" type="button" data-conectar>Conectar de novo</button></div>'
            : `<div class="ag-acoes"><button class="btn sec" type="button" data-conectar${contaOk ? '' : ' disabled'}>Conectar resultados</button></div>`}
        </div>
        <div class="bloco"><h2>Mandar teste <small>chega com um link para conferir abertura e clique</small></h2>
          <form class="ag-form" data-teste novalidate>
            <label>Para<input type="email" name="para" placeholder="seu e-mail" autocomplete="email"></label>
            <label>Canal<select name="canal"><option value="transacional">Transacional (envio.)</option><option value="marketing">Marketing (news.)</option></select></label>
            <div class="em-erro" aria-live="polite"></div>
            <div class="ag-acoes"><button class="btn" type="submit"${contaOk ? '' : ' disabled'}>Mandar teste</button></div>
          </form>
        </div>
      </div>
      <div class="bloco"><h2>Últimos testes <small>linha do tempo de cada envio</small></h2>
        ${S.testes.length ? `<div class="tabela-wrap"><table><thead><tr><th>Quando</th><th>Para</th><th>Situação</th><th>Linha do tempo</th></tr></thead><tbody>${S.testes.map(linhaTeste).join('')}</tbody></table></div>`
          : '<p class="aviso">Nenhum teste ainda. Mande um para o seu e-mail e acompanhe aqui.</p>'}
        <div class="ag-acoes"><button class="btn sec" type="button" data-atualizar>Atualizar</button></div>
      </div>
      <form data-config novalidate>
      <div class="bloco"><h2>Remetentes <small>quem aparece como autor do e-mail</small></h2>
        <div class="duas-colunas">${canal('transacional', 'Transacional')}${canal('marketing', 'Marketing')}</div>
      </div>
      <div class="bloco"><h2>Rodapé comum <small>entra no fim de todo e-mail, dos dois canais</small></h2>
        <div class="ag-form">
          <label>Dados da empresa e endereço físico<textarea name="rodape" rows="3" maxlength="1000">${esc(C.rodape)}</textarea></label>
          <p class="mini">No marketing, o link de descadastro de um clique entra sozinho embaixo do rodapé.</p>
        </div>
      </div>
      <div class="em-erro" aria-live="polite"></div>
      <div class="ag-acoes"><button class="btn" type="submit" disabled>Salvar alterações</button><span class="mini" data-cfg-nota>Nada mudou.</span></div>
      </form>`;

    // Remetentes e rodapé: um "Salvar alterações", ativo só quando algo mudou.
    const fc = el.querySelector('form[data-config]');
    const CAMPOS_CFG = ['remetente_transacional_nome', 'remetente_transacional_email', 'resposta_transacional',
      'remetente_marketing_nome', 'remetente_marketing_email', 'resposta_marketing', 'rodape'];
    const mudados = () => Object.fromEntries(CAMPOS_CFG.filter((c) => fc.elements[c].value !== (S.config[c] || '')).map((c) => [c, fc.elements[c].value]));
    const btSalvar = fc.querySelector('[type=submit]');
    const notaCfg = fc.querySelector('[data-cfg-nota]');
    const conferir = () => {
      const n = Object.keys(mudados()).length;
      btSalvar.disabled = !n;
      notaCfg.textContent = n ? `${n} ${n > 1 ? 'campos alterados' : 'campo alterado'}, ainda não salvos.` : 'Nada mudou.';
    };
    fc.addEventListener('input', conferir);
    fc.onsubmit = (ev) => {
      ev.preventDefault();
      const erro = fc.querySelector('.em-erro');
      ocupado(btSalvar, async () => {
        try {
          const r = await ctx.postJson('/api/email/config', { acao: 'salvar', campos: mudados() });
          erro.textContent = '';
          S.config = r.config;
          espelharNoPrototipo(S.config);
          avisar('Configuração salva.');
          desenharConfig(el);
        } catch (e) { erro.textContent = msgErro(e); avisar(msgErro(e), 'erro'); }
      });
    };
    el.querySelectorAll('[data-ir-campo]').forEach((b) => {
      b.onclick = () => { const c = fc.elements[b.dataset.irCampo]; c.scrollIntoView({ behavior: 'smooth', block: 'center' }); c.focus({ preventScroll: true }); };
    });

    // Liberar o marketing pede confirmação (vale para campanhas e fluxos com
    // contatos reais); marcar como pendente é seguro e vai direto.
    const mkt = el.querySelector('[data-mkt-liberado]');
    const gravarMkt = async (ligar) => {
      mkt.disabled = true;
      try {
        const r = await ctx.postJson('/api/email/config', { acao: 'salvar', campos: { marketing_liberado: ligar ? '1' : '0' } });
        S.config = r.config;
        avisar(ligar ? 'Marketing marcado como liberado.' : 'Marketing marcado como pendente.');
        desenharConfig(el);
      } catch (e) { mkt.checked = !ligar; mkt.disabled = false; avisar(msgErro(e), 'erro'); return false; }
      return true;
    };
    mkt.onchange = () => {
      if (!mkt.checked) return gravarMkt(false);
      mkt.checked = false;
      ctx.pedirConfirmacao(mkt.closest('label'), 'Liberar o marketing? Campanhas e fluxos publicados passam a mandar e-mail para os contatos ativos.', () => gravarMkt(true));
    };

    // Conectar aponta os resultados do serviço de envio para ESTE endereço.
    const con = el.querySelector('[data-conectar]');
    con.onclick = () => ctx.pedirConfirmacao(con, `Os resultados passam a chegar em ${location.host}. Se este não for o dash de produção, a produção para de receber entregas, aberturas e cliques. Conectar?`, async () => {
      try {
        await ctx.postJson('/api/email/config', { acao: 'conectar_resultados' });
        avisar('Resultados conectados nos dois canais.');
        await configuracao(el);
      } catch (e) { avisar(msgErro(e), 'erro'); return false; }
      return true;
    });

    const ft = el.querySelector('form[data-teste]');
    ft.onsubmit = (ev) => {
      ev.preventDefault();
      const erro = ft.querySelector('.em-erro');
      ocupado(ft.querySelector('[type=submit]'), async () => {
        try {
          const r = await ctx.postJson('/api/email/config', { acao: 'enviar_teste', para: ft.para.value, canal: ft.canal.value });
          S.testes = r.testes;
          avisar('Teste enviado. A entrega aparece em Últimos testes em alguns segundos.');
          desenharConfig(el);
        } catch (e) {
          erro.textContent = msgErro(e);
          avisar(msgErro(e), 'erro');
          if (e.dados && e.dados.testes) S.testes = e.dados.testes;
        }
      });
    };

    const at = el.querySelector('[data-atualizar]');
    at.onclick = () => ocupado(at, () => configuracao(el));
  }

  // ===========================================================================
  // 379 · E-mails da agenda (app Agenda; ligada ao backend: GET/POST /api/agenda/emails)
  // ===========================================================================
  // Configuração por tipo de reunião. As regras (padrão, validação do modelo,
  // lembretes aceitos) ficam no servidor; aqui só a tela. O "Mandar teste" usa
  // o teste de modelo da 378.
  let tipoAgenda = null;
  let agendaEstado = null;
  let agendaTestes = false; // "Mostrar testes": tipos de teste ficam fora por padrão
  const rotAntes = (min) => (min >= 60 ? `${min / 60} h antes` : `${min} min antes`);

  async function renderAgenda(c) {
    ctx = c;
    fecharGaveta();
    ctx.$('#subtitulo').textContent = 'saem pelo canal transacional (envio.)';
    const el = ctx.$('#agenda-emails-conteudo');
    el.className = 'em';
    el.innerHTML = carregando('Carregando os e-mails da agenda');
    try {
      agendaEstado = await ctx.fetchJson(`/api/agenda/emails?${tipoAgenda ? `tipo=${tipoAgenda}&` : ''}${agendaTestes ? 'testes=1&' : ''}_=${Date.now()}`);
    } catch (e) {
      el.innerHTML = `<div class="aviso falha">Não foi possível carregar os e-mails da agenda (${esc(e.message)}). Tente de novo em instantes.</div>`;
      return;
    }
    desenharAgenda(el);
  }

  function desenharAgenda(el) {
    const S = agendaEstado;
    tipoAgenda = S.tipo_id;
    if (!S.tipos.length) {
      el.innerHTML = S.testes_escondidos
        ? '<p class="aviso">Só há tipos de teste, e eles ficam escondidos. <button type="button" class="btn sec" data-testes>Mostrar testes</button></p>'
        : '<p class="aviso">Nenhum tipo de reunião ainda. Crie um em Agenda › Tipos de reunião e volte aqui.</p>';
      const bv = el.querySelector('[data-testes]');
      if (bv) bv.onclick = () => { agendaTestes = true; renderAgenda(ctx); };
      return;
    }
    const tipo = S.tipos.find((t) => t.id === S.tipo_id);
    const selModelo = (e) => `<select data-modelo aria-label="Modelo de ${esc(e.nome)}">${S.modelos.some((m) => m.id === e.modelo_id) ? '' : '<option value="">(modelo arquivado)</option>'}${S.modelos.map((m) => `<option value="${m.id}"${m.id === e.modelo_id ? ' selected' : ''}>${esc(m.nome)}</option>`).join('')}</select>`;
    const livres = S.antecedencias.filter((min) => !S.emails.some((e) => e.evento === 'lembrete' && e.antes_min === min));
    el.innerHTML = `<div class="em-barra">
        <div class="ag-subvistas em-tipos-pilulas" role="group" aria-label="Tipo de reunião">${S.tipos.map((t) => `<button type="button" class="ag-subvista" data-tipo="${t.id}" aria-pressed="${t.id === S.tipo_id}">${esc(t.nome)}${t.ativo ? '' : ' <span class="mini">(pausado)</span>'}${t.teste ? ' <span class="mini">(teste)</span>' : ''}</button>`).join('')}</div>
        <select class="em-tipos-sel" data-tipo-sel aria-label="Tipo de reunião">${S.tipos.map((t) => `<option value="${t.id}"${t.id === S.tipo_id ? ' selected' : ''}>${esc(t.nome)}${t.ativo ? '' : ' (pausado)'}${t.teste ? ' (teste)' : ''}</option>`).join('')}</select>
        ${S.testes_escondidos || agendaTestes ? `<button type="button" class="ag-subvista" data-testes aria-pressed="${agendaTestes}">${agendaTestes ? 'Esconder testes' : 'Mostrar testes'}</button>` : ''}
      </div>
      ${tipo.comercial ? '' : '<div class="aviso explica">Tipo não comercial: a pessoa recebe confirmação e lembretes normalmente, mas não vira contato de marketing.</div>'}
      <div class="bloco"><h2>E-mails de ${esc(tipo.nome)} <small>remetente: ${esc(S.remetente.nome)} &lt;${esc(S.remetente.email)}&gt;</small></h2>
        <div class="tabela-wrap"><table class="em-agenda-tab"><thead><tr><th>E-mail</th><th>Quando sai</th><th>Modelo</th><th>Situação</th><th></th></tr></thead><tbody>
        ${S.emails.map((e) => `<tr data-id="${e.id}">
          <td><b>${esc(e.nome)}</b></td>
          <td data-rot="Quando sai"><span class="mini">${esc(e.quando)}</span></td>
          <td data-rot="Modelo">${selModelo(e)}</td>
          <td data-rot="Situação">${chave(!!e.ligado, 'data-ligar')}</td>
          <td><div class="ag-acoes ag-acoes--linha em-acoes-agenda"><button class="btn sec" type="button" data-teste>Mandar teste</button>${e.evento === 'lembrete' ? `<button class="ag-icone" type="button" data-tirar aria-label="Tirar lembrete">${ICONE.fechar}</button>` : '<span class="ag-icone em-vaga" aria-hidden="true"></span>'}</div></td>
        </tr>`).join('')}
        </tbody></table></div>
        ${livres.length ? `<div class="em-lembrete-novo">
          <button class="btn sec" type="button" data-abrir-lembrete>+ Lembrete</button>
          <span class="em-lembrete-escolha" hidden><select data-novo-lembrete aria-label="Quanto tempo antes">${livres.map((min) => `<option value="${min}">${rotAntes(min)}</option>`).join('')}</select>
          <button class="btn" type="button" data-criar-lembrete>Adicionar</button><button class="btn sec" type="button" data-cancelar-lembrete>Cancelar</button></span></div>` : ''}
        <ul class="em-regras-agenda mini">
          <li>Reunião cancelada não recebe lembrete.</li>
          <li>Reunião remarcada recebe os lembretes do horário novo, nunca do antigo.</li>
          <li>Lembrete cujo horário já passou não sai (marcou para daqui a 30 minutos: não recebe o de 1 h).</li>
          <li>Mudanças aqui valem para as reuniões marcadas daqui em diante; desligar também segura o que já estava na fila.</li>
          <li>E-mail que não saiu ou voltou aparece no detalhe do agendamento e entra no aviso de integrações.</li>
        </ul>
      </div>`;

    // Grava na hora; `desfazer` (opcional) vira o botão "Desfazer" do aviso.
    const postAgenda = async (corpo, aviso, desfazer) => {
      try {
        agendaEstado = await ctx.postJson('/api/agenda/emails', { ...corpo, testes: agendaTestes });
        avisar(aviso, 'ok', desfazer ? { rotulo: 'Desfazer', fn: desfazer } : null);
      } catch (e) { avisar(msgErro(e), 'erro'); desenharAgenda(el); return false; }
      desenharAgenda(el);
      return true;
    };
    el.querySelectorAll('[data-tipo]').forEach((b) => { b.onclick = () => { tipoAgenda = Number(b.dataset.tipo); renderAgenda(ctx); }; });
    el.querySelector('[data-tipo-sel]').onchange = (ev) => { tipoAgenda = Number(ev.target.value); renderAgenda(ctx); };
    const bt = el.querySelector('[data-testes]');
    if (bt) bt.onclick = () => { agendaTestes = !agendaTestes; renderAgenda(ctx); };
    el.querySelectorAll('tr[data-id]').forEach((tr) => {
      const e = S.emails.find((x) => String(x.id) === tr.dataset.id);
      tr.querySelector('[data-modelo]').onchange = (ev) => {
        const m = S.modelos.find((x) => String(x.id) === ev.target.value);
        const antes = e.modelo_id;
        if (m) postAgenda({ acao: 'salvar', id: e.id, modelo_id: m.id }, `${e.nome}: modelo trocado para "${m.nome}".`,
          antes ? () => postAgenda({ acao: 'salvar', id: e.id, modelo_id: antes }, `${e.nome}: modelo anterior de volta.`) : null);
      };
      tr.querySelector('[data-ligar]').onchange = (ev) => {
        const ligar = ev.target.checked;
        ev.target.disabled = true;
        postAgenda({ acao: 'salvar', id: e.id, ligado: ligar }, `${e.nome} ${ligar ? 'ligado' : 'desligado'} para ${tipo.nome}.`,
          () => postAgenda({ acao: 'salvar', id: e.id, ligado: !ligar }, `${e.nome} ${ligar ? 'desligado' : 'ligado'} de novo.`));
      };
      tr.querySelector('[data-teste]').onclick = () => {
        const m = S.modelos.find((x) => x.id === e.modelo_id);
        if (!m) return avisar('Escolha um modelo antes de mandar o teste.', 'erro');
        pedirTeste({ ...m, canal: 'transacional' });
      };
      const t = tr.querySelector('[data-tirar]');
      // Desfazer o "tirar" recria o lembrete com o mesmo modelo e a mesma situação.
      if (t) t.onclick = () => postAgenda({ acao: 'tirar_lembrete', id: e.id }, `Lembrete de ${rotAntes(e.antes_min)} tirado.`, async () => {
        const tipoId = S.tipo_id;
        if (!(await postAgenda({ acao: 'adicionar_lembrete', tipo_id: tipoId, antes_min: e.antes_min }, 'Lembrete de volta.'))) return;
        const novo = agendaEstado.emails.find((x) => x.evento === 'lembrete' && x.antes_min === e.antes_min);
        if (novo && (novo.modelo_id !== e.modelo_id || !!novo.ligado !== !!e.ligado)) {
          await postAgenda({ acao: 'salvar', id: novo.id, modelo_id: e.modelo_id, ligado: !!e.ligado }, 'Lembrete de volta, com o mesmo modelo.');
        }
      });
    });
    const abrirL = el.querySelector('[data-abrir-lembrete]');
    if (abrirL) {
      const escolha = el.querySelector('.em-lembrete-escolha');
      abrirL.onclick = () => { abrirL.hidden = true; escolha.hidden = false; escolha.querySelector('select').focus(); };
      el.querySelector('[data-cancelar-lembrete]').onclick = () => { escolha.hidden = true; abrirL.hidden = false; abrirL.focus(); };
      const criar = el.querySelector('[data-criar-lembrete]');
      criar.onclick = () => ocupado(criar, () => {
        const min = Number(el.querySelector('[data-novo-lembrete]').value);
        return postAgenda({ acao: 'adicionar_lembrete', tipo_id: S.tipo_id, antes_min: min }, `Lembrete de ${rotAntes(min)} adicionado.`);
      });
    }
  }
})();
