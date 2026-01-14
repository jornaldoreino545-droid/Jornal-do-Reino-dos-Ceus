const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();

// Middleware CORS - permitir requisições do próprio dashboard e do site principal
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Permitir requisições do mesmo domínio (localhost:5000) ou do site principal
  const allowedOrigins = [
    'http://localhost:5000',
    'http://localhost:3000',
    'http://localhost:4242',
    process.env.FRONTEND_URL
  ].filter(Boolean);
  
  if (!origin || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(bodyParser.json({ type: 'application/json' }));
app.use(bodyParser.urlencoded({ extended: true, type: 'application/x-www-form-urlencoded' }));

// IMPORTANTE: bodyParser.urlencoded deve vir ANTES do multer para não interferir
// Mas o multer gerencia multipart/form-data automaticamente

// Session - IMPORTANTE: deve vir ANTES das rotas mas DEPOIS do CORS
app.use(session({
  secret: process.env.SESSION_SECRET || 'dashboard-secret-key-change-in-production',
  resave: true, // Mudado para true para garantir que a sessão seja salva
  saveUninitialized: false,
  name: 'dashboard.sid', // Nome específico para o cookie
  cookie: {
    httpOnly: true,
    secure: false, // false para desenvolvimento (http)
    maxAge: 1000 * 60 * 60 * 24, // 24 horas
    sameSite: 'lax' // Permite cookies em requisições do mesmo site
  }
}));

// Middleware para garantir charset UTF-8 em todas as respostas JSON
app.use((req, res, next) => {
  // Interceptar res.json para adicionar charset UTF-8
  const originalJson = res.json;
  res.json = function(data) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson.call(this, data);
  };
  next();
});

// Servir arquivos estáticos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware para desabilitar cache em desenvolvimento
app.use((req, res, next) => {
    if (req.url.match(/\.(css|js|html)$/)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

// Servir arquivos estáticos com cache control e charset UTF-8
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: 0, // Desabilitar cache para desenvolvimento
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

// Rotas
app.use('/api', require('./routes'));

// Rota principal do dashboard
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Middleware de tratamento de erros (deve vir por último)
// IMPORTANTE: deve ter 4 parâmetros para ser reconhecido como error handler
app.use((err, req, res, next) => {
  console.error('=== ERRO NÃO TRATADO ===');
  console.error('Tipo:', err.constructor.name);
  console.error('Mensagem:', err.message);
  console.error('Stack:', err.stack);
  console.error('========================');
  
  // Sempre retornar JSON, nunca HTML
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(err.status || 500).json({ 
    error: err.message || 'Erro interno do servidor',
    details: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });
});

// 404 handler - retornar JSON para API e 404 silencioso para recursos estáticos
app.use((req, res) => {
  // Se for uma requisição de arquivo estático que não existe (js, css, png, etc)
  if (req.url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    // Retornar 404 sem corpo para recursos estáticos que não existem
    res.status(404).end();
    return;
  }
  // Para outras rotas, retornar JSON
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Porta
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Dashboard servidor rodando em http://localhost:${PORT}`);
});
