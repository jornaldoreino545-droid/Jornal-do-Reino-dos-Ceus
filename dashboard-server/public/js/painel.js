/* ==========================================================================
   PAINEL DO JORNAL DO REINO
   - Menu lateral (troca de telas, título da página, menu no celular)
   - Visão geral (números do site e atalhos)
   - Telas de configuração do site (contatos, topo/rodapé, página inicial,
     edições e preço, oferta/PIX, abertura em vídeo, títulos, formulário)

   As telas de configuração são montadas a partir dos FORMULARIOS abaixo.
   Para criar um campo novo: acrescente-o aqui e no padrão do servidor
   (dashboard-server/config/site-geral.js).
   ========================================================================== */
(function () {
  'use strict';

  var API = '/api';
  var config = null;        // configuração carregada do servidor
  var alterado = false;     // há mudanças não salvas?

  /* ---------------- Utilitários ---------------- */

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pegar(obj, caminho) {
    return caminho.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }

  function definir(obj, caminho, valor) {
    var partes = caminho.split('.');
    var ultimo = partes.pop();
    var alvo = partes.reduce(function (o, k) { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; return o[k]; }, obj);
    alvo[ultimo] = valor;
  }

  function aviso(msg, tipo) {
    if (typeof window.showToast === 'function') return window.showToast(msg, tipo || 'success', 4000);
    alert(msg);
  }

  function moeda(v) {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  async function api(caminho, opcoes) {
    var r = await fetch(API + caminho, Object.assign({ credentials: 'include' }, opcoes || {}));
    var dados = null;
    try { dados = await r.json(); } catch (e) { /* sem corpo */ }
    if (!r.ok) throw new Error((dados && dados.error) || ('Erro ' + r.status));
    return dados;
  }

  /* ---------------- Ícones disponíveis (boxicons) ---------------- */

  var ICONES = [
    ['bxs-file-pdf', 'PDF'], ['bx-calendar-star', 'Calendário'], ['bx-church', 'Igreja'], ['bx-check-double', 'Confirmado'],
    ['bx-book-open', 'Livro aberto'], ['bx-bible', 'Bíblia'], ['bx-heart', 'Coração'], ['bx-donate-heart', 'Doação'],
    ['bx-gift', 'Presente'], ['bx-star', 'Estrela'], ['bx-crown', 'Coroa'], ['bx-world', 'Mundo'],
    ['bx-mobile', 'Celular'], ['bx-envelope', 'E-mail'], ['bx-download', 'Download'], ['bx-lock-alt', 'Seguro'],
    ['bx-time-five', 'Relógio'], ['bx-group', 'Pessoas'], ['bx-news', 'Jornal'], ['bx-truck', 'Entrega'],
    ['bx-credit-card', 'Cartão'], ['bx-qr', 'QR Code'], ['bx-happy-heart-eyes', 'Alegria'], ['bx-sun', 'Sol'],
    ['bx-book', 'Livro'], ['bx-closet', 'Roupas'], ['bx-body', 'Calça / corpo'], ['bx-cloud-snow', 'Frio (moletom)'],
    ['bx-shopping-bag', 'Sacola'], ['bx-store-alt', 'Loja'], ['bx-purchase-tag', 'Etiqueta'], ['bx-diamond', 'Acessório']
  ];

  /* ---------------- Definição das telas ---------------- */

  var DICA_DESTAQUE = 'Dica: escreva *palavra* entre asteriscos para ela aparecer destacada em cor.';

  function cabecalhoSecao(base, titulo, extra) {
    return {
      grupo: titulo,
      campos: [
        { caminho: base + '.sobretitulo', rotulo: 'Texto pequeno acima do título', tipo: 'texto' },
        { caminho: base + '.titulo', rotulo: 'Título', tipo: 'texto', ajuda: DICA_DESTAQUE },
        { caminho: base + '.subtitulo', rotulo: 'Texto abaixo do título', tipo: 'area' }
      ].concat(extra || [])
    };
  }

  var FORMULARIOS = {
    inicio: {
      titulo: 'Seções e títulos da página inicial',
      descricao: 'Escolha quais seções aparecem na página inicial e edite os títulos e textos de cada uma.',
      verNoSite: '/',
      grupos: [
        {
          grupo: 'Mostrar na página inicial',
          ajuda: 'Desligue para esconder a seção do site (o conteúdo continua salvo).',
          campos: [
            { caminho: 'inicio.mostrar.carrossel', rotulo: 'Carrossel principal', tipo: 'liga' },
            { caminho: 'inicio.mostrar.vantagens', rotulo: 'Faixa de vantagens', tipo: 'liga' },
            { caminho: 'inicio.mostrar.edicoes', rotulo: 'Edições do jornal', tipo: 'liga' },
            { caminho: 'inicio.mostrar.video', rotulo: 'Vídeo', tipo: 'liga' },
            { caminho: 'inicio.mostrar.sobreJornal', rotulo: 'Sobre o jornal', tipo: 'liga' },
            { caminho: 'inicio.mostrar.santuarios', rotulo: 'Santuários campeões', tipo: 'liga' },
            { caminho: 'inicio.mostrar.igreja', rotulo: 'Sobre a igreja', tipo: 'liga' },
            { caminho: 'inicio.mostrar.equipe', rotulo: 'Responsáveis', tipo: 'liga' },
            { caminho: 'inicio.mostrar.ajuda', rotulo: 'Perguntas e contato', tipo: 'liga' },
            { caminho: 'inicio.mostrar.sites', rotulo: 'Sites da igreja', tipo: 'liga' },
            { caminho: 'inicio.mostrar.loja', rotulo: 'Produtos da loja', tipo: 'liga' }
          ],
          colunas: 2
        },
        {
          grupo: 'Faixa de vantagens (logo abaixo do carrossel)',
          campos: [{
            caminho: 'inicio.vantagens', tipo: 'lista', maximo: 4, novoItem: { icone: 'bx-star', titulo: 'Novo item', texto: '' },
            rotuloItem: 'Vantagem',
            campos: [
              { chave: 'icone', rotulo: 'Ícone', tipo: 'icone' },
              { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
              { chave: 'texto', rotulo: 'Texto', tipo: 'area' }
            ]
          }]
        },
        cabecalhoSecao('inicio.edicoes', 'Seção "Edições do jornal"', [
          { caminho: 'inicio.edicoes.quantidade', rotulo: 'Quantas edições mostrar', tipo: 'numero', min: 1, max: 24 }
        ]),
        cabecalhoSecao('inicio.santuarios', 'Seção "Santuários campeões"', [
          { tipo: 'nota', texto: 'As fotos desta seção ficam no menu <b>Santuários campeões</b>.' }
        ]),
        cabecalhoSecao('inicio.loja', 'Seção "Loja do Reino" (produtos em destaque)', [
          { caminho: 'inicio.loja.quantidade', rotulo: 'Quantos produtos mostrar', tipo: 'numero', min: 1, max: 12 },
          { tipo: 'nota', texto: 'Aparecem primeiro os produtos marcados como <b>destaque</b> em Loja virtual › Produtos.' }
        ]),
        cabecalhoSecao('inicio.equipe', 'Seção "Responsáveis"'),
        cabecalhoSecao('inicio.ajuda', 'Seção "Perguntas frequentes e contato"', [
          { caminho: 'inicio.ajuda.contatoTitulo', rotulo: 'Título do cartão de contato', tipo: 'texto' },
          { caminho: 'inicio.ajuda.contatoTexto', rotulo: 'Texto do cartão de contato', tipo: 'area' }
        ]),
        cabecalhoSecao('inicio.sites', 'Seção "Sites da igreja"')
      ]
    },

    edicoes: {
      titulo: 'Página de edições e preço',
      descricao: 'Textos da página "Edições", o preço padrão do jornal e os benefícios mostrados na compra.',
      verNoSite: '/pag-saibaMais.html',
      grupos: [
        {
          grupo: 'Preço',
          campos: [
            { caminho: 'edicoes.precoPadrao', rotulo: 'Preço padrão da versão digital (R$)', tipo: 'numero', passo: 0.01, min: 0,
              ajuda: 'Vale para todos os jornais que não têm preço próprio. Para mudar o preço de um jornal específico, edite o jornal em "Edições do jornal".' }
          ]
        },
        cabecalhoSecao('edicoes', 'Topo da página "Edições"'),
        {
          grupo: 'Benefícios ("Como funciona")',
          ajuda: 'Aparecem na página de edições e na página de compra de cada jornal.',
          campos: [{
            caminho: 'edicoes.beneficios', tipo: 'lista', maximo: 6, novoItem: { icone: 'bx-star', titulo: 'Novo benefício', texto: '' },
            rotuloItem: 'Benefício',
            campos: [
              { chave: 'icone', rotulo: 'Ícone', tipo: 'icone' },
              { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
              { chave: 'texto', rotulo: 'Texto', tipo: 'area' }
            ]
          }]
        }
      ]
    },

    oferta: {
      titulo: 'Oferta (PIX)',
      descricao: 'Chave PIX, QR Code e textos da página de oferta.',
      verNoSite: '/pag.oferta.html',
      grupos: [
        {
          grupo: 'PIX',
          campos: [
            { caminho: 'oferta.cnpj', rotulo: 'Chave PIX (CNPJ)', tipo: 'texto' },
            { caminho: 'oferta.qrCode', rotulo: 'Imagem do QR Code', tipo: 'imagem', ajuda: 'Envie a imagem do QR Code gerada pelo seu banco.' }
          ]
        },
        cabecalhoSecao('oferta', 'Topo da página'),
        {
          grupo: 'Passo a passo',
          campos: [{
            caminho: 'oferta.passos', tipo: 'lista', maximo: 6, novoItem: { titulo: 'Novo passo', texto: '' }, rotuloItem: 'Passo',
            campos: [
              { chave: 'titulo', rotulo: 'Título', tipo: 'texto' },
              { chave: 'texto', rotulo: 'Texto', tipo: 'area' }
            ]
          }]
        },
        {
          grupo: 'Versículo',
          campos: [
            { caminho: 'oferta.versiculo', rotulo: 'Versículo (deixe vazio para esconder)', tipo: 'area' },
            { caminho: 'oferta.referencia', rotulo: 'Referência', tipo: 'texto' }
          ]
        }
      ]
    },

    contato: {
      titulo: 'Contato e redes sociais',
      descricao: 'Aparecem no topo, no rodapé, na página inicial e na página de notícias.',
      verNoSite: '/',
      grupos: [
        {
          grupo: 'Contato',
          campos: [
            { caminho: 'contato.email', rotulo: 'E-mail', tipo: 'texto', icone: 'bx-envelope' },
            { caminho: 'contato.telefone', rotulo: 'Telefone (como deve aparecer)', tipo: 'texto', icone: 'bx-phone' },
            { caminho: 'contato.whatsapp', rotulo: 'WhatsApp (com DDD, só números)', tipo: 'texto', icone: 'bxl-whatsapp', ajuda: 'Ex.: 5511981739716 (55 + DDD + número).' }
          ],
          colunas: 3
        },
        {
          grupo: 'Redes sociais',
          ajuda: 'Deixe vazio para esconder o ícone da rede no site.',
          campos: [
            { caminho: 'contato.instagram', rotulo: 'Instagram (link)', tipo: 'texto', icone: 'bxl-instagram' },
            { caminho: 'contato.facebook', rotulo: 'Facebook (link)', tipo: 'texto', icone: 'bxl-facebook' },
            { caminho: 'contato.youtube', rotulo: 'YouTube (link)', tipo: 'texto', icone: 'bxl-youtube' }
          ],
          colunas: 3
        }
      ]
    },

    layout: {
      titulo: 'Topo e rodapé',
      descricao: 'A frase da faixa vermelha, o botão do menu e os textos do rodapé (aparecem em todas as páginas).',
      verNoSite: '/',
      grupos: [
        {
          grupo: 'Topo do site',
          campos: [
            { caminho: 'cabecalho.frase', rotulo: 'Frase da faixa vermelha', tipo: 'area', ajuda: 'Escreva *palavra* entre asteriscos para ela aparecer em dourado.' },
            { caminho: 'cabecalho.textoBotao', rotulo: 'Texto do botão dourado do menu', tipo: 'texto' }
          ]
        },
        {
          grupo: 'Rodapé',
          campos: [
            { caminho: 'rodape.sobre', rotulo: 'Texto "sobre o jornal"', tipo: 'area' },
            { caminho: 'rodape.versiculo', rotulo: 'Versículo (deixe vazio para esconder)', tipo: 'texto' },
            { caminho: 'rodape.referencia', rotulo: 'Referência do versículo', tipo: 'texto' }
          ]
        }
      ]
    },

    abertura: {
      titulo: 'Abertura e carregamento',
      descricao: 'O vídeo que aparece ao entrar no site e a animação do jornal sendo impresso ao trocar de página.',
      verNoSite: '/',
      grupos: [
        {
          grupo: 'Abertura em vídeo',
          ajuda: 'Toca ao entrar no site ou ao atualizar a página.',
          campos: [
            { caminho: 'abertura.ativa', rotulo: 'Mostrar a abertura em vídeo', tipo: 'liga' },
            { caminho: 'abertura.video', rotulo: 'Vídeo (computador)', tipo: 'video', ajuda: 'Use MP4 — é o formato que toca em todos os navegadores e no iPhone.' },
            { caminho: 'abertura.videoCelular', rotulo: 'Vídeo para celular (opcional, mais leve)', tipo: 'video', ajuda: 'Se ficar vazio, o celular usa o mesmo vídeo do computador.' },
            { caminho: 'abertura.marcaEm', rotulo: 'Segundo em que o logo e o botão aparecem', tipo: 'numero', passo: 0.1, min: 0 },
            { caminho: 'abertura.frase', rotulo: 'Frase abaixo do nome do jornal', tipo: 'texto' },
            { caminho: 'abertura.textoBotao', rotulo: 'Texto do botão', tipo: 'texto' }
          ]
        },
        {
          grupo: 'Tela de carregamento (jornal sendo impresso)',
          ajuda: 'Aparece ao trocar de página dentro do site.',
          campos: [
            { caminho: 'carregamento.ativo', rotulo: 'Mostrar a tela de carregamento', tipo: 'liga' },
            { caminho: 'carregamento.texto', rotulo: 'Texto embaixo da animação', tipo: 'texto' },
            { caminho: 'carregamento.duracao', rotulo: 'Duração (segundos)', tipo: 'numero', passo: 0.1, min: 1, max: 6 }
          ]
        }
      ]
    },

    paginas: {
      titulo: 'Títulos das páginas',
      descricao: 'Topo das páginas de Colunistas e Notícias.',
      verNoSite: '/pag.colunista.html',
      grupos: [
        cabecalhoSecao('colunistas', 'Página "Colunistas"'),
        {
          grupo: 'Página "Notícias"',
          campos: [
            { caminho: 'noticias.titulo', rotulo: 'Título do portal', tipo: 'texto', ajuda: 'A parte entre *asteriscos* aparece em vermelho.' },
            { caminho: 'noticias.porPagina', rotulo: 'Notícias carregadas por vez', tipo: 'numero', min: 2, max: 30 }
          ]
        }
      ]
    },

    loja: {
      titulo: 'Configurações da loja',
      descricao: 'WhatsApp que recebe os pedidos, textos da loja e categorias de produtos.',
      verNoSite: '/loja.html',
      grupos: [
        {
          grupo: 'Pedidos pelo WhatsApp',
          ajuda: 'Quando o cliente clica para comprar, abre o WhatsApp deste número com o produto, tamanho, cor e preço já escritos.',
          campos: [
            { caminho: 'loja.ativa', rotulo: 'Loja aberta (aparece no menu do site)', tipo: 'liga' },
            { caminho: 'loja.whatsapp', rotulo: 'WhatsApp da loja (55 + DDD + número, só dígitos)', tipo: 'texto', icone: 'bxl-whatsapp', ajuda: 'Ex.: 553175251828. Se o número for de celular com 9 na frente, inclua o 9 (ex.: 5531975251828).' },
            { caminho: 'loja.telefoneExibicao', rotulo: 'Número como aparece no site', tipo: 'texto', icone: 'bx-phone' },
            { caminho: 'loja.mensagem', rotulo: 'Começo da mensagem enviada', tipo: 'area' },
            { caminho: 'loja.textoBotao', rotulo: 'Texto do botão de compra', tipo: 'texto' },
            { caminho: 'loja.avisoEntrega', rotulo: 'Aviso sobre pagamento e entrega', tipo: 'area' }
          ]
        },
        cabecalhoSecao('loja', 'Topo da página da loja'),
        {
          grupo: 'Categorias',
          ajuda: 'Aparecem como botões no topo da loja. Os produtos são ligados à categoria pelo nome.',
          campos: [{
            caminho: 'loja.categorias', tipo: 'lista', maximo: 12, novoItem: { nome: 'Nova categoria', icone: 'bx-purchase-tag' }, rotuloItem: 'Categoria',
            campos: [
              { chave: 'icone', rotulo: 'Ícone', tipo: 'icone' },
              { chave: 'nome', rotulo: 'Nome', tipo: 'texto' }
            ]
          }]
        }
      ]
    },

    formulario: {
      titulo: 'Formulário de contato',
      descricao: 'O formulário "Fale conosco" da página inicial envia as mensagens pelo serviço StaticForms.',
      verNoSite: '/#contato',
      grupos: [
        {
          grupo: 'Envio das mensagens',
          campos: [
            { caminho: 'formulario.ativo', rotulo: 'Mostrar o formulário no site', tipo: 'liga' },
            { caminho: 'formulario.apiKey', rotulo: 'Chave do StaticForms (apiKey)', tipo: 'texto', ajuda: 'Encontrada no painel do staticforms.xyz. As mensagens chegam no e-mail cadastrado lá.' },
            { caminho: 'formulario.redirectTo', rotulo: 'Página de "obrigado" depois do envio (endereço completo)', tipo: 'texto', ajuda: 'Ex.: https://seusite.com.br/pag-Obrigado.html' }
          ]
        }
      ]
    }
  };

  /* ---------------- Montagem dos campos ---------------- */

  function campoHtml(c, valor, id) {
    var ajuda = c.ajuda ? '<small class="pf-ajuda">' + esc(c.ajuda) + '</small>' : '';
    var icone = c.icone ? '<i class="bx ' + c.icone + ' pf-icone-campo"></i>' : '';
    switch (c.tipo) {
      case 'nota':
        return '<p class="pf-nota"><i class="bx bx-info-circle"></i> ' + c.texto + '</p>';
      case 'liga':
        return '<label class="pf-liga"><input type="checkbox" id="' + id + '"' + (valor !== false ? ' checked' : '') + '>' +
          '<span class="pf-liga__trilho"></span><span>' + esc(c.rotulo) + '</span></label>';
      case 'area':
        return '<div class="pf-campo"><label for="' + id + '">' + esc(c.rotulo) + '</label>' +
          '<textarea id="' + id + '" rows="3">' + esc(valor) + '</textarea>' + ajuda + '</div>';
      case 'numero':
        return '<div class="pf-campo"><label for="' + id + '">' + esc(c.rotulo) + '</label>' +
          '<input type="number" id="' + id + '" value="' + esc(valor) + '"' +
          (c.passo ? ' step="' + c.passo + '"' : '') + (c.min !== undefined ? ' min="' + c.min + '"' : '') + (c.max !== undefined ? ' max="' + c.max + '"' : '') + '>' + ajuda + '</div>';
      case 'icone':
        return '<div class="pf-campo"><label for="' + id + '">' + esc(c.rotulo) + '</label>' +
          '<div class="pf-icone"><i class="bx ' + esc(valor) + '" data-previa="' + id + '"></i>' +
          '<select id="' + id + '">' + ICONES.map(function (ic) {
            return '<option value="' + ic[0] + '"' + (ic[0] === valor ? ' selected' : '') + '>' + ic[1] + '</option>';
          }).join('') + '</select></div></div>';
      case 'imagem':
      case 'video':
        var previa = valor
          ? (c.tipo === 'imagem' ? '<img src="' + esc(valor) + '" alt="">' : '<video src="' + esc(valor) + '" muted controls preload="metadata"></video>')
          : '<span class="pf-arquivo__vazio">Nenhum arquivo</span>';
        return '<div class="pf-campo"><label>' + esc(c.rotulo) + '</label>' +
          '<div class="pf-arquivo" data-arquivo="' + id + '">' +
            '<div class="pf-arquivo__previa">' + previa + '</div>' +
            '<div class="pf-arquivo__acoes">' +
              '<label class="btn btn-secondary btn-small"><i class="bx bx-upload"></i> Enviar ' + (c.tipo === 'imagem' ? 'imagem' : 'vídeo') +
                '<input type="file" accept="' + (c.tipo === 'imagem' ? 'image/*' : 'video/mp4,video/webm,video/*') + '" data-envio="' + c.tipo + '" data-para="' + id + '" hidden></label>' +
              '<input type="text" id="' + id + '" value="' + esc(valor) + '" placeholder="ou cole o endereço do arquivo">' +
              '<div class="pf-progresso" hidden><span></span></div>' +
            '</div>' +
          '</div>' + ajuda + '</div>';
      default:
        return '<div class="pf-campo"><label for="' + id + '">' + esc(c.rotulo) + '</label>' +
          '<div class="pf-entrada">' + icone + '<input type="text" id="' + id + '" value="' + esc(valor) + '"></div>' + ajuda + '</div>';
    }
  }

  function listaHtml(c, lista, idBase) {
    lista = Array.isArray(lista) ? lista : [];
    var itens = lista.map(function (item, i) {
      return '<div class="pf-item">' +
        '<div class="pf-item__topo"><strong>' + esc(c.rotuloItem || 'Item') + ' ' + (i + 1) + '</strong>' +
          '<div class="pf-item__botoes">' +
            '<button type="button" data-lista="' + c.caminho + '" data-acao="subir" data-i="' + i + '" title="Mover para cima"' + (i === 0 ? ' disabled' : '') + '><i class="bx bx-up-arrow-alt"></i></button>' +
            '<button type="button" data-lista="' + c.caminho + '" data-acao="descer" data-i="' + i + '" title="Mover para baixo"' + (i === lista.length - 1 ? ' disabled' : '') + '><i class="bx bx-down-arrow-alt"></i></button>' +
            '<button type="button" data-lista="' + c.caminho + '" data-acao="remover" data-i="' + i + '" title="Remover" class="pf-remover"><i class="bx bx-trash"></i></button>' +
          '</div></div>' +
        '<div class="pf-item__campos">' + c.campos.map(function (sub) {
          return campoHtml(sub, item[sub.chave], idBase + '__' + i + '__' + sub.chave);
        }).join('') + '</div>' +
      '</div>';
    }).join('');
    var podeAdicionar = !c.maximo || lista.length < c.maximo;
    return '<div class="pf-lista" data-lista-raiz="' + c.caminho + '">' + (itens || '<p class="pf-nota">Nenhum item ainda.</p>') +
      (podeAdicionar ? '<button type="button" class="btn btn-secondary btn-small pf-adicionar" data-lista="' + c.caminho + '" data-acao="adicionar"><i class="bx bx-plus"></i> Adicionar ' + esc((c.rotuloItem || 'item').toLowerCase()) + '</button>' : '') +
      '</div>';
  }

  function idDe(caminho) { return 'pf_' + caminho.replace(/\./g, '_'); }

  function montarFormulario(nome) {
    var def = FORMULARIOS[nome];
    var alvo = document.querySelector('[data-form="' + nome + '"]');
    if (!def || !alvo || !config) return;

    var html = '<div class="pf-cabecalho"><div><h2>' + esc(def.titulo) + '</h2><p>' + esc(def.descricao) + '</p></div>' +
      (def.verNoSite ? '<a class="btn btn-secondary" href="' + def.verNoSite + '" target="_blank" rel="noopener"><i class="bx bx-show"></i> Ver no site</a>' : '') + '</div>';

    def.grupos.forEach(function (g) {
      html += '<section class="pf-grupo"><h3>' + esc(g.grupo) + '</h3>' + (g.ajuda ? '<p class="pf-grupo__ajuda">' + esc(g.ajuda) + '</p>' : '') +
        '<div class="pf-campos' + (g.colunas ? ' pf-campos--' + g.colunas : '') + '">' +
        g.campos.map(function (c) {
          if (c.tipo === 'lista') return listaHtml(c, pegar(config, c.caminho), idDe(c.caminho));
          return campoHtml(c, c.caminho ? pegar(config, c.caminho) : undefined, c.caminho ? idDe(c.caminho) : '');
        }).join('') +
        '</div></section>';
    });

    html += '<div class="pf-barra"><span class="pf-barra__status" data-status>Tudo salvo</span>' +
      '<button type="button" class="btn btn-secondary" data-desfazer><i class="bx bx-undo"></i> Desfazer</button>' +
      '<button type="button" class="btn btn-primary" data-salvar><i class="bx bx-save"></i> Salvar alterações</button></div>';

    alvo.innerHTML = html;
    alvo.dataset.montado = '1';
    marcarStatus();
  }

  /* Lê os valores da tela para dentro do objeto config */
  function lerFormulario(nome) {
    var def = FORMULARIOS[nome];
    def.grupos.forEach(function (g) {
      g.campos.forEach(function (c) {
        if (!c.caminho) return;
        if (c.tipo === 'lista') {
          var lista = (pegar(config, c.caminho) || []).map(function (item, i) {
            var novo = Object.assign({}, item);
            c.campos.forEach(function (sub) {
              var el = document.getElementById(idDe(c.caminho) + '__' + i + '__' + sub.chave);
              if (el) novo[sub.chave] = el.value;
            });
            return novo;
          });
          definir(config, c.caminho, lista);
          return;
        }
        var el = document.getElementById(idDe(c.caminho));
        if (!el) return;
        var v = c.tipo === 'liga' ? el.checked : el.value;
        if (c.tipo === 'numero') v = el.value === '' ? '' : Number(el.value);
        definir(config, c.caminho, v);
      });
    });
  }

  function marcarStatus() {
    document.querySelectorAll('[data-status]').forEach(function (s) {
      s.textContent = alterado ? 'Alterações não salvas' : 'Tudo salvo';
      s.classList.toggle('is-alterado', alterado);
    });
  }

  function formAtual() {
    var aba = document.querySelector('.tab-content.active [data-form]');
    return aba ? aba.dataset.form : null;
  }

  async function carregarConfig() {
    config = await api('/site/config-geral');
    alterado = false;
  }

  async function salvar(nome) {
    lerFormulario(nome);
    var botao = document.querySelector('[data-form="' + nome + '"] [data-salvar]');
    if (botao) { botao.disabled = true; botao.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Salvando…'; }
    try {
      var r = await api('/site/config-geral', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      config = r.geral;
      alterado = false;
      aviso('Alterações salvas! Elas já aparecem no site.', 'success');
      montarFormulario(nome);
    } catch (e) {
      aviso('Não foi possível salvar: ' + e.message, 'error');
      if (botao) { botao.disabled = false; botao.innerHTML = '<i class="bx bx-save"></i> Salvar alterações'; }
    }
  }

  /* ---------------- Eventos das telas de configuração ---------------- */

  document.addEventListener('input', function (e) {
    if (!e.target.closest('[data-form]')) return;
    if (e.target.type === 'file') return;
    alterado = true;
    marcarStatus();
    var previa = e.target.id && document.querySelector('[data-previa="' + e.target.id + '"]');
    if (previa) previa.className = 'bx ' + e.target.value;
  });

  document.addEventListener('change', async function (e) {
    var input = e.target;
    if (!input.matches || !input.matches('[data-envio]') || !input.files || !input.files[0]) return;
    var tipo = input.dataset.envio;
    var destino = document.getElementById(input.dataset.para);
    var caixa = input.closest('.pf-arquivo');
    var barra = caixa.querySelector('.pf-progresso');
    var fd = new FormData();
    fd.append(tipo === 'imagem' ? 'materia' : 'video', input.files[0]);

    barra.hidden = false;
    barra.firstChild.style.width = '0%';
    // XMLHttpRequest para mostrar o progresso (vídeos podem ser grandes)
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API + (tipo === 'imagem' ? '/site/upload-imagem' : '/site/upload-video'));
    xhr.withCredentials = true;
    xhr.upload.onprogress = function (ev) {
      if (ev.lengthComputable) barra.firstChild.style.width = Math.round(ev.loaded / ev.total * 100) + '%';
    };
    xhr.onload = function () {
      barra.hidden = true;
      var r = {};
      try { r = JSON.parse(xhr.responseText); } catch (er) { /* resposta inválida */ }
      if (xhr.status >= 200 && xhr.status < 300 && r.url) {
        destino.value = r.url;
        caixa.querySelector('.pf-arquivo__previa').innerHTML = tipo === 'imagem'
          ? '<img src="' + esc(r.url) + '" alt="">'
          : '<video src="' + esc(r.url) + '" muted controls preload="metadata"></video>';
        alterado = true;
        marcarStatus();
        aviso('Arquivo enviado. Clique em "Salvar alterações" para usar no site.', 'info');
      } else {
        aviso('Erro ao enviar: ' + (r.error || xhr.status), 'error');
      }
      input.value = '';
    };
    xhr.onerror = function () { barra.hidden = true; aviso('Erro de conexão ao enviar o arquivo', 'error'); };
    xhr.send(fd);
  });

  document.addEventListener('click', function (e) {
    var form = e.target.closest('[data-form]');
    if (!form) return;
    var nome = form.dataset.form;

    if (e.target.closest('[data-salvar]')) { salvar(nome); return; }

    if (e.target.closest('[data-desfazer]')) {
      if (alterado && !confirm('Descartar as alterações não salvas?')) return;
      carregarConfig().then(function () { montarFormulario(nome); });
      return;
    }

    var b = e.target.closest('[data-lista]');
    if (b) {
      lerFormulario(nome);
      var caminho = b.dataset.lista;
      var lista = (pegar(config, caminho) || []).slice();
      var i = Number(b.dataset.i);
      var def = null;
      FORMULARIOS[nome].grupos.forEach(function (g) { g.campos.forEach(function (c) { if (c.caminho === caminho) def = c; }); });
      if (b.dataset.acao === 'adicionar') lista.push(Object.assign({}, def.novoItem));
      if (b.dataset.acao === 'remover') { if (!confirm('Remover este item?')) return; lista.splice(i, 1); }
      if (b.dataset.acao === 'subir' && i > 0) lista.splice(i - 1, 0, lista.splice(i, 1)[0]);
      if (b.dataset.acao === 'descer' && i < lista.length - 1) lista.splice(i + 1, 0, lista.splice(i, 1)[0]);
      definir(config, caminho, lista);
      alterado = true;
      montarFormulario(nome);
      alterado = true;
      marcarStatus();
    }
  });

  window.addEventListener('beforeunload', function (e) {
    if (alterado) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------------- Visão geral ---------------- */

  async function montarResumo() {
    var alvo = document.getElementById('painelResumo');
    if (!alvo) return;
    alvo.innerHTML = '<div class="painel-carregando"><i class="bx bx-loader-alt bx-spin"></i> Carregando…</div>';

    function seguro(p) { return p.catch(function () { return null; }); }
    var res = await Promise.all([
      seguro(api('/jornais')), seguro(api('/noticias')), seguro(api('/site/colunistas')), seguro(api('/pagamentos'))
    ]);
    var jornais = (res[0] && (res[0].jornais || res[0])) || [];
    var noticias = Array.isArray(res[1]) ? res[1] : [];
    var colunistas = (res[2] && (res[2].colunistas || res[2])) || [];
    var pagamentos = (res[3] && (res[3].pagamentos || res[3])) || [];
    if (!Array.isArray(pagamentos)) pagamentos = [];

    var total = pagamentos.reduce(function (s, p) { return s + (Number(p.valor) || 0); }, 0);
    var MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    var ultimo = jornais.slice().sort(function (a, b) {
      return (b.ano - a.ano) || (MESES.indexOf(b.mes) - MESES.indexOf(a.mes));
    })[0];
    var recentes = pagamentos.slice().sort(function (a, b) {
      return new Date(b.dataPagamento || b.dataCriacao || 0) - new Date(a.dataPagamento || a.dataCriacao || 0);
    }).slice(0, 5);

    function cartao(icone, cor, numero, rotulo, aba) {
      return '<button class="pr-cartao" data-ir="' + aba + '" style="--cor:' + cor + '"><span class="pr-cartao__icone"><i class="bx ' + icone + '"></i></span>' +
        '<span><strong>' + numero + '</strong><small>' + rotulo + '</small></span></button>';
    }

    alvo.innerHTML =
      '<div class="pr-boasvindas"><div><h2>Olá! 👋</h2><p>Por aqui você controla todo o site do Jornal do Reino, sem mexer no código.</p></div>' +
        '<a class="btn btn-primary" href="/" target="_blank" rel="noopener"><i class="bx bx-show"></i> Abrir o site</a></div>' +
      '<div class="pr-cartoes">' +
        cartao('bx-book-open', '#00095b', jornais.length, 'edições publicadas', 'jornais') +
        cartao('bx-news', '#cf0000', noticias.length, 'notícias', 'noticias') +
        cartao('bx-user-voice', '#0077cc', colunistas.length, 'colunistas', 'colunistas') +
        cartao('bx-wallet', '#0a8a5a', moeda(total), pagamentos.length + ' vendas', 'pagamentos') +
      '</div>' +
      '<div class="pr-colunas">' +
        '<section class="pr-bloco"><h3><i class="bx bx-bolt-circle"></i> Atalhos</h3><div class="pr-atalhos">' +
          '<button data-ir="jornais" data-novo="jornal"><i class="bx bx-plus-circle"></i> Publicar nova edição</button>' +
          '<button data-ir="noticias" data-novo="noticia"><i class="bx bx-edit"></i> Escrever notícia</button>' +
          '<button data-ir="carrossel"><i class="bx bx-carousel"></i> Trocar o carrossel</button>' +
          '<button data-ir="banner"><i class="bx bx-image-alt"></i> Trocar o banner promocional</button>' +
          '<button data-ir="cfg-contato"><i class="bx bx-phone"></i> Contatos e redes</button>' +
          '<button data-ir="cfg-oferta"><i class="bx bx-donate-heart"></i> PIX da oferta</button>' +
          '<button data-ir="cfg-inicio"><i class="bx bx-layout"></i> Seções da página inicial</button>' +
          '<button data-ir="cfg-abertura"><i class="bx bx-play-circle"></i> Vídeo de abertura</button>' +
          '<button data-ir="loja"><i class="bx bx-store-alt"></i> Produtos da loja</button>' +
          '<button data-ir="cfg-loja"><i class="bx bxl-whatsapp"></i> WhatsApp da loja</button>' +
        '</div></section>' +
        '<section class="pr-bloco"><h3><i class="bx bx-book-open"></i> Edição mais recente</h3>' +
          (ultimo
            ? '<div class="pr-edicao"><img src="' + esc(ultimo.capa || '') + '" alt="" onerror="this.style.display=\'none\'"><div><strong>' + esc(ultimo.nome) + ' ' + esc(ultimo.ano) + '</strong>' +
              '<span>' + (ultimo.pdf ? '<i class="bx bx-check-circle"></i> PDF enviado' : '<i class="bx bx-error-circle"></i> Falta o PDF') + '</span>' +
              '<span>' + moeda(ultimo.preco || (config && config.edicoes && config.edicoes.precoPadrao) || 10) + '</span>' +
              '<button class="btn btn-secondary btn-small" data-ir="jornais"><i class="bx bx-edit"></i> Gerenciar edições</button></div></div>'
            : '<p class="pf-nota">Nenhuma edição publicada ainda.</p>') +
        '</section>' +
        '<section class="pr-bloco pr-bloco--largo"><h3><i class="bx bx-receipt"></i> Últimas vendas</h3>' +
          (recentes.length
            ? '<table class="pr-tabela"><thead><tr><th>Cliente</th><th>Edição</th><th>Valor</th><th>Data</th></tr></thead><tbody>' +
              recentes.map(function (p) {
                var d = new Date(p.dataPagamento || p.dataCriacao);
                return '<tr><td>' + esc(p.nome || '—') + '<small>' + esc(p.email || '') + '</small></td><td>' + esc(p.jornalNome || '—') + '</td><td>' + moeda(p.valor) + '</td><td>' + (isNaN(d) ? '—' : d.toLocaleDateString('pt-BR')) + '</td></tr>';
              }).join('') + '</tbody></table>'
            : '<p class="pf-nota">Nenhuma venda registrada ainda.</p>') +
        '</section>' +
      '</div>';
  }

  /* ---------------- Navegação do menu ---------------- */

  function irPara(aba, novo) {
    var botao = document.querySelector('.tab-btn[data-tab="' + aba + '"]');
    if (botao) botao.click();
    if (novo === 'jornal' && typeof window.openJornalModal === 'function') setTimeout(function () { window.openJornalModal(); }, 150);
    if (novo === 'noticia' && typeof window.openNoticiaModal === 'function') setTimeout(function () { window.openNoticiaModal(); }, 150);
  }

  document.addEventListener('click', function (e) {
    var ir = e.target.closest('[data-ir]');
    if (ir) { irPara(ir.dataset.ir, ir.dataset.novo); return; }

    var aba = e.target.closest('.tab-btn');
    if (!aba) return;

    // Garante a troca de tela mesmo antes do app.js terminar de carregar
    document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.toggle('active', b === aba); });
    document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.toggle('active', c.id === 'tab-' + aba.dataset.tab); });

    document.getElementById('painelTitulo').textContent = aba.textContent.trim();
    document.body.classList.remove('painel-menu-aberto');
    window.scrollTo(0, 0);

    var nome = aba.dataset.tab;
    if (nome === 'inicio') montarResumo();
    if (nome.indexOf('cfg-') === 0) {
      var form = nome.slice(4);
      (config ? Promise.resolve() : carregarConfig()).then(function () { montarFormulario(form); })
        .catch(function (er) { aviso('Erro ao carregar as configurações: ' + er.message, 'error'); });
    }
  });

  document.getElementById('painelMenuBtn').addEventListener('click', function () {
    document.body.classList.toggle('painel-menu-aberto');
  });

  // Ao entrar no painel (depois do login), mostra a visão geral
  var tela = document.getElementById('dashboardScreen');
  var observador = new MutationObserver(function () {
    if (!tela.classList.contains('hidden') && !tela.dataset.resumo) {
      tela.dataset.resumo = '1';
      carregarConfig().catch(function () {}).then(montarResumo);
    }
    if (tela.classList.contains('hidden')) delete tela.dataset.resumo;
  });
  observador.observe(tela, { attributes: true, attributeFilter: ['class', 'style'] });
})();
