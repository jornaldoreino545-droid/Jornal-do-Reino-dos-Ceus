// Configuração do Stripe
let stripe = null;
let elements = null;
let cardElement = null;

// Variáveis globais
let paymentIntentClientSecret = null;
let productData = null;

console.log('🚀 checkout.js carregado!');

// Inicialização
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('📋 DOM carregado, inicializando checkout...');
        try {
            await initializeCheckout();
        } catch (error) {
            console.error('❌ Erro ao inicializar checkout:', error);
            showErrorMessage('Erro ao carregar checkout. Por favor, recarregue a página.');
        }
    });
} else {
    console.log('📋 DOM já pronto, inicializando checkout...');
    (async () => {
        try {
            await initializeCheckout();
        } catch (error) {
            console.error('❌ Erro ao inicializar checkout:', error);
            showErrorMessage('Erro ao carregar checkout. Por favor, recarregue a página.');
        }
    })();
}

/**
 * Inicializa o checkout
 */
async function initializeCheckout() {
    try {
        // Obter produto da URL
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('product');

        console.log('URL atual:', window.location.href);
        console.log('Parâmetros da URL:', window.location.search);
        console.log('Product ID:', productId);

        if (!productId) {
            showErrorMessage('Jornal não especificado na URL. Por favor, acesse através de um link válido.');
            return;
        }

        // Verificar se é um jornal (formato: jornal_1)
        if (productId.startsWith('jornal_')) {
            const jornalId = productId.replace('jornal_', '');
            console.log('Buscando jornal com ID:', jornalId);
            
            // Buscar dados do jornal da API principal
            const apiPaths = [
                'http://localhost:3000/api/jornais',
                '/api/jornais',
                'http://127.0.0.1:3000/api/jornais'
            ];
            
            let jornaisData = null;
            let jornaisResponse;
            
            for (const path of apiPaths) {
                try {
                    console.log(`Tentando buscar jornais de: ${path}`);
                    jornaisResponse = await fetch(path, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        credentials: 'omit',
                        mode: 'cors'
                    });
                    
                    if (jornaisResponse.ok) {
                        jornaisData = await jornaisResponse.json();
                        console.log('✅ Jornais carregados com sucesso!', jornaisData);
                        break;
                    } else {
                        console.log(`Resposta não OK de ${path}:`, jornaisResponse.status);
                    }
                } catch (err) {
                    console.log(`Erro ao buscar de ${path}:`, err.message);
                    continue;
                }
            }
            
            if (!jornaisData) {
                console.error('❌ Não foi possível carregar jornais de nenhuma API');
                showErrorMessage('Não foi possível carregar as informações do jornal. Verifique se o servidor está rodando na porta 3000.');
                return;
            }
            
            const jornais = jornaisData.jornais || jornaisData || [];
            const jornal = jornais.find(j => j.id === parseInt(jornalId) || j.id === jornalId);
            
            if (!jornal) {
                showErrorMessage('Jornal não encontrado. Verifique se o ID está correto.');
                return;
            }
            
            // Ajustar caminho da imagem
            let imagemCapa = jornal.capa || '';
            if (imagemCapa) {
                if (imagemCapa.startsWith('/uploads/')) {
                    imagemCapa = `http://localhost:3000${imagemCapa}`;
                } else if (imagemCapa.startsWith('uploads/')) {
                    imagemCapa = `http://localhost:3000/${imagemCapa}`;
                } else if (!imagemCapa.startsWith('http')) {
                    if (imagemCapa.startsWith('./')) {
                        imagemCapa = `http://localhost:3000/${imagemCapa.substring(2)}`;
                    } else if (imagemCapa.startsWith('/')) {
                        imagemCapa = `http://localhost:3000${imagemCapa}`;
                    } else {
                        imagemCapa = `http://localhost:3000/${imagemCapa}`;
                    }
                }
            } else if (jornal.mes) {
                imagemCapa = `http://localhost:3000/JORNAIS CAPAS/JORNAL DE ${jornal.mes.toUpperCase()}.png`;
            }
            
            // Preço padrão definido no dashboard (usado quando o jornal não tem preço próprio)
            let precoPadrao = 10.00;
            try {
                const cfg = await (await fetch('/api/site/config-geral')).json();
                if (Number(cfg && cfg.edicoes && cfg.edicoes.precoPadrao) > 0) precoPadrao = Number(cfg.edicoes.precoPadrao);
            } catch (e) { /* mantém 10,00 */ }

            // Converter jornal para formato do produto
            const product = {
                id: jornal.id,
                nome: jornal.nome || `Jornal ${jornal.mes} ${jornal.ano}`,
                descricao: jornal.descricao || `Edição especial de ${jornal.mes} de ${jornal.ano}. Uma edição que traz mensagens poderosas, testemunhos transformadores e direcionamento espiritual para fortalecer sua fé e abrir portas de bênçãos em ${jornal.ano}.`,
                preco: jornal.preco || precoPadrao,
                imagem: imagemCapa,
                mes: jornal.mes,
                ano: jornal.ano
            };
            
            productData = product;
            updateProductDisplay(product);
            
            // Configurar Stripe
            await setupStripe();
            
            return;
        }

        // Para outros tipos de produtos, usar a API original
        const productResponse = await fetch(`/api/product/${productId}`);
        
        if (!productResponse.ok) {
            showErrorMessage('Produto não encontrado. Verifique se o ID do produto está correto.');
            return;
        }
        
        productData = await productResponse.json();
        updateProductDisplay(productData);
        await setupStripe();
        
    } catch (error) {
        console.error('Erro ao inicializar checkout:', error);
        showErrorMessage('Erro ao carregar informações do produto. Por favor, recarregue a página ou entre em contato com o suporte.');
    }
}

/**
 * Configura o Stripe
 */
async function setupStripe() {
    try {
        // Buscar configuração do Stripe - tentar diferentes caminhos
        // Primeiro tenta a rota do próprio servidor (pode ser proxy do servidor principal)
        const stripeConfigPaths = [
            '/api/stripe-config', // Rota do servidor atual (pode ser proxy)
            'http://localhost:4242/api/stripe-config', // Servidor checkout direto (se servidor checkout não estiver rodando separadamente)
        ];
        
        let stripeConfig = null;
        let stripeResponse = null;
        let lastError = null;
        
        for (const path of stripeConfigPaths) {
            try {
                console.log(`🔍 Tentando buscar configuração Stripe de: ${path}`);
                stripeResponse = await fetch(path, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'omit',
                    mode: 'cors'
                });
                
                if (stripeResponse.ok) {
                    stripeConfig = await stripeResponse.json();
                    console.log('✅ Configuração Stripe carregada de:', path);
                    if (stripeConfig.publishableKey) {
                        console.log('✅ Chave pública encontrada!');
                        break;
                    } else {
                        console.log('⚠️ Resposta OK mas sem chave pública');
                    }
                } else {
                    const errorText = await stripeResponse.text().catch(() => '');
                    console.log(`❌ Resposta não OK de ${path}:`, stripeResponse.status, errorText);
                    lastError = `Status ${stripeResponse.status}`;
                }
            } catch (err) {
                console.log(`❌ Erro ao buscar de ${path}:`, err.message);
                lastError = err.message;
                continue;
            }
        }
        
        if (!stripeConfig || !stripeConfig.publishableKey || stripeConfig.publishableKey.trim() === '') {
            console.warn('⚠️ Stripe não configurado. Continuando sem pagamento...');
            console.warn('💡 Último erro:', lastError || 'Nenhum');
            console.warn('💡 Para configurar:');
            console.warn('   1. Crie arquivo .env na pasta checkout/');
            console.warn('   2. Adicione: STRIPE_PUBLISHABLE_KEY=pk_test_...');
            console.warn('   3. Certifique-se de que o servidor do checkout está rodando (porta 4242)');
            console.warn('   4. Ou configure as rotas proxy no servidor principal');
            showInfoMessage('Sistema de pagamento em configuração. Entre em contato: jornalreinodoseus@gmail.com');
            return;
        }
        
        // Inicializar Stripe
        stripe = Stripe(stripeConfig.publishableKey);
        elements = stripe.elements();
        
        // Criar elemento de cartão
        const cardElementContainer = document.getElementById('cardElement');
        if (!cardElementContainer) {
            console.error('Container do cartão não encontrado!');
            return;
        }
        
        cardElement = elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#1F2937',
                    fontFamily: 'Roboto, system-ui, sans-serif',
                    '::placeholder': {
                        color: '#9CA3AF',
                    },
                },
                invalid: {
                    color: '#EF4444',
                },
            },
        });
        
        cardElement.mount('#cardElement');
        
        // Listener para erros do cartão
        cardElement.on('change', (event) => {
            const errorDiv = document.getElementById('cardErrors');
            if (event.error) {
                errorDiv.textContent = event.error.message;
                errorDiv.classList.add('show');
            } else {
                errorDiv.textContent = '';
                errorDiv.classList.remove('show');
            }
        });
        
        // Configurar formulário
        const form = document.getElementById('checkoutForm');
        if (form) {
            form.addEventListener('submit', handleSubmit);
        }
        
        console.log('✅ Stripe configurado com sucesso!');
        
    } catch (error) {
        console.error('Erro ao configurar Stripe:', error);
        showErrorMessage('Erro ao configurar sistema de pagamento. Por favor, recarregue a página.');
    }
}

/**
 * Atualiza a exibição do produto
 */
function updateProductDisplay(product) {
    document.getElementById('productName').textContent = product.nome;
    document.getElementById('productDescription').textContent = product.descricao;
    
    const price = formatPrice(product.preco);
    document.getElementById('productPrice').textContent = price;
    document.getElementById('buttonAmount').textContent = price;
    
    // Atualizar imagem
    const productImage = document.getElementById('productImage');
    const productImagePlaceholder = document.getElementById('productImagePlaceholder');
    
    if (product.imagem) {
        const img = new Image();
        
        img.onload = function() {
            productImage.src = product.imagem;
            productImage.alt = product.nome;
            productImage.style.display = 'block';
            productImagePlaceholder.classList.add('hidden');
        };
        
        img.onerror = function() {
            console.warn(`Imagem não encontrada: ${product.imagem}. Usando placeholder.`);
            productImage.style.display = 'none';
            productImagePlaceholder.classList.remove('hidden');
        };
        
        img.src = product.imagem;
    } else {
        productImage.style.display = 'none';
        productImagePlaceholder.classList.remove('hidden');
    }
}

/**
 * Handle form submission
 */
async function handleSubmit(event) {
    event.preventDefault();
    
    const nome = document.getElementById('nome').value.trim();
    const email = document.getElementById('email').value.trim();
    
    if (!nome || !email) {
        showErrorMessage('Por favor, preencha todos os campos.');
        return;
    }
    
    if (!stripe || !cardElement) {
        showErrorMessage('Sistema de pagamento não configurado. Entre em contato: jornalreinodoseus@gmail.com');
        return;
    }
    
    showLoading(true);
    
    try {
        // Criar Payment Intent - tentar diferentes caminhos
        const paymentIntentPaths = [
            '/api/create-payment-intent', // Rota do próprio servidor (pode ser proxy)
            'http://localhost:4242/api/create-payment-intent', // Servidor checkout direto
        ];
        
        let response = null;
        let paymentIntentError = null;
        
        for (const path of paymentIntentPaths) {
            try {
                console.log(`💰 Tentando criar Payment Intent em: ${path}`);
                response = await fetch(path, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'omit',
                    mode: 'cors',
                    body: JSON.stringify({
                        amount: Math.round((productData.preco || 10.00) * 100), // Converter para centavos
                        currency: 'brl',
                        productId: productData.id,
                        productName: productData.nome,
                        customerName: nome,
                        customerEmail: email,
                    }),
                });
                
                if (response.ok) {
                    console.log('✅ Payment Intent criado com sucesso!');
                    break;
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    console.log(`❌ Erro ao criar Payment Intent em ${path}:`, response.status, errorData);
                    paymentIntentError = errorData.message || errorData.error || `Status ${response.status}`;
                    // Continuar para tentar próximo caminho
                    continue;
                }
            } catch (err) {
                console.log(`❌ Erro ao tentar ${path}:`, err.message);
                paymentIntentError = err.message;
                continue;
            }
        }
        
        if (!response || !response.ok) {
            throw new Error(paymentIntentError || 'Erro ao criar pagamento. Verifique se o servidor do checkout está rodando.');
        }
        
        const { clientSecret, paymentIntentId } = await response.json();
        paymentIntentClientSecret = clientSecret;
        
        // Confirmar pagamento
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardElement,
                billing_details: {
                    name: nome,
                    email: email,
                },
            },
        });
        
        if (error) {
            showLoading(false);
            showCardError(error.message);
            return;
        }
        
        if (paymentIntent.status === 'succeeded') {
            // Redirecionar para página de sucesso
            // Usar jornal_ID para manter consistência com o formato esperado
            const productIdForUrl = productData.id ? `jornal_${productData.id}` : urlParams.get('product');
            const successUrl = `/checkout/success?payment_intent=${paymentIntent.id}&product=${productIdForUrl}&email=${encodeURIComponent(email)}&nome=${encodeURIComponent(nome)}`;
            window.location.href = successUrl;
        } else {
            showLoading(false);
            showErrorMessage('O pagamento não foi confirmado. Por favor, tente novamente.');
        }
        
    } catch (error) {
        console.error('Erro ao processar pagamento:', error);
        showLoading(false);
        showErrorMessage(error.message || 'Erro ao processar pagamento. Por favor, tente novamente.');
    }
}

/**
 * Mostra/oculta loading
 */
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    const submitButton = document.getElementById('submitButton');
    
    if (show) {
        overlay.classList.remove('hidden');
        if (submitButton) submitButton.disabled = true;
    } else {
        overlay.classList.add('hidden');
        if (submitButton) submitButton.disabled = false;
    }
}

/**
 * Mostra mensagem de erro no campo do cartão
 */
function showCardError(message) {
    const errorDiv = document.getElementById('cardErrors');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    
    setTimeout(() => {
        errorDiv.classList.remove('show');
    }, 5000);
}

/**
 * Mostra mensagem de erro geral
 */
function showErrorMessage(message) {
    let errorContainer = document.getElementById('errorMessage');
    
    if (errorContainer) {
        errorContainer.innerHTML = `<i class='bx bx-error-circle'></i> ${message}`;
        errorContainer.style.display = 'flex';
        errorContainer.style.background = 'rgba(239, 68, 68, 0.1)';
        errorContainer.style.borderColor = '#EF4444';
        errorContainer.style.color = '#EF4444';
    } else {
        console.error('Container de erro não encontrado:', message);
        alert('Erro: ' + message);
    }
}

/**
 * Mostra mensagem informativa
 */
function showInfoMessage(message) {
    let infoContainer = document.getElementById('errorMessage');
    
    if (infoContainer) {
        infoContainer.innerHTML = `<i class='bx bx-info-circle'></i> ${message}`;
        infoContainer.style.display = 'flex';
        infoContainer.style.background = 'rgba(59, 130, 246, 0.1)';
        infoContainer.style.borderColor = '#3B82F6';
        infoContainer.style.color = '#1E40AF';
    } else {
        console.log('Info:', message);
    }
}

/**
 * Formata preço em R$
 */
function formatPrice(price) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(price);
}
