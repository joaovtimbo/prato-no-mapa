# Restaurantes — versão 6 (mapa vetorial)

Esta versão substitui o mapa antigo baseado em imagens quadradas (Leaflet + raster tiles) por **MapLibre GL JS + OpenFreeMap** (camadas vetoriais). Não requer chave de API para o mapa.

## Publicar

1. Faça backup dos arquivos atuais do repositório.
2. Faça upload dos arquivos desta pasta na **raiz** do repositório GitHub Pages, substituindo os homônimos.
3. Aguarde o deploy em Actions e recarregue a página em uma aba privada do celular.

**Não é necessário modificar o Supabase ou executar SQL.** Perfis, restaurantes, avaliações e amizades permanecem no banco de dados existente.

## Testar

- Dar permissão de localização precisa ao navegador e tocar em ⌖. Se negada, o site não tenta adivinhar sua posição.
- Usar dois dedos para zoom, arrastar e tocar nos marcadores dos restaurantes.
- Cadastrar um restaurante informando endereço completo, pesquisando e selecionando o resultado correto.
- Conferir se nomes/endereços longos quebram linha, sem rolagem lateral.

O estilo `https://tiles.openfreemap.org/styles/liberty` fornece o mapa vetorial. A exatidão do GPS depende do dispositivo/permissões. A busca de endereços continua usando Nominatim (OpenStreetMap). O mapa precisa de internet e um navegador compatível com WebGL.

Nota: código validado estaticamente, mas não testado em um iPhone físico.
