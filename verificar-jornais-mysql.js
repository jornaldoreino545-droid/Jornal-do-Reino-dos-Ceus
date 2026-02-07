const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração do banco de dados (mesma do aplicativo)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'jornal',
  password: process.env.DB_PASSWORD || 'igrejareinodosceus13',
  database: process.env.DB_NAME || 'ebook_checkout',
  multipleStatements: false
};

async function verificarJornais() {
  console.log('🔍 Verificando jornais no banco de dados MySQL...\n');
  
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conexão estabelecida com sucesso');
    
    // Informações da conexão
    const [dbInfo] = await connection.execute('SELECT DATABASE() as db, USER() as user, @@hostname as hostname, @@port as port');
    console.log('\n📊 Informações da conexão:');
    console.log(`   Database: ${dbInfo[0]?.db}`);
    console.log(`   User: ${dbInfo[0]?.user}`);
    console.log(`   Hostname: ${dbInfo[0]?.hostname}`);
    console.log(`   Port: ${dbInfo[0]?.port}`);
    console.log(`   Configuração usada:`);
    console.log(`     Host: ${dbConfig.host}`);
    console.log(`     Port: ${dbConfig.port}`);
    console.log(`     User: ${dbConfig.user}`);
    console.log(`     Database: ${dbConfig.database}`);
    
    // Contar jornais
    const [count] = await connection.execute('SELECT COUNT(*) as total FROM jornais');
    console.log(`\n📰 Total de jornais na tabela: ${count[0]?.total}`);
    
    // Listar todos os jornais
    const [jornais] = await connection.execute('SELECT id, nome, mes, ano, ativo, dataCriacao FROM jornais ORDER BY id DESC');
    
    if (jornais.length === 0) {
      console.log('\n⚠️  Nenhum jornal encontrado na tabela!');
    } else {
      console.log(`\n📋 Lista de jornais (${jornais.length} encontrados):`);
      jornais.forEach(j => {
        console.log(`   - ID ${j.id}: ${j.nome} (${j.mes} ${j.ano}) - ${j.ativo ? 'ATIVO' : 'INATIVO'} - Criado em: ${j.dataCriacao}`);
      });
    }
    
    // Verificar se há transações pendentes
    const [txInfo] = await connection.execute('SELECT @@autocommit as autocommit, @@transaction_isolation as isolation');
    console.log(`\n🔒 Status de transação:`);
    console.log(`   Autocommit: ${txInfo[0]?.autocommit}`);
    console.log(`   Isolation: ${txInfo[0]?.isolation}`);
    
    // Verificar se o registro ID 30 existe especificamente
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
    console.error('\n❌ Erro ao verificar jornais:', error.message);
    console.error('   Código:', error.code);
    console.error('   Stack:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

verificarJornais();
