# Restaurantes — versão 3 (mobile)

## Instalação
1. Execute `atualizacao-v3.sql` no SQL Editor do projeto Supabase **antes** de subir os arquivos do site.
2. No GitHub, substitua `index.html`, `app.js`, `styles.css` e demais arquivos de interface pela versão deste pacote. A `config.js` usa a mesma URL e chave **pública** do Supabase já configuradas.
3. Após o deploy do GitHub Pages, abra o site em uma janela privada para evitar cache antigo.

## Mudanças
- O mapa utiliza tiles do OpenStreetMap sem chave comercial; a estética escura é aplicada por CSS. Respeite a atribuição, o uso justo e o cache do serviço.
- A geolocalização usa `navigator.geolocation` e requer permissão do usuário e HTTPS (GitHub Pages fornece HTTPS).
- As abas Avaliações e Perfil ocupam a tela no celular, e o botão Avaliar lugar fica limitado à aba Mapa.
- O criador pode editar nome/endereço do restaurante e excluí-lo, desde que não haja avaliações de outras pessoas. Exclusões pedem confirmação.
- Não exclui nem migra contas existentes ou dados do Supabase.

## Atenção
O OpenStreetMap/Nominatim não é uma solução comercial de geocodificação em escala. Para uso intenso/muitos usuários, é recomendável contratar provedor de mapas e busca com SLA. Verifique os termos do serviço.
