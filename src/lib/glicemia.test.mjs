import test from 'node:test'
import assert from 'node:assert/strict'
import { problemaNaGlicemia, GLICEMIA_MIN, GLICEMIA_MAX } from './glicemia.ts'

test('glicemia: aceita o que um glicosimetro mede, recusa erro de digitacao', () => {
  assert.equal(problemaNaGlicemia(95), null)
  assert.equal(problemaNaGlicemia(GLICEMIA_MIN), null)
  assert.equal(problemaNaGlicemia(GLICEMIA_MAX), null)
  assert.ok(problemaNaGlicemia(5000), 'um zero a mais')
  assert.ok(problemaNaGlicemia(0))
  assert.ok(problemaNaGlicemia(-5))
  assert.ok(problemaNaGlicemia(NaN))
})

test('glicemia: insulina e carbo sao opcionais, mas quando vem precisam fazer sentido', () => {
  assert.equal(problemaNaGlicemia(120, '', ''), null)
  assert.equal(problemaNaGlicemia(120, '4,5', '60'), null, 'virgula decimal vale')
  assert.ok(problemaNaGlicemia(120, '-2'))
  assert.ok(problemaNaGlicemia(120, '1000'))
  assert.ok(problemaNaGlicemia(120, 'abc'))
  assert.ok(problemaNaGlicemia(120, '', '-10'))
  assert.ok(problemaNaGlicemia(120, '', '5000'))
})
