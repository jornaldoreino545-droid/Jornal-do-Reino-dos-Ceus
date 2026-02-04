-- ============================================================
-- SCRIPT PASSO A PASSO PARA CORRIGIR TABELA pagamentos
-- Execute cada comando UM POR VEZ no seu MySQL
-- ============================================================

-- PASSO 1: Remover foreign key constraint (se existir)
-- Execute este comando primeiro:
ALTER TABLE downloads DROP FOREIGN KEY downloads_ibfk_1;

-- PASSO 2: Limpar registros com valores vazios
-- Execute este comando:
DELETE FROM pagamentos WHERE stripe_payment_id IS NULL OR stripe_payment_id = '';

-- Execute este também (caso a coluna paymentIntentId já exista):
DELETE FROM pagamentos WHERE paymentIntentId IS NULL OR paymentIntentId = '';

-- PASSO 3: Renomear coluna stripe_payment_id para paymentIntentId
-- Execute este comando (só funcionará se a coluna stripe_payment_id existir):
ALTER TABLE pagamentos CHANGE COLUMN stripe_payment_id paymentIntentId VARCHAR(255) NOT NULL UNIQUE;

-- PASSO 4: Adicionar índice (se não existir)
-- Execute este comando:
CREATE INDEX IF NOT EXISTS idx_paymentIntentId ON pagamentos(paymentIntentId);

-- PASSO 5: Verificar se funcionou
-- Execute este comando para ver a estrutura:
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'pagamentos' 
AND (COLUMN_NAME = 'paymentIntentId' OR COLUMN_NAME = 'stripe_payment_id');

-- Se aparecer apenas 'paymentIntentId', está correto! ✅
