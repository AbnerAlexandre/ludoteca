/**
 * Hard-coded showcase catalogue for the landing page.
 *
 * These are baked in on purpose (the brief asked for it): the marquee has to
 * paint instantly with the covers already there, before any API call — so the
 * data lives in the bundle and the images come straight from Ludopedia's CDN,
 * no round trip to our backend.
 *
 * Every `ludopediaId` is a real, verified id (checked against the live API and
 * the CDN), so a card links to the correct game and its cover resolves. Covers
 * follow Ludopedia's suffix convention: `{id}_m.jpg` medium, `{id}_t.jpg` thumb.
 *
 * The `description` is ours: Ludopedia's API exposes no synopsis field
 * (/jogos/{id}/notas is an unimplemented stub), so the showcase and the game
 * page read the text from here when a game is in this set.
 */
export type FeaturedType = 'board' | 'cards';

export interface FeaturedGame {
  ludopediaId: number;
  name: string;
  originalName?: string;
  year: number;
  type: FeaturedType;
  minPlayers: number;
  maxPlayers: number;
  playTimeMinutes: number;
  minAge: number;
  /** Short PT synopsis shown on the game page. */
  description: string;
  /** Two or three defining mechanics/themes, for the chips. */
  tags: string[];
}

const CDN = 'https://storage.googleapis.com/ludopedia-capas';

export function coverUrl(ludopediaId: number): string {
  return `${CDN}/${ludopediaId}_m.jpg`;
}

export function thumbUrl(ludopediaId: number): string {
  return `${CDN}/${ludopediaId}_t.jpg`;
}

/** The game's own page on Ludopedia — where the store listings live. */
export function ludopediaLink(ludopediaId: number): string {
  return `https://ludopedia.com.br/jogo/${ludopediaId}`;
}

export const FEATURED_GAMES: readonly FeaturedGame[] = [
  {
    ludopediaId: 397,
    name: 'Catan',
    originalName: 'CATAN',
    year: 1995,
    type: 'board',
    minPlayers: 3,
    maxPlayers: 4,
    playTimeMinutes: 75,
    minAge: 10,
    description:
      'O clássico que abriu as portas do hobby. Colonize a ilha de Catan coletando madeira, tijolo, trigo, minério e lã, construindo estradas e vilas, e negociando recursos com os outros jogadores numa das trocas mais famosas dos jogos de tabuleiro.',
    tags: ['Coleta de recursos', 'Negociação', 'Clássico'],
  },
  {
    ludopediaId: 14981,
    name: 'Azul',
    year: 2017,
    type: 'board',
    minPlayers: 2,
    maxPlayers: 4,
    playTimeMinutes: 45,
    minAge: 8,
    description:
      'Como um artesão azulejista, você seleciona azulejos coloridos e os organiza no seu painel para decorar as paredes do Palácio Real de Évora. Simples de aprender e lindo na mesa, com decisões táticas afiadas a cada rodada.',
    tags: ['Estratégia abstrata', 'Coleção de conjuntos', 'Familiar'],
  },
  {
    ludopediaId: 58503,
    name: "UNO: Show 'em No Mercy",
    year: 2023,
    type: 'cards',
    minPlayers: 2,
    maxPlayers: 10,
    playTimeMinutes: 30,
    minAge: 7,
    description:
      'A versão mais impiedosa do UNO. Cartas de +10, empilhamento de compras e o temido "Discard All" transformam uma partida casual em pura zoação — perfeito para acabar com qualquer amizade na mesa.',
    tags: ['Cartas', 'Festa', 'Rápido'],
  },
  {
    ludopediaId: 20418,
    name: 'Wingspan',
    year: 2019,
    type: 'board',
    minPlayers: 1,
    maxPlayers: 5,
    playTimeMinutes: 70,
    minAge: 10,
    description:
      'Atraia aves para o seu refúgio de vida selvagem. Cada uma das centenas de aves ilustradas dispara poderes em cadeia num motor que você constrói ao longo do jogo. Belíssimo, tranquilo e viciante.',
    tags: ['Construção de motor', 'Coleção de conjuntos', 'Natureza'],
  },
  {
    ludopediaId: 8,
    name: '7 Wonders',
    year: 2010,
    type: 'cards',
    minPlayers: 3,
    maxPlayers: 7,
    playTimeMinutes: 35,
    minAge: 10,
    description:
      'Lidere uma das sete grandes cidades da Antiguidade através de três eras. Compre cartas passando a mão para o vizinho (draft) e desenvolva ciência, exército e comércio. Até 7 jogadores sem tempo de espera.',
    tags: ['Draft', 'Construção de civilização', 'Muitos jogadores'],
  },
  {
    ludopediaId: 334,
    name: 'Munchkin',
    year: 2001,
    type: 'cards',
    minPlayers: 3,
    maxPlayers: 6,
    playTimeMinutes: 90,
    minAge: 10,
    description:
      'Desça na masmorra, mate os monstros, roube o tesouro e apunhale seus amigos pelas costas. Uma paródia irreverente de RPG onde trapacear os outros faz parte das regras.',
    tags: ['Cartas', 'Humor', 'Toma essa'],
  },
  {
    ludopediaId: 13494,
    name: 'Brass: Birmingham',
    year: 2018,
    type: 'board',
    minPlayers: 2,
    maxPlayers: 4,
    playTimeMinutes: 120,
    minAge: 14,
    description:
      'Um dos jogos mais bem avaliados do mundo. Construa indústrias, canais e ferrovias na Inglaterra da Revolução Industrial, gerenciando um mercado apertado e uma economia interligada. Pesado, elegante e implacável.',
    tags: ['Estratégia pesada', 'Economia', 'Rotas'],
  },
  {
    ludopediaId: 606,
    name: 'Dixit',
    year: 2008,
    type: 'cards',
    minPlayers: 3,
    maxPlayers: 6,
    playTimeMinutes: 30,
    minAge: 8,
    description:
      'Dê uma pista para a sua carta de arte onírica — nem óbvia demais, nem obscura demais — e faça alguns (mas não todos) adivinharem qual é. Criativo, poético e ótimo para grupos mistos.',
    tags: ['Dedução', 'Criatividade', 'Festa'],
  },
  {
    ludopediaId: 32897,
    name: 'Scout',
    year: 2019,
    type: 'cards',
    minPlayers: 2,
    maxPlayers: 5,
    playTimeMinutes: 20,
    minAge: 9,
    description:
      'Um jogo de cartas de mão fixa: você não pode reordenar suas cartas, só decidir de que lado a mão começa. Forme sequências e trincas cada vez maiores para superar o combo anterior. Genial na sua simplicidade.',
    tags: ['Cartas', 'Escadinha', 'Rápido'],
  },
  {
    ludopediaId: 57051,
    name: 'Faraway',
    year: 2023,
    type: 'cards',
    minPlayers: 2,
    maxPlayers: 6,
    playTimeMinutes: 45,
    minAge: 10,
    description:
      'Explore uma terra misteriosa jogando cartas para frente, mas pontuando-as de trás para frente — o que você viu depois define o que valeu antes. Uma reviravolta engenhosa que cabe em 15 cartas.',
    tags: ['Draft', 'Coleção de conjuntos', 'Rápido'],
  },
  {
    ludopediaId: 2,
    name: 'Ticket to Ride',
    year: 2004,
    type: 'board',
    minPlayers: 2,
    maxPlayers: 5,
    playTimeMinutes: 60,
    minAge: 8,
    description:
      'Colete cartas de vagão e reivindique rotas de trem cruzando o mapa para conectar cidades e completar seus bilhetes de destino. Um dos melhores portões de entrada para o hobby.',
    tags: ['Coleção de conjuntos', 'Rotas', 'Familiar'],
  },
  {
    ludopediaId: 55,
    name: 'Carcassonne',
    year: 2000,
    type: 'board',
    minPlayers: 2,
    maxPlayers: 5,
    playTimeMinutes: 45,
    minAge: 8,
    description:
      'Compre e posicione peças de terreno para construir cidades, estradas e campos no sul da França medieval, colocando seus meeples para reivindicar cada território. Um clássico de colocação de peças.',
    tags: ['Colocação de peças', 'Controle de área', 'Clássico'],
  },
  {
    ludopediaId: 107,
    name: 'Pandemic',
    year: 2008,
    type: 'board',
    minPlayers: 2,
    maxPlayers: 4,
    playTimeMinutes: 45,
    minAge: 8,
    description:
      'Todos contra o jogo: uma equipe de especialistas corre o mundo para conter quatro doenças antes que se espalhem sem controle. O cooperativo que definiu o gênero.',
    tags: ['Cooperativo', 'Mão de obra', 'Tensão'],
  },
  {
    ludopediaId: 8858,
    name: 'Terraforming Mars',
    year: 2016,
    type: 'board',
    minPlayers: 1,
    maxPlayers: 5,
    playTimeMinutes: 120,
    minAge: 12,
    description:
      'Lidere uma corporação terraformando o planeta vermelho: eleve a temperatura, o oxigênio e os oceanos jogando centenas de cartas de projeto que se combinam de formas infinitas. Um épico de construção de motor.',
    tags: ['Construção de motor', 'Cartas', 'Estratégia pesada'],
  },
  {
    ludopediaId: 16788,
    name: 'Everdell',
    year: 2018,
    type: 'board',
    minPlayers: 1,
    maxPlayers: 4,
    playTimeMinutes: 80,
    minAge: 10,
    description:
      'No vale de Everdell, criaturas da floresta constroem uma cidade de cartas ao longo de quatro estações. Alocação de trabalhadores encantadora, com uma árvore tridimensional dominando a mesa.',
    tags: ['Alocação de trabalhadores', 'Construção de tableau', 'Natureza'],
  },
  {
    ludopediaId: 3607,
    name: 'Splendor',
    year: 2014,
    type: 'board',
    minPlayers: 2,
    maxPlayers: 4,
    playTimeMinutes: 30,
    minAge: 10,
    description:
      'Como um mercador renascentista, colete fichas de gemas para comprar cartas que geram desconto, encadeando um motor econômico rumo à nobreza. Regras mínimas, decisões deliciosas.',
    tags: ['Construção de motor', 'Coleta de fichas', 'Familiar'],
  },
  {
    ludopediaId: 15950,
    name: 'Root',
    year: 2018,
    type: 'board',
    minPlayers: 2,
    maxPlayers: 4,
    playTimeMinutes: 90,
    minAge: 10,
    description:
      'Uma guerra pela floresta onde cada facção joga com regras completamente diferentes: o gato governa, as aves reconquistam, a aliança se rebela e o vagabundo faz o próprio jogo. Assimetria brilhante sob uma arte fofa.',
    tags: ['Assimétrico', 'Controle de área', 'Estratégia'],
  },
  {
    ludopediaId: 10959,
    name: 'Spirit Island',
    year: 2017,
    type: 'board',
    minPlayers: 1,
    maxPlayers: 4,
    playTimeMinutes: 120,
    minAge: 13,
    description:
      'Um cooperativo que inverte o tema colonial: vocês são os espíritos da ilha, crescendo em poder para expulsar os invasores antes que devastem a terra. Profundo, desafiador e muito bem construído.',
    tags: ['Cooperativo', 'Poderes variáveis', 'Estratégia pesada'],
  },
  {
    ludopediaId: 25894,
    name: 'Cascadia',
    year: 2021,
    type: 'board',
    minPlayers: 1,
    maxPlayers: 4,
    playTimeMinutes: 45,
    minAge: 10,
    description:
      'Monte os ecossistemas do noroeste do Pacífico encaixando hexágonos de habitat e posicionando a fauna para pontuar padrões. Relaxante, rápido e surpreendentemente estratégico. Vencedor do Spiel des Jahres.',
    tags: ['Colocação de peças', 'Coleção de conjuntos', 'Natureza'],
  },
  {
    ludopediaId: 32507,
    name: 'Ark Nova',
    year: 2021,
    type: 'board',
    minPlayers: 1,
    maxPlayers: 4,
    playTimeMinutes: 150,
    minAge: 14,
    description:
      'Planeje e construa um zoológico moderno e científico: abrigue animais, apoie projetos de conservação e equilibre apelo popular com pesquisa. Um peso-pesado denso de cartas para as noites longas.',
    tags: ['Cartas', 'Estratégia pesada', 'Construção de tableau'],
  },
  {
    ludopediaId: 8624,
    name: 'Gloomhaven',
    year: 2017,
    type: 'board',
    minPlayers: 1,
    maxPlayers: 4,
    playTimeMinutes: 120,
    minAge: 14,
    description:
      'Uma campanha tática cooperativa de fantasia com um enorme mundo ramificado. Mercenários evoluem batalha após batalha num sistema de combate por cartas sem dados. Uma das maiores aventuras do hobby.',
    tags: ['Cooperativo', 'Campanha', 'Combate tático'],
  },
  {
    ludopediaId: 306,
    name: 'King of Tokyo',
    year: 2011,
    type: 'board',
    minPlayers: 2,
    maxPlayers: 6,
    playTimeMinutes: 30,
    minAge: 8,
    description:
      'Monstros gigantes disputam o controle de Tóquio rolando dados estilo Yahtzee para atacar, curar, ganhar energia e comprar poderes malucos. Barulhento, rápido e cheio de risada.',
    tags: ['Dados', 'Confronto', 'Festa'],
  },
  {
    ludopediaId: 6876,
    name: 'Patchwork',
    year: 2014,
    type: 'board',
    minPlayers: 2,
    maxPlayers: 2,
    playTimeMinutes: 30,
    minAge: 8,
    description:
      'Um duelo de colchas: dois jogadores compram peças estilo Tetris de botões e tecido para preencher o próprio tabuleiro da forma mais eficiente. Puro quebra-cabeça a dois, tenso e elegante.',
    tags: ['Encaixe de peças', 'Para dois', 'Abstrato'],
  },
  {
    ludopediaId: 2528,
    name: 'Sushi Go!',
    year: 2013,
    type: 'cards',
    minPlayers: 2,
    maxPlayers: 5,
    playTimeMinutes: 15,
    minAge: 8,
    description:
      'Passe a mão de cartas de sushi e junte os melhores pratos: enfileire nigiris, colecione sashimis em trio e guarde o pudim para o final. Um draft delicioso que cabe no bolso e ensina em um minuto.',
    tags: ['Draft', 'Coleção de conjuntos', 'Rápido'],
  },
];

/** Lookup used by the game pages to show a synopsis when we have one. */
const BY_ID = new Map(FEATURED_GAMES.map((g) => [g.ludopediaId, g]));

export function featuredById(ludopediaId: number): FeaturedGame | undefined {
  return BY_ID.get(ludopediaId);
}
