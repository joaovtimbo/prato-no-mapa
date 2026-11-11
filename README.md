# Restaurantes — v4 (mobile)

## Atualizar GitHub Pages
Substitua os arquivos da raiz do repositório pelos deste ZIP (especialmente `index.html`, `styles.css`, `app.js`). A configuração atual de Supabase foi preservada. Nenhuma migração SQL adicional é necessária se você já executou `atualizacao-v3.sql`.

## Correções desta versão
- Removida a caixa de busca do topo. A busca de endereço existe somente durante o cadastro ou edição de restaurantes.
- `font-size: 16px` nos campos em dispositivos touch para evitar zoom automático do Safari sem impedir pinch-to-zoom.
- Mapa base OpenStreetMap padrão sem inversões de cores/filtragem que afetavam os tiles.
- GPS solicita localização no carregamento e no botão ⌖; usa alta precisão, exibe estimativa de erro e círculo de precisão. Necessita HTTPS e permissão do navegador, além da opção Localização Precisa ligada no iPhone.
- Marcadores dos restaurantes são gerados com as coordenadas lat/lng salvas no Supabase. Ao cadastrar, a pessoa seleciona o resultado de endereço, ou o ponto no mapa.
- A tela do mapa recalcula dimensões após alternância de aba/orientação.

## Restrições
O navegador não consegue forçar GPS exato: a precisão depende do aparelho, rede, permissões e ambiente. Google Maps Javascript exige API key e faturamento, portanto esta versão usa mapa padrão do OpenStreetMap sem chave, mantendo a interface escura.
Mapas OSM e geocodificação pública (Nominatim) têm limites de uso e disponibilidade; destinados a testes e uso pessoal leve. Para implantação maior, use provedor com SLA ou infraestrutura própria.

## Teste no iPhone
1. Verifique GitHub Pages Actions e abra o site atualizado em aba privativa.
2. Vá à aba Mapa, autorize Localização Precisa e toque em ⌖.
3. Toque em Avaliar lugar, digite nome e endereço completo e clique em Buscar endereço no mapa. Escolha resultado, dê nota e salve.
4. Confirme o marcador no mapa e o cartão na lista. Teste excluir avaliação e editar restaurante.
