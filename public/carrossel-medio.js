// ==================== CARROSSEL MÉDIO - IMPLEMENTAÇÃO INDEPENDENTE ====================
(function() {
  'use strict';
  
  // Variáveis globais do carrossel
  let carrosselMedioIndex = 0;
  let carrosselMedioItems = [];
  let carrosselMedioInterval = null;
  
  // Função para carregar dados do carrossel médio
  async function carregarDadosCarrosselMedio() {
    try {
      const response = await fetch('/api/site/carrossel-medio');
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      const dados = await response.json();
      
      // Filtrar apenas itens ativos e ordenar
      carrosselMedioItems = (dados || [])
        .filter(item => item.ativo !== false)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
      
      return carrosselMedioItems;
    } catch (error) {
      console.error('Erro ao carregar carrossel médio:', error);
      return [];
    }
  }
  
  // Função para normalizar URL da imagem
  function normalizarUrlImagem(url) {
    if (!url) return '';
    
    if (url.startsWith('/uploads/')) {
      return url;
    } else if (url.startsWith('http')) {
      return url;
    } else if (url.startsWith('./')) {
      return url.substring(2);
    } else if (!url.startsWith('/')) {
      return '/' + url;
    }
    return url;
  }
  
  // Função para renderizar os slides
  function renderizarSlides(items) {
    const container = document.getElementById('carrossel-medio-slides');
    if (!container) return;
    
    if (items.length === 0) {
      container.innerHTML = '<div class="carrossel-medio-empty">Nenhum item disponível no momento.</div>';
      return;
    }
    
    container.innerHTML = items.map((item, index) => {
      const imagemUrl = normalizarUrlImagem(item.imagem);
      return `
        <div class="carrossel-medio-item" data-index="${index}">
          <img src="${imagemUrl}" alt="Item ${index + 1}" class="carrossel-medio-img" 
               onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27800%27 height=%27450%27%3E%3Crect fill=%27%23ecf0f1%27 width=%27800%27 height=%27450%27/%3E%3Ctext fill=%27%23999%27 font-family=%27sans-serif%27 font-size=%2714%27 x=%2750%25%27 y=%2750%25%27 text-anchor=%27middle%27 dy=%27.3em%27%3EImagem não encontrada%3C/text%3E%3C/svg%3E';">
        </div>
      `;
    }).join('');
  }
  
  // Função para mostrar slide específico (mostra 3 slides no desktop, 1 no mobile)
  function mostrarSlide(index) {
    const track = document.querySelector('.carrossel-medio-track');
    const viewport = document.querySelector('.carrossel-medio-viewport');
    const items = document.querySelectorAll('.carrossel-medio-item');
    const total = items.length;
    
    if (total === 0 || !track || !viewport) return;
    
    // Garantir que o índice está dentro do range
    if (index < 0) index = total - 1;
    if (index >= total) index = 0;
    
    carrosselMedioIndex = index;
    
    // Detectar se estamos no mobile (largura <= 768px)
    const isMobile = window.innerWidth <= 768;
    const slidesToShow = isMobile ? 1 : 3;
    
    // Se temos menos slides do que precisamos mostrar, não precisamos fazer scroll
    if (total <= slidesToShow) {
      track.style.transform = 'translateX(0)';
      atualizarIndicadores();
      return;
    }
    
    // Calcular o deslocamento baseado no tamanho da tela
    if (items.length > 0) {
      const firstItem = items[0];
      const slideWidth = firstItem.offsetWidth;
      const gap = isMobile ? 10 : 20; // gap menor no mobile
      const slideWidthWithGap = slideWidth + gap;
      
      // Limitar o índice para que sempre vejamos o número correto de slides
      const maxIndex = Math.max(0, total - slidesToShow);
      const adjustedIndex = Math.min(index, maxIndex);
      
      // Calcular o translateX em pixels
      let translateX;
      
      if (isMobile) {
        // No mobile: cada card ocupa 100% da largura do viewport (90% da tela)
        // O viewport já está centralizado, então apenas movemos o track
        translateX = -(adjustedIndex * slideWidthWithGap);
      } else {
        // No desktop: mostrar 3 cards
        translateX = -(adjustedIndex * slideWidthWithGap);
      }
      
      track.style.transform = `translateX(${translateX}px)`;
    }
    
    // Atualizar indicadores
    atualizarIndicadores();
  }
  
  // Adicionar listener para redimensionamento da janela
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      mostrarSlide(carrosselMedioIndex);
    }, 250);
  });
  
  // Função para atualizar indicadores
  function atualizarIndicadores() {
    const container = document.getElementById('carrossel-medio-indicators');
    if (!container) return;
    
    container.innerHTML = carrosselMedioItems.map((item, index) => {
      return `<span class="carrossel-medio-dot ${index === carrosselMedioIndex ? 'ativo' : ''}" 
                     data-index="${index}"></span>`;
    }).join('');
    
    // Adicionar event listeners aos dots
    container.querySelectorAll('.carrossel-medio-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const index = parseInt(dot.getAttribute('data-index'));
        mostrarSlide(index);
        resetarAutoplay();
      });
    });
  }
  
  // Função para próximo slide
  function proximoSlide() {
    mostrarSlide(carrosselMedioIndex + 1);
  }
  
  // Função para slide anterior
  function slideAnterior() {
    mostrarSlide(carrosselMedioIndex - 1);
  }
  
  // Função para iniciar autoplay
  function iniciarAutoplay() {
    if (carrosselMedioInterval) {
      clearInterval(carrosselMedioInterval);
    }
    carrosselMedioInterval = setInterval(() => {
      proximoSlide();
    }, 4000);
  }
  
  // Função para parar autoplay
  function pararAutoplay() {
    if (carrosselMedioInterval) {
      clearInterval(carrosselMedioInterval);
      carrosselMedioInterval = null;
    }
  }
  
  // Função para resetar autoplay
  function resetarAutoplay() {
    pararAutoplay();
    iniciarAutoplay();
  }
  
  // Função principal de inicialização
  async function inicializarCarrosselMedio() {
    const container = document.getElementById('carrossel-medio');
    if (!container) {
      console.error('Container do carrossel médio não encontrado');
      return;
    }
    
    // Carregar dados
    const items = await carregarDadosCarrosselMedio();
    
    if (items.length === 0) {
      const slidesContainer = document.getElementById('carrossel-medio-slides');
      if (slidesContainer) {
        slidesContainer.innerHTML = '<div class="carrossel-medio-empty">Nenhum item disponível no momento.</div>';
      }
      return;
    }
    
    // Renderizar slides
    renderizarSlides(items);
    
    // Mostrar primeiro slide
    mostrarSlide(0);
    
    // Configurar botões de navegação
    const btnAnterior = document.getElementById('carrossel-medio-btn-anterior');
    const btnProximo = document.getElementById('carrossel-medio-btn-proximo');
    
    if (btnAnterior) {
      // Remover listeners anteriores para evitar duplicação
      const newBtnAnterior = btnAnterior.cloneNode(true);
      btnAnterior.parentNode.replaceChild(newBtnAnterior, btnAnterior);
      
      newBtnAnterior.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Botão anterior clicado');
        slideAnterior();
        resetarAutoplay();
      });
      
      // Garantir que o botão seja clicável
      newBtnAnterior.style.pointerEvents = 'auto';
      newBtnAnterior.style.zIndex = '100';
    }
    
    if (btnProximo) {
      // Remover listeners anteriores para evitar duplicação
      const newBtnProximo = btnProximo.cloneNode(true);
      btnProximo.parentNode.replaceChild(newBtnProximo, btnProximo);
      
      newBtnProximo.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Botão próximo clicado');
        proximoSlide();
        resetarAutoplay();
      });
      
      // Garantir que o botão seja clicável
      newBtnProximo.style.pointerEvents = 'auto';
      newBtnProximo.style.zIndex = '100';
    }
    
    // Pausar autoplay no hover
    const carrosselContainer = document.getElementById('carrossel-medio-slides');
    if (carrosselContainer) {
      carrosselContainer.addEventListener('mouseenter', pararAutoplay);
      carrosselContainer.addEventListener('mouseleave', iniciarAutoplay);
    }
    
    // Iniciar autoplay
    iniciarAutoplay();
    
    console.log('✅ Carrossel médio inicializado com sucesso!');
  }
  
  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarCarrosselMedio);
  } else {
    inicializarCarrosselMedio();
  }
})();
