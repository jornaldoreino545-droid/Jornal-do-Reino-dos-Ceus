// Primeiros logs para aparecer no Dokploy (se o container rodar este arquivo)
console.log('=== JORNAL APP INICIANDO ===');
console.log('Diretório:', process.cwd());
console.log('Node:', process.version);

const express = require("express");
const path = require("path");
const app = express();
require('dotenv').config();
console.log('Express e dotenv carregados');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const cors = require('cors');

// ==================== MIDDLEWARES GLOBAIS ====================

// CORS - permitir requisições de múltiplas origens
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:4242', 'http://localhost:5000'],
  credentials: true
}));

// Body parser
app.use(bodyParser.json({ type: 'application/json' }));
app.use(bodyParser.urlencoded({ extended: true, type: 'application/x-www-form-urlencoded' }));

// Middleware para logar TODAS as requisições (para debug)
app.use((req, res, next) => {
  if (req.method === 'POST' && (req.path.includes('/login') || req.path.includes('/api/login'))) {
    console.log('\n\n🚨🚨🚨 REQUISIÇÃO POST DETECTADA (MIDDLEWARE GLOBAL) 🚨🚨🚨');
    console.log('📥 Método:', req.method);
    console.log('📥 Path:', req.path);
    console.log('📥 URL original:', req.originalUrl);
    console.log('📥 Body:', JSON.stringify(req.body));
    console.log('🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨\n');
    console.log('⏭️ Passando para o próximo middleware...');
  }
  next();
});

// Session - IMPORTANTE: deve vir ANTES das rotas mas DEPOIS do CORS
app.use(session({
  secret: process.env.SESSION_SECRET || 'dashboard-secret-key-change-in-production',
  resave: true,
  saveUninitialized: false,
  name: 'dashboard.sid',
  cookie: {
    httpOnly: true,
    secure: false, // false para desenvolvimento (http)
    maxAge: 1000 * 60 * 60 * 24, // 24 horas
    sameSite: 'lax'
  }
}));

// Middleware para garantir charset UTF-8 em todas as respostas JSON
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function(data) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson.call(this, data);
  };
  next();
});

// Middleware para desabilitar cache em desenvolvimento
app.use((req, res, next) => {
  if (req.url.match(/\.(css|js|html)$/)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// ==================== SERVIÇO DE ARQUIVOS ESTÁTICOS ====================

// Servir site principal com charset UTF-8
app.use(express.static(path.join(__dirname, "public"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    }
  }
}));

// Servir uploads do dashboard-server (para as capas dos jornais)
app.use('/uploads', express.static(path.join(__dirname, "dashboard-server", "uploads")));

// Servir arquivos estáticos do dashboard
app.use('/dashboard', express.static(path.join(__dirname, 'dashboard-server', 'public'), {
  maxAge: 0,
  etag: false,
  lastModified: false,
  setHeaders: (res, filePath) => {
    if (filePath.match(/\.html$/)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filePath.match(/\.css$/)) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filePath.match(/\.js$/)) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Servir arquivos estáticos do checkout PRIMEIRO (CSS, JS, imagens, etc)
app.use('/checkout', express.static(path.join(__dirname, "checkout", "public")));

// Servir o gerador
app.use('/gerador', express.static(path.join(__dirname, "gerador", "public")));

// Servir arquivos de download (criar pasta se não existir)
const downloadPath = path.join(__dirname, 'checkout', 'public', 'download');
if (!fs.existsSync(downloadPath)) {
  fs.mkdirSync(downloadPath, { recursive: true });
  console.log('📁 Pasta download criada:', downloadPath);
}
app.use('/download', express.static(downloadPath));
app.use('/checkout/download', express.static(downloadPath));

// ==================== ROTAS DE PÁGINAS ====================

// Rota principal do site
app.get("/", (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Rota principal do dashboard (apenas para a rota exata, não para subcaminhos)
app.get(["/dashboard", "/dashboard/"], (req, res) => {
  // Verificar se é uma requisição para arquivo estático (tem extensão)
  if (req.path.includes('.')) {
    return res.status(404).send('Arquivo não encontrado');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(__dirname, 'dashboard-server', 'public', 'index.html'));
});

// Rota para verificar jornais no banco (ferramenta de diagnóstico)
app.get('/verificar-jornais', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(__dirname, 'verificar-jornais-via-api.html'));
});

// Servir o gerador
app.get("/gerador", (req, res) => {
  res.sendFile(path.join(__dirname, "gerador", "public", "index.html"));
});

// Rota específica para checkout.html
app.get("/checkout", (req, res) => {
  if (req.path.includes('.')) {
    return res.status(404).send('Arquivo não encontrado');
  }
  
  const filePath = path.join(__dirname, "checkout", "public", "checkout.html");
  console.log('📄 Servindo checkout.html de:', filePath);
  
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('❌ Erro ao servir checkout.html:', err);
      res.status(500).send(`
        <html>
          <head><title>Erro</title></head>
          <body style="font-family: Arial; padding: 2rem;">
            <h1>Erro ao carregar checkout</h1>
            <p><strong>Erro:</strong> ${err.message}</p>
            <p><strong>Caminho tentado:</strong> ${filePath}</p>
          </body>
        </html>
      `);
    } else {
      console.log('✅ checkout.html servido com sucesso');
    }
  });
});

// Rota para página de sucesso do checkout
app.get("/checkout/success", (req, res) => {
  const filePath = path.join(__dirname, "checkout", "public", "success.html");
  console.log('📄 Servindo success.html de:', filePath);
  
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('❌ Erro ao servir success.html:', err);
      res.status(500).send(`
        <html>
          <head><title>Erro</title></head>
          <body style="font-family: Arial; padding: 2rem;">
            <h1>Erro ao carregar página de sucesso</h1>
            <p><strong>Erro:</strong> ${err.message}</p>
            <p><strong>Caminho tentado:</strong> ${filePath}</p>
          </body>
        </html>
      `);
    } else {
      console.log('✅ success.html servido com sucesso');
    }
  });
});

// ==================== ROTA DE DOWNLOAD PROTEGIDA ====================
// Rota para servir PDFs após verificação de pagamento
app.get('/api/download-file', async (req, res) => {
  try {
    const { payment_intent, file } = req.query;
    
    if (!payment_intent || !file) {
      return res.status(400).json({ error: 'payment_intent e file são obrigatórios' });
    }
    
    // Verificar se Stripe está configurado
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY não configurada');
      return res.status(500).json({ error: 'Sistema de pagamento não configurado' });
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
    
    console.log('✅ Pagamento confirmado, servindo PDF:', file);
    
    const filePath = decodeURIComponent(file);
    
    // PDF armazenado no banco (BLOB) - /api/pdfs/:id
    if (filePath.startsWith('/api/pdfs/')) {
      const match = filePath.match(/^\/api\/pdfs\/(\d+)$/);
      if (!match) {
        return res.status(403).json({ error: 'ID de PDF inválido' });
      }
      const pdfId = parseInt(match[1], 10);
      try {
        const pool = require('./dashboard-server/config/database');
        const [rows] = await pool.execute('SELECT dados_pdf, nome_arquivo FROM pdfs WHERE id = ?', [pdfId]);
        if (!rows.length || !rows[0].dados_pdf) {
          return res.status(404).json({ error: 'PDF não encontrado no banco' });
        }
        const filename = rows[0].nome_arquivo || 'jornal.pdf';
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(rows[0].dados_pdf);
        return;
      } catch (dbErr) {
        console.error('❌ Erro ao buscar PDF no banco:', dbErr.message);
        return res.status(500).json({ error: 'Erro ao carregar PDF' });
      }
    }
    
    // PDF em disco - /uploads/pdfs/...
    if (filePath.includes('..') || !filePath.startsWith('/uploads/')) {
      return res.status(403).json({ error: 'Caminho de arquivo inválido' });
    }
    
    const fullPath = path.join(__dirname, 'dashboard-server', filePath);
    if (!await fs.pathExists(fullPath)) {
      console.error('❌ Arquivo não encontrado:', fullPath);
      return res.status(404).json({ error: 'O arquivo não está disponível no site. O PDF pode ter sido perdido após um deploy; use a opção de salvar PDF no banco.' });
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fullPath)}"`);
    res.sendFile(fullPath);
    
  } catch (error) {
    console.error('❌ Erro ao servir PDF:', error);
    res.status(500).json({ 
      error: 'Erro ao servir PDF',
      message: error.message 
    });
  }
});

// ==================== ROTAS DE API - SITE PRINCIPAL ====================
// (Colocadas antes das rotas do dashboard para ter prioridade nas rotas públicas)

const DB_FILE = path.join(__dirname, 'db.json');
const JORNAIS_FILE = path.join(__dirname, 'jornais.json');

// Funções DB
async function readDB(){
  const exists = await fs.pathExists(DB_FILE);
  if(!exists) {
    await fs.writeJson(DB_FILE, {codigosPremiados: [], codigosUsados: []}, {spaces:2});
  }
  return fs.readJson(DB_FILE);
}
async function writeDB(data){
  return fs.writeJson(DB_FILE, data, {spaces:2});
}

// Login ADMIN - REMOVIDO: Agora está no dashboard-server/routes/index.js
// A rota /api/login agora é gerenciada pelo dashboard que aceita email e password

// Logout (compatibilidade com rotas antigas)
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    res.json({ok:true});
  });
});

// As rotas do dashboard já estão montadas em /api, então rotas como:
// /api/jornais, /api/site/carrossel, /api/site/responsaveis, /api/noticias, etc.
// funcionam diretamente sem necessidade de proxy

// Verificar código (público)
app.post('/api/verificar', async (req, res) => {
  const { codigo } = req.body;
  if (!codigo) return res.status(400).json({error:'Código é obrigatório'});
  
  const db = await readDB();
  const code = codigo.trim().toUpperCase();

  if (db.codigosUsados.includes(code)) {
      return res.json({status:'usado'});
  }
  if (db.codigosPremiados.includes(code)) {
      db.codigosUsados.push(code);
      await writeDB(db);
      return res.json({status:'ganhou'});
  }
  return res.json({status:'nao'});
});

// ==================== ROTAS DE API - DASHBOARD ====================

let dashboardLoadError = null;
try {
  console.log('📦 Carregando rotas do dashboard...');
  const dashboardRoutes = require('./dashboard-server/routes');
  app.use('/api', dashboardRoutes);
  console.log('✅ Rotas do dashboard carregadas');
} catch (err) {
  dashboardLoadError = err;
  console.error('❌ ERRO ao carregar dashboard:', err.message);
  console.error(err.stack);
  app.use('/api', (req, res) => {
    res.status(503).json({
      error: 'API em manutenção',
      detalhe: process.env.NODE_ENV === 'production' ? 'Serviço temporariamente indisponível.' : err.message
    });
  });
}

// ==================== ROTAS DE API - CHECKOUT ====================

let checkoutLoadError = null;
try {
  console.log('📦 Carregando rotas do checkout...');
  const checkoutRoutes = require('./checkout/routes');
  app.use('/', checkoutRoutes);
  console.log('✅ Rotas do checkout carregadas');
} catch (err) {
  checkoutLoadError = err;
  console.error('❌ ERRO ao carregar checkout:', err.message);
  console.error(err.stack);
}

if (dashboardLoadError || checkoutLoadError) {
  console.log('⚠️  App subiu com erros. Site principal deve funcionar; API/checkout podem estar limitados.');
}

// ==================== ROTAS ADMIN ====================
function requireAuth(req, res, next){
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({error: 'Não autenticado'});
}

app.get('/api/admin/codigos', requireAuth, async (req, res) => {
  const db = await readDB();
  res.json({codigosPremiados: db.codigosPremiados, codigosUsados: db.codigosUsados});
});

// Adicionar código premiado
app.post('/api/admin/adicionar', requireAuth, async (req, res) => {
  const { novoCodigo } = req.body;

  if (!novoCodigo) {
    return res.status(400).json({ error: 'Código é obrigatório' });
  }

  const code = novoCodigo.trim().toUpperCase();
  const db = await readDB();

  if (!db.codigosPremiados.includes(code)) {
    db.codigosPremiados.push(code);
    await writeDB(db);
  }

  res.json({ ok: true });
});

app.post('/api/admin/apagar-usados', requireAuth, async (req, res) => {
  const db = await readDB();
  db.codigosUsados = [];
  await writeDB(db);
  res.json({ok:true});
});

app.post('/api/admin/limpar-tudo', requireAuth, async (req, res) => {
  const db = await readDB();
  db.codigosPremiados = [];
  db.codigosUsados = [];
  await writeDB(db);
  res.json({ok:true});
});

// ==================== TRATAMENTO DE ERROS ====================

// Middleware de tratamento de erros (deve vir por último)
app.use((err, req, res, next) => {
  console.error('=== ERRO NÃO TRATADO ===');
  console.error('Tipo:', err.constructor.name);
  console.error('Mensagem:', err.message);
  console.error('Stack:', err.stack);
  console.error('========================');
  
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(err.status || 500).json({ 
    error: err.message || 'Erro interno do servidor',
    details: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });
});

// 404 handler
app.use((req, res) => {
  // Se for uma requisição de arquivo estático que não existe
  if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    res.status(404).end();
    return;
  }
  // Para outras rotas, retornar JSON
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ==================== INICIALIZAÇÃO DO SERVIDOR ====================

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Servidor unificado rodando em http://localhost:${PORT}`);
  console.log(`📚 Sistema completo pronto!`);
  console.log(`\n💡 URLs disponíveis:`);
  console.log(`   Site principal: http://localhost:${PORT}/`);
  console.log(`   Dashboard: http://localhost:${PORT}/dashboard`);
  console.log(`   Checkout: http://localhost:${PORT}/checkout?product=jornal_1`);
  console.log(`   Sucesso: http://localhost:${PORT}/checkout/success`);
  console.log(`   Gerador: http://localhost:${PORT}/gerador`);
  console.log(`\n📋 Configuração:`);
  const envPath = path.join(__dirname, '.env');
  console.log(`   Arquivo .env: ${fs.existsSync(envPath) ? '✅ Encontrado' : '❌ Não encontrado'}`);
  if (process.env.STRIPE_SECRET_KEY) {
    console.log(`   STRIPE_SECRET_KEY: ✅ Configurado (${process.env.STRIPE_SECRET_KEY.substring(0, 12)}...)`);
  } else {
    console.log(`   STRIPE_SECRET_KEY: ❌ Não configurado`);
  }
  if (process.env.STRIPE_PUBLISHABLE_KEY) {
    console.log(`   STRIPE_PUBLISHABLE_KEY: ✅ Configurado (${process.env.STRIPE_PUBLISHABLE_KEY.substring(0, 12)}...)`);
  } else {
    console.log(`   STRIPE_PUBLISHABLE_KEY: ❌ Não configurado`);
  }
  console.log(`\n📁 Diretórios:`);
  console.log(`   Pasta pública: ${path.join(__dirname, 'public')}`);
  console.log(`   Pasta download: ${downloadPath}`);
  console.log(`   Pasta uploads: ${path.join(__dirname, 'dashboard-server', 'uploads')}`);
  console.log(`\n`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n❌ Erro: A porta ${PORT} já está em uso!`);
    console.error(`\n💡 Soluções:`);
    console.error(`   1. Feche o processo que está usando a porta ${PORT}`);
    console.error(`   2. Ou altere a porta no arquivo .env (PORT=3001)`);
    console.error(`\n🔍 Para encontrar o processo no Windows:`);
    console.error(`   netstat -ano | findstr :${PORT}`);
    console.error(`   taskkill /PID <PID> /F`);
    process.exit(1);
  } else {
    console.error('❌ Erro ao iniciar servidor:', error);
    throw error;
  }
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Erro não tratado:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Exceção não capturada:', err);
  process.exit(1);
});
