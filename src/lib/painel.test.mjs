import test from 'node:test'
import assert from 'node:assert/strict'
import { situacaoDoCartao, ordemDeAtencao, semanasDeTreino, constancia, historico, diasDeDieta } from './painel.ts'

const HOJE = '2026-11-27' // sexta
const ts = (iso, hora = 18) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d, hora).getTime() }
const serie = (extra = {}) => ({ exercicioId: 'supino', serie: 1, reps: 10, carga: 50, feito: true, ...extra })
const sessao = (id, dia, extra = {}) => ({
  id, nome: `Treino ${id}`, inicio: ts(dia), fim: ts(dia) + 50 * 60000, series: [serie(), serie({ serie: 2 })],
  concluida: 1, atualizadoEm: 0, ...extra,
})
const cartao = (dias, meta = 4) => ({ v: 1, nome: 'A', xp: 0, streak: 0, melhorStreak: 0, ultimoDiaAtivo: null, metaSemana: meta, treinos: 0, prs: 0, dias, ultimos: [], recordes: [] })

test('situacaoDoCartao: em dia, atencao, parado e sem dados', () => {
  assert.equal(situacaoDoCartao(cartao(['2026-11-26', '2026-11-25', '2026-11-24']), HOJE).situacao, 'em-dia')
  // 4 dias sem treinar
  assert.equal(situacaoDoCartao(cartao(['2026-11-23']), HOJE).situacao, 'atencao')
  // treinou ontem, mas sexta com 1 de 5 treinos esta longe da meta
  assert.equal(situacaoDoCartao(cartao(['2026-11-26'], 5), HOJE).situacao, 'atencao')
  assert.equal(situacaoDoCartao(cartao(['2026-11-18']), HOJE).situacao, 'parado')
  assert.equal(situacaoDoCartao(cartao([]), HOJE).situacao, 'parado')
  assert.equal(situacaoDoCartao(null, HOJE).situacao, 'sem-dados')
  const s = situacaoDoCartao(cartao(['2026-11-26', '2026-11-24', '2026-11-20']), HOJE)
  assert.equal(s.treinosSemana, 2)
  assert.equal(s.diasSemTreinar, 1)
})

test('ordemDeAtencao: parado, atencao, sem dados, em dia', () => {
  const lista = ['em-dia', 'sem-dados', 'parado', 'atencao'].map(situacao => ({ situacao }))
  assert.deepEqual(lista.sort(ordemDeAtencao).map(x => x.situacao), ['parado', 'atencao', 'sem-dados', 'em-dia'])
})

test('semanasDeTreino: 8 semanas de segunda a domingo, so treino concluido com serie valida', () => {
  const s = semanasDeTreino([
    sessao('a', '2026-11-24'), sessao('b', '2026-11-26'),
    sessao('c', '2026-11-17'),
    sessao('aberta', '2026-11-25', { concluida: 0 }),
    sessao('aquecimento', '2026-11-25', { series: [serie({ aquecimento: true })] }),
    sessao('velha', '2026-08-01'),
  ], HOJE, 8)
  assert.equal(s.length, 8)
  assert.equal(s[7].inicio, '2026-11-23')
  assert.equal(s[0].inicio, '2026-10-05')
  assert.deepEqual([s[6].treinos, s[7].treinos], [1, 2])
  assert.equal(s[7].volume, 2 * (2 * 50 * 10))
  assert.equal(s[7].series, 4)
  assert.equal(s.reduce((t, x) => t + x.treinos, 0), 3)
})

test('constancia: fracao das semanas completas que bateram a meta (a atual nao conta)', () => {
  const semanas = [{ treinos: 4 }, { treinos: 2 }, { treinos: 5 }, { treinos: 0 }]
  assert.equal(constancia(semanas, 4), 2 / 3)
  assert.equal(constancia(semanas, 0), null)
})

test('historico: mais novo primeiro, series agrupadas por exercicio', () => {
  const h = historico([
    sessao('velho', '2026-11-20'),
    sessao('novo', '2026-11-26', { series: [serie(), serie({ exercicioId: 'remada', carga: 40, reps: 12 }), serie({ serie: 2, carga: 55, reps: 8 })] }),
  ])
  assert.deepEqual(h.map(x => x.id), ['novo', 'velho'])
  assert.deepEqual(h[0].exercicios, [
    { exercicioId: 'supino', series: [{ carga: 50, reps: 10 }, { carga: 55, reps: 8 }] },
    { exercicioId: 'remada', series: [{ carga: 40, reps: 12 }] },
  ])
  assert.equal(h[0].minutos, 50)
})

test('diasDeDieta: kcal e proteina por dia, nos ultimos 7', () => {
  const alimentos = new Map([['arroz', { kcal: 130, prot: 2.5 }], ['frango', { kcal: 165, prot: 31 }]])
  const r = diasDeDieta([
    { id: '1', data: '2026-11-27', alimentoId: 'arroz', gramas: 200 },
    { id: '2', data: '2026-11-27', alimentoId: 'frango', gramas: 100 },
    { id: '3', data: '2026-11-15', alimentoId: 'frango', gramas: 100 },
    { id: '4', data: '2026-11-26', alimentoId: 'sumiu', gramas: 100 },
  ], alimentos, HOJE, 7)
  assert.equal(r.length, 7)
  assert.equal(r[0].dia, '2026-11-21')
  assert.deepEqual(r[6], { dia: '2026-11-27', kcal: 425, prot: 36, registros: 2 })
  assert.equal(r[5].registros, 0)
})
