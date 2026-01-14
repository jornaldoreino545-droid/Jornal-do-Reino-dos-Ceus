// Script de teste para verificar se a API está funcionando
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/jornais',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('\n=== DADOS RETORNADOS ===');
      console.log(JSON.stringify(json, null, 2));
      console.log(`\nTotal de jornais: ${json.jornais?.length || 0}`);
    } catch (e) {
      console.log('\n=== ERRO AO PROCESSAR JSON ===');
      console.log('Resposta:', data);
      console.log('Erro:', e.message);
    }
  });
});

req.on('error', (e) => {
  console.error(`Erro na requisição: ${e.message}`);
  console.log('\nCertifique-se de que o servidor está rodando na porta 3000');
});

req.end();
