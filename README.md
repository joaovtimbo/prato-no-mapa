# Restaurantes v9.1 - correção de inicialização

Esta versão corrige a inicialização travada observada na v9.0. A chave Geoapify agora é opcional; mesmo que o arquivo `config.js` do GitHub não exporte `GEOAPIFY_API_KEY`, o mapa, login e avaliações continuam funcionando. Também corrigimos a expressão regular da busca próxima e forçamos atualização do cache.

## Publicação

1. Abra o ZIP e faça upload dos arquivos para a raiz do repositório GitHub Pages, substituindo os existentes.
2. Confirme o commit na branch main e aguarde a publicação em Actions.
3. Teste em janela privada no iPhone.
4. Para ativar Geoapify, adicione `export const GEOAPIFY_API_KEY = 'SUA_CHAVE';` em `config.js`. Nunca coloque chave secreta do Supabase no GitHub.

Não precisa executar SQL e os dados existentes não são modificados. O mapa continua MapLibre GL JS com OpenFreeMap.

A cobertura de restaurantes ainda depende dos dados do provedor e pode não incluir todos os estabelecimentos do Google Maps.
