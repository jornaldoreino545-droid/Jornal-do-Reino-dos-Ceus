const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const routes = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 4242;

// Middlewares
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:4242'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos do checkout
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
app.use('/', routes);

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para checkout
app.get('/checkout', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'checkout.html'));
});

// Rota para página de sucesso
app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

// Servir arquivos de download (criar pasta se não existir)
const downloadPath = path.join(__dirname, 'public', 'download');
if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath, { recursive: true });
    console.log('📁 Pasta download criada:', downloadPath);
}

app.use('/download', express.static(downloadPath));
// Também servir através de /checkout/download para compatibilidade com servidor principal
app.use('/checkout/download', express.static(downloadPath));

// Inicializar servidor
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Servidor de checkout rodando em http://localhost:${PORT}`);
  console.log(`📚 Sistema de checkout pronto!`);
  console.log(`\n💡 URLs disponíveis:`);
  console.log(`   http://localhost:${PORT}/checkout?product=jornal_1`);
  console.log(`   http://localhost:${PORT}/success`);
  console.log(`\n📋 Configuração Stripe:`);
  const envPath = path.join(__dirname, '.env');
  console.log(`   Arquivo .env: ${fs.existsSync(envPath) ? '✅ Encontrado' : '❌ Não encontrado'} (${envPath})`);
  console.log(`   STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? '✅ Configurado (' + process.env.STRIPE_SECRET_KEY.substring(0, 12) + '...)' : '❌ Não configurado'}`);
  console.log(`   STRIPE_PUBLISHABLE_KEY: ${process.env.STRIPE_PUBLISHABLE_KEY ? '✅ Configurado (' + process.env.STRIPE_PUBLISHABLE_KEY.substring(0, 12) + '...)' : '❌ Não configurado'}`);
  console.log(`\n📁 Diretórios:`);
  console.log(`   Pasta pública: ${path.join(__dirname, 'public')}`);
  console.log(`   Pasta download: ${downloadPath}`);
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
