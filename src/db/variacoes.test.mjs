import test from 'node:test'
import assert from 'node:assert/strict'
import { FAMILIAS, familiaDe, alternativasDe } from './variacoes.ts'
import { EXERCICIOS_SEED } from './seedExercicios.ts'

const IDS = new Set(EXERCICIOS_SEED.map(e => e.id))

/**
 * Sem familia de proposito: nao existe "o mesmo movimento noutro aparelho"
 * pra eles. A troca no treino ainda oferece o mesmo musculo.
 */
const SEM_FAMILIA = new Set(['ex_cadeira-extensora', 'ex_mobilidade-e-alongamento'])

test('todo exercicio citado numa familia existe no catalogo', () => {
  // o id e texto solto: errou um acento no nome do seed e a variacao some calada
  const fantasmas = FAMILIAS.flatMap(f => f.exercicios.filter(id => !IDS.has(id)))
  assert.deepEqual(fantasmas, [])
})

test('nenhum exercicio esta em duas familias', () => {
  const vistos = new Map()
  const repetidos = []
  for (const f of FAMILIAS) {
    for (const id of f.exercicios) {
      if (vistos.has(id)) repetidos.push(`${id}: ${vistos.get(id)} e ${f.id}`)
      vistos.set(id, f.id)
    }
  }
  assert.deepEqual(repetidos, [])
})

test('toda familia tem pelo menos duas opcoes e id unico', () => {
  assert.deepEqual(FAMILIAS.filter(f => f.exercicios.length < 2).map(f => f.id), [])
  assert.equal(new Set(FAMILIAS.map(f => f.id)).size, FAMILIAS.length)
})

test('exercicio novo no catalogo precisa entrar numa familia (ou na lista de excecoes)', () => {
  const orfaos = EXERCICIOS_SEED
    .filter(e => !familiaDe(e) && !SEM_FAMILIA.has(e.id))
    .map(e => e.id)
  assert.deepEqual(orfaos, [])
})

const ex = (id, grupo, extra = {}) => ({ id, nome: id, grupo, ...extra })

test('alternativasDe: variacoes vem na ordem da familia, sem o proprio exercicio', () => {
  const todos = EXERCICIOS_SEED
  const supinoHalter = todos.find(e => e.id === 'ex_supino-reto-com-halteres')
  const { familia, variacoes } = alternativasDe(supinoHalter, todos)
  assert.equal(familia.id, 'supino-reto')
  assert.deepEqual(variacoes.map(v => v.id), [
    'ex_supino-reto-com-barra', 'ex_supino-na-maquina', 'ex_supino-reto-no-smith', 'ex_flexao-de-braco',
  ])
})

test('alternativasDe: mesmo musculo nao repete o que ja e variacao', () => {
  const todos = EXERCICIOS_SEED
  const supino = todos.find(e => e.id === 'ex_supino-reto-com-barra')
  const { variacoes, mesmoMusculo } = alternativasDe(supino, todos)
  const ids = new Set(variacoes.map(v => v.id))
  assert.ok(mesmoMusculo.length > 0)
  assert.ok(mesmoMusculo.every(e => e.grupo === 'peito' && !ids.has(e.id) && e.id !== supino.id))
})

test('alternativasDe: exercicio criado pelo usuario entra pela familia escolhida, no fim', () => {
  const todos = [
    ex('ex_remada-baixa-no-cabo', 'costas'),
    ex('usr_remada-da-minha-academia', 'costas', { familia: 'remada' }),
    ex('ex_remada-curvada-com-barra', 'costas'),
  ]
  const { variacoes } = alternativasDe(todos[2], todos)
  assert.deepEqual(variacoes.map(v => v.id), ['ex_remada-baixa-no-cabo', 'usr_remada-da-minha-academia'])
  // e o contrario: a partir do criado pelo usuario, aparecem os do catalogo
  assert.deepEqual(
    alternativasDe(todos[1], todos).variacoes.map(v => v.id),
    ['ex_remada-curvada-com-barra', 'ex_remada-baixa-no-cabo'],
  )
})

test('alternativasDe: sem familia, so sobra o mesmo musculo', () => {
  const todos = [ex('usr_x', 'quadriceps'), ex('ex_cadeira-extensora', 'quadriceps'), ex('ex_prancha', 'abdomen')]
  const r = alternativasDe(todos[0], todos)
  assert.equal(r.familia, undefined)
  assert.deepEqual(r.variacoes, [])
  assert.deepEqual(r.mesmoMusculo.map(e => e.id), ['ex_cadeira-extensora'])
})
