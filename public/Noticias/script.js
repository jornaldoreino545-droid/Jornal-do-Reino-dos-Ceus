/* ==========================================================================
   JORNAL DO REINO — PORTAL DE NOTÍCIAS
   Manchete + secundárias, letreiro "Últimas", editorias (categorias),
   busca, lista com "Carregar mais" e barra lateral (edição do mês).
   As notícias vêm do painel: /api/site/noticias
   ========================================================================== */
(function () {
  'use strict';

  var JR = window.JR;
  var $ = function (id) { return document.getElementById(id); };

  var POR_VEZ = 6;          // notícias carregadas por clique em "Carregar mais"
  var noticias = [];
  var categorias = [];
  var categoria = 'todas';
  var mostrando = POR_VEZ;

  // Cores das editorias (na ordem em que aparecem)
  var CORES = ['#cf0000', '#00095b', '#0077cc', '#b07d00', '#7a1fa2', '#0a8a5a'];

  /* ---------------- Utilitários ---------------- */

  function capitalizar(t) {
    t = String(t || 'geral');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function dataDe(n) {
    var d = new Date(n.date + (String(n.date).length === 10 ? 'T12:00:00' : ''));
    return isNaN(d) ? null : d;
  }

  function formatarData(n, longo) {
    var d = dataDe(n);
    if (!d) return '';
    return d.toLocaleDateString('pt-BR', longo
      ? { day: '2-digit', month: 'long', year: 'numeric' }
      : { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function tempoRelativo(n) {
    var d = dataDe(n);
    if (!d) return '';
    var dias = Math.round((Date.now() - d.getTime()) / 86400000);
    if (dias <= 0) return 'Hoje';
    if (dias === 1) return 'Ontem';
    if (dias < 7) return 'Há ' + dias + ' dias';
    if (dias < 30) { var s = Math.round(dias / 7); return 'Há ' + s + (s === 1 ? ' semana' : ' semanas'); }
    return formatarData(n);
  }

  function textoPuro(html) {
    var div = document.createElement('div');
    div.innerHTML = html || '';
    return (div.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function leitura(n) {
    var palavras = textoPuro(n.content).split(' ').filter(Boolean).length;
    return Math.max(1, Math.round(palavras / 200)) + ' min de leitura';
  }

  function resumo(n, limite) {
    return JR.resumir(n.excerpt || textoPuro(n.content), limite);
  }

  function imagem(n) {
    return JR.urlImagem(n.image) || '/Imagem/logo%20jornal.png';
  }

  function link(n) {
    return '/Noticias/noticia.html?id=' + encodeURIComponent(n.id);
  }

  function cor(cat) {
    var i = categorias.indexOf(cat);
    return CORES[(i < 0 ? 0 : i) % CORES.length];
  }

  function chapeu(n) {
    return '<span class="np-chapeu" style="--cor:' + cor(n.category) + '">' + JR.escapar(capitalizar(n.category)) + '</span>';
  }

  function img(n, extra) {
    return '<img src="' + JR.escapar(imagem(n)) + '" alt="" ' + (extra || 'loading="lazy"') +
      ' onerror="this.onerror=null;this.src=\'/Imagem/logo%20jornal.png\';this.classList.add(\'np-sem-foto\')">';
  }

  /* ---------------- Blocos de notícia ---------------- */

  function manchete(n) {
    return '<a class="np-manchete" href="' + link(n) + '">' +
      img(n, 'fetchpriority="high"') +
      '<div class="np-manchete__texto">' +
        chapeu(n) +
        '<h2>' + JR.escapar(n.title || 'Sem título') + '</h2>' +
        '<p>' + JR.escapar(resumo(n, 180)) + '</p>' +
        '<div class="np-meta"><span><i class="bx bx-time-five"></i> ' + tempoRelativo(n) + '</span><span><i class="bx bx-book-reader"></i> ' + leitura(n) + '</span></div>' +
      '</div>' +
    '</a>';
  }

  function secundaria(n) {
    return '<a class="np-sec" href="' + link(n) + '">' +
      '<div class="np-sec__img">' + img(n) + '</div>' +
      '<div class="np-sec__texto">' +
        chapeu(n) +
        '<h3>' + JR.escapar(n.title || 'Sem título') + '</h3>' +
        '<div class="np-meta"><span><i class="bx bx-time-five"></i> ' + tempoRelativo(n) + '</span></div>' +
      '</div>' +
    '</a>';
  }

  function itemLista(n) {
    return '<a class="np-item revelar" href="' + link(n) + '">' +
      '<div class="np-item__img">' + img(n) + '</div>' +
      '<div class="np-item__texto">' +
        chapeu(n) +
        '<h3>' + JR.escapar(n.title || 'Sem título') + '</h3>' +
        '<p>' + JR.escapar(resumo(n, 150)) + '</p>' +
        '<div class="np-meta">' +
          '<span><i class="bx bx-calendar"></i> ' + formatarData(n) + '</span>' +
          '<span><i class="bx bx-book-reader"></i> ' + leitura(n) + '</span>' +
        '</div>' +
      '</div>' +
    '</a>';
  }

  /* ---------------- Filtro e renderização ---------------- */

  function busca() {
    return $('searchInput').value.trim().toLowerCase();
  }

  function filtradas() {
    var q = busca();
    return noticias.filter(function (n) {
      if (categoria !== 'todas' && n.category !== categoria) return false;
      if (!q) return true;
      return [n.title, n.excerpt, textoPuro(n.content), n.tag].join(' ').toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderizar() {
    var lista = filtradas();
    var q = busca();
    var modoCapa = categoria === 'todas' && !q;

    // Na "capa" do portal: 1 manchete + até 3 secundárias; o resto vai para a lista
    var abertura = $('abertura-noticias');
    var resto = lista;
    if (modoCapa && lista.length >= 2) {
      var sec = lista.slice(1, 4);
      abertura.innerHTML = manchete(lista[0]) +
        '<div class="np-secundarias">' + sec.map(secundaria).join('') + '</div>';
      abertura.hidden = false;
      resto = lista.slice(1 + sec.length);
    } else {
      abertura.hidden = true;
    }

    // Título da lista
    var titulo = 'Últimas notícias';
    if (q) titulo = 'Resultados para “' + $('searchInput').value.trim() + '”';
    else if (categoria !== 'todas') titulo = capitalizar(categoria);
    $('tituloLista').textContent = titulo;
    $('tituloLista').style.setProperty('--cor', categoria !== 'todas' ? cor(categoria) : '');
    $('contagem').textContent = (q || categoria !== 'todas')
      ? lista.length + (lista.length === 1 ? ' notícia' : ' notícias')
      : '';

    var visiveis = resto.slice(0, mostrando);
    $('results').innerHTML = visiveis.map(itemLista).join('');
    $('empty').hidden = lista.length > 0;
    $('carregarMais').hidden = resto.length <= mostrando;
    // Na capa, se todas as notícias já estão na abertura, some a seção da lista
    document.querySelector('.np-titulo-bloco').hidden = modoCapa && resto.length === 0 && lista.length > 0;

    JR.revelar($('results'));
  }

  function selecionarCategoria(cat) {
    categoria = cat;
    mostrando = POR_VEZ;
    document.querySelectorAll('[data-cat]').forEach(function (b) {
      var ativo = b.dataset.cat === cat;
      b.classList.toggle('is-active', ativo);
      if (b.getAttribute('role') === 'tab') b.setAttribute('aria-selected', ativo);
    });
    renderizar();
  }

  /* ---------------- Montagem das partes fixas ---------------- */

  function montarCategorias() {
    var contagem = {};
    noticias.forEach(function (n) {
      if (categorias.indexOf(n.category) === -1) categorias.push(n.category);
      contagem[n.category] = (contagem[n.category] || 0) + 1;
    });

    $('filtros').innerHTML = '<button role="tab" data-cat="todas" class="is-active" aria-selected="true">Todas</button>' +
      categorias.map(function (c) {
        return '<button role="tab" data-cat="' + JR.escapar(c) + '" style="--cor:' + cor(c) + '">' + JR.escapar(capitalizar(c)) + '</button>';
      }).join('');

    $('editorias').innerHTML = categorias.map(function (c) {
      return '<li><button data-cat="' + JR.escapar(c) + '" style="--cor:' + cor(c) + '">' +
        '<span>' + JR.escapar(capitalizar(c)) + '</span><small>' + contagem[c] + '</small></button></li>';
    }).join('');
  }

  function montarTicker() {
    var ultimas = noticias.slice(0, 8);
    if (!ultimas.length) return;
    var itens = ultimas.map(function (n) {
      return '<a href="' + link(n) + '"><strong>' + JR.escapar(capitalizar(n.category)) + '</strong> ' + JR.escapar(n.title) + '</a>';
    }).join('');
    // Conteúdo duplicado para o letreiro rodar sem "pulo"
    $('tickerFaixa').innerHTML = itens + itens;
    $('tickerFaixa').style.animationDuration = Math.max(25, ultimas.length * 7) + 's';
    $('ticker').hidden = false;
  }

  function montarRedes() {
    var c = JR.contato;
    $('redes').innerHTML =
      '<a href="' + c.instagram + '" target="_blank" rel="noopener" class="s-insta"><i class="bx bxl-instagram"></i> Instagram</a>' +
      '<a href="' + c.youtube + '" target="_blank" rel="noopener" class="s-yt"><i class="bx bxl-youtube"></i> YouTube</a>' +
      '<a href="' + c.facebook + '" target="_blank" rel="noopener" class="s-face"><i class="bx bxl-facebook"></i> Facebook</a>' +
      '<a href="' + c.whatsapp + '" target="_blank" rel="noopener" class="s-whats"><i class="bx bxl-whatsapp"></i> WhatsApp</a>';
  }

  async function montarEdicaoDoMes() {
    try {
      var dados = await JR.buscarJSON('/api/jornais');
      var jornais = JR.ordenarJornais(dados.jornais || []).sort(function (a, b) {
        if (a.ano !== b.ano) return (b.ano || 0) - (a.ano || 0);
        return JR.MESES.indexOf(b.mes) - JR.MESES.indexOf(a.mes);
      });
      var j = jornais[0];
      if (!j) return;
      var linkCompra = '/jornal-compra.html?id=' + encodeURIComponent(j.id);
      $('edicaoMes').innerHTML =
        '<h3 class="np-caixa__titulo">Edição do mês</h3>' +
        '<a class="np-edicao__capa" href="' + linkCompra + '"><img src="' + JR.escapar(JR.capaDoJornal(j)) + '" alt="Capa do ' + JR.escapar(j.nome) + '" loading="lazy"></a>' +
        '<strong class="np-edicao__nome">' + JR.escapar(j.nome) + ' ' + JR.escapar(j.ano || '') + '</strong>' +
        '<a class="btn btn--gold btn--bloco" href="' + linkCompra + '">Adquira o seu</a>';
      $('edicaoMes').hidden = false;
    } catch (e) {
      console.error('Edição do mês:', e);
    }
  }

  /* ---------------- Eventos ---------------- */

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]');
    if (!b) return;
    selecionarCategoria(b.dataset.cat);
    if (b.closest('.np-lateral')) document.querySelector('.np-topo').scrollIntoView({ behavior: 'smooth' });
  });

  $('carregarMais').addEventListener('click', function () {
    mostrando += POR_VEZ;
    renderizar();
  });

  var espera;
  $('searchInput').addEventListener('input', function () {
    clearTimeout(espera);
    espera = setTimeout(function () { mostrando = POR_VEZ; renderizar(); }, 220);
  });

  /* ---------------- Início ---------------- */

  $('dataHoje').textContent = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).replace(/^./, function (c) { return c.toUpperCase(); });

  async function carregar() {
    var dados = [];
    try {
      dados = await JR.buscarJSON('/api/site/noticias');
    } catch (erro) {
      console.error('Notícias:', erro);
      try { dados = await JR.buscarJSON('/Noticias/data.json'); } catch (e) { dados = []; }
    }

    noticias = (Array.isArray(dados) ? dados : [])
      .map(function (n) {
        return {
          id: n.id,
          title: n.title || '',
          content: n.content || '',
          excerpt: n.excerpt || '',
          date: n.date || new Date().toISOString().slice(0, 10),
          category: String(n.category || 'geral').toLowerCase(),
          tag: n.tag || '',
          image: n.image || ''
        };
      })
      .sort(function (a, b) { return (dataDe(b) || 0) - (dataDe(a) || 0); });

    montarCategorias();
    montarTicker();
    renderizar();
  }

  montarEdicaoDoMes();

  // Título do portal e quantidade por página vindos do dashboard
  JR.obterConfig().then(function (cfg) {
    var n = cfg && cfg.noticias;
    if (n && n.titulo) $('tituloPortal').innerHTML = JR.destacar(n.titulo, 'span');
    if (n && Number(n.porPagina) > 0) { POR_VEZ = Number(n.porPagina); mostrando = POR_VEZ; }
    montarRedes();
  }).then(carregar, carregar);
})();
