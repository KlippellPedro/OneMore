import test from 'node:test'
import assert from 'node:assert/strict'
import {
  gerarCodigo, normalizarCodigo, hashCodigo, conferirCodigo,
  hashSenha, conferirSenha, normalizarEmail, emailValido,
} from './auth.js'

test('o codigo sai no formato legivel de tres blocos', () => {
  const c = gerarCodigo()
  assert.match(c, /^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/)
})

test('o codigo nao usa caracteres que se confundem no papel', () => {
  const juntos = Array.from({ length: 400 }, gerarCodigo).join('')
  for (const ruim of ['0', 'O', '1', 'I', 'L']) {
    assert.ok(!juntos.includes(ruim), `codigo nao pode conter "${ruim}"`)
  }
})

test('dois codigos nunca saem iguais', () => {
  const s = new Set(Array.from({ length: 500 }, gerarCodigo))
  assert.equal(s.size, 500)
})

test('normalizar aceita minuscula, sem hifen e com espaco', () => {
  const c = 'ABCD-2345-EFGH'
  for (const variante of ['abcd-2345-efgh', 'ABCD2345EFGH', ' abcd 2345 efgh ', 'AbCd-2345-EfGh']) {
    assert.equal(normalizarCodigo(variante), normalizarCodigo(c), variante)
  }
})

test('o codigo confere depois de virar hash, em qualquer caixa', async () => {
  const c = gerarCodigo()
  const h = await hashCodigo(c)
  assert.ok(await conferirCodigo(c, h), 'o proprio codigo tem que conferir')
  assert.ok(await conferirCodigo(c.toLowerCase(), h), 'minuscula tem que conferir')
  assert.ok(await conferirCodigo(c.replace(/-/g, ''), h), 'sem hifen tem que conferir')
})

test('codigo errado nao confere', async () => {
  const h = await hashCodigo(gerarCodigo())
  assert.ok(!await conferirCodigo(gerarCodigo(), h))
  assert.ok(!await conferirCodigo('', h))
  assert.ok(!await conferirCodigo('AAAA-AAAA-AAAA', h))
})

test('o hash guardado nao contem o codigo em texto puro', async () => {
  const c = gerarCodigo()
  const h = await hashCodigo(c)
  assert.ok(!h.includes(normalizarCodigo(c)))
  assert.ok(h.startsWith('scrypt$'))
})

test('conferir contra hash invalido devolve false em vez de estourar', async () => {
  for (const lixo of [null, undefined, '', 'nao-e-hash', 'scrypt$so$isso']) {
    assert.equal(await conferirCodigo('ABCD-2345-EFGH', lixo), false, String(lixo))
  }
})

test('senha continua funcionando como antes', async () => {
  const h = await hashSenha('senhaforte123')
  assert.ok(await conferirSenha('senhaforte123', h))
  assert.ok(!await conferirSenha('senhaforte124', h))
})

test('e-mail normaliza e valida', () => {
  assert.equal(normalizarEmail('  Pedro@Teste.COM '), 'pedro@teste.com')
  assert.ok(emailValido('a@b.com'))
  assert.ok(!emailValido('naoehemail'))
})
