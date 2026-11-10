const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const { uploadCapa, uploadCapaOptional, uploadMateria, uploadJornalFiles, uploadVideo } = require('../config/upload');
const pool = require('../config/database');

console.log('📦 Módulo de rotas do dashboard carregado');
console.log('🔐 Rota POST /login será registrada');

// Middleware de debug para TODAS as requisições
router.use((req, res, next) => {
  // Log TODAS as requisições para debug
  if (req.method === 'POST') {
    console.log('\n🔍 MIDDLEWARE DO ROUTER - Requisição POST detectada!');
    console.log('📥 Método:', req.method);
    console.log('📥 Path:', req.path);
    console.log('📥 URL original:', req.originalUrl);
  }
  next();
});

const JORNAIS_FILE = path.join(__dirname, '..', '..', 'jornais.json');
const SITE_CONFIG_FILE = path.join(__dirname, '..', '..', 'site-config.json');
const MATERIAS_FILE = path.join(__dirname, '..', '..', 'public', 'Noticias', 'materias.json');
const PAGAMENTOS_FILE = path.join(__dirname, '..', '..', 'pagamentos.json');
const COLUNISTAS_FILE = path.join(__dirname, '..', '..', 'colunistas.json');
const PRODUTOS_FILE = path.join(__dirname, '..', '..', 'produtos.json');

// Funções auxiliares para trabalhar com jornais.json
async function readJornais() {
  try {
    const exists = await fs.pathExists(JORNAIS_FILE);
    if (!exists) {
      await fs.writeJson(JORNAIS_FILE, { jornais: [] }, { spaces: 2 });
      return { jornais: [] };
    }
    return await fs.readJson(JORNAIS_FILE);
  } catch (error) {
    console.error('Erro ao ler jornais.json:', error);
    return { jornais: [] };
  }
}

async function writeJornais(data) {
  try {
    // Garantir que o diretório existe
    const dir = path.dirname(JORNAIS_FILE);
    await fs.ensureDir(dir);
    
    // Escrever arquivo
    await fs.writeJson(JORNAIS_FILE, data, { spaces: 2 });
    console.log('Arquivo jornais.json escrito com sucesso');
    return true;
  } catch (error) {
    console.error('Erro ao escrever jornais.json:', error);
    console.error('Caminho do arquivo:', JORNAIS_FILE);
    console.error('Stack:', error.stack);
    throw error; // Re-throw para ser capturado pelo try/catch da rota
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
    console.log('Arquivo colunistas.json escrito com sucesso');
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

// Login do painel
router.post('/login', async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    const loginValue = email || username;
    if (!loginValue || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Acesso do painel. Para trocar, defina ADMIN_EMAIL e ADMIN_PASS no arquivo .env
    // (recomendado no servidor de produção). Os valores abaixo são o padrão antigo.
    const adminEmail = (process.env.ADMIN_EMAIL || 'jornaldoreino545@gmail.com').trim().toLowerCase();
    const adminPass = process.env.ADMIN_PASS || 'Igrejareinodosceus1313';

    const emailOk = String(loginValue).trim().toLowerCase() === adminEmail;
    // Mantém a regra antiga: espaços digitados por engano na senha são ignorados
    const senhaDigitada = Buffer.from(String(password).replace(/\s+/g, ''));
    const senhaCerta = Buffer.from(adminPass);
    const senhaOk = senhaDigitada.length === senhaCerta.length && crypto.timingSafeEqual(senhaDigitada, senhaCerta);

    if (!emailOk || !senhaOk) {
      console.log('Login do painel recusado para', String(loginValue).trim().toLowerCase());
      return res.status(401).json({ error: 'Credenciais inválidas', message: 'Email ou senha incorretos.' });
    }

    req.session.authenticated = true;
    req.session.user = adminEmail;
    req.session.loginTime = new Date().toISOString();
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: 'Erro ao criar sessão' });
      console.log('Login do painel realizado:', adminEmail);
      res.json({ ok: true, user: adminEmail, message: 'Login realizado com sucesso' });
    });
  } catch (error) {
    console.error('Erro no login do painel:', error.message);
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
    console.log('Listando jornais...');
    const data = await readJornais();
    let jornaisList = data.jornais || [];
    
    // Se não estiver autenticado, filtrar apenas jornais ativos e ordenar
    if (!req.session || !req.session.authenticated) {
      jornaisList = jornaisList
        .filter(j => j.ativo !== false)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    }
    
    console.log(`Retornando ${jornaisList.length} jornais`);
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
  console.log('=== INICIANDO CRIAÇÃO DE JORNAL ===');
  console.log('Autenticado:', req.session?.authenticated);
  
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
    console.log('Processando criação do jornal...');
    console.log('Arquivos recebidos:', req.files);
    
    const { nome, mes, ano, descricao, linkCompra, ordem, ativo, preco } = req.body;
    
    if (!nome || !mes || !ano) {
      return res.status(400).json({ error: 'Nome, mês e ano são obrigatórios' });
    }
    
    // Verificar se PDF foi enviado (obrigatório para novos jornais)
    if (!req.files || !req.files.pdf || req.files.pdf.length === 0) {
      return res.status(400).json({ error: 'PDF é obrigatório para novos jornais' });
    }

    console.log('Lendo arquivo jornais.json...');
    const data = await readJornais();
    
    const novoId = data.jornais.length > 0 
      ? Math.max(...data.jornais.map(j => j.id)) + 1 
      : 1;

    // Obter nome dos arquivos
    const capaFile = req.files.capa && req.files.capa[0] ? req.files.capa[0] : null;
    const pdfFile = req.files.pdf && req.files.pdf[0] ? req.files.pdf[0] : null;

    const novoJornal = {
      id: novoId,
      nome: nome.trim().toUpperCase(),
      mes,
      ano: parseInt(ano),
      descricao: descricao || '',
      linkCompra: linkCompra || '',
      ordem: ordem ? parseInt(ordem) : novoId,
      ativo: ativo === 'true' || ativo === true,
      preco: preco !== undefined && preco !== '' && !isNaN(parseFloat(String(preco).replace(',', '.'))) ? parseFloat(String(preco).replace(',', '.')) : undefined,
      capa: capaFile ? `/uploads/capas/${capaFile.filename}` : '',
      pdf: pdfFile ? `/uploads/pdfs/${pdfFile.filename}` : '',
      dataCriacao: new Date().toISOString(),
      dataAtualizacao: new Date().toISOString()
    };

    console.log('Adicionando jornal ao array...');
    data.jornais.push(novoJornal);
    
    console.log('Salvando arquivo...');
    await writeJornais(data);
    
    console.log('Jornal criado com sucesso! ID:', novoId);
    res.json({ ok: true, jornal: novoJornal });
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
  console.log('=== INICIANDO ATUALIZAÇÃO DE JORNAL ===');
  console.log('Autenticado:', req.session?.authenticated);
  
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
    console.log('Processando atualização do jornal...');
    console.log('Arquivos recebidos:', req.files);
    const { nome, mes, ano, descricao, linkCompra, ordem, ativo, preco } = req.body;
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

    const data = await readJornais();
    const index = data.jornais.findIndex(j => j.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Jornal não encontrado' });
    }

    const jornalAtual = data.jornais[index];
    
    // Atualizar campos apenas se fornecidos
    if (nome !== undefined) jornalAtual.nome = nome.trim().toUpperCase();
    if (mes !== undefined) jornalAtual.mes = mes;
    if (ano !== undefined) jornalAtual.ano = parseInt(ano);
    if (descricao !== undefined) jornalAtual.descricao = descricao;
    if (preco !== undefined) {
      const valor = parseFloat(String(preco).replace(',', '.'));
      if (preco === '' || isNaN(valor)) delete jornalAtual.preco;
      else jornalAtual.preco = valor;
    }
    if (linkCompra !== undefined) jornalAtual.linkCompra = linkCompra;
    if (ordem !== undefined) jornalAtual.ordem = parseInt(ordem);
    if (ativo !== undefined) jornalAtual.ativo = ativo === 'true' || ativo === true;
    
    // Se nova capa foi enviada
    const capaFile = req.files && req.files.capa && req.files.capa[0] ? req.files.capa[0] : null;
    if (capaFile) {
      // Deletar capa antiga se existir
      if (jornalAtual.capa) {
        // Remove o prefixo /uploads se existir
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
        // Remove o prefixo /uploads se existir
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

    await writeJornais(data);
    res.json({ ok: true, jornal: jornalAtual });
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
    const index = data.jornais.findIndex(j => j.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Jornal não encontrado' });
    }

    const jornal = data.jornais[index];
    
    // Deletar capa se existir
    if (jornal.capa) {
      // Remove o prefixo /uploads se existir
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

    data.jornais.splice(index, 1);
    await writeJornais(data);

    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao deletar jornal:', error);
    res.status(500).json({ error: 'Erro ao deletar jornal' });
  }
});

// ==================== MATÉRIAS ====================

// Upload de matéria
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

async function readMaterias() {
  try {
    const exists = await fs.pathExists(MATERIAS_FILE);
    if (!exists) {
      await fs.writeJson(MATERIAS_FILE, [], { spaces: 2 });
      return [];
    }
    return await fs.readJson(MATERIAS_FILE);
  } catch (error) {
    console.error('Erro ao ler materias.json:', error);
    return [];
  }
}

async function writeMaterias(data) {
  try {
    await fs.writeJson(MATERIAS_FILE, data, { spaces: 2 });
    return true;
  } catch (error) {
    console.error('Erro ao escrever materias.json:', error);
    return false;
  }
}

// ==================== LOJA VIRTUAL (produtos) ====================
// Os produtos ficam em produtos.json. Não há checkout: o site leva o cliente
// para o WhatsApp configurado no dashboard.

async function lerProdutos() {
  try {
    if (!(await fs.pathExists(PRODUTOS_FILE))) {
      await fs.writeJson(PRODUTOS_FILE, { produtos: [] }, { spaces: 2 });
      return [];
    }
    const dados = await fs.readJson(PRODUTOS_FILE);
    return Array.isArray(dados.produtos) ? dados.produtos : [];
  } catch (error) {
    console.error('Erro ao ler produtos.json:', error);
    return [];
  }
}

async function salvarProdutos(produtos) {
  await fs.writeJson(PRODUTOS_FILE, { produtos }, { spaces: 2 });
}

function listaDeTexto(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
}

function numeroOuNulo(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

// Monta um produto só com os campos permitidos
function limparProduto(dados, atual) {
  const p = Object.assign({}, atual || {});
  if (dados.nome !== undefined) p.nome = String(dados.nome).trim();
  if (dados.categoria !== undefined) p.categoria = String(dados.categoria).trim();
  if (dados.descricao !== undefined) p.descricao = String(dados.descricao);
  if (dados.preco !== undefined) p.preco = numeroOuNulo(dados.preco);
  if (dados.precoAntigo !== undefined) p.precoAntigo = numeroOuNulo(dados.precoAntigo);
  if (dados.imagens !== undefined) p.imagens = listaDeTexto(dados.imagens);
  if (dados.tamanhos !== undefined) p.tamanhos = listaDeTexto(dados.tamanhos);
  if (dados.cores !== undefined) p.cores = listaDeTexto(dados.cores);
  if (dados.destaque !== undefined) p.destaque = dados.destaque === true || dados.destaque === 'true';
  if (dados.esgotado !== undefined) p.esgotado = dados.esgotado === true || dados.esgotado === 'true';
  if (dados.ativo !== undefined) p.ativo = !(dados.ativo === false || dados.ativo === 'false');
  if (dados.ordem !== undefined) p.ordem = parseInt(dados.ordem, 10) || 0;
  return p;
}

// Público: só produtos ativos
router.get('/loja/produtos', async (req, res) => {
  const produtos = (await lerProdutos()).filter((p) => p.ativo !== false);
  res.set('Cache-Control', 'no-cache');
  res.json(produtos);
});

router.get('/loja/produtos/:id', async (req, res) => {
  const produto = (await lerProdutos()).find((p) => String(p.id) === String(req.params.id) && p.ativo !== false);
  if (!produto) return res.status(404).json({ error: 'Produto não encontrado' });
  res.json(produto);
});

// Dashboard: todos os produtos (inclusive desativados)
router.get('/admin/loja/produtos', requireAuth, async (req, res) => {
  res.json(await lerProdutos());
});

router.post('/admin/loja/produtos', requireAuth, async (req, res) => {
  try {
    const dados = req.body || {};
    if (!dados.nome || !String(dados.nome).trim()) return res.status(400).json({ error: 'Informe o nome do produto' });
    const produtos = await lerProdutos();
    const novoId = produtos.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;
    const produto = limparProduto(Object.assign({ ativo: true, destaque: false, esgotado: false, ordem: novoId }, dados), {
      id: novoId,
      criadoEm: new Date().toISOString()
    });
    produtos.push(produto);
    await salvarProdutos(produtos);
    res.json({ ok: true, produto });
  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({ error: 'Erro ao criar produto' });
  }
});

router.put('/admin/loja/produtos/:id', requireAuth, async (req, res) => {
  try {
    const produtos = await lerProdutos();
    const i = produtos.findIndex((p) => String(p.id) === String(req.params.id));
    if (i === -1) return res.status(404).json({ error: 'Produto não encontrado' });
    produtos[i] = limparProduto(req.body || {}, produtos[i]);
    produtos[i].atualizadoEm = new Date().toISOString();
    if (!produtos[i].nome) return res.status(400).json({ error: 'Informe o nome do produto' });
    await salvarProdutos(produtos);
    res.json({ ok: true, produto: produtos[i] });
  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({ error: 'Erro ao atualizar produto' });
  }
});

router.delete('/admin/loja/produtos/:id', requireAuth, async (req, res) => {
  try {
    const produtos = await lerProdutos();
    const restantes = produtos.filter((p) => String(p.id) !== String(req.params.id));
    if (restantes.length === produtos.length) return res.status(404).json({ error: 'Produto não encontrado' });
    await salvarProdutos(restantes);
    res.json({ ok: true });
  } catch (error) {
    console.error('Erro ao excluir produto:', error);
    res.status(500).json({ error: 'Erro ao excluir produto' });
  }
});

// ==================== CONFIGURAÇÃO GERAL DO SITE ====================
// Contatos, frase do topo, textos das seções, oferta, rodapé, abertura em
// vídeo, tela de carregamento... (ver config/site-geral.js)

const { PADRAO: GERAL_PADRAO, combinar: combinarGeral } = require('../config/site-geral');

router.get('/site/config-geral', async (req, res) => {
  try {
    const config = await readSiteConfig();
    const geral = combinarGeral(GERAL_PADRAO, (config && config.geral) || {});
    // Formulário de contato (chave já existente no site-config.json)
    geral.formulario = Object.assign({ apiKey: '', redirectTo: '', ativo: true }, (config && config.formularioContato) || {});
    res.set('Cache-Control', 'no-cache');
    res.json(geral);
  } catch (error) {
    console.error('Erro ao ler configuração geral:', error);
    res.status(500).json({ error: 'Erro ao ler configuração geral' });
  }
});

router.put('/site/config-geral', requireAuth, async (req, res) => {
  try {
    const config = await readSiteConfig();
    if (!config) return res.status(500).json({ error: 'Erro ao ler configuração' });

    const recebido = req.body || {};
    const { formulario, ...resto } = recebido;

    // Só aceita as chaves conhecidas, combinadas com o que já estava salvo
    const atual = combinarGeral(GERAL_PADRAO, config.geral || {});
    const novo = {};
    Object.keys(GERAL_PADRAO).forEach((k) => {
      novo[k] = resto[k] !== undefined ? combinarGeral(GERAL_PADRAO[k], resto[k]) : atual[k];
    });
    config.geral = novo;

    if (formulario) {
      config.formularioContato = {
        apiKey: String(formulario.apiKey || ''),
        redirectTo: String(formulario.redirectTo || ''),
        ativo: formulario.ativo !== false
      };
    }

    await writeSiteConfig(config);
    res.json({ ok: true, geral: Object.assign({}, novo, { formulario: config.formularioContato }) });
  } catch (error) {
    console.error('Erro ao salvar configuração geral:', error);
    res.status(500).json({ error: 'Erro ao salvar configuração geral' });
  }
});

// Envio genérico de imagem (QR Code, ícones, fotos...) → devolve a URL
router.post('/site/upload-imagem', requireAuth, (req, res) => {
  uploadMateria(req, res, (erro) => {
    if (erro) return res.status(400).json({ error: erro.message || 'Erro ao enviar a imagem' });
    if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });
    res.json({ ok: true, url: `/uploads/materias/${req.file.filename}` });
  });
});

// Envio genérico de vídeo (abertura do site) → devolve a URL
router.post('/site/upload-video', requireAuth, (req, res) => {
  uploadVideo(req, res, (erro) => {
    if (erro) {
      const msg = erro.code === 'LIMIT_FILE_SIZE' ? 'Arquivo muito grande. Tamanho máximo: 500MB' : (erro.message || 'Erro ao enviar o vídeo');
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: 'Nenhum vídeo enviado' });
    res.json({ ok: true, url: `/uploads/videos/${req.file.filename}` });
  });
});

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
    const { ordem } = req.body;
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
      ativo: true
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
    const { ordem, ativo } = req.body;
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
    const config = await readSiteConfig();
    res.json(config?.videoPrincipal || {});
  } catch (error) {
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

    // Se um novo vídeo foi enviado, processar o upload
    if (req.file) {
      const videoUrl = `/uploads/videos/${req.file.filename}`;
      
      // Se havia um vídeo anterior, deletar o arquivo antigo
      if (config.videoPrincipal.url && config.videoPrincipal.url.startsWith('/uploads/videos/')) {
        const oldVideoPath = path.join(__dirname, '..', 'uploads', 'videos', path.basename(config.videoPrincipal.url));
        try {
          await fs.remove(oldVideoPath);
          console.log('Vídeo antigo deletado:', oldVideoPath);
        } catch (err) {
          console.error('Erro ao deletar vídeo antigo:', err);
          // Não bloquear a operação se falhar ao deletar o arquivo antigo
        }
      }
      
      config.videoPrincipal.url = videoUrl;
    }
    
    // Atualizar campos de texto
    // Garantir que titulo e subtitulo sejam strings (não arrays)
    if (titulo !== undefined) {
      config.videoPrincipal.titulo = Array.isArray(titulo) ? titulo[0] : titulo;
    }
    if (subtitulo !== undefined) {
      config.videoPrincipal.subtitulo = Array.isArray(subtitulo) ? subtitulo[0] : subtitulo;
    }
    if (ativo !== undefined) config.videoPrincipal.ativo = ativo === 'true' || ativo === true;

    await writeSiteConfig(config);
    res.json({ ok: true, video: config.videoPrincipal });
  } catch (error) {
    console.error('Erro ao atualizar vídeo:', error);
    res.status(500).json({ error: 'Erro ao atualizar vídeo' });
  }
});

// ==================== RESPONSÁVEIS ====================

router.get('/site/responsaveis', async (req, res) => {
  try {
    const config = await readSiteConfig();
    res.json(config?.responsaveis || []);
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
    console.log('📰 Buscando notícias para o site público...');
    console.log('   Arquivo:', MATERIAS_FILE);
    const materias = await readMaterias();
    console.log(`✅ ${materias.length} notícias encontradas`);
    console.log('   Primeiras 3 matérias:', materias.slice(0, 3).map(m => ({ id: m.id, title: m.title })));
    res.json(materias);
  } catch (error) {
    console.error('❌ Erro ao listar notícias:', error);
    res.status(500).json({ error: 'Erro ao listar notícias' });
  }
});

// Rota para o dashboard (admin)
router.get('/noticias', async (req, res) => {
  try {
    const materias = await readMaterias();
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
    
    console.log('📝 Criando nova notícia...');
    console.log('   Título:', title);
    console.log('   Data:', date);
    console.log('   Categoria:', category);
    console.log('   Tem imagem?', !!req.file);
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Título e conteúdo são obrigatórios' });
    }

    const materias = await readMaterias();
    console.log(`   Total de matérias antes: ${materias.length}`);
    
    const novoId = materias.length > 0
      ? Math.max(...materias.map(m => m.id || 0)) + 1
      : 1;

    const novaMateria = {
      id: novoId,
      title,
      date: date || new Date().toISOString().split('T')[0],
      category: category || 'geral',
      content,
      excerpt: excerpt || '',
      tag: tag || '',
      image: req.file ? `/uploads/materias/${req.file.filename}` : ''
    };

    materias.push(novaMateria);
    await writeMaterias(materias);
    
    console.log(`✅ Notícia criada com sucesso! ID: ${novoId}`);
    console.log(`   Total de matérias depois: ${materias.length}`);
    console.log(`   Arquivo salvo em: ${MATERIAS_FILE}`);

    res.json({ ok: true, materia: novaMateria });
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
    const index = materias.findIndex(m => m.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Notícia não encontrada' });
    }

    if (title) materias[index].title = title;
    if (date) materias[index].date = date;
    if (category) materias[index].category = category;
    if (content) materias[index].content = content;
    if (excerpt !== undefined) materias[index].excerpt = excerpt;
    if (tag !== undefined) materias[index].tag = tag;
    if (req.file) materias[index].image = `/uploads/materias/${req.file.filename}`;

    await writeMaterias(materias);
    res.json({ ok: true, materia: materias[index] });
  } catch (error) {
    console.error('Erro ao atualizar notícia:', error);
    res.status(500).json({ error: 'Erro ao atualizar notícia' });
  }
});

router.delete('/noticias/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const materias = await readMaterias();
    const index = materias.findIndex(m => m.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Notícia não encontrada' });
    }

    materias.splice(index, 1);
    await writeMaterias(materias);

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
    // Tentar buscar do MySQL primeiro
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM pagamentos ORDER BY dataPagamento DESC, dataCriacao DESC'
      );
      return res.json(rows);
    } catch (dbError) {
      console.error('❌ Erro ao buscar pagamentos do MySQL:', dbError.message);
      console.error('❌ Stack:', dbError.stack);
      console.error('❌ Código do erro:', dbError.code);
      // Fallback para JSON
      const data = await readPagamentos();
      return res.json(data.pagamentos || []);
    }
  } catch (error) {
    console.error('Erro ao buscar pagamentos:', error);
    res.status(500).json({ error: 'Erro ao buscar pagamentos' });
  }
});

// Rota para deletar um pagamento (requer autenticação)
router.delete('/pagamentos/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Tentar deletar do MySQL primeiro
    try {
      const [result] = await pool.execute(
        'DELETE FROM pagamentos WHERE id = ?',
        [id]
      );
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Pagamento não encontrado' });
      }
      
      console.log('✅ Pagamento deletado do MySQL:', id);
      return res.json({ message: 'Pagamento deletado com sucesso' });
      
    } catch (dbError) {
      console.error('❌ Erro ao deletar pagamento do MySQL:', dbError.message);
      
      // Fallback para JSON
      const data = await readPagamentos();
      const pagamentos = data.pagamentos || [];
      
      const index = pagamentos.findIndex(p => p.id === parseInt(id));
      if (index === -1) {
        return res.status(404).json({ error: 'Pagamento não encontrado' });
      }
      
      pagamentos.splice(index, 1);
      await writePagamentos({ pagamentos });
      
      console.log('✅ Pagamento deletado do JSON:', id);
      return res.json({ message: 'Pagamento deletado com sucesso' });
    }
  } catch (error) {
    console.error('Erro ao deletar pagamento:', error);
    res.status(500).json({ error: 'Erro ao deletar pagamento' });
  }
});

// Rota para salvar um novo pagamento (pública para ser chamada pelo checkout)
router.post('/pagamentos', async (req, res) => {
  try {
    const { paymentIntentId, nome, email, jornalId, jornalNome, valor, moeda, dataPagamento } = req.body;
    
    console.log('📥 Recebendo pagamento:', { paymentIntentId, nome, email, jornalId, valor });
    console.log('📥 Valor recebido (tipo):', typeof valor, 'Valor:', valor);
    
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'paymentIntentId é obrigatório' });
    }
    
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
      // Verificar se o pagamento já existe
      const [existing] = await pool.execute(
        'SELECT * FROM pagamentos WHERE paymentIntentId = ?',
        [paymentIntentId]
      );
      
      if (existing.length > 0) {
        // Se o pagamento existente tem valor 0 e o novo tem valor, atualizar
        if (existing[0].valor === 0 && valorFinal > 0) {
          console.log('🔄 Atualizando valor do pagamento existente de 0 para', valorFinal);
          await pool.execute(
            'UPDATE pagamentos SET valor = ? WHERE paymentIntentId = ?',
            [valorFinal, paymentIntentId]
          );
          // Buscar o pagamento atualizado
          const [updated] = await pool.execute(
            'SELECT * FROM pagamentos WHERE paymentIntentId = ?',
            [paymentIntentId]
          );
          return res.json({ message: 'Valor do pagamento atualizado', pagamento: updated[0] });
        }
        return res.json({ message: 'Pagamento já registrado', pagamento: existing[0] });
      }
      
      // Inserir no MySQL
      const [result] = await pool.execute(
        `INSERT INTO pagamentos (paymentIntentId, nome, email, jornalId, jornalNome, valor, moeda, dataPagamento, dataCriacao) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [paymentIntentId, nomeFinal, emailFinal, jornalIdFinal, jornalNomeFinal, valorFinal, moedaFinal, dataPagamentoFinal, dataCriacaoFinal]
      );
      
      // Buscar o pagamento inserido
      const [inserted] = await pool.execute(
        'SELECT * FROM pagamentos WHERE id = ?',
        [result.insertId]
      );
      
      console.log('✅ Pagamento registrado no MySQL:', result.insertId);
      return res.json({ message: 'Pagamento registrado com sucesso', pagamento: inserted[0] });
      
    } catch (dbError) {
      console.error('❌ Erro ao salvar pagamento no MySQL:', dbError.message);
      console.error('❌ Stack:', dbError.stack);
      console.error('❌ Código do erro:', dbError.code);
      
      // Fallback para JSON se MySQL falhar
      const data = await readPagamentos();
      const pagamentos = data.pagamentos || [];
      
      // Verificar se o pagamento já existe
      const pagamentoExistente = pagamentos.find(p => p.paymentIntentId === paymentIntentId);
      if (pagamentoExistente) {
        // Se o pagamento existente tem valor 0 e o novo tem valor, atualizar
        if (pagamentoExistente.valor === 0 && valorFinal > 0) {
          console.log('🔄 Atualizando valor do pagamento existente (JSON) de 0 para', valorFinal);
          pagamentoExistente.valor = valorFinal;
          await writePagamentos({ pagamentos });
          return res.json({ message: 'Valor do pagamento atualizado', pagamento: pagamentoExistente });
        }
        return res.json({ message: 'Pagamento já registrado', pagamento: pagamentoExistente });
      }
      
      // Criar novo pagamento
      const novoPagamento = {
        id: pagamentos.length > 0 ? Math.max(...pagamentos.map(p => p.id)) + 1 : 1,
        paymentIntentId: String(paymentIntentId),
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
    const colunistasAtivos = (data.colunistas || [])
      .filter(c => c.ativo !== false)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    
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
    const colunistasAtivos = (data.colunistas || [])
      .filter(c => c.ativo !== false)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    
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
    res.json(data);
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
    
    console.log('📝 Criando novo colunista...');
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
    console.log(`   Arquivo salvo em: ${COLUNISTAS_FILE}`);
    
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

module.exports = router;
