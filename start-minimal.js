/**
 * Script mínimo para testar no Dokploy.
 * Se o container subir com este arquivo, o problema está no server.js.
 * No Dokploy: aba General/Advanced → Start command: node start-minimal.js
 */
const http = require('http');
const PORT = process.env.PORT || 3000;

console.log('=== START MINIMAL ===');
console.log('Porta:', PORT);
console.log('Diretório:', process.cwd());

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('App minimo OK - se voce ve isso, o container esta rodando.');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('Servidor minimo rodando na porta', PORT);
});
