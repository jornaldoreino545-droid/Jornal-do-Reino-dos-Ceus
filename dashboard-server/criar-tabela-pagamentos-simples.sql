-- ==================== CRIAR/CORRIGIR TABELA pagamentos (VERSÃO SIMPLES) ====================
-- Execute este script para criar a tabela pagamentos completa

-- Se a tabela já existir, deletar e recriar (CUIDADO: Isso apaga dados existentes!)
-- Se você tem dados importantes, use o script criar-tabela-pagamentos.sql em vez deste

DROP TABLE IF EXISTS pagamentos;

-- Criar tabela completa
CREATE TABLE pagamentos (
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

SELECT 'Tabela pagamentos criada com sucesso!' AS resultado;
