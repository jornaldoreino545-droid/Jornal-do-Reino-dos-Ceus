// Importar pool - será passado como parâmetro para evitar referência circular
const fs = require('fs-extra');
const path = require('path');

// Carregar schema SQL
const schemaPath = path.join(__dirname, '..', 'database-schema.sql');

/**
 * Inicializa o banco de dados criando todas as tabelas necessárias
 * @param {Object} dbPool - Pool de conexão MySQL
 */
async function initDatabase(dbPool) {
  try {
    console.log('🔧 Inicializando banco de dados...');
    
    // Usar pool passado como parâmetro
    const pool = dbPool || require('./database');
    
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
    // Remover comentários de linha (-- ...) e blocos (/* ... */)
    let cleanSchema = schema
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove blocos de comentário
      .split('\n')
      .map(line => {
        const commentIndex = line.indexOf('--');
        if (commentIndex >= 0) {
          return line.substring(0, commentIndex);
        }
        return line;
      })
      .join('\n');
    
    const commands = cleanSchema
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => {
        const trimmed = cmd.trim();
        return trimmed.length > 20 && // Comandos SQL válidos são maiores
               !trimmed.startsWith('--') && 
               trimmed.toLowerCase().includes('create table');
      });
    
    console.log(`📋 Encontrados ${commands.length} comandos CREATE TABLE para executar...`);
    
    // Executar cada comando CREATE TABLE
    let tablesCreated = 0;
    let tablesErrors = 0;
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.length > 20) {
        try {
          // Adicionar ponto e vírgula se não tiver
          const sqlCommand = command.endsWith(';') ? command : command + ';';
          await pool.execute(sqlCommand);
          
          // Extrair nome da tabela do comando para log
          const tableMatch = command.match(/CREATE TABLE (?:IF NOT EXISTS )?`?(\w+)`?/i);
          if (tableMatch) {
            const tableName = tableMatch[1];
            console.log(`  ✅ Tabela '${tableName}' criada/verificada`);
            tablesCreated++;
          }
        } catch (err) {
          // Ignorar erros de "tabela já existe"
          if (err.message.includes('already exists') || 
              err.message.includes('Duplicate') ||
              err.message.includes('already exist')) {
            const tableMatch = command.match(/CREATE TABLE (?:IF NOT EXISTS )?`?(\w+)`?/i);
            if (tableMatch) {
              console.log(`  ℹ️  Tabela '${tableMatch[1]}' já existe (ignorado)`);
            }
          } else {
            console.error(`  ❌ Erro ao criar tabela (comando ${i + 1}):`, err.message);
            console.error(`     SQL: ${command.substring(0, 100)}...`);
            tablesErrors++;
          }
        }
      }
    }
    
    if (tablesCreated > 0) {
      console.log(`✅ ${tablesCreated} tabela(s) criada(s)/verificada(s) com sucesso`);
    }
    if (tablesErrors > 0) {
      console.warn(`⚠️  ${tablesErrors} erro(s) ao criar tabela(s)`);
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
 * @param {Object} dbPool - Pool de conexão MySQL
 */
async function checkTables(dbPool) {
  try {
    // Usar pool passado como parâmetro
    const pool = dbPool || require('./database');
    
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN ('jornais', 'videos', 'materias', 'pagamentos', 'carrossel', 'carrossel_medio', 'colunistas', 'santuarios')
    `);
    
    const existingTables = tables.map(t => t.TABLE_NAME);
    const requiredTables = ['jornais', 'videos', 'materias', 'pagamentos', 'carrossel', 'carrossel_medio', 'colunistas', 'santuarios'];
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
