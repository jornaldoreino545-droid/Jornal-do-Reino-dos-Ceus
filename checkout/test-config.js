// Script para testar configuração do checkout
require('dotenv').config();
const path = require('path');
const fs = require('fs');

console.log('🔍 Verificando configuração do checkout...\n');

// Verificar arquivo .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    console.log('✅ Arquivo .env encontrado');
} else {
    console.log('❌ Arquivo .env NÃO encontrado em:', envPath);
    console.log('   Crie o arquivo .env na pasta checkout/ com:');
    console.log('   STRIPE_SECRET_KEY=sk_test_...');
    console.log('   STRIPE_PUBLISHABLE_KEY=pk_test_...');
    console.log('   PORT=4242');
}

// Verificar variáveis de ambiente
console.log('\n📋 Variáveis de ambiente:');
console.log(`   STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? '✅ Configurado (' + process.env.STRIPE_SECRET_KEY.substring(0, 10) + '...)' : '❌ Não configurado'}`);
console.log(`   STRIPE_PUBLISHABLE_KEY: ${process.env.STRIPE_PUBLISHABLE_KEY ? '✅ Configurado (' + process.env.STRIPE_PUBLISHABLE_KEY.substring(0, 10) + '...)' : '❌ Não configurado'}`);
console.log(`   PORT: ${process.env.PORT || 4242}`);

// Verificar estrutura de arquivos
console.log('\n📁 Estrutura de arquivos:');
const requiredFiles = [
    'server.js',
    'package.json',
    'routes/index.js',
    'public/checkout.html',
    'public/success.html',
    'public/styles/checkout.css',
    'public/styles/success.css',
    'public/scripts/checkout.js',
    'public/scripts/success.js'
];

requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        console.log(`   ✅ ${file}`);
    } else {
        console.log(`   ❌ ${file} - NÃO ENCONTRADO`);
    }
});

// Verificar pasta download
const downloadPath = path.join(__dirname, 'public', 'download');
if (fs.existsSync(downloadPath)) {
    const pdfs = fs.readdirSync(downloadPath).filter(f => f.endsWith('.pdf'));
    console.log(`\n📄 PDFs encontrados na pasta download: ${pdfs.length}`);
    if (pdfs.length > 0) {
        pdfs.slice(0, 5).forEach(pdf => console.log(`   - ${pdf}`));
        if (pdfs.length > 5) {
            console.log(`   ... e mais ${pdfs.length - 5} arquivos`);
        }
    } else {
        console.log('   ⚠️ Nenhum PDF encontrado. Adicione os PDFs dos jornais na pasta checkout/public/download/');
    }
} else {
    console.log('\n⚠️ Pasta download não encontrada. Criando...');
    fs.mkdirSync(downloadPath, { recursive: true });
    console.log('   ✅ Pasta criada');
}

console.log('\n✅ Verificação concluída!');
