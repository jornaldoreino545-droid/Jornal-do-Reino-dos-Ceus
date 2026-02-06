const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração do banco de dados
// Credenciais do banco MySQL da Hostinger
// Usuário: jornal@localhost
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'), // MySQL padrão é 3306
  user: process.env.DB_USER || 'jornal', // Formato: usuario@host
  password: process.env.DB_PASSWORD || 'igrejareinodosceus13',
  database: process.env.DB_NAME || 'ebook_checkout',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000 // 10 segundos de timeout
};

// Pool de conexões com configurações adicionais
const pool = mysql.createPool({
  ...dbConfig,
  // Garantir que autocommit está habilitado (padrão, mas explícito)
  // Isso garante que cada INSERT/UPDATE seja commitado imediatamente
  multipleStatements: false,
  // Timeout para queries
  timeout: 60000
});

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
      console.log('🔍 Verificando se as tabelas existem...');
      const tablesExist = await checkTables(pool);
      if (!tablesExist) {
        console.log('🔧 Tabelas faltando detectadas. Criando tabelas...');
        const initResult = await initDatabase(pool);
        if (initResult) {
          // Verificar novamente após criação
          const tablesExistAfter = await checkTables(pool);
          if (tablesExistAfter) {
            console.log('✅ Todas as tabelas foram criadas com sucesso!');
          } else {
            console.warn('⚠️  Algumas tabelas ainda podem estar faltando. Verifique os logs acima.');
          }
        } else {
          console.error('❌ Falha ao inicializar banco de dados. Verifique os logs acima.');
        }
      } else {
        console.log('✅ Todas as tabelas essenciais já existem');
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
    
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      console.error('   ⚠️  Erro: Timeout ou conexão recusada. Verifique:');
      console.error('      - Se o MySQL está rodando');
      console.error('      - Se a porta está correta (MySQL geralmente usa 3306, não 3000)');
      console.error('      - Se o host está correto');
      console.error('   💡 Dica: Configure DB_PORT=3306 no Dokploy se estiver usando porta padrão do MySQL');
    }
    
    console.log('⚠️  Usando armazenamento em JSON como fallback');
  });

module.exports = pool;
