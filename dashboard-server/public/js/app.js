// API Base URL
const API_BASE = '/api';

console.log('📦 app.js carregado! API_BASE:', API_BASE);

// DEFINIR handleLogin PRIMEIRO - ANTES DE QUALQUER OUTRO CÓDIGO QUE POSSA CAUSAR ERRO
// IMPORTANTE: Esta função DEVE estar disponível imediatamente quando o script carregar
// Definir diretamente sem try/catch para garantir que seja executada
window.handleLogin = async function(e) {
    console.log('🚀 ===== INÍCIO DO LOGIN =====');
    console.log('Event recebido:', e);
    
    // Sempre prevenir comportamento padrão primeiro
    if (e) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    }
    
    console.log('✅ Comportamento padrão prevenido');
    
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
        errorDiv.classList.remove('show');
        errorDiv.textContent = '';
    }
    
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    
    if (!emailInput || !passwordInput) {
        console.error('❌ Campos de input não encontrados!');
        return;
    }
    
    const email = emailInput.value.trim();
    const password = passwordInput.value; // NÃO fazer trim aqui, pode ter espaços intencionais
    
    console.log('📧 Email fornecido:', email);
    console.log('🔑 Senha fornecida (comprimento):', password ? password.length + ' caracteres' : 'vazia');
    console.log('🔑 Senha fornecida (primeiros 5):', password ? password.substring(0, 5) + '...' : 'vazia');
    console.log('🔑 Senha fornecida (últimos 5):', password && password.length > 5 ? '...' + password.substring(password.length - 5) : 'vazia');
    console.log('🔑 Senha completa (JSON):', JSON.stringify(password));
    
    // Validação básica
    if (!email || !password) {
        console.error('❌ Campos vazios!');
        if (errorDiv) {
            errorDiv.textContent = 'Por favor, preencha todos os campos';
            errorDiv.classList.add('show');
        }
        if (typeof showToast === 'function') {
            showToast('Por favor, preencha todos os campos', 'error');
        }
        return;
    }
    
    if (typeof showLoading === 'function') {
        showLoading();
    }
    
    try {
        console.log('📤 Enviando requisição de login...');
        console.log('API_BASE:', API_BASE);
        console.log('URL completa:', `${API_BASE}/login`);
        console.log('📦 Dados sendo enviados:', {
            email: email,
            passwordLength: password ? password.length : 0,
            passwordPreview: password ? password.substring(0, 3) + '...' + password.substring(password.length - 3) : 'vazia'
        });
        
        const requestBody = { email, password };
        console.log('📦 Request body (JSON):', JSON.stringify(requestBody));
        
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(requestBody)
        });
        
        console.log('📥 Resposta recebida!');
        console.log('Status:', response.status, response.statusText);
        
        // Verificar se a resposta é JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Resposta não é JSON:', text.substring(0, 200));
            throw new Error('Resposta inválida do servidor');
        }
        
        const data = await response.json();
        console.log('📦 Dados recebidos:', data);
        
        // Verificar resposta direta primeiro
        if (response.ok && data && data.ok) {
            if (typeof currentUser !== 'undefined') {
                currentUser = data.user || email;
            }
            console.log('✅ Login bem-sucedido pela resposta!', currentUser);
            
            // Aguardar um pouco para garantir que a sessão foi salva no servidor
            console.log('⏳ Aguardando 500ms para sessão ser salva...');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verificar autenticação e mostrar dashboard
            console.log('🔍 Verificando autenticação após login...');
            const isAuthenticated = typeof verifyAndShowDashboard === 'function' 
                ? await verifyAndShowDashboard(email)
                : false;
            
            if (isAuthenticated) {
                console.log('✅ ===== LOGIN CONCLUÍDO COM SUCESSO =====');
                return;
            } else {
                // Se verificação falhou, tentar mostrar dashboard mesmo assim
                console.log('⚠️ Verificação falhou, mas resposta foi OK. Tentando mostrar dashboard...');
                if (typeof hideLoading === 'function') {
                    hideLoading();
                }
                if (typeof showDashboard === 'function') {
                    showDashboard();
                }
                return;
            }
        }
        
        // Se resposta não OK, ainda verificar autenticação (pode ser erro de extensão)
        console.log('⚠️ Resposta não OK ou dados inválidos, verificando autenticação...');
        console.log('Status:', response.status);
        console.log('Dados:', data);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        const isAuthenticated = typeof verifyAndShowDashboard === 'function'
            ? await verifyAndShowDashboard(email)
            : false;
        
        if (isAuthenticated) {
            console.log('✅ ===== LOGIN CONCLUÍDO COM SUCESSO (via verificação) =====');
            return;
        }
        
        // Se não autenticado, mostrar erro
        const errorMsg = data?.error || 'Erro ao fazer login. Verifique suas credenciais.';
        console.error('❌ Login falhou:', errorMsg);
        console.error('Status da resposta:', response.status);
        console.error('Dados completos:', data);
        
        if (errorDiv) {
            errorDiv.textContent = errorMsg;
            errorDiv.classList.add('show');
        }
        if (typeof showToast === 'function') {
            showToast(errorMsg, 'error');
        }
        if (typeof hideLoading === 'function') {
            hideLoading();
        }
    } catch (error) {
        // Verificar se é erro de extensão (403 permission error do Chrome)
        const errorStack = error.stack || '';
        const isExtensionError = 
            error.code === 403 || 
            error.name === 'i' || 
            (error.httpStatus === 200 && error.code === 403) ||
            error.message?.includes('permission error') ||
            error.message?.toLowerCase().includes('permission') ||
            errorStack.includes('background.js') ||
            errorStack.includes('chrome-extension');
        
        if (!isExtensionError) {
            console.error('❌ Erro capturado no login:', error);
            console.error('Tipo do erro:', error.name);
            console.error('Mensagem:', error.message);
            console.error('Code:', error.code);
            console.error('HTTP Status:', error.httpStatus);
        } else {
            console.log('🔇 Erro de extensão detectado no catch - será ignorado');
        }
        
        // SEMPRE verificar autenticação quando há erro, pois pode ser erro de extensão
        console.log('🔍 Verificando autenticação (erro de extensão não afeta o login)...');
        
        try {
            const checkResponse = await fetch(`${API_BASE}/auth/check`, {
                credentials: 'include',
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            console.log('Status da verificação:', checkResponse.status);
            
            if (checkResponse.ok) {
                const authData = await checkResponse.json();
                console.log('Dados de autenticação:', authData);
                
                if (authData && authData.authenticated) {
                    if (typeof currentUser !== 'undefined') {
                        currentUser = authData.user || email;
                    }
                    console.log('✅ Login confirmado via verificação!', currentUser);
                    if (typeof showToast === 'function') {
                        showToast('Login realizado com sucesso!', 'success');
                    }
                    if (typeof hideLoading === 'function') {
                        hideLoading();
                    }
                    if (typeof showDashboard === 'function') {
                        showDashboard();
                    }
                    return;
                }
            }
        } catch (checkError) {
            console.error('❌ Erro ao verificar autenticação:', checkError);
        }
        
        // Só mostrar erro se realmente não conseguiu autenticar E não é erro de extensão
        if (!isExtensionError) {
            const errorMessage = error.message || 'Erro ao conectar com o servidor';
            console.error('❌ Falha no login:', errorMessage);
            
            if (errorDiv) {
                errorDiv.textContent = 'Erro ao conectar com o servidor. Verifique se o servidor está rodando na porta 3000.';
                errorDiv.classList.add('show');
            }
            if (typeof showToast === 'function') {
                showToast('Erro ao conectar com o servidor. Verifique se o servidor está rodando.', 'error');
            }
        } else {
            // Se for erro de extensão, apenas logar que foi ignorado
            console.log('⚠️ Erro de extensão ignorado. Verificando se login funcionou...');
        }
        if (typeof hideLoading === 'function') {
            hideLoading();
        }
    }
};

// Confirmar IMEDIATAMENTE que a função foi definida
console.log('🔍 Verificando handleLogin...');
if (typeof window.handleLogin === 'function') {
    console.log('✅ window.handleLogin definido com sucesso!');
} else {
    console.error('❌ ERRO CRÍTICO: window.handleLogin não foi definido!');
    // Fallback: definir uma função básica
    window.handleLogin = function(e) {
        alert('Erro: Função de login não foi carregada corretamente. Por favor, recarregue a página (Ctrl+F5).');
        console.error('handleLogin fallback chamado - função não foi carregada');
    };
}

// Estado da aplicação
let currentUser = null;
let jornais = [];
let editingJornal = null;
let editingCarrossel = null;
let editingResponsavel = null;
let editingFaq = null; // Usar editingFaq para consistência
let editingSite = null;
let editingNoticia = null;
let editingColunista = null;
let colunistas = [];

// Fechar modais - definir ANTES dos event listeners para garantir disponibilidade
window.closeModal = function() {
    console.log('🔴 closeModal chamada!');
    try {
        const modal = document.getElementById('jornalModal');
        if (modal) {
            console.log('📋 Modal encontrado, fechando...');
            modal.classList.add('hidden');
            modal.style.display = 'none';
            // Forçar estilo inline para garantir
            modal.setAttribute('style', 'display: none !important;');
            console.log('✅ Modal fechado');
        } else {
            console.error('❌ Modal não encontrado!');
        }
        editingJornal = null;
        
        // Resetar formulário
        const form = document.getElementById('jornalForm');
        if (form) {
            form.reset();
        }
        
        // Limpar previews
        const capaPreview = document.getElementById('capaPreview');
        if (capaPreview) {
            capaPreview.innerHTML = '';
        }
        
        const pdfPreview = document.getElementById('pdfPreview');
        if (pdfPreview) {
            pdfPreview.innerHTML = '';
            pdfPreview.classList.remove('show');
        }
    } catch (error) {
        console.error('❌ Erro ao fechar modal:', error);
        // Fallback: tentar fechar de qualquer forma
        const modal = document.getElementById('jornalModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.add('hidden');
            modal.setAttribute('style', 'display: none !important;');
        }
    }
};

// Fechar modal de carrossel - definir ANTES dos event listeners para garantir disponibilidade
window.closeCarrosselModal = function() {
    console.log('🔴 closeCarrosselModal chamada!');
    try {
        const modal = document.getElementById('carrosselModal');
        if (modal) {
            console.log('📋 Modal de carrossel encontrado, fechando...');
            modal.classList.add('hidden');
            modal.style.display = 'none';
            // Forçar estilo inline para garantir
            modal.setAttribute('style', 'display: none !important;');
            console.log('✅ Modal de carrossel fechado');
        } else {
            console.error('❌ Modal de carrossel não encontrado!');
        }
        editingCarrossel = null;
        
        // Resetar formulário
        const form = document.getElementById('carrosselForm');
        if (form) {
            form.reset();
        }
        
        // Limpar preview
        const imagemPreview = document.getElementById('carrosselImagemPreview');
        if (imagemPreview) {
            imagemPreview.innerHTML = '';
        }
    } catch (error) {
        console.error('❌ Erro ao fechar modal de carrossel:', error);
        // Fallback: tentar fechar de qualquer forma
        const modal = document.getElementById('carrosselModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.add('hidden');
            modal.setAttribute('style', 'display: none !important;');
        }
    }
};

// Fechar modal de responsável - definir ANTES dos event listeners para garantir disponibilidade
window.closeResponsavelModal = function() {
    console.log('🔴 closeResponsavelModal chamada!');
    try {
        const modal = document.getElementById('responsavelModal');
        if (modal) {
            console.log('📋 Modal de responsável encontrado, fechando...');
            modal.classList.add('hidden');
            modal.style.display = 'none';
            // Forçar estilo inline para garantir
            modal.setAttribute('style', 'display: none !important;');
            console.log('✅ Modal de responsável fechado');
        } else {
            console.error('❌ Modal de responsável não encontrado!');
        }
        editingResponsavel = null;
        
        // Resetar formulário
        const form = document.getElementById('responsavelForm');
        if (form) {
            form.reset();
        }
        
        // Limpar preview
        const imagemPreview = document.getElementById('responsavelImagemPreview');
        if (imagemPreview) {
            imagemPreview.innerHTML = '';
        }
    } catch (error) {
        console.error('❌ Erro ao fechar modal de responsável:', error);
        // Fallback: tentar fechar de qualquer forma
        const modal = document.getElementById('responsavelModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.add('hidden');
            modal.setAttribute('style', 'display: none !important;');
        }
    }
};

// Fechar modal de FAQ - definir ANTES dos event listeners para garantir disponibilidade
window.closeFaqModal = function() {
    console.log('🔴 closeFaqModal chamada!');
    try {
        const modal = document.getElementById('faqModal');
        if (modal) {
            console.log('📋 Modal de FAQ encontrado, fechando...');
            modal.classList.add('hidden');
            modal.style.display = 'none';
            // Forçar estilo inline para garantir
            modal.setAttribute('style', 'display: none !important;');
            console.log('✅ Modal de FAQ fechado');
        } else {
            console.error('❌ Modal de FAQ não encontrado!');
        }
        editingFaq = null;
        
        // Resetar formulário
        const form = document.getElementById('faqForm');
        if (form) {
            form.reset();
        }
    } catch (error) {
        console.error('❌ Erro ao fechar modal de FAQ:', error);
        // Fallback: tentar fechar de qualquer forma
        const modal = document.getElementById('faqModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.add('hidden');
            modal.setAttribute('style', 'display: none !important;');
        }
    }
};

// Fechar modal de Site - definir ANTES dos event listeners para garantir disponibilidade
window.closeSiteModal = function() {
    console.log('🔴 closeSiteModal chamada!');
    try {
        const modal = document.getElementById('siteModal');
        if (modal) {
            console.log('📋 Modal de Site encontrado, fechando...');
            modal.classList.add('hidden');
            modal.style.display = 'none';
            // Forçar estilo inline para garantir
            modal.setAttribute('style', 'display: none !important;');
            console.log('✅ Modal de Site fechado');
        } else {
            console.error('❌ Modal de Site não encontrado!');
        }
        editingSite = null;
        
        // Resetar formulário
        const form = document.getElementById('siteForm');
        if (form) {
            form.reset();
        }
        
        // Limpar preview
        const imagemPreview = document.getElementById('siteImagemPreview');
        if (imagemPreview) {
            imagemPreview.innerHTML = '';
        }
    } catch (error) {
        console.error('❌ Erro ao fechar modal de Site:', error);
        // Fallback: tentar fechar de qualquer forma
        const modal = document.getElementById('siteModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.add('hidden');
            modal.setAttribute('style', 'display: none !important;');
        }
    }
};

// Fechar modal de Notícia - definir ANTES dos event listeners para garantir disponibilidade
window.closeNoticiaModal = function() {
    console.log('🔴 closeNoticiaModal chamada!');
    try {
        const modal = document.getElementById('noticiaModal');
        if (modal) {
            console.log('📋 Modal de Notícia encontrado, fechando...');
            modal.classList.add('hidden');
            modal.style.display = 'none';
            // Forçar estilo inline para garantir
            modal.setAttribute('style', 'display: none !important;');
            console.log('✅ Modal de Notícia fechado');
        } else {
            console.error('❌ Modal de Notícia não encontrado!');
        }
        editingNoticia = null;
        
        // Resetar formulário
        const form = document.getElementById('noticiaForm');
        if (form) {
            form.reset();
        }
        
        // Limpar preview
        const imagemPreview = document.getElementById('noticiaImagePreview');
        if (imagemPreview) {
            imagemPreview.innerHTML = '';
        }
    } catch (error) {
        console.error('❌ Erro ao fechar modal de Notícia:', error);
        // Fallback: tentar fechar de qualquer forma
        const modal = document.getElementById('noticiaModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.add('hidden');
            modal.setAttribute('style', 'display: none !important;');
        }
    }
};

// Função handleLogin já foi definida no início do arquivo (logo após API_BASE)
// Não é necessário redefini-la aqui - usar a definição global do início

// Sistema de Toast Notifications
function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <div class="toast-content">
            <div class="toast-title">${type === 'success' ? 'Sucesso' : type === 'error' ? 'Erro' : type === 'warning' ? 'Aviso' : 'Informação'}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Loading Overlay
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        overlay.classList.remove('hidden');
    }
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.classList.add('hidden');
    }
}

// Tratamento global de erros não capturados
window.addEventListener('error', (event) => {
    const filename = event.filename || '';
    const message = event.message || '';
    const target = event.target || {};
    const error = event.error || {};
    const errorStack = error.stack || '';
    
    // Ignorar erros de arquivos que não pertencem ao dashboard
    if (
        filename.includes('gsap.min.js') ||
        filename.includes('style_efeitos.js') ||
        filename.includes('materia-jornal') ||
        target.src?.includes('gsap.min.js') ||
        target.src?.includes('style_efeitos.js') ||
        target.src?.includes('materia-jornal') ||
        filename.includes('content-script') || 
        filename.includes('extension') ||
        filename.includes('chrome-extension') ||
        filename.includes('background.js') ||
        filename.includes('style_efeitos') ||
        filename.includes('_style_efeitos') ||
        errorStack.includes('background.js') ||
        errorStack.includes('chrome-extension') ||
        message.includes('gsap is not defined') ||
        message.includes('GSAP') ||
        message.includes('ScrollTrigger') ||
        message.includes('permission error') ||
        message.includes('MIME type') ||
        message.includes('UserAuthError') ||
        error.name === 'i' ||
        (error.code === 403 && error.httpStatus === 200)
    ) {
        // Prevenir que o erro apareça no console
        event.preventDefault();
        event.stopPropagation();
        return false;
    }
    
    console.error('Erro capturado:', event.error);
});

// Tratamento de promessas rejeitadas não capturadas
window.addEventListener('unhandledrejection', (event) => {
    // Ignorar erros de scripts de terceiros/extensões
    const errorSource = event.reason?.stack || '';
    const errorMessage = event.reason?.message || '';
    const errorName = event.reason?.name || '';
    const errorCode = event.reason?.code;
    const httpStatus = event.reason?.httpStatus;
    const reqInfo = event.reason?.reqInfo || {};
    const reqPath = reqInfo.path || '';
    const reqPathPrefix = reqInfo.pathPrefix || '';
    const originalError = event.reason?.originalError || {};
    const originalErrorStack = originalError.stack || '';
    const errorString = JSON.stringify(event.reason || '');
    
    // Ignorar erros 403 que podem vir de extensões (mesmo com httpStatus 200)
    // IMPORTANTE: Sempre ignorar esses erros primeiro, antes de qualquer outra verificação
    if (
        errorCode === 403 || 
        (httpStatus === 200 && errorCode === 403) || 
        errorName === 'i' ||
        originalErrorStack.includes('background.js') ||
        originalErrorStack.includes('chrome-extension') ||
        reqPath.includes('/writing/') ||
        reqPath.includes('/site_integration/') ||
        reqPathPrefix.includes('/writing') ||
        reqPathPrefix.includes('/site_integration') ||
        errorMessage.includes('permission error') ||
        reqPath.includes('get_template_list') ||
        reqPath.includes('template_list') ||
        errorString.includes('site_integration') ||
        errorString.includes('template_list') ||
        errorString.includes('permission error') ||
        errorString.includes('background.js')
    ) {
        // Silenciar completamente - é de extensão do navegador
        console.log('🔇 Erro de extensão ignorado (não afeta o login)');
        event.preventDefault();
        event.stopPropagation();
        return;
    }
    
    // Ignorar erros de arquivos que não pertencem ao dashboard
    if (
        errorSource.includes('gsap.min.js') ||
        errorSource.includes('style_efeitos.js') ||
        errorSource.includes('materia-jornal') ||
        errorMessage.includes('gsap.min.js') ||
        errorMessage.includes('style_efeitos.js') ||
        errorMessage.includes('materia-jornal') ||
        errorString.includes('gsap.min.js') ||
        errorString.includes('style_efeitos.js') ||
        errorString.includes('materia-jornal') ||
        errorSource.includes('content-script') || 
        errorSource.includes('extension') ||
        errorSource.includes('chrome-extension') ||
        errorSource.includes('background.js') ||
        errorSource.includes('style_efeitos') ||
        errorSource.includes('_style_efeitos') ||
        errorMessage.includes('gsap is not defined') ||
        errorMessage.includes('GSAP') ||
        errorMessage.includes('ScrollTrigger') ||
        errorMessage.includes('permission error') ||
        errorMessage.includes('MIME type') ||
        errorMessage.includes('Refused to execute script') ||
        reqPath.includes('/site_integration') ||
        reqPath.includes('/writing/') ||
        reqPathPrefix.includes('/writing') ||
        reqPathPrefix.includes('/site_integration') ||
        reqPath.includes('template_list') ||
        reqPath.includes('get_template_list') ||
        originalErrorStack.includes('background.js')
    ) {
        event.preventDefault(); // Prevenir erro no console
        event.stopPropagation();
        return;
    }
    
    console.error('Promise rejeitada não tratada:', event.reason);
    // Mostrar toast apenas para erros do nosso código
    if (event.reason && typeof event.reason === 'object' && !event.reason.httpError) {
        showToast('Ocorreu um erro inesperado', 'error');
    }
});

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM carregado, iniciando aplicação...');
    
    // Garantir que o loading overlay está oculto desde o início
    hideLoading();
    
    // Configurar event listeners PRIMEIRO, antes de tudo
    console.log('⚙️ Configurando event listeners...');
    try {
        setupEventListeners();
        console.log('✅ Event listeners configurados!');
    } catch (err) {
        console.error('❌ Erro ao configurar event listeners:', err);
        console.error('Stack:', err.stack);
    }
    
    // Teste direto do botão para garantir que funciona
    const testBtn = document.getElementById('loginSubmitBtn');
    if (testBtn) {
        console.log('✅ Botão encontrado na inicialização:', testBtn);
        // Adicionar listener direto como backup (múltiplos listeners não são problema)
        testBtn.onclick = function(e) {
            console.log('🖱️ BOTÃO CLICADO (onclick direto)!');
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            if (typeof window.handleLogin === 'function') {
                window.handleLogin(e || window.event);
            } else if (typeof handleLogin === 'function') {
                handleLogin(e || window.event);
            } else {
                console.error('❌ handleLogin não está disponível!');
                alert('Erro: função de login não carregada. Recarregue a página.');
            }
            return false;
        };
        console.log('✅ Listener onclick direto adicionado ao botão');
        
        // Também adicionar addEventListener como backup
        testBtn.addEventListener('click', function(e) {
            console.log('🖱️ BOTÃO CLICADO (addEventListener)!');
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.handleLogin === 'function') {
                window.handleLogin(e);
            } else if (typeof handleLogin === 'function') {
                handleLogin(e);
            } else {
                console.error('❌ handleLogin não está disponível no addEventListener!');
            }
        }, { capture: false, once: false });
        console.log('✅ Listener addEventListener também adicionado');
    } else {
        console.error('❌ Botão loginSubmitBtn NÃO encontrado na inicialização!');
        console.error('Tentando encontrar novamente após 1 segundo...');
        setTimeout(() => {
            const retryBtn = document.getElementById('loginSubmitBtn');
            if (retryBtn) {
                console.log('✅ Botão encontrado no retry!');
                retryBtn.onclick = function(e) {
                    console.log('🖱️ BOTÃO CLICADO (retry onclick)!');
                    if (typeof window.handleLogin === 'function') {
                        window.handleLogin(e || window.event);
                    } else if (typeof handleLogin === 'function') {
                        handleLogin(e || window.event);
                    }
                    return false;
                };
            } else {
                console.error('❌ Botão ainda não encontrado após retry!');
            }
        }, 1000);
    }
    
    // Verificar autenticação com timeout
    try {
        await Promise.race([
            checkAuth(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout na verificação de autenticação')), 5000)
            )
        ]);
    } catch (err) {
        console.error('Erro na verificação de autenticação:', err);
        // Sempre mostrar login em caso de erro
        showLogin();
        hideLoading();
    }
});

// Verificar autenticação
async function checkAuth() {
    try {
        console.log('Verificando autenticação...');
        hideLoading(); // Garantir que o loading está oculto
        
        const response = await fetch(`${API_BASE}/auth/check`, {
            credentials: 'include',
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        console.log('Status da resposta:', response.status);
        
        if (!response.ok) {
            console.log('Resposta não OK:', response.status);
            showLogin();
            hideLoading();
            return;
        }
        
        const data = await response.json();
        console.log('Dados de autenticação recebidos:', data);
        
        if (data && data.authenticated) {
            currentUser = data.user || data.email || 'Usuário';
            console.log('Usuário autenticado:', currentUser);
            showDashboard();
        } else {
            console.log('Usuário não autenticado');
            showLogin();
        }
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        console.error('Tipo do erro:', error.name);
        console.error('Mensagem:', error.message);
        // Sempre mostrar login em caso de erro
        showLogin();
        hideLoading();
    }
}

// Event Listeners
function setupEventListeners() {
    console.log('Configurando event listeners...');
    
    // Login
    const loginForm = document.getElementById('loginForm');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    
    if (loginForm) {
        console.log('✅ Formulário de login encontrado, adicionando listeners...');
        
        // Listener no formulário (para Enter key)
        loginForm.addEventListener('submit', (e) => {
            console.log('📝 Formulário submetido (Enter key)');
            e.preventDefault();
            e.stopPropagation();
            if (typeof window.handleLogin === 'function') {
                window.handleLogin(e);
            } else if (typeof handleLogin === 'function') {
                handleLogin(e);
            } else {
                console.error('❌ handleLogin não está disponível no submit do formulário!');
                alert('Erro: Função de login não disponível. Por favor, recarregue a página.');
            }
            return false;
        });
        
        // Listener no botão (clique)
        if (loginSubmitBtn) {
            console.log('✅ Botão de submit encontrado:', loginSubmitBtn);
            loginSubmitBtn.addEventListener('click', function(e) {
                console.log('🖱️ BOTÃO DE LOGIN CLICADO!');
                console.log('Event:', e);
                e.preventDefault();
                e.stopPropagation();
                if (typeof window.handleLogin === 'function') {
                    window.handleLogin(e);
                } else if (typeof handleLogin === 'function') {
                    handleLogin(e);
                } else {
                    console.error('❌ handleLogin não está disponível no click do botão!');
                    alert('Erro: Função de login não disponível. Por favor, recarregue a página.');
                }
                return false;
            });
            console.log('✅ Listener adicionado ao botão com sucesso');
        } else {
            console.error('❌ Botão de submit (loginSubmitBtn) NÃO encontrado!');
            console.log('Procurando por qualquer botão no formulário...');
            const anyBtn = loginForm.querySelector('button');
            console.log('Botão encontrado:', anyBtn);
        }
    } else {
        console.error('❌ Formulário de login NÃO encontrado!');
    }
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Novo Jornal
    const newJornalBtn = document.getElementById('newJornalBtn');
    if (newJornalBtn) {
        console.log('✅ Botão "Novo Jornal" encontrado, adicionando listener...');
        newJornalBtn.addEventListener('click', (e) => {
            console.log('🖱️ Botão "Novo Jornal" clicado!');
            e.preventDefault();
            e.stopPropagation();
            try {
                openJornalModal();
            } catch (error) {
                console.error('❌ Erro ao abrir modal:', error);
                showToast('Erro ao abrir o formulário de novo jornal. Por favor, recarregue a página.', 'error');
            }
        });
        console.log('✅ Listener adicionado ao botão "Novo Jornal" com sucesso!');
    } else {
        console.error('❌ Botão "Novo Jornal" (newJornalBtn) NÃO encontrado!');
        console.log('Tentando encontrar novamente em 500ms...');
        setTimeout(() => {
            const retryBtn = document.getElementById('newJornalBtn');
            if (retryBtn) {
                console.log('✅ Botão encontrado na segunda tentativa!');
                retryBtn.addEventListener('click', (e) => {
                    console.log('🖱️ Botão "Novo Jornal" clicado!');
                    e.preventDefault();
                    e.stopPropagation();
                    openJornalModal();
                });
            } else {
                console.error('❌ Botão ainda não encontrado após segunda tentativa!');
            }
        }, 500);
    }
    
    // Modal - garantir que os event listeners sejam anexados
    const closeModalBtn = document.getElementById('closeModal');
    if (closeModalBtn) {
        // Adicionar múltiplos listeners para garantir que funcione
        closeModalBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔴 Botão X clicado!');
            if (typeof window.closeModal === 'function') {
                window.closeModal();
            } else if (typeof closeModal === 'function') {
                closeModal();
            } else {
                const modal = document.getElementById('jornalModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                }
            }
        });
        console.log('✅ Listener do botão X adicionado');
    } else {
        console.error('❌ Botão closeModal não encontrado!');
    }
    
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        // Adicionar múltiplos listeners para garantir que funcione
        cancelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔴 Botão Cancelar clicado!');
            if (typeof window.closeModal === 'function') {
                window.closeModal();
            } else if (typeof closeModal === 'function') {
                closeModal();
            } else {
                const modal = document.getElementById('jornalModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                }
            }
        });
        console.log('✅ Listener do botão Cancelar adicionado');
    } else {
        console.error('❌ Botão cancelBtn não encontrado!');
    }
    
    const jornalForm = document.getElementById('jornalForm');
    if (jornalForm) {
        jornalForm.addEventListener('submit', handleSaveJornal);
    }
    
    // Preview de imagem
    const capaInput = document.getElementById('capa');
    if (capaInput) {
        capaInput.addEventListener('change', handleImagePreview);
    }
    
    // Preview de PDF
    const pdfInput = document.getElementById('pdf');
    if (pdfInput) {
        pdfInput.addEventListener('change', handlePdfPreview);
    }
    
    // Fechar modal ao clicar fora (mas não no conteúdo)
    const jornalModal = document.getElementById('jornalModal');
    if (jornalModal) {
        jornalModal.addEventListener('click', function(e) {
            // Só fechar se clicar exatamente no modal (background), não no conteúdo
            if (e.target === jornalModal || e.target.id === 'jornalModal') {
                console.log('🔴 Clique no background do modal, fechando...');
                if (typeof window.closeModal === 'function') {
                    window.closeModal();
                } else if (typeof closeModal === 'function') {
                    closeModal();
                } else {
                    jornalModal.classList.add('hidden');
                    jornalModal.style.display = 'none';
                }
            }
        });
        console.log('✅ Listener para fechar modal ao clicar fora adicionado');
    }
    
    // Prevenir que cliques no modal-content fechem o modal
    const jornalModalContent = document.querySelector('#jornalModal .modal-content');
    if (jornalModalContent) {
        jornalModalContent.addEventListener('click', function(e) {
            // Parar propagação para que cliques no conteúdo não fechem o modal
            e.stopPropagation();
        });
        console.log('✅ Listener para prevenir fechamento ao clicar no conteúdo adicionado');
    }
    
    // Event listeners do modal de responsáveis
    const newResponsavelBtn = document.getElementById('newResponsavelBtn');
    if (newResponsavelBtn) {
        // Já temos o onclick inline, mas adicionar listener também como backup
        newResponsavelBtn.addEventListener('click', () => {
            if (typeof window.openResponsavelModal === 'function') {
                window.openResponsavelModal();
            } else {
                console.error('openResponsavelModal não está disponível!');
                alert('Erro: Função não disponível. Recarregue a página.');
            }
        });
    }
    
    // Event listeners do modal de responsáveis - garantir que os event listeners sejam anexados
    const closeResponsavelModalBtn = document.getElementById('closeResponsavelModal');
    if (closeResponsavelModalBtn) {
        // Adicionar múltiplos listeners para garantir que funcione
        closeResponsavelModalBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔴 Botão X do responsável clicado!');
            if (typeof window.closeResponsavelModal === 'function') {
                window.closeResponsavelModal();
            } else if (typeof closeResponsavelModal === 'function') {
                closeResponsavelModal();
            } else {
                const modal = document.getElementById('responsavelModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                    modal.setAttribute('style', 'display: none !important;');
                }
            }
        });
        console.log('✅ Listener do botão X do responsável adicionado');
    } else {
        console.error('❌ Botão closeResponsavelModal não encontrado!');
    }
    
    const cancelResponsavelBtn = document.getElementById('cancelResponsavelBtn');
    if (cancelResponsavelBtn) {
        // Adicionar múltiplos listeners para garantir que funcione
        cancelResponsavelBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔴 Botão Cancelar do responsável clicado!');
            if (typeof window.closeResponsavelModal === 'function') {
                window.closeResponsavelModal();
            } else if (typeof closeResponsavelModal === 'function') {
                closeResponsavelModal();
            } else {
                const modal = document.getElementById('responsavelModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                    modal.setAttribute('style', 'display: none !important;');
                }
            }
        });
        console.log('✅ Listener do botão Cancelar do responsável adicionado');
    } else {
        console.error('❌ Botão cancelResponsavelBtn não encontrado!');
    }
    
    const responsavelForm = document.getElementById('responsavelForm');
    if (responsavelForm) {
        responsavelForm.addEventListener('submit', handleSaveResponsavel);
    }
    
    // Preview de imagem do responsável
    const responsavelImagemInput = document.getElementById('responsavelImagem');
    if (responsavelImagemInput) {
        responsavelImagemInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const preview = document.getElementById('responsavelImagemPreview');
            
            if (file && preview) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.innerHTML = `
                        <div style="position: relative; display: inline-block;">
                            <img src="${e.target.result}" alt="Preview" style="max-width: 300px; max-height: 300px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); object-fit: cover;">
                            <div style="margin-top: 8px; font-size: 12px; color: #10b981; font-weight: 600;">
                                ✓ Foto selecionada: ${file.name}
                            </div>
                        </div>
                    `;
                };
                reader.onerror = () => {
                    preview.innerHTML = '<div style="color: #ef4444;">Erro ao carregar imagem</div>';
                };
                reader.readAsDataURL(file);
            } else if (preview) {
                preview.innerHTML = '';
            }
        });
    }
    
    // Fechar modal ao clicar fora (mas não no conteúdo)
    const responsavelModal = document.getElementById('responsavelModal');
    if (responsavelModal) {
        responsavelModal.addEventListener('click', function(e) {
            // Só fechar se clicar exatamente no modal (background), não no conteúdo
            if (e.target === responsavelModal || e.target.id === 'responsavelModal') {
                console.log('🔴 Clique no background do modal de responsável, fechando...');
                if (typeof window.closeResponsavelModal === 'function') {
                    window.closeResponsavelModal();
                } else if (typeof closeResponsavelModal === 'function') {
                    closeResponsavelModal();
                } else {
                    responsavelModal.classList.add('hidden');
                    responsavelModal.style.display = 'none';
                    responsavelModal.setAttribute('style', 'display: none !important;');
                }
            }
        });
        console.log('✅ Listener para fechar modal de responsável ao clicar fora adicionado');
    }
    
    // Prevenir que cliques no modal-content fechem o modal
    const responsavelModalContent = document.querySelector('#responsavelModal .modal-content');
    if (responsavelModalContent) {
        responsavelModalContent.addEventListener('click', function(e) {
            // Parar propagação para que cliques no conteúdo não fechem o modal
            e.stopPropagation();
        });
        console.log('✅ Listener para prevenir fechamento ao clicar no conteúdo do responsável adicionado');
    }
    
    // Event listeners do modal de FAQ
    const newFaqBtn = document.getElementById('newFaqBtn');
    if (newFaqBtn) {
        // Já temos o onclick inline, mas adicionar listener também como backup
        newFaqBtn.addEventListener('click', () => {
            if (typeof window.openFaqModal === 'function') {
                window.openFaqModal();
            } else {
                console.error('openFaqModal não está disponível!');
                alert('Erro: Função não disponível. Recarregue a página.');
            }
        });
    }
    
    // Event listeners do modal de FAQ - garantir que os event listeners sejam anexados
    const closeFaqModalBtn = document.getElementById('closeFaqModal');
    if (closeFaqModalBtn) {
        // Adicionar múltiplos listeners para garantir que funcione
        closeFaqModalBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔴 Botão X do FAQ clicado!');
            if (typeof window.closeFaqModal === 'function') {
                window.closeFaqModal();
            } else if (typeof closeFaqModal === 'function') {
                closeFaqModal();
            } else {
                const modal = document.getElementById('faqModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                    modal.setAttribute('style', 'display: none !important;');
                }
            }
        });
        console.log('✅ Listener do botão X do FAQ adicionado');
    } else {
        console.error('❌ Botão closeFaqModal não encontrado!');
    }
    
    const cancelFaqBtn = document.getElementById('cancelFaqBtn');
    if (cancelFaqBtn) {
        // Adicionar múltiplos listeners para garantir que funcione
        cancelFaqBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔴 Botão Cancelar do FAQ clicado!');
            if (typeof window.closeFaqModal === 'function') {
                window.closeFaqModal();
            } else if (typeof closeFaqModal === 'function') {
                closeFaqModal();
            } else {
                const modal = document.getElementById('faqModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                    modal.setAttribute('style', 'display: none !important;');
                }
            }
        });
        console.log('✅ Listener do botão Cancelar do FAQ adicionado');
    } else {
        console.error('❌ Botão cancelFaqBtn não encontrado!');
    }
    
    const faqForm = document.getElementById('faqForm');
    if (faqForm) {
        faqForm.addEventListener('submit', handleSaveFAQ);
    }
    
    // Fechar modal ao clicar fora (mas não no conteúdo)
    const faqModal = document.getElementById('faqModal');
    if (faqModal) {
        faqModal.addEventListener('click', function(e) {
            // Só fechar se clicar exatamente no modal (background), não no conteúdo
            if (e.target === faqModal || e.target.id === 'faqModal') {
                console.log('🔴 Clique no background do modal de FAQ, fechando...');
                if (typeof window.closeFaqModal === 'function') {
                    window.closeFaqModal();
                } else if (typeof closeFaqModal === 'function') {
                    closeFaqModal();
                } else {
                    faqModal.classList.add('hidden');
                    faqModal.style.display = 'none';
                    faqModal.setAttribute('style', 'display: none !important;');
                }
            }
        });
        console.log('✅ Listener para fechar modal de FAQ ao clicar fora adicionado');
    }
    
    // Prevenir que cliques no modal-content fechem o modal
    const faqModalContent = document.querySelector('#faqModal .modal-content');
    if (faqModalContent) {
        faqModalContent.addEventListener('click', function(e) {
            // Parar propagação para que cliques no conteúdo não fechem o modal
            e.stopPropagation();
        });
        console.log('✅ Listener para prevenir fechamento ao clicar no conteúdo do FAQ adicionado');
    }
    
    // Event listeners do modal de Sites
    const newSiteBtn = document.getElementById('newSiteBtn');
    if (newSiteBtn) {
        // Já temos o onclick inline, mas adicionar listener também como backup
        newSiteBtn.addEventListener('click', () => {
            if (typeof window.openSiteModal === 'function') {
                window.openSiteModal();
            } else {
                console.error('openSiteModal não está disponível!');
                alert('Erro: Função não disponível. Recarregue a página.');
            }
        });
    }
    
    // Event listeners do modal de Sites - garantir que os event listeners sejam anexados
    const closeSiteModalBtn = document.getElementById('closeSiteModal');
    if (closeSiteModalBtn) {
        // Adicionar múltiplos listeners para garantir que funcione
        closeSiteModalBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔴 Botão X do Site clicado!');
            if (typeof window.closeSiteModal === 'function') {
                window.closeSiteModal();
            } else if (typeof closeSiteModal === 'function') {
                closeSiteModal();
            } else {
                const modal = document.getElementById('siteModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                    modal.setAttribute('style', 'display: none !important;');
                }
            }
        });
        console.log('✅ Listener do botão X do Site adicionado');
    } else {
        console.error('❌ Botão closeSiteModal não encontrado!');
    }
    
    const cancelSiteBtn = document.getElementById('cancelSiteBtn');
    if (cancelSiteBtn) {
        // Adicionar múltiplos listeners para garantir que funcione
        cancelSiteBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔴 Botão Cancelar do Site clicado!');
            if (typeof window.closeSiteModal === 'function') {
                window.closeSiteModal();
            } else if (typeof closeSiteModal === 'function') {
                closeSiteModal();
            } else {
                const modal = document.getElementById('siteModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                    modal.setAttribute('style', 'display: none !important;');
                }
            }
        });
        console.log('✅ Listener do botão Cancelar do Site adicionado');
    } else {
        console.error('❌ Botão cancelSiteBtn não encontrado!');
    }
    
    const siteForm = document.getElementById('siteForm');
    if (siteForm) {
        siteForm.addEventListener('submit', handleSaveSite);
    }
    
    // Preview de imagem do site
    const siteImagemInput = document.getElementById('siteImagem');
    if (siteImagemInput) {
        siteImagemInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const preview = document.getElementById('siteImagemPreview');
            
            if (file && preview) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.innerHTML = `
                        <div style="position: relative; display: inline-block;">
                            <img src="${e.target.result}" alt="Preview" style="max-width: 300px; max-height: 300px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); object-fit: cover;">
                            <div style="margin-top: 8px; font-size: 12px; color: #10b981; font-weight: 600;">
                                ✓ Logo selecionado: ${file.name}
                            </div>
                        </div>
                    `;
                };
                reader.onerror = () => {
                    preview.innerHTML = '<div style="color: #ef4444;">Erro ao carregar imagem</div>';
                };
                reader.readAsDataURL(file);
            } else if (preview) {
                preview.innerHTML = '';
            }
        });
    }
    
    // Fechar modal ao clicar fora (mas não no conteúdo)
    const siteModal = document.getElementById('siteModal');
    if (siteModal) {
        siteModal.addEventListener('click', function(e) {
            // Só fechar se clicar exatamente no modal (background), não no conteúdo
            if (e.target === siteModal || e.target.id === 'siteModal') {
                console.log('🔴 Clique no background do modal de Site, fechando...');
                if (typeof window.closeSiteModal === 'function') {
                    window.closeSiteModal();
                } else if (typeof closeSiteModal === 'function') {
                    closeSiteModal();
                } else {
                    siteModal.classList.add('hidden');
                    siteModal.style.display = 'none';
                    siteModal.setAttribute('style', 'display: none !important;');
                }
            }
        });
        console.log('✅ Listener para fechar modal de Site ao clicar fora adicionado');
    }
    
    // Prevenir que cliques no modal-content fechem o modal
    const siteModalContent = document.querySelector('#siteModal .modal-content');
    if (siteModalContent) {
        siteModalContent.addEventListener('click', function(e) {
            // Parar propagação para que cliques no conteúdo não fechem o modal
            e.stopPropagation();
        });
        console.log('✅ Listener para prevenir fechamento ao clicar no conteúdo do Site adicionado');
    }
    
    // Event listeners do modal de Notícias
    const newNoticiaBtn = document.getElementById('newNoticiaBtn');
    if (newNoticiaBtn) {
        // Já temos o onclick inline, mas adicionar listener também como backup
        newNoticiaBtn.addEventListener('click', () => {
            if (typeof window.openNoticiaModal === 'function') {
                window.openNoticiaModal();
            } else {
                console.error('openNoticiaModal não está disponível!');
                alert('Erro: Função não disponível. Recarregue a página.');
            }
        });
    }

    // Event listeners do modal de Colunistas
    const newColunistaBtn = document.getElementById('newColunistaBtn');
    if (newColunistaBtn) {
        newColunistaBtn.addEventListener('click', () => {
            if (typeof window.openColunistaModal === 'function') {
                window.openColunistaModal();
            } else {
                console.error('openColunistaModal não está disponível!');
                alert('Erro: Função não disponível. Recarregue a página.');
            }
        });
    }

    const colunistaForm = document.getElementById('colunistaForm');
    if (colunistaForm) {
        colunistaForm.addEventListener('submit', handleSaveColunista);
    }
    
    // Event listeners do modal de Notícias - garantir que os event listeners sejam anexados
    const closeNoticiaModalBtn = document.getElementById('closeNoticiaModal');
    if (closeNoticiaModalBtn) {
        // Adicionar múltiplos listeners para garantir que funcione
        closeNoticiaModalBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔴 Botão X da Notícia clicado!');
            if (typeof window.closeNoticiaModal === 'function') {
                window.closeNoticiaModal();
            } else if (typeof closeNoticiaModal === 'function') {
                closeNoticiaModal();
            } else {
                const modal = document.getElementById('noticiaModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                    modal.setAttribute('style', 'display: none !important;');
                }
            }
        });
        console.log('✅ Listener do botão X da Notícia adicionado');
    } else {
        console.error('❌ Botão closeNoticiaModal não encontrado!');
    }
    
    const cancelNoticiaBtn = document.getElementById('cancelNoticiaBtn');
    if (cancelNoticiaBtn) {
        // Adicionar múltiplos listeners para garantir que funcione
        cancelNoticiaBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔴 Botão Cancelar da Notícia clicado!');
            if (typeof window.closeNoticiaModal === 'function') {
                window.closeNoticiaModal();
            } else if (typeof closeNoticiaModal === 'function') {
                closeNoticiaModal();
            } else {
                const modal = document.getElementById('noticiaModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                    modal.setAttribute('style', 'display: none !important;');
                }
            }
        });
        console.log('✅ Listener do botão Cancelar da Notícia adicionado');
    } else {
        console.error('❌ Botão cancelNoticiaBtn não encontrado!');
    }
    
    const noticiaForm = document.getElementById('noticiaForm');
    if (noticiaForm) {
        noticiaForm.addEventListener('submit', handleSaveNoticia);
    }
    
    // Preview de imagem da notícia
    const noticiaImageInput = document.getElementById('noticiaImage');
    if (noticiaImageInput) {
        noticiaImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const preview = document.getElementById('noticiaImagePreview');
            
            if (file && preview) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.innerHTML = `
                        <div style="position: relative; display: inline-block;">
                            <img src="${e.target.result}" alt="Preview" style="max-width: 300px; max-height: 300px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); object-fit: cover;">
                            <div style="margin-top: 8px; font-size: 12px; color: #10b981; font-weight: 600;">
                                ✓ Imagem selecionada: ${file.name}
                            </div>
                        </div>
                    `;
                };
                reader.onerror = () => {
                    preview.innerHTML = '<div style="color: #ef4444;">Erro ao carregar imagem</div>';
                };
                reader.readAsDataURL(file);
            } else if (preview) {
                preview.innerHTML = '';
            }
        });
    }
    
    // Fechar modal ao clicar fora (mas não no conteúdo)
    const noticiaModal = document.getElementById('noticiaModal');
    if (noticiaModal) {
        noticiaModal.addEventListener('click', function(e) {
            // Só fechar se clicar exatamente no modal (background), não no conteúdo
            if (e.target === noticiaModal || e.target.id === 'noticiaModal') {
                console.log('🔴 Clique no background do modal de Notícia, fechando...');
                if (typeof window.closeNoticiaModal === 'function') {
                    window.closeNoticiaModal();
                } else if (typeof closeNoticiaModal === 'function') {
                    closeNoticiaModal();
                } else {
                    noticiaModal.classList.add('hidden');
                    noticiaModal.style.display = 'none';
                    noticiaModal.setAttribute('style', 'display: none !important;');
                }
            }
        });
        console.log('✅ Listener para fechar modal de Notícia ao clicar fora adicionado');
    }
    
    // Prevenir que cliques no modal-content fechem o modal
    const noticiaModalContent = document.querySelector('#noticiaModal .modal-content');
    if (noticiaModalContent) {
        noticiaModalContent.addEventListener('click', function(e) {
            // Parar propagação para que cliques no conteúdo não fechem o modal
            e.stopPropagation();
        });
        console.log('✅ Listener para prevenir fechamento ao clicar no conteúdo da Notícia adicionado');
    }
}

// Função auxiliar para verificar autenticação e mostrar dashboard
async function verifyAndShowDashboard(email) {
    try {
        console.log('🔍 Verificando autenticação...');
        const checkResponse = await fetch(`${API_BASE}/auth/check`, {
            credentials: 'include',
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        console.log('Status da verificação:', checkResponse.status);
        
        if (checkResponse.ok) {
            const authData = await checkResponse.json();
            console.log('Dados de autenticação recebidos:', authData);
            
            if (authData && authData.authenticated) {
                currentUser = authData.user || email;
                console.log('✅ AUTENTICADO! Usuário:', currentUser);
                showToast('Login realizado com sucesso!', 'success');
                hideLoading();
                // Chamar showDashboard imediatamente
                console.log('🚀 Chamando showDashboard agora...');
                showDashboard();
                return true; // Login bem-sucedido
            }
        }
        return false; // Não autenticado
    } catch (error) {
        console.error('❌ Erro ao verificar autenticação:', error);
        return false;
    }
}

// Função handleLogin já foi definida no início do arquivo (linha 252)
// Não é necessário redefini-la aqui - usar a definição global do início

// Logout
async function handleLogout() {
    try {
        await fetch(`${API_BASE}/logout`, {
            method: 'POST',
            credentials: 'include'
        }).catch(() => {
            // Ignorar erros de rede no logout
        });
        
        currentUser = null;
        showLogin();
        showToast('Logout realizado com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        currentUser = null;
        showLogin();
    }
}

// Mostrar telas
function showLogin() {
    console.log('Mostrando tela de login');
    const loginScreen = document.getElementById('loginScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');
    
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (dashboardScreen) dashboardScreen.classList.add('hidden');
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) loginForm.reset();
    
    // Garantir que o loading está oculto
    hideLoading();
}

function showDashboard() {
    console.log('=== 🎯 MOSTRANDO DASHBOARD ===');
    const loginScreen = document.getElementById('loginScreen');
    const dashboardScreen = document.getElementById('dashboardScreen');
    
    console.log('Login screen encontrado:', !!loginScreen);
    console.log('Dashboard screen encontrado:', !!dashboardScreen);
    
    if (!loginScreen || !dashboardScreen) {
        console.error('❌ Elementos não encontrados!');
        console.error('loginScreen:', loginScreen);
        console.error('dashboardScreen:', dashboardScreen);
        alert('Erro: Elementos da página não encontrados. Recarregue a página.');
        return;
    }
    
    // Forçar ocultação da tela de login - MÚLTIPLAS FORMAS
    loginScreen.style.display = 'none';
    loginScreen.style.visibility = 'hidden';
    loginScreen.style.opacity = '0';
    loginScreen.classList.add('hidden');
    console.log('✅ Tela de login ocultada');
    console.log('Display:', loginScreen.style.display);
    console.log('Visibility:', loginScreen.style.visibility);
    console.log('Classes:', loginScreen.className);
    
    // Forçar exibição do dashboard - MÚLTIPLAS FORMAS
    dashboardScreen.style.display = 'block';
    dashboardScreen.style.visibility = 'visible';
    dashboardScreen.style.opacity = '1';
    dashboardScreen.classList.remove('hidden');
    console.log('✅ Dashboard exibido');
    console.log('Display:', dashboardScreen.style.display);
    console.log('Visibility:', dashboardScreen.style.visibility);
    console.log('Classes:', dashboardScreen.className);
    
    // Verificar visualmente se está visível (usando computed style)
    setTimeout(() => {
        const loginStyle = window.getComputedStyle(loginScreen);
        const dashboardStyle = window.getComputedStyle(dashboardScreen);
        console.log('=== VERIFICAÇÃO FINAL ===');
        console.log('Login display (computed):', loginStyle.display);
        console.log('Login visibility (computed):', loginStyle.visibility);
        console.log('Dashboard display (computed):', dashboardStyle.display);
        console.log('Dashboard visibility (computed):', dashboardStyle.visibility);
        
        // Se ainda não estiver visível, forçar novamente
        if (dashboardStyle.display === 'none' || dashboardStyle.visibility === 'hidden') {
            console.warn('⚠️ Dashboard ainda não visível, forçando novamente...');
            dashboardScreen.setAttribute('style', 'display: block !important; visibility: visible !important; opacity: 1 !important;');
        }
    }, 100);
    
    const userNameEl = document.getElementById('userName');
    if (userNameEl && currentUser) {
        userNameEl.textContent = `Olá, ${currentUser}`;
        console.log('✅ Nome de usuário atualizado:', currentUser);
    }
    
    // Garantir que o loading está oculto
    hideLoading();
    
    try {
        setupTabs();
        console.log('✅ Tabs configuradas');
        loadJornais();
        console.log('✅ Jornais sendo carregados...');
        console.log('=== ✅ DASHBOARD CONFIGURADO COM SUCESSO ===');
        
        // Forçar scroll para o topo
        window.scrollTo(0, 0);
    } catch (error) {
        console.error('❌ Erro ao configurar dashboard:', error);
        console.error('Stack:', error.stack);
    }
}

// Setup Tabs
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // Remove active de todas as tabs
            tabButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Ativa a tab selecionada
            btn.classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');
            
            // Carrega os dados da tab
            loadTabData(tabName);
        });
    });
}

// Carregar dados da tab
function loadTabData(tabName) {
    switch(tabName) {
        case 'jornais':
            loadJornais();
            break;
        case 'carrossel':
            loadCarrossel();
            break;
        case 'carrossel-medio':
            loadCarrosselMedio();
            break;
        case 'video':
            loadVideo();
            break;
        case 'responsaveis':
            loadResponsaveis();
            break;
        case 'faq':
            loadFAQ();
            break;
        case 'sites':
            loadSites();
            break;
        case 'textos':
            loadTextos();
            break;
        case 'banner':
            loadBanner();
            break;
        case 'noticias':
            loadNoticias();
            break;
        case 'colunistas':
            loadColunistas();
            break;
        case 'pagamentos':
            loadPagamentos();
            break;
    }
}

// Carregar jornais
async function loadJornais() {
    const listDiv = document.getElementById('jornaisList');
    if (!listDiv) {
        console.error('Elemento jornaisList não encontrado');
        return;
    }
    
    listDiv.innerHTML = '<div class="loading">Carregando...</div>';
    
    try {
        console.log('Carregando jornais...');
        const response = await fetch(`${API_BASE}/jornais`, {
            credentials: 'include'
        });
        
        console.log('Resposta recebida:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Dados recebidos:', data);
        
        // Aceitar tanto formato de objeto quanto array direto (compatibilidade)
        if (Array.isArray(data)) {
            jornais = data;
        } else if (data && data.jornais) {
            jornais = data.jornais;
        } else {
            jornais = [];
        }
        
        console.log(`✅ Jornais carregados: ${jornais.length}`);
        console.log('📋 Dados dos jornais:', jornais);
        renderJornais();
    } catch (error) {
        console.error('Erro ao carregar jornais:', error);
        listDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠</div>
                <div class="empty-state-title">Erro ao carregar jornais</div>
                <div class="empty-state-message">Por favor, recarregue a página</div>
            </div>
        `;
    }
}

// Função auxiliar para calcular tempo decorrido
function calcularTempoDecorrido(data) {
    const agora = new Date();
    const diff = agora - data;
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
    const horas = Math.floor(diff / (1000 * 60 * 60));
    const minutos = Math.floor(diff / (1000 * 60));
    
    if (dias > 30) {
        const meses = Math.floor(dias / 30);
        return meses === 1 ? 'há 1 mês' : `há ${meses} meses`;
    } else if (dias > 0) {
        return dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
    } else if (horas > 0) {
        return horas === 1 ? 'há 1 hora' : `há ${horas} horas`;
    } else if (minutos > 0) {
        return minutos === 1 ? 'há 1 minuto' : `há ${minutos} minutos`;
    } else {
        return 'agora mesmo';
    }
}

// Renderizar jornais
function renderJornais() {
    console.log('🎨 Iniciando renderização dos jornais...');
    const listDiv = document.getElementById('jornaisList');
    
    if (!listDiv) {
        console.error('❌ Elemento jornaisList não encontrado!');
        return;
    }
    
    if (jornais.length === 0) {
        console.log('⚠️ Nenhum jornal para renderizar');
        listDiv.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📰</div>
                <div class="empty-state-title">Nenhum jornal cadastrado</div>
                <div class="empty-state-message">Clique em "Novo Jornal" para começar</div>
            </div>
        `;
        return;
    }
    
    console.log(`🔄 Renderizando ${jornais.length} jornais...`);
    const html = jornais.map(jornal => {
        const dataCriacao = jornal.dataCriacao ? new Date(jornal.dataCriacao).toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
        }) : '-';
        const dataAtualizacao = jornal.dataAtualizacao ? new Date(jornal.dataAtualizacao).toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric' 
        }) : '-';
        const descricaoPreview = jornal.descricao ? (jornal.descricao.length > 120 ? jornal.descricao.substring(0, 120) + '...' : jornal.descricao) : 'Sem descrição disponível';
        const tempoDecorrido = jornal.dataCriacao ? calcularTempoDecorrido(new Date(jornal.dataCriacao)) : '';
        
        return `
        <div class="jornal-card">
            <div class="jornal-card-image-wrapper">
                <img src="${jornal.capa || '/uploads/capas/placeholder.png'}" 
                     alt="${jornal.nome}" 
                     class="jornal-card-image"
                     loading="lazy"
                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27200%27 height=%27200%27%3E%3Crect fill=%27%23ecf0f1%27 width=%27200%27 height=%27200%27/%3E%3Ctext fill=%27%23999%27 font-family=%27sans-serif%27 font-size=%2714%27 x=%2750%25%27 y=%2750%25%27 text-anchor=%27middle%27 dy=%27.3em%27%3ESem Imagem%3C/text%3E%3C/svg%3E'">
                <div class="jornal-card-overlay">
                    <div class="jornal-card-badge-group">
                        <span class="jornal-card-badge ${jornal.ativo ? 'ativo' : 'inativo'}">
                            <span class="badge-icon">${jornal.ativo ? '✓' : '✕'}</span>
                            <span class="badge-text">${jornal.ativo ? 'Ativo' : 'Inativo'}</span>
                        </span>
                        ${jornal.ordem ? `<span class="jornal-card-order">#${jornal.ordem}</span>` : ''}
                    </div>
                </div>
                ${jornal.capa ? `<div class="jornal-card-image-hover">
                    <span class="hover-text">👁️ Visualizar</span>
                </div>` : ''}
            </div>
            <div class="jornal-card-body">
                <div class="jornal-card-header">
                    <div class="jornal-card-title-wrapper">
                        <h3 class="jornal-card-title" title="${jornal.nome}">${jornal.nome}</h3>
                        ${tempoDecorrido ? `<span class="jornal-card-time" title="Criado há ${tempoDecorrido}">${tempoDecorrido}</span>` : ''}
                    </div>
                    <div class="jornal-card-meta">
                        <div class="meta-item">
                            <span class="meta-icon">📅</span>
                            <span class="meta-text">${jornal.mes} ${jornal.ano}</span>
                        </div>
                        <div class="meta-divider">•</div>
                        <div class="meta-item">
                            <span class="meta-icon">🆔</span>
                            <span class="meta-text">ID: ${jornal.id}</span>
                        </div>
                    </div>
                </div>
                
                ${jornal.descricao ? `
                <div class="jornal-card-description">
                    <div class="description-icon">📄</div>
                    <p>${descricaoPreview}</p>
                </div>
                ` : ''}
                
                <div class="jornal-card-info-section">
                    <div class="info-section-title">
                        <span class="section-icon">ℹ️</span>
                        <span>Informações</span>
                    </div>
                    <div class="jornal-card-info-grid">
                        <div class="jornal-card-info-item">
                            <span class="info-icon">🔢</span>
                            <div class="info-content">
                                <span class="info-label">Ordem de Exibição</span>
                                <span class="info-value">${jornal.ordem || 'Não definida'}</span>
                            </div>
                        </div>
                        <div class="jornal-card-info-item">
                            <span class="info-icon">📅</span>
                            <div class="info-content">
                                <span class="info-label">Data de Criação</span>
                                <span class="info-value">${dataCriacao}</span>
                            </div>
                        </div>
                        <div class="jornal-card-info-item">
                            <span class="info-icon">🔄</span>
                            <div class="info-content">
                                <span class="info-label">Última Atualização</span>
                                <span class="info-value">${dataAtualizacao}</span>
                            </div>
                        </div>
                        <div class="jornal-card-info-item">
                            <span class="info-icon">${jornal.capa ? '🖼️' : '📷'}</span>
                            <div class="info-content">
                                <span class="info-label">Capa</span>
                                <span class="info-value">${jornal.capa ? 'Configurada' : 'Não configurada'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="jornal-card-footer-info">
                    ${jornal.linkCompra ? `
                    <div class="jornal-card-link success">
                        <span class="link-icon">🔗</span>
                        <span class="link-text">Link de compra configurado</span>
                    </div>
                    ` : `
                    <div class="jornal-card-link warning">
                        <span class="link-icon">⚠️</span>
                        <span class="link-text">Link de compra não configurado</span>
                    </div>
                    `}
                </div>
            </div>
            <div class="jornal-card-actions">
                <button class="btn btn-primary btn-small btn-icon" onclick="editJornal(${jornal.id})" title="Editar jornal">
                    <span class="btn-icon-left">✏️</span>
                    <span>Editar</span>
                </button>
                <button class="btn btn-danger btn-small btn-icon" onclick="deleteJornal(${jornal.id})" title="Excluir jornal">
                    <span class="btn-icon-left">🗑️</span>
                    <span>Excluir</span>
                </button>
            </div>
        </div>
        `;
    }).join('');
    
    listDiv.innerHTML = html;
    console.log('✅ Jornais renderizados com sucesso!');
    console.log(`📊 HTML gerado: ${html.length} caracteres`);
    
    // Aguardar um frame para garantir que o DOM foi atualizado
    requestAnimationFrame(() => {
        // Verificar se os cards foram criados
        const cards = listDiv.querySelectorAll('.jornal-card');
        console.log(`🎴 Cards criados no DOM: ${cards.length}`);
        
        if (cards.length > 0) {
            console.log('✅ Cards estão visíveis no DOM!');
            // Forçar reflow para garantir que os estilos sejam aplicados
            cards.forEach(card => {
                card.style.display = 'flex';
                card.style.opacity = '1';
                card.style.visibility = 'visible';
                // Forçar reflow
                card.offsetHeight;
            });
            console.log('✅ Estilos aplicados aos cards!');
        } else {
            console.error('❌ Nenhum card foi encontrado no DOM!');
            console.log('HTML inserido:', listDiv.innerHTML.substring(0, 200));
        }
        
        // Verificar se o grid está visível
        const grid = document.querySelector('.jornais-grid');
        if (grid) {
            grid.style.display = 'grid';
            console.log('✅ Grid está visível!');
        }
    });
}

// Abrir modal para novo jornal (disponível globalmente)
window.openJornalModal = function(jornal = null) {
    console.log('🔵 openJornalModal chamada!', jornal ? 'Editar' : 'Novo');
    
    try {
        editingJornal = jornal;
        const modal = document.getElementById('jornalModal');
        const form = document.getElementById('jornalForm');
        const title = document.getElementById('modalTitle');
        
        if (!modal) {
            console.error('❌ Modal não encontrado!');
            showToast('Erro: Modal não encontrado. Por favor, recarregue a página.', 'error');
            return;
        }
        
        if (!form) {
            console.error('❌ Formulário não encontrado!');
            showToast('Erro: Formulário não encontrado. Por favor, recarregue a página.', 'error');
            return;
        }
        
        if (!title) {
            console.error('❌ Título do modal não encontrado!');
        }
        
        console.log('✅ Elementos encontrados, resetando formulário...');
        
        form.reset();
        const capaPreview = document.getElementById('capaPreview');
        if (capaPreview) {
            capaPreview.innerHTML = '';
        }
        
        const pdfPreview = document.getElementById('pdfPreview');
        if (pdfPreview) {
            pdfPreview.innerHTML = '';
            pdfPreview.classList.remove('show');
        }
        
        if (jornal) {
            console.log('📝 Editando jornal:', jornal);
            if (title) title.textContent = 'Editar Jornal';
            
            const jornalIdInput = document.getElementById('jornalId');
            if (jornalIdInput) jornalIdInput.value = jornal.id || '';
            
            const nomeInput = document.getElementById('nome');
            if (nomeInput) nomeInput.value = jornal.nome || '';
            
            const mesInput = document.getElementById('mes');
            if (mesInput) mesInput.value = jornal.mes || '';
            
            const anoInput = document.getElementById('ano');
            if (anoInput) anoInput.value = jornal.ano || '';
            
            const descricaoInput = document.getElementById('descricao');
            if (descricaoInput) descricaoInput.value = jornal.descricao || '';
            
            const linkCompraInput = document.getElementById('linkCompra');
            if (linkCompraInput) linkCompraInput.value = jornal.linkCompra || '';
            
            const ordemInput = document.getElementById('ordem');
            if (ordemInput) ordemInput.value = jornal.ordem || '';
            
            const ativoInput = document.getElementById('ativo');
            if (ativoInput) ativoInput.value = jornal.ativo ? 'true' : 'false';
            
            if (jornal.capa && capaPreview) {
                capaPreview.innerHTML = `
                    <div style="position: relative; display: inline-block;">
                        <img src="${jornal.capa}" alt="Capa atual" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <div style="margin-top: 8px; font-size: 12px; color: #64748b; font-weight: 500;">
                            📷 Imagem atual (envie uma nova para substituir)
                        </div>
                    </div>
                `;
            }
            
            // Mostrar PDF atual se existir
            if (jornal.pdf && pdfPreview) {
                const pdfPath = jornal.pdf;
                const pdfName = pdfPath.split('/').pop() || 'jornal.pdf';
                pdfPreview.innerHTML = `
                    <div class="pdf-info">
                        <i class='bx bxs-file-pdf pdf-icon'></i>
                        <div class="pdf-details">
                            <div class="pdf-name">📄 ${pdfName}</div>
                            <div class="pdf-size">PDF atual (envie um novo para substituir)</div>
                        </div>
                    </div>
                `;
                pdfPreview.classList.add('show');
            }
        } else {
            console.log('✨ Criando novo jornal');
            if (title) title.textContent = 'Novo Jornal';
            
            const jornalIdInput = document.getElementById('jornalId');
            if (jornalIdInput) jornalIdInput.value = '';
            
            // Limpar preview ao criar novo
            if (capaPreview) {
                capaPreview.innerHTML = '';
            }
            
            const capaInput = document.getElementById('capa');
            if (capaInput) {
                capaInput.value = '';
            }
            
            const pdfInput = document.getElementById('pdf');
            if (pdfInput) {
                pdfInput.value = '';
            }
        }
        
        console.log('📋 Removendo classe "hidden" do modal...');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        
        console.log('✅ Modal deve estar visível agora!');
        console.log('Classes do modal:', modal.className);
        console.log('Display do modal:', window.getComputedStyle(modal).display);
        
        // Focar no primeiro campo após um pequeno delay para garantir que o modal está visível
        setTimeout(() => {
            const nomeInput = document.getElementById('nome');
            if (nomeInput) {
                nomeInput.focus();
                console.log('✅ Foco no campo nome');
            }
        }, 100);
        
    } catch (error) {
        console.error('❌ Erro ao abrir modal:', error);
        console.error('Stack:', error.stack);
        showToast('Erro ao abrir o formulário. Por favor, recarregue a página.', 'error');
    }
}

// Função closeModal já foi definida no início do arquivo (linha 12)
// Não é necessário redefini-la aqui

// Editar jornal
function editJornal(id) {
    const jornal = jornais.find(j => j.id === id);
    if (jornal) {
        if (typeof window.openJornalModal === 'function') {
            window.openJornalModal(jornal);
        } else {
            console.error('❌ openJornalModal não está disponível!');
            showToast('Erro: Função não disponível. Por favor, recarregue a página.', 'error');
        }
    }
}

// Deletar jornal
async function deleteJornal(id) {
    if (!confirm('Tem certeza que deseja excluir este jornal?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/jornais/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (data.ok) {
            showToast('Jornal excluído com sucesso!', 'success');
            loadJornais();
        } else {
            showToast(data.error || 'Erro ao excluir jornal', 'error');
        }
    } catch (error) {
        console.error('Erro ao excluir jornal:', error);
        showToast('Erro ao excluir jornal', 'error');
    }
}

// Salvar jornal
async function handleSaveJornal(e) {
    // Prevenir comportamento padrão do formulário
    if (e && e.preventDefault) {
        e.preventDefault();
    }
    
    console.log('🔵 ===== INICIANDO SALVAMENTO DE JORNAL =====');
    
    // Encontrar o botão de submit de forma mais robusta
    const form = e?.target || document.getElementById('jornalForm');
    const submitBtn = form?.querySelector('button[type="submit"]') || 
                     document.querySelector('#jornalModal button[type="submit"]');
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        submitBtn.textContent = 'Salvando...';
    }
    
    // Mostrar loading
    if (typeof showLoading === 'function') {
        showLoading();
    }
    
    // Verificar autenticação antes de enviar
    try {
        const authCheck = await fetch(`${API_BASE}/auth/check`, {
            credentials: 'include'
        });
        const authData = await authCheck.json();
        
        if (!authData.authenticated) {
            console.error('❌ Sessão expirada!');
            showToast('Sua sessão expirou. Por favor, faça login novamente.', 'warning');
            currentUser = null;
            if (typeof showLogin === 'function') {
                showLogin();
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('loading');
                submitBtn.textContent = 'Salvar';
            }
            if (typeof hideLoading === 'function') {
                hideLoading();
            }
            return;
        }
        console.log('✅ Autenticação verificada');
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
    }
    
    const id = document.getElementById('jornalId').value;
    
    // Criar FormData manualmente para evitar campos inesperados
    const formData = new FormData();
    
    // Adicionar campos de texto
    formData.append('nome', document.getElementById('nome').value);
    formData.append('mes', document.getElementById('mes').value);
    formData.append('ano', document.getElementById('ano').value);
    formData.append('descricao', document.getElementById('descricao').value || '');
    formData.append('linkCompra', document.getElementById('linkCompra').value || '');
    formData.append('ordem', document.getElementById('ordem').value || '');
    formData.append('ativo', document.getElementById('ativo').value || 'true');
    
    // Adicionar arquivo de capa se existir (apenas se houver arquivo selecionado)
    const capaInput = document.getElementById('capa');
    if (capaInput && capaInput.files && capaInput.files.length > 0) {
        formData.append('capa', capaInput.files[0]);
        console.log('Arquivo de capa adicionado:', capaInput.files[0].name);
    } else {
        console.log('Nenhuma capa selecionada');
    }
    
    // Adicionar arquivo PDF se existir (obrigatório para novos jornais)
    const pdfInput = document.getElementById('pdf');
    if (pdfInput && pdfInput.files && pdfInput.files.length > 0) {
        formData.append('pdf', pdfInput.files[0]);
        console.log('PDF adicionado:', pdfInput.files[0].name);
    } else if (!id) {
        // PDF é obrigatório apenas para novos jornais
        showToast('Por favor, selecione um arquivo PDF para o jornal.', 'error');
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        return;
    } else {
        console.log('Nenhum PDF selecionado (editando jornal existente)');
    }
    
    console.log('Enviando jornal...', { 
        id, 
        hasCapa: capaInput?.files.length > 0,
        hasPdf: pdfInput?.files.length > 0,
        nome: formData.get('nome'),
        mes: formData.get('mes')
    });
    
    try {
        const url = id 
            ? `${API_BASE}/jornais/${id}`
            : `${API_BASE}/jornais`;
        
        const response = await fetch(url, {
            method: id ? 'PUT' : 'POST',
            credentials: 'include',
            body: formData
        });
        
        // Verificar se a resposta é JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Resposta não é JSON:', text.substring(0, 200));
            throw new Error('Resposta inválida do servidor');
        }
        
        const data = await response.json();
        
        console.log('📥 Resposta recebida:', {
            status: response.status,
            ok: response.ok,
            dataOk: data.ok,
            data: data
        });
        
        if (response.ok && data.ok) {
            console.log('✅ Jornal salvo com sucesso!');
            
            // Mostrar toast de sucesso
            showToast('Jornal salvo com sucesso!', 'success');
            
            // Aguardar um pouco para o usuário ver a mensagem
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Fechar modal
            if (typeof window.closeModal === 'function') {
                window.closeModal();
            } else {
                const modal = document.getElementById('jornalModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                }
            }
            
            // Recarregar lista de jornais
            if (typeof loadJornais === 'function') {
                loadJornais();
            }
            
            console.log('✅ ===== JORNAL SALVO COM SUCESSO =====');
        } else {
            console.error('❌ Erro na resposta:', data);
            const errorMessage = data?.error || data?.message || 'Erro ao salvar jornal';
            
            if (response.status === 401) {
                showToast('Sessão expirada. Por favor, faça login novamente.', 'warning');
                currentUser = null;
                if (typeof showLogin === 'function') {
                    showLogin();
                }
            } else {
                showToast(errorMessage, 'error');
            }
        }
    } catch (error) {
        console.error('❌ Erro ao salvar jornal:', error);
        console.error('Tipo do erro:', error.name);
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        
        const errorMessage = error.message || 'Erro ao salvar jornal. Verifique o console para mais detalhes.';
        showToast(errorMessage, 'error');
    } finally {
        // Restaurar botão
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            submitBtn.textContent = 'Salvar';
        }
        
        // Esconder loading
        if (typeof hideLoading === 'function') {
            hideLoading();
        }
        
        console.log('🔵 ===== FIM DO SALVAMENTO =====');
    }
}

// Preview de imagem melhorado
function handleImagePreview(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('capaPreview');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `
                <div style="position: relative; display: inline-block;">
                    <img src="${e.target.result}" alt="Preview" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <div style="margin-top: 8px; font-size: 12px; color: #10b981; font-weight: 600;">
                        ✓ Imagem selecionada: ${file.name}
                    </div>
                </div>
            `;
        };
        reader.onerror = () => {
            preview.innerHTML = '<div style="color: #ef4444;">Erro ao carregar imagem</div>';
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
    }
}

// ==================== CARROSSEL ====================
let carrosselItems = [];

async function loadCarrossel() {
    const listDiv = document.getElementById('carrosselList');
    listDiv.innerHTML = '<div class="loading">Carregando...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/site/carrossel`);
        carrosselItems = await response.json();
        renderCarrossel();
    } catch (error) {
        listDiv.innerHTML = '<div class="error-message">Erro ao carregar carrossel</div>';
        console.error('Erro ao carregar carrossel:', error);
    }
}

function renderCarrossel() {
    const listDiv = document.getElementById('carrosselList');
    
    if (carrosselItems.length === 0) {
        listDiv.innerHTML = '<div class="loading">Nenhum item no carrossel</div>';
        return;
    }
    
    listDiv.innerHTML = carrosselItems.map(item => {
        // Corrigir caminho da imagem se necessário
        let imagemUrl = item.imagem || '';
        
        // Normalizar caminhos relativos que começam com ./
        if (imagemUrl.startsWith('./')) {
            imagemUrl = imagemUrl.substring(2); // Remove ./
        }
        
        // Se a imagem começa com /uploads, manter (arquivos enviados pelo dashboard)
        if (imagemUrl.startsWith('/uploads/')) {
            // Já está correto - arquivo enviado pelo dashboard
        }
        // Se começa com http, manter (URL externa)
        else if (imagemUrl.startsWith('http')) {
            // Já está correto - URL externa
        }
        // Se começa com uploads/ (sem barra inicial), adicionar /
        else if (imagemUrl.startsWith('uploads/')) {
            imagemUrl = '/' + imagemUrl;
        }
        // Se é um caminho da pasta public do site principal (Carrosselpagina1, Imagem, etc)
        // Essas imagens precisam ser acessadas via proxy ou URL completa do site principal
        else if (imagemUrl.includes('Carrosselpagina1') || imagemUrl.includes('Imagem') || imagemUrl.includes('CapadeNoticias')) {
            // Adicionar / no início para tornar absoluto
            if (!imagemUrl.startsWith('/')) {
                imagemUrl = '/' + imagemUrl;
            }
            // Usar URL completa do site principal (porta 3000)
            // Ou usar proxy se configurado
            imagemUrl = `http://localhost:3000${imagemUrl}`;
        }
        // Caso contrário, assumir que está em /uploads/materias/
        else {
            imagemUrl = '/uploads/materias/' + imagemUrl;
        }
        
        return `
        <div class="jornal-card">
            <img src="${imagemUrl}" alt="Carrossel" class="jornal-card-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27200%27 height=%27200%27%3E%3Crect fill=%27%23ecf0f1%27 width=%27200%27 height=%27200%27/%3E%3Ctext fill=%27%23999%27 font-family=%27sans-serif%27 font-size=%2714%27 x=%2750%25%27 y=%2750%25%27 text-anchor=%27middle%27 dy=%27.3em%27%3ESem Imagem%3C/text%3E%3C/svg%3E'; console.error('Erro ao carregar imagem:', '${imagemUrl}');">
            <div class="jornal-card-body">
                <div class="jornal-card-title">Item #${item.id}</div>
                <div class="jornal-card-info">Ordem: ${item.ordem}</div>
                <span class="jornal-card-status ${item.ativo ? 'ativo' : 'inativo'}">
                    ${item.ativo ? 'Ativo' : 'Inativo'}
                </span>
            </div>
            <div class="jornal-card-actions">
                <button class="btn btn-primary btn-small" onclick="editCarrossel(${item.id})">Editar</button>
                <button class="btn btn-danger btn-small" onclick="deleteCarrossel(${item.id})">Excluir</button>
            </div>
        </div>
    `;
    }).join('');
}

function editCarrossel(id) {
    const item = carrosselItems.find(c => c.id === id);
    if (item) {
        if (typeof window.openCarrosselModal === 'function') {
            window.openCarrosselModal(item);
        } else {
            console.error('openCarrosselModal não está disponível!');
            alert('Erro: Função não disponível. Recarregue a página.');
        }
    }
}

async function deleteCarrossel(id) {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/site/carrossel/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        if (data.ok) {
            loadCarrossel();
        } else {
            alert('Erro ao excluir item');
        }
    } catch (error) {
        console.error('Erro ao excluir item:', error);
        alert('Erro ao excluir item');
    }
}

// Variável global para armazenar item de carrossel sendo editado - JÁ DECLARADA NO INÍCIO DO ARQUIVO (linha 255)

// Abrir modal de carrossel
window.openCarrosselModal = function(item = null) {
    console.log('🔵 openCarrosselModal chamada!', item ? 'Editar' : 'Novo');
    
    try {
        editingCarrossel = item;
        const modal = document.getElementById('carrosselModal');
        const form = document.getElementById('carrosselForm');
        const title = document.getElementById('carrosselModalTitle');
        
        if (!modal) {
            console.error('❌ Modal não encontrado!');
            showToast('Erro: Modal não encontrado. Por favor, recarregue a página.', 'error');
            return;
        }
        
        if (!form) {
            console.error('❌ Formulário não encontrado!');
            showToast('Erro: Formulário não encontrado. Por favor, recarregue a página.', 'error');
            return;
        }
        
        form.reset();
        const imagemPreview = document.getElementById('carrosselImagemPreview');
        if (imagemPreview) {
            imagemPreview.innerHTML = '';
        }
        
        if (item) {
            console.log('📝 Editando item:', item);
            if (title) title.textContent = 'Editar Item';
            
            const itemIdInput = document.getElementById('carrosselId');
            if (itemIdInput) itemIdInput.value = item.id || '';
            
            const ordemInput = document.getElementById('carrosselOrdem');
            if (ordemInput) ordemInput.value = item.ordem || '';
            
            const ativoInput = document.getElementById('carrosselAtivo');
            if (ativoInput) ativoInput.value = item.ativo ? 'true' : 'false';
            
            const linkInput = document.getElementById('carrosselLink');
            if (linkInput) linkInput.value = item.link || '';
            
            if (item.imagem && imagemPreview) {
                imagemPreview.innerHTML = `
                    <div style="position: relative; display: inline-block;">
                        <img src="${item.imagem}" alt="Imagem atual" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <div style="margin-top: 8px; font-size: 12px; color: #64748b; font-weight: 500;">
                            📷 Imagem atual (envie uma nova para substituir)
                        </div>
                    </div>
                `;
            }
        } else {
            console.log('✨ Criando novo item');
            if (title) title.textContent = 'Novo Item';
            
            const itemIdInput = document.getElementById('carrosselId');
            if (itemIdInput) itemIdInput.value = '';
        }
        
        console.log('📋 Removendo classe "hidden" do modal...');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        
        console.log('✅ Modal deve estar visível agora!');
        
    } catch (error) {
        console.error('❌ Erro ao abrir modal:', error);
        showToast('Erro ao abrir o formulário. Por favor, recarregue a página.', 'error');
    }
};

// Função closeCarrosselModal já foi definida no início do arquivo (após closeModal)
// Não é necessário redefini-la aqui

// Salvar carrossel
async function handleSaveCarrossel(e) {
    // Prevenir comportamento padrão do formulário
    if (e && e.preventDefault) {
        e.preventDefault();
    }
    
    console.log('🔵 ===== INICIANDO SALVAMENTO DE CARROSSEL =====');
    
    // Encontrar o botão de submit de forma mais robusta
    const form = e?.target || document.getElementById('carrosselForm');
    const submitBtn = form?.querySelector('button[type="submit"]') || 
                     document.querySelector('#carrosselModal button[type="submit"]');
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        submitBtn.textContent = 'Salvando...';
    }
    
    // Mostrar loading
    if (typeof showLoading === 'function') {
        showLoading();
    }
    
    // Verificar autenticação antes de enviar
    try {
        const authCheck = await fetch(`${API_BASE}/auth/check`, {
            credentials: 'include'
        });
        const authData = await authCheck.json();
        
        if (!authData.authenticated) {
            console.error('❌ Sessão expirada!');
            showToast('Sua sessão expirou. Por favor, faça login novamente.', 'warning');
            currentUser = null;
            if (typeof showLogin === 'function') {
                showLogin();
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('loading');
                submitBtn.textContent = 'Salvar';
            }
            if (typeof hideLoading === 'function') {
                hideLoading();
            }
            return;
        }
        console.log('✅ Autenticação verificada');
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
    }
    
    const id = document.getElementById('carrosselId').value;
    
    // Criar FormData
    const formData = new FormData();
    
    // Adicionar campos de texto
    const ordemInput = document.getElementById('carrosselOrdem');
    if (ordemInput && ordemInput.value) {
        formData.append('ordem', ordemInput.value);
    }
    
    const ativoInput = document.getElementById('carrosselAtivo');
    if (ativoInput) {
        formData.append('ativo', ativoInput.value || 'true');
    }
    
    const linkInput = document.getElementById('carrosselLink');
    if (linkInput && linkInput.value) {
        formData.append('link', linkInput.value.trim());
    }
    
    // Adicionar arquivo se existir (apenas se houver arquivo selecionado)
    // IMPORTANTE: O backend espera o campo 'materia', não 'imagem'
    const imagemInput = document.getElementById('carrosselImagem');
    if (imagemInput && imagemInput.files && imagemInput.files.length > 0) {
        formData.append('materia', imagemInput.files[0]); // Backend espera 'materia'
        console.log('Arquivo de imagem adicionado:', imagemInput.files[0].name);
    } else if (!id) {
        // Imagem é obrigatória apenas para novos itens
        showToast('Por favor, selecione uma imagem para o carrossel.', 'error');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            submitBtn.textContent = 'Salvar';
        }
        if (typeof hideLoading === 'function') {
            hideLoading();
        }
        return;
    }
    
    console.log('Enviando item do carrossel...', { 
        id, 
        hasFile: imagemInput?.files.length > 0,
        ordem: formData.get('ordem')
    });
    
    try {
        const url = id 
            ? `${API_BASE}/site/carrossel/${id}`
            : `${API_BASE}/site/carrossel`;
        
        const response = await fetch(url, {
            method: id ? 'PUT' : 'POST',
            credentials: 'include',
            body: formData
        });
        
        // Verificar se a resposta é JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Resposta não é JSON:', text.substring(0, 200));
            throw new Error('Resposta inválida do servidor');
        }
        
        const data = await response.json();
        
        console.log('📥 Resposta recebida:', {
            status: response.status,
            ok: response.ok,
            dataOk: data.ok,
            data: data
        });
        
        if (response.ok && data.ok) {
            console.log('✅ Item do carrossel salvo com sucesso!');
            
            // Mostrar toast de sucesso
            showToast('Item do carrossel salvo com sucesso!', 'success');
            
            // Aguardar um pouco para o usuário ver a mensagem
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Fechar modal
            if (typeof window.closeCarrosselModal === 'function') {
                window.closeCarrosselModal();
            } else {
                const modal = document.getElementById('carrosselModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                }
            }
            
            // Recarregar lista de carrossel
            if (typeof loadCarrossel === 'function') {
                loadCarrossel();
            }
            
            console.log('✅ ===== ITEM DO CARROSSEL SALVO COM SUCESSO =====');
        } else {
            console.error('❌ Erro na resposta:', data);
            const errorMessage = data?.error || data?.message || 'Erro ao salvar item do carrossel';
            
            if (response.status === 401) {
                showToast('Sessão expirada. Por favor, faça login novamente.', 'warning');
                currentUser = null;
                if (typeof showLogin === 'function') {
                    showLogin();
                }
            } else {
                showToast(errorMessage, 'error');
            }
        }
    } catch (error) {
        console.error('❌ Erro ao salvar item do carrossel:', error);
        console.error('Tipo do erro:', error.name);
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        
        const errorMessage = error.message || 'Erro ao salvar item do carrossel. Verifique o console para mais detalhes.';
        showToast(errorMessage, 'error');
    } finally {
        // Restaurar botão
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            submitBtn.textContent = 'Salvar';
        }
        
        // Esconder loading
        if (typeof hideLoading === 'function') {
            hideLoading();
        }
        
        console.log('🔵 ===== FIM DO SALVAMENTO =====');
    }
}

// Event listener para novo carrossel
document.addEventListener('DOMContentLoaded', () => {
    const newCarrosselBtn = document.getElementById('newCarrosselBtn');
    if (newCarrosselBtn) {
        // Já temos o onclick inline, mas adicionar listener também como backup
        newCarrosselBtn.addEventListener('click', () => {
            if (typeof window.openCarrosselModal === 'function') {
                window.openCarrosselModal();
            } else {
                console.error('openCarrosselModal não está disponível!');
                alert('Erro: Função não disponível. Recarregue a página.');
            }
        });
    }
    
    // Event listeners do modal de carrossel - garantir que os event listeners sejam anexados
    const closeCarrosselModalBtn = document.getElementById('closeCarrosselModal');
    if (closeCarrosselModalBtn) {
        // Adicionar múltiplos listeners para garantir que funcione
        closeCarrosselModalBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔴 Botão X do carrossel clicado!');
            if (typeof window.closeCarrosselModal === 'function') {
                window.closeCarrosselModal();
            } else if (typeof closeCarrosselModal === 'function') {
                closeCarrosselModal();
            } else {
                const modal = document.getElementById('carrosselModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                    modal.setAttribute('style', 'display: none !important;');
                }
            }
        });
        console.log('✅ Listener do botão X do carrossel adicionado');
    } else {
        console.error('❌ Botão closeCarrosselModal não encontrado!');
    }
    
    const cancelCarrosselBtn = document.getElementById('cancelCarrosselBtn');
    if (cancelCarrosselBtn) {
        // Adicionar múltiplos listeners para garantir que funcione
        cancelCarrosselBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔴 Botão Cancelar do carrossel clicado!');
            if (typeof window.closeCarrosselModal === 'function') {
                window.closeCarrosselModal();
            } else if (typeof closeCarrosselModal === 'function') {
                closeCarrosselModal();
            } else {
                const modal = document.getElementById('carrosselModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                    modal.setAttribute('style', 'display: none !important;');
                }
            }
        });
        console.log('✅ Listener do botão Cancelar do carrossel adicionado');
    } else {
        console.error('❌ Botão cancelCarrosselBtn não encontrado!');
    }
    
    const carrosselForm = document.getElementById('carrosselForm');
    if (carrosselForm) {
        carrosselForm.addEventListener('submit', handleSaveCarrossel);
    }
    
    // Preview de imagem do carrossel
    const carrosselImagemInput = document.getElementById('carrosselImagem');
    if (carrosselImagemInput) {
        carrosselImagemInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const preview = document.getElementById('carrosselImagemPreview');
            
            if (file && preview) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.innerHTML = `
                        <div style="position: relative; display: inline-block;">
                            <img src="${e.target.result}" alt="Preview" style="max-width: 300px; max-height: 300px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); object-fit: cover;">
                            <div style="margin-top: 8px; font-size: 12px; color: #10b981; font-weight: 600;">
                                ✓ Imagem selecionada: ${file.name}
                            </div>
                        </div>
                    `;
                };
                reader.onerror = () => {
                    preview.innerHTML = '<div style="color: #ef4444;">Erro ao carregar imagem</div>';
                };
                reader.readAsDataURL(file);
            } else if (preview) {
                preview.innerHTML = '';
            }
        });
    }
    
    // Fechar modal ao clicar fora (mas não no conteúdo)
    const carrosselModal = document.getElementById('carrosselModal');
    if (carrosselModal) {
        carrosselModal.addEventListener('click', function(e) {
            // Só fechar se clicar exatamente no modal (background), não no conteúdo
            if (e.target === carrosselModal || e.target.id === 'carrosselModal') {
                console.log('🔴 Clique no background do modal de carrossel, fechando...');
                if (typeof window.closeCarrosselModal === 'function') {
                    window.closeCarrosselModal();
                } else if (typeof closeCarrosselModal === 'function') {
                    closeCarrosselModal();
                } else {
                    carrosselModal.classList.add('hidden');
                    carrosselModal.style.display = 'none';
                    carrosselModal.setAttribute('style', 'display: none !important;');
                }
            }
        });
        console.log('✅ Listener para fechar modal de carrossel ao clicar fora adicionado');
    }
    
    // Prevenir que cliques no modal-content fechem o modal
    const carrosselModalContent = document.querySelector('#carrosselModal .modal-content');
    if (carrosselModalContent) {
        carrosselModalContent.addEventListener('click', function(e) {
            // Parar propagação para que cliques no conteúdo não fechem o modal
            e.stopPropagation();
        });
        console.log('✅ Listener para prevenir fechamento ao clicar no conteúdo do carrossel adicionado');
    }
});

// ==================== CARROSSEL MÉDIO ====================
let carrosselMedioItems = [];
let editingCarrosselMedio = null;

async function loadCarrosselMedio() {
    const listDiv = document.getElementById('carrosselMedioList');
    if (!listDiv) return;
    listDiv.innerHTML = '<div class="loading">Carregando...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/site/carrossel-medio`);
        carrosselMedioItems = await response.json();
        renderCarrosselMedio();
    } catch (error) {
        listDiv.innerHTML = '<div class="error-message">Erro ao carregar carrossel médio</div>';
        console.error('Erro ao carregar carrossel médio:', error);
    }
}

function renderCarrosselMedio() {
    const listDiv = document.getElementById('carrosselMedioList');
    if (!listDiv) return;
    
    if (carrosselMedioItems.length === 0) {
        listDiv.innerHTML = '<div class="loading">Nenhum item no carrossel médio</div>';
        return;
    }
    
    listDiv.innerHTML = carrosselMedioItems.map(item => {
        let imagemUrl = item.imagem || '';
        
        if (imagemUrl.startsWith('./')) {
            imagemUrl = imagemUrl.substring(2);
        }
        
        if (imagemUrl.startsWith('/uploads/')) {
            imagemUrl = `http://localhost:3000${imagemUrl}`;
        } else if (imagemUrl.startsWith('http')) {
            // URL externa
        } else if (imagemUrl.startsWith('uploads/')) {
            imagemUrl = `http://localhost:3000/${imagemUrl}`;
        } else {
            imagemUrl = `http://localhost:3000/uploads/materias/${imagemUrl}`;
        }
        
        return `
        <div class="jornal-card">
            <img src="${imagemUrl}" alt="Carrossel Médio" class="jornal-card-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27200%27 height=%27200%27%3E%3Crect fill=%27%23ecf0f1%27 width=%27200%27 height=%27200%27/%3E%3Ctext fill=%27%23999%27 font-family=%27sans-serif%27 font-size=%2714%27 x=%2750%25%27 y=%2750%25%27 text-anchor=%27middle%27 dy=%27.3em%27%3ESem Imagem%3C/text%3E%3C/svg%3E';">
            <div class="jornal-card-body">
                <div class="jornal-card-title">Item #${item.id}</div>
                <div class="jornal-card-info">Ordem: ${item.ordem}</div>
                <span class="jornal-card-status ${item.ativo ? 'ativo' : 'inativo'}">
                    ${item.ativo ? 'Ativo' : 'Inativo'}
                </span>
            </div>
            <div class="jornal-card-actions">
                <button class="btn btn-primary btn-small" onclick="editCarrosselMedio(${item.id})">Editar</button>
                <button class="btn btn-danger btn-small" onclick="deleteCarrosselMedio(${item.id})">Excluir</button>
            </div>
        </div>
    `;
    }).join('');
}

function editCarrosselMedio(id) {
    const item = carrosselMedioItems.find(c => c.id === id);
    if (item && typeof window.openCarrosselMedioModal === 'function') {
        window.openCarrosselMedioModal(item);
    }
}

async function deleteCarrosselMedio(id) {
    if (!confirm('Tem certeza que deseja excluir este item do carrossel médio?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/site/carrossel-medio/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        if (data.ok) {
            showToast('Item excluído com sucesso!', 'success');
            loadCarrosselMedio();
        } else {
            showToast('Erro ao excluir item', 'error');
        }
    } catch (error) {
        console.error('Erro ao excluir item:', error);
        showToast('Erro ao excluir item', 'error');
    }
}

window.openCarrosselMedioModal = function(item = null) {
    editingCarrosselMedio = item;
    const modal = document.getElementById('carrosselMedioModal');
    const form = document.getElementById('carrosselMedioForm');
    const title = document.getElementById('carrosselMedioModalTitle');
    
    if (!modal || !form) return;
    
    form.reset();
    const imagemPreview = document.getElementById('carrosselMedioImagemPreview');
    if (imagemPreview) imagemPreview.innerHTML = '';
    
    if (item) {
        title.textContent = 'Editar Item';
        document.getElementById('carrosselMedioId').value = item.id;
        document.getElementById('carrosselMedioOrdem').value = item.ordem || '';
        document.getElementById('carrosselMedioAtivo').value = item.ativo ? 'true' : 'false';
        
        if (item.imagem && imagemPreview) {
            let imgUrl = item.imagem.startsWith('/uploads/') 
                ? `http://localhost:3000${item.imagem}` 
                : item.imagem;
            imagemPreview.innerHTML = `<img src="${imgUrl}" alt="Preview" style="max-width: 200px; margin-top: 10px; border-radius: 8px;">`;
        }
    } else {
        title.textContent = 'Novo Item';
        document.getElementById('carrosselMedioId').value = '';
    }
    
    modal.classList.remove('hidden');
    modal.style.display = 'block';
};

window.closeCarrosselMedioModal = function() {
    const modal = document.getElementById('carrosselMedioModal');
    const form = document.getElementById('carrosselMedioForm');
    const imagemPreview = document.getElementById('carrosselMedioImagemPreview');
    
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    
    editingCarrosselMedio = null;
    if (form) form.reset();
    if (imagemPreview) imagemPreview.innerHTML = '';
};

window.handleSaveCarrosselMedio = async function(e) {
    if (e) e.preventDefault();
    
    const form = document.getElementById('carrosselMedioForm');
    if (!form) {
        console.error('Formulário não encontrado!');
        showToast('Erro: Formulário não encontrado', 'error');
        return;
    }
    
    const formData = new FormData(form);
    const id = document.getElementById('carrosselMedioId').value;
    const imagemInput = document.getElementById('carrosselMedioImagem');
    
    // Validar se há imagem (obrigatória para novo item)
    if (!id && (!imagemInput || !imagemInput.files || !imagemInput.files[0])) {
        showToast('Por favor, selecione uma imagem', 'error');
        return;
    }
    
    try {
        const url = id 
            ? `${API_BASE}/site/carrossel-medio/${id}`
            : `${API_BASE}/site/carrossel-medio`;
        
        console.log('Enviando requisição para:', url);
        console.log('ID:', id || 'novo');
        console.log('Tem arquivo:', imagemInput && imagemInput.files && imagemInput.files[0] ? 'sim' : 'não');
        
        const response = await fetch(url, {
            method: id ? 'PUT' : 'POST',
            credentials: 'include',
            body: formData
        });
        
        console.log('Resposta recebida. Status:', response.status);
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Resposta não é JSON:', text.substring(0, 200));
            throw new Error('Resposta inválida do servidor: ' + text.substring(0, 100));
        }
        
        const data = await response.json();
        console.log('Dados recebidos:', data);
        
        if (response.ok && data.ok) {
            showToast('Item do carrossel médio salvo com sucesso!', 'success');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (typeof window.closeCarrosselMedioModal === 'function') {
                window.closeCarrosselMedioModal();
            }
            
            if (typeof loadCarrosselMedio === 'function') {
                loadCarrosselMedio();
            }
        } else {
            const errorMsg = data.error || data.message || 'Erro ao salvar item';
            console.error('Erro na resposta:', errorMsg);
            showToast(errorMsg, 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar item do carrossel médio:', error);
        console.error('Tipo do erro:', error.name);
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        
        const errorMessage = error.message || 'Erro ao salvar item do carrossel médio. Verifique o console para mais detalhes.';
        showToast(errorMessage, 'error');
    }
};

// Preview de imagem do carrossel médio
document.addEventListener('DOMContentLoaded', () => {
    const carrosselMedioImagemInput = document.getElementById('carrosselMedioImagem');
    if (carrosselMedioImagemInput) {
        carrosselMedioImagemInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            const preview = document.getElementById('carrosselMedioImagemPreview');
            
            if (file && preview) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-width: 200px; margin-top: 10px; border-radius: 8px;">`;
                };
                reader.readAsDataURL(file);
            } else if (preview) {
                preview.innerHTML = '';
            }
        });
    }
});

// ==================== PAGAMENTOS ====================
let pagamentos = [];

async function loadPagamentos() {
    const listDiv = document.getElementById('pagamentosList');
    if (!listDiv) return;
    
    listDiv.innerHTML = '<div class="loading">Carregando pagamentos...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/pagamentos`);
        if (!response.ok) {
            throw new Error('Erro ao buscar pagamentos');
        }
        pagamentos = await response.json();
        renderPagamentos();
    } catch (error) {
        listDiv.innerHTML = '<div class="error-message">Erro ao carregar pagamentos</div>';
        console.error('Erro ao carregar pagamentos:', error);
    }
}

function renderPagamentos() {
    const listDiv = document.getElementById('pagamentosList');
    if (!listDiv) return;
    
    if (pagamentos.length === 0) {
        listDiv.innerHTML = '<div class="loading">Nenhum pagamento registrado</div>';
        return;
    }
    
    // Ordenar por data (mais recente primeiro)
    const pagamentosOrdenados = [...pagamentos].sort((a, b) => {
        const dataA = new Date(a.dataPagamento || a.dataCriacao);
        const dataB = new Date(b.dataPagamento || b.dataCriacao);
        return dataB - dataA;
    });
    
    // Contar pagamentos com valor 0
    const pagamentosComValorZero = pagamentos.filter(p => !p.valor || p.valor === 0).length;
    
    listDiv.innerHTML = `
        <div style="margin-bottom: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <h3 style="margin: 0 0 10px 0; color: #00095b;">Total de Pagamentos: ${pagamentos.length}</h3>
            ${pagamentosComValorZero > 0 ? `<p style="margin: 5px 0; color: #d97706; font-weight: 600;">⚠️ ${pagamentosComValorZero} pagamento(s) com valor R$ 0,00 - Use o botão "Atualizar Valores" para corrigir</p>` : ''}
            <p style="margin: 0; color: #666;">Última atualização: ${new Date().toLocaleString('pt-BR')}</p>
        </div>
        <div class="jornais-grid">
            ${pagamentosOrdenados.map(pagamento => {
                const data = new Date(pagamento.dataPagamento || pagamento.dataCriacao);
                const dataFormatada = data.toLocaleDateString('pt-BR', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                // Garantir que o valor seja um número válido
                const valorNumerico = pagamento.valor ? parseFloat(pagamento.valor) : 0;
                const valorFormatado = new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: pagamento.moeda || 'BRL'
                }).format(valorNumerico);
                
                return `
                    <div class="jornal-card">
                        <div style="padding: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                                <div>
                                    <h3 style="margin: 0 0 8px 0; color: #00095b; font-size: 1.2rem;">${pagamento.nome || 'Nome não informado'}</h3>
                                    <p style="margin: 0; color: #666; font-size: 0.9rem;">${pagamento.email || 'Email não informado'}</p>
                                </div>
                                <div style="text-align: right;">
                                    <div style="font-size: 1.3rem; font-weight: 700; color: #10b981; margin-bottom: 5px;">${valorFormatado}</div>
                                    <div style="font-size: 0.85rem; color: #999;">${pagamento.moeda || 'BRL'}</div>
                                </div>
                            </div>
                            
                            <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; margin-top: 15px;">
                                <div style="margin-bottom: 10px;">
                                    <strong style="color: #555; font-size: 0.9rem;">Jornal:</strong>
                                    <div style="color: #00095b; font-weight: 600; margin-top: 3px;">${pagamento.jornalNome || `ID: ${pagamento.jornalId}`}</div>
                                </div>
                                
                                <div style="margin-bottom: 10px;">
                                    <strong style="color: #555; font-size: 0.9rem;">Data do Pagamento:</strong>
                                    <div style="color: #666; margin-top: 3px;">${dataFormatada}</div>
                                </div>
                                
                                <div style="margin-bottom: 10px;">
                                    <strong style="color: #555; font-size: 0.9rem;">Payment Intent ID:</strong>
                                    <div style="color: #666; font-family: monospace; font-size: 0.85rem; margin-top: 3px; word-break: break-all;">${pagamento.paymentIntentId}</div>
                                </div>
                            </div>
                            
                            <div style="border-top: 1px solid #e5e7eb; padding-top: 15px; margin-top: 15px; display: flex; justify-content: flex-end;">
                                <button onclick="deletePagamento(${pagamento.id}, '${(pagamento.nome || 'Cliente').replace(/'/g, "\\'")}')" 
                                        class="btn-delete-pagamento">
                                    <i class='bx bx-trash'></i>
                                    Excluir Comprovante
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Função para deletar pagamento
window.deletePagamento = async function(id, nome) {
    if (!confirm(`Tem certeza que deseja excluir o comprovante de pagamento de ${nome}?\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/pagamentos/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (response.ok) {
            showToast('Comprovante excluído com sucesso!', 'success');
            // Recarregar lista de pagamentos
            loadPagamentos();
        } else {
            const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
            showToast(error.error || 'Erro ao excluir comprovante', 'error');
        }
    } catch (error) {
        console.error('Erro ao deletar pagamento:', error);
        showToast('Erro ao excluir comprovante: ' + error.message, 'error');
    }
};

// Função para atualizar valores dos pagamentos
window.updatePaymentValues = async function() {
    if (!confirm('Isso irá atualizar os valores dos pagamentos que estão com R$ 0,00 buscando os valores corretos do Stripe. Deseja continuar?')) {
        return;
    }
    
    const btn = document.getElementById('updatePaymentValuesBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Atualizando...';
    }
    
    try {
        const response = await fetch(`${API_BASE}/pagamentos/atualizar-valores`, {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            const result = await response.json();
            showToast(result.message || 'Valores atualizados com sucesso!', 'success');
            // Recarregar lista de pagamentos
            loadPagamentos();
        } else {
            const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
            showToast(error.error || 'Erro ao atualizar valores', 'error');
        }
    } catch (error) {
        console.error('Erro ao atualizar valores:', error);
        showToast('Erro ao atualizar valores: ' + error.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '🔄 Atualizar Valores dos Pagamentos';
        }
    }
};

// ==================== VÍDEO ====================
async function loadVideo() {
    const configDiv = document.getElementById('videoConfig');
    configDiv.innerHTML = '<div class="loading">Carregando...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/site/video`);
        const video = await response.json();
        
        // Mostrar URL atual se existir
        const videoUrlDisplay = video.url ? `<p style="margin-top: 8px; color: #666; font-size: 13px;">Vídeo atual: <a href="${video.url}" target="_blank">${video.url}</a></p>` : '';
        
        configDiv.innerHTML = `
            <form id="videoForm" enctype="multipart/form-data">
                <div class="form-group">
                    <label for="videoFile">Vídeo</label>
                    <input type="file" id="videoFile" name="video" accept="video/*">
                    <small class="form-help">Formatos aceitos: MP4, WebM, OGG, MOV, AVI, WMV, FLV (máximo 500MB)</small>
                    ${videoUrlDisplay}
                    <div id="videoFilePreview" class="video-preview" style="margin-top: 12px; display: none;">
                        <video controls style="max-width: 100%; max-height: 300px; border-radius: 8px;">
                            <source id="videoPreviewSource" src="" type="video/mp4">
                            Seu navegador não suporta a reprodução de vídeos.
                        </video>
                    </div>
                </div>
                <div class="form-group">
                    <label for="videoTitulo">Título</label>
                    <input type="text" id="videoTitulo" name="titulo" value="${video.titulo || ''}">
                </div>
                <div class="form-group">
                    <label for="videoSubtitulo">Subtítulo</label>
                    <input type="text" id="videoSubtitulo" name="subtitulo" value="${video.subtitulo || ''}">
                </div>
                <div class="form-group">
                    <label for="videoAtivo">Ativo</label>
                    <select id="videoAtivo" name="ativo">
                        <option value="true" ${video.ativo ? 'selected' : ''}>Sim</option>
                        <option value="false" ${!video.ativo ? 'selected' : ''}>Não</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary">Salvar</button>
            </form>
        `;
        
        // Preview do vídeo ao selecionar arquivo
        const videoFileInput = document.getElementById('videoFile');
        const videoPreview = document.getElementById('videoFilePreview');
        const videoPreviewSource = document.getElementById('videoPreviewSource');
        
        videoFileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                videoPreviewSource.src = url;
                videoPreview.style.display = 'block';
                
                // Atualizar tipo do vídeo baseado na extensão
                const ext = file.name.split('.').pop().toLowerCase();
                const mimeTypes = {
                    'mp4': 'video/mp4',
                    'webm': 'video/webm',
                    'ogg': 'video/ogg',
                    'mov': 'video/quicktime',
                    'avi': 'video/x-msvideo',
                    'wmv': 'video/x-ms-wmv',
                    'flv': 'video/x-flv'
                };
                videoPreviewSource.type = mimeTypes[ext] || 'video/mp4';
            } else {
                videoPreview.style.display = 'none';
            }
        });
        
        document.getElementById('videoForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('🔵 Iniciando upload de vídeo...');
            
            // Criar FormData manualmente para evitar duplicação
            const formData = new FormData();
            
            // Adicionar arquivo de vídeo se existir
            const videoFile = document.getElementById('videoFile').files[0];
            if (videoFile) {
                formData.append('video', videoFile);
                console.log('📁 Arquivo selecionado:', videoFile.name, 'Tamanho:', videoFile.size, 'bytes');
            }
            
            // Adicionar campos de texto
            const titulo = document.getElementById('videoTitulo').value;
            const subtitulo = document.getElementById('videoSubtitulo').value;
            const ativo = document.getElementById('videoAtivo').value;
            
            if (!videoFile) {
                console.log('ℹ️ Nenhum arquivo selecionado - atualizando apenas texto');
            }
            
            try {
                const response = await fetch(`${API_BASE}/site/video`, {
                    method: 'PUT',
                    credentials: 'include',
                    body: formData // Não definir Content-Type, o browser fará isso automaticamente com FormData
                });
                
                // Verificar se a resposta é OK antes de tentar parsear JSON
                if (!response.ok) {
                    let errorMessage = 'Erro ao salvar vídeo';
                    try {
                        const errorData = await response.json();
                        errorMessage = errorData.error || errorData.message || errorMessage;
                    } catch (e) {
                        errorMessage = `Erro HTTP ${response.status}: ${response.statusText}`;
                    }
                    alert('Erro ao salvar vídeo: ' + errorMessage);
                    console.error('Erro na resposta:', response.status, response.statusText);
                    return;
                }
                
                const result = await response.json();
                if (result.ok) {
                    alert('Vídeo salvo com sucesso!');
                    loadVideo();
                } else {
                    alert('Erro ao salvar vídeo: ' + (result.error || 'Erro desconhecido'));
                }
            } catch (error) {
                console.error('Erro ao salvar vídeo:', error);
                alert('Erro ao salvar vídeo: ' + error.message);
            }
        });
    } catch (error) {
        configDiv.innerHTML = '<div class="error-message">Erro ao carregar vídeo</div>';
        console.error('Erro ao carregar vídeo:', error);
    }
}

// ==================== RESPONSÁVEIS ====================
let responsaveis = [];

async function loadResponsaveis() {
    const listDiv = document.getElementById('responsaveisList');
    listDiv.innerHTML = '<div class="loading">Carregando...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/site/responsaveis`);
        responsaveis = await response.json();
        renderResponsaveis();
    } catch (error) {
        listDiv.innerHTML = '<div class="error-message">Erro ao carregar responsáveis</div>';
        console.error('Erro ao carregar responsáveis:', error);
    }
}

function renderResponsaveis() {
    const listDiv = document.getElementById('responsaveisList');
    
    if (responsaveis.length === 0) {
        listDiv.innerHTML = '<div class="loading">Nenhum responsável cadastrado</div>';
        return;
    }
    
    listDiv.innerHTML = responsaveis.map(resp => {
        // Normalizar caminho da imagem
        let imagemUrl = resp.imagem || '';
        
        // Normalizar caminhos relativos que começam com ./
        if (imagemUrl.startsWith('./')) {
            imagemUrl = imagemUrl.substring(2); // Remove ./
        }
        
        // Se a imagem começa com /uploads, manter (arquivo enviado pelo dashboard)
        if (imagemUrl.startsWith('/uploads/')) {
            // Já está correto - arquivo enviado pelo dashboard
        }
        // Se começa com http, manter (URL externa)
        else if (imagemUrl.startsWith('http')) {
            // Já está correto - URL externa
        }
        // Se começa com uploads/ (sem barra inicial), adicionar /
        else if (imagemUrl.startsWith('uploads/')) {
            imagemUrl = '/' + imagemUrl;
        }
        // Se é um caminho da pasta public do site principal (Imagem, Carrosselpagina1, etc)
        else if (imagemUrl.includes('Imagem') || imagemUrl.includes('Carrosselpagina1') || imagemUrl.includes('CapadeNoticias')) {
            // Adicionar / no início para tornar absoluto
            if (!imagemUrl.startsWith('/')) {
                imagemUrl = '/' + imagemUrl;
            }
            // Usar URL completa do site principal (porta 3000)
            imagemUrl = `http://localhost:3000${imagemUrl}`;
        }
        // Caso contrário, assumir que está em /uploads/materias/
        else {
            imagemUrl = '/uploads/materias/' + imagemUrl;
        }
        
        return `
        <div class="jornal-card">
            <img src="${imagemUrl}" alt="${resp.nome}" class="jornal-card-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27200%27 height=%27200%27%3E%3Crect fill=%27%23ecf0f1%27 width=%27200%27 height=%27200%27/%3E%3Ctext fill=%27%23999%27 font-family=%27sans-serif%27 font-size=%2714%27 x=%2750%25%27 y=%2750%25%27 text-anchor=%27middle%27 dy=%27.3em%27%3ESem Foto%3C/text%3E%3C/svg%3E'; console.error('Erro ao carregar imagem do responsável:', '${imagemUrl}');">
            <div class="jornal-card-body">
                <div class="jornal-card-title">${resp.nome}</div>
                <div class="jornal-card-info">Cargo: ${resp.cargo}</div>
                <div class="jornal-card-info">Ordem: ${resp.ordem}</div>
                <span class="jornal-card-status ${resp.ativo ? 'ativo' : 'inativo'}">
                    ${resp.ativo ? 'Ativo' : 'Inativo'}
                </span>
            </div>
            <div class="jornal-card-actions">
                <button class="btn btn-primary btn-small" onclick="editResponsavel(${resp.id})">Editar</button>
                <button class="btn btn-danger btn-small" onclick="deleteResponsavel(${resp.id})">Excluir</button>
            </div>
        </div>
    `;
    }).join('');
}

function editResponsavel(id) {
    const responsavel = responsaveis.find(r => r.id === id);
    if (responsavel) {
        if (typeof window.openResponsavelModal === 'function') {
            window.openResponsavelModal(responsavel);
        } else {
            console.error('openResponsavelModal não está disponível!');
            alert('Erro: Função não disponível. Recarregue a página.');
        }
    }
}

// Variável global para armazenar responsável sendo editado - JÁ DECLARADA NO INÍCIO DO ARQUIVO (linha 256)

// Abrir modal de responsável
window.openResponsavelModal = function(responsavel = null) {
    console.log('🔵 openResponsavelModal chamada!', responsavel ? 'Editar' : 'Novo');
    
    try {
        editingResponsavel = responsavel;
        const modal = document.getElementById('responsavelModal');
        const form = document.getElementById('responsavelForm');
        const title = document.getElementById('responsavelModalTitle');
        
        if (!modal) {
            console.error('❌ Modal não encontrado!');
            showToast('Erro: Modal não encontrado. Por favor, recarregue a página.', 'error');
            return;
        }
        
        if (!form) {
            console.error('❌ Formulário não encontrado!');
            showToast('Erro: Formulário não encontrado. Por favor, recarregue a página.', 'error');
            return;
        }
        
        form.reset();
        const imagemPreview = document.getElementById('responsavelImagemPreview');
        if (imagemPreview) {
            imagemPreview.innerHTML = '';
        }
        
        if (responsavel) {
            console.log('📝 Editando responsável:', responsavel);
            if (title) title.textContent = 'Editar Responsável';
            
            const responsavelIdInput = document.getElementById('responsavelId');
            if (responsavelIdInput) responsavelIdInput.value = responsavel.id || '';
            
            const nomeInput = document.getElementById('responsavelNome');
            if (nomeInput) nomeInput.value = responsavel.nome || '';
            
            const cargoInput = document.getElementById('responsavelCargo');
            if (cargoInput) cargoInput.value = responsavel.cargo || '';
            
            const ordemInput = document.getElementById('responsavelOrdem');
            if (ordemInput) ordemInput.value = responsavel.ordem || '';
            
            const ativoInput = document.getElementById('responsavelAtivo');
            if (ativoInput) ativoInput.value = responsavel.ativo ? 'true' : 'false';
            
            if (responsavel.imagem && imagemPreview) {
                imagemPreview.innerHTML = `
                    <div style="position: relative; display: inline-block;">
                        <img src="${responsavel.imagem}" alt="Foto atual" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <div style="margin-top: 8px; font-size: 12px; color: #64748b; font-weight: 500;">
                            📷 Foto atual (envie uma nova para substituir)
                        </div>
                    </div>
                `;
            }
        } else {
            console.log('✨ Criando novo responsável');
            if (title) title.textContent = 'Novo Responsável';
            
            const responsavelIdInput = document.getElementById('responsavelId');
            if (responsavelIdInput) responsavelIdInput.value = '';
        }
        
        console.log('📋 Removendo classe "hidden" do modal...');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        
        console.log('✅ Modal deve estar visível agora!');
        
    } catch (error) {
        console.error('❌ Erro ao abrir modal:', error);
        showToast('Erro ao abrir o formulário. Por favor, recarregue a página.', 'error');
    }
};

// Função closeResponsavelModal já foi definida no início do arquivo (após closeCarrosselModal)
// Não é necessário redefini-la aqui

// Salvar responsável
async function handleSaveResponsavel(e) {
    // Prevenir comportamento padrão do formulário
    if (e && e.preventDefault) {
        e.preventDefault();
    }
    
    console.log('🔵 ===== INICIANDO SALVAMENTO DE RESPONSÁVEL =====');
    
    // Encontrar o botão de submit de forma mais robusta
    const form = e?.target || document.getElementById('responsavelForm');
    const submitBtn = form?.querySelector('button[type="submit"]') || 
                     document.querySelector('#responsavelModal button[type="submit"]');
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        submitBtn.textContent = 'Salvando...';
    }
    
    // Mostrar loading
    if (typeof showLoading === 'function') {
        showLoading();
    }
    
    // Verificar autenticação antes de enviar
    try {
        const authCheck = await fetch(`${API_BASE}/auth/check`, {
            credentials: 'include'
        });
        const authData = await authCheck.json();
        
        if (!authData.authenticated) {
            console.error('❌ Sessão expirada!');
            showToast('Sua sessão expirou. Por favor, faça login novamente.', 'warning');
            currentUser = null;
            if (typeof showLogin === 'function') {
                showLogin();
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('loading');
                submitBtn.textContent = 'Salvar';
            }
            if (typeof hideLoading === 'function') {
                hideLoading();
            }
            return;
        }
        console.log('✅ Autenticação verificada');
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
    }
    
    const id = document.getElementById('responsavelId').value;
    const nome = document.getElementById('responsavelNome').value.trim();
    const cargo = document.getElementById('responsavelCargo').value.trim();
    
    // Validar campos obrigatórios
    if (!nome || !cargo) {
        showToast('Por favor, preencha nome e cargo.', 'error');
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        return;
    }
    
    // Criar FormData
    const formData = new FormData();
    formData.append('nome', nome);
    formData.append('cargo', cargo);
    
    const ordemInput = document.getElementById('responsavelOrdem');
    if (ordemInput && ordemInput.value) {
        formData.append('ordem', ordemInput.value);
    }
    
    const ativoInput = document.getElementById('responsavelAtivo');
    if (ativoInput) {
        formData.append('ativo', ativoInput.value || 'true');
    }
    
    // Adicionar arquivo se existir (apenas se houver arquivo selecionado)
    // IMPORTANTE: O backend espera o campo 'materia', não 'imagem'
    const imagemInput = document.getElementById('responsavelImagem');
    if (imagemInput && imagemInput.files && imagemInput.files.length > 0) {
        formData.append('materia', imagemInput.files[0]); // Backend espera 'materia'
        console.log('Arquivo de imagem adicionado:', imagemInput.files[0].name);
    }
    
    console.log('Enviando responsável...', { 
        id, 
        nome,
        cargo,
        hasFile: imagemInput?.files.length > 0,
        ordem: formData.get('ordem')
    });
    
    try {
        const url = id 
            ? `${API_BASE}/site/responsaveis/${id}`
            : `${API_BASE}/site/responsaveis`;
        
        const response = await fetch(url, {
            method: id ? 'PUT' : 'POST',
            credentials: 'include',
            body: formData
        });
        
        // Verificar se a resposta é JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Resposta não é JSON:', text.substring(0, 200));
            throw new Error('Resposta inválida do servidor');
        }
        
        const data = await response.json();
        
        console.log('📥 Resposta recebida:', {
            status: response.status,
            ok: response.ok,
            dataOk: data.ok,
            data: data
        });
        
        if (response.ok && data.ok) {
            console.log('✅ Responsável salvo com sucesso!');
            
            // Mostrar toast de sucesso
            showToast('Responsável salvo com sucesso!', 'success');
            
            // Aguardar um pouco para o usuário ver a mensagem
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Fechar modal
            if (typeof window.closeResponsavelModal === 'function') {
                window.closeResponsavelModal();
            } else {
                const modal = document.getElementById('responsavelModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                }
            }
            
            // Recarregar lista de responsáveis
            if (typeof loadResponsaveis === 'function') {
                loadResponsaveis();
            }
            
            console.log('✅ ===== RESPONSÁVEL SALVO COM SUCESSO =====');
        } else {
            console.error('❌ Erro na resposta:', data);
            const errorMessage = data?.error || data?.message || 'Erro ao salvar responsável';
            
            if (response.status === 401) {
                showToast('Sessão expirada. Por favor, faça login novamente.', 'warning');
                currentUser = null;
                if (typeof showLogin === 'function') {
                    showLogin();
                }
            } else {
                showToast(errorMessage, 'error');
            }
        }
    } catch (error) {
        console.error('❌ Erro ao salvar responsável:', error);
        console.error('Tipo do erro:', error.name);
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        
        const errorMessage = error.message || 'Erro ao salvar responsável. Verifique o console para mais detalhes.';
        showToast(errorMessage, 'error');
    } finally {
        // Restaurar botão
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            submitBtn.textContent = 'Salvar';
        }
        
        // Esconder loading
        if (typeof hideLoading === 'function') {
            hideLoading();
        }
        
        console.log('🔵 ===== FIM DO SALVAMENTO =====');
    }
}

async function deleteResponsavel(id) {
    if (!confirm('Tem certeza que deseja excluir este responsável?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/site/responsaveis/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        if (data.ok) {
            loadResponsaveis();
        } else {
            alert('Erro ao excluir responsável');
        }
    } catch (error) {
        console.error('Erro ao excluir responsável:', error);
        alert('Erro ao excluir responsável');
    }
}

// ==================== FAQ ====================
let faqs = [];

async function loadFAQ() {
    const listDiv = document.getElementById('faqList');
    listDiv.innerHTML = '<div class="loading">Carregando...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/site/faq`);
        faqs = await response.json();
        renderFAQ();
    } catch (error) {
        listDiv.innerHTML = '<div class="error-message">Erro ao carregar FAQ</div>';
        console.error('Erro ao carregar FAQ:', error);
    }
}

function renderFAQ() {
    const listDiv = document.getElementById('faqList');
    
    if (faqs.length === 0) {
        listDiv.innerHTML = '<div class="loading">Nenhuma pergunta cadastrada</div>';
        return;
    }
    
    listDiv.innerHTML = faqs.map(faq => `
        <div class="faq-item">
            <div class="faq-item-question">${faq.pergunta}</div>
            <div class="faq-item-answer">${faq.resposta}</div>
            <div class="faq-item-actions">
                <button class="btn btn-primary btn-small" onclick="editFAQ(${faq.id})">Editar</button>
                <button class="btn btn-danger btn-small" onclick="deleteFAQ(${faq.id})">Excluir</button>
            </div>
        </div>
    `).join('');
}

function editFAQ(id) {
    const faq = faqs.find(f => f.id === id);
    if (faq) {
        if (typeof window.openFaqModal === 'function') {
            window.openFaqModal(faq);
        } else {
            console.error('openFaqModal não está disponível!');
            alert('Erro: Função não disponível. Recarregue a página.');
        }
    }
}

// Variável global para armazenar FAQ sendo editado - JÁ DECLARADA NO INÍCIO DO ARQUIVO (linha 13)

// Abrir modal de FAQ
window.openFaqModal = function(faq = null) {
    console.log('🔵 openFaqModal chamada!', faq ? 'Editar' : 'Novo');
    
    try {
        editingFaq = faq;
        const modal = document.getElementById('faqModal');
        const form = document.getElementById('faqForm');
        const title = document.getElementById('faqModalTitle');
        
        if (!modal) {
            console.error('❌ Modal não encontrado!');
            showToast('Erro: Modal não encontrado. Por favor, recarregue a página.', 'error');
            return;
        }
        
        if (!form) {
            console.error('❌ Formulário não encontrado!');
            showToast('Erro: Formulário não encontrado. Por favor, recarregue a página.', 'error');
            return;
        }
        
        form.reset();
        
        if (faq) {
            console.log('📝 Editando FAQ:', faq);
            if (title) title.textContent = 'Editar Pergunta';
            
            const faqIdInput = document.getElementById('faqId');
            if (faqIdInput) faqIdInput.value = faq.id || '';
            
            const perguntaInput = document.getElementById('faqPergunta');
            if (perguntaInput) perguntaInput.value = faq.pergunta || '';
            
            const respostaInput = document.getElementById('faqResposta');
            if (respostaInput) respostaInput.value = faq.resposta || '';
            
            const ordemInput = document.getElementById('faqOrdem');
            if (ordemInput) ordemInput.value = faq.ordem || '';
            
            const ativoInput = document.getElementById('faqAtivo');
            if (ativoInput) ativoInput.value = faq.ativo ? 'true' : 'false';
        } else {
            console.log('✨ Criando nova pergunta');
            if (title) title.textContent = 'Nova Pergunta';
            
            const faqIdInput = document.getElementById('faqId');
            if (faqIdInput) faqIdInput.value = '';
        }
        
        console.log('📋 Removendo classe "hidden" do modal...');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        
        console.log('✅ Modal deve estar visível agora!');
        
    } catch (error) {
        console.error('❌ Erro ao abrir modal:', error);
        showToast('Erro ao abrir o formulário. Por favor, recarregue a página.', 'error');
    }
};

// Função closeFaqModal já foi definida no início do arquivo (após closeResponsavelModal)
// Não é necessário redefini-la aqui

// Salvar FAQ
async function handleSaveFAQ(e) {
    // Prevenir comportamento padrão do formulário
    if (e && e.preventDefault) {
        e.preventDefault();
    }
    
    console.log('🔵 ===== INICIANDO SALVAMENTO DE FAQ =====');
    
    // Encontrar o botão de submit de forma mais robusta
    const form = e?.target || document.getElementById('faqForm');
    const submitBtn = form?.querySelector('button[type="submit"]') || 
                     document.querySelector('#faqModal button[type="submit"]');
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        submitBtn.textContent = 'Salvando...';
    }
    
    // Mostrar loading
    if (typeof showLoading === 'function') {
        showLoading();
    }
    
    // Verificar autenticação antes de enviar
    try {
        const authCheck = await fetch(`${API_BASE}/auth/check`, {
            credentials: 'include'
        });
        const authData = await authCheck.json();
        
        if (!authData.authenticated) {
            console.error('❌ Sessão expirada!');
            showToast('Sua sessão expirou. Por favor, faça login novamente.', 'warning');
            currentUser = null;
            if (typeof showLogin === 'function') {
                showLogin();
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.classList.remove('loading');
                submitBtn.textContent = 'Salvar';
            }
            if (typeof hideLoading === 'function') {
                hideLoading();
            }
            return;
        }
        console.log('✅ Autenticação verificada');
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
    }
    
    const id = document.getElementById('faqId').value;
    const pergunta = document.getElementById('faqPergunta').value.trim();
    const resposta = document.getElementById('faqResposta').value.trim();
    
    // Validar campos obrigatórios
    if (!pergunta || !resposta) {
        showToast('Por favor, preencha pergunta e resposta.', 'error');
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        return;
    }
    
    // Criar objeto de dados
    const data = {
        pergunta,
        resposta
    };
    
    const ordemInput = document.getElementById('faqOrdem');
    if (ordemInput && ordemInput.value) {
        data.ordem = ordemInput.value;
    }
    
    const ativoInput = document.getElementById('faqAtivo');
    if (ativoInput) {
        data.ativo = ativoInput.value || 'true';
    }
    
    console.log('Enviando FAQ...', { 
        id, 
        pergunta: data.pergunta,
        resposta: data.resposta,
        ordem: data.ordem
    });
    
    try {
        const url = id 
            ? `${API_BASE}/site/faq/${id}`
            : `${API_BASE}/site/faq`;
        
        const response = await fetch(url, {
            method: id ? 'PUT' : 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        // Verificar se a resposta é JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Resposta não é JSON:', text.substring(0, 200));
            throw new Error('Resposta inválida do servidor');
        }
        
        const responseData = await response.json();
        
        console.log('📥 Resposta recebida:', {
            status: response.status,
            ok: response.ok,
            dataOk: responseData.ok,
            data: responseData
        });
        
        if (response.ok && responseData.ok) {
            console.log('✅ FAQ salvo com sucesso!');
            
            // Mostrar toast de sucesso
            showToast('FAQ salvo com sucesso!', 'success');
            
            // Aguardar um pouco para o usuário ver a mensagem
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Fechar modal
            if (typeof window.closeFaqModal === 'function') {
                window.closeFaqModal();
            } else {
                const modal = document.getElementById('faqModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                }
            }
            
            // Recarregar lista de FAQ
            if (typeof loadFAQ === 'function') {
                loadFAQ();
            }
            
            console.log('✅ ===== FAQ SALVO COM SUCESSO =====');
        } else {
            console.error('❌ Erro na resposta:', responseData);
            const errorMessage = responseData?.error || responseData?.message || 'Erro ao salvar FAQ';
            
            if (response.status === 401) {
                showToast('Sessão expirada. Por favor, faça login novamente.', 'warning');
                currentUser = null;
                if (typeof showLogin === 'function') {
                    showLogin();
                }
            } else {
                showToast(errorMessage, 'error');
            }
        }
    } catch (error) {
        console.error('❌ Erro ao salvar FAQ:', error);
        console.error('Tipo do erro:', error.name);
        console.error('Mensagem:', error.message);
        console.error('Stack:', error.stack);
        
        const errorMessage = error.message || 'Erro ao salvar FAQ. Verifique o console para mais detalhes.';
        showToast(errorMessage, 'error');
    } finally {
        // Restaurar botão
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            submitBtn.textContent = 'Salvar';
        }
        
        // Esconder loading
        if (typeof hideLoading === 'function') {
            hideLoading();
        }
        
        console.log('🔵 ===== FIM DO SALVAMENTO =====');
    }
}

async function deleteFAQ(id) {
    if (!confirm('Tem certeza que deseja excluir esta pergunta?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/site/faq/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        if (data.ok) {
            loadFAQ();
        } else {
            alert('Erro ao excluir FAQ');
        }
    } catch (error) {
        console.error('Erro ao excluir FAQ:', error);
        alert('Erro ao excluir FAQ');
    }
}

// ==================== SITES ====================
let sites = [];

async function loadSites() {
    const listDiv = document.getElementById('sitesList');
    listDiv.innerHTML = '<div class="loading">Carregando...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/site/sites-igreja`);
        sites = await response.json();
        renderSites();
    } catch (error) {
        listDiv.innerHTML = '<div class="error-message">Erro ao carregar sites</div>';
        console.error('Erro ao carregar sites:', error);
    }
}

function renderSites() {
    const listDiv = document.getElementById('sitesList');
    
    if (sites.length === 0) {
        listDiv.innerHTML = '<div class="loading">Nenhum site cadastrado</div>';
        return;
    }
    
    listDiv.innerHTML = sites.map(site => `
        <div class="jornal-card">
            <img src="${site.imagem || ''}" alt="${site.nome}" class="jornal-card-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27200%27 height=%27200%27%3E%3Crect fill=%27%23ecf0f1%27 width=%27200%27 height=%27200%27/%3E%3Ctext fill=%27%23999%27 font-family=%27sans-serif%27 font-size=%2714%27 x=%2750%25%27 y=%2750%25%27 text-anchor=%27middle%27 dy=%27.3em%27%3ESem Imagem%3C/text%3E%3C/svg%3E'">
            <div class="jornal-card-body">
                <div class="jornal-card-title">${site.nome}</div>
                <div class="jornal-card-info">URL: ${site.url}</div>
                <div class="jornal-card-info">Ordem: ${site.ordem}</div>
                <span class="jornal-card-status ${site.ativo ? 'ativo' : 'inativo'}">
                    ${site.ativo ? 'Ativo' : 'Inativo'}
                </span>
            </div>
            <div class="jornal-card-actions">
                <button class="btn btn-primary btn-small" onclick="editSite(${site.id})">Editar</button>
                <button class="btn btn-danger btn-small" onclick="deleteSite(${site.id})">Excluir</button>
            </div>
        </div>
    `).join('');
}

function editSite(id) {
    const site = sites.find(s => s.id === id);
    if (site) {
        if (typeof window.openSiteModal === 'function') {
            window.openSiteModal(site);
        } else {
            console.error('openSiteModal não está disponível!');
            alert('Erro: Função não disponível. Recarregue a página.');
        }
    }
}

// Variável global para armazenar site sendo editado - JÁ DECLARADA NO INÍCIO DO ARQUIVO (linha 258)

// Abrir modal de site
window.openSiteModal = function(site = null) {
    console.log('🔵 openSiteModal chamada!', site ? 'Editar' : 'Novo');
    
    try {
        editingSite = site;
        const modal = document.getElementById('siteModal');
        const form = document.getElementById('siteForm');
        const title = document.getElementById('siteModalTitle');
        
        if (!modal) {
            console.error('❌ Modal não encontrado!');
            showToast('Erro: Modal não encontrado. Por favor, recarregue a página.', 'error');
            return;
        }
        
        if (!form) {
            console.error('❌ Formulário não encontrado!');
            showToast('Erro: Formulário não encontrado. Por favor, recarregue a página.', 'error');
            return;
        }
        
        form.reset();
        const imagemPreview = document.getElementById('siteImagemPreview');
        if (imagemPreview) {
            imagemPreview.innerHTML = '';
        }
        
        if (site) {
            console.log('📝 Editando site:', site);
            if (title) title.textContent = 'Editar Site';
            
            const siteIdInput = document.getElementById('siteId');
            if (siteIdInput) siteIdInput.value = site.id || '';
            
            const nomeInput = document.getElementById('siteNome');
            if (nomeInput) nomeInput.value = site.nome || '';
            
            const urlInput = document.getElementById('siteUrl');
            if (urlInput) urlInput.value = site.url || '';
            
            const ordemInput = document.getElementById('siteOrdem');
            if (ordemInput) ordemInput.value = site.ordem || '';
            
            const ativoInput = document.getElementById('siteAtivo');
            if (ativoInput) ativoInput.value = site.ativo ? 'true' : 'false';
            
            if (site.imagem && imagemPreview) {
                imagemPreview.innerHTML = `
                    <div style="position: relative; display: inline-block;">
                        <img src="${site.imagem}" alt="Logo atual" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <div style="margin-top: 8px; font-size: 12px; color: #64748b; font-weight: 500;">
                            📷 Logo atual (envie uma nova para substituir)
                        </div>
                    </div>
                `;
            }
        } else {
            console.log('✨ Criando novo site');
            if (title) title.textContent = 'Novo Site';
            
            const siteIdInput = document.getElementById('siteId');
            if (siteIdInput) siteIdInput.value = '';
        }
        
        console.log('📋 Removendo classe "hidden" do modal...');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        
        console.log('✅ Modal deve estar visível agora!');
        
    } catch (error) {
        console.error('❌ Erro ao abrir modal:', error);
        showToast('Erro ao abrir o formulário. Por favor, recarregue a página.', 'error');
    }
};

// Função closeSiteModal já foi definida no início do arquivo (após closeFaqModal)
// Não é necessário redefini-la aqui

// Salvar site
async function handleSaveSite(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    
    // Verificar autenticação antes de enviar
    try {
        const authCheck = await fetch(`${API_BASE}/auth/check`, {
            credentials: 'include'
        });
        const authData = await authCheck.json();
        
        if (!authData.authenticated) {
            showToast('Sua sessão expirou. Por favor, faça login novamente.', 'warning');
            currentUser = null;
            showLogin();
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            return;
        }
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
    }
    
    const id = document.getElementById('siteId').value;
    const nome = document.getElementById('siteNome').value.trim();
    const url = document.getElementById('siteUrl').value.trim();
    
    // Validar campos obrigatórios
    if (!nome || !url) {
        showToast('Por favor, preencha nome e URL.', 'error');
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        return;
    }
    
    // Criar FormData
    const formData = new FormData();
    formData.append('nome', nome);
    formData.append('url', url);
    
    const ordemInput = document.getElementById('siteOrdem');
    if (ordemInput && ordemInput.value) {
        formData.append('ordem', ordemInput.value);
    }
    
    const ativoInput = document.getElementById('siteAtivo');
    if (ativoInput) {
        formData.append('ativo', ativoInput.value || 'true');
    }
    
    // Adicionar arquivo se existir (apenas se houver arquivo selecionado)
    const imagemInput = document.getElementById('siteImagem');
    if (imagemInput && imagemInput.files && imagemInput.files.length > 0) {
        formData.append('imagem', imagemInput.files[0]);
        console.log('Arquivo de imagem adicionado:', imagemInput.files[0].name);
    }
    
    console.log('Enviando site...', { 
        id, 
        nome,
        url,
        hasFile: imagemInput?.files.length > 0,
        ordem: formData.get('ordem')
    });
    
    try {
        const urlEndpoint = id 
            ? `${API_BASE}/site/sites-igreja/${id}`
            : `${API_BASE}/site/sites-igreja`;
        
        const response = await fetch(urlEndpoint, {
            method: id ? 'PUT' : 'POST',
            credentials: 'include',
            body: formData
        });
        
        // Verificar se a resposta é JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Resposta não é JSON:', text.substring(0, 200));
            throw new Error('Resposta inválida do servidor');
        }
        
        const data = await response.json();
        
        if (response.ok && data.ok) {
            showToast('Site salvo com sucesso!', 'success');
            // Chamar closeSiteModal de forma explícita
            if (typeof window.closeSiteModal === 'function') {
                window.closeSiteModal();
            } else {
                const modal = document.getElementById('siteModal');
                if (modal) {
                    modal.classList.add('hidden');
                    modal.style.display = 'none';
                    modal.setAttribute('style', 'display: none !important;');
                }
            }
            loadSites();
        } else {
            console.error('Erro na resposta:', data);
            if (response.status === 401) {
                showToast('Sessão expirada. Por favor, faça login novamente.', 'warning');
                currentUser = null;
                showLogin();
            } else {
                showToast(data.error || 'Erro ao salvar site', 'error');
            }
        }
    } catch (error) {
        console.error('Erro ao salvar site:', error);
        showToast('Erro ao salvar site: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
    }
}

async function deleteSite(id) {
    if (!confirm('Tem certeza que deseja excluir este site?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/site/sites-igreja/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        if (data.ok) {
            loadSites();
        } else {
            alert('Erro ao excluir site');
        }
    } catch (error) {
        console.error('Erro ao excluir site:', error);
        alert('Erro ao excluir site');
    }
}

// ==================== TEXTOS ====================
async function loadTextos() {
    const configDiv = document.getElementById('textosConfig');
    configDiv.innerHTML = '<div class="loading">Carregando...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/site/textos`);
        const textos = await response.json();
        
        // Normalizar caminho da imagem do jornal para exibição
        let jornalImagemUrl = textos.sobreJornal?.imagem || '';
        if (jornalImagemUrl) {
            if (jornalImagemUrl.startsWith('./')) {
                jornalImagemUrl = `http://localhost:3000${jornalImagemUrl.substring(1)}`;
            } else if (jornalImagemUrl.startsWith('/uploads')) {
                jornalImagemUrl = `${API_BASE.replace('/api', '')}${jornalImagemUrl}`;
            } else if (jornalImagemUrl.startsWith('/') && !jornalImagemUrl.startsWith('//')) {
                jornalImagemUrl = `http://localhost:3000${jornalImagemUrl}`;
            } else if (!jornalImagemUrl.startsWith('http')) {
                // Se não tem prefixo, assumir que é relativo ao site principal (ex: "Imagem/testesimagem.gif")
                jornalImagemUrl = `http://localhost:3000/${jornalImagemUrl}`;
            }
        }
        
        // Normalizar caminho da imagem da igreja para exibição
        let igrejaImagemUrl = textos.sobreIgreja?.imagem || '';
        let mostrarImagemPadraoIgreja = false;
        if (igrejaImagemUrl) {
            if (igrejaImagemUrl.startsWith('./')) {
                igrejaImagemUrl = `http://localhost:3000${igrejaImagemUrl.substring(1)}`;
            } else if (igrejaImagemUrl.startsWith('/uploads')) {
                igrejaImagemUrl = `${API_BASE.replace('/api', '')}${igrejaImagemUrl}`;
            } else if (igrejaImagemUrl.startsWith('/') && !igrejaImagemUrl.startsWith('//')) {
                igrejaImagemUrl = `http://localhost:3000${igrejaImagemUrl}`;
            } else if (!igrejaImagemUrl.startsWith('http')) {
                igrejaImagemUrl = `http://localhost:3000/${igrejaImagemUrl}`;
            }
        } else {
            // Se não há imagem no config, usar imagem padrão do site
            mostrarImagemPadraoIgreja = true;
            igrejaImagemUrl = 'http://localhost:3000/Imagem/igreja-.png';
        }
        
        configDiv.innerHTML = `
            <h3>Sobre o Jornal</h3>
            <form id="textoJornalForm">
                <div class="form-group">
                    <label for="jornalTitulo">Título</label>
                    <input type="text" id="jornalTitulo" name="titulo" value="${textos.sobreJornal?.titulo || ''}">
                </div>
                <div class="form-group">
                    <label for="jornalSubtitulo">Subtítulo</label>
                    <input type="text" id="jornalSubtitulo" name="subtitulo" value="${textos.sobreJornal?.subtitulo || ''}">
                </div>
                <div class="form-group">
                    <label for="jornalConteudo">Conteúdo</label>
                    <textarea id="jornalConteudo" name="conteudo" rows="10">${textos.sobreJornal?.conteudo || ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="jornalImagem">Imagem</label>
                    <input type="file" id="jornalImagem" name="materia" accept="image/*">
                    <small class="form-help">A imagem será exibida na seção sobre o jornal</small>
                    <div id="jornalImagemPreview" class="image-preview">
                        ${textos.sobreJornal?.imagem ? `
                            <div style="margin-top: 10px;">
                                <img src="${jornalImagemUrl}" alt="Imagem atual" style="max-width: 400px; width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); border: 2px solid #e2e8f0;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                                <div style="margin-top: 8px; font-size: 12px; color: #64748b; display: none;">Erro ao carregar imagem. Verifique o caminho: ${textos.sobreJornal.imagem}</div>
                                <div style="margin-top: 8px; font-size: 12px; color: #64748b;">Imagem atual exibida no site (envie uma nova para substituir)</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <button type="submit" class="btn btn-primary">Salvar Sobre Jornal</button>
            </form>
            
            <hr style="margin: 30px 0;">
            
            <h3>Sobre a Igreja</h3>
            <form id="textoIgrejaForm">
                <div class="form-group">
                    <label for="igrejaTitulo">Título</label>
                    <input type="text" id="igrejaTitulo" name="titulo" value="${textos.sobreIgreja?.titulo || ''}">
                </div>
                <div class="form-group">
                    <label for="igrejaSubtitulo">Subtítulo</label>
                    <input type="text" id="igrejaSubtitulo" name="subtitulo" value="${textos.sobreIgreja?.subtitulo || ''}">
                </div>
                <div class="form-group">
                    <label for="igrejaConteudo">Conteúdo</label>
                    <textarea id="igrejaConteudo" name="conteudo" rows="10">${textos.sobreIgreja?.conteudo || ''}</textarea>
                </div>
                <div class="form-group">
                    <label for="igrejaImagem">Imagem</label>
                    <input type="file" id="igrejaImagem" name="materia" accept="image/*">
                    <small class="form-help">A imagem será exibida na seção sobre a igreja</small>
                    <div id="igrejaImagemPreview" class="image-preview">
                        ${textos.sobreIgreja?.imagem || mostrarImagemPadraoIgreja ? `
                            <div style="margin-top: 10px;">
                                <img src="${igrejaImagemUrl}" alt="Imagem atual" style="max-width: 400px; width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); border: 2px solid #e2e8f0; ${mostrarImagemPadraoIgreja ? 'opacity: 0.9;' : ''}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                                <div style="margin-top: 8px; font-size: 12px; color: #dc2626; display: none;">Erro ao carregar imagem. ${textos.sobreIgreja?.imagem ? 'Verifique o caminho: ' + textos.sobreIgreja.imagem : 'Faça upload de uma imagem.'}</div>
                                <div style="margin-top: 8px; font-size: 12px; color: ${mostrarImagemPadraoIgreja ? '#f59e0b' : '#64748b'};">
                                    ${mostrarImagemPadraoIgreja ? '⚠ Imagem padrão do site (envie uma imagem para configurar)' : 'Imagem atual exibida no site (envie uma nova para substituir)'}
                                </div>
                            </div>
                        ` : '<div style="margin-top: 8px; font-size: 12px; color: #64748b;">Nenhuma imagem configurada. Faça upload de uma imagem.</div>'}
                    </div>
                </div>
                <button type="submit" class="btn btn-primary">Salvar Sobre Igreja</button>
            </form>
        `;
        
        // Preview de imagem para jornal
        const jornalImagemInput = document.getElementById('jornalImagem');
        const jornalImagemPreview = document.getElementById('jornalImagemPreview');
        if (jornalImagemInput && jornalImagemPreview) {
            jornalImagemInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        jornalImagemPreview.innerHTML = `
                            <div style="margin-top: 10px;">
                                <img src="${e.target.result}" alt="Preview" style="max-width: 300px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <div style="margin-top: 8px; font-size: 12px; color: #64748b;">Nova imagem selecionada</div>
                            </div>
                        `;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        
        document.getElementById('textoJornalForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData();
            
            // Adicionar campos de texto
            formData.append('titulo', document.getElementById('jornalTitulo').value);
            formData.append('subtitulo', document.getElementById('jornalSubtitulo').value);
            formData.append('conteudo', document.getElementById('jornalConteudo').value);
            
            // Adicionar arquivo se existir (campo 'materia' para o backend)
            const imagemFile = jornalImagemInput?.files[0];
            if (imagemFile) {
                formData.append('materia', imagemFile);
            }
            
            try {
                showLoading();
                const response = await fetch(`${API_BASE}/site/textos/sobre-jornal`, {
                    method: 'PUT',
                    credentials: 'include',
                    body: formData
                });
                
                const result = await response.json();
                hideLoading();
                if (result.ok) {
                    showToast('Texto sobre jornal salvo com sucesso!', 'success');
                    loadTextos(); // Recarregar para mostrar a nova imagem
                } else {
                    showToast(result.error || 'Erro ao salvar texto', 'error');
                }
            } catch (error) {
                hideLoading();
                console.error('Erro ao salvar texto:', error);
                showToast('Erro ao salvar texto', 'error');
            }
        });
        
        // Preview de imagem para igreja
        const igrejaImagemInput = document.getElementById('igrejaImagem');
        const igrejaImagemPreview = document.getElementById('igrejaImagemPreview');
        if (igrejaImagemInput && igrejaImagemPreview) {
            igrejaImagemInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        igrejaImagemPreview.innerHTML = `
                            <div style="margin-top: 10px;">
                                <img src="${e.target.result}" alt="Preview" style="max-width: 300px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <div style="margin-top: 8px; font-size: 12px; color: #64748b;">Nova imagem selecionada</div>
                            </div>
                        `;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        
        document.getElementById('textoIgrejaForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData();
            
            // Adicionar campos de texto
            formData.append('titulo', document.getElementById('igrejaTitulo').value);
            formData.append('subtitulo', document.getElementById('igrejaSubtitulo').value);
            formData.append('conteudo', document.getElementById('igrejaConteudo').value);
            
            // Adicionar arquivo se existir (campo 'materia' para o backend)
            const imagemFile = igrejaImagemInput?.files[0];
            if (imagemFile) {
                formData.append('materia', imagemFile);
            }
            
            try {
                showLoading();
                const response = await fetch(`${API_BASE}/site/textos/sobre-igreja`, {
                    method: 'PUT',
                    credentials: 'include',
                    body: formData
                });
                
                const result = await response.json();
                hideLoading();
                if (result.ok) {
                    showToast('Texto sobre igreja salvo com sucesso!', 'success');
                    loadTextos(); // Recarregar para mostrar a nova imagem
                } else {
                    showToast(result.error || 'Erro ao salvar texto', 'error');
                }
            } catch (error) {
                hideLoading();
                console.error('Erro ao salvar texto:', error);
                showToast('Erro ao salvar texto', 'error');
            }
        });
    } catch (error) {
        configDiv.innerHTML = '<div class="error-message">Erro ao carregar textos</div>';
        console.error('Erro ao carregar textos:', error);
    }
}

// ==================== BANNER MODAL ====================
async function loadBanner() {
    const configDiv = document.getElementById('bannerConfig');
    configDiv.innerHTML = '<div class="loading">Carregando...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/site/banner-modal`);
        const banner = await response.json();
        
        // Normalizar caminho da imagem para exibição
        let imagemUrl = banner.imagem || '';
        if (imagemUrl) {
            if (imagemUrl.startsWith('./')) {
                // Converter caminho relativo para URL completa do site principal
                imagemUrl = `http://localhost:3000${imagemUrl.substring(1)}`;
            } else if (imagemUrl.startsWith('/uploads')) {
                // Se começar com /uploads, usar a URL do dashboard-server
                imagemUrl = `${API_BASE.replace('/api', '')}${imagemUrl}`;
            } else if (imagemUrl.startsWith('/') && !imagemUrl.startsWith('//')) {
                // Caminho absoluto começando com / (ex: /Imagem/...)
                imagemUrl = `http://localhost:3000${imagemUrl}`;
            } else if (!imagemUrl.startsWith('http')) {
                // Caminho sem prefixo, assumir que é relativo ao site principal
                imagemUrl = `http://localhost:3000/${imagemUrl}`;
            }
        }
        
        configDiv.innerHTML = `
            <form id="bannerForm">
                <div class="form-group">
                    <label for="bannerImagem">Imagem</label>
                    <input type="file" id="bannerImagem" name="materia" accept="image/*">
                    <small class="form-help">A imagem será exibida no modal que aparece ao carregar o site</small>
                    <div id="bannerImagemPreview" class="image-preview">
                        ${banner.imagem ? `
                            <div style="margin-top: 10px;">
                                <img src="${imagemUrl}" alt="Banner atual" style="max-width: 500px; width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); border: 2px solid #e2e8f0;">
                                <div style="margin-top: 8px; font-size: 12px; color: #64748b;">Banner atual exibido no site (envie uma nova imagem para substituir)</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="form-group">
                    <label for="bannerLink">Link</label>
                    <input type="text" id="bannerLink" name="link" value="${banner.link || ''}" placeholder="Ex: ./pag.compra-do-jornal 2025/J . Setembro. 2025.html">
                    <small class="form-help">URL para onde o banner redirecionará ao ser clicado</small>
                </div>
                <div class="form-group">
                    <label for="bannerAtivo">Ativo</label>
                    <select id="bannerAtivo" name="ativo">
                        <option value="true" ${banner.ativo ? 'selected' : ''}>Sim</option>
                        <option value="false" ${!banner.ativo ? 'selected' : ''}>Não</option>
                    </select>
                    <small class="form-help">Se ativo, o banner será exibido automaticamente ao carregar o site</small>
                </div>
                <button type="submit" class="btn btn-primary">Salvar Banner</button>
            </form>
        `;
        
        // Preview de imagem ao selecionar
        const bannerImagemInput = document.getElementById('bannerImagem');
        const bannerImagemPreview = document.getElementById('bannerImagemPreview');
        if (bannerImagemInput && bannerImagemPreview) {
            bannerImagemInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        bannerImagemPreview.innerHTML = `
                            <div style="margin-top: 10px;">
                                <img src="${e.target.result}" alt="Preview" style="max-width: 500px; width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); border: 2px solid #3b82f6;">
                                <div style="margin-top: 8px; font-size: 12px; color: #3b82f6;">Nova imagem selecionada</div>
                            </div>
                        `;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
        
        document.getElementById('bannerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData();
            
            // Adicionar campos de texto
            formData.append('link', document.getElementById('bannerLink').value);
            formData.append('ativo', document.getElementById('bannerAtivo').value);
            
            // Adicionar arquivo se existir (campo 'materia' para o backend)
            const imagemFile = bannerImagemInput?.files[0];
            if (imagemFile) {
                formData.append('materia', imagemFile);
            }
            
            try {
                showLoading();
                const response = await fetch(`${API_BASE}/site/banner-modal`, {
                    method: 'PUT',
                    credentials: 'include',
                    body: formData
                });
                
                const result = await response.json();
                hideLoading();
                if (result.ok) {
                    showToast('Banner salvo com sucesso!', 'success');
                    loadBanner(); // Recarregar para mostrar a nova imagem
                } else {
                    showToast(result.error || 'Erro ao salvar banner', 'error');
                }
            } catch (error) {
                hideLoading();
                console.error('Erro ao salvar banner:', error);
                showToast('Erro ao salvar banner', 'error');
            }
        });
    } catch (error) {
        configDiv.innerHTML = '<div class="error-message">Erro ao carregar banner</div>';
        console.error('Erro ao carregar banner:', error);
    }
}

// ==================== NOTÍCIAS ====================
let noticias = [];

async function loadNoticias() {
    const listDiv = document.getElementById('noticiasList');
    listDiv.innerHTML = '<div class="loading">Carregando...</div>';
    
    try {
        const response = await fetch(`${API_BASE}/noticias`);
        noticias = await response.json();
        renderNoticias();
    } catch (error) {
        listDiv.innerHTML = '<div class="error-message">Erro ao carregar notícias</div>';
        console.error('Erro ao carregar notícias:', error);
    }
}

function renderNoticias() {
    const listDiv = document.getElementById('noticiasList');
    
    if (noticias.length === 0) {
        listDiv.innerHTML = '<div class="loading">Nenhuma notícia cadastrada</div>';
        return;
    }
    
    listDiv.innerHTML = noticias.map(noticia => `
        <div class="noticia-item">
            ${noticia.image ? `<img src="${noticia.image}" alt="${noticia.title}" class="noticia-item-image">` : ''}
            <div class="noticia-item-title">${noticia.title}</div>
            <div class="noticia-item-meta">${noticia.date} | ${noticia.category}</div>
            <div class="noticia-item-content">${noticia.excerpt || noticia.content.substring(0, 200)}...</div>
            <div class="jornal-card-actions">
                <button class="btn btn-primary btn-small" onclick="editNoticia(${noticia.id})">Editar</button>
                <button class="btn btn-danger btn-small" onclick="deleteNoticia(${noticia.id})">Excluir</button>
            </div>
        </div>
    `).join('');
}

function editNoticia(id) {
    const noticia = noticias.find(n => n.id === id);
    if (noticia) {
        if (typeof window.openNoticiaModal === 'function') {
            window.openNoticiaModal(noticia);
        } else {
            console.error('openNoticiaModal não está disponível!');
            alert('Erro: Função não disponível. Recarregue a página.');
        }
    }
}

// Variável global para armazenar notícia sendo editada - JÁ DECLARADA NO INÍCIO DO ARQUIVO (linha 259)

// Abrir modal de notícia
window.openNoticiaModal = function(noticia = null) {
    console.log('🔵 openNoticiaModal chamada!', noticia ? 'Editar' : 'Novo');
    
    try {
        editingNoticia = noticia;
        const modal = document.getElementById('noticiaModal');
        const form = document.getElementById('noticiaForm');
        const title = document.getElementById('noticiaModalTitle');
        
        if (!modal) {
            console.error('❌ Modal não encontrado!');
            showToast('Erro: Modal não encontrado. Por favor, recarregue a página.', 'error');
            return;
        }
        
        if (!form) {
            console.error('❌ Formulário não encontrado!');
            showToast('Erro: Formulário não encontrado. Por favor, recarregue a página.', 'error');
            return;
        }
        
        form.reset();
        const imagemPreview = document.getElementById('noticiaImagePreview');
        if (imagemPreview) {
            imagemPreview.innerHTML = '';
        }
        
        if (noticia) {
            console.log('📝 Editando notícia:', noticia);
            if (title) title.textContent = 'Editar Notícia';
            
            const noticiaIdInput = document.getElementById('noticiaId');
            if (noticiaIdInput) noticiaIdInput.value = noticia.id || '';
            
            const titleInput = document.getElementById('noticiaTitle');
            if (titleInput) titleInput.value = noticia.title || '';
            
            const dateInput = document.getElementById('noticiaDate');
            if (dateInput) dateInput.value = noticia.date || '';
            
            const categoryInput = document.getElementById('noticiaCategory');
            if (categoryInput) categoryInput.value = noticia.category || 'geral';
            
            const excerptInput = document.getElementById('noticiaExcerpt');
            if (excerptInput) excerptInput.value = noticia.excerpt || '';
            
            const contentInput = document.getElementById('noticiaContent');
            if (contentInput) contentInput.value = noticia.content || '';
            
            const tagInput = document.getElementById('noticiaTag');
            if (tagInput) tagInput.value = noticia.tag || '';
            
            if (noticia.image && imagemPreview) {
                imagemPreview.innerHTML = `
                    <div style="position: relative; display: inline-block;">
                        <img src="${noticia.image}" alt="Imagem atual" style="max-width: 100%; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <div style="margin-top: 8px; font-size: 12px; color: #64748b; font-weight: 500;">
                            📷 Imagem atual (envie uma nova para substituir)
                        </div>
                    </div>
                `;
            }
        } else {
            console.log('✨ Criando nova notícia');
            if (title) title.textContent = 'Nova Notícia';
            
            const noticiaIdInput = document.getElementById('noticiaId');
            if (noticiaIdInput) noticiaIdInput.value = '';
            
            // Definir data padrão como hoje
            const dateInput = document.getElementById('noticiaDate');
            if (dateInput) {
                const today = new Date().toISOString().split('T')[0];
                dateInput.value = today;
            }
        }
        
        console.log('📋 Removendo classe "hidden" do modal...');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        
        console.log('✅ Modal deve estar visível agora!');
        
    } catch (error) {
        console.error('❌ Erro ao abrir modal:', error);
        showToast('Erro ao abrir o formulário. Por favor, recarregue a página.', 'error');
    }
};

// Função closeNoticiaModal já foi definida no início do arquivo (após closeSiteModal)
// Não é necessário redefini-la aqui

// Salvar notícia
async function handleSaveNoticia(e) {
    e.preventDefault();
    
    console.log('🔵 ===== INÍCIO DO SALVAMENTO DE NOTÍCIA =====');
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]') || document.querySelector('#noticiaForm button[type="submit"]');
    
    if (!submitBtn) {
        console.error('❌ Botão de submit não encontrado!');
        showToast('Erro: Botão de submit não encontrado', 'error');
        return;
    }
    
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    submitBtn.textContent = 'Salvando...';
    
    // Mostrar loading
    if (typeof showLoading === 'function') {
        showLoading();
    }
    
    // Verificar autenticação antes de enviar
    try {
        const authCheck = await fetch(`${API_BASE}/auth/check`, {
            credentials: 'include'
        });
        const authData = await authCheck.json();
        
        if (!authData.authenticated) {
            showToast('Sua sessão expirou. Por favor, faça login novamente.', 'warning');
            currentUser = null;
            showLogin();
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            submitBtn.textContent = originalText;
            if (typeof hideLoading === 'function') {
                hideLoading();
            }
            return;
        }
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
    }
    
    const id = document.getElementById('noticiaId').value;
    const title = document.getElementById('noticiaTitle').value.trim();
    const content = document.getElementById('noticiaContent').value.trim();
    
    // Validar campos obrigatórios
    if (!title || !content) {
        showToast('Por favor, preencha título e conteúdo.', 'error');
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        submitBtn.textContent = originalText;
        if (typeof hideLoading === 'function') {
            hideLoading();
        }
        return;
    }
    
    // Criar FormData
    const formData = new FormData();
    formData.append('title', title);
    formData.append('content', content);
    
    const dateInput = document.getElementById('noticiaDate');
    if (dateInput && dateInput.value) {
        formData.append('date', dateInput.value);
    }
    
    const categoryInput = document.getElementById('noticiaCategory');
    if (categoryInput) {
        formData.append('category', categoryInput.value || 'geral');
    }
    
    const excerptInput = document.getElementById('noticiaExcerpt');
    if (excerptInput && excerptInput.value) {
        formData.append('excerpt', excerptInput.value.trim());
    }
    
    const tagInput = document.getElementById('noticiaTag');
    if (tagInput && tagInput.value) {
        formData.append('tag', tagInput.value.trim());
    }
    
    // Adicionar arquivo se existir (apenas se houver arquivo selecionado)
    // O backend usa uploadMateria que espera o campo "materia"
    const imagemInput = document.getElementById('noticiaImage');
    if (imagemInput && imagemInput.files && imagemInput.files.length > 0) {
        formData.append('materia', imagemInput.files[0]);
        console.log('Arquivo de imagem adicionado:', imagemInput.files[0].name);
    }
    
    console.log('Enviando notícia...', { 
        id, 
        title,
        hasContent: !!content,
        hasFile: imagemInput?.files.length > 0,
        category: formData.get('category')
    });
    
    try {
        const urlEndpoint = id 
            ? `${API_BASE}/noticias/${id}`
            : `${API_BASE}/noticias`;
        
        const response = await fetch(urlEndpoint, {
            method: id ? 'PUT' : 'POST',
            credentials: 'include',
            body: formData
        });
        
        // Verificar se a resposta é JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Resposta não é JSON:', text.substring(0, 200));
            throw new Error('Resposta inválida do servidor');
        }
        
        const data = await response.json();
        
        if (response.ok && data.ok) {
            showToast('Notícia salva com sucesso!', 'success');
            
            // Limpar formulário
            form.reset();
            const imagemPreview = document.getElementById('noticiaImagePreview');
            if (imagemPreview) {
                imagemPreview.innerHTML = '';
            }
            
            // Fechar modal após um pequeno delay
            setTimeout(() => {
                if (typeof window.closeNoticiaModal === 'function') {
                    window.closeNoticiaModal();
                } else {
                    const modal = document.getElementById('noticiaModal');
                    if (modal) {
                        modal.classList.add('hidden');
                        modal.style.display = 'none';
                    }
                }
            }, 500);
            
            // Recarregar lista de notícias
            loadNoticias();
        } else {
            console.error('Erro na resposta:', data);
            if (response.status === 401) {
                showToast('Sessão expirada. Por favor, faça login novamente.', 'warning');
                currentUser = null;
                showLogin();
            } else {
                showToast(data.error || 'Erro ao salvar notícia', 'error');
            }
        }
    } catch (error) {
        console.error('Erro ao salvar notícia:', error);
        console.error('Tipo do erro:', error.name);
        console.error('Mensagem:', error.message);
        showToast('Erro ao salvar notícia: ' + (error.message || 'Erro desconhecido'), 'error');
    } finally {
        // Restaurar botão
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            submitBtn.textContent = originalText;
        }
        
        // Esconder loading
        if (typeof hideLoading === 'function') {
            hideLoading();
        }
        
        console.log('🔵 ===== FIM DO SALVAMENTO DE NOTÍCIA =====');
    }
}

async function deleteNoticia(id) {
    if (!confirm('Tem certeza que deseja excluir esta notícia?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/noticias/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        if (data.ok) {
            loadNoticias();
        } else {
            alert('Erro ao excluir notícia');
        }
    } catch (error) {
        console.error('Erro ao excluir notícia:', error);
        alert('Erro ao excluir notícia');
    }
}

// ==================== COLUNISTAS ====================

async function loadColunistas() {
    const listDiv = document.getElementById('colunistasList');
    if (!listDiv) {
        console.error('Elemento colunistasList não encontrado!');
        return;
    }
    
    listDiv.innerHTML = '<div class="loading">Carregando...</div>';
    
    try {
        console.log('Carregando colunistas de:', `${API_BASE}/admin/colunistas`);
        const response = await fetch(`${API_BASE}/admin/colunistas`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Dados recebidos:', data);
        colunistas = data.colunistas || [];
        console.log('Colunistas carregados:', colunistas.length);
        renderColunistas();
    } catch (error) {
        listDiv.innerHTML = '<div class="error-message">Erro ao carregar colunistas: ' + error.message + '</div>';
        console.error('Erro ao carregar colunistas:', error);
    }
}

function renderColunistas() {
    const listDiv = document.getElementById('colunistasList');
    if (!listDiv) return;
    
    if (colunistas.length === 0) {
        listDiv.innerHTML = '<div class="loading">Nenhum colunista cadastrado</div>';
        return;
    }
    
    // Ordenar por ordem
    const sortedColunistas = [...colunistas].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    
    // Função para normalizar o caminho da imagem
    const getImageUrl = (imagem) => {
        if (!imagem) return '';
        
        // Se já é uma URL completa, retornar como está
        if (imagem.startsWith('http://') || imagem.startsWith('https://')) {
            return imagem;
        }
        
        // Se começa com ./ ou /, converter para caminho do servidor principal
        if (imagem.startsWith('./')) {
            // Remover o ./ e adicionar o caminho do servidor principal
            const cleanPath = imagem.replace('./', '');
            return `http://localhost:3000/${cleanPath}`;
        }
        
        // Se começa com /, adicionar o servidor principal
        if (imagem.startsWith('/')) {
            return `http://localhost:3000${imagem}`;
        }
        
        // Caso contrário, assumir que é relativo ao servidor principal
        return `http://localhost:3000/${imagem}`;
    };
    
    listDiv.innerHTML = sortedColunistas.map(colunista => {
        const imageUrl = getImageUrl(colunista.imagem);
        return `
        <div class="jornal-card">
            ${imageUrl ? `
            <div class="jornal-card-image-wrapper">
                <img src="${imageUrl}" alt="${colunista.nome}" class="jornal-card-image" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27200%27 height=%27200%27%3E%3Crect fill=%27%23ecf0f1%27 width=%27200%27 height=%27200%27/%3E%3Ctext fill=%27%23999%27 font-family=%27sans-serif%27 font-size=%2714%27 x=%2750%25%27 y=%2750%25%27 text-anchor=%27middle%27 dy=%27.3em%27%3ESem Foto%3C/text%3E%3C/svg%3E';">
            </div>
            ` : ''}
            <div class="jornal-card-body">
                <div class="jornal-card-header">
                    <div class="jornal-card-title-wrapper">
                        <div>
                            <h3 class="jornal-card-title">${colunista.nome}</h3>
                            <p class="jornal-card-subtitle">${colunista.coluna}</p>
                        </div>
                        <div class="jornal-card-badge-group">
                            <span class="jornal-card-badge ${colunista.ativo ? 'ativo' : 'inativo'}">
                                <span class="badge-icon">${colunista.ativo ? '✓' : '✗'}</span>
                                <span class="badge-text">${colunista.ativo ? 'Ativo' : 'Inativo'}</span>
                            </span>
                        </div>
                    </div>
                </div>
                <div class="jornal-card-description">
                    <p>${(colunista.conteudo || '').substring(0, 200)}${colunista.conteudo && colunista.conteudo.length > 200 ? '...' : ''}</p>
                </div>
                ${colunista.instagram ? `
                <div class="jornal-card-meta">
                    <span style="display: flex; align-items: center; gap: 8px; color: #64748b; font-size: 13px;">
                        <span>📱</span>
                        <span>${colunista.instagram}</span>
                    </span>
                </div>
                ` : ''}
            </div>
            <div class="jornal-card-actions">
                <button class="btn btn-primary btn-small" onclick="editColunista(${colunista.id})">Editar</button>
                <button class="btn btn-danger btn-small" onclick="deleteColunista(${colunista.id})">Excluir</button>
            </div>
        </div>
        `;
    }).join('');
}

function editColunista(id) {
    const colunista = colunistas.find(c => c.id === id);
    if (colunista) {
        if (typeof window.openColunistaModal === 'function') {
            window.openColunistaModal(colunista);
        } else {
            console.error('openColunistaModal não está disponível!');
            alert('Erro: Função não disponível. Recarregue a página.');
        }
    }
}

window.openColunistaModal = function(colunista = null) {
    console.log('🔵 openColunistaModal chamada!', colunista ? 'Editar' : 'Novo');
    
    try {
        editingColunista = colunista;
        const modal = document.getElementById('colunistaModal');
        const form = document.getElementById('colunistaForm');
        const title = document.getElementById('colunistaModalTitle');
        
        if (!modal) {
            console.error('❌ Modal não encontrado!');
            showToast('Erro: Modal não encontrado. Por favor, recarregue a página.', 'error');
            return;
        }
        
        if (!form) {
            console.error('❌ Formulário não encontrado!');
            showToast('Erro: Formulário não encontrado. Por favor, recarregue a página.', 'error');
            return;
        }
        
        form.reset();
        const imagemPreview = document.getElementById('colunistaImagemPreview');
        if (imagemPreview) {
            imagemPreview.innerHTML = '';
        }
        
        if (colunista) {
            console.log('📝 Editando colunista:', colunista);
            if (title) title.textContent = 'Editar Colunista';
            
            const colunistaIdInput = document.getElementById('colunistaId');
            if (colunistaIdInput) colunistaIdInput.value = colunista.id || '';
            
            const nomeInput = document.getElementById('colunistaNome');
            if (nomeInput) nomeInput.value = colunista.nome || '';
            
            const colunaInput = document.getElementById('colunistaColuna');
            if (colunaInput) colunaInput.value = colunista.coluna || '';
            
            const conteudoInput = document.getElementById('colunistaConteudo');
            if (conteudoInput) conteudoInput.value = colunista.conteudo || '';
            
            const instagramInput = document.getElementById('colunistaInstagram');
            if (instagramInput) instagramInput.value = colunista.instagram || '';
            
            const ordemInput = document.getElementById('colunistaOrdem');
            if (ordemInput) ordemInput.value = colunista.ordem || 0;
            
            const ativoInput = document.getElementById('colunistaAtivo');
            if (ativoInput) ativoInput.value = colunista.ativo !== false ? 'true' : 'false';
            
            if (colunista.imagem && imagemPreview) {
                imagemPreview.innerHTML = `
                    <div style="position: relative; display: inline-block;">
                        <img src="${colunista.imagem}" alt="Imagem atual" style="max-width: 100%; max-height: 200px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <div style="margin-top: 8px; font-size: 12px; color: #64748b; font-weight: 500;">
                            📷 Imagem atual (envie uma nova para substituir)
                        </div>
                    </div>
                `;
            }
        } else {
            console.log('✨ Criando novo colunista');
            if (title) title.textContent = 'Novo Colunista';
            
            const colunistaIdInput = document.getElementById('colunistaId');
            if (colunistaIdInput) colunistaIdInput.value = '';
        }
        
        console.log('📋 Removendo classe "hidden" do modal...');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        
        console.log('✅ Modal deve estar visível agora!');
        
    } catch (error) {
        console.error('❌ Erro ao abrir modal:', error);
        showToast('Erro ao abrir o formulário. Por favor, recarregue a página.', 'error');
    }
};

window.closeColunistaModal = function() {
    const modal = document.getElementById('colunistaModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    editingColunista = null;
};

async function handleSaveColunista(e) {
    e.preventDefault();
    
    console.log('🔵 ===== INÍCIO DO SALVAMENTO DE COLUNISTA =====');
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]') || document.querySelector('#colunistaForm button[type="submit"]');
    
    if (!submitBtn) {
        console.error('❌ Botão de submit não encontrado!');
        showToast('Erro: Botão de submit não encontrado', 'error');
        return;
    }
    
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    submitBtn.textContent = 'Salvando...';
    
    if (typeof showLoading === 'function') {
        showLoading();
    }
    
    // Verificar autenticação
    try {
        const authCheck = await fetch(`${API_BASE}/auth/check`, {
            credentials: 'include'
        });
        const authData = await authCheck.json();
        
        if (!authData.authenticated) {
            showToast('Sua sessão expirou. Por favor, faça login novamente.', 'warning');
            currentUser = null;
            showLogin();
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            submitBtn.textContent = originalText;
            if (typeof hideLoading === 'function') {
                hideLoading();
            }
            return;
        }
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
    }
    
    const id = document.getElementById('colunistaId').value;
    const nome = document.getElementById('colunistaNome').value.trim();
    const coluna = document.getElementById('colunistaColuna').value.trim();
    const conteudo = document.getElementById('colunistaConteudo').value.trim();
    
    // Validar campos obrigatórios
    if (!nome || !coluna || !conteudo) {
        showToast('Por favor, preencha nome, coluna e conteúdo.', 'error');
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        submitBtn.textContent = originalText;
        if (typeof hideLoading === 'function') {
            hideLoading();
        }
        return;
    }
    
    // Preparar dados
    const data = {
        nome,
        coluna,
        conteudo,
        instagram: document.getElementById('colunistaInstagram').value.trim(),
        ordem: parseInt(document.getElementById('colunistaOrdem').value) || 0,
        ativo: document.getElementById('colunistaAtivo').value === 'true',
        imagem: editingColunista?.imagem || ''
    };
    
    // Upload de imagem se houver arquivo selecionado
    const imagemInput = document.getElementById('colunistaImagem');
    if (imagemInput && imagemInput.files && imagemInput.files.length > 0) {
        try {
            const formData = new FormData();
            formData.append('materia', imagemInput.files[0]);
            
            const uploadResponse = await fetch(`${API_BASE}/colunistas/upload-imagem`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            
            const uploadData = await uploadResponse.json();
            if (uploadData.url) {
                data.imagem = uploadData.url;
            }
        } catch (error) {
            console.error('Erro ao fazer upload de imagem:', error);
        }
    }
    
    console.log('Enviando colunista...', { id, nome, coluna });
    
    try {
        const urlEndpoint = id 
            ? `${API_BASE}/colunistas/${id}`
            : `${API_BASE}/colunistas`;
        
        const response = await fetch(urlEndpoint, {
            method: id ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Resposta não é JSON:', text.substring(0, 200));
            throw new Error('Resposta inválida do servidor');
        }
        
        const responseData = await response.json();
        
        if (response.ok) {
            showToast('Colunista salvo com sucesso!', 'success');
            
            form.reset();
            const imagemPreview = document.getElementById('colunistaImagemPreview');
            if (imagemPreview) {
                imagemPreview.innerHTML = '';
            }
            
            setTimeout(() => {
                if (typeof window.closeColunistaModal === 'function') {
                    window.closeColunistaModal();
                }
            }, 500);
            
            loadColunistas();
        } else {
            console.error('Erro na resposta:', responseData);
            if (response.status === 401) {
                showToast('Sessão expirada. Por favor, faça login novamente.', 'warning');
                currentUser = null;
                showLogin();
            } else {
                showToast(responseData.error || 'Erro ao salvar colunista', 'error');
            }
        }
    } catch (error) {
        console.error('Erro ao salvar colunista:', error);
        showToast('Erro ao salvar colunista: ' + (error.message || 'Erro desconhecido'), 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            submitBtn.textContent = originalText;
        }
        
        if (typeof hideLoading === 'function') {
            hideLoading();
        }
        
        console.log('🔵 ===== FIM DO SALVAMENTO DE COLUNISTA =====');
    }
}

async function deleteColunista(id) {
    if (!confirm('Tem certeza que deseja excluir este colunista?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/colunistas/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        const data = await response.json();
        if (response.ok || data.ok || data.message) {
            showToast('Colunista excluído com sucesso!', 'success');
            loadColunistas();
        } else {
            showToast('Erro ao excluir colunista', 'error');
        }
    } catch (error) {
        console.error('Erro ao excluir colunista:', error);
        showToast('Erro ao excluir colunista', 'error');
    }
}
