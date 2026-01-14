// Script de teste para verificar se o login está funcionando
const http = require('http');

const postData = JSON.stringify({
  email: 'jornaldoreino545@gmail.com',
  password: 'ReinodosCéus@775533'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Resposta:', data);
    try {
      const json = JSON.parse(data);
      console.log('JSON:', json);
    } catch (e) {
      console.log('Não é JSON válido');
    }
  });
});

req.on('error', (e) => {
  console.error(`Problema com a requisição: ${e.message}`);
  console.log('\n⚠️  O servidor pode não estar rodando!');
  console.log('Execute: cd dashboard-server && npm start');
});

req.write(postData);
req.end();
