import type { Alimento } from './types'

/**
 * [nome, categoria, kcal, prot, carb, gord, fibra, sodio, medidas, unidade?]
 *
 * `sodio` e em MILIGRAMAS por 100 g, referencia TACO/USDA, e vale pro alimento
 * COMO ESTA - sem sal adicionado. Arroz e feijao cozidos aparecem com ~2 mg
 * porque e isso que o graõ tem: o sal da panela nao esta aqui, ele e lancado
 * separado como "Sal de cozinha". Fingir um valor medio de sal caseiro daria um
 * numero errado pra todo mundo.
 */
type Linha = [string, string, number, number, number, number, number, number, string, ('g' | 'ml')?]

const L: Linha[] = [
  /* ------------------------- CARBOIDRATOS ------------------------- */
  ['Arroz branco cozido', 'Carboidratos', 128, 2.5, 28.1, 0.2, 1.6, 1, 'colher de sopa:25|escumadeira:80|prato (porcao):150'],
  ['Arroz integral cozido', 'Carboidratos', 124, 2.6, 25.8, 1.0, 2.7, 1, 'colher de sopa:25|escumadeira:80|prato (porcao):150'],
  ['Macarrao cozido', 'Carboidratos', 158, 5.8, 30.9, 1.1, 1.8, 1, 'pegador:80|prato (porcao):200'],
  ['Batata inglesa cozida', 'Carboidratos', 52, 1.2, 11.9, 0.1, 1.3, 2, 'unidade media:135|colher de sopa:30'],
  ['Batata doce cozida', 'Carboidratos', 77, 0.6, 18.4, 0.1, 2.2, 9, 'unidade media:150|fatia:40'],
  ['Mandioca cozida', 'Carboidratos', 125, 0.6, 30.1, 0.3, 1.6, 2, 'pedaco medio:80'],
  ['Pao frances', 'Carboidratos', 300, 8.0, 58.6, 3.1, 2.3, 648, 'unidade:50|metade:25'],
  ['Pao de forma integral', 'Carboidratos', 253, 9.4, 49.9, 3.7, 6.9, 480, 'fatia:25|2 fatias:50'],
  ['Pao de forma branco', 'Carboidratos', 269, 8.0, 51.0, 3.5, 2.3, 500, 'fatia:25|2 fatias:50'],
  ['Tapioca (goma hidratada)', 'Carboidratos', 240, 0.0, 60.0, 0.0, 0.5, 1, 'colher de sopa:20|beiju medio:60'],
  ['Aveia em flocos', 'Carboidratos', 394, 13.9, 66.6, 8.5, 9.1, 3, 'colher de sopa:15|xicara:80'],
  ['Granola', 'Carboidratos', 471, 8.9, 63.0, 20.0, 6.0, 30, 'colher de sopa:15|xicara:60'],
  ['Cuscuz de milho cozido', 'Carboidratos', 113, 2.2, 25.3, 0.5, 1.6, 5, 'fatia:80|prato:150'],
  ['Pao de queijo', 'Carboidratos', 337, 5.5, 40.0, 17.0, 1.0, 570, 'unidade pequena:20|unidade grande:50'],
  ['Farofa pronta', 'Carboidratos', 406, 2.5, 78.0, 10.0, 5.0, 700, 'colher de sopa:15'],
  ['Macarrao instantaneo', 'Carboidratos', 436, 9.0, 60.0, 17.0, 3.0, 1800, 'pacote:80'],
  ['Panqueca de aveia', 'Carboidratos', 190, 9.0, 22.0, 6.0, 3.0, 120, 'unidade:70'],
  ['Torrada integral', 'Carboidratos', 380, 11.0, 70.0, 6.0, 6.0, 600, 'unidade:8'],

  ['Polvilho doce', 'Carboidratos', 351, 0.3, 86.4, 0.2, 0.5, 2, 'colher de sopa:12'],
  ['Farinha de mandioca', 'Carboidratos', 361, 1.6, 87.9, 0.3, 6.4, 3, 'colher de sopa:15'],
  ['Inhame cozido', 'Carboidratos', 97, 2.1, 23.2, 0.1, 1.7, 8, 'pedaco medio:80'],
  ['Quinoa cozida', 'Carboidratos', 120, 4.4, 21.3, 1.9, 2.8, 7, 'colher de sopa:25|escumadeira:80'],
  ['Milho de pipoca (estourada)', 'Carboidratos', 387, 12.9, 77.9, 4.5, 14.5, 4, 'xicara:8'],
  ['Batata baroa cozida', 'Carboidratos', 80, 1.0, 18.9, 0.2, 1.9, 6, 'pedaco medio:70'],
  ['Cara cozido', 'Carboidratos', 108, 2.3, 25.8, 0.1, 1.5, 8, 'pedaco medio:80'],

  /* ------------------------- PROTEINAS ------------------------- */
  ['Peito de frango grelhado', 'Proteinas', 165, 31.0, 0.0, 3.6, 0, 70, 'file medio:120|file grande:180'],
  ['Coxa de frango sem pele cozida', 'Proteinas', 170, 26.0, 0.0, 7.0, 0, 86, 'unidade:70'],
  ['Sobrecoxa assada sem pele', 'Proteinas', 184, 25.0, 0.0, 9.0, 0, 88, 'unidade:90'],
  ['Ovo de galinha cozido', 'Proteinas', 146, 13.3, 0.6, 9.5, 0, 140, 'unidade:50|gema:17|clara:33'],
  ['Ovo mexido (com oleo)', 'Proteinas', 196, 13.0, 1.0, 15.0, 0, 150, 'unidade:55'],
  ['Clara de ovo', 'Proteinas', 52, 10.9, 0.7, 0.2, 0, 166, 'unidade:33|copo:240'],
  ['Patinho grelhado', 'Proteinas', 219, 35.9, 0.0, 7.3, 0, 53, 'bife medio:100'],
  ['Alcatra grelhada', 'Proteinas', 241, 32.0, 0.0, 12.0, 0, 55, 'bife medio:120'],
  ['Coxao mole cozido', 'Proteinas', 219, 32.0, 0.0, 9.0, 0, 50, 'porcao:100'],
  ['Contrafile grelhado', 'Proteinas', 278, 32.0, 0.0, 16.0, 0, 55, 'bife medio:130'],
  ['Carne moida (acem) refogada', 'Proteinas', 212, 26.7, 0.0, 11.0, 0, 60, 'colher de sopa:25|concha:90'],
  ['Lombo suino assado', 'Proteinas', 210, 35.7, 0.0, 6.4, 0, 55, 'fatia:80'],
  ['Bisteca suina grelhada', 'Proteinas', 301, 27.0, 0.0, 21.0, 0, 60, 'unidade:110'],
  ['Tilapia grelhada', 'Proteinas', 128, 26.2, 0.0, 2.0, 0, 52, 'file medio:120'],
  ['Salmao grelhado', 'Proteinas', 208, 22.5, 0.0, 12.4, 0, 60, 'posta:130'],
  ['Sardinha em lata (drenada)', 'Proteinas', 208, 24.6, 0.0, 11.5, 0, 400, 'lata drenada:85|unidade:25'],
  ['Atum em lata na agua', 'Proteinas', 116, 26.0, 0.0, 1.0, 0, 320, 'lata drenada:120|colher de sopa:20'],
  ['Camarao cozido', 'Proteinas', 99, 24.0, 0.2, 0.3, 0, 250, 'porcao:100'],
  ['Peito de peru defumado', 'Proteinas', 110, 18.0, 3.0, 3.0, 0, 1100, 'fatia:15'],
  ['Presunto magro', 'Proteinas', 120, 17.0, 2.0, 5.0, 0, 1000, 'fatia:15'],
  ['Linguica calabresa', 'Proteinas', 296, 20.0, 2.0, 23.0, 0, 1300, 'gomo:50|rodela:10'],
  ['Bacon frito', 'Proteinas', 541, 37.0, 0.0, 43.0, 0, 1800, 'fatia:10'],
  ['Hamburguer bovino', 'Proteinas', 250, 18.0, 5.0, 18.0, 0, 600, 'unidade:80'],

  ['File de merluza grelhado', 'Proteinas', 110, 23.0, 0.0, 1.6, 0, 90, 'file medio:120'],
  ['Peito de frango desfiado', 'Proteinas', 163, 30.0, 0.0, 4.0, 0, 70, 'colher de sopa:25|xicara:120'],
  ['Coracao de frango grelhado', 'Proteinas', 153, 26.4, 0.0, 4.7, 0, 75, 'unidade:12'],
  ['Figado bovino grelhado', 'Proteinas', 180, 27.0, 3.6, 5.9, 0, 70, 'bife medio:100'],
  ['Musculo bovino cozido', 'Proteinas', 190, 30.0, 0.0, 7.0, 0, 50, 'pedaco medio:100'],
  ['Ovo de codorna cozido', 'Proteinas', 158, 13.1, 0.4, 11.1, 0, 141, 'unidade:10'],
  ['Carne seca dessalgada cozida', 'Proteinas', 211, 31.0, 0.0, 9.0, 0, 1200, 'pedaco medio:80'],

  /* ------------------------- LEGUMINOSAS ------------------------- */
  ['Feijao carioca cozido', 'Leguminosas', 76, 4.8, 13.6, 0.5, 8.5, 2, 'concha media:80|colher de sopa:25'],
  ['Feijao preto cozido', 'Leguminosas', 77, 4.5, 14.0, 0.5, 8.4, 2, 'concha media:80|colher de sopa:25'],
  ['Lentilha cozida', 'Leguminosas', 116, 9.0, 20.1, 0.4, 7.9, 2, 'concha media:80|colher de sopa:25'],
  ['Grao de bico cozido', 'Leguminosas', 164, 8.9, 27.4, 2.6, 7.6, 6, 'concha media:80|colher de sopa:25'],
  ['Soja cozida', 'Leguminosas', 172, 18.2, 8.4, 9.0, 6.0, 2, 'colher de sopa:25'],
  ['Tofu', 'Leguminosas', 76, 8.1, 1.9, 4.8, 0.3, 10, 'fatia:40|porcao:100'],
  ['Ervilha cozida', 'Leguminosas', 81, 5.4, 14.5, 0.4, 5.1, 3, 'colher de sopa:20'],

  ['Feijao fradinho cozido', 'Leguminosas', 78, 5.1, 13.5, 0.5, 6.5, 4, 'concha media:80'],
  ['Proteina de soja texturizada (hidratada)', 'Leguminosas', 96, 15.0, 6.0, 1.0, 4.0, 10, 'colher de sopa:20|xicara:90'],

  /* ------------------------- LATICINIOS ------------------------- */
  ['Leite integral', 'Laticinios', 61, 3.2, 4.7, 3.3, 0, 50, 'copo (200 ml):200|xicara:240', 'ml'],
  ['Leite desnatado', 'Laticinios', 35, 3.4, 4.9, 0.2, 0, 52, 'copo (200 ml):200|xicara:240', 'ml'],
  ['Iogurte natural integral', 'Laticinios', 61, 3.5, 4.7, 3.3, 0, 50, 'pote:170|copo:200'],
  ['Iogurte natural desnatado', 'Laticinios', 41, 4.1, 4.7, 0.2, 0, 55, 'pote:170'],
  ['Iogurte grego', 'Laticinios', 97, 9.0, 4.0, 5.0, 0, 40, 'pote:130'],
  ['Queijo minas frescal', 'Laticinios', 264, 17.4, 3.2, 20.2, 0, 350, 'fatia:30'],
  ['Queijo mussarela', 'Laticinios', 330, 22.6, 3.0, 25.2, 0, 580, 'fatia:20'],
  ['Queijo prato', 'Laticinios', 360, 22.7, 1.9, 29.1, 0, 600, 'fatia:20'],
  ['Requeijao cremoso', 'Laticinios', 257, 9.6, 3.4, 22.6, 0, 700, 'colher de sopa:20'],
  ['Queijo cottage', 'Laticinios', 98, 11.0, 3.4, 4.3, 0, 380, 'colher de sopa:30|pote:200'],
  ['Ricota', 'Laticinios', 140, 12.6, 3.8, 8.1, 0, 80, 'fatia:30'],
  ['Creme de leite', 'Laticinios', 200, 2.5, 4.0, 20.0, 0, 40, 'colher de sopa:15|caixinha:200'],
  ['Manteiga', 'Laticinios', 717, 0.9, 0.1, 81.0, 0, 580, 'colher de cha:5|ponta de faca:3'],

  ['Leite sem lactose integral', 'Laticinios', 61, 3.2, 4.7, 3.3, 0, 50, 'copo (200 ml):200', 'ml'],
  ['Iogurte sem lactose', 'Laticinios', 51, 4.1, 5.5, 1.5, 0, 50, 'pote:170'],
  ['Queijo coalho', 'Laticinios', 300, 24.0, 2.0, 22.0, 0, 700, 'espeto:60|fatia:30'],
  ['Kefir de leite', 'Laticinios', 55, 3.3, 4.5, 2.5, 0, 50, 'copo (200 ml):200', 'ml'],

  /* ------------------------- FRUTAS ------------------------- */
  ['Banana prata', 'Frutas', 98, 1.3, 26.0, 0.1, 2.0, 1, 'unidade media:70|unidade grande:100'],
  ['Banana nanica', 'Frutas', 92, 1.4, 23.8, 0.1, 1.9, 1, 'unidade media:85'],
  ['Maca', 'Frutas', 56, 0.3, 15.2, 0.0, 1.3, 1, 'unidade media:130'],
  ['Laranja', 'Frutas', 45, 1.0, 11.5, 0.1, 1.1, 1, 'unidade media:180'],
  ['Mamao papaia', 'Frutas', 40, 0.5, 10.4, 0.1, 1.0, 3, 'metade:170|fatia:100'],
  ['Melancia', 'Frutas', 33, 0.9, 8.1, 0.0, 0.1, 1, 'fatia:200'],
  ['Abacaxi', 'Frutas', 48, 0.9, 12.3, 0.1, 1.0, 1, 'fatia:75'],
  ['Manga', 'Frutas', 64, 0.4, 16.7, 0.2, 1.6, 2, 'unidade media:200'],
  ['Uva', 'Frutas', 53, 0.7, 13.6, 0.2, 0.9, 2, 'cacho pequeno:100|unidade:6'],
  ['Morango', 'Frutas', 30, 0.9, 6.8, 0.3, 1.7, 1, 'unidade:12|xicara:150'],
  ['Abacate', 'Frutas', 96, 1.2, 6.0, 8.4, 6.3, 2, 'colher de sopa:25|metade:100'],
  ['Pera', 'Frutas', 53, 0.6, 14.0, 0.1, 3.0, 1, 'unidade media:130'],
  ['Melao', 'Frutas', 29, 0.7, 7.5, 0.0, 0.3, 11, 'fatia:150'],
  ['Kiwi', 'Frutas', 51, 1.3, 11.5, 0.6, 2.7, 3, 'unidade:75'],
  ['Acai polpa (sem acucar)', 'Frutas', 58, 0.8, 6.2, 3.9, 2.6, 8, 'polpa:100'],

  ['Goiaba', 'Frutas', 54, 1.1, 13.0, 0.4, 6.2, 3, 'unidade media:130'],
  ['Tangerina', 'Frutas', 58, 0.8, 13.4, 0.2, 1.7, 2, 'unidade media:130'],
  ['Maracuja (polpa)', 'Frutas', 68, 2.0, 12.3, 2.1, 1.1, 2, 'unidade media:60'],
  ['Ameixa fresca', 'Frutas', 53, 0.8, 13.9, 0.3, 1.9, 0, 'unidade media:65'],
  ['Tamara seca', 'Frutas', 282, 2.5, 75.0, 0.4, 8.0, 2, 'unidade:8'],
  ['Banana passa', 'Frutas', 318, 3.0, 80.0, 0.6, 7.0, 3, 'unidade:20'],

  /* ------------------------- VERDURAS E LEGUMES ------------------------- */
  ['Alface', 'Verduras e legumes', 15, 1.4, 2.4, 0.2, 2.3, 7, 'folha:10|prato:60'],
  ['Tomate', 'Verduras e legumes', 15, 1.1, 3.1, 0.2, 1.2, 5, 'unidade media:90|fatia:15'],
  ['Cenoura crua', 'Verduras e legumes', 34, 1.3, 7.7, 0.2, 3.2, 69, 'unidade media:70|colher de sopa:20'],
  ['Brocolis cozido', 'Verduras e legumes', 25, 2.1, 4.4, 0.5, 3.4, 8, 'colher de sopa:20|prato:80'],
  ['Couve refogada', 'Verduras e legumes', 90, 1.7, 8.7, 5.5, 3.1, 20, 'colher de sopa:20'],
  ['Abobrinha cozida', 'Verduras e legumes', 15, 1.1, 3.0, 0.2, 1.5, 3, 'colher de sopa:25'],
  ['Chuchu cozido', 'Verduras e legumes', 19, 0.4, 4.8, 0.1, 1.0, 2, 'colher de sopa:25'],
  ['Beterraba cozida', 'Verduras e legumes', 32, 1.3, 7.2, 0.1, 1.9, 60, 'colher de sopa:25'],
  ['Pepino', 'Verduras e legumes', 10, 0.9, 2.0, 0.0, 1.1, 2, 'unidade:120|fatia:8'],
  ['Cebola', 'Verduras e legumes', 39, 1.7, 8.9, 0.1, 2.2, 4, 'unidade media:80|colher de sopa:15'],
  ['Espinafre refogado', 'Verduras e legumes', 26, 2.7, 4.6, 0.4, 2.5, 70, 'colher de sopa:20'],
  ['Repolho', 'Verduras e legumes', 25, 1.9, 5.8, 0.1, 2.0, 6, 'colher de sopa:20'],
  ['Vagem cozida', 'Verduras e legumes', 25, 1.8, 5.3, 0.2, 2.4, 4, 'colher de sopa:20'],
  ['Berinjela cozida', 'Verduras e legumes', 19, 0.7, 4.5, 0.1, 2.9, 2, 'colher de sopa:25'],
  ['Milho verde cozido', 'Verduras e legumes', 98, 3.2, 18.8, 1.0, 3.9, 15, 'colher de sopa:20|espiga:90'],

  ['Abobora cozida', 'Verduras e legumes', 48, 1.0, 12.0, 0.1, 2.5, 1, 'colher de sopa:30|prato:120'],
  ['Quiabo cozido', 'Verduras e legumes', 30, 1.9, 6.4, 0.3, 3.2, 5, 'colher de sopa:25'],
  ['Rucula', 'Verduras e legumes', 25, 2.6, 3.7, 0.7, 1.6, 27, 'prato:40'],
  ['Couve-flor cozida', 'Verduras e legumes', 19, 1.2, 3.9, 0.3, 2.1, 15, 'prato:80'],
  ['Pimentao', 'Verduras e legumes', 21, 1.1, 4.9, 0.2, 2.6, 3, 'unidade media:100'],
  ['Cogumelo (champignon)', 'Verduras e legumes', 22, 3.1, 3.3, 0.3, 1.0, 5, 'colher de sopa:20'],

  /* ------------------------- GORDURAS E OLEAGINOSAS ------------------------- */
  ['Azeite de oliva', 'Gorduras', 884, 0.0, 0.0, 100.0, 0, 1, 'colher de sopa:13|fio:5', 'ml'],
  ['Oleo de soja', 'Gorduras', 884, 0.0, 0.0, 100.0, 0, 0, 'colher de sopa:13', 'ml'],
  ['Castanha do Para', 'Gorduras', 643, 14.5, 15.1, 63.5, 7.9, 2, 'unidade:5'],
  ['Castanha de caju', 'Gorduras', 570, 18.5, 29.1, 46.3, 3.7, 12, 'unidade:2|punhado:30'],
  ['Amendoim', 'Gorduras', 544, 27.2, 20.3, 43.9, 8.0, 5, 'punhado:30|colher de sopa:12'],
  ['Amendoas', 'Gorduras', 581, 21.2, 19.5, 47.3, 11.6, 1, 'unidade:1.2|punhado:28'],
  ['Nozes', 'Gorduras', 620, 14.0, 18.4, 59.4, 6.7, 2, 'unidade:5'],
  ['Pasta de amendoim integral', 'Gorduras', 588, 25.0, 20.0, 50.0, 6.0, 17, 'colher de sopa:15'],
  ['Chia', 'Gorduras', 486, 16.5, 42.1, 30.7, 34.4, 16, 'colher de sopa:12'],
  ['Linhaca', 'Gorduras', 495, 14.1, 43.3, 32.3, 33.5, 30, 'colher de sopa:12'],
  ['Coco ralado', 'Gorduras', 406, 3.4, 9.4, 42.0, 5.4, 20, 'colher de sopa:8'],

  ['Oleo de coco', 'Gorduras', 892, 0.0, 0.0, 99.9, 0, 0, 'colher de sopa:13'],
  ['Semente de girassol', 'Gorduras', 584, 20.8, 20.0, 51.5, 8.6, 9, 'punhado:30'],
  ['Gergelim', 'Gorduras', 573, 17.7, 23.4, 49.7, 11.8, 11, 'colher de sopa:9'],
  ['Pasta de castanha de caju', 'Gorduras', 587, 18.0, 27.0, 46.0, 3.3, 15, 'colher de sopa:15'],

  /* ------------------------- SUPLEMENTOS ------------------------- */
  ['Whey protein concentrado', 'Suplementos', 400, 80.0, 8.0, 6.0, 0, 250, 'scoop (30 g):30|dose (2 scoops):60'],
  ['Whey protein isolado', 'Suplementos', 373, 90.0, 2.0, 1.0, 0, 200, 'scoop (30 g):30'],
  ['Albumina', 'Suplementos', 375, 82.0, 5.0, 0.5, 0, 800, 'colher de sopa:15'],
  ['Caseina', 'Suplementos', 370, 78.0, 8.0, 3.0, 0, 200, 'scoop (30 g):30'],
  ['Maltodextrina', 'Suplementos', 380, 0.0, 95.0, 0.0, 0, 10, 'scoop (30 g):30'],
  ['Creatina', 'Suplementos', 0, 0.0, 0.0, 0.0, 0, 5, 'dose (5 g):5'],
  ['Barra de proteina', 'Suplementos', 350, 30.0, 35.0, 10.0, 5.0, 200, 'unidade:50'],
  ['Hipercalorico', 'Suplementos', 380, 15.0, 75.0, 3.0, 2.0, 300, 'dose (100 g):100'],

  /* ------------------------- BEBIDAS ------------------------- */
  ['Agua', 'Bebidas', 0, 0, 0, 0, 0, 2, 'copo (200 ml):200|garrafa (500 ml):500', 'ml'],
  ['Cafe sem acucar', 'Bebidas', 2, 0.1, 0.3, 0.0, 0, 2, 'xicara:50|copo:200', 'ml'],
  ['Suco de laranja natural', 'Bebidas', 45, 0.7, 10.4, 0.2, 0.2, 1, 'copo (200 ml):200', 'ml'],
  ['Agua de coco', 'Bebidas', 22, 0.3, 5.3, 0.0, 0.1, 105, 'copo (200 ml):200', 'ml'],
  ['Refrigerante cola', 'Bebidas', 42, 0.0, 10.6, 0.0, 0, 10, 'lata (350 ml):350|copo:200', 'ml'],
  ['Refrigerante zero', 'Bebidas', 0.3, 0.0, 0.0, 0.0, 0, 12, 'lata (350 ml):350', 'ml'],
  ['Cerveja', 'Bebidas', 43, 0.5, 3.6, 0.0, 0, 4, 'lata (350 ml):350|copo:300', 'ml'],
  ['Leite de amendoas sem acucar', 'Bebidas', 15, 0.5, 0.6, 1.2, 0.3, 60, 'copo (200 ml):200', 'ml'],
  ['Energetico', 'Bebidas', 45, 0.0, 11.0, 0.0, 0, 100, 'lata (250 ml):250', 'ml'],

  /* ------------------------- DOCES E LANCHES ------------------------- */
  ['Chocolate ao leite', 'Doces e lanches', 540, 7.3, 59.4, 30.3, 2.4, 80, 'quadradinho:6|barra (90 g):90'],
  ['Chocolate 70% cacau', 'Doces e lanches', 550, 7.8, 45.9, 38.0, 10.9, 20, 'quadradinho:6|barra (90 g):90'],
  ['Biscoito recheado', 'Doces e lanches', 472, 6.0, 70.0, 19.0, 2.0, 300, 'unidade:12|pacote:130'],
  ['Bolacha agua e sal', 'Doces e lanches', 432, 10.0, 70.0, 12.0, 2.5, 700, 'unidade:7'],
  ['Acucar refinado', 'Doces e lanches', 387, 0.0, 99.5, 0.0, 0, 0, 'colher de cha:5|colher de sopa:12'],
  ['Mel', 'Doces e lanches', 309, 0.3, 84.0, 0.0, 0, 4, 'colher de sopa:20'],
  ['Sorvete de creme', 'Doces e lanches', 207, 3.5, 23.0, 11.0, 0.7, 80, 'bola:60|pote:200'],
  ['Pizza de mussarela', 'Doces e lanches', 266, 11.0, 33.0, 10.0, 2.0, 600, 'fatia:110'],
  ['Coxinha', 'Doces e lanches', 297, 8.0, 30.0, 16.0, 1.5, 500, 'unidade:80'],
  ['Batata frita', 'Doces e lanches', 312, 3.4, 41.0, 15.0, 3.8, 400, 'porcao pequena:100'],

  /* ------------------------- MOLHOS E TEMPEROS ------------------------- */
  ['Maionese', 'Molhos', 680, 1.1, 2.9, 74.0, 0, 700, 'colher de sopa:15'],
  ['Ketchup', 'Molhos', 112, 1.7, 26.0, 0.2, 0.3, 1100, 'colher de sopa:15'],
  ['Molho de tomate', 'Molhos', 38, 1.5, 7.6, 0.4, 1.3, 400, 'colher de sopa:20|concha:80'],
  ['Mostarda', 'Molhos', 66, 4.0, 6.0, 3.0, 3.0, 1100, 'colher de sopa:15'],
  ['Shoyu', 'Molhos', 53, 8.0, 5.0, 0.0, 0.8, 5500, 'colher de sopa:15', 'ml'],
  ['Sal de cozinha', 'Molhos', 0, 0, 0, 0, 0, 38758, 'pitada:0.4|colher de cha rasa:5|colher de sopa:15'],
  ['Vinagre', 'Molhos', 18, 0.0, 0.6, 0.0, 0, 2, 'colher de sopa:15', 'ml'],
]

export const ALIMENTOS_SEED: Alimento[] = L.map(
  ([nome, categoria, kcal, prot, carb, gord, fibra, sodio, medidas, unidade]) => ({
    id: 'al_' + nome.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    nome,
    categoria,
    kcal, prot, carb, gord, fibra, sodio,
    unidadeBase: unidade ?? 'g',
    medidas: medidas.split('|').filter(Boolean).map(m => {
      const [n, g] = m.split(':')
      return { nome: n, gramas: Number(g) }
    }),
    custom: false,
    atualizadoEm: 0,
  }),
)

export const CATEGORIAS_ALIMENTO = [
  'Proteinas', 'Carboidratos', 'Leguminosas', 'Laticinios', 'Frutas',
  'Verduras e legumes', 'Gorduras', 'Suplementos', 'Bebidas',
  'Doces e lanches', 'Molhos',
]

export const REFEICOES_PADRAO = [
  { nome: 'Cafe da manha', horario: '07:30' },
  { nome: 'Lanche da manha', horario: '10:00' },
  { nome: 'Almoco', horario: '12:30' },
  { nome: 'Lanche da tarde', horario: '16:00' },
  { nome: 'Pre-treino', horario: '18:00' },
  { nome: 'Jantar', horario: '21:00' },
]
