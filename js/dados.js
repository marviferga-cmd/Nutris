'use strict';

/**
 * Tabela de alimentos — valores por 100 g (ou 100 ml) da parte comestível.
 * Valores aproximados, baseados principalmente na TACO (NEPA/Unicamp, 4ª ed.)
 * e complementados pela USDA FoodData Central quando o item não consta na TACO.
 * kcal = energia, p = proteína (g), c = carboidrato (g), l = lipídio (g), f = fibra (g)
 * med = medida caseira [descrição, gramas]
 */
const ALIMENTOS = [
  // Cereais, pães e tubérculos
  { id: 'arroz_branco', nome: 'Arroz branco cozido', grupo: 'Cereais e tubérculos', kcal: 128, p: 2.5, c: 28.1, l: 0.2, f: 1.6, med: ['colher de sopa cheia', 25] },
  { id: 'arroz_integral', nome: 'Arroz integral cozido', grupo: 'Cereais e tubérculos', kcal: 124, p: 2.6, c: 25.8, l: 1.0, f: 2.7, med: ['colher de sopa cheia', 25] },
  { id: 'macarrao_integral', nome: 'Macarrão integral cozido', grupo: 'Cereais e tubérculos', kcal: 124, p: 5.3, c: 26.5, l: 0.5, f: 3.9, med: ['pegador', 100] },
  { id: 'quinoa', nome: 'Quinoa cozida', grupo: 'Cereais e tubérculos', kcal: 120, p: 4.4, c: 21.3, l: 1.9, f: 2.8, med: ['colher de sopa', 20] },
  { id: 'aveia', nome: 'Aveia em flocos', grupo: 'Cereais e tubérculos', kcal: 394, p: 13.9, c: 66.6, l: 8.5, f: 9.1, med: ['colher de sopa', 15] },
  { id: 'pao_frances', nome: 'Pão francês', grupo: 'Cereais e tubérculos', kcal: 300, p: 8.0, c: 58.6, l: 3.1, f: 2.3, med: ['unidade', 50] },
  { id: 'pao_integral', nome: 'Pão de forma integral', grupo: 'Cereais e tubérculos', kcal: 253, p: 9.4, c: 49.9, l: 3.7, f: 6.9, med: ['fatia', 25] },
  { id: 'tapioca', nome: 'Goma de tapioca (hidratada)', grupo: 'Cereais e tubérculos', kcal: 240, p: 0.0, c: 60.0, l: 0.0, f: 0.5, med: ['colher de sopa', 20] },
  { id: 'cuscuz', nome: 'Cuscuz de milho cozido', grupo: 'Cereais e tubérculos', kcal: 113, p: 2.2, c: 25.3, l: 0.7, f: 2.1, med: ['pedaço médio', 80] },
  { id: 'batata_doce', nome: 'Batata-doce cozida', grupo: 'Cereais e tubérculos', kcal: 77, p: 0.6, c: 18.4, l: 0.1, f: 2.2, med: ['colher de sopa cheia', 30] },
  { id: 'batata', nome: 'Batata inglesa cozida', grupo: 'Cereais e tubérculos', kcal: 52, p: 1.2, c: 11.9, l: 0.0, f: 1.3, med: ['unidade média', 130] },
  { id: 'mandioca', nome: 'Mandioca cozida', grupo: 'Cereais e tubérculos', kcal: 125, p: 0.6, c: 30.1, l: 0.3, f: 1.6, med: ['pedaço médio', 60] },
  { id: 'farinha_trigo', nome: 'Farinha de trigo', grupo: 'Cereais e tubérculos', kcal: 360, p: 9.8, c: 75.1, l: 1.4, f: 2.3, med: ['colher de sopa', 15] },

  // Leguminosas
  { id: 'feijao_carioca', nome: 'Feijão carioca cozido', grupo: 'Leguminosas', kcal: 76, p: 4.8, c: 13.6, l: 0.5, f: 8.5, med: ['concha média', 80] },
  { id: 'feijao_preto', nome: 'Feijão preto cozido', grupo: 'Leguminosas', kcal: 77, p: 4.5, c: 14.0, l: 0.5, f: 8.4, med: ['concha média', 80] },
  { id: 'lentilha', nome: 'Lentilha cozida', grupo: 'Leguminosas', kcal: 93, p: 6.3, c: 16.3, l: 0.5, f: 7.9, med: ['concha média', 80] },
  { id: 'grao_bico', nome: 'Grão-de-bico cozido', grupo: 'Leguminosas', kcal: 164, p: 8.9, c: 27.4, l: 2.6, f: 7.6, med: ['colher de sopa', 22] },
  { id: 'tofu', nome: 'Tofu', grupo: 'Leguminosas', kcal: 76, p: 8.1, c: 1.9, l: 4.8, f: 0.3, med: ['fatia', 50] },

  // Carnes, peixes e ovos
  { id: 'frango', nome: 'Peito de frango grelhado', grupo: 'Carnes e ovos', kcal: 159, p: 32.0, c: 0.0, l: 2.5, f: 0, med: ['filé médio', 100] },
  { id: 'patinho', nome: 'Patinho bovino grelhado', grupo: 'Carnes e ovos', kcal: 219, p: 35.9, c: 0.0, l: 7.3, f: 0, med: ['bife médio', 100] },
  { id: 'lombo', nome: 'Lombo suíno assado', grupo: 'Carnes e ovos', kcal: 210, p: 35.7, c: 0.0, l: 6.4, f: 0, med: ['fatia média', 80] },
  { id: 'tilapia', nome: 'Tilápia grelhada', grupo: 'Carnes e ovos', kcal: 128, p: 26.2, c: 0.0, l: 2.7, f: 0, med: ['filé médio', 120] },
  { id: 'salmao', nome: 'Salmão grelhado', grupo: 'Carnes e ovos', kcal: 206, p: 22.1, c: 0.0, l: 12.4, f: 0, med: ['posta média', 120] },
  { id: 'atum', nome: 'Atum em água (drenado)', grupo: 'Carnes e ovos', kcal: 116, p: 25.5, c: 0.0, l: 0.8, f: 0, med: ['lata drenada', 120] },
  { id: 'ovo', nome: 'Ovo de galinha cozido', grupo: 'Carnes e ovos', kcal: 146, p: 13.3, c: 0.6, l: 9.5, f: 0, med: ['unidade', 50] },
  { id: 'clara', nome: 'Clara de ovo cozida', grupo: 'Carnes e ovos', kcal: 59, p: 13.4, c: 0.0, l: 0.1, f: 0, med: ['unidade', 30] },

  // Leite e derivados
  { id: 'leite_desnatado', nome: 'Leite desnatado', grupo: 'Leite e derivados', kcal: 35, p: 3.4, c: 4.9, l: 0.1, f: 0, med: ['copo (200 ml)', 200] },
  { id: 'leite_integral', nome: 'Leite integral', grupo: 'Leite e derivados', kcal: 61, p: 3.2, c: 4.7, l: 3.3, f: 0, med: ['copo (200 ml)', 200] },
  { id: 'iogurte_desnatado', nome: 'Iogurte natural desnatado', grupo: 'Leite e derivados', kcal: 41, p: 3.8, c: 5.8, l: 0.3, f: 0, med: ['pote', 170] },
  { id: 'iogurte_integral', nome: 'Iogurte natural integral', grupo: 'Leite e derivados', kcal: 51, p: 4.1, c: 1.9, l: 3.0, f: 0, med: ['pote', 170] },
  { id: 'queijo_minas', nome: 'Queijo minas frescal', grupo: 'Leite e derivados', kcal: 264, p: 17.4, c: 3.2, l: 20.2, f: 0, med: ['fatia média', 30] },
  { id: 'ricota', nome: 'Ricota', grupo: 'Leite e derivados', kcal: 140, p: 12.6, c: 3.8, l: 8.1, f: 0, med: ['fatia média', 30] },
  { id: 'cottage', nome: 'Queijo cottage', grupo: 'Leite e derivados', kcal: 98, p: 11.1, c: 3.4, l: 4.3, f: 0, med: ['colher de sopa', 30] },
  { id: 'whey', nome: 'Whey protein concentrado', grupo: 'Leite e derivados', kcal: 400, p: 80.0, c: 8.0, l: 6.0, f: 0, med: ['scoop', 30] },

  // Frutas
  { id: 'banana', nome: 'Banana prata', grupo: 'Frutas', kcal: 98, p: 1.3, c: 26.0, l: 0.1, f: 2.0, med: ['unidade média', 70] },
  { id: 'maca', nome: 'Maçã', grupo: 'Frutas', kcal: 56, p: 0.3, c: 15.2, l: 0.0, f: 1.3, med: ['unidade média', 130] },
  { id: 'mamao', nome: 'Mamão papaya', grupo: 'Frutas', kcal: 40, p: 0.5, c: 10.4, l: 0.1, f: 1.0, med: ['meia unidade', 150] },
  { id: 'laranja', nome: 'Laranja pera', grupo: 'Frutas', kcal: 37, p: 1.0, c: 8.9, l: 0.1, f: 0.8, med: ['unidade média', 140] },
  { id: 'morango', nome: 'Morango', grupo: 'Frutas', kcal: 30, p: 0.9, c: 6.8, l: 0.3, f: 1.7, med: ['unidade', 12] },
  { id: 'pera', nome: 'Pera', grupo: 'Frutas', kcal: 53, p: 0.6, c: 14.0, l: 0.1, f: 3.0, med: ['unidade média', 130] },
  { id: 'kiwi', nome: 'Kiwi', grupo: 'Frutas', kcal: 51, p: 1.3, c: 11.5, l: 0.6, f: 2.7, med: ['unidade', 75] },
  { id: 'uva', nome: 'Uva', grupo: 'Frutas', kcal: 53, p: 0.7, c: 13.6, l: 0.2, f: 0.9, med: ['unidade', 8] },
  { id: 'melancia', nome: 'Melancia', grupo: 'Frutas', kcal: 33, p: 0.9, c: 8.1, l: 0.0, f: 0.1, med: ['fatia média', 200] },
  { id: 'abacaxi', nome: 'Abacaxi', grupo: 'Frutas', kcal: 48, p: 0.9, c: 12.3, l: 0.1, f: 1.0, med: ['fatia média', 75] },
  { id: 'abacate', nome: 'Abacate', grupo: 'Frutas', kcal: 96, p: 1.2, c: 6.0, l: 8.4, f: 6.3, med: ['colher de sopa', 30] },
  { id: 'limao', nome: 'Limão (suco)', grupo: 'Frutas', kcal: 22, p: 0.4, c: 7.3, l: 0.1, f: 0, med: ['colher de sopa', 15] },

  // Hortaliças (não são escaladas nos cardápios — consumo livre/fixo)
  { id: 'alface', nome: 'Alface', grupo: 'Hortaliças', kcal: 11, p: 1.3, c: 1.7, l: 0.2, f: 1.8, med: ['folha média', 10] },
  { id: 'tomate', nome: 'Tomate', grupo: 'Hortaliças', kcal: 15, p: 1.1, c: 3.1, l: 0.2, f: 1.2, med: ['unidade média', 100] },
  { id: 'pepino', nome: 'Pepino', grupo: 'Hortaliças', kcal: 10, p: 0.9, c: 2.0, l: 0.0, f: 1.1, med: ['rodela', 10] },
  { id: 'cenoura', nome: 'Cenoura crua', grupo: 'Hortaliças', kcal: 34, p: 1.3, c: 7.7, l: 0.2, f: 3.2, med: ['colher de sopa ralada', 12] },
  { id: 'brocolis', nome: 'Brócolis cozido', grupo: 'Hortaliças', kcal: 25, p: 2.1, c: 4.4, l: 0.5, f: 3.4, med: ['ramo', 20] },
  { id: 'abobrinha', nome: 'Abobrinha cozida', grupo: 'Hortaliças', kcal: 15, p: 1.1, c: 3.0, l: 0.2, f: 1.6, med: ['colher de sopa', 25] },
  { id: 'abobora', nome: 'Abóbora cabotiá cozida', grupo: 'Hortaliças', kcal: 48, p: 1.4, c: 10.8, l: 0.7, f: 2.5, med: ['colher de sopa', 35] },
  { id: 'beterraba', nome: 'Beterraba cozida', grupo: 'Hortaliças', kcal: 32, p: 1.3, c: 7.2, l: 0.1, f: 1.9, med: ['colher de sopa', 20] },
  { id: 'espinafre', nome: 'Espinafre cozido', grupo: 'Hortaliças', kcal: 23, p: 2.9, c: 3.8, l: 0.3, f: 2.4, med: ['colher de sopa', 25] },
  { id: 'couve', nome: 'Couve-manteiga', grupo: 'Hortaliças', kcal: 27, p: 2.9, c: 4.3, l: 0.5, f: 3.1, med: ['colher de sopa', 20] },
  { id: 'cebola', nome: 'Cebola', grupo: 'Hortaliças', kcal: 39, p: 1.7, c: 8.9, l: 0.1, f: 2.2, med: ['colher de sopa picada', 15] },
  { id: 'alho', nome: 'Alho', grupo: 'Hortaliças', kcal: 113, p: 7.0, c: 23.9, l: 0.2, f: 4.3, med: ['dente', 5] },

  // Óleos, oleaginosas e sementes
  { id: 'azeite', nome: 'Azeite de oliva extravirgem', grupo: 'Óleos e oleaginosas', kcal: 884, p: 0, c: 0, l: 100, f: 0, med: ['colher de sopa', 8] },
  { id: 'manteiga', nome: 'Manteiga', grupo: 'Óleos e oleaginosas', kcal: 726, p: 0.4, c: 0, l: 82.4, f: 0, med: ['colher de chá', 5] },
  { id: 'castanha_para', nome: 'Castanha-do-pará', grupo: 'Óleos e oleaginosas', kcal: 643, p: 14.5, c: 15.1, l: 63.5, f: 7.9, med: ['unidade', 4] },
  { id: 'castanha_caju', nome: 'Castanha de caju torrada', grupo: 'Óleos e oleaginosas', kcal: 570, p: 18.5, c: 29.1, l: 46.3, f: 3.7, med: ['unidade', 2.5] },
  { id: 'nozes', nome: 'Nozes', grupo: 'Óleos e oleaginosas', kcal: 620, p: 14.0, c: 18.4, l: 59.4, f: 7.2, med: ['unidade', 5] },
  { id: 'pasta_amendoim', nome: 'Pasta de amendoim integral', grupo: 'Óleos e oleaginosas', kcal: 588, p: 25.0, c: 20.0, l: 50.0, f: 6.0, med: ['colher de sopa', 15] },
  { id: 'chia', nome: 'Semente de chia', grupo: 'Óleos e oleaginosas', kcal: 486, p: 16.5, c: 42.1, l: 30.7, f: 34.4, med: ['colher de sopa', 10] },
  { id: 'linhaca', nome: 'Linhaça', grupo: 'Óleos e oleaginosas', kcal: 495, p: 14.1, c: 43.3, l: 32.3, f: 33.5, med: ['colher de sopa', 10] },
  { id: 'tahine', nome: 'Tahine (pasta de gergelim)', grupo: 'Óleos e oleaginosas', kcal: 595, p: 17.0, c: 21.2, l: 53.8, f: 9.3, med: ['colher de sopa', 15] },

  // Açúcares e outros
  { id: 'mel', nome: 'Mel', grupo: 'Açúcares e outros', kcal: 309, p: 0, c: 84.0, l: 0, f: 0, med: ['colher de sopa', 20] },
  { id: 'acucar', nome: 'Açúcar refinado', grupo: 'Açúcares e outros', kcal: 387, p: 0, c: 99.5, l: 0, f: 0, med: ['colher de chá', 5] },
  { id: 'cacau', nome: 'Cacau em pó 100%', grupo: 'Açúcares e outros', kcal: 228, p: 19.6, c: 57.9, l: 13.7, f: 37.0, med: ['colher de sopa', 6] },
  { id: 'cafe', nome: 'Café coado sem açúcar', grupo: 'Açúcares e outros', kcal: 2, p: 0.1, c: 0, l: 0, f: 0, med: ['xícara', 50] },
];

const ALIMENTO_POR_ID = Object.fromEntries(ALIMENTOS.map((a) => [a.id, a]));

/** Receitas básicas — ingredientes em gramas. */
const RECEITAS = [
  {
    id: 'panqueca_banana', nome: 'Panqueca de banana e aveia', categoria: 'Café da manhã', tempo: 10, porcoes: 1,
    ingredientes: [['banana', 70, '1 banana média amassada'], ['ovo', 50, '1 ovo'], ['aveia', 30, '2 colheres de sopa de aveia']],
    extras: ['Canela a gosto'],
    preparo: [
      'Amasse a banana com um garfo até formar um purê.',
      'Adicione o ovo e a aveia e misture bem. Acrescente canela.',
      'Aqueça uma frigideira antiaderente untada levemente e despeje a massa.',
      'Doure por 2–3 minutos de cada lado, em fogo baixo.',
    ],
    tags: ['sem açúcar', 'vegetariana'],
  },
  {
    id: 'crepioca', nome: 'Crepioca com queijo', categoria: 'Café da manhã', tempo: 8, porcoes: 1,
    ingredientes: [['ovo', 50, '1 ovo'], ['tapioca', 20, '1 colher de sopa de goma de tapioca'], ['queijo_minas', 30, '1 fatia de queijo minas']],
    extras: ['Sal e orégano a gosto'],
    preparo: [
      'Bata o ovo com a goma de tapioca e uma pitada de sal.',
      'Despeje em frigideira antiaderente aquecida e espalhe.',
      'Quando firmar, vire, recheie com o queijo e dobre ao meio.',
    ],
    tags: ['sem glúten', 'vegetariana'],
  },
  {
    id: 'omelete_legumes', nome: 'Omelete de legumes', categoria: 'Refeição', tempo: 12, porcoes: 1,
    ingredientes: [['ovo', 100, '2 ovos'], ['tomate', 40, '½ tomate picado'], ['cebola', 15, '1 colher de sopa de cebola'], ['espinafre', 30, 'punhado de espinafre'], ['azeite', 3, 'fio de azeite']],
    extras: ['Sal, pimenta e cheiro-verde a gosto'],
    preparo: [
      'Refogue a cebola no azeite, junte o espinafre e o tomate por 1 minuto.',
      'Bata os ovos com sal e pimenta e despeje sobre os legumes.',
      'Tampe e cozinhe em fogo baixo até firmar. Finalize com cheiro-verde.',
    ],
    tags: ['low carb', 'sem glúten', 'vegetariana'],
  },
  {
    id: 'frango_ervas', nome: 'Frango grelhado com ervas', categoria: 'Refeição', tempo: 25, porcoes: 4,
    ingredientes: [['frango', 500, '500 g de filé de peito de frango'], ['limao', 30, 'suco de 1 limão'], ['alho', 10, '2 dentes de alho'], ['azeite', 10, '1 colher de sopa de azeite']],
    extras: ['Alecrim, tomilho, páprica, sal e pimenta a gosto'],
    preparo: [
      'Tempere os filés com limão, alho amassado, ervas, sal e pimenta. Deixe marinar por 20 min.',
      'Aqueça a grelha/frigideira com o azeite.',
      'Grelhe por 4–5 minutos de cada lado até dourar e cozinhar por completo.',
    ],
    tags: ['hiperproteica', 'low carb', 'sem glúten'],
  },
  {
    id: 'salada_grao_bico', nome: 'Salada de grão-de-bico', categoria: 'Refeição', tempo: 15, porcoes: 3,
    ingredientes: [['grao_bico', 300, '1½ xícara de grão-de-bico cozido'], ['tomate', 150, '1½ tomate em cubos'], ['pepino', 100, '1 pepino em cubos'], ['cebola', 50, '½ cebola roxa'], ['azeite', 15, '2 colheres de sopa de azeite'], ['limao', 20, 'suco de ½ limão']],
    extras: ['Salsinha, hortelã, sal e cominho a gosto'],
    preparo: [
      'Misture o grão-de-bico com os legumes picados.',
      'Tempere com azeite, limão, sal, cominho e as ervas.',
      'Leve à geladeira por 15 minutos antes de servir.',
    ],
    tags: ['vegana', 'mediterrânea', 'rica em fibras'],
  },
  {
    id: 'sopa_legumes_frango', nome: 'Sopa de legumes com frango', categoria: 'Refeição', tempo: 40, porcoes: 4,
    ingredientes: [['frango', 300, '300 g de peito de frango em cubos'], ['batata', 200, '2 batatas médias'], ['cenoura', 150, '1 cenoura grande'], ['abobrinha', 150, '1 abobrinha'], ['cebola', 60, '1 cebola'], ['alho', 10, '2 dentes de alho'], ['azeite', 10, '1 colher de sopa de azeite']],
    extras: ['1,5 L de água', 'Sal, cheiro-verde e louro a gosto'],
    preparo: [
      'Refogue cebola e alho no azeite. Junte o frango e doure.',
      'Acrescente batata e cenoura em cubos, cubra com água e cozinhe por 15 min.',
      'Adicione a abobrinha e cozinhe mais 10 min. Ajuste o sal e finalize com cheiro-verde.',
    ],
    tags: ['sem glúten', 'leve'],
  },
  {
    id: 'overnight_oats', nome: 'Overnight oats com morango', categoria: 'Café da manhã', tempo: 5, porcoes: 1,
    ingredientes: [['aveia', 40, '3 colheres de sopa de aveia'], ['iogurte_desnatado', 170, '1 pote de iogurte natural'], ['chia', 10, '1 colher de sopa de chia'], ['morango', 80, '6 morangos'], ['mel', 10, '½ colher de sopa de mel']],
    extras: [],
    preparo: [
      'Em um pote, misture aveia, iogurte e chia.',
      'Cubra com os morangos picados e o mel.',
      'Tampe e deixe na geladeira por no mínimo 4 horas (ou durante a noite).',
    ],
    tags: ['vegetariana', 'rica em fibras', 'prática'],
  },
  {
    id: 'peixe_assado', nome: 'Tilápia assada com legumes', categoria: 'Refeição', tempo: 35, porcoes: 2,
    ingredientes: [['tilapia', 300, '2 filés grandes de tilápia'], ['batata', 200, '2 batatas em rodelas'], ['tomate', 100, '1 tomate'], ['cebola', 60, '1 cebola'], ['azeite', 15, '2 colheres de sopa de azeite'], ['limao', 20, 'suco de ½ limão']],
    extras: ['Sal, pimenta, salsinha e alcaparras a gosto'],
    preparo: [
      'Tempere os filés com limão, sal e pimenta.',
      'Em um refratário, faça uma camada de batata, coloque o peixe e cubra com tomate e cebola em rodelas.',
      'Regue com azeite, cubra com papel-alumínio e asse a 200 °C por 25 min. Retire o papel e doure por 10 min.',
    ],
    tags: ['sem glúten', 'mediterrânea'],
  },
  {
    id: 'hamburguer_caseiro', nome: 'Hambúrguer caseiro de patinho', categoria: 'Refeição', tempo: 25, porcoes: 5,
    ingredientes: [['patinho', 500, '500 g de patinho moído'], ['cebola', 60, '1 cebola ralada'], ['alho', 10, '2 dentes de alho'], ['ovo', 50, '1 ovo'], ['aveia', 20, '1½ colher de sopa de aveia']],
    extras: ['Sal, pimenta e salsinha a gosto'],
    preparo: [
      'Misture todos os ingredientes até a massa ficar homogênea.',
      'Divida em 5 porções e modele os hambúrgueres.',
      'Grelhe em frigideira antiaderente por 4 min de cada lado. Podem ser congelados crus.',
    ],
    tags: ['hiperproteica'],
  },
  {
    id: 'hummus', nome: 'Hummus (pasta de grão-de-bico)', categoria: 'Lanche', tempo: 10, porcoes: 8,
    ingredientes: [['grao_bico', 300, '1½ xícara de grão-de-bico cozido'], ['tahine', 40, '2½ colheres de sopa de tahine'], ['limao', 40, 'suco de 1 limão'], ['alho', 5, '1 dente de alho'], ['azeite', 16, '2 colheres de sopa de azeite']],
    extras: ['Água gelada para ajustar a textura', 'Sal, cominho e páprica a gosto'],
    preparo: [
      'Bata no processador o grão-de-bico, o tahine, o limão e o alho.',
      'Acrescente água gelada aos poucos até ficar cremoso. Tempere com sal e cominho.',
      'Sirva regado com azeite e páprica, acompanhado de palitos de legumes.',
    ],
    tags: ['vegana', 'mediterrânea'],
  },
  {
    id: 'smoothie_morango', nome: 'Smoothie de morango e banana', categoria: 'Lanche', tempo: 5, porcoes: 1,
    ingredientes: [['morango', 150, '10 morangos'], ['iogurte_desnatado', 170, '1 pote de iogurte natural'], ['banana', 70, '1 banana'], ['aveia', 15, '1 colher de sopa de aveia']],
    extras: ['Gelo a gosto'],
    preparo: ['Bata todos os ingredientes no liquidificador com gelo e sirva em seguida.'],
    tags: ['vegetariana', 'sem açúcar', 'prática'],
  },
  {
    id: 'bolo_caneca', nome: 'Bolo de caneca de banana e cacau', categoria: 'Lanche', tempo: 5, porcoes: 1,
    ingredientes: [['banana', 70, '1 banana madura'], ['ovo', 50, '1 ovo'], ['aveia', 20, '1½ colher de sopa de aveia'], ['cacau', 6, '1 colher de sopa de cacau']],
    extras: ['½ colher de chá de fermento químico', 'Canela a gosto'],
    preparo: [
      'Amasse a banana na caneca e misture o ovo.',
      'Acrescente aveia, cacau, canela e por último o fermento.',
      'Leve ao micro-ondas por 1min30–2min.',
    ],
    tags: ['sem açúcar', 'vegetariana'],
  },
  {
    id: 'lentilha_legumes', nome: 'Lentilha refogada com legumes', categoria: 'Refeição', tempo: 30, porcoes: 4,
    ingredientes: [['lentilha', 400, '2 xícaras de lentilha cozida'], ['cenoura', 100, '1 cenoura em cubos'], ['abobora', 150, '1 xícara de abóbora em cubos'], ['cebola', 60, '1 cebola'], ['alho', 10, '2 dentes de alho'], ['azeite', 10, '1 colher de sopa de azeite']],
    extras: ['Cominho, cúrcuma, sal e cheiro-verde a gosto'],
    preparo: [
      'Refogue cebola e alho no azeite. Junte a cenoura e a abóbora com um pouco de água e cozinhe até amaciar.',
      'Adicione a lentilha cozida e os temperos; cozinhe por mais 5 min.',
      'Finalize com cheiro-verde. Ótima fonte proteica para dietas vegetarianas.',
    ],
    tags: ['vegana', 'rica em fibras', 'sem glúten'],
  },
];

/**
 * Modelos de dieta — cardápio base de um dia (itens [alimento, gramas]).
 * A distribuição de macros é a referência do modelo (% do VET).
 */
const DIETAS = [
  {
    id: 'hipocalorica', nome: 'Hipocalórica equilibrada', cor: '#2f9e6e',
    objetivo: 'Perda de peso gradual e sustentável com déficit calórico moderado.',
    indicacao: 'Sobrepeso e obesidade; adultos sem comorbidades que exijam dieta específica.',
    macros: { c: 50, p: 25, l: 25 },
    principios: [
      'Déficit de 300–500 kcal/dia sobre o GET (perda esperada de 0,3–0,5 kg/semana).',
      'Proteína de 1,2–1,6 g/kg para preservar massa magra.',
      'Metade do prato com vegetais no almoço e jantar; fracionamento em 5–6 refeições.',
      'Priorizar alimentos in natura e minimamente processados (Guia Alimentar para a População Brasileira).',
    ],
    preferir: ['Vegetais folhosos e legumes', 'Frutas inteiras', 'Cereais integrais', 'Carnes magras, ovos e peixes', 'Laticínios desnatados'],
    evitar: ['Ultraprocessados', 'Bebidas açucaradas e álcool', 'Frituras', 'Doces e farinhas refinadas em excesso'],
    cardapio: [
      { nome: 'Café da manhã', itens: [['pao_integral', 50], ['ovo', 50], ['mamao', 150], ['cafe', 100]] },
      { nome: 'Lanche da manhã', itens: [['maca', 130], ['castanha_para', 8]] },
      { nome: 'Almoço', itens: [['alface', 40], ['tomate', 60], ['arroz_integral', 100], ['feijao_carioca', 80], ['frango', 100], ['brocolis', 80], ['azeite', 5]] },
      { nome: 'Lanche da tarde', itens: [['iogurte_desnatado', 170], ['aveia', 15], ['morango', 80]] },
      { nome: 'Jantar', itens: [['alface', 40], ['cenoura', 40], ['batata_doce', 100], ['tilapia', 120], ['abobrinha', 80], ['azeite', 5]] },
      { nome: 'Ceia', itens: [['leite_desnatado', 200]] },
    ],
  },
  {
    id: 'mediterranea', nome: 'Mediterrânea', cor: '#3b7dd8',
    objetivo: 'Prevenção cardiovascular e promoção de saúde a longo prazo.',
    indicacao: 'Dislipidemias, risco cardiovascular, síndrome metabólica, envelhecimento saudável.',
    macros: { c: 40, p: 20, l: 40 },
    principios: [
      'Azeite de oliva extravirgem como principal fonte de gordura.',
      'Consumo diário de vegetais, frutas, leguminosas, cereais integrais e oleaginosas.',
      'Peixes e frutos do mar ao menos 2x/semana; carne vermelha com moderação.',
      'Laticínios fermentados (iogurte, queijos frescos) em quantidade moderada.',
    ],
    preferir: ['Azeite extravirgem', 'Peixes gordos (salmão, sardinha)', 'Leguminosas', 'Nozes e castanhas', 'Ervas e especiarias'],
    evitar: ['Carnes processadas', 'Gorduras trans e manteiga em excesso', 'Açúcar e doces', 'Ultraprocessados'],
    cardapio: [
      { nome: 'Café da manhã', itens: [['pao_integral', 50], ['queijo_minas', 30], ['tomate', 50], ['azeite', 5], ['cafe', 100]] },
      { nome: 'Lanche da manhã', itens: [['nozes', 15], ['uva', 100]] },
      { nome: 'Almoço', itens: [['alface', 40], ['tomate', 60], ['grao_bico', 80], ['quinoa', 100], ['salmao', 120], ['abobrinha', 80], ['azeite', 10]] },
      { nome: 'Lanche da tarde', itens: [['iogurte_integral', 170], ['mel', 10], ['morango', 80]] },
      { nome: 'Jantar', itens: [['macarrao_integral', 100], ['atum', 80], ['tomate', 100], ['espinafre', 60], ['azeite', 10]] },
      { nome: 'Ceia', itens: [['pera', 130]] },
    ],
  },
  {
    id: 'dash', nome: 'DASH (anti-hipertensiva)', cor: '#d9822b',
    objetivo: 'Redução da pressão arterial por meio do padrão alimentar.',
    indicacao: 'Hipertensão arterial e pré-hipertensão; também favorece o perfil lipídico.',
    macros: { c: 50, p: 25, l: 25 },
    principios: [
      'Sódio < 2.000 mg/dia (≈ 5 g de sal) — preferir temperos naturais.',
      'Rica em potássio, magnésio e cálcio: frutas, vegetais e laticínios desnatados.',
      'Gordura saturada < 7% do VET; preferir carnes magras e peixes.',
      '8–10 porções de frutas e vegetais e 2–3 porções de laticínios magros por dia.',
    ],
    preferir: ['Frutas e vegetais variados', 'Laticínios desnatados', 'Grãos integrais', 'Oleaginosas sem sal', 'Temperos naturais (alho, ervas, limão)'],
    evitar: ['Embutidos e enlatados', 'Temperos prontos e caldos em cubo', 'Queijos amarelos e salgados', 'Snacks salgados'],
    cardapio: [
      { nome: 'Café da manhã', itens: [['aveia', 30], ['leite_desnatado', 200], ['banana', 70], ['chia', 10]] },
      { nome: 'Lanche da manhã', itens: [['laranja', 140], ['castanha_caju', 15]] },
      { nome: 'Almoço', itens: [['alface', 40], ['beterraba', 60], ['arroz_integral', 100], ['feijao_preto', 100], ['patinho', 100], ['brocolis', 80], ['azeite', 5]] },
      { nome: 'Lanche da tarde', itens: [['iogurte_desnatado', 170], ['linhaca', 10], ['mamao', 120]] },
      { nome: 'Jantar', itens: [['batata_doce', 120], ['frango', 100], ['cenoura', 60], ['abobrinha', 80], ['azeite', 5]] },
      { nome: 'Ceia', itens: [['leite_desnatado', 200]] },
    ],
  },
  {
    id: 'lowcarb', nome: 'Low carb', cor: '#8c5cd6',
    objetivo: 'Redução de carboidratos para controle glicêmico e de apetite.',
    indicacao: 'Resistência à insulina, obesidade, esteatose hepática (com acompanhamento).',
    macros: { c: 15, p: 30, l: 55 },
    principios: [
      'Carboidratos abaixo de 26% do VET (≈ 50–130 g/dia), vindos de vegetais, frutas e oleaginosas.',
      'Proteína adequada em todas as refeições (1,2–1,8 g/kg).',
      'Gorduras de boa qualidade: azeite, abacate, oleaginosas e peixes.',
      'Monitorar perfil lipídico e função renal; não indicada sem avaliação em gestantes, nefropatas e atletas de endurance.',
    ],
    preferir: ['Vegetais de baixo amido', 'Ovos, carnes e peixes', 'Abacate e azeite', 'Oleaginosas', 'Frutas vermelhas'],
    evitar: ['Açúcares e doces', 'Pães e massas refinados', 'Sucos de fruta', 'Bebidas alcoólicas'],
    cardapio: [
      { nome: 'Café da manhã', itens: [['ovo', 100], ['queijo_minas', 30], ['abacate', 60], ['cafe', 100]] },
      { nome: 'Lanche da manhã', itens: [['castanha_para', 12], ['morango', 80]] },
      { nome: 'Almoço', itens: [['alface', 50], ['pepino', 60], ['patinho', 130], ['brocolis', 120], ['abobrinha', 100], ['azeite', 10]] },
      { nome: 'Lanche da tarde', itens: [['iogurte_integral', 170], ['chia', 10]] },
      { nome: 'Jantar', itens: [['salmao', 130], ['couve', 80], ['abobora', 100], ['azeite', 8]] },
      { nome: 'Ceia', itens: [['nozes', 15]] },
    ],
  },
  {
    id: 'hiperproteica', nome: 'Hiperproteica (hipertrofia)', cor: '#c94a4a',
    objetivo: 'Ganho de massa muscular associado ao treino resistido.',
    indicacao: 'Praticantes de musculação, atletas, recuperação de massa magra.',
    macros: { c: 45, p: 30, l: 25 },
    principios: [
      'Superávit de 300–500 kcal/dia sobre o GET.',
      'Proteína de 1,6–2,2 g/kg/dia, distribuída em 20–40 g por refeição.',
      'Carboidratos suficientes (4–7 g/kg) para sustentar o treino; refeição pré e pós-treino.',
      'Hidratação adequada e sono de qualidade.',
    ],
    preferir: ['Carnes magras, ovos e peixes', 'Laticínios', 'Arroz, batata-doce, aveia, frutas', 'Leguminosas'],
    evitar: ['Excesso de ultraprocessados', 'Álcool', 'Pular refeições'],
    cardapio: [
      { nome: 'Café da manhã', itens: [['pao_integral', 75], ['ovo', 100], ['queijo_minas', 30], ['banana', 70], ['leite_desnatado', 200]] },
      { nome: 'Lanche da manhã', itens: [['iogurte_desnatado', 170], ['aveia', 30], ['pasta_amendoim', 15]] },
      { nome: 'Almoço', itens: [['alface', 40], ['arroz_branco', 200], ['feijao_carioca', 140], ['frango', 150], ['brocolis', 80], ['azeite', 10]] },
      { nome: 'Pré-treino', itens: [['tapioca', 50], ['queijo_minas', 30], ['banana', 70]] },
      { nome: 'Jantar (pós-treino)', itens: [['batata_doce', 200], ['patinho', 150], ['cenoura', 60], ['azeite', 5]] },
      { nome: 'Ceia', itens: [['whey', 30], ['leite_desnatado', 200]] },
    ],
  },
  {
    id: 'vegetariana', nome: 'Vegetariana (ovolactovegetariana)', cor: '#5a9e2f',
    objetivo: 'Alimentação sem carnes, nutricionalmente completa.',
    indicacao: 'Pacientes vegetarianos ou que desejam reduzir o consumo de carnes.',
    macros: { c: 55, p: 15, l: 30 },
    principios: [
      'Combinar cereais + leguminosas para complementaridade de aminoácidos.',
      'Atenção a ferro (associar com vitamina C), zinco, cálcio, ômega-3 e vitamina B12 (avaliar suplementação).',
      'Incluir ovos e laticínios como fontes proteicas de alto valor biológico.',
      'Variar leguminosas: feijões, lentilha, grão-de-bico, ervilha e soja.',
    ],
    preferir: ['Leguminosas e tofu', 'Ovos e laticínios', 'Cereais integrais', 'Sementes e oleaginosas', 'Frutas cítricas junto às refeições'],
    evitar: ['Substituir carne por ultraprocessados', 'Chá/café junto às refeições principais (reduz absorção de ferro)'],
    cardapio: [
      { nome: 'Café da manhã', itens: [['pao_integral', 50], ['ovo', 50], ['queijo_minas', 30], ['mamao', 150]] },
      { nome: 'Lanche da manhã', itens: [['banana', 70], ['pasta_amendoim', 15]] },
      { nome: 'Almoço', itens: [['alface', 40], ['tomate', 60], ['arroz_integral', 120], ['lentilha', 100], ['tofu', 100], ['brocolis', 80], ['azeite', 10], ['laranja', 140]] },
      { nome: 'Lanche da tarde', itens: [['iogurte_integral', 170], ['aveia', 20], ['morango', 80]] },
      { nome: 'Jantar', itens: [['quinoa', 120], ['grao_bico', 100], ['abobrinha', 80], ['cenoura', 50], ['azeite', 10]] },
      { nome: 'Ceia', itens: [['leite_desnatado', 200]] },
    ],
  },
  {
    id: 'diabetes', nome: 'Para diabetes (baixo índice glicêmico)', cor: '#2b8a99',
    objetivo: 'Controle glicêmico com distribuição regular de carboidratos.',
    indicacao: 'Diabetes mellitus tipo 2, pré-diabetes, diabetes gestacional (com ajustes).',
    macros: { c: 45, p: 25, l: 30 },
    principios: [
      'Carboidratos distribuídos de forma regular ao longo do dia, sem longos jejuns.',
      'Preferir alimentos de baixo índice glicêmico e ricos em fibras (≥ 14 g/1000 kcal).',
      'Sempre associar carboidratos a proteínas, gorduras boas ou fibras na mesma refeição.',
      'Evitar açúcares de adição; adoçantes com moderação (Diretriz SBD).',
    ],
    preferir: ['Cereais integrais e leguminosas', 'Frutas com casca/bagaço', 'Vegetais em abundância', 'Oleaginosas', 'Proteínas magras'],
    evitar: ['Açúcar, mel e doces', 'Sucos de fruta', 'Farinhas refinadas', 'Refrigerantes', 'Álcool'],
    cardapio: [
      { nome: 'Café da manhã', itens: [['pao_integral', 50], ['ovo', 50], ['queijo_minas', 20], ['cafe', 100]] },
      { nome: 'Lanche da manhã', itens: [['pera', 130], ['castanha_para', 8]] },
      { nome: 'Almoço', itens: [['alface', 40], ['tomate', 60], ['arroz_integral', 90], ['feijao_preto', 100], ['frango', 110], ['brocolis', 100], ['azeite', 5]] },
      { nome: 'Lanche da tarde', itens: [['iogurte_desnatado', 170], ['chia', 10], ['morango', 80]] },
      { nome: 'Jantar', itens: [['batata_doce', 100], ['tilapia', 120], ['abobrinha', 100], ['couve', 60], ['azeite', 5]] },
      { nome: 'Ceia', itens: [['leite_desnatado', 150], ['aveia', 10]] },
    ],
  },
];

const DIETA_POR_ID = Object.fromEntries(DIETAS.map((d) => [d.id, d]));
const RECEITA_POR_ID = Object.fromEntries(RECEITAS.map((r) => [r.id, r]));

/** Utilitários de composição nutricional */
const Nutri = (() => {
  const vazio = () => ({ kcal: 0, p: 0, c: 0, l: 0, f: 0 });

  function doItem(id, g) {
    const a = ALIMENTO_POR_ID[id];
    if (!a) return vazio();
    const k = g / 100;
    return { kcal: a.kcal * k, p: a.p * k, c: a.c * k, l: a.l * k, f: a.f * k };
  }

  function somar(itens) {
    return itens.reduce((t, [id, g]) => {
      const n = doItem(id, g);
      Object.keys(t).forEach((k) => { t[k] += n[k]; });
      return t;
    }, vazio());
  }

  const dividir = (n, d) => Object.fromEntries(Object.entries(n).map(([k, v]) => [k, v / d]));

  const pctMacros = (n) => {
    const total = n.p * 4 + n.c * 4 + n.l * 9 || 1;
    return { p: n.p * 4 / total * 100, c: n.c * 4 / total * 100, l: n.l * 9 / total * 100 };
  };

  function medidaCaseira(id, g) {
    const a = ALIMENTO_POR_ID[id];
    if (!a?.med) return '';
    const q = Math.round((g / a.med[1]) * 2) / 2;
    if (q <= 0) return '';
    return `${String(q).replace('.', ',')} ${a.med[0]}`;
  }

  // Itens que não são escalados ao ajustar o cardápio para outro VET
  const fixo = (id) => ALIMENTO_POR_ID[id]?.grupo === 'Hortaliças' || id === 'cafe';

  /** Ajusta as quantidades de um cardápio para um VET alvo (hortaliças ficam fixas). */
  function escalarCardapio(cardapio, vetAlvo) {
    const todos = cardapio.flatMap((r) => r.itens);
    const kcalFixa = somar(todos.filter(([id]) => fixo(id))).kcal;
    const kcalVar = somar(todos.filter(([id]) => !fixo(id))).kcal;
    const fator = kcalVar > 0 ? Math.max(0.3, (vetAlvo - kcalFixa) / kcalVar) : 1;
    return cardapio.map((r) => ({
      nome: r.nome,
      itens: r.itens.map(([id, g]) => [id, fixo(id) ? g : Math.max(5, Math.round((g * fator) / 5) * 5)]),
    }));
  }

  return { doItem, somar, dividir, pctMacros, medidaCaseira, escalarCardapio };
})();
