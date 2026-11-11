# Restaurantes — versão 2 (mobile-first)

## Atualizar sem perder os dados

1. Faça backup do `config.js` atual do seu GitHub. Este pacote já contém a URL e chave pública fornecidas para o projeto Supabase. **Nunca coloque a service_role ou chave secreta no GitHub.**
2. No Supabase, abra SQL Editor, cole o conteúdo de `upgrade.sql` e execute. Ele acrescenta a permissão de excluir avaliações próprias. **Não execute o `schema.sql` de novo.**
3. Envie ao **mesmo repositório** GitHub os arquivos `index.html`, `styles.css`, `app.js`, `config.js`, `favicon.svg`, `upgrade.sql`, `.nojekyll` e `README.md`, substituindo os anteriores. Não crie outro repositório.
4. Abra https://joaovtimbo.github.io/prato-no-mapa/ no celular. Se mostrar a versão anterior, feche a aba e abra uma nova ou atualize o cache.

## Como funciona

- Mapa Leaflet com tiles escuros CARTO/OpenStreetMap. Precisa de internet.
- Localização atual: usa `navigator.geolocation` com permissão do navegador, em HTTPS (GitHub Pages). Na primeira abertura pode solicitar autorização. O botão ⌖ tenta novamente. Se negada, o mapa pode ser navegado manualmente.
- Busca geográfica: Nominatim/OpenStreetMap, com confirmação do resultado antes de salvar. Para cadastro manual por toque no mapa, as coordenadas do toque são utilizadas. O Nominatim é um serviço público com limites de uso, sem garantia de cobertura completa nem de precisão de endereços. Para alto volume, use um provedor comercial de geocodificação.
- Excluir avaliação: nos cards de avaliações próprias, com confirmação. Não exclui o restaurante, porque outra pessoa pode tê-lo avaliado.
- Contas, amizade e avaliações existentes continuam no mesmo Supabase. A visualização das reviews de amigos depende de amizade aceita.

## Privacidade e manutenção

- O pedido de geolocalização é do navegador; o site não envia suas coordenadas GPS ao Supabase automaticamente. O endereço buscado é enviado ao serviço de geocodificação do OpenStreetMap.
- Restaurantes cadastrados têm latitude, longitude e endereço registrados no Supabase.
- Chave publishable é pública. Segurança deve ser garantida pelas políticas de RLS configuradas no Supabase.
- Não execute `schema.sql` para atualizar; use apenas `upgrade.sql` nesta versão.
