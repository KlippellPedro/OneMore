import test from 'node:test'
import assert from 'node:assert/strict'
import { fundirTabela, fundirLapides, lapidesDe, assinatura, mudouTabela } from './fundir.ts'

const ids = a => a.map(x => x.id).sort()

test('linha que so existe de um lado entra', () => {
  const r = fundirTabela([{ id: 'a', atualizadoEm: 1 }], [{ id: 'b', atualizadoEm: 1 }])
  assert.deepEqual(ids(r), ['a', 'b'])
})

test('em conflito vence o carimbo mais novo', () => {
  const r = fundirTabela(
    [{ id: 'a', atualizadoEm: 100, v: 'local' }],
    [{ id: 'a', atualizadoEm: 200, v: 'nuvem' }])
  assert.equal(r.length, 1)
  assert.equal(r[0].v, 'nuvem')
})

test('o treino registrado no celular NAO some ao enviar do PC', () => {
  // celular registrou a sessao s2 e mandou pra nuvem; o PC so tem a s1 antiga
  const pc = [{ id: 's1', atualizadoEm: 10 }]
  const nuvem = [{ id: 's1', atualizadoEm: 10 }, { id: 's2', atualizadoEm: 50 }]
  assert.deepEqual(ids(fundirTabela(pc, nuvem)), ['s1', 's2'])
})

test('empate de carimbo fica com o deste aparelho', () => {
  const r = fundirTabela(
    [{ id: 'a', atualizadoEm: 100, v: 'local' }],
    [{ id: 'a', atualizadoEm: 100, v: 'nuvem' }])
  assert.equal(r[0].v, 'local')
})

test('o que foi apagado nao volta', () => {
  const lap = new Map([['a', 300]])
  const r = fundirTabela([], [{ id: 'a', atualizadoEm: 100 }], lap)
  assert.deepEqual(ids(r), [])
})

test('mas o que foi recriado DEPOIS de apagado fica', () => {
  const lap = new Map([['a', 300]])
  const r = fundirTabela([{ id: 'a', atualizadoEm: 400 }], [], lap)
  assert.deepEqual(ids(r), ['a'])
})

test('EventoXP usa ts, que nao tem atualizadoEm', () => {
  const r = fundirTabela([{ id: 'x', ts: 500 }], [{ id: 'x', ts: 100 }])
  assert.equal(r[0].ts, 500)
})

test('linha sem carimbo nenhum nao quebra', () => {
  const r = fundirTabela([{ id: 'a' }], [{ id: 'a' }])
  assert.equal(r.length, 1)
})

test('lapides se unem ficando com a mais recente', () => {
  const r = fundirLapides(
    [{ id: 'sessoes:a', tabela: 'sessoes', chave: 'a', ts: 10 }],
    [{ id: 'sessoes:a', tabela: 'sessoes', chave: 'a', ts: 90 }])
  assert.equal(r.length, 1)
  assert.equal(r[0].ts, 90)
})

test('lapidesDe filtra por tabela', () => {
  const todas = [
    { id: 'sessoes:a', tabela: 'sessoes', chave: 'a', ts: 10 },
    { id: 'rotinas:a', tabela: 'rotinas', chave: 'a', ts: 20 },
  ]
  assert.deepEqual([...lapidesDe(todas, 'sessoes')], [['a', 10]])
})

test('assinatura muda quando o conteudo muda', () => {
  const a = assinatura({ sessoes: [{ id: '1', atualizadoEm: 5 }] })
  const b = assinatura({ sessoes: [{ id: '1', atualizadoEm: 6 }] })
  const c = assinatura({ sessoes: [{ id: '1', atualizadoEm: 5 }] })
  assert.notEqual(a, b)
  assert.equal(a, c)
})

test('fusao e idempotente: rodar de novo nao muda nada', () => {
  const local = [{ id: 'a', atualizadoEm: 1 }, { id: 'b', atualizadoEm: 9 }]
  const nuvem = [{ id: 'b', atualizadoEm: 2 }, { id: 'c', atualizadoEm: 3 }]
  const um = fundirTabela(local, nuvem)
  const dois = fundirTabela(um, um)
  assert.deepEqual(ids(um), ids(dois))
  assert.equal(um.find(x => x.id === 'b').atualizadoEm, 9)
})

/* --- acentuacao: dado antigo tem que continuar resolvendo --- */
import { mesmoTexto, semAcento } from './format.ts'

test('refeicao salva sem acento casa com a do plano', () => {
  assert.ok(mesmoTexto('Cafe da manha', 'Café da manhã'))
  assert.ok(mesmoTexto('Pre-treino', 'Pré-treino'))
  assert.ok(!mesmoTexto('Almoco', 'Jantar'))
})

test('semAcento ignora caixa e espaco nas pontas', () => {
  assert.equal(semAcento('  Café Da Manhã '), 'cafe da manha')
})

/* ---------- mudouTabela: decide o que o importar reescreve ---------- */

test('mudouTabela: nada novo do outro lado = false', () => {
  const a = { id: 'a', atualizadoEm: 10 }
  const b = { id: 'b', atualizadoEm: 20 }
  const local = [a, b]
  assert.equal(mudouTabela(local, fundirTabela(local, [])), false)
})

test('mudouTabela: linha que veio da nuvem = true', () => {
  const local = [{ id: 'a', atualizadoEm: 10 }]
  const nuvem = [{ id: 'b', atualizadoEm: 20 }]
  assert.equal(mudouTabela(local, fundirTabela(local, nuvem)), true)
})

test('mudouTabela: versao mais nova da nuvem sobrepondo a local = true', () => {
  const local = [{ id: 'a', atualizadoEm: 10 }]
  const nuvem = [{ id: 'a', atualizadoEm: 99 }]
  const fundido = fundirTabela(local, nuvem)
  assert.equal(fundido.length, 1)
  assert.equal(mudouTabela(local, fundido), true)
})

/**
 * O caso que a assinatura por contagem + carimbo nao pegaria: apagou uma linha
 * e criou outra no mesmo instante. Contagem igual, carimbo igual, tabela
 * diferente.
 */
test('mudouTabela: troca de linha com mesma contagem e mesmo carimbo = true', () => {
  const local = [{ id: 'a', atualizadoEm: 50 }]
  const fundido = [{ id: 'b', atualizadoEm: 50 }]
  assert.equal(mudouTabela(local, fundido), true)
})
