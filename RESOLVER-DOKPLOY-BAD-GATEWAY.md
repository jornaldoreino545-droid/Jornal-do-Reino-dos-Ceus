# Como resolver Bad Gateway / Error starting application no Dokploy

Depois de clicar em **Stop**, o container parou e o deploy passou a falhar ("Error starting application", nenhum container na lista). Segue o que fazer, na ordem.

---

## 1. Tentar no próprio Dokploy

### A) Recriar o aplicativo (limpar estado)
Às vezes o estado do serviço fica inconsistente após o Stop.

1. No Dokploy, no seu **projeto** (ex.: jornal do reino), anote:
   - Repositório GitHub
   - Branch (ex.: main)
   - Variáveis de ambiente (Environment) – tire print ou copie
   - Domínio configurado (Domains)
2. **Apague** o aplicativo/serviço que está com problema (o que mostra "jornal" / "jornal-do-reino-jornal-...").
3. Crie um **novo** aplicativo no mesmo projeto:
   - Mesmo repositório e branch
   - Mesmas variáveis de ambiente
   - Mesmo domínio
4. Faça o **primeiro Deploy** desse aplicativo novo e espere terminar.
5. Veja se o deploy fica verde e se o site volta.

### B) Conferir comando de início e build
1. Aba **General** (ou **Advanced**):
   - **Start command / Run command:** deve ser `node server.js` ou `npm start`.
   - **Build Path:** vazio ou `/` (raiz do repositório).
2. Na etapa de **build**, deve rodar **npm install** (ou equivalente). Se houver "Build command", não pode ser algo que impeça a instalação das dependências.

### C) Réplicas / Scaling
1. Em **Advanced** ou **Scaling**, verifique se o número de **réplicas** (instâncias) não está em **0**.
2. Se estiver em 0, coloque em **1**, salve e faça **Deploy** de novo.

---

## 2. Falar com o suporte (Hostinger / Dokploy)

Se nada disso resolver, o suporte consegue ver no servidor o que está acontecendo.

**O que dizer no chamado:**

- "Depois de clicar em **Stop** no meu aplicativo e em seguida em **Deploy**, o site passou a dar **Bad Gateway** e ao fazer deploy aparece **Error starting application**."
- "Na aba **Logs** não aparece nenhum container para selecionar e não consigo ver log de inicialização."
- "Peço que verifiquem: (1) por que o container do meu aplicativo não permanece rodando após o deploy; (2) qual o comando de start que está sendo usado; (3) se há log de erro do container no servidor. Meu repositório é [nome do repo], branch main."

**Onde abrir:**
- **Hostinger:** painel da hospedagem → Suporte / Chat / Ticket.
- Se usar **Dokploy** em outro lugar: suporte do provedor onde o Dokploy está instalado ou documentação/comunidade do Dokploy.

---

## 3. Alternativa: hospedagem Node.js sem Docker

Se o Dokploy continuar instável:

- Verifique se a **Hostinger** oferece hospedagem **Node.js** (por Git ou comando próprio), sem ser via Dokploy.
- Ou use outro serviço (ex.: **Railway**, **Render**, **Cyclic**) que faz deploy direto do GitHub com Node.js – costuma ser simples e evita o estado “parado” do container no Dokploy.

---

## Resumo

| O que fazer | Onde |
|-------------|------|
| Recriar o app (apagar e criar de novo com mesmo repo e config) | Dokploy |
| Conferir Start command e Build Path | Dokploy → General/Advanced |
| Verificar réplicas = 1 | Dokploy → Advanced/Scaling |
| Abrir chamado com as frases acima | Suporte Hostinger/Dokploy |

O problema está no ambiente (Dokploy/container), não no código do site. Recriar o aplicativo ou o suporte verificar o container costuma resolver.
