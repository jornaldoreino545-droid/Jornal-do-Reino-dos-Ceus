const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração do banco de dados
// Credenciais do banco MySQL da Hostinger
// As variáveis de ambiente podem sobrescrever esses valores se definidas
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'jornal',
  password: process.env.DB_PASSWORD || 'igrejareinodosceus13',
  database: process.env.DB_NAME || 'ebook_checkout',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Pool de conexões
const pool = mysql.createPool(dbConfig);

// Testar conexão e inicializar banco
pool.getConnection()
  .then(async connection => {
    try {
      // Obter informações do banco
      const [dbInfo] = await connection.execute('SELECT DATABASE() as db, USER() as user');
      const dbName = dbInfo[0]?.db || 'desconhecido';
      const dbUser = dbInfo[0]?.user || 'desconhecido';
      
      console.log('✅ Conexão com banco de dados estabelecida');
      console.log(`   Banco: ${dbName}`);
      console.log(`   Usuário: ${dbUser}`);
      console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
      
      connection.release();
      
      // Inicializar banco (criar tabelas se não existirem)
      const { initDatabase, checkTables } = require('./init-database');
      const tablesExist = await checkTables();
      if (!tablesExist) {
        console.log('🔧 Criando tabelas faltantes...');
        await initDatabase();
      }
    } catch (initError) {
      console.error('⚠️  Erro ao inicializar banco:', initError.message);
    }
  })
  .catch(err => {
    console.error('❌ Erro ao conectar ao banco de dados:', err.message);
    console.error('   Configuração atual:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database,
      password: dbConfig.password ? '***' : '(vazio)'
    });
    console.error('   Variáveis de ambiente:', {
      DB_HOST: process.env.DB_HOST || '(não definida)',
      DB_PORT: process.env.DB_PORT || '(não definida)',
      DB_USER: process.env.DB_USER || '(não definida)',
      DB_PASSWORD: process.env.DB_PASSWORD ? '***' : '(não definida)',
      DB_NAME: process.env.DB_NAME || '(não definida)'
    });
    
    if (err.code === 'ENOTFOUND') {
      console.error('   ⚠️  Erro: Hostname não encontrado. Verifique se DB_HOST está correto.');
      console.error('   💡 Dica: Na Hostinger, geralmente use "localhost" ou o hostname fornecido no painel.');
    }
    
    console.log('⚠️  Usando armazenamento em JSON como fallback');
  });

module.exports = pool;
