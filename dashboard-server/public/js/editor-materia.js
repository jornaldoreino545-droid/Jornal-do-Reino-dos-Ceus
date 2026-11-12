/*
 * Editor de matérias do painel.
 * Transforma <textarea data-editor="materia"> num editor visual com barra de atalhos
 * (negrito, títulos, listas, citação, link, imagem...). O HTML gerado continua sendo
 * gravado no próprio textarea, então o salvamento do formulário não muda.
 */
(function () {
  'use strict';

  var API = '/api';

  var BOTOES = [
    { cmd: 'bold', icone: 'bx-bold', titulo: 'Negrito (Ctrl+B)' },
    { cmd: 'italic', icone: 'bx-italic', titulo: 'Itálico (Ctrl+I)' },
    { cmd: 'underline', icone: 'bx-underline', titulo: 'Sublinhado (Ctrl+U)' },
    '|',
    { bloco: 'h2', texto: 'Título', titulo: 'Título de seção' },
    { bloco: 'h3', texto: 'Subtítulo', titulo: 'Subtítulo' },
    { bloco: 'p', texto: 'Texto', titulo: 'Texto normal' },
    '|',
    { cmd: 'insertUnorderedList', icone: 'bx-list-ul', titulo: 'Lista com marcadores' },
    { cmd: 'insertOrderedList', icone: 'bx-list-ol', titulo: 'Lista numerada' },
    { bloco: 'blockquote', icone: 'bxs-quote-alt-left', titulo: 'Citação / versículo em destaque' },
    { acao: 'linha', icone: 'bx-minus', titulo: 'Linha divisória' },
    '|',
    { acao: 'link', icone: 'bx-link', titulo: 'Inserir link' },
    { cmd: 'unlink', icone: 'bx-unlink', titulo: 'Remover link' },
    { acao: 'imagem', icone: 'bx-image-add', texto: 'Imagem', titulo: 'Inserir imagem no texto', destaque: true },
    '|',
    { cmd: 'removeFormat', icone: 'bx-eraser', titulo: 'Limpar formatação do trecho selecionado' },
    { cmd: 'undo', icone: 'bx-undo', titulo: 'Desfazer (Ctrl+Z)' },
    { cmd: 'redo', icone: 'bx-redo', titulo: 'Refazer (Ctrl+Y)' },
    '|',
    { acao: 'tela', icone: 'bx-fullscreen', titulo: 'Tela cheia' }
  ];

  function escapar(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Mesmo formato que o site usa para textos sem HTML (parágrafos separados por linha em branco)
  function textoParaHtml(texto) {
    return escapar(texto)
      .replace(/\r\n/g, '\n')
      .split(/\n{2,}/)
      .map(function (p) { return p.trim() ? '<p>' + p.replace(/\n/g, '<br>') + '</p>' : ''; })
      .join('');
  }

  function temHtml(valor) {
    return /<[a-z][\s\S]*>/i.test(valor || '');
  }

  var PERMITIDAS = /^(P|BR|B|STRONG|I|EM|U|H2|H3|UL|OL|LI|BLOCKQUOTE|A|IMG|HR|FIGURE|FIGCAPTION)$/;

  // Limpa o HTML do editor: tira estilos, classes e tags que não fazem parte da matéria
  function limpar(raiz) {
    var copia = raiz.cloneNode(true);
    (function varrer(no) {
      Array.prototype.slice.call(no.childNodes).forEach(function (filho) {
        if (filho.nodeType === 8) { filho.remove(); return; }
        if (filho.nodeType !== 1) return;
        varrer(filho);
        var tag = filho.tagName;
        if (tag === 'DIV') {
          var p = document.createElement('p');
          while (filho.firstChild) p.appendChild(filho.firstChild);
          filho.replaceWith(p);
          return;
        }
        // Navegadores às vezes põem listas/títulos dentro de <p>: tira o <p> de fora
        if (tag === 'P' && filho.querySelector('ul,ol,blockquote,h2,h3,hr,p,figure')) {
          while (filho.firstChild) filho.parentNode.insertBefore(filho.firstChild, filho);
          filho.remove();
          return;
        }
        if (tag === 'H1') {
          var h = document.createElement('h2');
          while (filho.firstChild) h.appendChild(filho.firstChild);
          filho.replaceWith(h);
          return;
        }
        if (!PERMITIDAS.test(tag)) {
          if (/^(SCRIPT|STYLE|IFRAME|OBJECT)$/.test(tag)) { filho.remove(); return; }
          while (filho.firstChild) filho.parentNode.insertBefore(filho.firstChild, filho);
          filho.remove();
          return;
        }
        Array.prototype.slice.call(filho.attributes).forEach(function (a) {
          var ok = (tag === 'A' && (a.name === 'href' || a.name === 'target' || a.name === 'rel')) ||
                   (tag === 'IMG' && (a.name === 'src' || a.name === 'alt'));
          if (!ok || /^\s*javascript:/i.test(a.value)) filho.removeAttribute(a.name);
        });
      });
    })(copia);

    var html = copia.innerHTML
      .replace(/<p>(\s|&nbsp;|<br>)*<\/p>/gi, '')
      .trim();
    return html;
  }

  function criarEditor(textarea) {
    if (textarea.dataset.editorPronto) return;
    textarea.dataset.editorPronto = '1';
    textarea.removeAttribute('required'); // o campo fica escondido; a validação é feita ao salvar

    var caixa = document.createElement('div');
    caixa.className = 'ed-materia';

    var barra = document.createElement('div');
    barra.className = 'ed-materia__barra';
    barra.setAttribute('role', 'toolbar');
    barra.setAttribute('aria-label', 'Formatação do texto');
    barra.innerHTML = BOTOES.map(function (b, i) {
      if (b === '|') return '<span class="ed-materia__sep"></span>';
      return '<button type="button" data-i="' + i + '" title="' + escapar(b.titulo) + '" aria-label="' + escapar(b.titulo) + '"' +
        (b.destaque ? ' class="is-destaque"' : '') + '>' +
        (b.icone ? "<i class='bx " + b.icone + "'></i>" : '') +
        (b.texto ? '<span>' + escapar(b.texto) + '</span>' : '') +
        '</button>';
    }).join('');

    var area = document.createElement('div');
    area.className = 'ed-materia__area';
    area.contentEditable = 'true';
    area.setAttribute('role', 'textbox');
    area.setAttribute('aria-multiline', 'true');
    area.setAttribute('data-placeholder', 'Comece a escrever a matéria aqui...');

    var rodape = document.createElement('div');
    rodape.className = 'ed-materia__rodape';
    rodape.innerHTML = '<span class="ed-materia__dica"><i class="bx bx-info-circle"></i> Dica: cole o texto direto do Word ou WhatsApp, e arraste fotos para dentro do texto.</span><span class="ed-materia__contagem">0 palavras</span>';

    var envio = document.createElement('input');
    envio.type = 'file';
    envio.accept = 'image/*';
    envio.hidden = true;

    caixa.appendChild(barra);
    caixa.appendChild(area);
    caixa.appendChild(rodape);
    caixa.appendChild(envio);
    textarea.style.display = 'none';
    textarea.parentNode.insertBefore(caixa, textarea.nextSibling);

    var label = document.querySelector('label[for="' + textarea.id + '"]');
    if (label) label.addEventListener('click', function (e) { e.preventDefault(); area.focus(); });

    var contagem = rodape.querySelector('.ed-materia__contagem');
    var selecaoSalva = null;

    function salvarSelecao() {
      var sel = window.getSelection();
      if (sel.rangeCount && area.contains(sel.anchorNode)) selecaoSalva = sel.getRangeAt(0).cloneRange();
    }

    function restaurarSelecao() {
      area.focus();
      if (!selecaoSalva) return;
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(selecaoSalva);
    }

    function sincronizar() {
      textarea.value = limpar(area);
      var palavras = (area.innerText || '').trim().split(/\s+/).filter(Boolean).length;
      contagem.textContent = palavras + (palavras === 1 ? ' palavra' : ' palavras');
      caixa.classList.toggle('is-vazio', !area.textContent.trim() && !area.querySelector('img'));
      atualizarEstado();
    }

    function carregar() {
      var valor = textarea.value || '';
      // Texto antigo (sem HTML): cada linha vira um parágrafo, para os botões funcionarem linha a linha
      area.innerHTML = temHtml(valor) ? valor : textoParaHtml(String(valor).replace(/\r?\n/g, '\n\n'));
      if (!area.innerHTML) area.innerHTML = '<p><br></p>';
      selecaoSalva = null;
      sincronizar();
    }

    function atualizarEstado() {
      barra.querySelectorAll('button[data-i]').forEach(function (btn) {
        var b = BOTOES[btn.dataset.i];
        var ativo = false;
        try {
          if (b.cmd && /^(bold|italic|underline|insertUnorderedList|insertOrderedList)$/.test(b.cmd)) {
            ativo = document.queryCommandState(b.cmd);
          } else if (b.bloco && b.bloco !== 'p') {
            var s = window.getSelection();
            var bl = s.rangeCount ? blocoAtual(s.anchorNode) : null;
            ativo = !!bl && bl.tagName.toLowerCase() === b.bloco;
          }
        } catch (e) { /* navegador sem suporte */ }
        btn.classList.toggle('is-ativo', !!ativo && document.activeElement === area);
      });
    }

    // Bloco do primeiro nível (parágrafo, título...) onde está o cursor
    function blocoAtual(no) {
      while (no && no.parentNode !== area) no = no.parentNode;
      return no && no.nodeType === 1 ? no : null;
    }

    // Transforma os parágrafos selecionados em título/subtítulo/citação (ou volta para texto)
    function trocarBloco(tag) {
      var sel = window.getSelection();
      if (!sel.rangeCount) return;
      var r = sel.getRangeAt(0);
      var inicio = blocoAtual(r.startContainer);
      var fim = blocoAtual(r.endContainer) || inicio;
      if (!inicio) {
        document.execCommand('formatBlock', false, tag);
        return;
      }
      var blocos = [];
      for (var no = inicio; no; no = no.nextSibling) {
        if (no.nodeType === 1) blocos.push(no);
        if (no === fim) break;
      }
      var desfazer = blocos.every(function (el) { return el.tagName.toLowerCase() === tag; });
      var novaTag = desfazer ? 'p' : tag;
      var ultimo = null;
      blocos.forEach(function (el) {
        if (/^(UL|OL|HR)$/.test(el.tagName) || el.querySelector('img')) return;
        var novo = document.createElement(novaTag);
        while (el.firstChild) novo.appendChild(el.firstChild);
        el.replaceWith(novo);
        ultimo = novo;
      });
      if (ultimo) {
        var nr = document.createRange();
        nr.selectNodeContents(ultimo);
        nr.collapse(false);
        sel.removeAllRanges();
        sel.addRange(nr);
      }
    }

    function inserirHtml(html) {
      restaurarSelecao();
      document.execCommand('insertHTML', false, html);
      sincronizar();
    }

    function enviarImagem(arquivo) {
      if (!arquivo || !/^image\//.test(arquivo.type)) return;
      var id = 'img-envio-' + Date.now();
      inserirHtml('<p><img id="' + id + '" src="' + URL.createObjectURL(arquivo) + '" alt="" class="is-enviando"></p><p><br></p>');
      caixa.classList.add('is-enviando');

      var fd = new FormData();
      fd.append('materia', arquivo);
      fetch(API + '/site/upload-imagem', { method: 'POST', body: fd, credentials: 'include' })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          var img = area.querySelector('#' + id);
          if (!res.ok || !res.d.url) throw new Error(res.d.error || 'Falha no envio');
          if (img) {
            img.src = res.d.url;
            img.removeAttribute('id');
            img.classList.remove('is-enviando');
          }
          sincronizar();
        })
        .catch(function (erro) {
          var img = area.querySelector('#' + id);
          if (img) img.closest('p') ? img.closest('p').remove() : img.remove();
          sincronizar();
          aviso('Não foi possível enviar a imagem: ' + erro.message, 'error');
        })
        .then(function () { caixa.classList.remove('is-enviando'); });
    }

    function aviso(msg, tipo) {
      if (typeof window.showToast === 'function') window.showToast(msg, tipo);
      else alert(msg);
    }

    // Botões da barra
    barra.addEventListener('mousedown', function (e) {
      if (e.target.closest('button')) e.preventDefault(); // não tira o foco do texto
    });

    barra.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-i]');
      if (!btn) return;
      var b = BOTOES[btn.dataset.i];
      restaurarSelecao();

      if (b.cmd) {
        document.execCommand(b.cmd, false, null);
      } else if (b.bloco) {
        trocarBloco(b.bloco);
      } else if (b.acao === 'linha') {
        document.execCommand('insertHTML', false, '<hr><p><br></p>');
      } else if (b.acao === 'link') {
        var sel = window.getSelection();
        var texto = sel ? String(sel) : '';
        var url = prompt('Endereço do link (ex.: https://...)', 'https://');
        if (url && url !== 'https://') {
          if (!/^(https?:|mailto:|tel:|\/)/i.test(url)) url = 'https://' + url;
          if (texto) {
            document.execCommand('createLink', false, url);
            area.querySelectorAll('a[href="' + url.replace(/"/g, '\\"') + '"]').forEach(function (a) {
              a.target = '_blank';
              a.rel = 'noopener';
            });
          } else {
            document.execCommand('insertHTML', false,
              '<a href="' + escapar(url) + '" target="_blank" rel="noopener">' + escapar(url) + '</a>&nbsp;');
          }
        }
      } else if (b.acao === 'imagem') {
        salvarSelecao();
        envio.click();
        return;
      } else if (b.acao === 'tela') {
        var cheio = caixa.classList.toggle('is-tela-cheia');
        btn.querySelector('i').className = 'bx ' + (cheio ? 'bx-exit-fullscreen' : 'bx-fullscreen');
        btn.title = cheio ? 'Sair da tela cheia' : 'Tela cheia';
        area.focus();
      }
      salvarSelecao();
      sincronizar();
    });

    envio.addEventListener('change', function () {
      Array.prototype.slice.call(envio.files || []).forEach(enviarImagem);
      envio.value = '';
    });

    area.addEventListener('input', sincronizar);
    area.addEventListener('keyup', salvarSelecao);
    area.addEventListener('mouseup', salvarSelecao);
    area.addEventListener('blur', function () { salvarSelecao(); sincronizar(); });
    document.addEventListener('selectionchange', function () {
      if (document.activeElement === area) atualizarEstado();
    });

    // Esc sai da tela cheia
    caixa.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && caixa.classList.contains('is-tela-cheia')) {
        e.stopPropagation();
        barra.querySelector('.bx-exit-fullscreen').closest('button').click();
      }
    });

    // Colar: imagens são enviadas; texto do Word/WhatsApp entra limpo
    area.addEventListener('paste', function (e) {
      var dados = e.clipboardData;
      if (!dados) return;
      var imagens = Array.prototype.slice.call(dados.files || []).filter(function (f) { return /^image\//.test(f.type); });
      if (imagens.length) {
        e.preventDefault();
        salvarSelecao();
        imagens.forEach(enviarImagem);
        return;
      }
      var html = dados.getData('text/html');
      var texto = dados.getData('text/plain');
      e.preventDefault();
      if (html) {
        var tmp = document.createElement('div');
        tmp.innerHTML = html;
        document.execCommand('insertHTML', false, limpar(tmp));
      } else if (texto) {
        document.execCommand('insertHTML', false, /\n/.test(texto) ? textoParaHtml(texto) : escapar(texto));
      }
      sincronizar();
    });

    // Arrastar fotos para dentro do texto
    area.addEventListener('dragover', function (e) {
      if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') !== -1) {
        e.preventDefault();
        caixa.classList.add('is-arrastando');
      }
    });
    area.addEventListener('dragleave', function () { caixa.classList.remove('is-arrastando'); });
    area.addEventListener('drop', function (e) {
      caixa.classList.remove('is-arrastando');
      var arquivos = e.dataTransfer ? Array.prototype.slice.call(e.dataTransfer.files || []) : [];
      if (!arquivos.length) return;
      e.preventDefault();
      if (document.caretRangeFromPoint) {
        var r = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (r) selecaoSalva = r;
      }
      arquivos.forEach(enviarImagem);
    });

    // Clicar numa imagem do texto permite escolher o que fazer com ela
    area.addEventListener('dblclick', function (e) {
      var img = e.target.closest('img');
      if (!img) return;
      var desc = prompt('Descrição da imagem (ajuda na acessibilidade). Deixe vazio e confirme para manter.', img.alt || '');
      if (desc !== null) {
        img.alt = desc;
        sincronizar();
      }
    });

    // Quando o modal abre, o app preenche o textarea: recarregamos o editor
    var modal = textarea.closest('.modal');
    if (modal) {
      var aberto = false;
      new MutationObserver(function () {
        var visivel = !modal.classList.contains('hidden') && modal.style.display !== 'none';
        if (visivel && !aberto) {
          carregar();
          setTimeout(function () {
            var titulo = modal.querySelector('.campo-titulo');
            if (titulo && !titulo.value) titulo.focus();
          }, 50);
        }
        if (!visivel && caixa.classList.contains('is-tela-cheia')) {
          caixa.classList.remove('is-tela-cheia');
          var b = barra.querySelector('.bx-exit-fullscreen');
          if (b) b.className = 'bx bx-fullscreen';
        }
        aberto = visivel;
      }).observe(modal, { attributes: true, attributeFilter: ['class', 'style'] });
    }

    // Garante que o textarea está atualizado antes de salvar
    var form = textarea.form;
    if (form) form.addEventListener('submit', sincronizar, true);

    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* ok */ }
    carregar();
  }

  // Zona de imagem de capa: aceitar arrastar e soltar
  function prepararZonasImagem() {
    document.querySelectorAll('.zona-imagem').forEach(function (zona) {
      if (zona.dataset.pronta) return;
      zona.dataset.pronta = '1';
      var input = zona.querySelector('input[type="file"]');
      ['dragenter', 'dragover'].forEach(function (ev) {
        zona.addEventListener(ev, function (e) { e.preventDefault(); zona.classList.add('is-arrastando'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        zona.addEventListener(ev, function () { zona.classList.remove('is-arrastando'); });
      });
      zona.addEventListener('drop', function (e) {
        e.preventDefault();
        if (!input || !e.dataTransfer || !e.dataTransfer.files.length) return;
        input.files = e.dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }

  function iniciar() {
    document.querySelectorAll('textarea[data-editor="materia"]').forEach(criarEditor);
    prepararZonasImagem();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
