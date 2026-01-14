const express = require("express");
const path = require("path");
const app = express();
require('dotenv').config();
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const cors = require('cors');


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

app.get("/", (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Servir o gerador
app.use('/gerador', express.static(path.join(__dirname, "gerador", "public")));

app.get("/gerador", (req, res) => {
  res.sendFile(path.join(__dirname, "gerador", "public", "index.html"));
});

// Servir arquivos estáticos do checkout PRIMEIRO (CSS, JS, imagens, etc)
// IMPORTANTE: Esta linha DEVE vir ANTES da rota GET /checkout para servir arquivos estáticos
app.use('/checkout', express.static(path.join(__dirname, "checkout", "public")));

// Rota específica para checkout.html DEPOIS do static (ordem é crítica!)
app.get("/checkout", (req, res) => {
  // Verificar se é uma requisição para arquivo estático (tem extensão)
  if (req.path.includes('.')) {
    return res.status(404).send('Arquivo não encontrado');
  }
  
  const filePath = path.join(__dirname, "checkout", "public", "checkout.html");
  console.log('📄 Servindo checkout.html de:', filePath);
  console.log('📍 URL requisitada:', req.url);
  console.log('📍 Query params:', req.query);
  
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
            <p><strong>Diretório atual:</strong> ${__dirname}</p>
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
  console.log('📍 URL requisitada:', req.url);
  console.log('📍 Query params:', req.query);
  
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
            <p><strong>Diretório atual:</strong> ${__dirname}</p>
          </body>
        </html>
      `);
    } else {
      console.log('✅ success.html servido com sucesso');
    }
  });
});










//GERADOR DE CODIGO
// CORS para o site do jornal
app.use(cors({
  origin: ['http://localhost:3000'],
  credentials: true
}));

app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'troque_para_uma_coisa_secreta',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    maxAge: 1000 * 60 * 60
  }
}));

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

// Login ADMIN
app.post('/api/login', async (req, res) => {
  const { user, pass } = req.body;
  const adminUser = process.env.ADMIN_USER;
  const adminPassHash = process.env.ADMIN_PASS_HASH;

  if (!adminUser || !adminPassHash) {
    return res.status(500).json({error:'Servidor mal configurado'});
  }

  if (user !== adminUser) {
    return res.status(401).json({error:'Usuário ou senha incorretos'});
  }

  const ok = await bcrypt.compare(pass, adminPassHash);
  if (!ok) return res.status(401).json({error:'Usuário ou senha incorretos'});

  req.session.authenticated = true;
  req.session.user = adminUser;
  res.json({ok:true});
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    res.json({ok:true});
  });
});

// API para obter jornais (público)
app.get('/api/jornais', async (req, res) => {
  try {
    console.log('Requisição para /api/jornais recebida');
    const exists = await fs.pathExists(JORNAIS_FILE);
    if (!exists) {
      console.log('Arquivo jornais.json não existe, retornando array vazio');
      return res.json({ jornais: [] });
    }
    const data = await fs.readJson(JORNAIS_FILE);
    console.log('Total de jornais no arquivo:', data.jornais?.length || 0);
    
    // Retorna apenas jornais ativos, ordenados por ordem
    const jornaisAtivos = (data.jornais || [])
      .filter(j => j.ativo !== false)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    
    console.log('Jornais ativos retornados:', jornaisAtivos.length);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({ jornais: jornaisAtivos });
  } catch (error) {
    console.error('Erro ao ler jornais:', error);
    res.status(500).json({ error: 'Erro ao carregar jornais', details: error.message });
  }
});

// Proxy para APIs do servidor de checkout
const http = require('http');

// API para obter carrossel (público) - proxy para dashboard-server
app.get('/api/site/carrossel', async (req, res) => {
  try {
    // Fazer proxy para o dashboard-server na porta 5000
    const dashboardUrl = 'http://localhost:5000/api/site/carrossel';
    
    const proxyRequest = http.get(dashboardUrl, (proxyResponse) => {
      let data = '';
      proxyResponse.on('data', (chunk) => {
        data += chunk;
      });
      proxyResponse.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.json(jsonData);
        } catch (err) {
          console.error('Erro ao parsear resposta do carrossel:', err);
          res.status(500).json({ error: 'Erro ao carregar carrossel' });
        }
      });
    });
    
    proxyRequest.on('error', (err) => {
      console.error('Erro ao conectar com servidor de dashboard:', err.message);
      // Retornar array vazio se servidor dashboard não estiver rodando
      res.json([]);
    });
  } catch (error) {
    console.error('Erro no proxy carrossel:', error);
    res.status(500).json({ error: 'Erro ao carregar carrossel' });
  }
});

// Rota proxy para responsáveis
app.get('/api/site/responsaveis', async (req, res) => {
  try {
    const dashboardUrl = 'http://localhost:5000/api/site/responsaveis';
    
    const proxyRequest = http.get(dashboardUrl, (proxyResponse) => {
      let data = '';
      proxyResponse.on('data', (chunk) => {
        data += chunk;
      });
      proxyResponse.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.json(jsonData);
        } catch (err) {
          console.error('Erro ao parsear resposta dos responsáveis:', err);
          res.status(500).json({ error: 'Erro ao carregar responsáveis' });
        }
      });
    });
    
    proxyRequest.on('error', (err) => {
      console.error('Erro ao conectar com servidor de dashboard:', err.message);
      // Retornar array vazio se servidor dashboard não estiver rodando
      res.json([]);
    });
  } catch (error) {
    console.error('Erro no proxy responsáveis:', error);
    res.status(500).json({ error: 'Erro ao carregar responsáveis' });
  }
});

// Rota proxy para Notícias
app.get('/api/site/noticias', async (req, res) => {
  try {
    const dashboardUrl = 'http://localhost:5000/api/noticias';
    
    const proxyRequest = http.get(dashboardUrl, (proxyResponse) => {
      let data = '';
      proxyResponse.on('data', (chunk) => {
        data += chunk;
      });
      proxyResponse.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.json(jsonData);
        } catch (err) {
          console.error('Erro ao parsear resposta das notícias:', err);
          res.status(500).json({ error: 'Erro ao carregar notícias' });
        }
      });
    });
    
    proxyRequest.on('error', (err) => {
      console.error('Erro ao conectar com servidor de dashboard:', err.message);
      res.status(500).json({ error: 'Erro ao carregar notícias' });
    });
  } catch (error) {
    console.error('Erro no proxy notícias:', error);
    res.status(500).json({ error: 'Erro ao carregar notícias' });
  }
});

// Rota proxy para Banner Modal
app.get('/api/site/banner-modal', async (req, res) => {
  try {
    const dashboardUrl = 'http://localhost:5000/api/site/banner-modal';
    
    const proxyRequest = http.get(dashboardUrl, (proxyResponse) => {
      let data = '';
      proxyResponse.on('data', (chunk) => {
        data += chunk;
      });
      proxyResponse.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.json(jsonData);
        } catch (err) {
          console.error('Erro ao parsear resposta do banner modal:', err);
          res.status(500).json({ error: 'Erro ao carregar banner modal' });
        }
      });
    });
    
    proxyRequest.on('error', (err) => {
      console.error('Erro ao conectar com servidor de dashboard:', err.message);
      res.status(500).json({ error: 'Erro ao carregar banner modal' });
    });
  } catch (error) {
    console.error('Erro no proxy banner modal:', error);
    res.status(500).json({ error: 'Erro ao carregar banner modal' });
  }
});

// Rota proxy para Carrossel Médio
app.get('/api/site/carrossel-medio', async (req, res) => {
  try {
    const dashboardUrl = 'http://localhost:5000/api/site/carrossel-medio';
    
    const proxyRequest = http.get(dashboardUrl, (proxyResponse) => {
      let data = '';
      proxyResponse.on('data', (chunk) => {
        data += chunk;
      });
      proxyResponse.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.json(jsonData);
        } catch (err) {
          console.error('Erro ao parsear resposta do carrossel médio:', err);
          res.status(500).json({ error: 'Erro ao carregar carrossel médio' });
        }
      });
    });
    
    proxyRequest.on('error', (err) => {
      console.error('Erro ao conectar com servidor de dashboard:', err.message);
      res.json([]);
    });
  } catch (error) {
    console.error('Erro no proxy carrossel médio:', error);
    res.status(500).json({ error: 'Erro ao carregar carrossel médio' });
  }
});

// Rota proxy para Textos
app.get('/api/site/textos', async (req, res) => {
  try {
    const dashboardUrl = 'http://localhost:5000/api/site/textos';
    
    const proxyRequest = http.get(dashboardUrl, (proxyResponse) => {
      let data = '';
      proxyResponse.on('data', (chunk) => {
        data += chunk;
      });
      proxyResponse.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.json(jsonData);
        } catch (err) {
          console.error('Erro ao parsear resposta dos textos:', err);
          res.status(500).json({ error: 'Erro ao carregar textos' });
        }
      });
    });
    
    proxyRequest.on('error', (err) => {
      console.error('Erro ao conectar com servidor de dashboard:', err.message);
      res.status(500).json({ error: 'Erro ao carregar textos' });
    });
  } catch (error) {
    console.error('Erro no proxy textos:', error);
    res.status(500).json({ error: 'Erro ao carregar textos' });
  }
});

// Rota proxy para Vídeo
app.get('/api/site/video', async (req, res) => {
  try {
    const dashboardUrl = 'http://localhost:5000/api/site/video';
    
    const proxyRequest = http.get(dashboardUrl, (proxyResponse) => {
      let data = '';
      proxyResponse.on('data', (chunk) => {
        data += chunk;
      });
      proxyResponse.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.json(jsonData);
        } catch (err) {
          console.error('Erro ao parsear resposta do vídeo:', err);
          res.status(500).json({ error: 'Erro ao carregar vídeo' });
        }
      });
    });
    
    proxyRequest.on('error', (err) => {
      console.error('Erro ao conectar com servidor de dashboard:', err.message);
      // Retornar objeto vazio se servidor dashboard não estiver rodando
      res.json({ url: '', titulo: '', subtitulo: '', ativo: false });
    });
  } catch (error) {
    console.error('Erro no proxy vídeo:', error);
    res.status(500).json({ error: 'Erro ao carregar vídeo' });
  }
});

app.get('/api/site/faq', async (req, res) => {
  try {
    const dashboardUrl = 'http://localhost:5000/api/site/faq';
    
    const proxyRequest = http.get(dashboardUrl, (proxyResponse) => {
      let data = '';
      proxyResponse.on('data', (chunk) => {
        data += chunk;
      });
      proxyResponse.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.json(jsonData);
        } catch (err) {
          console.error('Erro ao parsear resposta do FAQ:', err);
          res.status(500).json({ error: 'Erro ao carregar FAQ' });
        }
      });
    });
    
    proxyRequest.on('error', (err) => {
      console.error('Erro ao conectar com servidor de dashboard:', err.message);
      // Retornar array vazio se servidor dashboard não estiver rodando
      res.json([]);
    });
  } catch (error) {
    console.error('Erro no proxy FAQ:', error);
    res.status(500).json({ error: 'Erro ao carregar FAQ' });
  }
});

// Rota proxy para colunistas
app.get('/api/site/colunistas', async (req, res) => {
  try {
    const dashboardUrl = 'http://localhost:5000/api/colunistas';
    
    const proxyRequest = http.get(dashboardUrl, (proxyResponse) => {
      let data = '';
      proxyResponse.on('data', (chunk) => {
        data += chunk;
      });
      proxyResponse.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.json(jsonData);
        } catch (err) {
          console.error('Erro ao parsear resposta dos colunistas:', err);
          res.status(500).json({ error: 'Erro ao carregar colunistas' });
        }
      });
    });
    
    proxyRequest.on('error', (err) => {
      console.error('Erro ao conectar com servidor de dashboard:', err.message);
      // Retornar array vazio se servidor dashboard não estiver rodando
      res.json({ colunistas: [] });
    });
  } catch (error) {
    console.error('Erro no proxy colunistas:', error);
    res.status(500).json({ error: 'Erro ao carregar colunistas' });
  }
});

// Rota proxy para configuração do Stripe
app.get('/api/stripe-config', async (req, res) => {
  try {
    // Tentar buscar do servidor do checkout (porta 4242)
    const checkoutUrl = 'http://localhost:4242/api/stripe-config';
    
    const proxyRequest = http.request({
      hostname: 'localhost',
      port: 4242,
      path: '/api/stripe-config',
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }, (proxyResponse) => {
      let data = '';
      proxyResponse.on('data', (chunk) => {
        data += chunk;
      });
      proxyResponse.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.json(jsonData);
        } catch (err) {
          console.error('Erro ao parsear resposta do checkout:', err);
          res.status(500).json({ 
            error: 'Erro ao obter configuração do Stripe',
            publishableKey: ''
          });
        }
      });
    });
    
    proxyRequest.on('error', (err) => {
      console.error('Erro ao conectar com servidor de checkout:', err.message);
      // Retornar resposta vazia se servidor checkout não estiver rodando
      res.json({ 
        publishableKey: '',
        error: 'Servidor de checkout não disponível'
      });
    });
    
    proxyRequest.end();
  } catch (error) {
    console.error('Erro no proxy stripe-config:', error);
    res.status(500).json({ 
      error: 'Erro ao obter configuração do Stripe',
      publishableKey: ''
    });
  }
});

// Rota proxy para criar Payment Intent
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const requestData = JSON.stringify(req.body);
    
    const proxyRequest = http.request({
      hostname: 'localhost',
      port: 4242,
      path: '/api/create-payment-intent',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
      }
    }, (proxyResponse) => {
      let data = '';
      proxyResponse.on('data', (chunk) => {
        data += chunk;
      });
      proxyResponse.on('end', () => {
        try {
          res.status(proxyResponse.statusCode).json(JSON.parse(data));
        } catch (err) {
          console.error('Erro ao parsear resposta do checkout:', err);
          res.status(500).json({ 
            error: 'Erro ao criar pagamento',
            message: err.message
          });
        }
      });
    });
    
    proxyRequest.on('error', (err) => {
      console.error('Erro ao conectar com servidor de checkout:', err.message);
      res.status(503).json({ 
        error: 'Servidor de checkout não disponível',
        message: 'O servidor de checkout não está rodando. Inicie-o na porta 4242.'
      });
    });
    
    proxyRequest.write(requestData);
    proxyRequest.end();
  } catch (error) {
    console.error('Erro no proxy create-payment-intent:', error);
    res.status(500).json({ 
      error: 'Erro ao criar pagamento',
      message: error.message
    });
  }
});

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


// Rotas ADMIN
function requireAuth(req, res, next){
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({error: 'Não autenticado'});
}

app.get('/api/admin/codigos', requireAuth, async (req, res) => {
  const db = await readDB();
  res.json({codigosPremiados: db.codigosPremiados, codigosUsados: db.codigosUsados});
});

async function listarCodigos() {
  const res = await fetch('/api/admin/codigos', {
      credentials: 'include'
  });

  const data = await res.json();

  document.getElementById("listaCodigos").innerText =
      "Códigos ativos: " + data.codigosPremiados.join(", ");
}

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

async function listarCodigos() {
  try {
      const res = await fetch('/api/admin/codigos', {
          credentials: 'include'
      });

      const data = await res.json();

      document.getElementById("listaCodigos").innerHTML =
          "<strong>Códigos ativos:</strong> " + 
          (data.codigosPremiados.length ? data.codigosPremiados.join(", ") : "Nenhum.");
  } catch (err) {
      console.error(err);
      alert("Erro ao carregar códigos");
  }
}

// Porta 3000 (JORNAL)
app.listen(3000, () => {
  console.log("Site do Jornal rodando em http://localhost:3000");
});

