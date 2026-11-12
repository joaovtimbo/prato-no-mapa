# Restaurantes v9

Versão com:
- busca de restaurantes melhorada com **Geoapify** (plano gratuito)
- fallback para Photon/OpenStreetMap se a chave não estiver configurada
- correção visual da fresta entre painel e rodapé no iPhone
- novos ícones no rodapé

## Como ativar a busca melhor

1. Crie uma conta gratuita em https://www.geoapify.com/
2. Gere uma chave de API gratuita.
3. Abra o arquivo `config.js`.
4. Cole a chave em `GEOAPIFY_API_KEY`.
5. Suba os arquivos no GitHub Pages.

A documentação oficial da Geoapify informa que a chave pode ser criada gratuitamente, sem cartão, e que o Places API tem plano gratuito com limite diário.

## Publicação

Basta substituir os arquivos antigos pelos desta versão no repositório do GitHub.
Não há mudança de banco de dados nesta versão.
