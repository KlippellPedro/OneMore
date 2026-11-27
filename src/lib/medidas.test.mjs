import test from 'node:test'
import assert from 'node:assert/strict'
import { lerMedidas } from './medidas.ts'

const HOJE = '2026-11-27'

test('medidas: le o que faz sentido, com virgula', () => {
  const r = lerMedidas({ peso: '75,4', cintura: '82' }, HOJE, HOJE)
  assert.deepEqual(r, { ok: true, dados: { peso: 75.4, cintura: 82 } })
})

test('medidas: recusa erro de digitacao, data vazia ou futura e formulario vazio', () => {
  assert.equal(lerMedidas({ peso: '750' }, HOJE, HOJE).ok, false, 'um zero a mais')
  assert.equal(lerMedidas({ peso: '0' }, HOJE, HOJE).ok, false)
  assert.equal(lerMedidas({ peso: '-5' }, HOJE, HOJE).ok, false)
  assert.equal(lerMedidas({ gorduraPct: '300' }, HOJE, HOJE).ok, false)
  assert.equal(lerMedidas({ peso: '75' }, '', HOJE).ok, false, 'data apagada no seletor')
  assert.equal(lerMedidas({ peso: '75' }, '2026-12-01', HOJE).ok, false, 'futuro')
  assert.equal(lerMedidas({ peso: '  ' }, HOJE, HOJE).ok, false, 'nada preenchido')
})
