/* ==========================================================================
   PAINEL — LOJA VIRTUAL (cadastro de produtos)
   Lista os produtos, cria, edita, exclui e envia fotos.
   As configurações da loja (WhatsApp, textos, categorias) ficam na tela
   "Configurações da loja" (painel.js).
   ========================================================================== */
(function () {
  'use strict';

  var API = '/api';
  var produtos = [];
  var categorias = [];
  var editando = null;      // produto aberto no editor (cópia)

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function aviso(msg, tipo) {
    if (typeof window.showToast === 'function') return window.showToast(msg, tipo || 'success', 4000);
    alert(msg);
  }

  // 149.9 -> "149,90" (para os campos de preço do editor)
  function precoCampo(v) {
    if (v === null || v === undefined || v === '' || isNaN(Number(v))) return '';
    return Number(v).toFixed(2).replace('.', ',');
  }

  function moeda(v) {
    var n = Number(v);
    return v === null || v === undefined || v === '' || isNaN(n) ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  async function api(caminho, opcoes) {
    var r = await fetch(API + caminho, Object.assign({ credentials: 'include' }, opcoes || {}));
    var dados = null;
    try { dados = await r.json(); } catch (e) { /* sem corpo */ }
    if (!r.ok) throw new Error((dados && dados.error) || ('Erro ' + r.status));
    return dados;
  }

  var raiz = function () { return document.getElementById('lojaAdmin'); };

  /* ---------------- Lista de produtos ---------------- */

  async function carregar() {
    var el = raiz();
    el.innerHTML = '<div class="painel-carregando"><i class="bx bx-loader-alt bx-spin"></i> Carregando produtos…</div>';
    try {
      var res = await Promise.all([api('/admin/loja/produtos'), api('/site/config-geral')]);
      produtos = res[0] || [];
      categorias = ((res[1] && res[1].loja && res[1].loja.categorias) || []).map(function (c) { return c.nome; });
      montarLista();
    } catch (e) {
      el.innerHTML = '<p class="pf-nota"><i class="bx bx-error-circle"></i> Não foi possível carregar os produtos: ' + esc(e.message) + '</p>';
    }
  }

  function montarLista() {
    var el = raiz();
    var cats = categorias.slice();
    produtos.forEach(function (p) { if (p.categoria && cats.indexOf(p.categoria) === -1) cats.push(p.categoria); });

    el.innerHTML =
      '<div class="pf-cabecalho"><div><h2>Produtos da loja</h2><p>Cadastre livros, blusas, calças, moletons… Clique num produto para editar.</p></div>' +
        '<div class="pl-acoes-topo">' +
          '<a class="btn btn-secondary" href="/loja.html" target="_blank" rel="noopener"><i class="bx bx-show"></i> Ver a loja</a>' +
          '<button class="btn btn-primary pl-novo" data-pl="novo"><i class="bx bx-plus"></i> Novo produto</button>' +
        '</div></div>' +
      '<div class="pl-filtros">' +
        '<label class="pl-busca"><i class="bx bx-search"></i><input type="search" id="plBusca" placeholder="Buscar produto…"></label>' +
        '<select id="plCategoria"><option value="">Todas as categorias</option>' + cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select>' +
        '<span class="pl-total" id="plTotal"></span>' +
      '</div>' +
      '<div class="pl-grade" id="plGrade"></div>';

    renderizarGrade();
  }

  function renderizarGrade() {
    var q = (document.getElementById('plBusca').value || '').toLowerCase();
    var cat = document.getElementById('plCategoria').value;
    var lista = produtos.filter(function (p) {
      if (cat && p.categoria !== cat) return false;
      return !q || (p.nome + ' ' + (p.categoria || '')).toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return (a.ordem || 999) - (b.ordem || 999) || b.id - a.id; });

    document.getElementById('plTotal').textContent = lista.length + ' de ' + produtos.length + ' produtos';
    var grade = document.getElementById('plGrade');
    if (!produtos.length) {
      grade.innerHTML = '<div class="pl-vazio"><i class="bx bx-shopping-bag"></i><h3>Nenhum produto cadastrado ainda</h3><p>Comece cadastrando o primeiro produto da Loja do Reino.</p>' +
        '<button class="btn btn-primary pl-novo" data-pl="novo"><i class="bx bx-plus"></i> Cadastrar produto</button></div>';
      return;
    }
    grade.innerHTML = lista.map(function (p) {
      var foto = (p.imagens || [])[0];
      return '<article class="pl-card' + (p.ativo === false ? ' is-oculto' : '') + '" data-pl="editar" data-id="' + p.id + '">' +
        '<div class="pl-card__foto">' + (foto ? '<img src="' + esc(foto) + '" alt="">' : '<i class="bx bx-image"></i>') +
          '<div class="pl-card__selos">' +
            (p.ativo === false ? '<span class="pl-selo pl-selo--oculto"><i class="bx bx-hide"></i> Oculto</span>' : '') +
            (p.esgotado ? '<span class="pl-selo pl-selo--esgotado">Esgotado</span>' : '') +
            (p.destaque ? '<span class="pl-selo pl-selo--destaque"><i class="bx bxs-star"></i> Destaque</span>' : '') +
          '</div></div>' +
        '<div class="pl-card__corpo"><small>' + esc(p.categoria || 'Sem categoria') + '</small><strong>' + esc(p.nome) + '</strong>' +
          '<span class="pl-card__preco">' + (p.precoAntigo ? '<s>' + moeda(p.precoAntigo) + '</s> ' : '') + moeda(p.preco) + '</span></div>' +
        '<div class="pl-card__acoes">' +
          '<button data-pl="editar" data-id="' + p.id + '"><i class="bx bx-edit"></i> Editar</button>' +
          '<a href="/produto.html?id=' + p.id + '" target="_blank" rel="noopener" title="Ver no site"><i class="bx bx-show"></i></a>' +
          '<button data-pl="excluir" data-id="' + p.id + '" title="Excluir" class="pl-excluir"><i class="bx bx-trash"></i></button>' +
        '</div>' +
      '</article>';
    }).join('') || '<p class="pf-nota">Nenhum produto com esse filtro.</p>';
  }

  /* ---------------- Editor ---------------- */

  function liga(id, rotulo, marcado, ajuda) {
    return '<label class="pf-liga"><input type="checkbox" id="' + id + '"' + (marcado ? ' checked' : '') + '>' +
      '<span class="pf-liga__trilho"></span><span>' + rotulo + (ajuda ? '<small class="pl-liga-ajuda">' + ajuda + '</small>' : '') + '</span></label>';
  }

  function abrirEditor(produto) {
    editando = produto ? JSON.parse(JSON.stringify(produto)) : {
      nome: '', categoria: categorias[0] || '', preco: '', precoAntigo: '', descricao: '',
      imagens: [], tamanhos: [], cores: [], destaque: false, esgotado: false, ativo: true, ordem: ''
    };
    var p = editando;
    var cats = categorias.slice();
    if (p.categoria && cats.indexOf(p.categoria) === -1) cats.push(p.categoria);

    var antigo = document.getElementById('plEditor');
    if (antigo) antigo.remove();
    var gaveta = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'plEditor', className: 'pl-editor' }));
    gaveta.innerHTML =
      '<div class="pl-editor__fundo" data-pl="fechar"></div>' +
      '<form class="pl-editor__caixa" id="plForm" novalidate>' +
        '<header class="pl-editor__topo"><h2>' + (p.id ? 'Editar produto' : 'Novo produto') + '</h2>' +
          '<button type="button" class="pl-fechar" data-pl="fechar" aria-label="Fechar"><i class="bx bx-x"></i></button></header>' +
        '<div class="pl-editor__corpo">' +

          '<section class="pf-grupo"><h3>Fotos</h3><p class="pf-grupo__ajuda">A primeira foto é a principal (aparece na loja). Use as setas para mudar a ordem. Fotos quadradas ficam melhores.</p>' +
            '<div class="pl-fotos" id="plFotos"></div>' +
            '<label class="btn btn-secondary btn-small pl-enviar"><i class="bx bx-upload"></i> Enviar fotos<input type="file" id="plArquivos" accept="image/*" multiple hidden></label>' +
            '<div class="pf-progresso" id="plProgresso" hidden><span></span></div>' +
          '</section>' +

          '<section class="pf-grupo"><h3>Informações</h3><div class="pf-campos">' +
            '<div class="pf-campo"><label for="plNome">Nome do produto *</label><input type="text" id="plNome" value="' + esc(p.nome) + '" placeholder="Ex.: Moletom Reino dos Céus azul"></div>' +
            '<div class="pf-campos pf-campos--3">' +
              '<div class="pf-campo"><label for="plCat">Categoria</label><select id="plCat">' +
                cats.map(function (c) { return '<option' + (c === p.categoria ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') +
                '<option value="__nova">+ Nova categoria…</option></select></div>' +
              '<div class="pf-campo"><label for="plPreco">Preço (R$)</label><input type="text" inputmode="decimal" id="plPreco" value="' + esc(precoCampo(p.preco)) + '" placeholder="Ex.: 89,90"></div>' +
              '<div class="pf-campo"><label for="plPrecoAntigo">Preço antigo (promoção)</label><input type="text" inputmode="decimal" id="plPrecoAntigo" value="' + esc(precoCampo(p.precoAntigo)) + '" placeholder="Opcional"></div>' +
            '</div>' +
            '<div class="pf-campo"><label for="plDesc">Descrição</label><textarea id="plDesc" rows="5" placeholder="Material, tamanho, detalhes do produto…">' + esc(p.descricao) + '</textarea></div>' +
          '</div></section>' +

          '<section class="pf-grupo"><h3>Opções para o cliente escolher</h3><p class="pf-grupo__ajuda">Separe por vírgula. Deixe vazio se o produto não tiver (ex.: livros).</p><div class="pf-campos">' +
            '<div class="pf-campo"><label for="plTamanhos">Tamanhos</label><input type="text" id="plTamanhos" value="' + esc((p.tamanhos || []).join(', ')) + '" placeholder="Ex.: P, M, G, GG">' +
              '<div class="pl-rapidos"><span>Preencher:</span><button type="button" data-tam="P, M, G, GG">P M G GG</button><button type="button" data-tam="PP, P, M, G, GG, XG">PP ao XG</button><button type="button" data-tam="36, 38, 40, 42, 44, 46">36 ao 46</button><button type="button" data-tam="">Limpar</button></div></div>' +
            '<div class="pf-campo"><label for="plCores">Cores</label><input type="text" id="plCores" value="' + esc((p.cores || []).join(', ')) + '" placeholder="Ex.: Azul-marinho, Branco, Preto"></div>' +
          '</div></section>' +

          '<section class="pf-grupo"><h3>Exibição</h3><div class="pf-campos pf-campos--2">' +
            liga('plAtivo', 'Mostrar no site', p.ativo !== false, 'Desligue para esconder sem excluir') +
            liga('plDestaque', 'Produto em destaque', !!p.destaque, 'Aparece primeiro e na página inicial') +
            liga('plEsgotado', 'Esgotado', !!p.esgotado, 'Continua visível, com o aviso "Esgotado"') +
            '<div class="pf-campo"><label for="plOrdem">Ordem na loja</label><input type="number" id="plOrdem" min="1" value="' + esc(p.ordem) + '" placeholder="1 = primeiro"></div>' +
          '</div></section>' +

        '</div>' +
        '<footer class="pl-editor__rodape">' +
          (p.id ? '<button type="button" class="btn btn-secondary pl-excluir" data-pl="excluir" data-id="' + p.id + '"><i class="bx bx-trash"></i> Excluir</button>' : '') +
          '<span class="pl-espaco"></span>' +
          '<button type="button" class="btn btn-secondary" data-pl="fechar">Cancelar</button>' +
          '<button type="submit" class="btn btn-primary" id="plSalvar"><i class="bx bx-save"></i> Salvar produto</button>' +
        '</footer>' +
      '</form>';

    void gaveta.offsetWidth; // garante a animação de abertura
    gaveta.classList.add('is-aberto');
    document.body.style.overflow = 'hidden';
    renderizarFotos();
    setTimeout(function () { document.getElementById('plNome').focus(); }, 50);
  }

  function fecharEditor() {
    var g = document.getElementById('plEditor');
    if (g) {
      g.classList.remove('is-aberto');
      // Remove o editor depois da animação (para nenhum botão dele ficar na tela)
      setTimeout(function () { if (!g.classList.contains('is-aberto')) g.remove(); }, 380);
    }
    document.body.style.overflow = '';
    editando = null;
  }

  function renderizarFotos() {
    var lista = editando.imagens || [];
    document.getElementById('plFotos').innerHTML = lista.length
      ? lista.map(function (url, i) {
          return '<div class="pl-foto">' + (i === 0 ? '<span class="pl-foto__principal">Principal</span>' : '') +
            '<img src="' + esc(url) + '" alt="">' +
            '<div class="pl-foto__botoes">' +
              '<button type="button" data-foto="esq" data-i="' + i + '"' + (i === 0 ? ' disabled' : '') + ' title="Mover para a esquerda"><i class="bx bx-chevron-left"></i></button>' +
              '<button type="button" data-foto="remover" data-i="' + i + '" title="Remover foto"><i class="bx bx-trash"></i></button>' +
              '<button type="button" data-foto="dir" data-i="' + i + '"' + (i === lista.length - 1 ? ' disabled' : '') + ' title="Mover para a direita"><i class="bx bx-chevron-right"></i></button>' +
            '</div></div>';
        }).join('')
      : '<p class="pf-nota"><i class="bx bx-image-add"></i> Nenhuma foto ainda. Envie pelo botão abaixo.</p>';
  }

  function enviarFoto(arquivo) {
    return new Promise(function (resolve, reject) {
      var fd = new FormData();
      fd.append('materia', arquivo);
      var xhr = new XMLHttpRequest();
      xhr.open('POST', API + '/site/upload-imagem');
      xhr.withCredentials = true;
      var barra = document.querySelector('#plProgresso span');
      xhr.upload.onprogress = function (ev) { if (ev.lengthComputable && barra) barra.style.width = Math.round(ev.loaded / ev.total * 100) + '%'; };
      xhr.onload = function () {
        var r = {};
        try { r = JSON.parse(xhr.responseText); } catch (e) { /* inválido */ }
        if (xhr.status < 300 && r.url) resolve(r.url); else reject(new Error(r.error || 'Erro ' + xhr.status));
      };
      xhr.onerror = function () { reject(new Error('Erro de conexão')); };
      xhr.send(fd);
    });
  }

  function lerEditor() {
    var cat = document.getElementById('plCat').value;
    return {
      nome: document.getElementById('plNome').value.trim(),
      categoria: cat === '__nova' ? '' : cat,
      preco: document.getElementById('plPreco').value.trim(),
      precoAntigo: document.getElementById('plPrecoAntigo').value.trim(),
      descricao: document.getElementById('plDesc').value,
      imagens: editando.imagens || [],
      tamanhos: document.getElementById('plTamanhos').value,
      cores: document.getElementById('plCores').value,
      ativo: document.getElementById('plAtivo').checked,
      destaque: document.getElementById('plDestaque').checked,
      esgotado: document.getElementById('plEsgotado').checked,
      ordem: document.getElementById('plOrdem').value
    };
  }

  async function salvar() {
    var dados = lerEditor();
    if (!dados.nome) { aviso('Informe o nome do produto.', 'error'); document.getElementById('plNome').focus(); return; }
    var botao = document.getElementById('plSalvar');
    botao.disabled = true;
    botao.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Salvando…';
    try {
      var id = editando.id;
      await api(id ? '/admin/loja/produtos/' + id : '/admin/loja/produtos', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });
      aviso(id ? 'Produto atualizado!' : 'Produto cadastrado! Ele já aparece na loja.', 'success');
      fecharEditor();
      carregar();
    } catch (e) {
      aviso('Não foi possível salvar: ' + e.message, 'error');
      botao.disabled = false;
      botao.innerHTML = '<i class="bx bx-save"></i> Salvar produto';
    }
  }

  async function excluir(id) {
    var p = produtos.find(function (x) { return String(x.id) === String(id); });
    if (!confirm('Excluir o produto "' + (p ? p.nome : '') + '"? Essa ação não pode ser desfeita.')) return;
    try {
      await api('/admin/loja/produtos/' + id, { method: 'DELETE' });
      aviso('Produto excluído.', 'success');
      fecharEditor();
      carregar();
    } catch (e) {
      aviso('Não foi possível excluir: ' + e.message, 'error');
    }
  }

  /* ---------------- Eventos ---------------- */

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pl]');
    if (b) {
      var acao = b.dataset.pl;
      if (acao === 'novo') abrirEditor(null);
      if (acao === 'editar') {
        if (e.target.closest('a')) return; // link "ver no site"
        if (e.target.closest('[data-pl="excluir"]')) return;
        abrirEditor(produtos.find(function (x) { return String(x.id) === String(b.dataset.id); }));
      }
      if (acao === 'excluir') { e.stopPropagation(); excluir(b.dataset.id); }
      if (acao === 'fechar') fecharEditor();
      return;
    }

    var f = e.target.closest('[data-foto]');
    if (f && editando) {
      var i = Number(f.dataset.i), lista = editando.imagens;
      if (f.dataset.foto === 'remover') lista.splice(i, 1);
      if (f.dataset.foto === 'esq' && i > 0) lista.splice(i - 1, 0, lista.splice(i, 1)[0]);
      if (f.dataset.foto === 'dir' && i < lista.length - 1) lista.splice(i + 1, 0, lista.splice(i, 1)[0]);
      renderizarFotos();
      return;
    }

    var t = e.target.closest('[data-tam]');
    if (t) document.getElementById('plTamanhos').value = t.dataset.tam;
  });

  document.addEventListener('submit', function (e) {
    if (e.target.id === 'plForm') { e.preventDefault(); salvar(); }
  });

  document.addEventListener('change', async function (e) {
    if (e.target.id === 'plCat' && e.target.value === '__nova') {
      var nome = (prompt('Nome da nova categoria:') || '').trim();
      if (!nome) { e.target.selectedIndex = 0; return; }
      var opt = new Option(nome, nome, true, true);
      e.target.insertBefore(opt, e.target.lastElementChild);
      aviso('Dica: cadastre a categoria também em "Configurações da loja" para escolher o ícone dela.', 'info');
    }

    if (e.target.id === 'plCategoria') renderizarGrade();

    if (e.target.id === 'plArquivos' && e.target.files.length) {
      var arquivos = Array.prototype.slice.call(e.target.files);
      var barra = document.getElementById('plProgresso');
      barra.hidden = false;
      for (var k = 0; k < arquivos.length; k++) {
        try {
          var url = await enviarFoto(arquivos[k]);
          if (!editando) break;
          editando.imagens.push(url);
          renderizarFotos();
        } catch (er) {
          aviso('Erro ao enviar "' + arquivos[k].name + '": ' + er.message, 'error');
        }
      }
      barra.hidden = true;
      e.target.value = '';
    }
  });

  document.addEventListener('input', function (e) {
    if (e.target.id === 'plBusca') renderizarGrade();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && editando) fecharEditor();
  });

  // Abre a lista quando a aba "Produtos" é escolhida no menu
  document.addEventListener('click', function (e) {
    var aba = e.target.closest('.tab-btn[data-tab="loja"]');
    if (aba) carregar();
  });
})();
