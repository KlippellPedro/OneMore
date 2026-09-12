/**
 * O que cada alimento CONTEM, pra quem precisa evitar alguma coisa.
 *
 * Diabetes tipo 1 ja era tratado assim: o app nao da diagnostico nem receita,
 * ele so deixa visivel o que importa (carboidrato) e avisa. A mesma ideia vale
 * pra intolerancia, alergia e escolha alimentar - o app marca, avisa no plano,
 * some das sugestoes de substituicao e nao entra no cardapio gerado.
 *
 * Marcado por NOME e nao por id: o id e gerado por slug e um erro de digitacao
 * passaria despercebido. Aqui, nome que nao existe no catalogo e apontado na
 * hora pelo teste de integridade (npm test).
 */
export type Marcador =
  | 'lactose' | 'leite' | 'gluten' | 'carne' | 'peixe' | 'ovo'
  | 'amendoim' | 'castanhas' | 'soja'

export interface InfoMarcador {
  nome: string
  /** O que a pessoa marca no perfil pra ativar. */
  rotulo: string
  descricao: string
}

export const MARCADORES: Record<Marcador, InfoMarcador> = {
  /**
   * `lactose` e `leite` sao separados de proposito. Se fossem um so, leite e
   * iogurte SEM lactose ficariam escondidos de quem tem intolerancia - que e
   * exatamente quem precisa deles. Entao: lactose = tem lactose de verdade;
   * leite = veio de leite, com ou sem lactose (o que importa pra vegano ou
   * alergia a proteina do leite). Todo alimento com lactose tambem e leite.
   */
  lactose: {
    nome: 'Lactose',
    rotulo: 'Intolerância a lactose',
    descricao:
      'Marca o que tem lactose de verdade - as versoes "sem lactose" continuam '
      + 'aparecendo. Queijo curado e whey isolado tem pouquissima e muita gente '
      + 'tolera: o aviso e pra você decidir, não um veto.',
  },
  leite: {
    nome: 'Leite e derivados',
    rotulo: 'Não como derivados de leite',
    descricao:
      'Qualquer coisa que venha do leite, inclusive as versoes sem lactose. '
      + 'Use se for alergia a proteína do leite, ou se você for vegano.',
  },
  gluten: {
    nome: 'Glúten',
    rotulo: 'Doenca celíaca ou sensibilidade ao glúten',
    descricao:
      'Trigo, cevada e centeio. A aveia entra junto de proposito: ela não tem '
      + 'glúten, mas quase sempre e processada onde se processa trigo - quem tem '
      + 'doenca celíaca só deve comer aveia com selo "sem glúten".',
  },
  carne: { nome: 'Carne', rotulo: 'Não como carne', descricao: 'Boi, porco e aves, incluindo embutidos.' },
  peixe: { nome: 'Peixe e frutos do mar', rotulo: 'Não como peixe', descricao: 'Peixes, frutos do mar e enlatados.' },
  ovo: { nome: 'Ovo', rotulo: 'Alergia ou restrição a ovo', descricao: 'Ovo e o que leva ovo, como maionese e albumina.' },
  amendoim: { nome: 'Amendoim', rotulo: 'Alergia a amendoim', descricao: 'Amendoim e derivados.' },
  castanhas: { nome: 'Castanhas', rotulo: 'Alergia a castanhas', descricao: 'Castanhas, nozes e amendoas.' },
  soja: { nome: 'Soja', rotulo: 'Alergia ou restrição a soja', descricao: 'Soja e derivados, incluindo shoyu.' },
}

/** Alimentos de cada marcador, pelo NOME exato do catalogo. */
const POR_MARCADOR: Record<Marcador, string[]> = {
  lactose: [
    'Leite integral', 'Leite desnatado', 'Iogurte natural integral',
    'Iogurte natural desnatado', 'Iogurte grego', 'Queijo minas frescal',
    'Queijo mussarela', 'Queijo prato', 'Requeijão cremoso', 'Queijo cottage',
    'Ricota', 'Creme de leite', 'Manteiga', 'Pão de queijo', 'Queijo coalho',
    'Kefir de leite', 'Whey protein concentrado', 'Whey protein isolado',
    'Caseína', 'Barra de proteína', 'Hipercalórico', 'Chocolate ao leite',
    'Sorvete de creme', 'Pizza de mussarela',
  ],
  // tudo que tem lactose entra aqui tambem (somado abaixo), mais o que veio de
  // leite mas teve a lactose quebrada
  leite: ['Leite sem lactose integral', 'Iogurte sem lactose'],
  gluten: [
    'Macarrão cozido', 'Pão francês', 'Pão de forma integral', 'Pão de forma branco',
    'Aveia em flocos', 'Granola', 'Macarrão instantaneo', 'Panqueca de aveia',
    'Torrada integral', 'Biscoito recheado', 'Bolacha água e sal',
    'Pizza de mussarela', 'Coxinha', 'Shoyu', 'Barra de proteína', 'Cerveja',
  ],
  carne: [
    'Peito de frango desfiado', 'Coração de frango grelhado',
    'Fígado bovino grelhado', 'Músculo bovino cozido',
    'Carne seca dessalgada cozida',
    'Peito de frango grelhado', 'Coxa de frango sem pele cozida',
    'Sobrecoxa assada sem pele', 'Patinho grelhado', 'Alcatra grelhada',
    'Coxão mole cozido', 'Contrafilé grelhado', 'Carne moida (acém) refogada',
    'Lombo suíno assado', 'Bisteca suina grelhada', 'Peito de peru defumado',
    'Presunto magro', 'Linguiça calabresa', 'Bacon frito', 'Hambúrguer bovino',
    'Coxinha',
  ],
  peixe: [
    'File de merluza grelhado', 'Tilápia grelhada', 'Salmão grelhado', 'Sardinha em lata (drenada)',
    'Atum em lata na água', 'Camarão cozido',
  ],
  ovo: [
    'Ovo de codorna cozido', 'Ovo de galinha cozido', 'Ovo mexido (com oleo)', 'Clara de ovo',
    'Albumina', 'Maionese', 'Panqueca de aveia',
  ],
  amendoim: ['Amendoim', 'Pasta de amendoim integral'],
  castanhas: [
    'Castanha do Para', 'Castanha de caju', 'Amêndoas', 'Nozes',
    'Leite de amendoas sem açúcar', 'Pasta de castanha de caju',
  ],
  soja: ['Soja cozida', 'Tofu', 'Oleo de soja', 'Shoyu', 'Proteína de soja texturizada (hidratada)'],
}

const idDe = (nome: string) =>
  'al_' + nome.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** id do alimento -> marcadores que ele carrega. */
export const MARCADORES_POR_ALIMENTO: Record<string, Marcador[]> = (() => {
  const m: Record<string, Marcador[]> = {}
  const por = { ...POR_MARCADOR, leite: [...POR_MARCADOR.leite, ...POR_MARCADOR.lactose] }
  for (const [marcador, nomes] of Object.entries(por)) {
    for (const nome of nomes) {
      const id = idDe(nome)
      ;(m[id] ??= []).push(marcador as Marcador)
    }
  }
  return m
})()

/** Exportado so pro teste de integridade conferir que todo nome existe. */
export const NOMES_MARCADOS = POR_MARCADOR

export const marcadoresDe = (alimentoId: string): Marcador[] =>
  MARCADORES_POR_ALIMENTO[alimentoId] ?? []

/** Atalhos: marcar "vegetariano" liga os marcadores certos de uma vez. */
export const PRESETS: { id: string; nome: string; marcadores: Marcador[] }[] = [
  { id: 'vegetariano', nome: 'Vegetariano', marcadores: ['carne', 'peixe'] },
  { id: 'vegano', nome: 'Vegano', marcadores: ['carne', 'peixe', 'ovo', 'leite'] },
  { id: 'sem-lactose', nome: 'Sem lactose', marcadores: ['lactose'] },
]
