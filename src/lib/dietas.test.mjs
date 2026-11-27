import test from 'node:test'
import assert from 'node:assert/strict'
import { retratoDoPlano, mesmoCardapio, textoDoDia } from './dietas.ts'
import { resumoSemanal, textoDaSemana } from './resumo.ts'
import { automaticasDemais } from './semana.ts'

const item = (alimentoId, extra = {}) => ({ alimentoId, qtd: 1, medida: 'unidade', gramas: 50, ...extra })
const plano = (nome, ordem, itens) => ({ id: 'p' + ordem, nome, horario: '08:00', itens, ordem, atualizadoEm: 9 })

test('retrato do plano copia as refeicoes na ordem, sem id nem carimbo', () => {
  const p = [plano('Almoço', 2, [item('arroz')]), plano('Café', 1, [item('pao')])]
  const r = retratoDoPlano(p)
  assert.deepEqual(r.map(x => x.nome), ['Café', 'Almoço'])
  assert.equal(r[0].id, undefined)
  assert.equal(r[0].atualizadoEm, undefined)
  r[0].itens[0].qtd = 99
  assert.equal(p[1].itens[0].qtd, 1, 'copia, nao referencia')
})

test('mesmo cardapio ignora a posicao numerica, mas nao o conteudo', () => {
  const a = retratoDoPlano([plano('Café', 1, [item('pao')])])
  const b = retratoDoPlano([plano('Café', 7, [item('pao')])])
  assert.ok(mesmoCardapio(a, b))
  const c = retratoDoPlano([plano('Café', 1, [item('pao', { qtd: 2 })])])
  assert.ok(!mesmoCardapio(a, c))
})

test('copias automaticas de dieta seguem a mesma retencao das semanas', () => {
  const ds = Array.from({ length: 7 }, (_, i) => ({ id: 'd' + i, auto: 'gerar', criadoEm: i }))
  ds.push({ id: 'minha', criadoEm: 0 })
  assert.deepEqual(automaticasDemais(ds, 5).sort(), ['d0', 'd1'])
})

test('texto do dia lista so refeicao com item e traz o carbo de cada uma', () => {
  const txt = textoDoDia({
    data: 'sex, 27 de nov',
    refeicoes: [
      { nome: 'Café', itens: [{ nome: 'Pão', qtd: 2, medida: 'fatias', kcal: 140, carb: 26 }] },
      { nome: 'Lanche', itens: [] },
    ],
    total: { kcal: 140, prot: 5, carb: 26, gord: 2 },
    metaKcal: 2400,
    aguaMl: 1500,
  })
  assert.match(txt, /^Dieta - sex, 27 de nov\n140 kcal \(meta 2\.400\)/)
  assert.match(txt, /Café - 140 kcal, 26 g de carbo\n- 2 fatias de Pão/)
  assert.doesNotMatch(txt, /Lanche/)
  assert.match(txt, /Água: 1,5 L/)
})

const sessao = (iso, series) => {
  const [a, m, d] = iso.split('-').map(Number)
  return { id: iso, nome: 'x', inicio: new Date(a, m - 1, d, 10).getTime(), series, concluida: 1, atualizadoEm: 0 }
}
const s = (carga, reps, extra = {}) => ({ exercicioId: 'e', serie: 1, carga, reps, feito: true, ...extra })

test('resumo semanal compara com o mesmo trecho da semana passada', () => {
  // 2026-11-27 e sexta: semana atual = seg 23 a sex 27; anterior = seg 16 a sex 20
  const sessoes = [
    sessao('2026-11-23', [s(50, 10), s(50, 10), s(20, 10, { aquecimento: true })]),
    sessao('2026-11-26', [s(60, 5)]),
    sessao('2026-11-18', [s(40, 10)]),
    sessao('2026-11-21', [s(100, 10)]),   // sabado da semana passada: fora do trecho
  ]
  const eventos = [
    { id: '1', ts: 0, tipo: 'dieta', motivo: '', xp: 0, data: '2026-11-24' },
    { id: '2', ts: 0, tipo: 'agua', motivo: '', xp: 0, data: '2026-11-24' },
    { id: '3', ts: 0, tipo: 'agua', motivo: '', xp: 0, data: '2026-11-25' },
    { id: '4', ts: 0, tipo: 'agua', motivo: '', xp: 0, data: '2026-11-17' },
  ]
  const r = resumoSemanal(sessoes, eventos, '2026-11-27')
  assert.equal(r.dias, 5)
  assert.equal(r.inicio, '2026-11-23')
  assert.deepEqual(r.atual, { treinos: 2, series: 3, volume: 1300, diasDieta: 1, diasProteina: 0, diasAgua: 2 })
  assert.deepEqual(r.anterior, { treinos: 1, series: 1, volume: 400, diasDieta: 0, diasProteina: 0, diasAgua: 1 })
})

test('domingo fecha a semana com 7 dias', () => {
  const r = resumoSemanal([], [], '2026-11-29')
  assert.equal(r.dias, 7)
  assert.equal(r.inicio, '2026-11-23')
  assert.match(textoDaSemana(r, { nivel: 3, rank: 'Ferro' }), /Dias batendo a água: 0 de 7\n\nNível 3 - Rank Ferro$/)
})
