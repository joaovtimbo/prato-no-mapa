# Restaurantes — versão 7

## Atualização sem perder avaliações

1. Antes de publicar, execute **`atualizacao-v7.sql`** no **Supabase → SQL Editor** e confira se aparece `Success`.
2. Confira em **Authentication → URL Configuration** que **Site URL** e a lista **Redirect URLs** incluem `https://joaovtimbo.github.io/prato-no-mapa/`.
3. No GitHub, repositório `joaovtimbo/prato-no-mapa`, substitua os arquivos da raiz pelos deste ZIP (`index.html`, `app.js`, `styles.css`, etc.) e confirme o commit na branch `main`.
4. Aguarde o status de publicação na aba Actions; teste em aba privada no celular. Nunca publique uma chave `service_role` ou `secret`.

**Não execute `schema.sql` novamente:** é apenas a estrutura inicial, preservada no pacote como referência. O arquivo `atualizacao-v7.sql` é o único SQL novo desta versão.

## Novidades

- **Esqueci minha senha:** na tela de login, solicite o e-mail de recuperação. O link recebido retorna ao site e abre o formulário de nova senha. Dependente das configurações de e-mail do projeto Supabase (o SMTP padrão possui limites e restrições). A senha não é armazenada pelo site.
- **Foto de perfil:** no Perfil, `Alterar foto do perfil`; escolher uma imagem da galeria ou do aparelho. O navegador redimensiona e salva JPEG no bucket público `avatars` do Supabase Storage. As fotos são publicamente acessíveis por quem possui a URL; evite fotos sensíveis. Imagens que o navegador não consegue decodificar não serão enviadas.
- **Busca de restaurantes pelo nome:** ao digitar 3 ou mais caracteres, mostra sugestões pelo Photon/Komoot (dados OpenStreetMap). É uma API pública de demonstração sem disponibilidade garantida, com limites de uso; se não achar, procure o endereço manualmente. Sempre confira se o endereço selecionado é o correto. Uma busca não altera locais existentes.
- **Avaliação com campos separados:** o que pediu, o que valeu a pena, se voltaria e conta total (R$), todos opcionais; nota permanece obrigatória. Edição preserva esses valores.
- Mantido **MapLibre com OpenFreeMap** da versão 6.

## Testes rápidos

1. Entrar e sair; enviar link de recuperação e definir senha nova pelo link recebido.
2. Alterar foto de perfil no iPhone e conferir após atualizar a página.
3. Pesquisar nome do restaurante, selecionar um endereço e salvar avaliação; marcador deve aparecer no mapa.
4. Registrar valor `125,50`, escolher `Talvez`, salvar e depois editar.
5. Verificar reviews antigas (campo legado `note`) sem perda de dados.
