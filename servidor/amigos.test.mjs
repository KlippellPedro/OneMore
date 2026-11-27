import test from 'node:test'
import assert from 'node:assert/strict'
import {
  gerarConvite, normalizarConvite, formatarConvite, uuidValido, validarCartao,
  TAMANHO_CONVITE, MAX_DIAS, MAX_ULTIMOS, MAX_RECORDES,
} from './amigos.js'
import { freadoNoConvite, freadoPorIp, MAX_CONVITE } from './api.js'

/* ---------- codigo de convite ---------- */

test('gerarConvite: 8 caracteres do alfabeto sem 0/O/1/I/L', () => {
  for (let i = 0; i < 200; i++) {
    const c = gerarConvite()
    assert.equal(c.length, TAMANHO_CONVITE)
    assert.match(c, /^[2-9A-HJKMNP-Z]+$/)
  }
})

test('normalizarConvite: aceita minuscula, hifen e espaco - quem digita a mao erra nisso', () => {
  assert.equal(normalizarConvite('k7q2-xp9m'), 'K7Q2XP9M')
  assert.equal(normalizarConvite(' K7Q2 XP9M '), 'K7Q2XP9M')
  assert.equal(normalizarConvite('K7Q2XP9M'), 'K7Q2XP9M')
})

test('normalizarConvite: recusa tamanho errado e letra fora do alfabeto', () => {
  for (const ruim of ['K7Q2-XP9', 'K7Q2-XP9MM', 'K7Q2-XP0M', 'K7Q2-XPIM', 'K7Q2-XPOM', '', null, undefined, 12345678]) {
    assert.equal(normalizarConvite(ruim), null, String(ruim))
  }
})

test('formatarConvite: K7Q2XP9M vira K7Q2-XP9M, e sem codigo continua sem', () => {
  assert.equal(formatarConvite('K7Q2XP9M'), 'K7Q2-XP9M')
  assert.equal(formatarConvite(null), null)
})

test('uuidValido: so uuid passa (texto qualquer viraria erro 500 dentro do banco)', () => {
  assert.ok(uuidValido('0b6f1c9e-2a4d-4e8f-9c1a-3d5e7f9a1b2c'))
  for (const ruim of ['', 'abc', "1' or '1'='1", null, 42, '0b6f1c9e2a4d4e8f9c1a3d5e7f9a1b2c']) {
    assert.equal(uuidValido(ruim), false, String(ruim))
  }
})

/* ---------- freio do convite ---------- */

let n = 0
const reqDe = ip => ({ headers: {}, socket: { remoteAddress: ip } })

test('freadoNoConvite: trava quem chuta codigo, e o balde e separado do login', () => {
  const ip = `10.200.${n++}.1`
  const conta = `conta-${n++}`
  let travou = false
  for (let i = 0; i < MAX_CONVITE + 2; i++) travou = freadoNoConvite(reqDe(ip), conta) || travou
  assert.ok(travou)
  // errar codigo de amigo nao pode travar o login desse mesmo IP
  assert.equal(freadoPorIp(reqDe(ip)), false)
})

test('freadoNoConvite: chutar de muitos IPs contra a mesma conta tambem trava', () => {
  const conta = `conta-${n++}`
  let travou = false
  for (let i = 0; i < MAX_CONVITE + 2; i++) travou = freadoNoConvite(reqDe(`10.201.${n++}.1`), conta) || travou
  assert.ok(travou)
})

/* ---------- cartao ---------- */

const cartaoBom = (extra = {}) => ({
  v: 1,
  nome: 'Pedro',
  xp: 4200,
  streak: 6,
  melhorStreak: 21,
  ultimoDiaAtivo: '2026-11-26',
  metaSemana: 4,
  treinos: 87,
  prs: 31,
  dias: ['2026-11-26', '2026-11-24', '2026-11-21'],
  ultimos: [{ nome: 'Treino A - Peito', dia: '2026-11-26', series: 18, volume: 9450.5, minutos: 62 }],
  recordes: [{ nome: 'Supino reto', carga: 90, reps: 5 }],
  ...extra,
})

test('validarCartao: o cartao bom passa como veio', () => {
  assert.deepEqual(validarCartao(cartaoBom()), cartaoBom())
})

/**
 * O motivo de o cartao existir: o amigo NUNCA ve dieta, peso, medida, glicemia
 * nem e-mail. Mesmo que o aparelho mande (bug, app velho, alguem mexendo no
 * codigo), o servidor joga fora tudo que nao esta na lista.
 */
test('validarCartao: descarta qualquer campo fora da lista (dado de saude nao vaza)', () => {
  const r = validarCartao(cartaoBom({
    pesoKg: 82, glicemia: [{ valor: 110 }], dieta: { kcal: 2400 }, email: 'a@b.com', diabetesTipo1: true,
    ultimos: [{ nome: 'A', dia: '2026-11-26', series: 1, volume: 1, minutos: 1, notas: 'dor no joelho' }],
  }))
  assert.deepEqual(Object.keys(r).sort(), Object.keys(cartaoBom()).sort())
  assert.deepEqual(Object.keys(r.ultimos[0]).sort(), ['dia', 'minutos', 'nome', 'series', 'volume'])
})

test('validarCartao: numero estranho vira 0 ou o teto, sem derrubar o cartao', () => {
  const r = validarCartao(cartaoBom({ xp: -50, streak: 'muito', treinos: 1e12, metaSemana: 99 }))
  assert.equal(r.xp, 0)
  assert.equal(r.streak, 0)
  assert.equal(r.treinos, 100_000)
  assert.equal(r.metaSemana, 14)
})

test('validarCartao: corta texto comprido e poe nome padrao no vazio', () => {
  const r = validarCartao(cartaoBom({ nome: 'x'.repeat(500) }))
  assert.equal(r.nome.length, 40)
  assert.equal(validarCartao(cartaoBom({ nome: '   ' })).nome, 'Jogador')
})

test('validarCartao: dia so no formato AAAA-MM-DD; dias repetidos viram um, do mais novo pro mais velho', () => {
  const r = validarCartao(cartaoBom({
    ultimoDiaAtivo: 'ontem',
    dias: ['2026-11-20', 'lixo', '2026-11-26', '2026-11-20', '2026-13-01', 5],
  }))
  assert.equal(r.ultimoDiaAtivo, null)
  assert.deepEqual(r.dias, ['2026-11-26', '2026-11-20'])
})

test('validarCartao: listas tem teto', () => {
  const dias = Array.from({ length: 90 }, (_, i) => `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`)
  const ultimos = Array.from({ length: 20 }, () => ({ nome: 'T', dia: '2026-11-26', series: 1, volume: 1, minutos: 1 }))
  const recordes = Array.from({ length: 20 }, (_, i) => ({ nome: `E${i}`, carga: i, reps: 1 }))
  const r = validarCartao(cartaoBom({ dias, ultimos, recordes }))
  assert.equal(r.dias.length, MAX_DIAS)
  assert.equal(r.ultimos.length, MAX_ULTIMOS)
  assert.equal(r.recordes.length, MAX_RECORDES)
})

test('validarCartao: o que nem objeto e, recusa', () => {
  for (const ruim of [null, undefined, 'cartao', 42, [1, 2]]) assert.equal(validarCartao(ruim), null)
})
