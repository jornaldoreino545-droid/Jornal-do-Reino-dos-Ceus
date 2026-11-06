/* ==========================================================================
   JORNAL DO REINO — PÁGINA INICIAL
   Carrega todo o conteúdo editável pelo painel (/dashboard) via API.
   Depende de /assets/js/layout.js (window.JR) e do Swiper.
   ========================================================================== */
(function () {
  'use strict';

  var JR = window.JR;
  var $ = function (id) { return document.getElementById(id); };

  var IMAGEM_VAZIA = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="100%" height="100%" fill="#eef0f6"/></svg>'
  );

  /* ---------------- Formatação dos textos longos ---------------- */

  // Transforma o texto do painel em HTML: linhas curtas sem ponto final viram subtítulos
  // e linhas que começam com aspas viram citação.
  function formatarTextoLongo(texto) {
    var blocos = String(texto || '').replace(/\r\n/g, '\n').split(/\n{2,}/);
    return blocos.map(function (bloco) {
      return bloco.split('\n').map(function (linha) {
        var l = linha.trim();
        if (!l) return '';
        var seguro = JR.escapar(l);
        if (/^["“]/.test(l)) return '<blockquote>' + seguro + '</blockquote>';
        if (l.length < 90 && !/[.!?:;,]$/.test(l)) return '<p><strong>' + seguro + '</strong></p>';
        return '<p>' + seguro + '</p>';
      }).join('');
    }).join('');
  }

  function prepararLerMais() {
    document.querySelectorAll('.ler-mais').forEach(function (botao) {
      var alvo = $(botao.dataset.alvo);
      if (!alvo) return;

      var atualizar = function () {
        var precisa = alvo.scrollHeight > alvo.clientHeight + 40 || !alvo.classList.contains('is-recolhido');
        botao.hidden = !precisa;
      };

      if (!botao.dataset.pronto) {
        botao.dataset.pronto = '1';
        botao.addEventListener('click', function () {
          var recolhido = alvo.classList.toggle('is-recolhido');
          botao.setAttribute('aria-expanded', String(!recolhido));
          botao.firstChild.textContent = recolhido ? 'Ler texto completo ' : 'Mostrar menos ';
          if (recolhido) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
      atualizar();
    });
  }

  /* ---------------- Carrossel principal ---------------- */

  async function carregarCarrossel() {
    var wrapper = $('carrosselWrapper');
    try {
      var itens = JR.ordenar(await JR.buscarJSON('/api/site/carrossel'));
      if (!itens.length) {
        wrapper.closest('.hero').hidden = true;
        return;
      }
      wrapper.innerHTML = itens.map(function (item, i) {
        var img = '<img src="' + JR.escapar(JR.urlImagem(item.imagem, '/uploads/materias/')) + '" alt="Matéria em destaque ' + (i + 1) + '"' +
          (i === 0 ? ' fetchpriority="high"' : ' loading="lazy"') +
          ' onerror="this.onerror=null;this.src=\'' + IMAGEM_VAZIA + '\'">';
        if (item.link) img = '<a href="' + JR.escapar(item.link) + '">' + img + '</a>';
        return '<div class="swiper-slide">' + img + '</div>';
      }).join('');
    } catch (erro) {
      console.error('Carrossel:', erro);
      wrapper.closest('.hero').hidden = true;
      return;
    }

    if (window.Swiper) {
      new Swiper('#heroSwiper', {
        loop: wrapper.children.length > 1,
        speed: 700,
        autoplay: { delay: 4500, disableOnInteraction: false, pauseOnMouseEnter: true },
        pagination: { el: '#heroSwiper .swiper-pagination', clickable: true },
        navigation: { nextEl: '#heroSwiper .swiper-button-next', prevEl: '#heroSwiper .swiper-button-prev' },
        a11y: { prevSlideMessage: 'Slide anterior', nextSlideMessage: 'Próximo slide', paginationBulletMessage: 'Ir para o slide {{index}}' }
      });
    }
  }

  /* ---------------- Edições do jornal ---------------- */

  var quantidadeEdicoes = 8;

  async function carregarJornais() {
    var container = $('jornaisContainer');
    try {
      var dados = await JR.buscarJSON('/api/jornais');
      var todos = JR.ordenarJornais(dados.jornais || dados || []);

      if (!todos.length) {
        container.innerHTML = '<div class="estado"><i class="bx bx-news"></i>Nenhuma edição disponível no momento.</div>';
        return;
      }

      // As 8 edições mais recentes (da mais nova para a mais antiga), atravessando os anos.
      var recentes = todos.slice().sort(function (a, b) {
        if (a.ano !== b.ano) return (b.ano || 0) - (a.ano || 0);
        return JR.MESES.indexOf(b.mes) - JR.MESES.indexOf(a.mes);
      }).slice(0, quantidadeEdicoes);

      $('jornalAnoTitulo').textContent = recentes[0].ano || '';
      container.innerHTML = recentes.map(JR.cartaoEdicao).join('');
      JR.revelar(container);
    } catch (erro) {
      console.error('Jornais:', erro);
      container.innerHTML = '<div class="estado"><i class="bx bx-error-circle"></i>Não foi possível carregar as edições agora.<br><button class="btn btn--azul btn--sm" style="margin-top:16px" onclick="location.reload()">Tentar novamente</button></div>';
    }
  }

  /* ---------------- Vídeo ---------------- */

  async function carregarVideo() {
    var secao = $('video');
    var player = $('videoPlayer');
    var status = $('videoLoading');
    try {
      var video = await JR.buscarJSON('/api/site/video');
      if (!video || video.ativo === false || !video.url) {
        secao.hidden = true;
        return;
      }
      if (video.titulo) {
        var titulo = $('videoTituloContainer');
        titulo.textContent = video.titulo;
        titulo.classList.toggle('titulo-secao--caixa-alta', video.titulo === video.titulo.toUpperCase());
      }
      if (video.subtitulo) $('videoSubtituloContainer').textContent = video.subtitulo;

      player.src = JR.urlImagem(video.url);
      player.hidden = false;
      status.hidden = true;
      player.addEventListener('error', function () {
        player.hidden = true;
        status.hidden = false;
        status.textContent = 'Não foi possível carregar o vídeo.';
      });
    } catch (erro) {
      console.error('Vídeo:', erro);
      secao.hidden = true;
    }
  }

  /* ---------------- Textos "Sobre o jornal" e "Sobre a igreja" ---------------- */

  function aplicarTexto(dados, ids, imagemPadrao) {
    if (!dados) return;
    var cab = $(ids.titulo);
    if (dados.titulo) {
      var h2 = cab.querySelector('h2');
      h2.textContent = dados.titulo;
      h2.classList.toggle('titulo-secao--caixa-alta', dados.titulo === dados.titulo.toUpperCase());
    }
    if (dados.subtitulo) cab.querySelector('p').textContent = dados.subtitulo;
    if (dados.imagem) {
      var img = $(ids.imagem);
      img.onerror = function () { this.onerror = null; this.src = imagemPadrao; };
      img.src = JR.urlImagem(dados.imagem);
    }
    if (dados.conteudo) $(ids.conteudo).innerHTML = formatarTextoLongo(dados.conteudo);
  }

  async function carregarTextos() {
    try {
      var textos = await JR.buscarJSON('/api/site/textos');
      aplicarTexto(textos.sobreJornal, { titulo: 'jornalTituloContainer', imagem: 'jornalImagemContainer', conteudo: 'jornalConteudoContainer' }, '/Imagem/testesimagem.gif');
      aplicarTexto(textos.sobreIgreja, { titulo: 'igrejaTituloContainer', imagem: 'igrejaImagemContainer', conteudo: 'igrejaConteudoContainer' }, '/Imagem/igreja-.png');
    } catch (erro) {
      console.error('Textos:', erro);
    }
    prepararLerMais();
  }

  /* ---------------- Destaques (carrossel médio) ---------------- */

  async function carregarDestaques() {
    var secao = $('destaques');
    var wrapper = $('carrossel-medio-slides');
    try {
      var itens = JR.ordenar(await JR.buscarJSON('/api/site/carrossel-medio'));
      if (!itens.length) {
        secao.hidden = true;
        return;
      }
      wrapper.innerHTML = itens.map(function (item, i) {
        var url = JR.urlImagem(item.imagem, '/uploads/materias/');
        var tag = item.link ? 'a href="' + JR.escapar(item.link) + '"' : 'div';
        return '<div class="swiper-slide"><' + tag + ' class="destaque-item">' +
          '<img src="' + JR.escapar(url) + '" alt="Santuário campeão no evangelismo com o Jornal do Reino — foto ' + (i + 1) + '" loading="lazy">' +
          '</' + (item.link ? 'a' : 'div') + '></div>';
      }).join('');

      if (window.Swiper) {
        new Swiper('#destaquesSwiper', {
          // Fotos de celular deitado (4:3): 3 por vez no computador, 2 no tablet, 1 no celular
          slidesPerView: 1.1,
          spaceBetween: 16,
          speed: 600,
          autoplay: { delay: 3800, disableOnInteraction: false, pauseOnMouseEnter: true },
          pagination: { el: '#destaquesSwiper .swiper-pagination', clickable: true },
          navigation: { nextEl: '#destaquesProximo', prevEl: '#destaquesAnterior' },
          breakpoints: {
            640: { slidesPerView: 2, spaceBetween: 20 },
            1000: { slidesPerView: 3, spaceBetween: 24 }
          }
        });
      }
    } catch (erro) {
      console.error('Destaques:', erro);
      secao.hidden = true;
    }
  }

  /* ---------------- Responsáveis ---------------- */

  async function carregarResponsaveis() {
    var container = $('responsaveisContainer');
    try {
      var lista = JR.ordenar(await JR.buscarJSON('/api/site/responsaveis'));
      if (!lista.length) {
        $('equipe').hidden = true;
        return;
      }
      container.innerHTML = lista.map(function (r) {
        var cargo = r.cargo || 'Produção';
        return '<div class="membro revelar">' +
          '<div class="membro__foto"><img src="' + JR.escapar(JR.urlImagem(r.imagem) || '/Imagem/apostolo.png') + '" alt="' + JR.escapar(r.nome) + '" loading="lazy" onerror="this.onerror=null;this.src=\'/Imagem/apostolo.png\'"></div>' +
          '<h3>' + JR.escapar(r.nome || '') + '</h3>' +
          '<span>' + JR.escapar(cargo.charAt(0).toUpperCase() + cargo.slice(1).toLowerCase()) + '</span>' +
          '</div>';
      }).join('');
      JR.revelar(container);
    } catch (erro) {
      console.error('Responsáveis:', erro);
      $('equipe').hidden = true;
    }
  }

  /* ---------------- Perguntas frequentes ---------------- */

  async function carregarFAQ() {
    var container = $('faqContainer');
    try {
      var lista = JR.ordenar(await JR.buscarJSON('/api/site/faq'));
      container.innerHTML = lista.map(function (f, i) {
        return '<details class="revelar"' + (i === 0 ? ' open' : '') + '>' +
          '<summary><span class="faq__numero">' + (i + 1) + '</span>' + JR.escapar(f.pergunta || '') + '</summary>' +
          '<div class="faq__resposta">' + JR.escapar(f.resposta || '') + '</div>' +
          '</details>';
      }).join('');
      JR.revelar(container);
    } catch (erro) {
      console.error('FAQ:', erro);
    }
  }

  /* ---------------- Sites da igreja ---------------- */

  var SITES_PADRAO = [
    { nome: 'Rede do Coração', url: 'https://rededocoracao.com.br/', imagem: '/Imagem/rede do coração.webp' },
    { nome: 'Oração da Madrugada', url: 'https://www.oracaodamadrugada.com.br/', imagem: '/Imagem/oração.webp' },
    { nome: 'Santuário Reino dos Céus', url: 'https://santuarioreinodosceus.com.br/', imagem: '/Imagem/download.jpg' },
    { nome: 'Turminha da Madrinha', url: 'https://turminhadamadrinha.com.br/', imagem: '/Imagem/loja da turminha.webp' }
  ];

  async function carregarSites() {
    var lista = SITES_PADRAO;
    try {
      var api = JR.ordenar(await JR.buscarJSON('/api/site/sites-igreja'));
      if (api.length) lista = api;
    } catch (erro) {
      console.error('Sites:', erro);
    }
    var container = $('sitesContainer');
    container.innerHTML = lista.map(function (s) {
      return '<a class="site-card revelar" href="' + JR.escapar(s.url) + '" target="_blank" rel="noopener">' +
        '<div class="site-card__img"><img src="' + JR.escapar(JR.urlImagem(s.imagem)) + '" alt="' + JR.escapar(s.nome) + '" loading="lazy"></div>' +
        '<div class="site-card__info"><span>' + JR.escapar(s.nome || 'Visitar') + '</span><i class="bx bx-link-external"></i></div>' +
        '</a>';
    }).join('');
    JR.revelar(container);
  }

  /* ---------------- Contato ---------------- */

  function prepararContato() {
    var c = JR.contato;
    $('contatoAlternativas').innerHTML =
      '<a href="' + c.whatsapp + '" target="_blank" rel="noopener"><i class="bx bxl-whatsapp"></i> WhatsApp</a>' +
      '<a href="mailto:' + c.email + '"><i class="bx bx-envelope"></i> E-mail</a>' +
      '<a href="tel:' + c.telefoneLink + '"><i class="bx bx-phone"></i> ' + c.telefone + '</a>';

    var form = $('formContato');
    if (form.dataset.pronto) return;
    form.dataset.pronto = '1';
    form.addEventListener('submit', function () {
      var botao = form.querySelector('button[type="submit"]');
      botao.disabled = true;
      botao.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Enviando…';
    });
  }

  /* ---------------- Banner modal (uma vez por visita) ---------------- */

  async function carregarBannerModal() {
    var overlay = $('overlay');
    var fechar = function () { overlay.classList.remove('is-open'); };

    $('closeModal').addEventListener('click', fechar);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) fechar(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fechar(); });

    try {
      if (sessionStorage.getItem('jr-banner-visto')) return;
      var banner = await JR.buscarJSON('/api/site/banner-modal');
      if (!banner || banner.ativo === false || !banner.imagem) return;

      var img = $('bannerModalImagem');
      var link = $('bannerModalLink');
      if (banner.link) {
        // Links salvos com "localhost" apontam para o próprio site
        link.href = banner.link.replace(/^https?:\/\/localhost(:\d+)?/, '');
      } else {
        link.removeAttribute('href');
      }

      img.onload = function () {
        // Só depois da abertura em vídeo (se ela estiver passando)
        JR.aposAbertura(function () {
          setTimeout(function () {
            overlay.classList.add('is-open');
            sessionStorage.setItem('jr-banner-visto', '1');
          }, 1200);
        });
      };
      img.src = JR.urlImagem(banner.imagem);
    } catch (erro) {
      console.error('Banner:', erro);
    }
  }

  /* ---------------- Loja do Reino (produtos em destaque) ---------------- */

  async function carregarLoja() {
    var secao = $('loja-destaques');
    if (!secao || !window.Loja || secao.dataset.desligada) return;
    try {
      var cfg = await JR.obterConfig();
      if (cfg && cfg.loja && cfg.loja.ativa === false) return;
      var qtd = parseInt(JR.valor(cfg, 'inicio.loja.quantidade'), 10) || 4;
      var produtos = await Loja.buscarProdutos();
      // Destaques primeiro; esgotados por último
      produtos.sort(function (a, b) {
        return (b.destaque === true) - (a.destaque === true) || (a.esgotado === true) - (b.esgotado === true);
      });
      var lista = produtos.slice(0, qtd);
      if (!lista.length) return;
      $('lojaGrade').innerHTML = lista.map(Loja.cartao).join('');
      secao.hidden = false;
      JR.revelar(secao);
    } catch (erro) {
      console.error('Loja:', erro);
    }
  }

  /* ---------------- Configuração do dashboard (textos, seções, vantagens) ---------------- */

  var SECOES = {
    carrossel: '.hero', vantagens: '.vantagens', edicoes: '#edicoes', video: '#video',
    sobreJornal: '#sobre-jornal', santuarios: '#destaques', igreja: '#igreja',
    equipe: '#equipe', ajuda: '#contato', sites: '#sites', loja: '#loja-destaques'
  };

  function aplicarConfigInicio(cfg) {
    if (!cfg || !cfg.inicio) return;
    var ini = cfg.inicio;

    // Seções ligadas/desligadas no dashboard
    var mostrar = ini.mostrar || {};
    Object.keys(SECOES).forEach(function (k) {
      var el = document.querySelector(SECOES[k]);
      if (el && mostrar[k] === false) { el.hidden = true; el.dataset.desligada = '1'; }
    });

    // Vantagens (faixa abaixo do carrossel)
    if (Array.isArray(ini.vantagens) && ini.vantagens.length) {
      $('vantagensGrade').innerHTML = ini.vantagens.map(function (v) {
        return '<div class="vantagem">' +
          '<span class="vantagem__icone"><i class="bx ' + JR.escapar(v.icone || 'bx-star') + '"></i></span>' +
          '<div><h3>' + JR.escapar(v.titulo || '') + '</h3><p>' + JR.escapar(v.texto || '') + '</p></div>' +
        '</div>';
      }).join('');
      $('vantagensGrade').style.setProperty('--colunas', Math.min(ini.vantagens.length, 4));
    }

    // Seção de edições: título, subtítulo e quantidade
    var ed = ini.edicoes || {};
    if (ed.quantidade) quantidadeEdicoes = Math.max(1, Math.min(24, parseInt(ed.quantidade, 10) || 8));
    var cabEd = document.querySelector('#edicoes .cabecalho-secao');
    if (ed.titulo) {
      var ano = $('jornalAnoTitulo') ? $('jornalAnoTitulo').textContent : '';
      cabEd.querySelector('h2').innerHTML = JR.destacar(ed.titulo) + ' <span class="destaque" id="jornalAnoTitulo">' + JR.escapar(ano) + '</span>';
    }
    if (ed.sobretitulo !== undefined) $('edicoesSobretitulo').textContent = ed.sobretitulo;
    if (ed.subtitulo !== undefined) cabEd.querySelector('.subtitulo-secao').textContent = ed.subtitulo;

    // Cartão "Fale conosco"
    var aj = ini.ajuda || {};
    if (aj.contatoTitulo) $('contatoTitulo').textContent = aj.contatoTitulo;
    if (aj.contatoTexto !== undefined) $('contatoTexto').textContent = aj.contatoTexto;

    // Formulário de contato (chave do StaticForms e página de obrigado)
    var f = cfg.formulario || {};
    var form = $('formContato');
    if (f.apiKey) form.querySelector('[name="apiKey"]').value = f.apiKey;
    if (f.redirectTo) form.querySelector('[name="redirectTo"]').value = f.redirectTo;
    if (f.ativo === false) form.closest('.contato-card').hidden = true;

    prepararContato();
  }

  /* ---------------- Início ---------------- */

  prepararContato();
  prepararLerMais();

  // A configuração chega antes de montar as edições (para respeitar a quantidade)
  var configPronta = JR.obterConfig().then(function (cfg) {
    try { aplicarConfigInicio(cfg); } catch (e) { console.error('Config início:', e); }
  });

  carregarCarrossel();
  configPronta.then(carregarJornais);
  configPronta.then(carregarLoja);
  carregarVideo();
  carregarTextos();
  carregarDestaques();
  carregarResponsaveis();
  carregarFAQ();
  carregarSites();
  carregarBannerModal();
})();
