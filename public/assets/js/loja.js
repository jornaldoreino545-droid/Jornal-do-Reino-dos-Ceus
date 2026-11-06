/* ==========================================================================
   JORNAL DO REINO — LOJA VIRTUAL (funções compartilhadas)
   Usado pela página da loja, pela página do produto e pela página inicial.
   Não há checkout: o botão de compra abre o WhatsApp da loja com uma
   mensagem pronta (produto, tamanho, cor, preço e link).
   Depende de /assets/js/layout.js (window.JR).
   ========================================================================== */
(function () {
  'use strict';

  var JR = window.JR;

  var PADRAO = {
    whatsapp: '553175251828',
    mensagem: 'Olá! Tenho interesse neste produto da Loja do Reino:',
    textoBotao: 'Quero este produto'
  };

  function preco(v) {
    var n = Number(v);
    if (!v && v !== 0) return '';
    return isNaN(n) ? '' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function imagemPrincipal(p) {
    var lista = Array.isArray(p.imagens) ? p.imagens : [];
    return lista.length ? JR.urlImagem(lista[0]) : '';
  }

  function desconto(p) {
    var atual = Number(p.preco), antigo = Number(p.precoAntigo);
    if (!atual || !antigo || antigo <= atual) return 0;
    return Math.round((1 - atual / antigo) * 100);
  }

  function linkProduto(p) {
    return '/produto.html?id=' + encodeURIComponent(p.id);
  }

  // Monta o link do WhatsApp com a mensagem do pedido
  function linkWhatsApp(cfgLoja, p, escolhas) {
    cfgLoja = cfgLoja || {};
    var numero = String(cfgLoja.whatsapp || PADRAO.whatsapp).replace(/\D/g, '');
    var linhas = [cfgLoja.mensagem || PADRAO.mensagem, ''];
    if (p) {
      linhas.push('*' + p.nome + '*');
      if (escolhas && escolhas.tamanho) linhas.push('Tamanho: ' + escolhas.tamanho);
      if (escolhas && escolhas.cor) linhas.push('Cor: ' + escolhas.cor);
      if (p.preco) linhas.push('Preço: ' + preco(p.preco));
      linhas.push('', location.origin + linkProduto(p));
    }
    return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(linhas.join('\n'));
  }

  // Cartão de produto (grade da loja, página inicial e "veja também")
  function cartao(p) {
    var img = imagemPrincipal(p);
    var off = desconto(p);
    return '<a class="produto revelar' + (p.esgotado ? ' produto--esgotado' : '') + '" href="' + linkProduto(p) + '">' +
      '<div class="produto__foto">' +
        (img
          ? '<img src="' + JR.escapar(img) + '" alt="' + JR.escapar(p.nome) + '" loading="lazy">'
          : '<span class="produto__sem-foto"><i class="bx bx-shopping-bag"></i></span>') +
        '<div class="produto__selos">' +
          (p.esgotado ? '<span class="selo selo--esgotado">Esgotado</span>' : '') +
          (!p.esgotado && off ? '<span class="selo selo--novo">-' + off + '%</span>' : '') +
          (!p.esgotado && p.destaque ? '<span class="selo selo--destaque"><i class="bx bxs-star"></i> Destaque</span>' : '') +
        '</div>' +
        '<span class="produto__ver"><i class="bx bx-show"></i> Ver detalhes</span>' +
      '</div>' +
      '<div class="produto__corpo">' +
        '<span class="produto__categoria">' + JR.escapar(p.categoria || 'Loja') + '</span>' +
        '<h3 class="produto__nome">' + JR.escapar(p.nome) + '</h3>' +
        '<div class="produto__preco">' +
          (p.precoAntigo && off ? '<s>' + preco(p.precoAntigo) + '</s>' : '') +
          '<strong>' + (p.preco ? preco(p.preco) : 'Consulte') + '</strong>' +
        '</div>' +
      '</div>' +
    '</a>';
  }

  function ordenar(lista) {
    return (lista || []).slice().sort(function (a, b) {
      return (a.ordem || 999) - (b.ordem || 999) || (b.id - a.id);
    });
  }

  async function buscarProdutos() {
    var dados = await JR.buscarJSON('/api/loja/produtos');
    return ordenar(Array.isArray(dados) ? dados : []);
  }

  window.Loja = {
    preco: preco,
    cartao: cartao,
    desconto: desconto,
    imagemPrincipal: imagemPrincipal,
    linkProduto: linkProduto,
    linkWhatsApp: linkWhatsApp,
    buscarProdutos: buscarProdutos,
    PADRAO: PADRAO
  };
})();
