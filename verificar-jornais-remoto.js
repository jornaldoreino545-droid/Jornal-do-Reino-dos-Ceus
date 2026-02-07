const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração do banco de dados REMOTO (mesma do aplicativo online)
const dbConfig = {
  host: 'jornal-do-reino-jornaldosreino-zrlq1v', // Host remoto da Hostinger
  port: 3306,
  user: 'jornal',
  password: 'igrejareinodosceus13',
  database: 'ebook_checkout',
  multipleStatements: false,
  connectTimeout: 10000
};

async function verificarJornaisRemoto() {
  console.log('🔍 Verificando jornais no banco de dados REMOTO (Hostinger)...\n');
  
  let connection;
  try {
    console.log('⏳ Tentando conectar ao banco remoto...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexão estabelecida com sucesso!\n');
    
    // Informações da conexão
    const [dbInfo] = await connection.execute('SELECT DATABASE() as db, USER() as user, @@hostname as hostname, @@port as port');
    console.log('📊 Informações da conexão:');
    console.log(`   Database: ${dbInfo[0]?.db}`);
    console.log(`   User: ${dbInfo[0]?.user}`);
    console.log(`   Hostname: ${dbInfo[0]?.hostname}`);
    console.log(`   Port: ${dbInfo[0]?.port}`);
    
    // Contar jornais
    const [count] = await connection.execute('SELECT COUNT(*) as total FROM jornais');
    console.log(`\n📰 Total de jornais na tabela: ${count[0]?.total}`);
    
    // Listar todos os jornais
    const [jornais] = await connection.execute('SELECT id, nome, mes, ano, ativo, dataCriacao FROM jornais ORDER BY id DESC LIMIT 20');
    
    if (jornais.length === 0) {
      console.log('\n⚠️  Nenhum jornal encontrado na tabela!');
    } else {
      console.log(`\n📋 Lista de jornais (últimos ${jornais.length}):`);
      jornais.forEach(j => {
        console.log(`   - ID ${j.id}: ${j.nome} (${j.mes} ${j.ano}) - ${j.ativo ? 'ATIVO' : 'INATIVO'} - Criado: ${j.dataCriacao}`);
      });
    }
    
    // Verificar especificamente o ID 30
    const [jornal30] = await connection.execute('SELECT * FROM jornais WHERE id = 30');
    if (jornal30.length > 0) {
      console.log(`\n✅ Jornal ID 30 encontrado:`);
      console.log(`   Nome: ${jornal30[0].nome}`);
      console.log(`   Capa: ${jornal30[0].capa}`);
      console.log(`   PDF: ${jornal30[0].pdf}`);
      console.log(`   Data Criação: ${jornal30[0].dataCriacao}`);
    } else {
      console.log(`\n❌ Jornal ID 30 NÃO encontrado!`);
    }
    
  } catch (error) {
    console.error('\n❌ Erro ao conectar ao banco remoto:', error.message);
    console.error('   Código:', error.code);
    if (error.code === 'ENOTFOUND') {
      console.error('\n💡 O hostname pode não estar resolvendo corretamente.');
      console.error('   Tente usar o IP do servidor MySQL da Hostinger em vez do hostname.');
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.error('\n💡 O servidor MySQL pode não estar acessível externamente.');
      console.error('   Verifique se o MySQL da Hostinger permite conexões externas.');
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

verificarJornaisRemoto();
