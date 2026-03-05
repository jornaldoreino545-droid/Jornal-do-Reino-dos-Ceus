const express = require('express');
const router = express.Router();

// Rota para obter configuração do Stripe (chave pública)
router.get('/api/stripe-config', (req, res) => {
    res.json({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || ''
    });
});

// Rota de jornais removida - agora usa a rota principal /api/jornais do servidor unificado

// Rota para criar Payment Intent
router.post('/api/create-payment-intent', async (req, res) => {
  try {
    // Verificar se Stripe está configurado
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY não configurada no .env');
      return res.status(500).json({ 
        error: 'Sistema de pagamento não configurado',
        message: 'Configure STRIPE_SECRET_KEY no arquivo .env'
      });
    }
    
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const { amount, currency, productId, productName, customerName, customerEmail, santuario, souNovoSantuario } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({ error: 'Amount e currency são obrigatórios' });
    }
    
    console.log('💰 Criando Payment Intent:', { amount, currency, productId, productName, santuario: santuario || '(vazio)', souNovoSantuario });

    // Criar Payment Intent (Stripe metadata limita valores a 500 chars cada)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      metadata: {
        productId: (productId || '').toString(),
        productName: (productName || '').toString().slice(0, 499),
        customerName: (customerName || '').toString().slice(0, 499),
        customerEmail: (customerEmail || '').toString().slice(0, 499),
        santuario: (santuario || '').toString().slice(0, 499),
        souNovoSantuario: (souNovoSantuario === 'sim' || souNovoSantuario === true) ? 'sim' : 'não'
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log('✅ Payment Intent criado:', paymentIntent.id);
    
    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Erro ao criar Payment Intent:', error);
    res.status(500).json({ 
      error: 'Erro ao processar pagamento',
      message: error.message 
    });
  }
});

// Rota para obter link de download
router.get('/api/download', async (req, res) => {
  try {
    const { payment_intent, product, santuario: santuarioQuery, souNovoSantuario: souNovoQuery } = req.query;

    if (!payment_intent || !product) {
      return res.status(400).json({ error: 'payment_intent e product são obrigatórios' });
    }

    // Verificar se Stripe está configurado
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY não configurada no .env');
      return res.status(500).json({ 
        error: 'Sistema de pagamento não configurado',
        message: 'Configure STRIPE_SECRET_KEY no arquivo .env'
      });
    }
    
    // Verificar status do pagamento com Stripe
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(403).json({ 
        error: 'Pagamento não confirmado',
        status: paymentIntent.status
      });
    }
    
    console.log('✅ Pagamento confirmado:', paymentIntent.id);

    // Salvar informações do pagamento no dashboard
    try {
      // Extrair jornalId do product
      let jornalId = paymentIntent.metadata.productId || '';
      if (!jornalId && product) {
        jornalId = product.startsWith('jornal_') ? product.replace('jornal_', '') : product;
      }
      
      // Garantir que o valor seja calculado corretamente
      const valorCalculado = paymentIntent.amount ? (paymentIntent.amount / 100) : 0;
      
      // Santuário: priorizar metadata do Stripe; se vazio, usar parâmetros da URL (enviados pela página de sucesso)
      const santuarioMeta = (paymentIntent.metadata && paymentIntent.metadata.santuario) ? String(paymentIntent.metadata.santuario).trim() : '';
      const santuarioFromUrl = (santuarioQuery != null && String(santuarioQuery).trim() !== '') ? decodeURIComponent(String(santuarioQuery).trim()) : '';
      const santuarioFinal = santuarioMeta || santuarioFromUrl || '';
      const souNovoMeta = paymentIntent.metadata && paymentIntent.metadata.souNovoSantuario === 'sim';
      const souNovoFromUrl = souNovoQuery === 'sim' || souNovoQuery === '1' || souNovoQuery === 'true';
      const souNovoSantuarioFinal = souNovoMeta || souNovoFromUrl ? 1 : 0;

      const paymentData = {
        paymentIntentId: paymentIntent.id,
        nome: paymentIntent.metadata.customerName || 'Cliente',
        email: paymentIntent.metadata.customerEmail || 'cliente@email.com',
        jornalId: jornalId || '1',
        jornalNome: paymentIntent.metadata.productName || 'Jornal do Reino dos Céus',
        valor: valorCalculado, // Converter de centavos para unidade
        moeda: (paymentIntent.currency || 'brl').toUpperCase(),
        dataPagamento: new Date().toISOString(),
        santuario: santuarioFinal,
        souNovoSantuario: souNovoSantuarioFinal
      };
      
      console.log('💰 Tentando salvar pagamento no dashboard:', paymentData);
      console.log('💰 PaymentIntent amount (centavos):', paymentIntent.amount);
      console.log('💰 Valor calculado (reais):', valorCalculado);
      
      // Usar URL do servidor atual (funciona em produção e desenvolvimento)
      // Forçar HTTPS em produção para evitar redirects
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : (req.protocol || (req.secure ? 'https' : 'http'));
      const host = req.get('host') || 'localhost:3000';
      const baseUrl = process.env.BASE_URL || `${protocol}://${host}`;
      const saveUrl = `${baseUrl}/api/pagamentos`;
      
      console.log('📡 Salvando pagamento em:', saveUrl);
      
      const url = require('url');
      const parsedUrl = url.parse(saveUrl);
      const postData = JSON.stringify(paymentData);
      
      await new Promise((resolve, reject) => {
        const makeRequest = (urlObj, isRedirect = false) => {
          const useHttps = urlObj.protocol === 'https:';
          const mod = useHttps ? require('https') : require('http');
          const port = urlObj.port || (useHttps ? 443 : (urlObj.hostname === 'localhost' ? 3000 : 80));
          const requestOptions = {
            hostname: urlObj.hostname || 'localhost',
            port: port,
            path: urlObj.path || '/api/pagamentos',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 10000
          };
          
          const saveRequest = mod.request(requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              // Seguir redirects 301, 302, 307, 308
              if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location) {
                console.log(`🔄 Seguindo redirect ${res.statusCode} para:`, res.headers.location);
                const redirectUrl = url.parse(res.headers.location);
                makeRequest(redirectUrl, true);
                return;
              }
              
              if (res.statusCode === 200 || res.statusCode === 201) {
                console.log('✅ Pagamento salvo no dashboard:', data);
                resolve(data);
              } else {
                console.error('❌ Erro ao salvar pagamento no dashboard:', res.statusCode, data);
                reject(new Error(`HTTP ${res.statusCode}: ${data || res.statusMessage || 'Unknown error'}`));
              }
            });
          });
          
          saveRequest.on('error', (err) => {
            console.error('❌ Erro ao conectar com dashboard para salvar pagamento:', err.message);
            reject(err);
          });
          
          saveRequest.on('timeout', () => {
            console.error('❌ Timeout ao salvar pagamento no dashboard');
            saveRequest.destroy();
            reject(new Error('Timeout'));
          });
          
          saveRequest.write(postData);
          saveRequest.end();
        };
        
        makeRequest(parsedUrl);
      });
    } catch (err) {
      console.error('❌ Erro ao salvar pagamento no dashboard:', err.message);
      console.error('❌ Stack:', err.stack);
    }

    // Buscar PDF baseado no product ID
    let downloadUrl = null;
    
    if (product.startsWith('jornal_')) {
      const jornalId = product.replace('jornal_', '');
      
      // Buscar informações do jornal para encontrar o PDF correspondente
      try {
        // Usar a mesma base URL do servidor
        // Forçar HTTPS em produção para evitar redirects
        const protocol = process.env.NODE_ENV === 'production' ? 'https' : (req.protocol || (req.secure ? 'https' : 'http'));
        const host = req.get('host') || 'localhost:3000';
        const baseUrl = process.env.BASE_URL || `${protocol}://${host}`;
        const jornaisUrl = `${baseUrl}/api/jornais`;
        
        console.log('📚 Buscando informações do jornal em:', jornaisUrl);
        
        const url = require('url');
        const parsedUrl = url.parse(jornaisUrl);
        const jornaisData = await new Promise((resolve, reject) => {
          const makeRequest = (urlObj) => {
            const useHttps = urlObj.protocol === 'https:';
            const httpModule = useHttps ? require('https') : require('http');
            const port = urlObj.port || (useHttps ? 443 : (urlObj.hostname === 'localhost' ? 3000 : 80));
            const httpReq = httpModule.request({
              hostname: urlObj.hostname || 'localhost',
              port: port,
              path: urlObj.path || '/api/jornais',
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              },
              timeout: 10000
            }, (res) => {
              let data = '';
              res.on('data', (chunk) => { data += chunk; });
              res.on('end', () => {
                // Seguir redirects 301, 302, 307, 308
                if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location) {
                  console.log(`🔄 Seguindo redirect ${res.statusCode} para:`, res.headers.location);
                  const redirectUrl = url.parse(res.headers.location);
                  makeRequest(redirectUrl);
                  return;
                }
                
                if (res.statusCode === 200) {
                  try {
                    resolve(JSON.parse(data));
                  } catch (err) {
                    reject(new Error('Erro ao parsear JSON: ' + err.message));
                  }
                } else {
                  reject(new Error(`HTTP ${res.statusCode}: ${data || res.statusMessage || 'Unknown error'}`));
                }
              });
            });
            
            httpReq.on('error', reject);
            httpReq.on('timeout', () => {
              httpReq.destroy();
              reject(new Error('Timeout'));
            });
            httpReq.end();
          };
          
          makeRequest(parsedUrl);
        });
        
        if (jornaisData && jornaisData.jornais) {
          const jornais = jornaisData.jornais || [];
          const jornal = jornais.find(j => j.id === parseInt(jornalId) || j.id === jornalId);
          
          if (jornal) {
            // Priorizar o campo pdf do jornal (caminho completo)
            if (jornal.pdf) {
              let pdfPath = jornal.pdf;
              if (pdfPath.startsWith('/api/pdfs/')) {
                downloadUrl = pdfPath; // PDF no banco (BLOB)
              } else if (pdfPath.startsWith('/uploads/')) {
                downloadUrl = pdfPath;
              } else if (pdfPath.startsWith('http://') || pdfPath.startsWith('https://')) {
                downloadUrl = pdfPath;
              } else {
                downloadUrl = `/uploads/pdfs/${pdfPath}`;
              }
              console.log('✅ PDF encontrado no campo pdf do jornal:', downloadUrl);
            } else if (jornal.mes && jornal.ano) {
              // Fallback: tentar encontrar PDF baseado no mês e ano (não recomendado)
              console.warn('⚠️ Jornal não tem campo pdf, usando fallback baseado em mês/ano');
              const mes = jornal.mes.toUpperCase();
              const ano = jornal.ano.toString().slice(-2);
              downloadUrl = `/download/JORNAL_DE_${mes}_${ano}.pdf`;
            }
          }
        }
      } catch (err) {
        console.error('❌ Erro ao buscar informações do jornal:', err.message);
      }
    }

    if (!downloadUrl) {
      return res.status(404).json({ 
        error: 'PDF não encontrado',
        message: 'O PDF do jornal não foi encontrado. Entre em contato com o suporte.'
      });
    }

    // Retornar URL de download protegida (que verifica pagamento antes de servir)
    const protectedUrl = `/api/download-file?payment_intent=${payment_intent}&file=${encodeURIComponent(downloadUrl)}`;
    res.json({ downloadUrl: protectedUrl });
  } catch (error) {
    console.error('Erro ao obter link de download:', error);
    res.status(500).json({ 
      error: 'Erro ao obter link de download',
      message: error.message 
    });
  }
});

module.exports = router;
