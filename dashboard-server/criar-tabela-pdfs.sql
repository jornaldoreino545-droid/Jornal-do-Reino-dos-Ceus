-- Execute no phpMyAdmin (ou MySQL) para criar a tabela de PDFs no banco.
-- Assim os PDFs dos jornais passam a ser salvos no banco (BLOB) e não se perdem após deploy.

CREATE TABLE IF NOT EXISTS pdfs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome_arquivo VARCHAR(255) NOT NULL,
    dados_pdf LONGBLOB NOT NULL,
    jornal_id INT NULL,
    tamanho BIGINT NULL,
    dataCriacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_jornal_id (jornal_id),
    CONSTRAINT fk_pdfs_jornal FOREIGN KEY (jornal_id) REFERENCES jornais(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
