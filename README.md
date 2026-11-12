# Restaurantes — versão 8 (sem custos de API)

## Instalação

1. Envie os arquivos deste ZIP para a raiz do repositório GitHub Pages, substituindo os arquivos antigos.
2. Confirme a publicação na aba Actions. Abra o site em aba privada no celular.
3. Nenhum SQL adicional é necessário **se a versão 7 já foi configurada**. Caso não tenha configurado a v7, execute `atualizacao-v7.sql` uma única vez no Supabase.

## Mudanças

- Corrigida a fresta entre a lista de restaurantes e o menu inferior no iPhone, usando alturas compatíveis e uma faixa opaca de segurança.
- Busca por nome aprimorada: pesquisa global no Photon e, caso não haja correspondência suficiente, busca adicional de restaurantes no OpenStreetMap via Overpass em até 30 km do centro do mapa.
- As opções exibem nome e endereço disponível. Selecionar uma sugestão preenche as coordenadas para o marcador; confirme o endereço antes de avaliar.
- Sem chave paga, mas **sem acesso ao catálogo do Google Maps**: locais ausentes do OpenStreetMap podem não aparecer.
- APIs públicas têm limites e não garantem disponibilidade. As pesquisas são acionadas após pausa de digitação; não faça testes automatizados repetitivos.
- Para procurar um estabelecimento de outra cidade, mova o mapa até essa cidade. O Photon também pesquisa nomes sem restrição regional.

## Teste sugerido

No celular, verifique que não há faixa de mapa visível entre a lista e o menu. Em 'Avaliar lugar', digite um nome e observe sugestões; confirme sempre o endereço antes de salvar. Para um nome ausente das bases, continue pela busca manual de endereço.
