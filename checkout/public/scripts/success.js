console.log('✅ success.js carregado!');

// Obter parâmetros da URL
const urlParams = new URLSearchParams(window.location.search);
const paymentIntentId = urlParams.get('payment_intent');
const productId = urlParams.get('product');
const email = urlParams.get('email');
const nome = urlParams.get('nome');

// Variável global para armazenar informações do jornal
let jornalData = null;

console.log('Payment Intent ID:', paymentIntentId);
console.log('Product ID:', productId);
console.log('Email:', email);
console.log('Nome:', nome);

// Atualizar informações na página
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Salvar pagamento no dashboard
        if (paymentIntentId && productId && email && nome) {
            await savePaymentToDashboard();
        }
        
        // Atualizar data
        const orderDate = new Date().toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        document.getElementById('orderDate').textContent = orderDate;
        
        // Atualizar email
        if (email) {
            document.getElementById('customerEmail').textContent = email;
        }
        
        // Buscar informações do produto se tiver productId
        if (productId) {
            await loadProductInfo(productId);
        }
        
        // Configurar botão de download
        setupDownloadButton();
        
        // Tentar download automático
        setTimeout(() => {
            attemptAutoDownload();
        }, 2000);
        
    } catch (error) {
        console.error('Erro ao inicializar página de sucesso:', error);
    }
});

/**
 * Salva o pagamento no dashboard
 */
async function savePaymentToDashboard() {
    try {
        let jornalId = productId;
        let jornalNome = 'Jornal do Reino dos Céus';
        let valorPagamento = 0;
        
        // Se o productId está no formato jornal_X, extrair o ID
        if (productId.startsWith('jornal_')) {
            jornalId = productId.replace('jornal_', '');
        }
        
        // Tentar buscar informações do jornal para obter o nome e preço
        try {
            const response = await fetch(`http://localhost:3000/api/jornais`);
            if (response.ok) {
                const data = await response.json();
                const jornais = data.jornais || data || [];
                const jornal = jornais.find(j => j.id === parseInt(jornalId) || j.id === jornalId || j.id.toString() === jornalId);
                if (jornal) {
                    jornalNome = jornal.nome || `Jornal ${jornal.mes || ''} ${jornal.ano || ''}`.trim();
                    // Usar o preço do jornal se disponível
                    valorPagamento = jornal.preco || 10.00;
                }
            }
        } catch (err) {
            console.log('Erro ao buscar informações do jornal:', err.message);
        }
        
        // O pagamento já deve ter sido salvo quando o download foi solicitado via /api/download
        // que busca o paymentIntent do Stripe e salva com o valor correto
        // Aqui vamos apenas garantir que o pagamento existe, mas não vamos sobrescrever
        // O servidor já verifica se existe e retorna o existente
        const paymentData = {
            paymentIntentId: paymentIntentId,
            nome: nome,
            email: email,
            jornalId: jornalId,
            jornalNome: jornalNome,
            valor: valorPagamento, // Valor do jornal como fallback (o servidor vai usar o valor do paymentIntent se já existir)
            moeda: 'BRL',
            dataPagamento: new Date().toISOString()
        };
        
        // Tentar salvar no dashboard (o servidor vai verificar se já existe e atualizar valor se necessário)
        const dashboardPaths = [
            'http://localhost:3000/api/pagamentos',
            '/api/pagamentos'
        ];
        
        for (const path of dashboardPaths) {
            try {
                const response = await fetch(path, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(paymentData),
                    mode: 'cors'
                });
                
                if (response.ok) {
                    const result = await response.json().catch(() => ({}));
                    console.log('✅ Pagamento salvo/verificado no dashboard:', result);
                    // Se o pagamento já existia, o servidor retorna o existente com o valor correto
                    return;
                } else {
                    const errorText = await response.text().catch(() => '');
                    console.log('⚠️ Erro ao salvar pagamento no dashboard:', response.status, errorText);
                }
            } catch (err) {
                console.log('⚠️ Erro ao conectar com dashboard:', err.message);
                continue;
            }
        }
    } catch (error) {
        console.error('Erro ao salvar pagamento no dashboard:', error);
    }
}

/**
 * Carrega informações do produto
 */
async function loadProductInfo(productId) {
    try {
        if (productId.startsWith('jornal_')) {
            const jornalId = productId.replace('jornal_', '');
            
            // Buscar jornais da API principal
            const apiPaths = [
                'http://localhost:3000/api/jornais',
                '/api/jornais',
                'http://127.0.0.1:3000/api/jornais'
            ];
            
            for (const path of apiPaths) {
                try {
                    const response = await fetch(path);
                    if (response.ok) {
                        const data = await response.json();
                        const jornais = data.jornais || data || [];
                        const jornal = jornais.find(j => j.id === parseInt(jornalId) || j.id === jornalId);
                        
                        if (jornal) {
                            // Armazenar dados do jornal para uso no download
                            jornalData = jornal;
                            
                            const productName = jornal.nome || `Jornal ${jornal.mes} ${jornal.ano}`;
                            document.getElementById('productName').textContent = productName;
                            return;
                        }
                    }
                } catch (err) {
                    continue;
                }
            }
        }
        
        // Fallback para nome padrão
        document.getElementById('productName').textContent = 'Jornal do Reino dos Céus';
        
    } catch (error) {
        console.error('Erro ao carregar informações do produto:', error);
        document.getElementById('productName').textContent = 'Jornal do Reino dos Céus';
    }
}

/**
 * Configura o botão de download
 */
function setupDownloadButton() {
    const downloadButton = document.getElementById('downloadButton');
    const downloadHint = document.getElementById('downloadHint');
    
    if (!downloadButton) {
        console.error('Botão de download não encontrado!');
        return;
    }
    
    downloadButton.addEventListener('click', async () => {
        try {
            downloadButton.disabled = true;
            downloadButton.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i><span>Baixando...</span>';
            
            // Buscar link de download
            const downloadUrl = await getDownloadLink();
            
            if (downloadUrl) {
                // Fazer download
                window.location.href = downloadUrl;
                
                // Atualizar botão após download
                setTimeout(() => {
                    downloadButton.disabled = false;
                    downloadButton.innerHTML = '<i class="bx bx-check-circle"></i><span>Download Concluído!</span>';
                    downloadButton.style.background = 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
                    downloadButton.style.color = '#FFFFFF';
                    
                    if (downloadHint) {
                        downloadHint.textContent = 'Download iniciado! Verifique sua pasta de downloads.';
                        downloadHint.style.color = '#10B981';
                    }
                }, 1000);
            } else {
                throw new Error('Link de download não disponível');
            }
            
        } catch (error) {
            console.error('Erro ao fazer download:', error);
            downloadButton.disabled = false;
            downloadButton.innerHTML = '<i class="bx bx-download"></i><span>Fazer Download do PDF</span>';
            
            if (downloadHint) {
                downloadHint.textContent = 'Erro ao fazer download. Por favor, entre em contato: jornalreinodoseus@gmail.com';
                downloadHint.style.color = '#EF4444';
            }
        }
    });
}

/**
 * Obtém link de download
 */
async function getDownloadLink() {
    try {
        // Tentar buscar link de download da API
        if (paymentIntentId && productId) {
            const response = await fetch(`/api/download?payment_intent=${paymentIntentId}&product=${productId}`, {
                method: 'GET',
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.downloadUrl) {
                    return data.downloadUrl;
                }
            }
        }
        
        // Se já temos os dados do jornal carregados, usar eles
        if (jornalData && jornalData.pdf) {
            let pdfPath = jornalData.pdf;
            // Se começar com /uploads, já está correto para o servidor principal
            if (pdfPath.startsWith('/uploads/')) {
                // Usar o caminho do servidor principal (porta 3000)
                console.log('✅ Usando PDF do jornal:', pdfPath);
                return `http://localhost:3000${pdfPath}`;
            } else if (pdfPath.startsWith('http://') || pdfPath.startsWith('https://')) {
                // URL completa
                console.log('✅ Usando PDF do jornal (URL completa):', pdfPath);
                return pdfPath;
            } else {
                // Caminho relativo, assumir que está em /uploads/pdfs/
                console.log('✅ Usando PDF do jornal (relativo):', pdfPath);
                return `http://localhost:3000/uploads/pdfs/${pdfPath}`;
            }
        }
        
        // Fallback: tentar buscar PDF baseado no productId
        if (productId && productId.startsWith('jornal_')) {
            const jornalId = productId.replace('jornal_', '');
            
            // Buscar informações do jornal para encontrar o PDF correto
            try {
                const apiPaths = [
                    'http://localhost:3000/api/jornais',
                    '/api/jornais',
                    'http://127.0.0.1:3000/api/jornais'
                ];
                
                for (const apiPath of apiPaths) {
                    try {
                        const jornaisResponse = await fetch(apiPath);
                        if (jornaisResponse.ok) {
                            const jornaisData = await jornaisResponse.json();
                            const jornais = jornaisData.jornais || jornaisData || [];
                            const jornal = jornais.find(j => j.id === parseInt(jornalId) || j.id === jornalId);
                            
                            if (jornal) {
                                // Armazenar para uso futuro
                                jornalData = jornal;
                                
                                // Se o jornal tem um campo PDF específico, usar ele
                                if (jornal.pdf) {
                                    let pdfPath = jornal.pdf;
                                    if (pdfPath.startsWith('/uploads/')) {
                                        console.log('✅ PDF encontrado do jornal:', pdfPath);
                                        return `http://localhost:3000${pdfPath}`;
                                    } else if (pdfPath.startsWith('http://') || pdfPath.startsWith('https://')) {
                                        return pdfPath;
                                    } else {
                                        return `http://localhost:3000/uploads/pdfs/${pdfPath}`;
                                    }
                                }
                                
                                // Se não tem PDF específico, tentar padrão baseado em mês/ano
                                if (jornal.mes && jornal.ano) {
                                    const mes = jornal.mes.toUpperCase();
                                    const ano = jornal.ano.toString().slice(-2);
                                    const pdfPaths = [
                                        `http://localhost:3000/download/JORNAL_DE_${mes}_${ano}.pdf`,
                                        `/checkout/download/JORNAL_DE_${mes}_${ano}.pdf`,
                                        `/download/JORNAL_DE_${mes}_${ano}.pdf`
                                    ];
                                    return pdfPaths[0];
                                }
                            }
                            break; // Se encontrou a API, não precisa tentar outras
                        }
                    } catch (err) {
                        console.log(`Erro ao buscar de ${apiPath}:`, err.message);
                        continue;
                    }
                }
            } catch (err) {
                console.log('Erro ao buscar informações do jornal:', err.message);
            }
            
            // Fallback: tentar diferentes caminhos possíveis baseados no ID
            const downloadPaths = [
                `http://localhost:3000/uploads/pdfs/jornal-${jornalId}.pdf`,
                `/uploads/pdfs/jornal-${jornalId}.pdf`,
                `/download/jornal-${jornalId}.pdf`,
                `/checkout/download/jornal-${jornalId}.pdf`
            ];
            
            // Verificar qual caminho funciona
            for (const path of downloadPaths) {
                try {
                    const testResponse = await fetch(path, { method: 'HEAD' });
                    if (testResponse.ok || testResponse.status === 200) {
                        console.log('✅ PDF encontrado em:', path);
                        return path;
                    }
                } catch (err) {
                    continue;
                }
            }
        }
        
        // Último fallback: download genérico
        return 'http://localhost:3000/download/JORNAL_DE_JANEIRO_24.pdf';
        
    } catch (error) {
        console.error('Erro ao obter link de download:', error);
        return null;
    }
}

/**
 * Tenta download automático
 */
async function attemptAutoDownload() {
    try {
        const downloadUrl = await getDownloadLink();
        
        if (downloadUrl) {
            // Verificar se o navegador permite download automático
            const downloadHint = document.getElementById('downloadHint');
            
            if (downloadHint) {
                // Tentar download automático
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = 'Jornal_Reino_dos_Ceus.pdf';
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                downloadHint.textContent = 'Download automático iniciado! Verifique sua pasta de downloads.';
                downloadHint.style.color = '#10B981';
                
                // Atualizar botão
                const downloadButton = document.getElementById('downloadButton');
                if (downloadButton) {
                    downloadButton.innerHTML = '<i class="bx bx-check-circle"></i><span>Download Iniciado</span>';
                    downloadButton.style.background = 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
                    downloadButton.style.color = '#FFFFFF';
                }
            }
        }
    } catch (error) {
        console.log('Download automático não foi possível. O usuário pode fazer download manual.');
    }
}
