# Prato no Mapa 🍽️

Um diário gastronômico com estética inspirada em mapas: cadastrar restaurantes, dar notas de **0,5 a 5 estrelas**, registrar comentários, visualizar amigos e construir seu mapa pessoal.

## O que está pronto

- Visual responsivo para celular e computador; mapa navegável com OpenStreetMap e Leaflet.
- Busca manual de estabelecimentos e endereços com Nominatim (OpenStreetMap).
- Cadastro por toque no mapa, escolha de nota e texto de avaliação.
- Feed com suas avaliações e as avaliações de amigos aceitos.
- Perfil pessoal, pedidos de amizade por `@usuario` e confirmação do convite.
- Banco no Supabase com autenticação por e-mail e políticas de acesso (RLS).
- Demonstração que funciona imediatamente, sem configuração, usando armazenamento local do navegador. **A pessoa fictícia “Lia” e seus comentários são exemplos, não contas reais.**

## 1. Testar primeiro

Abra a pasta com um servidor local, por exemplo com Python instalado:

```bash
python -m http.server 8000
```

Depois abra `http://localhost:8000` no navegador. Sem configurar o Supabase, o site entra automaticamente no **modo demonstração**. Para o celular acessar o teste local, use o IP do seu computador na mesma rede. Para testar a geolocalização, o navegador normalmente exige HTTPS (o GitHub Pages oferece HTTPS).

> Não abra diretamente o arquivo `index.html` como `file://`: scripts JavaScript em módulos precisam ser servidos por HTTP/HTTPS.

## 2. Criar banco de dados (para funcionar entre celulares)

1. Crie um projeto grátis em https://supabase.com .
2. Em **SQL Editor**, crie uma consulta, copie todo o conteúdo de `schema.sql` e clique em **Run**.
3. Em **Authentication > Providers > Email**, mantenha o login por e-mail ativo. A confirmação por e-mail é recomendada. Se estiver ligada, novos usuários precisam abrir o link enviado pelo Supabase.
4. Em **Project Settings > API** (ou **Connect**, conforme a interface), copie a **Project URL** e a chave **anon / publishable**.
5. Abra `config.js` e preencha:

```javascript
export const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
export const SUPABASE_ANON_KEY = 'SUA_CHAVE_PUBLICAVEL';
```

**Atenção:** use apenas a chave `anon` / `publishable`. Nunca coloque `service_role` ou `secret` no GitHub: elas permitem acesso privilegiado ao banco. A chave pública é própria para aplicações de navegador, desde que as políticas RLS estejam configuradas como no `schema.sql`.

Se configurar autenticação com confirmação por e-mail, em **Authentication > URL Configuration** ajuste **Site URL** para o endereço do GitHub Pages e adicione esse mesmo endereço em **Redirect URLs** (incluindo a barra final). Isso evita redirecionar o usuário ao endereço `localhost` após confirmar o e-mail.

### Nota sobre nomes de usuário

Cada `@usuario` é único. Caso alguém tente registrar um já utilizado, o Supabase pode recusar a criação da conta. Escolha outro nome de usuário.

## 3. Publicar no GitHub Pages

1. Entre em https://github.com e crie um repositório, por exemplo `prato-no-mapa`.
2. Faça upload de **todos os arquivos desta pasta** na **raiz** do repositório (incluindo `config.js`, `schema.sql`, `app.js`, `styles.css` e `index.html`).
3. Em **Settings > Pages**, em *Build and deployment*, selecione **Deploy from a branch**.
4. Em *Branch*, selecione `main` e a pasta `/(root)`; salve.
5. O site estará acessível em um endereço no formato `https://SEU-USUARIO.github.io/prato-no-mapa/`.
6. Abra o link pelo celular e, se quiser, use **Adicionar à Tela de Início** no navegador.

O GitHub Pages **não executa banco de dados nem login no servidor**: ele hospeda a interface estática, enquanto o Supabase guarda as contas, amizades e avaliações.

## Como usar

1. Crie uma conta e peça para sua namorada criar a dela em outro dispositivo.
2. Em **Perfil**, digite o `@usuario` dela e clique em **Adicionar**.
3. Na conta dela, em **Perfil**, clique em **Aceitar** no convite recebido.
4. A partir daí, suas avaliações ficam visíveis no feed de ambos, além de aparecerem no mapa.
5. Busque um restaurante ou toque num ponto do mapa e dê uma nota.

## Algumas limitações da primeira versão

- É um **MVP** (primeira versão), sem fotos, listas de favoritos, edição avançada do perfil ou notificações push.
- A busca gratuita do Nominatim é limitada. Evite buscas automáticas intensas e não use o serviço como autocomplete. O botão de busca faz apenas uma solicitação por ação. Consulte https://operations.osmfoundation.org/policies/nominatim/ .
- OpenStreetMap/Nominatim podem não listar todos os restaurantes. Nesses casos, cadastre o ponto manualmente.
- Todos os restaurantes cadastrados ficam visíveis para usuários logados; **o conteúdo das avaliações é limitado a você e às amizades aceitas**. Dados de localização são uma contribuição compartilhada.
- O mapa abre inicialmente em São Paulo como localização ilustrativa. A pessoa pode navegar no mapa ou usar o botão de localização com permissão explícita.
- O modo demonstração não sincroniza entre navegadores e não migra automaticamente os dados para o Supabase.
- No modo real, caso a conta seja excluída, os registros de restaurantes criados por ela são removidos devido à referência ao criador; para um projeto público maduro, vale implementar moderação e tratamento de lugares duplicados.

## Estrutura

- `index.html` — interface
- `styles.css` — estilo responsivo
- `app.js` — lógica do mapa, avaliações, amizades e autenticação
- `config.js` — configuração pública do Supabase
- `schema.sql` — tabelas e regras de segurança do Supabase
- `favicon.svg` — ícone

Este projeto usa recursos externos de OpenStreetMap, Leaflet, Google Fonts e CDN do Supabase. Requer conexão com a internet.
