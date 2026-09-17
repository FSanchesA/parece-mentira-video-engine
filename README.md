# Parece Mentira - PWA V1

Interface mobile para o Video Engine.

## Publicar no GitHub Pages
1. Crie um repositório para o app (ex.: `parece-mentira-app`).
2. Envie os arquivos desta pasta para a raiz.
3. Em **Settings > Pages**, escolha **Deploy from a branch**.
4. Branch: `main` / pasta `/root`.
5. Salve e abra o link gerado pelo GitHub Pages.
6. No iPhone: Safari > Compartilhar > **Adicionar à Tela de Início**.

## Importante
A interface está pronta, mas o botão **Editar vídeo** só deve ser conectado depois de criarmos uma ponte segura de backend.

**Nunca coloque o token do GitHub dentro do `app.js`.**

Próximo passo: backend seguro que recebe o vídeo, dispara o GitHub Actions, acompanha o run e devolve o `final_master.mp4`.
