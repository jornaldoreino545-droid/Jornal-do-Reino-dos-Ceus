/* ==========================================================================
   PÁGINA DE SUCESSO — confirma o pagamento no servidor e libera o PDF
   Recebe ?payment_intent=pi_... (o Stripe também adiciona isso ao voltar
   de uma confirmação de cartão). Se o pagamento ainda estiver em
   processamento, consulta de novo a cada poucos segundos.
   ========================================================================== */
(function () {
  'use strict';

  var caixa = document.getElementById('caixa');
  var id = new URLSearchParams(location.search).get('payment_intent') || '';
  var tentativas = 0;
  var whatsapp = 'https://wa.me/5511981739716';

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function moeda(v) {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function tela(tipo, titulo, texto, corpo) {
    var icones = {
      ok: '<span class="sc__icone"><i class="bx bx-check"></i></span>',
      espera: '<span class="sc__icone sc__icone--espera"><i class="bx bx-loader-alt bx-spin"></i></span>',
      erro: '<span class="sc__icone sc__icone--erro"><i class="bx bx-x"></i></span>'
    };
    caixa.innerHTML = '<div class="sc__topo">' + icones[tipo] + '<h1>' + titulo + '</h1><p>' + texto + '</p></div>' +
      (corpo ? '<div class="sc__corpo">' + corpo + '</div>' : '');
  }

  function acoes() {
    return '<div class="sc__acoes">' +
      '<a class="btn btn--contorno-azul" href="/pag-saibaMais.html"><i class="bx bx-book-open"></i> Ver outras edições</a>' +
      '<a class="btn btn--azul" href="/"><i class="bx bx-home"></i> Voltar ao site</a></div>';
  }

  function sucesso(d) {
    var j = d.jornal || {};
    var corpo =
      '<div class="sc__produto">' +
        (j.capa ? '<img src="' + esc(j.capa) + '" alt="Capa do ' + esc(j.nome) + '">' : '<span></span>') +
        '<div><strong>' + esc(j.nome || 'Jornal do Reino') + (j.ano ? ' ' + esc(j.ano) : '') + '</strong>' +
          '<dl><dt>Valor</dt><dd>' + moeda(d.valor) + '</dd><dt>Pagamento</dt><dd>' + esc(d.metodo || '') + '</dd>' +
          (d.email ? '<dt>Comprovante</dt><dd>' + esc(d.email) + '</dd>' : '') + '</dl></div>' +
      '</div>' +
      (d.downloadUrl
        ? '<a class="btn btn--gold btn--bloco sc__baixar" href="' + esc(d.downloadUrl) + '"><i class="bx bx-download"></i> Baixar o jornal (PDF)</a>' +
          '<p class="sc__dica"><i class="bx bx-bookmark"></i> <strong>Dica:</strong> guarde o link desta página. Você pode voltar aqui para baixar o jornal de novo quando quiser.</p>'
        : '<p class="sc__dica"><i class="bx bx-info-circle"></i> O PDF desta edição ainda está sendo preparado. Fale com a gente pelo <a href="' + whatsapp + '" target="_blank" rel="noopener"><strong>WhatsApp</strong></a> que enviamos para você.</p>') +
      acoes();
    tela('ok', 'Pagamento confirmado!', 'Obrigado, ' + esc(String(d.nome || '').split(' ')[0] || 'irmão(ã)') + '! Seu jornal já está liberado.', corpo);
  }

  async function verificar() {
    if (!id) {
      tela('erro', 'Pagamento não encontrado', 'Não encontramos as informações do seu pagamento.', acoes());
      return;
    }
    try {
      var r = await fetch('/api/download?payment_intent=' + encodeURIComponent(id));
      var d = await r.json();
      if (r.ok) { sucesso(d); return; }

      // Ainda processando (comum no PIX e em alguns cartões): tenta de novo
      if (r.status === 402 && ['processing', 'requires_action', 'requires_capture'].indexOf(d.status) !== -1 && tentativas < 60) {
        tentativas++;
        tela('espera', 'Aguardando confirmação…', 'Seu pagamento está sendo processado. Esta página atualiza sozinha.');
        setTimeout(verificar, 4000);
        return;
      }
      tela('erro', 'Pagamento não confirmado', esc(d.error || 'O pagamento não foi concluído.') + ' Se o valor foi debitado, fale com a gente.',
        '<a class="btn btn-whats btn--bloco sc__baixar" style="background:#25d366;color:#fff" href="' + whatsapp + '" target="_blank" rel="noopener"><i class="bx bxl-whatsapp"></i> Falar no WhatsApp</a>' + acoes());
    } catch (e) {
      if (tentativas++ < 5) { setTimeout(verificar, 3000); return; }
      tela('erro', 'Não foi possível verificar', 'Verifique sua conexão e recarregue a página.', acoes());
    }
  }

  // WhatsApp de contato configurado no dashboard
  fetch('/api/site/config-geral').then(function (r) { return r.json(); }).then(function (cfg) {
    var n = cfg && cfg.contato && String(cfg.contato.whatsapp || '').replace(/\D/g, '');
    if (n) whatsapp = 'https://wa.me/' + n;
  }).catch(function () {}).then(verificar);
})();
