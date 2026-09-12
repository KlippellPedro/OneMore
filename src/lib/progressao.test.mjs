import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularProgressao } from './progressao.ts'

const dia = n => new Date(2026, 0, n).getTime()
const sessao = (n, series) => ({ id: `s${n}`, nome: 'T', inicio: dia(n), concluida: 1, series, atualizadoEm: 0 })
const serie = (ex, carga, reps = 8, extra = {}) =>
  ({ exercicioId: ex, serie: 1, reps, carga, feito: true, ...extra })

test('carga subindo e detectada', () => {
  const s = [60, 62, 65, 70, 72, 75].map((c, i) => sessao(i + 1, [serie('supino', c)]))
  const [p] = calcularProgressao(s)
  assert.equal(p.tendencia, 'subindo')
  assert.ok(p.delta > 0)
  assert.equal(p.recorde, 75)
  assert.equal(p.atual, 75)
})

test('carga parada e detectada', () => {
  const s = [80, 80, 80, 80, 80, 80].map((c, i) => sessao(i + 1, [serie('agacho', c)]))
  const [p] = calcularProgressao(s)
  assert.equal(p.tendencia, 'parado')
  assert.equal(p.delta, 0)
})

test('um dia ruim nao vira estagnacao', () => {
  // subiu firme e teve UM dia fraco no fim: a media aguenta
  const s = [60, 65, 70, 75, 80, 70].map((c, i) => sessao(i + 1, [serie('supino', c)]))
  const [p] = calcularProgressao(s)
  assert.equal(p.tendencia, 'subindo', 'um dia fraco nao apaga a tendencia')
})

test('queda real e detectada', () => {
  const s = [100, 98, 95, 85, 82, 80].map((c, i) => sessao(i + 1, [serie('terra', c)]))
  const [p] = calcularProgressao(s)
  assert.equal(p.tendencia, 'caindo')
  assert.ok(p.delta < 0)
})

test('pouco historico nao recebe veredito', () => {
  const s = [60, 65].map((c, i) => sessao(i + 1, [serie('remada', c)]))
  const [p] = calcularProgressao(s)
  assert.equal(p.tendencia, 'novo')
  assert.equal(p.sessoes, 2)
})

test('aquecimento e serie nao feita ficam de fora', () => {
  const s = [sessao(1, [
    serie('supino', 200, 5, { aquecimento: true }),
    serie('supino', 300, 5, { feito: false }),
    serie('supino', 60),
  ])]
  const [p] = calcularProgressao(s)
  assert.equal(p.recorde, 60, 'aquecimento de 200 kg nao pode virar recorde')
})

test('sessao nao concluida e ignorada', () => {
  const s = [{ ...sessao(1, [serie('supino', 90)]), concluida: 0 }]
  assert.deepEqual(calcularProgressao(s), [])
})

test('exercicio sem carga (peso corporal) nao entra', () => {
  const s = [sessao(1, [serie('prancha', 0, 60)])]
  assert.deepEqual(calcularProgressao(s), [])
})

test('varios exercicios: ordena por quem tem mais sessoes', () => {
  const s = [
    sessao(1, [serie('supino', 60), serie('rosca', 20)]),
    sessao(2, [serie('supino', 62)]),
    sessao(3, [serie('supino', 64)]),
  ]
  const r = calcularProgressao(s)
  assert.equal(r[0].exercicioId, 'supino')
  assert.equal(r[0].sessoes, 3)
  assert.equal(r[1].exercicioId, 'rosca')
})
