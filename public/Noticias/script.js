let articles = [];
let currentPage = 1;
const perPage = 12;

async function loadArticles(){
  try {
    console.log('Iniciando carregamento de notícias...');
    // Buscar da API do dashboard-server através do proxy do servidor principal
    const res = await fetch("/api/site/noticias", {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      credentials: 'same-origin'
    }).catch(err => {
      // Se for erro de rede (provavelmente extensão do Chrome), ignorar silenciosamente
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('network error'))) {
        console.warn('Erro de rede ao carregar notícias (pode ser extensão do navegador):', err.message);
        throw new Error('Erro de rede ao carregar notícias');
      }
      throw err;
    });
    
    if (!res || !res.ok) {
      if (res) {
        throw new Error(`Erro HTTP: ${res.status}`);
      } else {
        throw new Error('Erro de rede ao carregar notícias');
      }
    }
    
    const data = await res.json();
    console.log('Notícias recebidas:', data);
    
    // O formato da API já está correto (title, date, category, content, excerpt, tag, image)
    // Apenas garantir que seja um array e normalizar valores vazios
    articles = Array.isArray(data) ? data.map(noticia => ({
      id: noticia.id,
      title: noticia.title || '',
      content: noticia.content || '',
      excerpt: noticia.excerpt || '',
      date: noticia.date || new Date().toISOString().split('T')[0],
      category: (noticia.category || 'geral').toLowerCase(),
      tag: noticia.tag || '',
      image: noticia.image || ''
    })) : [];
    
    console.log(`Total de notícias carregadas: ${articles.length}`);
    renderPage();
  } catch (error) {
    console.error('Erro ao carregar notícias:', error);
    // Tentar carregar do arquivo local como fallback
    try {
      const res = await fetch("data.json");
      if (res.ok) {
        articles = await res.json();
        console.log('Usando dados do arquivo local como fallback');
        renderPage();
      } else {
        console.error('Erro ao carregar arquivo local também');
        articles = [];
        renderPage();
      }
    } catch (fallbackError) {
      console.error('Erro no fallback:', fallbackError);
      articles = [];
      renderPage();
    }
  }
}

function getPagedArticles(list){
  const start = (currentPage - 1) * perPage;
  return list.slice(start, start + perPage);
}

function renderPage(){
  const filtered = doSearch(true);
  const paged = getPagedArticles(filtered);
  renderArticles(paged);
  renderPagination(filtered.length);
}

function renderPagination(total){
  const totalPages = Math.ceil(total / perPage);
  const pager = document.getElementById("pager");
  pager.innerHTML = "";

  for(let i=1; i<=totalPages; i++){
    const b = document.createElement("button");
    b.textContent = i;
    if(i === currentPage) b.classList.add("active");
    b.onclick = ()=>{ currentPage = i; renderPage(); };
    pager.appendChild(b);
  }
}

function renderArticles(list){
  const results = document.getElementById("results");
  const empty = document.getElementById("empty");

  results.innerHTML = "";

  if(!list.length){
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";

  list.forEach((a, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.animation = `fadeInUp 0.6s ease-out ${index * 0.1}s both`;

    // Verificar se é nova (menos de 30 dias)
    const articleDate = new Date(a.date);
    const daysSince = Math.floor((new Date() - articleDate) / (1000 * 60 * 60 * 24));
    const isNew = daysSince <= 30;

    // Formatar data
    const formattedDate = articleDate.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });

    // Capitalizar primeira letra da categoria
    const categoryCapitalized = a.category ? a.category.charAt(0).toUpperCase() + a.category.slice(1) : 'Geral';

    // Normalizar caminho da imagem
    let imageUrl = a.image || '../Imagem/placeholder.jpg';
    
    if (imageUrl) {
      if (imageUrl.startsWith('./')) {
        imageUrl = imageUrl.substring(2); // Remove ./
      }
      
      // Se começar com /uploads, manter como está (servido pelo servidor principal)
      if (imageUrl.startsWith('/uploads')) {
        // Manter como está - será servido pelo servidor principal na rota /uploads
      } else if (!imageUrl.startsWith('http') && !imageUrl.startsWith('../') && !imageUrl.startsWith('/')) {
        // Se não começar com /, ../ ou http, adicionar ../
        imageUrl = '../' + imageUrl;
      }
    } else {
      imageUrl = '../Imagem/placeholder.jpg';
    }
    
    // Construir URL completa da notícia
    const basePath = window.location.pathname.replace(/\/[^\/]*$/, '/');
    const articleUrl = `${window.location.origin}${basePath}noticia.html?id=${a.id}`;
    const articleTitle = (a.title || 'Sem título').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    // Normalizar URL da imagem para compartilhamento
    let articleImage = imageUrl;
    if (!imageUrl.startsWith('http')) {
      if (imageUrl.startsWith('/')) {
        articleImage = `${window.location.origin}${imageUrl}`;
      } else {
        articleImage = `${window.location.origin}${basePath}${imageUrl}`;
      }
    }
    
    card.innerHTML = `
      <div class="hero" style="background-image: url('${imageUrl}');">
        <div class="hero-overlay">
          ${isNew ? '<span class="new-badge">Novo</span>' : ''}
          <span class="category-badge ${a.category || ''}">${categoryCapitalized.toUpperCase()}</span>
        </div>
        <button class="share-btn-card" onclick="shareArticle(${a.id}, '${articleTitle}', '${articleUrl}', '${articleImage}')" title="Compartilhar">
          <i class='bx bx-share-alt'></i>
        </button>
      </div>
      <div class="body">
        <div class="meta">
          <div class="meta-date">
            <i class='bx bx-calendar'></i>
            <span>${formattedDate}</span>
          </div>
          <span style="color: #ddd;">•</span>
          <div class="meta-category">${categoryCapitalized}</div>
        </div>
        <h3>${a.title || 'Sem título'}</h3>
        <p>${a.excerpt || a.description || 'Leia a matéria completa para mais informações.'}</p>
        <div class="card-actions">
          <button class="btn" onclick="window.location='noticia.html?id=${a.id}'">
            <i class='bx bx-book-reader' style="font-size: 1.1rem; margin-right: 8px; vertical-align: middle;"></i>
            Ler matéria
          </button>
        </div>
      </div>
    `;
    
    // Adicionar tratamento de erro para a imagem
    const heroDiv = card.querySelector('.hero');
    if (heroDiv && a.image) {
      const img = new Image();
      img.onerror = function() {
        heroDiv.style.backgroundImage = "url('../Imagem/placeholder.jpg')";
      };
      img.src = a.image;
    }

    results.appendChild(card);
  });
}

let filterCategory = "all";

function doSearch(returnData){
  const q = document.getElementById("searchInput")?.value.trim().toLowerCase() || '';

  const filtered = articles.filter(a=>{
    // Filtrar por categoria (case-insensitive e normalizar)
    if(filterCategory !== "all") {
      const articleCategory = (a.category || '').toLowerCase();
      const filterCat = filterCategory.toLowerCase();
      if(articleCategory !== filterCat) return false;
    }
    
    // Filtrar por busca de texto
    if(!q) return true;

    const searchText = (a.title || '') + ' ' + (a.excerpt || '') + ' ' + (a.content || '') + ' ' + (a.tag || '');
    return searchText.toLowerCase().includes(q);
  });

  if(!returnData) renderArticles(filtered);
  return filtered;
}

document.querySelectorAll(".chip").forEach(ch=>{
  ch.onclick = ()=>{
    // Remover active de todos os chips
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    // Adicionar active ao chip clicado
    ch.classList.add("active");
    filterCategory = ch.dataset.filter;
    currentPage = 1; // Resetar para primeira página ao filtrar
    renderPage();
  };
});

// Ativar o chip "Todos" por padrão quando a página carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const allChip = document.querySelector('.chip[data-filter="all"]');
    if (allChip) {
      allChip.classList.add("active");
    }
  });
} else {
  const allChip = document.querySelector('.chip[data-filter="all"]');
  if (allChip) {
    allChip.classList.add("active");
  }
}

document.getElementById("searchInput").oninput = ()=> {
  currentPage = 1; // Resetar página ao pesquisar
  doSearch();
};

// Função global para compartilhar artigo
async function shareArticle(id, title, url, image) {
  // Decodificar título (remover escape de aspas)
  const decodedTitle = title.replace(/\\'/g, "'").replace(/&quot;/g, '"');
  
  const shareData = {
    title: decodedTitle,
    text: decodedTitle,
    url: url
  };
  
  // Tentar usar Web Share API (mobile)
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (err) {
      // Usuário cancelou ou erro - usar fallback
      if (err.name !== 'AbortError') {
        console.log('Erro ao compartilhar:', err);
      }
    }
  }
  
  // Fallback: mostrar modal com opções de compartilhamento
  showShareModal(decodedTitle, url, image);
}

// Função para mostrar modal de compartilhamento
function showShareModal(title, url, image) {
  // Remover modal existente se houver
  const existingModal = document.getElementById('shareModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Criar modal
  const modal = document.createElement('div');
  modal.id = 'shareModal';
  modal.className = 'share-modal-overlay';
  modal.innerHTML = `
    <div class="share-modal">
      <div class="share-modal-header">
        <h3>Compartilhar</h3>
        <button class="share-modal-close" onclick="closeShareModal()">
          <i class='bx bx-x'></i>
        </button>
      </div>
      <div class="share-modal-content">
        <div class="share-options">
          <button class="share-option-btn" onclick="shareToWhatsApp('${url}', '${title.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" title="WhatsApp">
            <i class='bx bxl-whatsapp'></i>
            <span>WhatsApp</span>
          </button>
          <button class="share-option-btn" onclick="shareToFacebook('${url}')" title="Facebook">
            <i class='bx bxl-facebook'></i>
            <span>Facebook</span>
          </button>
          <button class="share-option-btn" onclick="shareToTwitter('${url}', '${title.replace(/'/g, "\\'").replace(/"/g, '&quot;')}')" title="Twitter/X">
            <i class='bx bxl-twitter'></i>
            <span>Twitter/X</span>
          </button>
          <button class="share-option-btn" onclick="copyArticleLink('${url}')" title="Copiar link">
            <i class='bx bx-link'></i>
            <span>Copiar link</span>
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Fechar ao clicar fora
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      closeShareModal();
    }
  });
  
  // Fechar com ESC
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      closeShareModal();
      document.removeEventListener('keydown', escHandler);
    }
  });
}

// Função para fechar modal
function closeShareModal() {
  const modal = document.getElementById('shareModal');
  if (modal) {
    modal.remove();
  }
}

// Funções de compartilhamento específicas
function shareToWhatsApp(url, title) {
  // Decodificar título
  const decodedTitle = title.replace(/\\'/g, "'").replace(/&quot;/g, '"');
  const text = encodeURIComponent(`${decodedTitle} - ${url}`);
  window.open(`https://wa.me/?text=${text}`, '_blank');
  closeShareModal();
}

function shareToFacebook(url) {
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
  closeShareModal();
}

function shareToTwitter(url, title) {
  // Decodificar título
  const decodedTitle = title.replace(/\\'/g, "'").replace(/&quot;/g, '"');
  const text = encodeURIComponent(decodedTitle);
  window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${text}`, '_blank');
  closeShareModal();
}

function copyArticleLink(url) {
  navigator.clipboard.writeText(url).then(() => {
    // Feedback visual
    const btn = document.querySelector('.share-option-btn:last-child');
    if (btn) {
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<i class="bx bx-check"></i><span>Copiado!</span>';
      btn.style.background = '#10b981';
      btn.style.borderColor = '#10b981';
      btn.style.color = 'white';
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.style.background = '';
        btn.style.borderColor = '';
        btn.style.color = '';
        closeShareModal();
      }, 1500);
    }
  }).catch(err => {
    console.error('Erro ao copiar link:', err);
    alert('Erro ao copiar link. Por favor, copie manualmente: ' + url);
  });
}

loadArticles();
