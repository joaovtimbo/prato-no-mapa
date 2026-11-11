# Restaurantes — versão 5

Atualização do mapa e dos cartões mobile.

## Instalação
Envie **todos os arquivos** desta pasta para a raiz do repositório GitHub Pages, substituindo os arquivos anteriores. Não há migração SQL nesta atualização. As contas e os restaurantes do Supabase são preservados.

## Mudanças
- Leaflet com zoom por pinça, duplo toque, arraste e botões `+` e `−`.
- GPS solicitado ao entrar. O ícone `⌖` força nova solicitação e recentraliza na localização autorizada. Se não houver permissão, o mapa não alega conhecer a posição do aparelho.
- Tocar no mapa não abre mais cadastro involuntário. O botão **Avaliar lugar** abre o fluxo de endereço e avaliação.
- Endereços longos quebram linha no cartão, com limite visual de três linhas e sem rolagem horizontal.
- Mapa padrão OpenStreetMap com atribuição, sem filtros, máscaras ou chave de API.

## Limites
O GPS depende das permissões do Safari/iOS, da opção Localização Precisa e da qualidade do sinal. Os blocos do OpenStreetMap são fornecidos por terceiro e podem falhar por rede/bloqueadores; não há garantia de disponibilidade. Para uma experiência com a mesma infraestrutura e cobertura visual do Google Maps, seria necessária integração oficial com Google Maps Platform, que exige chave e configuração de faturamento.

## Testes no iPhone
- Permitir localização precisa para Safari, depois tocar em `⌖`.
- Tocar `−` repetidas vezes e arrastar o mapa; pinçar para aproximar e afastar.
- Verificar restaurante cadastrado no mapa; se o endereço foi geocodificado incorretamente na versão anterior, editar o endereço e selecionar o resultado certo.
- Confirmar que um endereço longo aparece em até três linhas, sem arrastar a página horizontalmente.
