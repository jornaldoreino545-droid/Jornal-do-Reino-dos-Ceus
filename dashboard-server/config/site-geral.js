/* ==========================================================================
   CONFIGURAÇÃO GERAL DO SITE (editável pelo dashboard)
   Tudo que antes ficava fixo no código do site: contatos, redes sociais,
   frase do topo, textos das seções, página de oferta, rodapé, abertura em
   vídeo, tela de carregamento etc.

   Estes são os valores PADRÃO. O que for salvo pelo dashboard fica em
   site-config.json (chave "geral") e é combinado com estes padrões, então
   campos novos aparecem sozinhos com um valor inicial.
   ========================================================================== */

const PADRAO = {
  contato: {
    email: 'jornalreinodoseus@gmail.com',
    telefone: '(11) 98173-9716',
    whatsapp: '5511981739716',
    instagram: 'https://www.instagram.com/jornaldoreino_/',
    facebook: 'https://www.facebook.com/profile.php?id=61584172030496',
    youtube: 'https://www.youtube.com/@tvreino'
  },

  cabecalho: {
    // Palavras entre *asteriscos* ficam em dourado
    frase: 'Uma obra *forte* para abalar o *Brasil* e o *mundo*. A Igreja Reino dos Céus chegou para você!',
    textoBotao: 'Adquira o jornal'
  },

  inicio: {
    mostrar: {
      carrossel: true,
      vantagens: true,
      edicoes: true,
      video: true,
      sobreJornal: true,
      santuarios: true,
      igreja: true,
      equipe: true,
      ajuda: true,
      sites: true,
      loja: true
    },
    vantagens: [
      { icone: 'bxs-file-pdf', titulo: 'Receba em PDF na hora', texto: 'Pagou, baixou: o jornal chega no seu e-mail e no seu celular.' },
      { icone: 'bx-calendar-star', titulo: 'Uma edição por mês', texto: 'Doze edições por ano com fé, testemunhos e direção espiritual.' },
      { icone: 'bx-church', titulo: 'Também nos santuários', texto: 'A versão impressa está disponível nas igrejas Reino dos Céus.' }
    ],
    edicoes: {
      sobretitulo: 'Edições mais recentes',
      titulo: 'Jornais Reino dos Céus',
      subtitulo: 'Doze edições especiais, mês a mês, com mensagens de fé, esperança e direção espiritual.',
      quantidade: 8
    },
    santuarios: {
      sobretitulo: 'Campeões no evangelismo',
      titulo: 'Santuários que levam o *Jornal do Reino*',
      subtitulo: 'Conheça os santuários campeões no evangelismo, que levam a Palavra de Deus de porta em porta com o Jornal do Reino.'
    },
    equipe: {
      sobretitulo: 'Nossa equipe',
      titulo: 'Conheça os responsáveis',
      subtitulo: 'A equipe que leva a informação e a Palavra até você.'
    },
    ajuda: {
      sobretitulo: 'Precisa de ajuda?',
      titulo: 'Perguntas frequentes',
      subtitulo: 'Tire suas dúvidas de forma simples e rápida.',
      contatoTitulo: 'Fale conosco',
      contatoTexto: 'Mande sua mensagem, pedido de oração ou dúvida. Respondemos o quanto antes.'
    },
    loja: {
      sobretitulo: 'Loja do Reino',
      titulo: 'Produtos *em destaque*',
      subtitulo: 'Livros, blusas, calças e moletons para vestir e viver a sua fé.',
      quantidade: 4
    },
    sites: {
      sobretitulo: 'Conheça mais',
      titulo: 'Mais sobre a nossa igreja',
      subtitulo: 'Visite os outros projetos e ministérios da Igreja Reino dos Céus.'
    }
  },

  edicoes: {
    sobretitulo: 'Acervo completo',
    titulo: 'Jornais *Reino dos Céus*',
    subtitulo: 'Edições especiais, mês a mês, com mensagens de fé, esperança e direção espiritual.',
    precoPadrao: 10,
    beneficios: [
      { icone: 'bxs-file-pdf', titulo: 'Receba em PDF no seu e-mail', texto: 'Ao adquirir o Jornal Reino dos Céus, você recebe a versão digital em PDF, prática para ler em qualquer dispositivo — um conteúdo preparado com carinho para fortalecer sua fé.' },
      { icone: 'bx-check-double', titulo: 'Entrega rápida e garantida', texto: 'Assim que o pagamento é confirmado, você vai direto para a página de download e baixa o jornal na hora, sem esperar dias para receber.' },
      { icone: 'bx-church', titulo: 'Disponível também nos santuários', texto: 'Se preferir, adquira o exemplar impresso nas igrejas Reino dos Céus e compartilhe esse momento de fé com sua família e comunidade.' }
    ]
  },

  colunistas: {
    sobretitulo: 'Colunistas do mês',
    titulo: 'Vozes que falam em nome do *Reino*',
    subtitulo: 'Palavras de direção, fé e sabedoria de quem conduz a obra de Deus.'
  },

  noticias: {
    titulo: 'Notícias *do Reino*',
    porPagina: 6
  },

  oferta: {
    sobretitulo: 'Contribua com a obra',
    titulo: 'Seja um provedor do *Monte Maanaim*',
    subtitulo: 'Nos ajude a manter esta obra grandiosa de Deus. Seja um provedor da Casa de Deus!',
    cnpj: '28.135.774/0001-49',
    qrCode: '/Imagem/Link_pra_pagina_principal_da_Wikipedia-PT_em_codigo_QR_b.svg',
    passos: [
      { titulo: 'Abra o app do seu banco', texto: 'Escolha a opção PIX — pagar com QR Code ou com chave.' },
      { titulo: 'Escaneie o QR Code ou use o CNPJ', texto: 'A oferta vai direto para a conta do Altar do Monte Maanaim.' },
      { titulo: 'Confirme a sua oferta', texto: 'Digite o valor que você determinou no seu coração e confirme.' }
    ],
    versiculo: 'Cada um dê conforme determinou em seu coração, não com pesar ou por obrigação, pois Deus ama quem dá com alegria.',
    referencia: '2 Coríntios 9:7'
  },

  rodape: {
    sobre: 'O jornal da Igreja Reino dos Céus é dedicado a fortalecer a fé e manter nossa comunidade conectada através de conteúdos inspiradores e mensagens de esperança.',
    versiculo: 'Para Deus nada é impossível.',
    referencia: 'Lucas 1:37'
  },

  abertura: {
    ativa: true,
    video: '/assets/video/abertura.mp4',
    videoCelular: '/assets/video/abertura-720.mp4',
    marcaEm: 12.3,
    frase: 'A Palavra de Deus em cada página',
    textoBotao: 'Entrar no site'
  },

  loja: {
    ativa: true,
    sobretitulo: 'Loja do Reino',
    titulo: 'Vista a sua *fé*',
    subtitulo: 'Livros, blusas, calças e moletons da Igreja Reino dos Céus. Escolha o seu e fale com a gente pelo WhatsApp.',
    // Número do WhatsApp que recebe os pedidos (55 + DDD + número, só dígitos)
    whatsapp: '553175251828',
    telefoneExibicao: '(31) 7525-1828',
    mensagem: 'Olá! Tenho interesse neste produto da Loja do Reino:',
    textoBotao: 'Quero este produto',
    avisoEntrega: 'Você finaliza o pedido direto com a nossa equipe pelo WhatsApp: tira dúvidas, combina pagamento e entrega ou retirada.',
    categorias: [
      { nome: 'Livros', icone: 'bx-book' },
      { nome: 'Blusas', icone: 'bx-closet' },
      { nome: 'Calças', icone: 'bx-body' },
      { nome: 'Moletons', icone: 'bx-cloud-snow' }
    ]
  },

  carregamento: {
    ativo: true,
    texto: 'Imprimindo sua edição',
    duracao: 2.6
  }
};

function ehObjeto(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

// Junta os valores salvos com os padrões (o que foi salvo tem prioridade)
function combinar(padrao, salvo) {
  if (!ehObjeto(padrao)) return salvo === undefined ? padrao : salvo;
  const out = {};
  Object.keys(padrao).forEach((k) => {
    out[k] = ehObjeto(padrao[k]) ? combinar(padrao[k], ehObjeto(salvo && salvo[k]) ? salvo[k] : {})
      : (salvo && salvo[k] !== undefined ? salvo[k] : padrao[k]);
  });
  // Mantém chaves extras que existam no salvo
  if (ehObjeto(salvo)) Object.keys(salvo).forEach((k) => { if (!(k in out)) out[k] = salvo[k]; });
  return out;
}

module.exports = { PADRAO, combinar };
