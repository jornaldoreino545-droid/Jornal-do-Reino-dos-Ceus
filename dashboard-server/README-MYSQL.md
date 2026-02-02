# Configuração do Banco de Dados MySQL

## 📋 Instruções para Salvar Jornais, Fotos e Vídeos no MySQL

### 1. Executar o Script SQL

Execute o arquivo `database-schema.sql` no seu banco de dados MySQL para criar as tabelas necessárias:

```bash
mysql -u seu_usuario -p seu_banco_de_dados < database-schema.sql
```

Ou através do MySQL Workbench/phpMyAdmin:
- Abra o arquivo `database-schema.sql`
- Execute o script completo

### 2. Verificar Configuração do Banco

Certifique-se de que o arquivo `.env` (ou variáveis de ambiente) está configurado corretamente:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=ebook_checkout
```

### 3. Tabelas Criadas

O script cria as seguintes tabelas:

- **jornais**: Armazena informações dos jornais (nome, mês, ano, capa, PDF, etc.)
- **materias**: Armazena notícias/matérias (título, conteúdo, data, categoria, etc.)
- **videos**: Armazena informações de vídeos (URL, título, descrição, etc.)
- **fotos**: Armazena metadados de imagens enviadas (opcional, para rastreamento)
- **carrossel**: Armazena itens do carrossel principal
- **carrossel_medio**: Armazena itens do carrossel "Campeões no Evangelismo"
- **colunistas**: Armazena informações dos colunistas

### 4. Funcionamento

O sistema agora funciona em **modo híbrido**:

1. **Prioridade MySQL**: Tenta salvar/buscar do MySQL primeiro
2. **Fallback JSON**: Se houver erro no MySQL, usa os arquivos JSON como backup
3. **Backup Automático**: Sempre salva também no JSON como backup

### 5. Migração de Dados Existentes

Se você já tem dados nos arquivos JSON, eles continuarão funcionando normalmente. Quando você criar/editar novos itens, eles serão salvos no MySQL.

Para migrar dados existentes para o MySQL, você pode:
- Criar um script de migração (opcional)
- Ou simplesmente continuar usando o sistema normalmente - novos dados irão para o MySQL

### 6. Verificação

Para verificar se está funcionando:

1. Crie um novo jornal no dashboard
2. Verifique no MySQL se o registro foi criado:
   ```sql
   SELECT * FROM jornais ORDER BY id DESC LIMIT 1;
   ```
3. Verifique também se o arquivo `jornais.json` foi atualizado (backup)

### 7. Observações Importantes

- **Arquivos físicos** (PDFs, imagens, vídeos) continuam sendo salvos na pasta `uploads/`
- Apenas os **metadados** (informações sobre os arquivos) são salvos no MySQL
- O sistema mantém compatibilidade total com o código existente
- Se o MySQL não estiver disponível, o sistema continua funcionando com JSON

### 8. Troubleshooting

Se encontrar erros:

1. Verifique se as tabelas foram criadas:
   ```sql
   SHOW TABLES;
   ```

2. Verifique a conexão do banco:
   - Teste a conexão no arquivo `config/database.js`
   - Verifique as credenciais no `.env`

3. Verifique os logs do servidor:
   - Erros do MySQL aparecerão no console
   - O sistema automaticamente usa JSON como fallback

### 9. Próximos Passos (Opcional)

Você pode também migrar outros dados para o MySQL:
- Carrossel
- Carrossel Médio
- Colunistas
- Responsáveis
- FAQ
- Sites da Igreja

Basta seguir o mesmo padrão usado para jornais, matérias e vídeos.
