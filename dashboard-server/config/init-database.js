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
    
    // Migração: adicionar coluna dados_imagem na tabela fotos se já existir sem ela
    try {
      await pool.execute('ALTER TABLE fotos ADD COLUMN dados_imagem LONGBLOB NULL');
      console.log('  ✅ Coluna dados_imagem adicionada à tabela fotos');
    } catch (alterErr) {
      if (alterErr.code === 'ER_DUP_FIELDNAME' || (alterErr.message && alterErr.message.includes('Duplicate column'))) {
        console.log('  ℹ️  Tabela fotos já possui coluna dados_imagem');
      } else {
        console.warn('  ⚠️  Migração fotos (dados_imagem):', alterErr.message);
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
      AND TABLE_NAME IN ('jornais', 'videos', 'materias', 'pagamentos', 'carrossel', 'carrossel_medio', 'colunistas', 'santuarios', 'capas_jornais', 'fotos')
    `);
    
    const existingTables = tables.map(t => t.TABLE_NAME);
    const requiredTables = ['jornais', 'videos', 'materias', 'pagamentos', 'carrossel', 'carrossel_medio', 'colunistas', 'santuarios', 'capas_jornais', 'fotos'];
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

/**
 * Garante que a tabela fotos existe e tem a coluna dados_imagem (BLOB). Rode na inicialização.
 * @param {Object} dbPool - Pool MySQL
 */
async function ensureFotosBlobColumn(dbPool) {
  const pool = dbPool || require('./database');
  try {
    await pool.execute('ALTER TABLE fotos ADD COLUMN dados_imagem LONGBLOB NULL');
    console.log('  ✅ Coluna dados_imagem adicionada à tabela fotos');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME' || (err.message && err.message.includes('Duplicate column'))) {
      // Coluna já existe
    } else if (err.code === 'ER_NO_SUCH_TABLE') {
      // Criar tabela fotos se não existir
      try {
        await pool.execute(`
          CREATE TABLE fotos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nome_arquivo VARCHAR(255) NOT NULL,
            caminho VARCHAR(500) NULL,
            tipo VARCHAR(50) DEFAULT 'materia',
            referencia_id INT NULL,
            tamanho BIGINT NULL,
            mime_type VARCHAR(100) NULL,
            dados_imagem LONGBLOB NOT NULL,
            dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_tipo (tipo),
            INDEX idx_referencia (referencia_id)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('  ✅ Tabela fotos criada');
      } catch (createErr) {
        console.warn('  ⚠️  Erro ao criar tabela fotos:', createErr.message);
      }
    } else {
      console.warn('  ⚠️  Migração fotos (dados_imagem):', err.message);
    }
  }
}

module.exports = { initDatabase, checkTables, ensureFotosBlobColumn };
