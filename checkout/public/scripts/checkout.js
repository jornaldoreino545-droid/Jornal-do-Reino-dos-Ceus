/* ==========================================================================
   CHECKOUT DO JORNAL DO REINO — cartão e PIX (Stripe)
   O preço vem do servidor (/api/checkout/produto). Esta página só mostra
   e envia nome, e-mail e a forma de pagamento escolhida.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var params = new URLSearchParams(location.search);
  var product = params.get('product') || '';

  var stripe = null;
  var elements = null;
  var produto = null;
  var metodo = 'pix';
  var consulta = null;      // intervalo da consulta do PIX
  var relogio = null;       // contagem regressiva do PIX

  function moeda(v) {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function mostrarErro(msg) {
    var el = $('erro');
    el.textContent = msg || '';
    el.hidden = !msg;
    if (msg) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function textoBotao() {
    var b = $('botaoPagar');
    b.disabled = false;
    b.innerHTML = metodo === 'pix'
      ? '<i class="bx bx-qr"></i> Gerar PIX de ' + moeda(produto.preco)
      : '<i class="bx bxs-lock-alt"></i> Pagar ' + moeda(produto.preco);
  }

  function carregando(texto) {
    var b = $('botaoPagar');
    b.disabled = true;
    b.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> ' + texto;
  }

  async function json(url, opcoes) {
    var r = await fetch(url, opcoes);
    var dados = {};
    try { dados = await r.json(); } catch (e) { /* sem corpo */ }
    if (!r.ok) throw new Error(dados.error || 'Erro ' + r.status);
    return dados;
  }

  /* ---------------- Resumo do pedido ---------------- */

  function mostrarResumo() {
    $('resumoNome').textContent = produto.nome;
    $('resumoEdicao').textContent = 'Edição de ' + (produto.mes || '') + ' ' + (produto.ano || '');
    $('resumoSubtotal').textContent = moeda(produto.preco);
    $('resumoTotal').textContent = moeda(produto.preco);
    var capa = $('resumoCapa');
    capa.classList.remove('skeleton');
    capa.innerHTML = produto.capa ? '<img src="' + produto.capa + '" alt="Capa do ' + produto.nome + '">' : '<i class="bx bx-news"></i>';
    $('linkVoltar').href = '/jornal-compra.html?id=' + encodeURIComponent(produto.id);
    document.title = 'Pagamento — ' + produto.nome;
  }

  /* ---------------- Cartão (formulário seguro do Stripe) ---------------- */

  function montarCartao() {
    if (elements) return;
    elements = stripe.elements({
      mode: 'payment',
      amount: Math.round(produto.preco * 100),
      currency: 'brl',
      paymentMethodTypes: ['card'],
      locale: 'pt-BR',
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#00095b',
          colorDanger: '#cf0000',
          fontFamily: 'Arial, Helvetica, sans-serif',
          borderRadius: '0px',
          spacingUnit: '5px'
        }
      }
    });
    var el = elements.create('payment', {
      layout: 'tabs',
      fields: { billingDetails: { name: 'never', email: 'never' } }
    });
    el.mount('#elementoCartao');
  }

  async function pagarComCartao(nome, email) {
    var envio = await elements.submit();
    if (envio.error) { mostrarErro(envio.error.message); textoBotao(); return; }

    var dados = await json('/api/checkout/pagamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: product, nome: nome, email: email, metodo: 'card' })
    });

    carregando('Confirmando pagamento…');
    var resultado = await stripe.confirmPayment({
      elements: elements,
      clientSecret: dados.clientSecret,
      redirect: 'if_required',
      confirmParams: {
        return_url: location.origin + '/checkout/success',
        payment_method_data: { billing_details: { name: nome, email: email } }
      }
    });

    if (resultado.error) {
      mostrarErro(resultado.error.message || 'Pagamento recusado. Confira os dados do cartão.');
      textoBotao();
      return;
    }
    irParaSucesso(resultado.paymentIntent.id);
  }

  /* ---------------- PIX ---------------- */

  async function pagarComPix(nome, email) {
    var dados = await json('/api/checkout/pagamento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: product, nome: nome, email: email, metodo: 'pix' })
    });
    mostrarPix(dados);
  }

  function mostrarPix(dados) {
    $('areaFormulario').hidden = true;
    $('areaPix').hidden = false;
    $('pixImagem').src = dados.pix.imagem;
    $('pixCodigo').value = dados.pix.codigo;
    $('pixValor').textContent = moeda(dados.valor);
    if (dados.pix.simular) { $('pixSimular').href = dados.pix.simular; $('pixSimular').hidden = false; }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Contagem regressiva até o código expirar
    var fim = (dados.pix.expiraEm || 0) * 1000;
    clearInterval(relogio);
    relogio = setInterval(function () {
      var resta = Math.max(0, Math.floor((fim - Date.now()) / 1000));
      $('pixTempo').textContent = String(Math.floor(resta / 60)).padStart(2, '0') + ':' + String(resta % 60).padStart(2, '0');
      if (!resta) {
        clearInterval(relogio);
        clearInterval(consulta);
        $('pixStatus').classList.add('is-expirado');
        $('pixStatus').innerHTML = '<i class="bx bx-time"></i><div><strong>O código expirou.</strong><small>Volte e gere um novo PIX.</small></div>';
      }
    }, 1000);

    // Consulta o status a cada 3 segundos
    clearInterval(consulta);
    consulta = setInterval(async function () {
      try {
        var s = await json('/api/checkout/status?payment_intent=' + encodeURIComponent(dados.paymentIntentId));
        if (s.status === 'succeeded') {
          clearInterval(consulta);
          clearInterval(relogio);
          $('pixStatus').classList.add('is-pago');
          $('pixStatus').innerHTML = '<i class="bx bx-check-circle"></i><div><strong>PIX recebido!</strong><small>Liberando o seu jornal…</small></div>';
          setTimeout(function () { irParaSucesso(dados.paymentIntentId); }, 1200);
        }
        if (s.status === 'canceled') {
          clearInterval(consulta);
          $('pixStatus').innerHTML = '<i class="bx bx-x-circle"></i><div><strong>Pagamento cancelado.</strong><small>Gere um novo PIX.</small></div>';
        }
      } catch (e) { /* tenta de novo na próxima rodada */ }
    }, 3000);
  }

  $('copiarPix').addEventListener('click', function () {
    var campo = $('pixCodigo');
    var botao = this;
    function feito() {
      botao.querySelector('span').textContent = 'Código copiado!';
      botao.querySelector('i').className = 'bx bx-check';
      setTimeout(function () {
        botao.querySelector('span').textContent = 'Copiar código PIX';
        botao.querySelector('i').className = 'bx bx-copy';
      }, 2500);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(campo.value).then(feito);
    } else {
      campo.select();
      document.execCommand('copy');
      feito();
    }
  });

  $('trocarMetodo').addEventListener('click', function () {
    clearInterval(consulta);
    clearInterval(relogio);
    $('areaPix').hidden = true;
    $('areaFormulario').hidden = false;
    textoBotao();
  });

  /* ---------------- Formulário ---------------- */

  function irParaSucesso(id) {
    location.href = '/checkout/success?payment_intent=' + encodeURIComponent(id);
  }

  document.querySelectorAll('input[name="metodo"]').forEach(function (r) {
    r.addEventListener('change', function () {
      metodo = this.value;
      $('painelPix').hidden = metodo !== 'pix';
      $('painelCartao').hidden = metodo !== 'card';
      if (metodo === 'card') montarCartao();
      mostrarErro('');
      textoBotao();
    });
  });

  $('formPagamento').addEventListener('submit', async function (e) {
    e.preventDefault();
    mostrarErro('');
    var nome = $('nome').value.trim();
    var email = $('email').value.trim();
    if (nome.length < 3) { mostrarErro('Informe seu nome completo.'); $('nome').focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { mostrarErro('Informe um e-mail válido.'); $('email').focus(); return; }

    carregando(metodo === 'pix' ? 'Gerando PIX…' : 'Processando…');
    try {
      if (metodo === 'pix') await pagarComPix(nome, email);
      else await pagarComCartao(nome, email);
    } catch (erro) {
      mostrarErro(erro.message || 'Não foi possível concluir o pagamento. Tente novamente.');
      textoBotao();
    }
  });

  /* ---------------- Início ---------------- */

  async function iniciar() {
    if (!product) {
      document.querySelector('.ck__grade').innerHTML = '<div class="ck-vazio"><i class="bx bx-cart"></i><h1>Nenhuma edição escolhida</h1><p>Escolha o jornal que você quer adquirir.</p><a class="btn btn--gold" href="/pag-saibaMais.html">Ver as edições</a></div>';
      return;
    }
    try {
      var res = await Promise.all([json('/api/stripe-config'), json('/api/checkout/produto?product=' + encodeURIComponent(product))]);
      var cfg = res[0];
      produto = res[1];
      if (!cfg.publishableKey) throw new Error('O pagamento ainda não foi configurado (chave do Stripe ausente).');
      stripe = Stripe(cfg.publishableKey, { locale: 'pt-BR' });
      $('avisoTeste').hidden = !cfg.modoTeste;
      mostrarResumo();
      textoBotao();
    } catch (erro) {
      document.querySelector('.ck__grade').innerHTML = '<div class="ck-vazio"><i class="bx bx-error-circle"></i><h1>Não foi possível abrir o pagamento</h1><p>' + (erro.message || '') + '</p><a class="btn btn--gold" href="/pag-saibaMais.html">Ver as edições</a></div>';
    }
  }

  iniciar();
})();
