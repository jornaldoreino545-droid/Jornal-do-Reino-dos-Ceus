-- Execute no phpMyAdmin (ou MySQL) para garantir que a tabela fotos existe e guarda imagens em BLOB.
-- Se a tabela já existir sem a coluna dados_imagem, o segundo bloco adiciona a coluna.

-- 1) Criar tabela fotos (se ainda não existir)
CREATE TABLE IF NOT EXISTS fotos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome_arquivo VARCHAR(255) NOT NULL,
    caminho VARCHAR(500) NULL,
    tipo VARCHAR(50) DEFAULT 'materia',
    referencia_id INT NULL,
    tamanho BIGINT NULL,
    mime_type VARCHAR(100) NULL,
    dados_imagem LONGBLOB NOT NULL COMMENT 'Imagem armazenada no banco',
    dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tipo (tipo),
    INDEX idx_referencia (referencia_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Se a tabela já existia sem dados_imagem, adicionar a coluna (ignore erro "Duplicate column")
ALTER TABLE fotos ADD COLUMN dados_imagem LONGBLOB NULL;
-- Se der "Duplicate column name 'dados_imagem'", pode ignorar – a coluna já existe.

-- 3) Opcional: permitir caminho nulo (se a tabela antiga tiver NOT NULL)
-- ALTER TABLE fotos MODIFY caminho VARCHAR(500) NULL;
