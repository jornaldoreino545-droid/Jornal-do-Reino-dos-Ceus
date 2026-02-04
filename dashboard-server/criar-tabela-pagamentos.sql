-- ==================== CRIAR/CORRIGIR TABELA pagamentos ====================
-- Execute este script para criar a tabela pagamentos completa ou adicionar colunas faltantes

-- Se a tabela não existir, criar do zero
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

-- Se a tabela já existir, adicionar colunas faltantes
-- (Ignore erros se as colunas já existirem)

-- Adicionar paymentIntentId se não existir
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'pagamentos' 
     AND COLUMN_NAME = 'paymentIntentId') = 0,
    'ALTER TABLE pagamentos ADD COLUMN paymentIntentId VARCHAR(255) UNIQUE AFTER id',
    'SELECT "Coluna paymentIntentId já existe" AS resultado'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Adicionar nome se não existir
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'pagamentos' 
     AND COLUMN_NAME = 'nome') = 0,
    'ALTER TABLE pagamentos ADD COLUMN nome VARCHAR(255) NOT NULL AFTER paymentIntentId',
    'SELECT "Coluna nome já existe" AS resultado'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Adicionar email se não existir
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'pagamentos' 
     AND COLUMN_NAME = 'email') = 0,
    'ALTER TABLE pagamentos ADD COLUMN email VARCHAR(255) AFTER nome',
    'SELECT "Coluna email já existe" AS resultado'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Adicionar jornalId se não existir
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'pagamentos' 
     AND COLUMN_NAME = 'jornalId') = 0,
    'ALTER TABLE pagamentos ADD COLUMN jornalId INT AFTER email',
    'SELECT "Coluna jornalId já existe" AS resultado'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Adicionar jornalNome se não existir
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'pagamentos' 
     AND COLUMN_NAME = 'jornalNome') = 0,
    'ALTER TABLE pagamentos ADD COLUMN jornalNome VARCHAR(255) AFTER jornalId',
    'SELECT "Coluna jornalNome já existe" AS resultado'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Adicionar valor se não existir
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'pagamentos' 
     AND COLUMN_NAME = 'valor') = 0,
    'ALTER TABLE pagamentos ADD COLUMN valor DECIMAL(10, 2) DEFAULT 0.00 AFTER jornalNome',
    'SELECT "Coluna valor já existe" AS resultado'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Adicionar moeda se não existir
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'pagamentos' 
     AND COLUMN_NAME = 'moeda') = 0,
    'ALTER TABLE pagamentos ADD COLUMN moeda VARCHAR(10) DEFAULT ''BRL'' AFTER valor',
    'SELECT "Coluna moeda já existe" AS resultado'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Adicionar dataPagamento se não existir
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'pagamentos' 
     AND COLUMN_NAME = 'dataPagamento') = 0,
    'ALTER TABLE pagamentos ADD COLUMN dataPagamento DATETIME AFTER moeda',
    'SELECT "Coluna dataPagamento já existe" AS resultado'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Adicionar dataCriacao se não existir
SET @sql = IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'pagamentos' 
     AND COLUMN_NAME = 'dataCriacao') = 0,
    'ALTER TABLE pagamentos ADD COLUMN dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP AFTER dataPagamento',
    'SELECT "Coluna dataCriacao já existe" AS resultado'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Adicionar índices (ignora erro se já existirem)
CREATE INDEX IF NOT EXISTS idx_paymentIntentId ON pagamentos(paymentIntentId);
CREATE INDEX IF NOT EXISTS idx_dataPagamento ON pagamentos(dataPagamento);
CREATE INDEX IF NOT EXISTS idx_dataCriacao ON pagamentos(dataCriacao);
CREATE INDEX IF NOT EXISTS idx_jornalId ON pagamentos(jornalId);

-- Verificar estrutura final
SELECT 'Tabela pagamentos criada/corrigida com sucesso!' AS resultado;
DESCRIBE pagamentos;
