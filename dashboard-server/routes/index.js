const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { requireAuth } = require('../middleware/auth');
const { uploadCapa, uploadCapaOptional, uploadMateria, uploadJornalFiles, uploadVideo } = require('../config/upload');
const pool = require('../config/database');

// Middleware removido para produção - logs de debug desabilitados

const JORNAIS_FILE = path.join(__dirname, '..', '..', 'jornais.json');
const SITE_CONFIG_FILE = path.join(__dirname, '..', '..', 'site-config.json');
const MATERIAS_FILE = path.join(__dirname, '..', '..', 'public', 'Noticias', 'materias.json');
const PAGAMENTOS_FILE = path.join(__dirname, '..', '..', 'pagamentos.json');
const COLUNISTAS_FILE = path.join(__dirname, '..', '..', 'colunistas.json');

// ==================== FUNÇÕES AUXILIARES PARA JORNAIS ====================

// Ler jornais do MySQL ou JSON (fallback)
async function readJornais() {
  try {
    // Tentar buscar do MySQL primeiro
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM jornais ORDER BY ordem ASC, ano DESC, id DESC'
      );
      return { jornais: rows };
    } catch (dbError) {
      console.warn('⚠️ Erro ao buscar jornais do MySQL, usando JSON:', dbError.message);
      console.warn('   Banco configurado:', process.env.DB_NAME || 'ebook_checkout');
      console.warn('   Host:', process.env.DB_HOST || 'localhost');
      
      // Se a tabela não existe, tentar criar automaticamente
      if (dbError.message.includes("doesn't exist") || dbError.message.includes("Table")) {
        console.log('🔧 Tentando criar tabela jornais automaticamente...');
        try {
          const { initDatabase } = require('../config/init-database');
          await initDatabase(pool);
        } catch (createError) {
          console.error('❌ Erro ao criar tabelas automaticamente:', createError.message);
        }
      }
      // Fallback para JSON
    const exists = await fs.pathExists(JORNAIS_FILE);
    if (!exists) {
      await fs.writeJson(JORNAIS_FILE, { jornais: [] }, { spaces: 2 });
      return { jornais: [] };
    }
    return await fs.readJson(JORNAIS_FILE);
    }
  } catch (error) {
    console.error('Erro ao ler jornais:', error);
    return { jornais: [] };
  }
}

// Salvar jornal no MySQL e JSON (backup)
async function saveJornal(jornal, isUpdate = false) {
  try {
    // Salvar no MySQL
    try {
      if (isUpdate) {
        await pool.execute(
          `UPDATE jornais SET 
            nome = ?, mes = ?, ano = ?, descricao = ?, linkCompra = ?, 
            ordem = ?, ativo = ?, capa = ?, pdf = ?, dataAtualizacao = NOW()
          WHERE id = ?`,
          [
            jornal.nome, jornal.mes, jornal.ano, jornal.descricao || '',
            jornal.linkCompra || '', jornal.ordem || 0, jornal.ativo ? 1 : 0,
            jornal.capa || '', jornal.pdf || '', jornal.id
          ]
        );
        // Jornal atualizado no MySQL
      } else {
        const [result] = await pool.execute(
          `INSERT INTO jornais 
            (nome, mes, ano, descricao, linkCompra, ordem, ativo, capa, pdf, dataCriacao, dataAtualizacao)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            jornal.nome, jornal.mes, jornal.ano, jornal.descricao || '',
            jornal.linkCompra || '', jornal.ordem || 0, jornal.ativo ? 1 : 0,
            jornal.capa || '', jornal.pdf || ''
          ]
        );
        jornal.id = result.insertId;
        // Jornal salvo no MySQL
      }
    } catch (dbError) {
      console.warn('⚠️ Erro ao salvar jornal no MySQL, usando JSON:', dbError.message);
      // Fallback para JSON
      const data = await readJornais();
      if (isUpdate) {
        const index = data.jornais.findIndex(j => j.id === jornal.id);
        if (index !== -1) {
          data.jornais[index] = jornal;
        }
      } else {
        if (!jornal.id) {
          jornal.id = data.jornais.length > 0 
            ? Math.max(...data.jornais.map(j => j.id)) + 1 
            : 1;
        }
        data.jornais.push(jornal);
      }
      await writeJornaisJSON(data);
      return jornal;
    }
    
    // Também salvar no JSON como backup
    try {
      const data = await readJornais();
      if (isUpdate) {
        const index = data.jornais.findIndex(j => j.id === jornal.id);
        if (index !== -1) {
          data.jornais[index] = jornal;
        } else {
          data.jornais.push(jornal);
        }
      } else {
        if (!data.jornais.find(j => j.id === jornal.id)) {
          data.jornais.push(jornal);
        }
      }
      await writeJornaisJSON(data);
    } catch (jsonError) {
      console.warn('⚠️ Erro ao salvar backup JSON (não crítico):', jsonError.message);
    }
    
    return jornal;
  } catch (error) {
    console.error('Erro ao salvar jornal:', error);
    throw error;
  }
}

// Função auxiliar para escrever JSON (backup)
async function writeJornaisJSON(data) {
  try {
    const dir = path.dirname(JORNAIS_FILE);
    await fs.ensureDir(dir);
    await fs.writeJson(JORNAIS_FILE, data, { spaces: 2 });
    // Backup JSON escrito com sucesso
    return true;
  } catch (error) {
    console.error('Erro ao escrever jornais.json:', error);
    throw error;
  }
}

// Deletar jornal do MySQL e JSON
async function deleteJornal(id) {
  try {
    // Deletar do MySQL
    try {
      await pool.execute('DELETE FROM jornais WHERE id = ?', [id]);
      // Jornal deletado do MySQL
    } catch (dbError) {
      console.warn('⚠️ Erro ao deletar jornal do MySQL, usando JSON:', dbError.message);
    }
    
    // Deletar do JSON também
    try {
      const data = await readJornais();
      const index = data.jornais.findIndex(j => j.id === id);
      if (index !== -1) {
        data.jornais.splice(index, 1);
        await writeJornaisJSON(data);
      }
    } catch (jsonError) {
      console.warn('⚠️ Erro ao deletar do JSON (não crítico):', jsonError.message);
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao deletar jornal:', error);
    throw error;
  }
}

// ==================== FUNÇÕES AUXILIARES PARA MATÉRIAS ====================

// Ler matérias do MySQL ou JSON (fallback)
async function readMaterias() {
  try {
    // Tentar buscar do MySQL primeiro
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM materias ORDER BY created_at DESC, date DESC, id DESC'
      );
      return rows;
    } catch (dbError) {
      console.warn('⚠️ Erro ao buscar matérias do MySQL, usando JSON:', dbError.message);
      // Fallback para JSON
      const exists = await fs.pathExists(MATERIAS_FILE);
      if (!exists) {
        await fs.writeJson(MATERIAS_FILE, [], { spaces: 2 });
        return [];
      }
      const materias = await fs.readJson(MATERIAS_FILE);
      // Ordenar matérias: created_at (mais recente) > date (mais recente) > id (maior)
      materias.sort((a, b) => {
        const dateA = new Date(a.created_at || a.date);
        const dateB = new Date(b.created_at || b.date);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateB.getTime() - dateA.getTime();
        }
        return (b.id || 0) - (a.id || 0);
      });
      return materias;
    }
  } catch (error) {
    console.error('Erro ao ler materias.json:', error);
    return [];
  }
}

// Salvar matéria no MySQL e JSON (backup)
async function saveMateria(materia, isUpdate = false) {
  try {
    // Salvar no MySQL
    try {
      if (isUpdate) {
        await pool.execute(
          `UPDATE materias SET 
            title = ?, content = ?, excerpt = ?, date = ?, category = ?, 
            tag = ?, image = ?, ativo = ?, updated_at = NOW()
          WHERE id = ?`,
          [
            materia.title, materia.content, materia.excerpt || '',
            materia.date || null, materia.category || 'geral',
            materia.tag || '', materia.image || '', materia.ativo !== false ? 1 : 0,
            materia.id
          ]
        );
        // Matéria atualizada no MySQL
      } else {
        const [result] = await pool.execute(
          `INSERT INTO materias 
            (title, content, excerpt, date, category, tag, image, ativo, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            materia.title, materia.content, materia.excerpt || '',
            materia.date || null, materia.category || 'geral',
            materia.tag || '', materia.image || '', materia.ativo !== false ? 1 : 0
          ]
        );
        materia.id = result.insertId;
        // Matéria salva no MySQL
      }
    } catch (dbError) {
      console.warn('⚠️ Erro ao salvar matéria no MySQL, usando JSON:', dbError.message);
      // Fallback para JSON
      const materias = await readMaterias();
      if (isUpdate) {
        const index = materias.findIndex(m => m.id === materia.id);
        if (index !== -1) {
          materias[index] = materia;
        }
      } else {
        if (!materia.id) {
          materia.id = materias.length > 0
            ? Math.max(...materias.map(m => m.id || 0)) + 1
            : 1;
        }
        materias.unshift(materia); // Adicionar no início
      }
      await writeMateriasJSON(materias);
      return materia;
    }
    
    // Também salvar no JSON como backup
    try {
      const materias = await readMaterias();
      if (isUpdate) {
        const index = materias.findIndex(m => m.id === materia.id);
        if (index !== -1) {
          materias[index] = materia;
        } else {
          materias.unshift(materia);
        }
      } else {
        if (!materias.find(m => m.id === materia.id)) {
          materias.unshift(materia);
        }
      }
      await writeMateriasJSON(materias);
    } catch (jsonError) {
      console.warn('⚠️ Erro ao salvar backup JSON (não crítico):', jsonError.message);
    }
    
    return materia;
  } catch (error) {
    console.error('Erro ao salvar matéria:', error);
    throw error;
  }
}

// Função auxiliar para escrever JSON (backup)
async function writeMateriasJSON(materias) {
  try {
    const dir = path.dirname(MATERIAS_FILE);
    await fs.ensureDir(dir);
    await fs.writeJson(MATERIAS_FILE, materias, { spaces: 2 });
    // Backup JSON escrito com sucesso
    return true;
  } catch (error) {
    console.error('Erro ao escrever materias.json:', error);
    throw error;
  }
}

// Deletar matéria do MySQL e JSON
async function deleteMateria(id) {
  try {
    // Deletar do MySQL
    try {
      await pool.execute('DELETE FROM materias WHERE id = ?', [id]);
      // Matéria deletada do MySQL
    } catch (dbError) {
      console.warn('⚠️ Erro ao deletar matéria do MySQL, usando JSON:', dbError.message);
    }
    
    // Deletar do JSON também
    try {
      const materias = await readMaterias();
      const index = materias.findIndex(m => m.id === id);
      if (index !== -1) {
        materias.splice(index, 1);
        await writeMateriasJSON(materias);
      }
    } catch (jsonError) {
      console.warn('⚠️ Erro ao deletar do JSON (não crítico):', jsonError.message);
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao deletar matéria:', error);
    throw error;
  }
}

// ==================== FUNÇÕES AUXILIARES PARA VÍDEOS ====================

// Ler vídeo do MySQL ou JSON (fallback)
async function readVideo() {
  try {
    // Tentar buscar do MySQL primeiro
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM videos WHERE ativo = 1 ORDER BY dataCriacao DESC LIMIT 1'
      );
      if (rows.length > 0) {
        return rows[0];
      }
      return null;
    } catch (dbError) {
      console.warn('⚠️ Erro ao buscar vídeo do MySQL, usando JSON:', dbError.message);
      console.warn('   Banco configurado:', process.env.DB_NAME || 'ebook_checkout');
      console.warn('   Host:', process.env.DB_HOST || 'localhost');
      
      // Se a tabela não existe, tentar criar automaticamente
      if (dbError.message.includes("doesn't exist") || dbError.message.includes("Table")) {
        console.log('🔧 Tentando criar tabela videos automaticamente...');
        try {
          const { initDatabase } = require('../config/init-database');
          await initDatabase(pool);
        } catch (createError) {
          console.error('❌ Erro ao criar tabelas automaticamente:', createError.message);
        }
      }
      // Fallback para JSON
      const config = await readSiteConfig();
      return config?.video || null;
    }
  } catch (error) {
    console.error('Erro ao ler vídeo:', error);
    return null;
  }
}

// Salvar vídeo no MySQL e JSON (backup)
async function saveVideo(video) {
  try {
    // Salvar no MySQL
    try {
      // Verificar se já existe um vídeo ativo
      const [existing] = await pool.execute(
        'SELECT id FROM videos WHERE ativo = 1 LIMIT 1'
      );
      
      if (existing.length > 0) {
        // Atualizar vídeo existente
        await pool.execute(
          `UPDATE videos SET 
            url = ?, titulo = ?, descricao = ?, thumbnail = ?, 
            dataAtualizacao = NOW()
          WHERE id = ?`,
          [video.url, video.titulo || '', video.descricao || '', video.thumbnail || '', existing[0].id]
        );
        video.id = existing[0].id;
        // Vídeo atualizado no MySQL
      } else {
        // Criar novo vídeo
        const [result] = await pool.execute(
          `INSERT INTO videos (url, titulo, descricao, thumbnail, ativo, dataCriacao, dataAtualizacao)
          VALUES (?, ?, ?, ?, 1, NOW(), NOW())`,
          [video.url, video.titulo || '', video.descricao || '', video.thumbnail || '']
        );
        video.id = result.insertId;
        // Vídeo salvo no MySQL
      }
    } catch (dbError) {
      console.warn('⚠️ Erro ao salvar vídeo no MySQL, usando JSON:', dbError.message);
      // Fallback para JSON
      const config = await readSiteConfig();
      if (!config) {
        throw new Error('Erro ao ler configuração');
      }
      config.video = video;
      await writeSiteConfig(config);
      return video;
    }
    
    // Também salvar no JSON como backup
    try {
      const config = await readSiteConfig();
      if (config) {
        config.video = video;
        await writeSiteConfig(config);
      }
    } catch (jsonError) {
      console.warn('⚠️ Erro ao salvar backup JSON (não crítico):', jsonError.message);
    }
    
    return video;
  } catch (error) {
    console.error('Erro ao salvar vídeo:', error);
    throw error;
  }
}

// Funções auxiliares para trabalhar com colunistas.json
async function readColunistas() {
  try {
    const exists = await fs.pathExists(COLUNISTAS_FILE);
    if (!exists) {
      await fs.writeJson(COLUNISTAS_FILE, { colunistas: [] }, { spaces: 2 });
      return { colunistas: [] };
    }
    return await fs.readJson(COLUNISTAS_FILE);
  } catch (error) {
    console.error('Erro ao ler colunistas.json:', error);
    return { colunistas: [] };
  }
}

async function writeColunistas(data) {
  try {
    const dir = path.dirname(COLUNISTAS_FILE);
    await fs.ensureDir(dir);
    await fs.writeJson(COLUNISTAS_FILE, data, { spaces: 2 });
    // Arquivo colunistas.json escrito com sucesso
    return true;
  } catch (error) {
    console.error('Erro ao escrever colunistas.json:', error);
    throw error;
  }
}

// ==================== AUTENTICAÇÃO ====================

// Rota de teste para verificar se as rotas estão funcionando
router.get('/test', (req, res) => {
  console.log('✅ Rota de teste /api/test chamada com sucesso!');
  res.json({ message: 'Rotas funcionando!', timestamp: new Date().toISOString() });
});

// Login - REGISTRAR A ROTA COM LOG IMEDIATO
console.log('🔐 Registrando rota POST /login...');
router.post('/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Aceita tanto username quanto email no campo de login
    const loginValue = email || username;
    
    if (!loginValue || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }
    
    // Credenciais fixas
    const ADMIN_EMAIL = 'jornaldoreino545@gmail.com';
    const ADMIN_PASS = 'Igrejareinodosceus1313';
    
    // Permitir override via variável de ambiente
    const adminEmail = (process.env.ADMIN_EMAIL || ADMIN_EMAIL).trim().toLowerCase();
    const adminPass = (process.env.ADMIN_PASS || ADMIN_PASS);

    // Normalizar entrada do usuário
    const normalizedEmail = loginValue.trim().toLowerCase();
    const normalizedPassword = password.replace(/\s+/g, ''); // Remove todos os espaços
    
    // Comparação de email
    const emailMatch = normalizedEmail === adminEmail;
    
    if (!emailMatch) {
      return res.status(401).json({ 
        error: 'Credenciais inválidas',
        message: 'Email ou senha incorretos.'
      });
    }
    
    // Comparação de senha (case-sensitive)
    const passwordMatch = normalizedPassword === adminPass;
    
    if (emailMatch && passwordMatch) {
      // Credenciais válidas - criar sessão autenticada
      req.session.authenticated = true;
      req.session.user = adminEmail;
      req.session.loginTime = new Date().toISOString();
      
      req.session.save((err) => {
        if (err) {
          console.error('Erro ao salvar sessão:', err);
          return res.status(500).json({ error: 'Erro ao criar sessão' });
        }
        res.json({ ok: true, user: adminEmail, message: 'Login realizado com sucesso' });
      });
      return;
    }
    
    res.status(401).json({ 
      error: 'Credenciais inválidas',
      message: 'Email ou senha incorretos.'
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao fazer logout' });
    }
    res.json({ ok: true });
  });
});

// Verificar autenticação
router.get('/auth/check', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.json({ authenticated: true, user: req.session.user });
  }
  res.json({ authenticated: false });
});

// ==================== JORNAIS ====================

// Listar todos os jornais
// Se não estiver autenticado, retorna apenas jornais ativos (para o site público)
// Se estiver autenticado, retorna todos os jornais (para o dashboard)
router.get('/jornais', async (req, res) => {
  try {
    // Listando jornais
    const data = await readJornais();
    let jornaisList = data.jornais || [];
    
    // Se não estiver autenticado, filtrar apenas jornais ativos e ordenar
    if (!req.session || !req.session.authenticated) {
      jornaisList = jornaisList
        .filter(j => j.ativo !== false)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    }
    
    // Retornando jornais
    res.json({ jornais: jornaisList });
  } catch (error) {
    console.error('Erro ao listar jornais:', error);
    res.status(500).json({ error: 'Erro ao listar jornais', jornais: [] });
  }
});

// Obter um jornal específico
router.get('/jornais/:id', async (req, res) => {
  try {
    const data = await readJornais();
    const jornal = data.jornais.find(j => j.id === parseInt(req.params.id));
    
    if (!jornal) {
      return res.status(404).json({ error: 'Jornal não encontrado' });
    }
    
    res.json(jornal);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter jornal' });
  }
});

// Criar novo jornal
router.post('/jornais', requireAuth, (req, res, next) => {
  // Iniciando criação de jornal
  
  // Usar upload de múltiplos arquivos (capa e PDF)
  uploadJornalFiles(req, res, (uploadErr) => {
    if (uploadErr) {
      console.error('Erro no upload do multer:', uploadErr);
      console.error('Código do erro:', uploadErr.code);
      console.error('Mensagem:', uploadErr.message);
      
      if (!res.headersSent) {
        if (uploadErr.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Arquivo muito grande. Tamanho máximo: 250MB para PDF, 10MB para imagens' });
        }
        if (uploadErr.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: 'Campo de arquivo inesperado. Use "capa" para imagem e "pdf" para PDF.' });
        }
        if (uploadErr.message && (uploadErr.message.includes('Apenas') || uploadErr.message.includes('PDF'))) {
          return res.status(400).json({ error: uploadErr.message });
        }
        return res.status(400).json({ error: 'Erro ao fazer upload: ' + (uploadErr.message || uploadErr.code || 'Erro desconhecido') });
      }
      return;
    }
    
    next();
  });
}, async (req, res) => {
  try {
    // Processando criação do jornal
    // Arquivos recebidos
    
    const { nome, mes, ano, descricao, linkCompra, ordem, ativo } = req.body;
    
    if (!nome || !mes || !ano) {
      return res.status(400).json({ error: 'Nome, mês e ano são obrigatórios' });
    }
    
    // Verificar se PDF foi enviado (obrigatório para novos jornais)
    if (!req.files || !req.files.pdf || req.files.pdf.length === 0) {
      return res.status(400).json({ error: 'PDF é obrigatório para novos jornais' });
    }

    // Obter nome dos arquivos
    const capaFile = req.files.capa && req.files.capa[0] ? req.files.capa[0] : null;
    const pdfFile = req.files.pdf && req.files.pdf[0] ? req.files.pdf[0] : null;

    // Obter próximo ID do banco ou JSON
    let novoId = 1;
    try {
      const data = await readJornais();
      if (data.jornais && data.jornais.length > 0) {
        novoId = Math.max(...data.jornais.map(j => j.id)) + 1;
      }
    } catch (err) {
      console.warn('Erro ao obter próximo ID, usando 1:', err.message);
    }

    const novoJornal = {
      id: novoId,
      nome: nome.trim().toUpperCase(),
      mes,
      ano: parseInt(ano),
      descricao: descricao || '',
      linkCompra: linkCompra || '',
      ordem: ordem ? parseInt(ordem) : novoId,
      ativo: ativo === 'true' || ativo === true,
      capa: capaFile ? `/uploads/capas/${capaFile.filename}` : '',
      pdf: pdfFile ? `/uploads/pdfs/${pdfFile.filename}` : '',
      dataCriacao: new Date().toISOString(),
      dataAtualizacao: new Date().toISOString()
    };

    console.log('Salvando jornal no MySQL e JSON...');
    const jornalSalvo = await saveJornal(novoJornal, false);
    
    console.log('Jornal criado com sucesso! ID:', jornalSalvo.id);
    res.json({ ok: true, jornal: jornalSalvo });
  } catch (error) {
    console.error('=== ERRO AO CRIAR JORNAL ===');
    console.error('Tipo:', error.constructor.name);
    console.error('Mensagem:', error.message);
    console.error('Stack:', error.stack);
    console.error('============================');
    
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Erro ao criar jornal', 
        message: error.message
      });
    }
  }
});

// Atualizar jornal
router.put('/jornais/:id', requireAuth, (req, res, next) => {
  // Iniciando atualização de jornal
  // Verificando autenticação
  
  // Usar upload de múltiplos arquivos (capa e PDF) - ambos opcionais na atualização
  uploadJornalFiles(req, res, (uploadErr) => {
    if (uploadErr) {
      console.error('Erro no upload do multer:', uploadErr);
      console.error('Código do erro:', uploadErr.code);
      console.error('Mensagem:', uploadErr.message);
      
      if (!res.headersSent) {
        if (uploadErr.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Arquivo muito grande. Tamanho máximo: 250MB para PDF, 10MB para imagens' });
        }
        if (uploadErr.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: 'Campo de arquivo inesperado. Use "capa" para imagem e "pdf" para PDF.' });
        }
        if (uploadErr.message && (uploadErr.message.includes('Apenas') || uploadErr.message.includes('PDF'))) {
          return res.status(400).json({ error: uploadErr.message });
        }
        return res.status(400).json({ error: 'Erro ao fazer upload: ' + (uploadErr.message || uploadErr.code || 'Erro desconhecido') });
      }
      return;
    }
    
    next();
  });
}, async (req, res) => {
  try {
    // Processando atualização do jornal
    // Arquivos recebidos
    const { nome, mes, ano, descricao, linkCompra, ordem, ativo } = req.body;
    const id = parseInt(req.params.id);

    // Validar campos obrigatórios se fornecidos
    if (nome !== undefined && !nome) {
      return res.status(400).json({ error: 'Nome é obrigatório' });
    }
    if (mes !== undefined && !mes) {
      return res.status(400).json({ error: 'Mês é obrigatório' });
    }
    if (ano !== undefined && !ano) {
      return res.status(400).json({ error: 'Ano é obrigatório' });
    }

    // Buscar jornal atual
    const data = await readJornais();
    const jornalAtual = data.jornais.find(j => j.id === id);

    if (!jornalAtual) {
      return res.status(404).json({ error: 'Jornal não encontrado' });
    }
    
    // Atualizar campos apenas se fornecidos
    if (nome !== undefined) jornalAtual.nome = nome.trim().toUpperCase();
    if (mes !== undefined) jornalAtual.mes = mes;
    if (ano !== undefined) jornalAtual.ano = parseInt(ano);
    if (descricao !== undefined) jornalAtual.descricao = descricao;
    if (linkCompra !== undefined) jornalAtual.linkCompra = linkCompra;
    if (ordem !== undefined) jornalAtual.ordem = parseInt(ordem);
    if (ativo !== undefined) jornalAtual.ativo = ativo === 'true' || ativo === true;
    
    // Se nova capa foi enviada
    const capaFile = req.files && req.files.capa && req.files.capa[0] ? req.files.capa[0] : null;
    if (capaFile) {
      // Deletar capa antiga se existir
      if (jornalAtual.capa) {
        const capaPath = jornalAtual.capa.startsWith('/uploads/') 
          ? jornalAtual.capa.substring(1) 
          : jornalAtual.capa;
        const oldPath = path.join(__dirname, '..', capaPath);
        try {
          await fs.remove(oldPath);
        } catch (err) {
          console.error('Erro ao deletar capa antiga:', err);
        }
      }
      jornalAtual.capa = `/uploads/capas/${capaFile.filename}`;
    }
    
    // Se novo PDF foi enviado
    const pdfFile = req.files && req.files.pdf && req.files.pdf[0] ? req.files.pdf[0] : null;
    if (pdfFile) {
      // Deletar PDF antigo se existir
      if (jornalAtual.pdf) {
        const pdfPath = jornalAtual.pdf.startsWith('/uploads/') 
          ? jornalAtual.pdf.substring(1) 
          : jornalAtual.pdf;
        const oldPdfPath = path.join(__dirname, '..', pdfPath);
        try {
          await fs.remove(oldPdfPath);
        } catch (err) {
          console.error('Erro ao deletar PDF antigo:', err);
        }
      }
      jornalAtual.pdf = `/uploads/pdfs/${pdfFile.filename}`;
    }
    
    jornalAtual.dataAtualizacao = new Date().toISOString();

    // Salvar no MySQL e JSON
    const jornalAtualizado = await saveJornal(jornalAtual, true);
    res.json({ ok: true, jornal: jornalAtualizado });
  } catch (error) {
    console.error('Erro ao atualizar jornal:', error);
    res.status(500).json({ error: 'Erro ao atualizar jornal' });
  }
});

// Deletar jornal
router.delete('/jornais/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = await readJornais();
    const jornal = data.jornais.find(j => j.id === id);

    if (!jornal) {
      return res.status(404).json({ error: 'Jornal não encontrado' });
    }
    
    // Deletar capa se existir
    if (jornal.capa) {
      const capaPath = jornal.capa.startsWith('/uploads/') 
        ? jornal.capa.substring(1) 
        : jornal.capa;
      const fullPath = path.join(__dirname, '..', capaPath);
      try {
        await fs.remove(fullPath);
      } catch (err) {
        console.error('Erro ao deletar capa:', err);
      }
    }

    // Deletar PDF se existir
    if (jornal.pdf) {
      const pdfPath = jornal.pdf.startsWith('/uploads/') 
        ? jornal.pdf.substring(1) 
        : jornal.pdf;
      const fullPdfPath = path.join(__dirname, '..', pdfPath);
      try {
        await fs.remove(fullPdfPath);
      } catch (err) {
        console.error('Erro ao deletar PDF:', err);
      }
    }

    // Deletar do MySQL e JSON
    await deleteJornal(id);

    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao deletar jornal:', error);
    res.status(500).json({ error: 'Erro ao deletar jornal' });
  }
});

// ==================== MATÉRIAS ====================

// Upload de matéria (único arquivo)
router.post('/materias/upload', requireAuth, uploadMateria, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    res.json({
      ok: true,
      url: `/uploads/materias/${req.file.filename}`,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Erro ao fazer upload de matéria:', error);
    res.status(500).json({ error: 'Erro ao fazer upload' });
  }
});

// Upload de múltiplas imagens para conteúdo de notícias
// Criar uma instância do multer para múltiplos arquivos usando a mesma configuração
// Nota: path e fs já estão importados no topo do arquivo
const multer = require('multer');

// Reutilizar a configuração de storage do uploadMateria
// Usar o mesmo caminho que está no config/upload.js
const materiasDir = path.join(__dirname, '..', 'uploads', 'materias');
fs.ensureDirSync(materiasDir);
console.log('📁 Diretório de upload de matérias:', materiasDir);

const storageMateriasMultiple = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, materiasDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `materia-${uniqueSuffix}${ext}`);
  }
});

const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Apenas imagens são permitidas (JPEG, PNG, GIF, WEBP)'));
  }
};

const uploadMateriaMultiple = multer({
  storage: storageMateriasMultiple,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB por arquivo
  fileFilter: imageFilter
});

// Rota para upload de uma imagem por vez (o frontend faz uploads sequenciais)
router.post('/site/upload-materia', requireAuth, uploadMateriaMultiple.single('materia'), async (req, res) => {
  try {
    console.log('📤 Upload de imagem recebido');
    // Arquivo recebido
    console.log('   Body:', req.body);
    console.log('   File:', req.file ? { 
      originalname: req.file.originalname, 
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size 
    } : 'nenhum');
    
    if (!req.file) {
      console.error('❌ Nenhum arquivo recebido');
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const imageUrl = `/uploads/materias/${req.file.filename}`;
    
    console.log('✅ Upload concluído com sucesso!');
    console.log('   URL gerada:', imageUrl);
    
    // Retornar no formato esperado pelo frontend
    const response = {
      ok: true,
      url: imageUrl,
      image: imageUrl,
      filename: req.file.filename
    };
    
    console.log('📤 Enviando resposta:', response);
    res.json(response);
  } catch (error) {
    console.error('❌ Erro ao fazer upload de imagem:', error);
    console.error('   Stack:', error.stack);
    res.status(500).json({ error: 'Erro ao fazer upload: ' + (error.message || 'Erro desconhecido') });
  }
});

// ==================== FUNÇÕES AUXILIARES PARA SITE CONFIG ====================

async function readSiteConfig() {
  try {
    const exists = await fs.pathExists(SITE_CONFIG_FILE);
    if (!exists) {
      const defaultConfig = {
        carrosselMaterias: [],
        videoPrincipal: { url: '', titulo: '', subtitulo: '', ativo: true },
        responsaveis: [],
        faq: [],
        sitesIgreja: [],
        textos: {
          sobreJornal: { titulo: '', subtitulo: '', imagem: '', conteudo: '' },
          sobreIgreja: { titulo: '', subtitulo: '', conteudo: '' }
        },
        bannerModal: { imagem: '', link: '', ativo: true },
        formularioContato: { apiKey: '', redirectTo: '', ativo: true },
        carrosselMedio: []
      };
      await fs.writeJson(SITE_CONFIG_FILE, defaultConfig, { spaces: 2, encoding: 'utf8' });
      return defaultConfig;
    }
    return await fs.readJson(SITE_CONFIG_FILE, { encoding: 'utf8' });
  } catch (error) {
    console.error('Erro ao ler site-config.json:', error);
    return null;
  }
}

async function writeSiteConfig(data) {
  try {
    // Garantir que o diretório existe
    const dir = path.dirname(SITE_CONFIG_FILE);
    await fs.ensureDir(dir);
    // Escrever com encoding UTF-8 explícito
    await fs.writeJson(SITE_CONFIG_FILE, data, { spaces: 2, encoding: 'utf8' });
    return true;
  } catch (error) {
    console.error('Erro ao escrever site-config.json:', error);
    return false;
  }
}

// Funções readMaterias e writeMaterias foram movidas para cima (com suporte MySQL)

// ==================== CARROSSEL DE MATÉRIAS ====================

router.get('/site/carrossel', async (req, res) => {
  try {
    const config = await readSiteConfig();
    res.json(config?.carrosselMaterias || []);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar carrossel' });
  }
});

router.post('/site/carrossel', requireAuth, uploadMateria, async (req, res) => {
  try {
    const { ordem, link } = req.body;
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    const novaImagem = req.file 
      ? `/uploads/materias/${req.file.filename}`
      : req.body.imagem;

    if (!novaImagem) {
      return res.status(400).json({ error: 'Imagem é obrigatória' });
    }

    const novoId = config.carrosselMaterias.length > 0
      ? Math.max(...config.carrosselMaterias.map(c => c.id)) + 1
      : 1;

    config.carrosselMaterias.push({
      id: novoId,
      imagem: novaImagem,
      ordem: ordem ? parseInt(ordem) : config.carrosselMaterias.length + 1,
      ativo: true,
      link: link || null
    });

    await writeSiteConfig(config);
    res.json({ ok: true, item: config.carrosselMaterias[config.carrosselMaterias.length - 1] });
  } catch (error) {
    console.error('Erro ao criar item do carrossel:', error);
    res.status(500).json({ error: 'Erro ao criar item' });
  }
});

router.put('/site/carrossel/:id', requireAuth, uploadMateria, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { ordem, ativo, link } = req.body;
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    const index = config.carrosselMaterias.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    if (req.file) {
      config.carrosselMaterias[index].imagem = `/uploads/materias/${req.file.filename}`;
    }
    if (ordem !== undefined) config.carrosselMaterias[index].ordem = parseInt(ordem);
    if (ativo !== undefined) config.carrosselMaterias[index].ativo = ativo === 'true' || ativo === true;
    if (link !== undefined) config.carrosselMaterias[index].link = link || null;

    await writeSiteConfig(config);
    res.json({ ok: true, item: config.carrosselMaterias[index] });
  } catch (error) {
    console.error('Erro ao atualizar item do carrossel:', error);
    res.status(500).json({ error: 'Erro ao atualizar item' });
  }
});

router.delete('/site/carrossel/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    const index = config.carrosselMaterias.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    config.carrosselMaterias.splice(index, 1);
    await writeSiteConfig(config);
    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao deletar item do carrossel:', error);
    res.status(500).json({ error: 'Erro ao deletar item' });
  }
});

// ==================== CARROSSEL MÉDIO ====================

router.get('/site/carrossel-medio', async (req, res) => {
  try {
    const config = await readSiteConfig();
    res.json(config?.carrosselMedio || []);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar carrossel médio' });
  }
});

router.post('/site/carrossel-medio', requireAuth, uploadMateria, async (req, res) => {
  try {
    const { ordem } = req.body;
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    // Inicializar carrosselMedio se não existir
    if (!config.carrosselMedio) {
      config.carrosselMedio = [];
    }

    const novaImagem = req.file 
      ? `/uploads/materias/${req.file.filename}`
      : req.body.imagem;

    if (!novaImagem) {
      return res.status(400).json({ error: 'Imagem é obrigatória' });
    }

    const novoId = config.carrosselMedio.length > 0
      ? Math.max(...config.carrosselMedio.map(c => c.id)) + 1
      : 1;

    config.carrosselMedio.push({
      id: novoId,
      imagem: novaImagem,
      ordem: ordem ? parseInt(ordem) : config.carrosselMedio.length + 1,
      ativo: true
    });

    await writeSiteConfig(config);
    res.json({ ok: true, item: config.carrosselMedio[config.carrosselMedio.length - 1] });
  } catch (error) {
    console.error('Erro ao criar item do carrossel médio:', error);
    res.status(500).json({ error: 'Erro ao criar item' });
  }
});

router.put('/site/carrossel-medio/:id', requireAuth, uploadMateria, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { ordem, ativo } = req.body;
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    // Inicializar carrosselMedio se não existir
    if (!config.carrosselMedio) {
      config.carrosselMedio = [];
    }

    const index = config.carrosselMedio.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    if (req.file) {
      config.carrosselMedio[index].imagem = `/uploads/materias/${req.file.filename}`;
    }
    if (ordem !== undefined) config.carrosselMedio[index].ordem = parseInt(ordem);
    if (ativo !== undefined) config.carrosselMedio[index].ativo = ativo === 'true' || ativo === true;

    await writeSiteConfig(config);
    res.json({ ok: true, item: config.carrosselMedio[index] });
  } catch (error) {
    console.error('Erro ao atualizar item do carrossel médio:', error);
    res.status(500).json({ error: 'Erro ao atualizar item' });
  }
});

router.delete('/site/carrossel-medio/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    // Inicializar carrosselMedio se não existir
    if (!config.carrosselMedio) {
      config.carrosselMedio = [];
    }

    const index = config.carrosselMedio.findIndex(c => c.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    config.carrosselMedio.splice(index, 1);
    await writeSiteConfig(config);
    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao deletar item do carrossel médio:', error);
    res.status(500).json({ error: 'Erro ao deletar item' });
  }
});

// ==================== VÍDEO PRINCIPAL ====================

router.get('/site/video', async (req, res) => {
  try {
    // Tentar buscar do MySQL primeiro
    const video = await readVideo();
    if (video) {
      // Converter formato MySQL para formato esperado pelo frontend
      res.json({
        url: video.url,
        titulo: video.titulo || '',
        subtitulo: video.descricao || '',
        ativo: video.ativo !== 0
      });
    } else {
      // Fallback para JSON
    const config = await readSiteConfig();
    res.json(config?.videoPrincipal || {});
    }
  } catch (error) {
    console.error('Erro ao obter vídeo:', error);
    res.status(500).json({ error: 'Erro ao obter vídeo' });
  }
});

router.put('/site/video', requireAuth, (req, res, next) => {
  // Middleware wrapper para capturar erros do Multer
  uploadVideo(req, res, (uploadErr) => {
    if (uploadErr) {
      console.error('Erro no upload do vídeo:', uploadErr);
      console.error('Código do erro:', uploadErr.code);
      console.error('Mensagem:', uploadErr.message);
      
      // Tratar erros específicos do Multer
      if (uploadErr.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Arquivo muito grande. Tamanho máximo: 500MB' });
      }
      if (uploadErr.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Campo de arquivo inesperado. Use "video" para o vídeo.' });
      }
      if (uploadErr.message && (uploadErr.message.includes('Apenas vídeos') || uploadErr.message.includes('não são permitidos'))) {
        return res.status(400).json({ error: uploadErr.message });
      }
      
      return res.status(400).json({ error: 'Erro ao fazer upload: ' + (uploadErr.message || uploadErr.code || 'Erro desconhecido') });
    }
    
    // Se não houver erro, continuar para o próximo middleware/handler
    next();
  });
}, async (req, res) => {
  try {
    const { titulo, subtitulo, ativo } = req.body;
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    // Preparar objeto de vídeo
    const videoData = {
      url: '',
      titulo: '',
      descricao: '',
      thumbnail: ''
    };

    // Se um novo vídeo foi enviado, processar o upload
    if (req.file) {
      videoData.url = `/uploads/videos/${req.file.filename}`;
      
      // Se havia um vídeo anterior, deletar o arquivo antigo
      const videoAtual = await readVideo();
      if (videoAtual && videoAtual.url && videoAtual.url.startsWith('/uploads/videos/')) {
        const oldVideoPath = path.join(__dirname, '..', 'uploads', 'videos', path.basename(videoAtual.url));
        try {
          await fs.remove(oldVideoPath);
          console.log('Vídeo antigo deletado:', oldVideoPath);
        } catch (err) {
          console.error('Erro ao deletar vídeo antigo:', err);
        }
      }
    } else {
      // Manter URL atual se não houver novo upload
      const videoAtual = await readVideo();
      if (videoAtual) {
        videoData.url = videoAtual.url || '';
      } else {
        const config = await readSiteConfig();
        videoData.url = config?.videoPrincipal?.url || '';
      }
    }
    
    // Atualizar campos de texto
    if (titulo !== undefined) {
      videoData.titulo = Array.isArray(titulo) ? titulo[0] : titulo;
    } else {
      const videoAtual = await readVideo();
      videoData.titulo = videoAtual?.titulo || '';
    }
    
    if (subtitulo !== undefined) {
      videoData.descricao = Array.isArray(subtitulo) ? subtitulo[0] : subtitulo;
    } else {
      const videoAtual = await readVideo();
      videoData.descricao = videoAtual?.descricao || '';
    }

    // Salvar no MySQL e JSON
    const videoSalvo = await saveVideo(videoData);
    
    // Retornar no formato esperado pelo frontend
    res.json({ 
      ok: true, 
      video: {
        url: videoSalvo.url,
        titulo: videoSalvo.titulo || '',
        subtitulo: videoSalvo.descricao || '',
        ativo: videoSalvo.ativo !== false
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar vídeo:', error);
    res.status(500).json({ error: 'Erro ao atualizar vídeo' });
  }
});

// ==================== RESPONSÁVEIS ====================

router.get('/site/responsaveis', async (req, res) => {
  try {
    const config = await readSiteConfig();
    let responsaveis = config?.responsaveis || [];
    
    // Normalizar URLs das imagens - remover localhost:3000 hardcoded
    responsaveis = responsaveis.map(resp => {
      if (resp.imagem && typeof resp.imagem === 'string') {
        // Remover http://localhost:3000 ou https://localhost:3000
        resp.imagem = resp.imagem.replace(/https?:\/\/localhost:3000/g, '');
        // Garantir que comece com / se não for URL externa
        if (!resp.imagem.startsWith('http') && !resp.imagem.startsWith('/')) {
          resp.imagem = '/' + resp.imagem;
        }
      }
      return resp;
    });
    
    res.json(responsaveis);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar responsáveis' });
  }
});

router.post('/site/responsaveis', requireAuth, uploadMateria, async (req, res) => {
  try {
    const { nome, cargo, ordem } = req.body;
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    if (!nome || !cargo) {
      return res.status(400).json({ error: 'Nome e cargo são obrigatórios' });
    }

    const novaImagem = req.file 
      ? `/uploads/materias/${req.file.filename}`
      : req.body.imagem;

    const novoId = config.responsaveis.length > 0
      ? Math.max(...config.responsaveis.map(r => r.id)) + 1
      : 1;

    config.responsaveis.push({
      id: novoId,
      nome,
      cargo,
      imagem: novaImagem || '',
      ordem: ordem ? parseInt(ordem) : config.responsaveis.length + 1,
      ativo: true
    });

    await writeSiteConfig(config);
    res.json({ ok: true, responsavel: config.responsaveis[config.responsaveis.length - 1] });
  } catch (error) {
    console.error('Erro ao criar responsável:', error);
    res.status(500).json({ error: 'Erro ao criar responsável' });
  }
});

router.put('/site/responsaveis/:id', requireAuth, uploadMateria, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nome, cargo, ordem, ativo } = req.body;
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    const index = config.responsaveis.findIndex(r => r.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Responsável não encontrado' });
    }

    if (nome) config.responsaveis[index].nome = nome;
    if (cargo) config.responsaveis[index].cargo = cargo;
    if (req.file) config.responsaveis[index].imagem = `/uploads/materias/${req.file.filename}`;
    if (ordem !== undefined) config.responsaveis[index].ordem = parseInt(ordem);
    if (ativo !== undefined) config.responsaveis[index].ativo = ativo === 'true' || ativo === true;

    await writeSiteConfig(config);
    res.json({ ok: true, responsavel: config.responsaveis[index] });
  } catch (error) {
    console.error('Erro ao atualizar responsável:', error);
    res.status(500).json({ error: 'Erro ao atualizar responsável' });
  }
});

router.delete('/site/responsaveis/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    const index = config.responsaveis.findIndex(r => r.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Responsável não encontrado' });
    }

    config.responsaveis.splice(index, 1);
    await writeSiteConfig(config);
    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao deletar responsável:', error);
    res.status(500).json({ error: 'Erro ao deletar responsável' });
  }
});

// ==================== FAQ ====================

router.get('/site/faq', async (req, res) => {
  try {
    const config = await readSiteConfig();
    res.json(config?.faq || []);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar FAQ' });
  }
});

router.post('/site/faq', requireAuth, async (req, res) => {
  try {
    const { pergunta, resposta, ordem } = req.body;
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    if (!pergunta || !resposta) {
      return res.status(400).json({ error: 'Pergunta e resposta são obrigatórias' });
    }

    const novoId = config.faq.length > 0
      ? Math.max(...config.faq.map(f => f.id)) + 1
      : 1;

    config.faq.push({
      id: novoId,
      pergunta,
      resposta,
      ordem: ordem ? parseInt(ordem) : config.faq.length + 1,
      ativo: true
    });

    await writeSiteConfig(config);
    res.json({ ok: true, faq: config.faq[config.faq.length - 1] });
  } catch (error) {
    console.error('Erro ao criar FAQ:', error);
    res.status(500).json({ error: 'Erro ao criar FAQ' });
  }
});

router.put('/site/faq/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { pergunta, resposta, ordem, ativo } = req.body;
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    const index = config.faq.findIndex(f => f.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'FAQ não encontrado' });
    }

    if (pergunta) config.faq[index].pergunta = pergunta;
    if (resposta) config.faq[index].resposta = resposta;
    if (ordem !== undefined) config.faq[index].ordem = parseInt(ordem);
    if (ativo !== undefined) config.faq[index].ativo = ativo === 'true' || ativo === true;

    await writeSiteConfig(config);
    res.json({ ok: true, faq: config.faq[index] });
  } catch (error) {
    console.error('Erro ao atualizar FAQ:', error);
    res.status(500).json({ error: 'Erro ao atualizar FAQ' });
  }
});

router.delete('/site/faq/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    const index = config.faq.findIndex(f => f.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'FAQ não encontrado' });
    }

    config.faq.splice(index, 1);
    await writeSiteConfig(config);
    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao deletar FAQ:', error);
    res.status(500).json({ error: 'Erro ao deletar FAQ' });
  }
});

// ==================== SITES DA IGREJA ====================

router.get('/site/sites-igreja', async (req, res) => {
  try {
    const config = await readSiteConfig();
    res.json(config?.sitesIgreja || []);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar sites' });
  }
});

router.post('/site/sites-igreja', requireAuth, uploadMateria, async (req, res) => {
  try {
    const { nome, url, ordem } = req.body;
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    if (!nome || !url) {
      return res.status(400).json({ error: 'Nome e URL são obrigatórios' });
    }

    const novaImagem = req.file 
      ? `/uploads/materias/${req.file.filename}`
      : req.body.imagem;

    const novoId = config.sitesIgreja.length > 0
      ? Math.max(...config.sitesIgreja.map(s => s.id)) + 1
      : 1;

    config.sitesIgreja.push({
      id: novoId,
      nome,
      url,
      imagem: novaImagem || '',
      ordem: ordem ? parseInt(ordem) : config.sitesIgreja.length + 1,
      ativo: true
    });

    await writeSiteConfig(config);
    res.json({ ok: true, site: config.sitesIgreja[config.sitesIgreja.length - 1] });
  } catch (error) {
    console.error('Erro ao criar site:', error);
    res.status(500).json({ error: 'Erro ao criar site' });
  }
});

router.put('/site/sites-igreja/:id', requireAuth, uploadMateria, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nome, url, ordem, ativo } = req.body;
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    const index = config.sitesIgreja.findIndex(s => s.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Site não encontrado' });
    }

    if (nome) config.sitesIgreja[index].nome = nome;
    if (url) config.sitesIgreja[index].url = url;
    if (req.file) config.sitesIgreja[index].imagem = `/uploads/materias/${req.file.filename}`;
    if (ordem !== undefined) config.sitesIgreja[index].ordem = parseInt(ordem);
    if (ativo !== undefined) config.sitesIgreja[index].ativo = ativo === 'true' || ativo === true;

    await writeSiteConfig(config);
    res.json({ ok: true, site: config.sitesIgreja[index] });
  } catch (error) {
    console.error('Erro ao atualizar site:', error);
    res.status(500).json({ error: 'Erro ao atualizar site' });
  }
});

router.delete('/site/sites-igreja/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    const index = config.sitesIgreja.findIndex(s => s.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Site não encontrado' });
    }

    config.sitesIgreja.splice(index, 1);
    await writeSiteConfig(config);
    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao deletar site:', error);
    res.status(500).json({ error: 'Erro ao deletar site' });
  }
});

// ==================== TEXTOS ====================

router.get('/site/textos', async (req, res) => {
  try {
    const config = await readSiteConfig();
    res.json(config?.textos || {});
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter textos' });
  }
});

router.put('/site/textos/sobre-jornal', requireAuth, uploadMateria, async (req, res) => {
  try {
    const { titulo, subtitulo, conteudo } = req.body;
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    if (titulo) config.textos.sobreJornal.titulo = titulo;
    if (subtitulo) config.textos.sobreJornal.subtitulo = subtitulo;
    if (conteudo) config.textos.sobreJornal.conteudo = conteudo;
    if (req.file) config.textos.sobreJornal.imagem = `/uploads/materias/${req.file.filename}`;

    await writeSiteConfig(config);
    res.json({ ok: true, texto: config.textos.sobreJornal });
  } catch (error) {
    console.error('Erro ao atualizar texto:', error);
    res.status(500).json({ error: 'Erro ao atualizar texto' });
  }
});

router.put('/site/textos/sobre-igreja', requireAuth, uploadMateria, async (req, res) => {
  try {
    const { titulo, subtitulo, conteudo } = req.body;
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    if (titulo) config.textos.sobreIgreja.titulo = titulo;
    if (subtitulo) config.textos.sobreIgreja.subtitulo = subtitulo;
    if (conteudo) config.textos.sobreIgreja.conteudo = conteudo;
    if (req.file) config.textos.sobreIgreja.imagem = `/uploads/materias/${req.file.filename}`;

    await writeSiteConfig(config);
    res.json({ ok: true, texto: config.textos.sobreIgreja });
  } catch (error) {
    console.error('Erro ao atualizar texto:', error);
    res.status(500).json({ error: 'Erro ao atualizar texto' });
  }
});

// ==================== BANNER MODAL ====================

router.get('/site/banner-modal', async (req, res) => {
  try {
    const config = await readSiteConfig();
    res.json(config?.bannerModal || {});
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter banner' });
  }
});

router.put('/site/banner-modal', requireAuth, uploadMateria, async (req, res) => {
  try {
    const { link, ativo } = req.body;
    const config = await readSiteConfig();
    
    if (!config) {
      return res.status(500).json({ error: 'Erro ao ler configuração' });
    }

    if (req.file) config.bannerModal.imagem = `/uploads/materias/${req.file.filename}`;
    if (link) config.bannerModal.link = link;
    if (ativo !== undefined) config.bannerModal.ativo = ativo === 'true' || ativo === true;

    await writeSiteConfig(config);
    res.json({ ok: true, banner: config.bannerModal });
  } catch (error) {
    console.error('Erro ao atualizar banner:', error);
    res.status(500).json({ error: 'Erro ao atualizar banner' });
  }
});

// ==================== NOTÍCIAS/MATÉRIAS ====================

// Rota para o site público (compatibilidade)
router.get('/site/noticias', async (req, res) => {
  try {
    // Buscando notícias para o site público
    let materias = await readMaterias();
    
    // Ordenar por data de criação/publicação em ordem decrescente (mais recente primeiro)
    materias = materias.sort((a, b) => {
      // Priorizar created_at se existir
      if (a.created_at && b.created_at) {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      if (a.created_at && !b.created_at) return -1;
      if (!a.created_at && b.created_at) return 1;
      
      // Se não tiver created_at, usar date
      if (a.date && b.date) {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA; // Mais recente primeiro
      }
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      
      // Por último, usar ID (maior ID = mais recente)
      return (b.id || 0) - (a.id || 0);
    });
    
    // Notícias encontradas e ordenadas
    res.json(materias);
  } catch (error) {
    console.error('❌ Erro ao listar notícias:', error);
    res.status(500).json({ error: 'Erro ao listar notícias' });
  }
});

// Rota para o dashboard (admin)
router.get('/noticias', async (req, res) => {
  try {
    let materias = await readMaterias();
    
    // Ordenar por data de criação/publicação em ordem decrescente (mais recente primeiro)
    materias = materias.sort((a, b) => {
      // Priorizar created_at se existir
      if (a.created_at && b.created_at) {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      if (a.created_at && !b.created_at) return -1;
      if (!a.created_at && b.created_at) return 1;
      
      // Se não tiver created_at, usar date
      if (a.date && b.date) {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA; // Mais recente primeiro
      }
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      
      // Por último, usar ID (maior ID = mais recente)
      return (b.id || 0) - (a.id || 0);
    });
    
    res.json(materias);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar notícias' });
  }
});

router.get('/noticias/:id', async (req, res) => {
  try {
    const materias = await readMaterias();
    const materia = materias.find(m => m.id === parseInt(req.params.id));
    
    if (!materia) {
      return res.status(404).json({ error: 'Notícia não encontrada' });
    }
    
    res.json(materia);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter notícia' });
  }
});

router.post('/noticias', requireAuth, uploadMateria, async (req, res) => {
  try {
    const { title, date, category, content, excerpt, tag } = req.body;
    
    // Criando nova notícia
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Título e conteúdo são obrigatórios' });
    }

    // Obter próximo ID
    const materias = await readMaterias();
    
    const novoId = materias.length > 0
      ? Math.max(...materias.map(m => m.id || 0)) + 1
      : 1;

    const agora = new Date().toISOString();
    const novaMateria = {
      id: novoId,
      title,
      date: date || agora.split('T')[0],
      category: category || 'geral',
      content,
      excerpt: excerpt || '',
      tag: tag || '',
      image: req.file ? `/uploads/materias/${req.file.filename}` : '',
      created_at: agora // Timestamp de criação
    };

    // Salvar no MySQL e JSON
    const materiaSalva = await saveMateria(novaMateria, false);
    
    console.log(`✅ Notícia criada com sucesso! ID: ${materiaSalva.id}`);
    res.json({ ok: true, materia: materiaSalva });
  } catch (error) {
    console.error('❌ Erro ao criar notícia:', error);
    res.status(500).json({ error: 'Erro ao criar notícia' });
  }
});

router.put('/noticias/:id', requireAuth, uploadMateria, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, date, category, content, excerpt, tag } = req.body;
    
    const materias = await readMaterias();
    const materiaAtual = materias.find(m => m.id === id);

    if (!materiaAtual) {
      return res.status(404).json({ error: 'Notícia não encontrada' });
    }

    // Preservar created_at se já existir
    const existingCreatedAt = materiaAtual.created_at;
    
    // Atualizar campos
    if (title) materiaAtual.title = title;
    if (date) materiaAtual.date = date;
    if (category) materiaAtual.category = category;
    if (content) materiaAtual.content = content;
    if (excerpt !== undefined) materiaAtual.excerpt = excerpt;
    if (tag !== undefined) materiaAtual.tag = tag;
    if (req.file) materiaAtual.image = `/uploads/materias/${req.file.filename}`;
    
    // Garantir que created_at seja preservado
    if (existingCreatedAt) {
      materiaAtual.created_at = existingCreatedAt;
    } else if (!materiaAtual.created_at) {
      materiaAtual.created_at = materiaAtual.date 
        ? new Date(materiaAtual.date).toISOString()
        : new Date().toISOString();
    }

    // Salvar no MySQL e JSON
    const materiaAtualizada = await saveMateria(materiaAtual, true);
    res.json({ ok: true, materia: materiaAtualizada });
  } catch (error) {
    console.error('Erro ao atualizar notícia:', error);
    res.status(500).json({ error: 'Erro ao atualizar notícia' });
  }
});

router.delete('/noticias/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const materias = await readMaterias();
    const materia = materias.find(m => m.id === id);

    if (!materia) {
      return res.status(404).json({ error: 'Notícia não encontrada' });
    }

    // Deletar do MySQL e JSON
    await deleteMateria(id);

    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao deletar notícia:', error);
    res.status(500).json({ error: 'Erro ao deletar notícia' });
  }
});

// ==================== PAGAMENTOS ====================

// Funções auxiliares para trabalhar com pagamentos.json
async function readPagamentos() {
  try {
    const exists = await fs.pathExists(PAGAMENTOS_FILE);
    if (!exists) {
      await fs.writeJson(PAGAMENTOS_FILE, { pagamentos: [] }, { spaces: 2, encoding: 'utf8' });
      return { pagamentos: [] };
    }
    return await fs.readJson(PAGAMENTOS_FILE, { encoding: 'utf8' });
  } catch (error) {
    console.error('Erro ao ler pagamentos.json:', error);
    return { pagamentos: [] };
  }
}

async function writePagamentos(data) {
  try {
    const dir = path.dirname(PAGAMENTOS_FILE);
    await fs.ensureDir(dir);
    await fs.writeJson(PAGAMENTOS_FILE, data, { spaces: 2, encoding: 'utf8' });
    return true;
  } catch (error) {
    console.error('Erro ao escrever pagamentos.json:', error);
    throw error;
  }
}

// Rota para atualizar valor de pagamentos existentes com valor 0
router.post('/pagamentos/atualizar-valores', requireAuth, async (req, res) => {
  try {
    // Buscar todos os pagamentos com valor 0
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM pagamentos WHERE valor = 0 OR valor IS NULL'
      );
      
      let atualizados = 0;
      
      // Para cada pagamento, buscar o valor do Stripe
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      
      for (const pagamento of rows) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(pagamento.paymentIntentId);
          if (paymentIntent.amount) {
            const valorCorreto = paymentIntent.amount / 100;
            await pool.execute(
              'UPDATE pagamentos SET valor = ? WHERE id = ?',
              [valorCorreto, pagamento.id]
            );
            atualizados++;
            console.log(`✅ Atualizado pagamento ${pagamento.id}: R$ ${valorCorreto}`);
          }
        } catch (err) {
          console.error(`Erro ao atualizar pagamento ${pagamento.id}:`, err.message);
        }
      }
      
      return res.json({ message: `${atualizados} pagamentos atualizados` });
    } catch (dbError) {
      console.error('Erro ao atualizar valores:', dbError.message);
      return res.status(500).json({ error: 'Erro ao atualizar valores' });
    }
  } catch (error) {
    console.error('Erro ao atualizar valores:', error);
    res.status(500).json({ error: 'Erro ao atualizar valores' });
  }
});

// Rota para obter todos os pagamentos (requer autenticação)
router.get('/pagamentos', requireAuth, async (req, res) => {
  try {
    console.log('📥 Buscando pagamentos...');
    // Tentar buscar do MySQL primeiro
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM pagamentos ORDER BY dataPagamento DESC, dataCriacao DESC'
      );
      console.log(`✅ ${rows.length} pagamentos encontrados no MySQL`);
      return res.json(rows);
    } catch (dbError) {
      console.error('❌ Erro ao buscar pagamentos do MySQL:', dbError.message);
      console.error('❌ Stack:', dbError.stack);
      console.error('❌ Código do erro:', dbError.code);
      
      // Se a tabela não existe, tentar criar automaticamente
      if (dbError.message.includes("doesn't exist") || dbError.message.includes("Table")) {
        console.log('🔧 Tentando criar tabela pagamentos automaticamente...');
        try {
          const { initDatabase } = require('../config/init-database');
          await initDatabase(pool);
          // Tentar buscar novamente após criar a tabela
          const [rows] = await pool.execute(
            'SELECT * FROM pagamentos ORDER BY dataPagamento DESC, dataCriacao DESC'
          );
          console.log(`✅ ${rows.length} pagamentos encontrados após criar tabela`);
          return res.json(rows);
        } catch (createError) {
          console.error('❌ Erro ao criar tabelas automaticamente:', createError.message);
        }
      }
      
      // Fallback para JSON
      console.log('⚠️ Usando fallback JSON...');
      const data = await readPagamentos();
      const pagamentosJSON = data.pagamentos || [];
      console.log(`✅ ${pagamentosJSON.length} pagamentos encontrados no JSON`);
      return res.json(pagamentosJSON);
    }
  } catch (error) {
    console.error('❌ Erro ao buscar pagamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar pagamentos', message: error.message });
  }
});

// Rota para deletar um pagamento (requer autenticação)
router.delete('/pagamentos/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const paymentId = parseInt(id);
    
    console.log('🗑️ Tentando deletar pagamento:', { id, paymentId, idType: typeof id });
    
    if (!paymentId || isNaN(paymentId)) {
      console.error('❌ ID inválido:', id);
      return res.status(400).json({ error: 'ID do pagamento inválido' });
    }
    
    // Tentar deletar do MySQL primeiro
    try {
      const [result] = await pool.execute(
        'DELETE FROM pagamentos WHERE id = ?',
        [paymentId]
      );
      
      console.log('📊 Resultado do MySQL:', { affectedRows: result.affectedRows, insertId: result.insertId });
      
      if (result.affectedRows === 0) {
        console.warn('⚠️ Pagamento não encontrado no MySQL:', paymentId);
        // Tentar fallback para JSON
        const data = await readPagamentos();
        const pagamentos = data.pagamentos || [];
        
        const index = pagamentos.findIndex(p => p.id === paymentId);
        if (index === -1) {
        return res.status(404).json({ error: 'Pagamento não encontrado' });
      }
      
        pagamentos.splice(index, 1);
        await writePagamentos({ pagamentos });
        
        console.log('✅ Pagamento deletado do JSON:', paymentId);
        return res.json({ ok: true, message: 'Pagamento deletado com sucesso' });
      }
      
      // Pagamento deletado do MySQL
      return res.json({ ok: true, message: 'Pagamento deletado com sucesso' });
      
    } catch (dbError) {
      console.error('❌ Erro ao deletar pagamento do MySQL:', dbError.message);
      console.error('❌ Stack:', dbError.stack);
      
      // Fallback para JSON
      try {
      const data = await readPagamentos();
      const pagamentos = data.pagamentos || [];
      
        const index = pagamentos.findIndex(p => p.id === paymentId);
      if (index === -1) {
        return res.status(404).json({ error: 'Pagamento não encontrado' });
      }
      
      pagamentos.splice(index, 1);
      await writePagamentos({ pagamentos });
      
        console.log('✅ Pagamento deletado do JSON:', paymentId);
        return res.json({ ok: true, message: 'Pagamento deletado com sucesso' });
      } catch (jsonError) {
        console.error('❌ Erro ao deletar do JSON:', jsonError.message);
        throw jsonError;
      }
    }
  } catch (error) {
    console.error('❌ Erro ao deletar pagamento:', error);
    console.error('❌ Stack:', error.stack);
    res.status(500).json({ error: 'Erro ao deletar pagamento: ' + error.message });
  }
});

// Rota para salvar um novo pagamento (pública para ser chamada pelo checkout)
router.post('/pagamentos', async (req, res) => {
  try {
    const { paymentIntentId, nome, email, jornalId, jornalNome, valor, moeda, dataPagamento } = req.body;
    
    console.log('📥 Recebendo pagamento:', { paymentIntentId, nome, email, jornalId, valor });
    console.log('📥 Valor recebido (tipo):', typeof valor, 'Valor:', valor);
    
    // Validar paymentIntentId - não pode ser vazio ou apenas espaços
    if (!paymentIntentId || typeof paymentIntentId !== 'string' || paymentIntentId.trim() === '') {
      return res.status(400).json({ error: 'paymentIntentId é obrigatório e não pode estar vazio' });
    }
    
    // Garantir que paymentIntentId não está vazio após trim
    const paymentIntentIdFinal = paymentIntentId.trim();
    
    // Validar e fornecer valores padrão para campos opcionais
    const nomeFinal = nome || 'Cliente';
    const emailFinal = email || 'cliente@email.com';
    const jornalIdFinal = jornalId || '1';
    const jornalNomeFinal = jornalNome || 'Jornal do Reino dos Céus';
    
    // Se o valor for 0 ou não fornecido, tentar buscar do Stripe
    let valorFinal = (valor !== undefined && valor !== null && valor !== '') ? parseFloat(valor) : 0;
    
    if (valorFinal === 0 && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent && paymentIntent.amount) {
          valorFinal = paymentIntent.amount / 100; // Converter de centavos para reais
          console.log('💰 Valor obtido do Stripe:', valorFinal);
        }
      } catch (stripeError) {
        console.log('⚠️ Não foi possível buscar valor do Stripe, usando valor fornecido:', stripeError.message);
      }
    }
    
    console.log('📥 Valor final calculado:', valorFinal);
    const moedaFinal = moeda || 'BRL';
    const dataPagamentoFinal = dataPagamento || new Date().toISOString();
    const dataCriacaoFinal = new Date().toISOString();
    
    // Tentar salvar no MySQL primeiro
    try {
      // Verificar quais colunas existem na tabela (paymentIntentId ou stripe_payment_id)
      let columnName = 'paymentIntentId';
      let columnExists = false;
      let stripeColumnExists = false;
      
      try {
        const [columns] = await pool.execute(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'pagamentos' 
           AND (COLUMN_NAME = 'paymentIntentId' OR COLUMN_NAME = 'stripe_payment_id')`
        );
        
        columnExists = columns.some(col => col.COLUMN_NAME === 'paymentIntentId');
        stripeColumnExists = columns.some(col => col.COLUMN_NAME === 'stripe_payment_id');
        
        // Se existe stripe_payment_id mas não paymentIntentId, tentar corrigir automaticamente
        if (!columnExists && stripeColumnExists) {
          console.log('🔧 Detectada coluna stripe_payment_id. Tentando corrigir estrutura da tabela...');
          try {

            // Primeiro, verificar se há foreign keys que precisam ser removidas
            const [fks] = await pool.execute(
              `SELECT CONSTRAINT_NAME 
               FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
               WHERE TABLE_SCHEMA = DATABASE() 
               AND TABLE_NAME = 'pagamentos' 
               AND REFERENCED_TABLE_NAME IS NOT NULL`
            );
            
            // Remover foreign keys temporariamente
            for (const fk of fks) {
              try {
                await pool.execute(`ALTER TABLE pagamentos DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
                console.log(`🔧 Foreign key ${fk.CONSTRAINT_NAME} removida temporariamente`);
              } catch (fkError) {
                console.warn(`⚠️ Erro ao remover FK ${fk.CONSTRAINT_NAME}:`, fkError.message);
              }
            }
            
            // Remover registros com stripe_payment_id vazio ou NULL (causam ER_DUP_ENTRY)
            const [deleted] = await pool.execute(`DELETE FROM pagamentos WHERE stripe_payment_id IS NULL OR stripe_payment_id = ''`);
            console.log(`🔧 ${deleted.affectedRows} registros vazios removidos`);

            // Remover registros com stripe_payment_id vazio ou NULL
            await pool.execute(`DELETE FROM pagamentos WHERE stripe_payment_id IS NULL OR stripe_payment_id = ''`);

            
            // Renomear coluna stripe_payment_id para paymentIntentId
            await pool.execute(`ALTER TABLE pagamentos CHANGE COLUMN stripe_payment_id paymentIntentId VARCHAR(255) NOT NULL UNIQUE`);
            

            // Recriar foreign keys se necessário
            // (Normalmente não há FK em stripe_payment_id, mas verificamos)
            


            // Adicionar índice se não existir
            try {
              await pool.execute(`CREATE INDEX idx_paymentIntentId ON pagamentos(paymentIntentId)`);
            } catch (idxError) {
              // Índice pode já existir, ignorar
            }
            
            columnName = 'paymentIntentId';
            columnExists = true;
            console.log('✅ Estrutura da tabela corrigida automaticamente!');
          } catch (fixError) {
            console.error('❌ Erro ao corrigir estrutura automaticamente:', fixError.message);

            console.error('❌ Stack:', fixError.stack);

            console.warn('⚠️ Usando fallback JSON. Execute o script fix-stripe-payment-id.sql manualmente.');
            // Forçar uso do fallback JSON
            columnExists = false;
          }

        } else if (stripeColumnExists && columnExists) {
          // Se ambas existem, limpar registros vazios de stripe_payment_id
          console.log('🔧 Ambas as colunas existem. Limpando registros vazios...');
          try {
            const [deleted] = await pool.execute(`DELETE FROM pagamentos WHERE stripe_payment_id IS NULL OR stripe_payment_id = ''`);
            console.log(`🔧 ${deleted.affectedRows} registros vazios removidos de stripe_payment_id`);
          } catch (cleanError) {
            console.warn('⚠️ Erro ao limpar registros vazios:', cleanError.message);
          }
        } else if (columnExists) {
          // Se só paymentIntentId existe, limpar registros vazios também
          console.log('🔧 Limpando registros com paymentIntentId vazio...');
          try {
            const [deleted] = await pool.execute(`DELETE FROM pagamentos WHERE paymentIntentId IS NULL OR paymentIntentId = ''`);
            console.log(`🔧 ${deleted.affectedRows} registros vazios removidos de paymentIntentId`);
          } catch (cleanError) {
            console.warn('⚠️ Erro ao limpar registros vazios:', cleanError.message);
          }
        } else if (stripeColumnExists && !columnExists) {
          // Se só stripe_payment_id existe (renomeação falhou ou não foi feita), limpar registros vazios
          console.log('🔧 Só stripe_payment_id existe. Limpando registros vazios antes de inserir...');
          try {
            const [deleted] = await pool.execute(`DELETE FROM pagamentos WHERE stripe_payment_id IS NULL OR stripe_payment_id = ''`);
            console.log(`🔧 ${deleted.affectedRows} registros vazios removidos de stripe_payment_id`);
          } catch (cleanError) {
            console.warn('⚠️ Erro ao limpar registros vazios:', cleanError.message);
          }


        }
      } catch (checkError) {
        console.warn('⚠️ Erro ao verificar colunas, assumindo que não existem:', checkError.message);
      }
      
      // Verificar se o pagamento já existe
      let existing = [];
      if (columnExists) {

        // Usar o nome da coluna correto (já foi renomeado se necessário)


        [existing] = await pool.execute(
          `SELECT * FROM pagamentos WHERE ${columnName} = ?`,
          [paymentIntentIdFinal]
        );
      } else if (stripeColumnExists) {
        // Se só existe stripe_payment_id (antes da renomeação), usar esse nome temporariamente
        [existing] = await pool.execute(
          `SELECT * FROM pagamentos WHERE stripe_payment_id = ?`,
          [paymentIntentIdFinal]
        );


      } else {
        console.warn('⚠️ Coluna paymentIntentId ou stripe_payment_id não existe na tabela pagamentos. Execute o script fix-stripe-payment-id.sql');
      }
      
      if (existing.length > 0) {
        // Se o pagamento existente tem valor 0 e o novo tem valor, atualizar
        if (existing[0].valor === 0 && valorFinal > 0) {
          // Atualizando valor do pagamento existente
          await pool.execute(
            `UPDATE pagamentos SET valor = ? WHERE ${columnName} = ?`,
            [valorFinal, paymentIntentIdFinal]
          );
          // Buscar o pagamento atualizado
          const [updated] = await pool.execute(
            `SELECT * FROM pagamentos WHERE ${columnName} = ?`,
            [paymentIntentIdFinal]
          );
          return res.json({ message: 'Valor do pagamento atualizado', pagamento: updated[0] });
        }
        return res.json({ message: 'Pagamento já registrado', pagamento: existing[0] });
      }
      
      // Inserir no MySQL (só se a coluna existir)
      if (columnExists || stripeColumnExists) {
        // Determinar qual coluna usar para inserção
        const insertColumn = columnExists ? columnName : 'stripe_payment_id';
        
        console.log(`💾 Inserindo pagamento usando coluna: ${insertColumn}`);
        
        const [result] = await pool.execute(
          `INSERT INTO pagamentos (${insertColumn}, nome, email, jornalId, jornalNome, valor, moeda, dataPagamento, dataCriacao) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [paymentIntentIdFinal, nomeFinal, emailFinal, jornalIdFinal, jornalNomeFinal, valorFinal, moedaFinal, dataPagamentoFinal, dataCriacaoFinal]
        );
      
        // Buscar o pagamento inserido
        const [inserted] = await pool.execute(
          'SELECT * FROM pagamentos WHERE id = ?',
          [result.insertId]
        );
      
        console.log('✅ Pagamento registrado no MySQL:', inserted[0]);
        return res.json({ message: 'Pagamento registrado com sucesso', pagamento: inserted[0] });
      } else {
        // Se nenhuma coluna existe, forçar erro para cair no fallback JSON
        throw new Error('Coluna paymentIntentId ou stripe_payment_id não existe. Execute o script fix-pagamentos.sql');
      }
      
    } catch (dbError) {
      console.error('❌ Erro ao salvar pagamento no MySQL:', dbError.message);
      console.error('❌ Stack:', dbError.stack);
      console.error('❌ Código do erro:', dbError.code);
      
      // Se o erro for de duplicata (com stripe_payment_id ou paymentIntentId vazio), tentar corrigir
      if (dbError.code === 'ER_DUP_ENTRY' && (
        dbError.message.includes('stripe_payment_id') || 
        dbError.message.includes('paymentIntentId')
      )) {
        console.log('🔧 Tentando corrigir erro de duplicata...');
        try {
          // Verificar qual coluna existe
          const [columns] = await pool.execute(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'pagamentos' 
             AND (COLUMN_NAME = 'paymentIntentId' OR COLUMN_NAME = 'stripe_payment_id')`
          );
          
          const hasPaymentIntentId = columns.some(col => col.COLUMN_NAME === 'paymentIntentId');
          const hasStripePaymentId = columns.some(col => col.COLUMN_NAME === 'stripe_payment_id');
          
          // Se existe stripe_payment_id, limpar registros vazios e renomear
          if (hasStripePaymentId) {
            console.log('🔧 Removendo registros com stripe_payment_id vazio...');
            await pool.execute(`DELETE FROM pagamentos WHERE stripe_payment_id IS NULL OR stripe_payment_id = ''`);
            
            if (!hasPaymentIntentId) {
              console.log('🔧 Renomeando coluna stripe_payment_id para paymentIntentId...');
              try {
                await pool.execute(`ALTER TABLE pagamentos CHANGE COLUMN stripe_payment_id paymentIntentId VARCHAR(255) NOT NULL UNIQUE`);
                console.log('✅ Coluna renomeada com sucesso!');
              } catch (renameError) {
                console.warn('⚠️ Erro ao renomear coluna (pode já ter sido renomeada):', renameError.message);
              }
            }
          } else if (hasPaymentIntentId) {
            // Se só existe paymentIntentId, limpar registros vazios
            console.log('🔧 Removendo registros com paymentIntentId vazio...');
            await pool.execute(`DELETE FROM pagamentos WHERE paymentIntentId IS NULL OR paymentIntentId = ''`);
          }
          
          // Tentar inserir novamente
          console.log('🔄 Tentando inserir novamente após correção...');
          const [result] = await pool.execute(
            `INSERT INTO pagamentos (paymentIntentId, nome, email, jornalId, jornalNome, valor, moeda, dataPagamento, dataCriacao) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [paymentIntentIdFinal, nomeFinal, emailFinal, jornalIdFinal, jornalNomeFinal, valorFinal, moedaFinal, dataPagamentoFinal, dataCriacaoFinal]
          );
          
          const [inserted] = await pool.execute(
            'SELECT * FROM pagamentos WHERE id = ?',
            [result.insertId]
          );
          
          console.log('✅ Pagamento inserido após correção!');
          return res.json({ message: 'Pagamento registrado com sucesso', pagamento: inserted[0] });
        } catch (fixError) {
          console.error('❌ Erro ao tentar corrigir:', fixError.message);
          console.error('❌ Stack da correção:', fixError.stack);
          // Continuar para o fallback JSON
        }
      }
      
      // Fallback para JSON se MySQL falhar
      const data = await readPagamentos();
      const pagamentos = data.pagamentos || [];
      
      // Verificar se o pagamento já existe
      const pagamentoExistente = pagamentos.find(p => p.paymentIntentId === paymentIntentIdFinal);
      if (pagamentoExistente) {
        // Se o pagamento existente tem valor 0 e o novo tem valor, atualizar
        if (pagamentoExistente.valor === 0 && valorFinal > 0) {
          // Atualizando valor do pagamento existente (JSON)
          pagamentoExistente.valor = valorFinal;
          await writePagamentos({ pagamentos });
          return res.json({ message: 'Valor do pagamento atualizado', pagamento: pagamentoExistente });
        }
        return res.json({ message: 'Pagamento já registrado', pagamento: pagamentoExistente });
      }
      
      // Criar novo pagamento
      const novoPagamento = {
        id: pagamentos.length > 0 ? Math.max(...pagamentos.map(p => p.id)) + 1 : 1,
        paymentIntentId: paymentIntentIdFinal,
        nome: String(nomeFinal),
        email: String(emailFinal),
        jornalId: String(jornalIdFinal),
        jornalNome: String(jornalNomeFinal),
        valor: valorFinal,
        moeda: moedaFinal,
        dataPagamento: dataPagamentoFinal,
        dataCriacao: dataCriacaoFinal
      };
      
      pagamentos.push(novoPagamento);
      await writePagamentos({ pagamentos });
      
      console.log('✅ Pagamento registrado em JSON (fallback):', novoPagamento.id);
      return res.json({ message: 'Pagamento registrado com sucesso', pagamento: novoPagamento });
    }
  } catch (error) {
    console.error('Erro ao salvar pagamento:', error);
    res.status(500).json({ error: 'Erro ao salvar pagamento' });
  }
});

// ==================== COLUNISTAS ====================

// Listar todos os colunistas (público - para o site) - Rota /api/colunistas
router.get('/colunistas', async (req, res) => {
  try {
    console.log('📚 Buscando colunistas para o site público (rota /colunistas)...');
    const data = await readColunistas();
    // Retornar apenas colunistas ativos e ordenados para o site
    let colunistasAtivos = (data.colunistas || [])
      .filter(c => c.ativo !== false)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    
    // Normalizar URLs das imagens - remover localhost:3000 hardcoded
    colunistasAtivos = colunistasAtivos.map(colunista => {
      if (colunista.imagem && typeof colunista.imagem === 'string') {
        // Remover http://localhost:3000 ou https://localhost:3000
        colunista.imagem = colunista.imagem.replace(/https?:\/\/localhost:3000/g, '');
        // Garantir que comece com / se não for URL externa
        if (!colunista.imagem.startsWith('http') && !colunista.imagem.startsWith('/')) {
          colunista.imagem = '/' + colunista.imagem;
        }
      }
      return colunista;
    });
    
    console.log(`✅ ${colunistasAtivos.length} colunistas ativos encontrados`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({ colunistas: colunistasAtivos });
  } catch (error) {
    console.error('❌ Erro ao listar colunistas:', error);
    res.status(500).json({ error: 'Erro ao listar colunistas' });
  }
});

// Listar todos os colunistas (público - para o site) - Rota /api/site/colunistas (compatibilidade)
router.get('/site/colunistas', async (req, res) => {
  try {
    console.log('📚 Buscando colunistas para o site público (rota /site/colunistas)...');
    const data = await readColunistas();
    // Retornar apenas colunistas ativos e ordenados para o site
    let colunistasAtivos = (data.colunistas || [])
      .filter(c => c.ativo !== false)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    
    // Normalizar URLs das imagens - remover localhost:3000 hardcoded
    colunistasAtivos = colunistasAtivos.map(colunista => {
      if (colunista.imagem && typeof colunista.imagem === 'string') {
        // Remover http://localhost:3000 ou https://localhost:3000
        colunista.imagem = colunista.imagem.replace(/https?:\/\/localhost:3000/g, '');
        // Garantir que comece com / se não for URL externa
        if (!colunista.imagem.startsWith('http') && !colunista.imagem.startsWith('/')) {
          colunista.imagem = '/' + colunista.imagem;
        }
      }
      return colunista;
    });
    
    console.log(`✅ ${colunistasAtivos.length} colunistas ativos encontrados`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.json({ colunistas: colunistasAtivos });
  } catch (error) {
    console.error('❌ Erro ao listar colunistas:', error);
    res.status(500).json({ error: 'Erro ao listar colunistas' });
  }
});

// Listar todos os colunistas (admin - retorna todos incluindo inativos)
router.get('/admin/colunistas', requireAuth, async (req, res) => {
  try {
    const data = await readColunistas();
    let colunistas = data.colunistas || [];
    
    // Normalizar URLs das imagens - remover localhost:3000 hardcoded
    colunistas = colunistas.map(colunista => {
      if (colunista.imagem && typeof colunista.imagem === 'string') {
        // Remover http://localhost:3000 ou https://localhost:3000
        colunista.imagem = colunista.imagem.replace(/https?:\/\/localhost:3000/g, '');
        // Garantir que comece com / se não for URL externa
        if (!colunista.imagem.startsWith('http') && !colunista.imagem.startsWith('/')) {
          colunista.imagem = '/' + colunista.imagem;
        }
      }
      return colunista;
    });
    
    res.json({ colunistas });
  } catch (error) {
    console.error('Erro ao listar colunistas:', error);
    res.status(500).json({ error: 'Erro ao listar colunistas' });
  }
});

// Obter um colunista específico
router.get('/colunistas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const data = await readColunistas();
    const colunista = data.colunistas.find(c => c.id === parseInt(id));
    
    if (!colunista) {
      return res.status(404).json({ error: 'Colunista não encontrado' });
    }
    
    res.json(colunista);
  } catch (error) {
    console.error('Erro ao obter colunista:', error);
    res.status(500).json({ error: 'Erro ao obter colunista' });
  }
});

// Criar novo colunista
router.post('/colunistas', requireAuth, async (req, res) => {
  try {
    const { nome, coluna, conteudo, instagram, ordem, ativo } = req.body;
    
    // Criando novo colunista
    console.log('   Nome:', nome);
    console.log('   Coluna:', coluna);
    console.log('   Ativo:', ativo);
    
    if (!nome || !coluna || !conteudo) {
      return res.status(400).json({ error: 'Nome, coluna e conteúdo são obrigatórios' });
    }
    
    const data = await readColunistas();
    console.log(`   Total de colunistas antes: ${data.colunistas.length}`);
    
    // Gerar ID único
    const newId = data.colunistas.length > 0 
      ? Math.max(...data.colunistas.map(c => c.id)) + 1 
      : 1;
    
    const novoColunista = {
      id: newId,
      nome: nome.trim(),
      coluna: coluna.trim(),
      conteudo: conteudo.trim(),
      instagram: instagram ? instagram.trim() : '',
      ordem: ordem || 0,
      ativo: ativo !== false,
      imagem: req.body.imagem || '',
      dataCriacao: new Date().toISOString(),
      dataAtualizacao: new Date().toISOString()
    };
    
    data.colunistas.push(novoColunista);
    await writeColunistas(data);
    
    console.log(`✅ Colunista criado com sucesso! ID: ${newId}`);
    console.log(`   Total de colunistas depois: ${data.colunistas.length}`);
    // Arquivo salvo
    
    res.status(201).json(novoColunista);
  } catch (error) {
    console.error('Erro ao criar colunista:', error);
    res.status(500).json({ error: 'Erro ao criar colunista' });
  }
});

// Atualizar colunista
router.put('/colunistas/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, coluna, conteudo, instagram, ordem, ativo, imagem } = req.body;
    
    const data = await readColunistas();
    const index = data.colunistas.findIndex(c => c.id === parseInt(id));
    
    if (index === -1) {
      return res.status(404).json({ error: 'Colunista não encontrado' });
    }
    
    // Atualizar campos
    if (nome !== undefined) data.colunistas[index].nome = nome.trim();
    if (coluna !== undefined) data.colunistas[index].coluna = coluna.trim();
    if (conteudo !== undefined) data.colunistas[index].conteudo = conteudo.trim();
    if (instagram !== undefined) data.colunistas[index].instagram = instagram.trim();
    if (ordem !== undefined) data.colunistas[index].ordem = ordem || 0;
    if (ativo !== undefined) data.colunistas[index].ativo = ativo !== false;
    if (imagem !== undefined) data.colunistas[index].imagem = imagem;
    
    data.colunistas[index].dataAtualizacao = new Date().toISOString();
    
    await writeColunistas(data);
    
    res.json(data.colunistas[index]);
  } catch (error) {
    console.error('Erro ao atualizar colunista:', error);
    res.status(500).json({ error: 'Erro ao atualizar colunista' });
  }
});

// Deletar colunista
router.delete('/colunistas/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const data = await readColunistas();
    const index = data.colunistas.findIndex(c => c.id === parseInt(id));
    
    if (index === -1) {
      return res.status(404).json({ error: 'Colunista não encontrado' });
    }
    
    data.colunistas.splice(index, 1);
    await writeColunistas(data);
    
    res.json({ message: 'Colunista deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar colunista:', error);
    res.status(500).json({ error: 'Erro ao deletar colunista' });
  }
});

// Upload de imagem do colunista
router.post('/colunistas/upload-imagem', requireAuth, uploadMateria, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada' });
    }
    
    const fileUrl = `/uploads/materias/${req.file.filename}`;
    res.json({ url: fileUrl, filename: req.file.filename });
  } catch (error) {
    console.error('Erro ao fazer upload de imagem:', error);
    res.status(500).json({ error: 'Erro ao fazer upload de imagem' });
  }
});

// ==================== ENDPOINT DE VERIFICAÇÃO DE BANCO ====================
// Endpoint para verificar conexão e estrutura do banco de dados
router.get('/api/db/check', async (req, res) => {
  try {
    // Testar conexão
    const connection = await pool.getConnection();
    const [dbInfo] = await connection.execute('SELECT DATABASE() as db, USER() as user, @@hostname as hostname');
    const dbName = dbInfo[0]?.db || 'desconhecido';
    const dbUser = dbInfo[0]?.user || 'desconhecido';
    const hostname = dbInfo[0]?.hostname || 'desconhecido';
    connection.release();
    
    // Verificar tabelas
    const [tables] = await pool.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME
    `);
    
    const existingTables = tables.map(t => t.TABLE_NAME);
    const requiredTables = ['jornais', 'videos', 'materias', 'pagamentos', 'carrossel', 'carrossel_medio', 'colunistas'];
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    // Verificar variáveis de ambiente
    const envConfig = {
      DB_HOST: process.env.DB_HOST || 'não definido',
      DB_USER: process.env.DB_USER || 'não definido',
      DB_NAME: process.env.DB_NAME || 'não definido',
      DB_PASSWORD: process.env.DB_PASSWORD ? '***' : 'não definido'
    };
    
    res.json({
      connected: true,
      database: {
        name: dbName,
        user: dbUser,
        hostname: hostname
      },
      tables: {
        existing: existingTables,
        required: requiredTables,
        missing: missingTables,
        allExist: missingTables.length === 0
      },
      environment: envConfig
    });
  } catch (error) {
    res.status(500).json({
      connected: false,
      error: error.message,
      environment: {
        DB_HOST: process.env.DB_HOST || 'não definido',
        DB_USER: process.env.DB_USER || 'não definido',
        DB_NAME: process.env.DB_NAME || 'não definido',
        DB_PASSWORD: process.env.DB_PASSWORD ? '***' : 'não definido'
      }
    });
  }
});

// Endpoint para inicializar/criar tabelas
router.post('/api/db/init', requireAuth, async (req, res) => {
  try {
    const { initDatabase, checkTables } = require('../config/init-database');
    const initialized = await initDatabase(pool);
    const tablesOk = await checkTables(pool);
    
    res.json({
      success: initialized && tablesOk,
      initialized,
      tablesOk
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
