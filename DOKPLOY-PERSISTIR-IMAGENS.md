# Persistir imagens e arquivos no Dokploy (evitar "Sem Imagem" após Deploy)

## Por que as imagens somem após o Deploy?

No Dokploy, cada **Deploy** gera um **novo container**. O sistema de arquivos do container é **efêmero**: tudo que foi salvo em disco (capas dos jornais, PDFs, fotos de matérias, etc.) está dentro do container antigo. Quando o novo container sobe, a pasta `uploads` está **vazia**, mas o **banco de dados** continua com os caminhos antigos (ex: `/uploads/capas/capa-123.png`). Por isso o dashboard mostra "CAPA Configurada" e ao mesmo tempo "Sem Imagem".

## Solução: volume persistente para a pasta `uploads`

É preciso dizer ao Dokploy para **persistir** a pasta onde o app salva os arquivos. Assim, após cada Deploy, o novo container usa a **mesma** pasta no servidor e as imagens continuam lá.

### Passo a passo no Dokploy

1. Abra seu **projeto** no Dokploy e selecione o **serviço** (aplicação) do Jornal do Reino.
2. Vá em **Volumes** (ou **Storage** / **Mounts**, conforme a interface).
3. Adicione um **volume** ou **bind mount**:
   - **Caminho no host (Volume):** um nome de volume, por exemplo `jornal-uploads`, ou um caminho no servidor, ex: `/var/dokploy-data/jornal-uploads`.
   - **Caminho no container (Mount Path):** deve ser exatamente o caminho onde a aplicação grava os arquivos.  
     Como o servidor sobe a partir da raiz do repositório, use:
     - **`/app/dashboard-server/uploads`**  
     ou, se o working directory do container for outro:
     - **`dashboard-server/uploads`**  
     (o diretório que contém as subpastas `capas`, `pdfs`, `materias`, `videos`).
4. Salve e faça um **novo Deploy**.

### Conferindo o caminho dentro do container

Se não tiver certeza do caminho absoluto dentro do container:

- O `server.js` está na **raiz** do projeto e serve uploads com:
  `path.join(__dirname, "dashboard-server", "uploads")`.
- Ou seja, dentro do container a pasta de uploads é: **`<raiz_do_app>/dashboard-server/uploads`**.
- Na maioria dos setups Dokploy, a raiz do app é `/app`. Então o **Mount Path** deve ser: **`/app/dashboard-server/uploads`**.

### Depois de configurar o volume

- **Deploys futuros:** as imagens e PDFs continuarão na pasta persistida; não somem mais.
- **Imagens que já “desapareceram”:** os registros no banco ainda apontam para arquivos que não existem no novo container. Você tem duas opções:
  1. **Reenviar as capas** pelo dashboard (editar cada jornal e anexar de novo a imagem da capa).
  2. Se você tiver backup da pasta `uploads` do container ou do servidor, copie o conteúdo para o volume/caminho que configurou no passo 3 (no host) e faça um Deploy; o container passará a enxergar esses arquivos.

## Resumo

| O quê              | Onde no Dokploy                         |
|--------------------|-----------------------------------------|
| Volume / bind      | Configuração do serviço → Volumes       |
| Caminho no container | **`/app/dashboard-server/uploads`** (ou equivalente à raiz do app + `dashboard-server/uploads`) |
| Conteúdo persistido | `capas/`, `pdfs/`, `materias/`, `videos/` |

Com o volume configurado, as imagens passam a persistir entre deploys e deixam de aparecer como "Sem Imagem" após atualizar pelo GitHub.
