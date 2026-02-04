-- ==================== SCHEMA DO BANCO DE DADOS - JORNAL DO REINO ====================
-- Execute este script no seu banco de dados MySQL para criar as tabelas necessárias

-- Tabela de Jornais
CREATE TABLE IF NOT EXISTS jornais (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    mes VARCHAR(50) NOT NULL,
    ano INT NOT NULL,
    descricao TEXT,
    linkCompra VARCHAR(500),
    ordem INT DEFAULT 0,
    ativo BOOLEAN DEFAULT TRUE,
    capa VARCHAR(500),
    pdf VARCHAR(500),
    dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    dataAtualizacao DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ano (ano),
    INDEX idx_ativo (ativo),
    INDEX idx_ordem (ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Matérias/Notícias
CREATE TABLE IF NOT EXISTS materias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    category VARCHAR(100) DEFAULT 'geral',
    tag VARCHAR(100),
    image VARCHAR(500),
    ativo BOOLEAN DEFAULT TRUE,
    INDEX idx_date (date),
    INDEX idx_created_at (created_at),
    INDEX idx_category (category),
    INDEX idx_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Vídeos
CREATE TABLE IF NOT EXISTS videos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    url VARCHAR(500) NOT NULL,
    titulo VARCHAR(255),
    descricao TEXT,
    thumbnail VARCHAR(500),
    dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    dataAtualizacao DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ativo BOOLEAN DEFAULT TRUE,
    INDEX idx_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Fotos/Imagens (para armazenar metadados de imagens enviadas)
CREATE TABLE IF NOT EXISTS fotos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome_arquivo VARCHAR(255) NOT NULL,
    caminho VARCHAR(500) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'materia', -- materia, capa, carrossel, responsavel, etc
    referencia_id INT, -- ID do item relacionado (jornal_id, materia_id, etc)
    tamanho BIGINT, -- Tamanho em bytes
    mime_type VARCHAR(100),
    dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tipo (tipo),
    INDEX idx_referencia (referencia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Carrossel
CREATE TABLE IF NOT EXISTS carrossel (
    id INT AUTO_INCREMENT PRIMARY KEY,
    imagem VARCHAR(500) NOT NULL,
    link VARCHAR(500),
    ordem INT DEFAULT 0,
    ativo BOOLEAN DEFAULT TRUE,
    dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    dataAtualizacao DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ordem (ordem),
    INDEX idx_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Carrossel Médio (Campeões no Evangelismo)
CREATE TABLE IF NOT EXISTS carrossel_medio (
    id INT AUTO_INCREMENT PRIMARY KEY,
    imagem VARCHAR(500) NOT NULL,
    link VARCHAR(500),
    ordem INT DEFAULT 0,
    ativo BOOLEAN DEFAULT TRUE,
    dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    dataAtualizacao DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ordem (ordem),
    INDEX idx_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Colunistas
CREATE TABLE IF NOT EXISTS colunistas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    coluna VARCHAR(255) NOT NULL,
    imagem VARCHAR(500),
    dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    dataAtualizacao DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_nome (nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Pagamentos
CREATE TABLE IF NOT EXISTS pagamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    paymentIntentId VARCHAR(255) NOT NULL UNIQUE,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    jornalId INT,
    jornalNome VARCHAR(255),
    valor DECIMAL(10, 2) DEFAULT 0.00,
    moeda VARCHAR(10) DEFAULT 'BRL',
    dataPagamento DATETIME,
    dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_paymentIntentId (paymentIntentId),
    INDEX idx_dataPagamento (dataPagamento),
    INDEX idx_dataCriacao (dataCriacao),
    INDEX idx_jornalId (jornalId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
