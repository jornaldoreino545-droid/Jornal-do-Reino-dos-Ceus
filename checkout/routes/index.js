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
    const { amount, currency, productId, productName, customerName, customerEmail } = req.body;

    if (!amount || !currency) {
      return res.status(400).json({ error: 'Amount e currency são obrigatórios' });
    }
    
    console.log('💰 Criando Payment Intent:', { amount, currency, productId, productName });

    // Criar Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      metadata: {
        productId: productId || '',
        productName: productName || '',
        customerName: customerName || '',
        customerEmail: customerEmail || ''
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
    const { payment_intent, product } = req.query;

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
      const http = require('http');
      
      // Extrair jornalId do product
      let jornalId = paymentIntent.metadata.productId || '';
      if (!jornalId && product) {
        jornalId = product.startsWith('jornal_') ? product.replace('jornal_', '') : product;
      }
      
      // Garantir que o valor seja calculado corretamente
      const valorCalculado = paymentIntent.amount ? (paymentIntent.amount / 100) : 0;
      
      const paymentData = {
        paymentIntentId: paymentIntent.id,
        nome: paymentIntent.metadata.customerName || 'Cliente',
        email: paymentIntent.metadata.customerEmail || 'cliente@email.com',
        jornalId: jornalId || '1',
        jornalNome: paymentIntent.metadata.productName || 'Jornal do Reino dos Céus',
        valor: valorCalculado, // Converter de centavos para unidade
        moeda: (paymentIntent.currency || 'brl').toUpperCase(),
        dataPagamento: new Date().toISOString()
      };
      
      console.log('💰 Tentando salvar pagamento no dashboard:', paymentData);
      console.log('💰 PaymentIntent amount (centavos):', paymentIntent.amount);
      console.log('💰 Valor calculado (reais):', valorCalculado);
      const postData = JSON.stringify(paymentData);
      
      const saveRequest = http.request({
        hostname: 'localhost',
        port: process.env.PORT || 3000,
        path: '/api/pagamentos',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 5000
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            console.log('✅ Pagamento salvo no dashboard:', data);
          } else {
            console.log('⚠️ Erro ao salvar pagamento no dashboard:', res.statusCode, data);
          }
        });
      });
      
      saveRequest.on('error', (err) => {
        console.log('⚠️ Erro ao conectar com dashboard para salvar pagamento:', err.message);
      });
      
      saveRequest.write(postData);
      saveRequest.end();
    } catch (err) {
      console.log('⚠️ Erro ao salvar pagamento no dashboard:', err.message);
    }

    // Buscar PDF baseado no product ID
    let downloadUrl = null;
    
    if (product.startsWith('jornal_')) {
      const jornalId = product.replace('jornal_', '');
      
      // Buscar informações do jornal para encontrar o PDF correspondente
      try {
        // Tentar buscar jornais da API principal usando http nativo
        const http = require('http');
        const jornaisData = await new Promise((resolve, reject) => {
          const req = http.request({
            hostname: 'localhost',
            port: process.env.PORT || 3000,
            path: '/api/jornais',
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch (err) {
                reject(err);
              }
            });
          });
          
          req.on('error', reject);
          req.end();
        });
        
        if (jornaisData && jornaisData.jornais) {
          const jornais = jornaisData.jornais || [];
          const jornal = jornais.find(j => j.id === parseInt(jornalId) || j.id === jornalId);
          
          if (jornal && jornal.mes && jornal.ano) {
            // Tentar encontrar PDF baseado no mês e ano
            const mes = jornal.mes.toUpperCase();
            const ano = jornal.ano.toString().slice(-2);
            // Usar caminho relativo ao servidor de checkout
            downloadUrl = `/download/JORNAL_DE_${mes}_${ano}.pdf`;
          }
        }
      } catch (err) {
        console.log('Erro ao buscar informações do jornal:', err.message);
      }
      
      // Fallback: tentar diferentes caminhos possíveis
      if (!downloadUrl) {
        const downloadPaths = [
          `/download/jornal-${jornalId}.pdf`,
          `/download/JORNAL_DE_JANEIRO_24.pdf`,
          `/download/JORNAL_DE_FEVEREIRO_24.pdf`,
          `/download/JORNAL_DE_MARÇO_24.pdf`,
        ];
        downloadUrl = downloadPaths[0];
      }
    }

    if (!downloadUrl) {
      return res.status(404).json({ error: 'PDF não encontrado' });
    }

    res.json({ downloadUrl });
  } catch (error) {
    console.error('Erro ao obter link de download:', error);
    res.status(500).json({ 
      error: 'Erro ao obter link de download',
      message: error.message 
    });
  }
});

module.exports = router;
