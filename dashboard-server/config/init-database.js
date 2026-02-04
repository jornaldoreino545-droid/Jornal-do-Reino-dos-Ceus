const pool = require('./database');
const fs = require('fs-extra');
const path = require('path');

// Carregar schema SQL
const schemaPath = path.join(__dirname, '..', 'database-schema.sql');

/**
 * Inicializa o banco de dados criando todas as tabelas necessárias
 */
async function initDatabase() {
  try {
    console.log('🔧 Inicializando banco de dados...');
    
    // Testar conexão
    const connection = await pool.getConnection();
    const [dbInfo] = await connection.execute('SELECT DATABASE() as db');
    const dbName = dbInfo[0]?.db || 'desconhecido';
    console.log(`✅ Conectado ao banco: ${dbName}`);
    connection.release();
    
    // Ler schema SQL
    if (!await fs.pathExists(schemaPath)) {
      console.error(`❌ Arquivo schema não encontrado: ${schemaPath}`);
      return false;
    }
    
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    // Dividir em comandos individuais (separados por ;)
    const commands = schema
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => {
        // Filtrar comentários e linhas vazias
        const trimmed = cmd.trim();
        return trimmed.length > 0 && 
               !trimmed.startsWith('--') && 
               !trimmed.startsWith('/*') &&
               trimmed !== '';
      });
    
    console.log(`📋 Executando ${commands.length} comandos SQL...`);
    
    // Executar cada comando
    let tablesCreated = 0;
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.length > 10) { // Ignorar comandos muito curtos
        try {
          await pool.execute(command);
          // Extrair nome da tabela do comando para log
          const tableMatch = command.match(/CREATE TABLE (?:IF NOT EXISTS )?`?(\w+)`?/i);
          if (tableMatch) {
            console.log(`  ✅ Tabela ${tableMatch[1]} verificada/criada`);
            tablesCreated++;
          }
        } catch (err) {
          // Ignorar erros de "tabela já existe" ou outros erros não críticos
          if (!err.message.includes('already exists') && 
              !err.message.includes('Duplicate') &&
              !err.message.includes('already exist')) {
            console.warn(`  ⚠️  Aviso ao executar comando ${i + 1}:`, err.message.substring(0, 100));
          }
        }
      }
    }
    
    if (tablesCreated > 0) {
      console.log(`✅ ${tablesCreated} tabela(s) processada(s)`);
    }
    
    console.log('✅ Banco de dados inicializado com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error.message);
    console.error('   Stack:', error.stack);
    return false;
  }
}

/**
 * Verifica se as tabelas essenciais existem
 */
async function checkTables() {
  try {
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('jornais', 'videos', 'materias', 'pagamentos', 'carrossel', 'carrossel_medio', 'colunistas')
    `);
    
    const existingTables = tables.map(t => t.TABLE_NAME);
    const requiredTables = ['jornais', 'videos', 'materias', 'pagamentos', 'carrossel', 'carrossel_medio', 'colunistas'];
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    if (missingTables.length > 0) {
      console.warn(`⚠️  Tabelas faltando: ${missingTables.join(', ')}`);
      return false;
    }
    
    console.log('✅ Todas as tabelas essenciais existem');
    return true;
  } catch (error) {
    console.error('❌ Erro ao verificar tabelas:', error.message);
    return false;
  }
}

module.exports = { initDatabase, checkTables };
