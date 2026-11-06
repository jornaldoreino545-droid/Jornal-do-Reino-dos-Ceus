/* ==========================================================================
   JORNAL DO REINO — LAYOUT COMPARTILHADO
   Monta cabeçalho, rodapé, menu mobile, preloader, "voltar ao topo"
   e animações de entrada. Também expõe utilitários em window.JR.

   Como usar em uma página:
     <div id="site-header"></div>  ...conteúdo...  <div id="site-footer"></div>
     <script src="/assets/js/layout.js"></script>
   ========================================================================== */
(function () {
  'use strict';

  var CONTATO = {
    email: 'jornalreinodoseus@gmail.com',
    telefone: '(11) 98173-9716',
    telefoneLink: '+5511981739716',
    whatsapp: 'https://wa.me/5511981739716',
    instagram: 'https://www.instagram.com/jornaldoreino_/',
    facebook: 'https://www.facebook.com/profile.php?id=61584172030496',
    youtube: 'https://www.youtube.com/@tvreino'
  };

  /* ---------------- Configuração vinda do dashboard ----------------
     /api/site/config-geral. Uma cópia fica guardada no navegador (localStorage)
     para a página já abrir com os textos certos; a versão nova chega em seguida. */
  var CHAVE_CONFIG = 'jr-config';
  var configCache = null;
  try { configCache = JSON.parse(localStorage.getItem(CHAVE_CONFIG)) || null; } catch (e) { configCache = null; }

  var configPromise = fetch('/api/site/config-geral', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      if (!cfg) return configCache;
      try { localStorage.setItem(CHAVE_CONFIG, JSON.stringify(cfg)); } catch (e) { /* sem espaço */ }
      return cfg;
    })
    .catch(function () { return configCache; });

  function obterConfig() { return configPromise; }

  function valor(obj, caminho) {
    return String(caminho).split('.').reduce(function (o, k) { return o && o[k] !== undefined ? o[k] : undefined; }, obj);
  }

  var MENU = [
    { href: '/', rotulo: 'Início', ativo: ['/', '/index.html'] },
    { href: '/pag-saibaMais.html', rotulo: 'Edições', ativo: ['/pag-saibaMais.html', '/jornal-compra.html'] },
    { href: '/loja.html', rotulo: 'Loja', ativo: ['/loja.html', '/produto.html'] },
    { href: '/Noticias/index.html', rotulo: 'Notícias', ativo: ['/Noticias/', '/Noticias/index.html', '/Noticias/noticia.html', '/pag-noticias.html'] },
    { href: '/pag.colunista.html', rotulo: 'Colunistas', ativo: ['/pag.colunista.html'] },
    { href: '/pag.oferta.html', rotulo: 'Oferta', ativo: ['/pag.oferta.html'] },
    { href: 'https://www.oracaodamadrugada.com.br/', rotulo: 'Oração', externo: true }
  ];

  /* ---------------- Utilitários ---------------- */

  function escapar(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Palavras entre *asteriscos* ficam destacadas (dourado/vermelho conforme o lugar)
  function destacar(texto, tag) {
    tag = tag || 'span class="destaque"';
    var fecha = tag.split(' ')[0];
    return escapar(texto).replace(/\*([^*]+)\*/g, '<' + tag + '>$1</' + fecha + '>');
  }

  function soDigitos(t) { return String(t || '').replace(/\D/g, ''); }

  // Normaliza caminhos de imagem vindos do painel (./Imagem/x.png, Imagem/x.png, /uploads/..., http...)
  function urlImagem(url, pastaPadrao) {
    if (!url) return '';
    url = String(url).trim();
    if (/^(https?:)?\/\//.test(url) || url.indexOf('data:') === 0) return url;
    if (url.indexOf('./') === 0) url = url.substring(2);
    if (pastaPadrao && url.charAt(0) !== '/' && url.indexOf('/') === -1) url = pastaPadrao + url;
    if (url.charAt(0) !== '/') url = '/' + url;
    try { url = decodeURI(url); } catch (e) { /* já está decodificada */ }
    return encodeURI(url);
  }

  function textoParaHtml(texto) {
    return escapar(texto)
      .replace(/\r\n/g, '\n')
      .split(/\n{2,}/)
      .map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; })
      .join('');
  }

  function ordenar(lista) {
    return (lista || [])
      .filter(function (i) { return i && i.ativo !== false; })
      .sort(function (a, b) { return (a.ordem || 999) - (b.ordem || 999); });
  }

  async function buscarJSON(url) {
    var resp = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!resp.ok) throw new Error('HTTP ' + resp.status + ' em ' + url);
    return resp.json();
  }

  var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  var CAPAS_LOCAIS = {
    Fevereiro: '/JORNAIS CAPAS/JORNAL DE FEVEREIRO.png',
    Abril: '/JORNAIS CAPAS/JORNAL DE ABRIL (1).png',
    Junho: '/JORNAIS CAPAS/JOENAL DE JUNHO.png'
  };

  function capaDoJornal(jornal) {
    if (jornal.capa) return urlImagem(jornal.capa);
    var local = CAPAS_LOCAIS[jornal.mes] || ('/JORNAIS CAPAS/JORNAL DE ' + String(jornal.mes || '').toUpperCase() + '.png');
    return encodeURI(local);
  }

  function ordenarJornais(lista) {
    return (lista || [])
      .filter(function (j) { return j && j.ativo !== false; })
      .sort(function (a, b) {
        if (a.ano !== b.ano) return (b.ano || 0) - (a.ano || 0);
        if (a.ordem && b.ordem && a.ordem !== b.ordem) return a.ordem - b.ordem;
        return MESES.indexOf(a.mes) - MESES.indexOf(b.mes);
      });
  }

  function resumir(texto, limite) {
    texto = String(texto || '').replace(/\s+/g, ' ').trim();
    return texto.length > limite ? texto.substring(0, limite).replace(/\s+\S*$/, '') + '…' : texto;
  }

  // Cartão de edição usado na página inicial e na página de edições
  function cartaoEdicao(jornal) {
    var link = jornal.linkCompra ? jornal.linkCompra : '/jornal-compra.html?id=' + encodeURIComponent(jornal.id);
    var criado = jornal.dataCriacao ? new Date(jornal.dataCriacao) : null;
    var novo = criado && (Date.now() - criado.getTime()) / 86400000 <= 30;
    var fallback = encodeURI('/JORNAIS CAPAS/JORNAL DE ' + String(jornal.mes || '').toUpperCase() + '.png');

    return '' +
      '<article class="edicao revelar">' +
        '<a class="edicao__capa" href="' + escapar(link) + '" aria-label="Ver ' + escapar(jornal.nome) + '">' +
          '<img src="' + escapar(capaDoJornal(jornal)) + '" alt="Capa do ' + escapar(jornal.nome) + '" loading="lazy" ' +
            'onerror="if(!this.dataset.f){this.dataset.f=1;this.src=\'' + fallback + '\'}">' +
          '<div class="edicao__selos">' +
            (novo ? '<span class="selo selo--novo">Novo</span>' : '') +
            '<span class="selo selo--mes">' + escapar(jornal.mes || '') + '</span>' +
          '</div>' +
          (jornal.descricao ? '<p class="edicao__resumo">' + escapar(resumir(jornal.descricao, 140)) + '</p>' : '') +
        '</a>' +
        '<div class="edicao__corpo">' +
          '<span class="edicao__ano">Edição ' + escapar(jornal.ano || '') + '</span>' +
          '<h3 class="edicao__titulo">' + escapar(jornal.nome) + '</h3>' +
          '<div class="edicao__meta">' +
            '<span><i class="bx bxs-file-pdf"></i> PDF digital</span>' +
            '<span class="ok"><i class="bx bx-check-circle"></i> Disponível</span>' +
          '</div>' +
          '<a class="btn btn--gold btn--bloco edicao__acao" href="' + escapar(link) + '"><i class="bx bx-book-open"></i> Adquira o seu</a>' +
        '</div>' +
      '</article>';
  }

  /* ---------------- Cabeçalho e rodapé ---------------- */

  function caminhoAtual() {
    var p = window.location.pathname;
    try { p = decodeURI(p); } catch (e) { /* mantém */ }
    return p;
  }

  function montarCabecalho() {
    var alvo = document.getElementById('site-header');
    if (!alvo) return;

    var atual = caminhoAtual();
    var links = MENU.map(function (item) {
      var ativo = item.ativo && item.ativo.indexOf(atual) !== -1;
      return '<li><a href="' + item.href + '"' +
        (ativo ? ' class="is-active" aria-current="page"' : '') +
        (item.externo ? ' target="_blank" rel="noopener"' : '') +
        '>' + item.rotulo + '</a></li>';
    }).join('');

    var html = '' +
      '<a class="sr-only" href="#conteudo">Pular para o conteúdo</a>' +
      '<div class="topbar">' +
        '<div class="container topbar__inner">' +
          '<p class="topbar__msg" data-jr="frase">Uma obra <strong>forte</strong> para abalar o <strong>Brasil</strong> e o <strong>mundo</strong>. A Igreja Reino dos Céus chegou para você!</p>' +
        '</div>' +
      '</div>' +
      '<a class="brand-banner" href="/" aria-label="Jornal do Reino — página inicial">' +
        '<picture>' +
          '<source media="(max-width: 700px)" srcset="/Imagem/celular-alta-qualidade.png">' +
          '<img src="/Imagem/capa-alta-qualidade.png" alt="Jornal do Reino — Igreja Reino dos Céus, a igreja da família" width="3840" height="600">' +
        '</picture>' +
      '</a>' +
      '<nav class="navbar" id="navbar" aria-label="Menu principal">' +
        '<div class="container navbar__inner">' +
          '<div class="navbar__social" aria-label="Redes sociais">' +
            '<a href="' + CONTATO.whatsapp + '" target="_blank" rel="noopener" aria-label="WhatsApp" class="s-whats" data-rede="whatsapp"><i class="bx bxl-whatsapp"></i></a>' +
            '<a href="' + CONTATO.facebook + '" target="_blank" rel="noopener" aria-label="Facebook" class="s-face" data-rede="facebook"><i class="bx bxl-facebook"></i></a>' +
            '<a href="' + CONTATO.instagram + '" target="_blank" rel="noopener" aria-label="Instagram" class="s-insta" data-rede="instagram"><i class="bx bxl-instagram"></i></a>' +
            '<a href="' + CONTATO.youtube + '" target="_blank" rel="noopener" aria-label="YouTube" class="s-yt" data-rede="youtube"><i class="bx bxl-youtube"></i></a>' +
          '</div>' +
          '<button class="navbar__toggle" id="navToggle" aria-label="Abrir menu" aria-expanded="false" aria-controls="navLinks"><i class="bx bx-menu"></i></button>' +
          '<ul class="navbar__links" id="navLinks">' + links +
            '<li class="navbar__cta-mobile"><a class="btn btn--gold btn--bloco" href="/pag-saibaMais.html" data-jr="textoBotao">Adquira o jornal</a></li>' +
            '<li class="navbar__indicador" aria-hidden="true"></li>' +
          '</ul>' +
          '<a class="btn btn--gold btn--sm navbar__cta" href="/pag-saibaMais.html" data-jr="textoBotao">Adquira o jornal</a>' +
        '</div>' +
      '</nav>';

    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    var frag = document.createDocumentFragment();
    while (tmp.firstChild) frag.appendChild(tmp.firstChild);
    alvo.replaceWith(frag);

    // Menu mobile
    var nav = document.getElementById('navbar');
    var toggle = document.getElementById('navToggle');
    toggle.addEventListener('click', function () {
      var aberto = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', aberto);
      toggle.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
      toggle.innerHTML = aberto ? '<i class="bx bx-x"></i>' : '<i class="bx bx-menu"></i>';
    });
    nav.querySelectorAll('.navbar__links a').forEach(function (a) {
      a.addEventListener('click', function () {
        if (nav.classList.contains('is-open')) toggle.click();
      });
    });

    prepararIndicador();
  }

  /* Pílula dourada que desliza até o link sob o mouse e volta para a página atual */
  function prepararIndicador() {
    var lista = document.getElementById('navLinks');
    var pilula = lista.querySelector('.navbar__indicador');
    var links = Array.prototype.slice.call(lista.querySelectorAll('li:not(.navbar__cta-mobile):not(.navbar__indicador) > a'));
    var ativo = lista.querySelector('a.is-active');

    function mover(link, instantaneo) {
      links.forEach(function (l) { l.classList.toggle('is-sob', l === link); });
      if (!link) {
        pilula.style.opacity = '0';
        return;
      }
      if (instantaneo) pilula.style.transition = 'none';
      var x = link.getBoundingClientRect().left - lista.getBoundingClientRect().left - lista.clientLeft;
      pilula.style.width = link.offsetWidth + 'px';
      pilula.style.transform = 'translate(' + x + 'px, -50%)';
      pilula.style.opacity = '1';
      if (instantaneo) {
        void pilula.offsetWidth;
        pilula.style.transition = '';
      }
    }

    links.forEach(function (l) {
      l.addEventListener('mouseenter', function () { mover(l); });
      l.addEventListener('focus', function () { mover(l); });
    });
    lista.addEventListener('mouseleave', function () { mover(ativo); });
    lista.addEventListener('focusout', function (e) {
      if (!lista.contains(e.relatedTarget)) mover(ativo);
    });
    window.addEventListener('resize', function () { mover(ativo, true); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { mover(ativo, true); });
    mover(ativo, true);
  }

  function montarRodape() {
    var alvo = document.getElementById('site-footer');
    if (!alvo) return;
    var ano = new Date().getFullYear();

    alvo.outerHTML = '' +
      '<footer class="rodape">' +
        '<div class="container rodape__grade">' +
          '<div>' +
            '<a class="rodape__marca" href="/">' +
              '<img src="/Imagem/logo%20jornal.png" alt="" width="64" height="52">' +
              '<span>Jornal do<br><em>Reino</em></span>' +
            '</a>' +
            '<p data-jr="rodapeSobre">O jornal da Igreja Reino dos Céus é dedicado a fortalecer a fé e manter nossa comunidade conectada através de conteúdos inspiradores e mensagens de esperança.</p>' +
            '<div class="rodape__social">' +
              '<a href="' + CONTATO.instagram + '" target="_blank" rel="noopener" aria-label="Instagram" data-rede="instagram"><i class="bx bxl-instagram"></i></a>' +
              '<a href="' + CONTATO.youtube + '" target="_blank" rel="noopener" aria-label="YouTube" data-rede="youtube"><i class="bx bxl-youtube"></i></a>' +
              '<a href="' + CONTATO.facebook + '" target="_blank" rel="noopener" aria-label="Facebook" data-rede="facebook"><i class="bx bxl-facebook"></i></a>' +
              '<a href="' + CONTATO.whatsapp + '" target="_blank" rel="noopener" aria-label="WhatsApp" data-rede="whatsapp"><i class="bx bxl-whatsapp"></i></a>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<h3>Navegação</h3>' +
            '<ul class="rodape__links">' +
              '<li><a href="/">Início</a></li>' +
              '<li><a href="/pag-saibaMais.html">Edições do jornal</a></li>' +
              '<li><a href="/Noticias/index.html">Notícias</a></li>' +
              '<li><a href="/pag.colunista.html">Colunistas</a></li>' +
              '<li><a href="/pag.oferta.html">Oferta</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<h3>Contato</h3>' +
            '<ul class="rodape__contato">' +
              '<li><a href="mailto:' + CONTATO.email + '" data-jr="email"><i class="bx bx-envelope"></i> <span>' + CONTATO.email + '</span></a></li>' +
              '<li><a href="tel:' + CONTATO.telefoneLink + '" data-jr="telefone"><i class="bx bx-phone"></i> <span>' + CONTATO.telefone + '</span></a></li>' +
              '<li><a href="' + CONTATO.whatsapp + '" target="_blank" rel="noopener" data-rede="whatsapp"><i class="bx bxl-whatsapp"></i> Fale no WhatsApp</a></li>' +
            '</ul>' +
          '</div>' +
          '<div>' +
            '<h3>Igreja Reino dos Céus</h3>' +
            '<ul class="rodape__links">' +
              '<li><a href="https://santuarioreinodosceus.com.br/" target="_blank" rel="noopener">Santuário Reino dos Céus</a></li>' +
              '<li><a href="https://www.oracaodamadrugada.com.br/" target="_blank" rel="noopener">Oração da Madrugada</a></li>' +
              '<li><a href="https://rededocoracao.com.br/" target="_blank" rel="noopener">Rede do Coração</a></li>' +
              '<li><a href="https://turminhadamadrinha.com.br/" target="_blank" rel="noopener">Turminha da Madrinha</a></li>' +
            '</ul>' +
          '</div>' +
        '</div>' +
        '<div class="rodape__base">' +
          '<div class="container">' +
            '<small>&copy; ' + ano + ' Jornal da Igreja Reino dos Céus. Todos os direitos reservados.</small>' +
            '<span class="rodape__versiculo" data-jr="versiculo">“Para Deus nada é impossível.” — Lucas 1:37</span>' +
          '</div>' +
        '</div>' +
      '</footer>' +
      '<button class="voltar-topo" id="voltarTopo" aria-label="Voltar ao topo"><i class="bx bx-chevron-up"></i></button>';

    var btn = document.getElementById('voltarTopo');
    btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  }

  /* ---------------- Aplicar configuração do dashboard ---------------- */

  function aplicarConfigLayout(cfg) {
    if (!cfg) return;
    var c = cfg.contato || {};
    if (c.email) CONTATO.email = c.email;
    if (c.telefone) {
      CONTATO.telefone = c.telefone;
      var tel = soDigitos(c.telefone);
      CONTATO.telefoneLink = '+' + (tel.length <= 11 ? '55' + tel : tel);
    }
    if (c.whatsapp) CONTATO.whatsapp = 'https://wa.me/' + soDigitos(c.whatsapp);
    ['instagram', 'facebook', 'youtube'].forEach(function (r) { if (c[r] !== undefined) CONTATO[r] = c[r]; });

    document.querySelectorAll('[data-rede]').forEach(function (a) {
      var url = CONTATO[a.dataset.rede];
      if (url) { a.href = url; a.hidden = false; } else { a.hidden = true; }
    });
    document.querySelectorAll('[data-jr="email"]').forEach(function (a) {
      a.href = 'mailto:' + CONTATO.email;
      a.querySelector('span').textContent = CONTATO.email;
    });
    document.querySelectorAll('[data-jr="telefone"]').forEach(function (a) {
      a.href = 'tel:' + CONTATO.telefoneLink;
      a.querySelector('span').textContent = CONTATO.telefone;
    });

    var cab = cfg.cabecalho || {};
    if (cab.frase) document.querySelectorAll('[data-jr="frase"]').forEach(function (el) { el.innerHTML = destacar(cab.frase, 'strong'); });
    if (cab.textoBotao) document.querySelectorAll('[data-jr="textoBotao"]').forEach(function (el) { el.textContent = cab.textoBotao; });

    var rod = cfg.rodape || {};
    if (rod.sobre) document.querySelectorAll('[data-jr="rodapeSobre"]').forEach(function (el) { el.textContent = rod.sobre; });
    document.querySelectorAll('[data-jr="versiculo"]').forEach(function (el) {
      el.hidden = !rod.versiculo;
      if (rod.versiculo) el.textContent = '\u201c' + rod.versiculo + '\u201d' + (rod.referencia ? ' \u2014 ' + rod.referencia : '');
    });

    // Loja fechada no dashboard: esconde o link do menu
    var lojaFechada = cfg.loja && cfg.loja.ativa === false;
    document.querySelectorAll('.navbar__links a[href="/loja.html"]').forEach(function (a) { a.parentElement.hidden = lojaFechada; });

    aplicarCabecalhos(cfg);
    window.dispatchEvent(new Event('resize')); // reposiciona a pílula do menu
  }

  // Blocos com data-cfg="caminho" (ex.: "inicio.equipe") recebem sobretítulo, título e subtítulo
  function aplicarCabecalhos(cfg, raiz) {
    if (!cfg) return;
    (raiz || document).querySelectorAll('[data-cfg]').forEach(function (bloco) {
      var dados = valor(cfg, bloco.dataset.cfg);
      if (!dados) return;
      var sobre = bloco.querySelector('.sobretitulo');
      var titulo = bloco.querySelector('h1, h2');
      var sub = bloco.querySelector('.subtitulo-secao, h1 ~ p, h2 ~ p');
      if (sobre && dados.sobretitulo !== undefined) { sobre.textContent = dados.sobretitulo; sobre.hidden = !dados.sobretitulo; }
      if (titulo && dados.titulo) titulo.innerHTML = destacar(dados.titulo);
      if (sub && dados.subtitulo !== undefined) { sub.textContent = dados.subtitulo; sub.hidden = !dados.subtitulo; }
    });
  }

  /* ---------------- Comportamentos ---------------- */

  function aoRolar() {
    var nav = document.getElementById('navbar');
    var btn = document.getElementById('voltarTopo');
    var y = window.scrollY;
    if (nav) nav.classList.toggle('is-scrolled', nav.getBoundingClientRect().top <= 0 && y > 50);
    if (btn) btn.classList.toggle('is-visible', y > 700);
  }

  var observador = null;
  function revelar(raiz) {
    var itens = (raiz || document).querySelectorAll('.revelar:not(.is-visible)');
    if (!('IntersectionObserver' in window)) {
      itens.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }
    if (!observador) {
      observador = new IntersectionObserver(function (entradas) {
        entradas.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            observador.unobserve(e.target);
          }
        });
      }, { rootMargin: '0px 0px -60px 0px', threshold: 0.08 });
    }
    itens.forEach(function (el, i) {
      if (!el.style.transitionDelay && el.parentElement && el.parentElement.children.length > 1) {
        var idx = Array.prototype.indexOf.call(el.parentElement.children, el);
        el.style.transitionDelay = Math.min(idx % 6, 5) * 70 + 'ms';
      }
      observador.observe(el);
    });
  }

  /* ---------------- Tela de carregamento: jornal sendo impresso ----------------
     Aparece a cada troca de página (quando a abertura em vídeo não está tocando).
     O script no <head> de cada página coloca a classe "com-carregando" no <html>,
     que cobre a página até a animação ser montada aqui. */

  function linhasFolha(qtd, inicio, passo, larguras) {
    var html = '';
    for (var k = 0; k < qtd; k++) {
      html += '<i style="--d:' + (inicio + k * passo).toFixed(2) + 's;--w:' + larguras[k % larguras.length] + '%"></i>';
    }
    return html;
  }

  function montarPreloader() {
    if (document.getElementById('preloader')) return;
    var colunas = '';
    for (var c = 0; c < 3; c++) {
      colunas += '<div class="folha__col">' + linhasFolha(11, 1.3 + c * 0.08, 0.055, [100, 94, 100, 88, 100, 96, 100, 70, 100, 92, 55]) + '</div>';
    }
    var el = document.createElement('div');
    el.className = 'preloader';
    el.id = 'preloader';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML =
      '<div class="impressao">' +
        '<div class="folha">' +
          '<div class="folha__rolo"></div>' +
          '<div class="folha__topo"><img src="/Imagem/logo%20jornal.png" alt=""><span class="folha__nome">Jornal do <b>Reino</b></span></div>' +
          '<div class="folha__data"><i style="--d:.45s;--w:30%"></i><i style="--d:.5s;--w:22%"></i></div>' +
          '<div class="folha__manchete"><i style="--d:.6s;--w:100%"></i><i style="--d:.7s;--w:72%"></i></div>' +
          '<div class="folha__corpo"><div class="folha__foto"><span></span></div>' +
            '<div class="folha__col">' + linhasFolha(7, 0.95, 0.07, [100, 92, 100, 85, 100, 96, 70]) + '</div></div>' +
          '<div class="folha__cols">' + colunas + '</div>' +
          '<span class="folha__carimbo">Edição pronta</span>' +
        '</div>' +
        '<p class="impressao__texto">' + escapar(valor(configCache, 'carregamento.texto') || 'Imprimindo sua edição') + '</p>' +
        '<div class="preloader__barra"></div>' +
      '</div>';
    document.body.insertBefore(el, document.body.firstChild);
  }

  function esconderPreloader() {
    document.documentElement.classList.remove('com-carregando');
    var pre = document.getElementById('preloader');
    if (!pre) return;
    pre.classList.add('is-hidden');
    setTimeout(function () { pre.remove(); }, 600);
  }

  /* ---------------- Abertura em vídeo ----------------
     Toca sempre que a página é carregada ou atualizada (F5) e quando o visitante
     chega de fora do site. Não toca ao navegar entre páginas do próprio site.
     Quem decide é o pequeno script no <head> de cada página, que coloca a classe
     "com-abertura" no <html> antes de a página aparecer. */

  var ABERTURA = {
    video: '/assets/video/abertura.mp4',
    videoLeve: '/assets/video/abertura-720.mp4',
    capa: '/assets/video/abertura-capa.jpg',
    marcaEm: 12.3 // segundo em que o jornal sai da tela e a marca aparece
  };
  var aberturaAtiva = false;
  var aposAberturaFila = [];

  function aposAbertura(cb) {
    if (aberturaAtiva) aposAberturaFila.push(cb);
    else cb();
  }

  function precisaAbertura() {
    return document.documentElement.classList.contains('com-abertura');
  }

  function iniciarAbertura() {
    var cfgAb = (configCache && configCache.abertura) || {};
    if (cfgAb.video) ABERTURA.video = cfgAb.video;
    ABERTURA.videoLeve = cfgAb.videoCelular || cfgAb.video || ABERTURA.videoLeve;
    if (cfgAb.marcaEm !== undefined && cfgAb.marcaEm !== '' && !isNaN(Number(cfgAb.marcaEm))) ABERTURA.marcaEm = Number(cfgAb.marcaEm);
    var raiz = document.documentElement;
    if (!precisaAbertura()) return;
    aberturaAtiva = true;

    var leve = window.innerWidth < 900 || (navigator.connection && navigator.connection.saveData);
    var el = document.createElement('div');
    el.className = 'abertura';
    el.id = 'abertura';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Abertura do Jornal do Reino');
    el.innerHTML =
      '<video class="abertura__video" muted playsinline autoplay preload="auto" poster="' + ABERTURA.capa + '" src="' + (leve ? ABERTURA.videoLeve : ABERTURA.video) + '"></video>' +
      '<div class="abertura__marca">' +
        '<img src="/Imagem/logo%20jornal.png" alt="" width="180" height="142">' +
        '<h2>Jornal do <em>Reino</em></h2>' +
        '<p>' + escapar(cfgAb.frase || 'A Palavra de Deus em cada página') + '</p>' +
        '<button type="button" class="btn btn--gold" data-entrar><i class="bx bx-book-open"></i> ' + escapar(cfgAb.textoBotao || 'Entrar no site') + '</button>' +
      '</div>' +
      '<button type="button" class="abertura__play" data-play hidden aria-label="Assistir à abertura"><i class="bx bx-play"></i></button>' +
      '<div class="abertura__progresso" aria-hidden="true"><span></span></div>';
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';

    var video = el.querySelector('video');
    var barra = el.querySelector('.abertura__progresso span');
    var play = el.querySelector('[data-play]');
    var encerrada = false;

    function encerrar() {
      if (encerrada) return;
      encerrada = true;
      el.classList.add('is-saindo');
      raiz.classList.remove('com-abertura');
      document.body.style.overflow = '';
      setTimeout(function () {
        video.pause();
        el.remove();
        aberturaAtiva = false;
        aposAberturaFila.splice(0).forEach(function (cb) { cb(); });
      }, 700);
    }

    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-entrar]')) encerrar();
      if (e.target.closest('[data-play]')) {
        play.hidden = true;
        video.play();
      }
    });

    video.addEventListener('timeupdate', function () {
      if (video.duration) barra.style.transform = 'scaleX(' + (video.currentTime / video.duration) + ')';
      if (video.currentTime >= ABERTURA.marcaEm) el.classList.add('mostra-marca');
    });
    video.addEventListener('ended', function () { setTimeout(encerrar, 1800); });
    // Se o vídeo não carregar, entra direto no site
    video.addEventListener('error', encerrar);

    obterConfig().then(function (cfg) {
      if (cfg && cfg.abertura && cfg.abertura.ativa === false) encerrar();
    });

    var tentativa = video.play();
    if (tentativa && tentativa.catch) {
      tentativa.catch(function () {
        // Autoplay bloqueado (ex.: modo economia no iPhone): mostra botão de play e a marca
        play.hidden = false;
        el.classList.add('mostra-marca');
      });
    }
    // Garantia: nunca prender o visitante se algo travar
    setTimeout(function () { if (!encerrada && video.paused && play.hidden) encerrar(); }, 8000);
  }

  function iniciar() {
    iniciarAbertura();
    montarCabecalho();
    montarRodape();
    aplicarConfigLayout(configCache);
    obterConfig().then(function (cfg) {
      if (cfg && JSON.stringify(cfg) !== JSON.stringify(configCache)) aplicarConfigLayout(cfg);
    });
    revelar();
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    // Tela de carregamento: espera a animação do jornal sendo impresso terminar
    // (~2,6s; o carimbo "Edição pronta" aparece no fim). Não espera vídeo e imagens.
    if (document.documentElement.classList.contains('com-carregando')) {
      montarPreloader();
      var duracao = Number(valor(configCache, 'carregamento.duracao')) || 2.6;
      setTimeout(esconderPreloader, Math.max(800, duracao * 1000));
    }
  }

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) esconderPreloader();
  });

  window.JR = {
    contato: CONTATO,
    escapar: escapar,
    urlImagem: urlImagem,
    textoParaHtml: textoParaHtml,
    ordenar: ordenar,
    ordenarJornais: ordenarJornais,
    buscarJSON: buscarJSON,
    cartaoEdicao: cartaoEdicao,
    capaDoJornal: capaDoJornal,
    resumir: resumir,
    revelar: revelar,
    aposAbertura: aposAbertura,
    obterConfig: obterConfig,
    destacar: destacar,
    aplicarCabecalhos: aplicarCabecalhos,
    beneficiosHtml: function (lista) {
      return (lista || []).map(function (b) {
        return '<article class="beneficio revelar">' +
          '<span class="beneficio__icone"><i class="bx ' + escapar(b.icone || 'bx-star') + '"></i></span>' +
          '<h3>' + escapar(b.titulo || '') + '</h3><p>' + escapar(b.texto || '') + '</p></article>';
      }).join('');
    },
    valor: valor,
    MESES: MESES
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
