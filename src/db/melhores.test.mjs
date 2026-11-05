import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularMelhores } from './melhores.ts'

const dia = n => new Date(2026, 0, n).getTime()
const sessao = (n, series) => ({ id: `s${n}`, nome: 'T', inicio: dia(n), concluida: 1, series, atualizadoEm: 0 })
const serie = (carga, reps, extra = {}) =>
  ({ exercicioId: 'supino', serie: 1, reps, carga, feito: true, ...extra })

test('guarda as series da ultima vez uma a uma, nao so a melhor', () => {
  const [m] = calcularMelhores([sessao(1, [serie(60, 10), serie(60, 8), serie(55, 8)])])
  assert.deepEqual(m.ultimaSeries, [
    { carga: 60, reps: 10 }, { carga: 60, reps: 8 }, { carga: 55, reps: 8 },
  ])
})

test('so a sessao mais recente vale, mesmo importada fora de ordem', () => {
  const [m] = calcularMelhores([
    sessao(9, [serie(70, 6), serie(70, 5)]),
    sessao(2, [serie(50, 12)]),
  ])
  assert.deepEqual(m.ultimaSeries, [{ carga: 70, reps: 6 }, { carga: 70, reps: 5 }])
})

test('aquecimento e serie nao feita ficam de fora', () => {
  const [m] = calcularMelhores([sessao(1, [
    serie(20, 15, { aquecimento: true }),
    serie(60, 10),
    serie(60, 8, { feito: false }),
  ])])
  assert.deepEqual(m.ultimaSeries, [{ carga: 60, reps: 10 }])
})

test('o recorde continua sendo de todas as sessoes', () => {
  const [m] = calcularMelhores([sessao(1, [serie(100, 5)]), sessao(8, [serie(60, 10)])])
  assert.equal(m.recordeCarga, 100)
  assert.deepEqual(m.ultimaSeries, [{ carga: 60, reps: 10 }])
})
