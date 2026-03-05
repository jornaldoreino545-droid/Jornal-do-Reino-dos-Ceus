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

-- Tabela de Fotos/Imagens (metadados + imagem em BLOB)
CREATE TABLE IF NOT EXISTS fotos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome_arquivo VARCHAR(255) NOT NULL,
    caminho VARCHAR(500) NULL COMMENT 'Opcional: caminho em disco se houver cópia',
    tipo VARCHAR(50) DEFAULT 'materia', -- materia, capa, carrossel, responsavel, colunista, etc
    referencia_id INT, -- ID do item relacionado (jornal_id, materia_id, etc)
    tamanho BIGINT, -- Tamanho em bytes
    mime_type VARCHAR(100),
    dados_imagem LONGBLOB NOT NULL COMMENT 'Imagem armazenada no banco',
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
    santuario VARCHAR(255) NULL COMMENT 'Santuário que o cliente frequenta',
    souNovoSantuario TINYINT(1) DEFAULT 0 COMMENT '1 = sou novo no santuário',
    INDEX idx_paymentIntentId (paymentIntentId),
    INDEX idx_dataPagamento (dataPagamento),
    INDEX idx_dataCriacao (dataCriacao),
    INDEX idx_jornalId (jornalId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de Santuários (opções no checkout)
CREATE TABLE IF NOT EXISTS santuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    ordem INT DEFAULT 0,
    dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ordem (ordem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela de capas dos jornais (fotos de capa exibidas)
CREATE TABLE IF NOT EXISTS capas_jornais (
    id INT AUTO_INCREMENT PRIMARY KEY,
    caminho VARCHAR(500) NOT NULL COMMENT 'Caminho do arquivo, ex: /uploads/capas/capa-xxx.png',
    nome_arquivo VARCHAR(255) NOT NULL COMMENT 'Nome do arquivo salvo',
    jornal_id INT NULL COMMENT 'ID do jornal que exibe esta capa (opcional)',
    dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_jornal_id (jornal_id),
    INDEX idx_dataCriacao (dataCriacao),
    CONSTRAINT fk_capas_jornal FOREIGN KEY (jornal_id) REFERENCES jornais(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
