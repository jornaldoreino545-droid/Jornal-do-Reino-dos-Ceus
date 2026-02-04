-- Script SEGURO para corrigir a tabela pagamentos SEM perder dados
-- Este script NÃO apaga a tabela, apenas corrige a estrutura
-- Execute este script no seu MySQL

-- 1. Remover foreign key constraint da tabela downloads (se existir)
SET @fk_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'downloads' 
  AND CONSTRAINT_NAME = 'downloads_ibfk_1'
);

SET @sql_fk = IF(@fk_exists > 0,
  'ALTER TABLE downloads DROP FOREIGN KEY downloads_ibfk_1',
  'SELECT "Foreign key downloads_ibfk_1 não existe, pulando remoção" AS resultado'
);

PREPARE stmt_fk FROM @sql_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

-- 2. Remover TODOS os registros com stripe_payment_id vazio ou NULL
DELETE FROM pagamentos WHERE stripe_payment_id IS NULL OR stripe_payment_id = '';

-- 3. Remover TODOS os registros com paymentIntentId vazio ou NULL (se a coluna existir)
DELETE FROM pagamentos WHERE paymentIntentId IS NULL OR paymentIntentId = '';

-- 4. Verificar se existe stripe_payment_id e renomear para paymentIntentId
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'pagamentos' 
  AND COLUMN_NAME = 'stripe_payment_id'
);

SET @sql = IF(@col_exists > 0,
  'ALTER TABLE pagamentos CHANGE COLUMN stripe_payment_id paymentIntentId VARCHAR(255) NOT NULL UNIQUE',
  'SELECT "Coluna stripe_payment_id não existe, pulando renomeação" AS resultado'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Garantir que paymentIntentId existe (se não existir, criar)
SET @col_exists_payment = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'pagamentos' 
  AND COLUMN_NAME = 'paymentIntentId'
);

SET @sql2 = IF(@col_exists_payment = 0,
  'ALTER TABLE pagamentos ADD COLUMN paymentIntentId VARCHAR(255) NOT NULL UNIQUE AFTER id',
  'SELECT "Coluna paymentIntentId já existe" AS resultado'
);

PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 6. Adicionar índice se não existir
CREATE INDEX IF NOT EXISTS idx_paymentIntentId ON pagamentos(paymentIntentId);

-- 7. Recriar foreign key constraint na tabela downloads (se necessário)
-- (Ajuste conforme sua estrutura de dados)
-- ALTER TABLE downloads ADD CONSTRAINT downloads_ibfk_1 FOREIGN KEY (pagamento_id) REFERENCES pagamentos(id);

-- 8. Verificar estrutura final
SELECT 'Tabela pagamentos corrigida com sucesso!' AS resultado;
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'pagamentos' 
AND (COLUMN_NAME = 'paymentIntentId' OR COLUMN_NAME = 'stripe_payment_id');

-- 9. Mostrar quantos registros foram mantidos
SELECT COUNT(*) AS total_registros FROM pagamentos;
