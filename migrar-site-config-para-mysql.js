const mysql = require('mysql2/promise');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

// Configuração do banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'jornal',
  password: process.env.DB_PASSWORD || 'igrejareinodosceus13',
  database: process.env.DB_NAME || 'ebook_checkout',
  multipleStatements: true
};

async function migrarCarrossel(pool, carrosselMaterias) {
  console.log('\n🎠 Migrando carrossel...');
  if (!carrosselMaterias || carrosselMaterias.length === 0) {
    console.log('   ⚠️ Nenhum item de carrossel encontrado');
    return;
  }
  
  let inseridos = 0;
  let atualizados = 0;
  
  for (const item of carrosselMaterias) {
    try {
      const [existing] = await pool.execute('SELECT id FROM carrossel WHERE id = ?', [item.id]);
      
      if (existing.length > 0) {
        await pool.execute(
          `UPDATE carrossel SET imagem = ?, link = ?, ordem = ?, ativo = ? WHERE id = ?`,
          [item.imagem, item.link || null, item.ordem || 0, item.ativo ? 1 : 0, item.id]
        );
        atualizados++;
      } else {
        await pool.execute(
          `INSERT INTO carrossel (id, imagem, link, ordem, ativo, dataCriacao, dataAtualizacao)
          VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          [item.id, item.imagem, item.link || null, item.ordem || 0, item.ativo ? 1 : 0]
        );
        inseridos++;
      }
    } catch (error) {
      console.error(`   ❌ Erro ao migrar item ID ${item.id}:`, error.message);
    }
  }
  
  console.log(`   ✅ Carrossel migrado: ${inseridos} inseridos, ${atualizados} atualizados`);
}

async function migrarCarrosselMedio(pool, carrosselMedio) {
  console.log('\n🎠 Migrando carrossel médio...');
  if (!carrosselMedio || carrosselMedio.length === 0) {
    console.log('   ⚠️ Nenhum item de carrossel médio encontrado');
    return;
  }
  
  let inseridos = 0;
  let atualizados = 0;
  
  for (const item of carrosselMedio) {
    try {
      const [existing] = await pool.execute('SELECT id FROM carrossel_medio WHERE id = ?', [item.id]);
      
      if (existing.length > 0) {
        await pool.execute(
          `UPDATE carrossel_medio SET imagem = ?, link = ?, ordem = ?, ativo = ? WHERE id = ?`,
          [item.imagem, item.link || null, item.ordem || 0, item.ativo ? 1 : 0, item.id]
        );
        atualizados++;
      } else {
        await pool.execute(
          `INSERT INTO carrossel_medio (id, imagem, link, ordem, ativo, dataCriacao, dataAtualizacao)
          VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
          [item.id, item.imagem, item.link || null, item.ordem || 0, item.ativo ? 1 : 0]
        );
        inseridos++;
      }
    } catch (error) {
      console.error(`   ❌ Erro ao migrar item ID ${item.id}:`, error.message);
    }
  }
  
  console.log(`   ✅ Carrossel médio migrado: ${inseridos} inseridos, ${atualizados} atualizados`);
}

async function migrarVideo(pool, videoPrincipal) {
  console.log('\n🎥 Migrando vídeo principal...');
  if (!videoPrincipal || !videoPrincipal.url) {
    console.log('   ⚠️ Nenhum vídeo encontrado');
    return;
  }
  
  try {
    // Verificar se já existe um vídeo ativo
    const [existing] = await pool.execute('SELECT id FROM videos WHERE ativo = 1 LIMIT 1');
    
    if (existing.length > 0) {
      await pool.execute(
        `UPDATE videos SET url = ?, titulo = ?, descricao = ?, ativo = ? WHERE id = ?`,
        [videoPrincipal.url, videoPrincipal.titulo || '', videoPrincipal.subtitulo || '', videoPrincipal.ativo ? 1 : 0, existing[0].id]
      );
      console.log('   ✅ Vídeo atualizado');
    } else {
      await pool.execute(
        `INSERT INTO videos (url, titulo, descricao, ativo, dataCriacao, dataAtualizacao)
        VALUES (?, ?, ?, ?, NOW(), NOW())`,
        [videoPrincipal.url, videoPrincipal.titulo || '', videoPrincipal.subtitulo || '', videoPrincipal.ativo ? 1 : 0]
      );
      console.log('   ✅ Vídeo inserido');
    }
  } catch (error) {
    console.error('   ❌ Erro ao migrar vídeo:', error.message);
  }
}

async function main() {
  console.log('🚀 Iniciando migração de site-config.json para MySQL...\n');
  
  let pool;
  try {
    pool = await mysql.createPool(dbConfig);
    console.log('✅ Conexão com banco de dados estabelecida');
    
    // Ler site-config.json
    const configPath = path.join(__dirname, 'site-config.json');
    if (!await fs.pathExists(configPath)) {
      console.error('❌ Arquivo site-config.json não encontrado!');
      process.exit(1);
    }
    
    const config = await fs.readJson(configPath);
    console.log('✅ site-config.json lido com sucesso');
    
    // Migrar dados
    await migrarCarrossel(pool, config.carrosselMaterias);
    await migrarCarrosselMedio(pool, config.carrosselMedio);
    await migrarVideo(pool, config.videoPrincipal);
    
    console.log('\n✅ Migração concluída com sucesso!');
    console.log('📝 Todos os dados do site-config.json foram migrados para o MySQL');
    console.log('⚠️  Nota: Responsáveis, FAQ, Sites Igreja, Textos e Banner Modal ainda usam JSON');
    console.log('   (Esses dados podem ser migrados posteriormente se necessário)');
    
  } catch (error) {
    console.error('\n❌ Erro durante migração:', error);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Executar migração
main();
