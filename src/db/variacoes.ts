import type { Exercicio } from './types'

/**
 * Familias de variacao: o MESMO movimento feito em aparelhos diferentes.
 *
 * O caso que isso resolve e o da academia cheia - o banco do supino esta
 * ocupado e voce quer treinar agora, nao daqui a 15 minutos. "Outro exercicio
 * de peito" e vago demais pra decidir no meio do descanso; "o mesmo supino,
 * so que na maquina ou com halter" e a troca que mantem o treino planejado.
 *
 * Cada exercicio do catalogo cabe em no maximo uma familia. Dentro dela, a
 * ordem e a da academia comum: o que costuma estar livre e e mais parecido
 * vem primeiro. Exercicio criado pelo usuario entra pelo campo `familia`.
 *
 * Arquivo sem dependencia de proposito (so `import type`): o teste importa
 * direto no Node, sem Dexie nem Vite.
 */
export interface Familia {
  id: string
  nome: string
  exercicios: string[]
}

const f = (id: string, nome: string, ...slugs: string[]): Familia =>
  ({ id, nome, exercicios: slugs.map(s => 'ex_' + s) })

export const FAMILIAS: Familia[] = [
  // peito
  f('supino-reto', 'Supino reto',
    'supino-reto-com-barra', 'supino-reto-com-halteres', 'supino-na-maquina',
    'supino-reto-no-smith', 'flexao-de-braco'),
  f('supino-inclinado', 'Supino inclinado',
    'supino-inclinado-com-barra', 'supino-inclinado-com-halteres', 'supino-inclinado-na-maquina',
    'supino-inclinado-no-smith', 'flexao-com-pes-elevados'),
  f('supino-declinado', 'Supino declinado',
    'supino-declinado-com-barra', 'supino-declinado-com-halteres', 'flexao-inclinada-maos-no-banco'),
  f('mergulho', 'Mergulho',
    'mergulho-nas-paralelas', 'mergulho-assistido-na-maquina'),
  f('crucifixo', 'Crucifixo',
    'voador-peck-deck', 'crucifixo-reto-com-halteres', 'crossover-polia-media',
    'crossover-polia-alta', 'crossover-polia-baixa', 'crucifixo-inclinado-com-halteres'),
  f('pullover', 'Pullover',
    'pullover-com-halter', 'pulldown-com-bracos-estendidos', 'pull-around-na-polia'),

  // costas
  f('puxada', 'Puxada vertical',
    'puxada-frontal-na-polia', 'barra-fixa-pronada', 'barra-fixa-assistida-na-maquina',
    'puxada-articulada-na-maquina', 'puxada-supinada-na-polia', 'barra-fixa-supinada',
    'puxada-com-triangulo'),
  f('remada', 'Remada',
    'remada-curvada-com-barra', 'remada-baixa-no-cabo', 'remada-na-maquina',
    'remada-unilateral-com-halter', 'remada-curvada-com-halteres', 'remada-apoiada-no-banco-inclinado',
    'remada-cavalinho-t-bar', 'remada-unilateral-no-cabo', 'remada-curvada-supinada',
    'remada-invertida'),
  f('encolhimento', 'Encolhimento',
    'encolhimento-com-halteres', 'encolhimento-com-barra'),
  f('terra', 'Terra e stiff',
    'levantamento-terra', 'stiff-com-barra', 'terra-romeno-com-halteres',
    'terra-sumo', 'bom-dia', 'pull-through-no-cabo'),

  // ombro
  f('desenvolvimento', 'Desenvolvimento',
    'desenvolvimento-com-halteres', 'desenvolvimento-militar-com-barra', 'desenvolvimento-na-maquina',
    'desenvolvimento-no-smith', 'desenvolvimento-arnold', 'flexao-pike'),
  f('elevacao-lateral', 'Elevação lateral',
    'elevacao-lateral-com-halteres', 'elevacao-lateral-no-cabo', 'elevacao-lateral-na-maquina',
    'elevacao-lateral-com-elastico'),
  f('elevacao-frontal', 'Elevação frontal',
    'elevacao-frontal-com-halteres', 'elevacao-frontal-com-anilha', 'elevacao-frontal-no-cabo'),
  f('posterior-ombro', 'Posterior de ombro',
    'crucifixo-inverso-com-halteres', 'voador-inverso-na-maquina', 'crucifixo-inverso-no-cabo',
    'face-pull-no-cabo'),
  f('remada-alta', 'Remada alta',
    'remada-alta', 'remada-alta-no-cabo'),

  // braco
  f('rosca', 'Rosca de bíceps',
    'rosca-direta-com-barra', 'rosca-direta-com-barra-w', 'rosca-alternada-com-halteres',
    'rosca-no-cabo', 'rosca-scott', 'rosca-scott-na-maquina', 'rosca-concentrada',
    'rosca-inclinada-com-halteres', 'rosca-21'),
  f('rosca-martelo', 'Rosca martelo e inversa',
    'rosca-martelo', 'rosca-martelo-na-corda', 'rosca-inversa'),
  f('triceps-extensao', 'Extensão de tríceps',
    'triceps-pulley-com-corda', 'triceps-pulley-com-barra', 'triceps-na-maquina',
    'triceps-testa-com-barra-w', 'triceps-testa-com-halteres', 'triceps-frances-com-halter',
    'triceps-frances-na-polia', 'triceps-coice', 'triceps-coice-na-polia'),
  f('triceps-empurrar', 'Tríceps empurrando',
    'supino-fechado', 'flexao-diamante', 'mergulho-no-banco'),
  f('antebraco', 'Antebraço e pegada',
    'rosca-de-punho', 'rosca-de-punho-inversa', 'caminhada-do-fazendeiro'),

  // perna
  f('agachamento', 'Agachamento e leg press',
    'agachamento-livre', 'leg-press-45', 'agachamento-no-smith', 'hack-squat',
    'leg-press-horizontal', 'agachamento-frontal', 'agachamento-goblet',
    'agachamento-sumo-com-halter', 'agachamento-peso-corporal', 'agachamento-com-salto'),
  f('afundo', 'Afundo e passada',
    'agachamento-bulgaro', 'afundo-com-halteres', 'afundo-reverso-com-halteres',
    'afundo-no-smith', 'passada-walking-lunge', 'step-up-no-banco', 'afundo-sem-peso'),
  f('flexora', 'Flexora',
    'mesa-flexora', 'cadeira-flexora-sentada', 'flexora-em-pe', 'nordic-curl'),
  f('elevacao-pelvica', 'Elevação pélvica',
    'elevacao-pelvica-hip-thrust', 'elevacao-pelvica-na-maquina', 'elevacao-pelvica-no-smith',
    'ponte-de-gluteo'),
  f('coice', 'Coice de glúteo',
    'coice-na-polia', 'coice-na-maquina', 'gluteo-quatro-apoios'),
  f('abducao', 'Abdução',
    'abducao-na-maquina', 'abducao-no-cabo', 'abducao-com-elastico'),
  f('aducao', 'Adução',
    'cadeira-adutora', 'aducao-no-cabo'),
  f('panturrilha', 'Panturrilha',
    'panturrilha-em-pe-na-maquina', 'panturrilha-no-smith', 'panturrilha-no-leg-press',
    'panturrilha-sentado', 'panturrilha-unilateral-com-halter', 'panturrilha-em-pe-sem-peso'),

  // core
  f('abdominal', 'Abdominal',
    'abdominal-supra-crunch', 'abdominal-na-polia-ajoelhado', 'abdominal-na-maquina',
    'abdominal-bicicleta'),
  f('elevacao-pernas', 'Elevação de pernas',
    'elevacao-de-pernas-na-barra', 'elevacao-de-joelhos-na-paralela', 'elevacao-de-pernas-deitado',
    'abdominal-infra-reverse-crunch'),
  f('prancha', 'Prancha e estabilidade',
    'prancha', 'prancha-lateral', 'prancha-com-toque-no-ombro', 'dead-bug', 'ab-wheel', 'bird-dog'),
  f('rotacao', 'Rotação e antirrotação',
    'russian-twist', 'lenhador-no-cabo', 'pallof-press'),
  f('lombar', 'Lombar',
    'hiperextensao-lombar', 'superman'),

  // cardio e corpo inteiro
  f('cardio-aparelho', 'Cardio no aparelho',
    'caminhada-inclinada-na-esteira', 'corrida-na-esteira', 'bicicleta-ergometrica',
    'eliptico', 'escada-stair', 'remo-ergometro'),
  f('cardio-livre', 'Cardio sem aparelho',
    'corrida-ao-ar-livre', 'caminhada-rapida', 'pular-corda', 'polichinelo', 'burpee',
    'elevacao-de-joelhos-no-lugar', 'mountain-climber'),
  f('corpo-inteiro', 'Corpo inteiro',
    'kettlebell-swing', 'thruster', 'clean-and-press', 'snatch-com-halter'),
]

const POR_EXERCICIO = new Map(FAMILIAS.flatMap(fa => fa.exercicios.map(id => [id, fa] as const)))
const POR_ID = new Map(FAMILIAS.map(fa => [fa.id, fa]))

/** O que importa de um exercicio pra achar as alternativas dele. */
type Alvo = Pick<Exercicio, 'id' | 'nome' | 'grupo' | 'familia'>

/** Familia do exercicio: a do mapa pro catalogo, a escolhida pra quem o usuario criou. */
export function familiaDe(ex: Pick<Exercicio, 'id' | 'familia'>): Familia | undefined {
  return POR_EXERCICIO.get(ex.id) ?? (ex.familia ? POR_ID.get(ex.familia) : undefined)
}

export interface Alternativas<E> {
  familia?: Familia
  /** Mesmo movimento, outro aparelho. Na ordem da familia; os criados pelo usuario no fim. */
  variacoes: E[]
  /** Mesmo musculo principal, outro movimento - pra quando nao ha variacao livre. */
  mesmoMusculo: E[]
}

/**
 * O que da pra fazer no lugar de `ex`. `todos` e o catalogo como esta no banco,
 * entao exercicio apagado nao aparece e os criados pelo usuario entram.
 */
export function alternativasDe<E extends Alvo>(ex: E, todos: E[]): Alternativas<E> {
  const familia = familiaDe(ex)
  const posicao = new Map(familia?.exercicios.map((id, i) => [id, i]))
  const variacoes = familia
    ? todos
      .filter(o => o.id !== ex.id && familiaDe(o)?.id === familia.id)
      .sort((a, b) => (posicao.get(a.id) ?? Infinity) - (posicao.get(b.id) ?? Infinity)
        || a.nome.localeCompare(b.nome, 'pt-BR'))
    : []
  const naFamilia = new Set(variacoes.map(v => v.id))
  const mesmoMusculo = todos
    .filter(o => o.id !== ex.id && !naFamilia.has(o.id) && o.grupo === ex.grupo)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return { familia, variacoes, mesmoMusculo }
}
