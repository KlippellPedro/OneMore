import test from 'node:test'
import assert from 'node:assert/strict'
import {
  faixaDeReps, repsIniciais, sugerirCarga, anilhasPorLado, seriesPorGrupo, duracaoEstimada,
  umRM, melhorUmRM, arredondarCarga, textoDoTreino,
} from './treino.ts'

test('faixa de reps entende intervalo, numero solto e recusa tempo', () => {
  assert.deepEqual(faixaDeReps('8-12'), { min: 8, max: 12 })
  assert.deepEqual(faixaDeReps(' 10 '), { min: 10, max: 10 })
  assert.deepEqual(faixaDeReps('8 a 12'), { min: 8, max: 12 })
  assert.deepEqual(faixaDeReps('12-8'), { min: 8, max: 12 })
  for (const x of ['30s', '20min', 'até a falha', 'AMRAP', '', undefined, '0']) {
    assert.equal(faixaDeReps(x), null, String(x))
  }
})

test('reps iniciais = piso da faixa, 0 quando o alvo nao e contagem', () => {
  assert.equal(repsIniciais('8-12'), 8)
  assert.equal(repsIniciais('5'), 5)
  assert.equal(repsIniciais('45s'), 0)
})

test('sugere subir a carga so quando bateu o topo em todas as series', () => {
  const todas = [{ carga: 40, reps: 12 }, { carga: 40, reps: 12 }, { carga: 40, reps: 13 }]
  assert.deepEqual(sugerirCarga(todas, '8-12', 'barra'), { carga: 42.5, anterior: 40, topo: 12 })
  assert.equal(sugerirCarga(todas, '8-12', 'halter').carga, 42)

  const umaFicou = [{ carga: 40, reps: 12 }, { carga: 40, reps: 12 }, { carga: 40, reps: 9 }]
  assert.equal(sugerirCarga(umaFicou, '8-12', 'barra'), null)
})

test('sem carga pra subir, sem historico ou sem faixa, nao sugere', () => {
  const s = [{ carga: 0, reps: 15 }]
  assert.equal(sugerirCarga(s, '10-15', 'peso-corporal'), null)
  assert.equal(sugerirCarga(s, '10-15', 'barra'), null)
  assert.equal(sugerirCarga([], '8-12', 'barra'), null)
  assert.equal(sugerirCarga([{ carga: 20, reps: 30 }], '30s', 'barra'), null)
})

test('anilhas por lado fecham a carga com a barra', () => {
  assert.deepEqual(anilhasPorLado(100, 20), { lado: [25, 15], sobra: 0, abaixoDaBarra: false })
  assert.deepEqual(anilhasPorLado(62.5, 20).lado, [20, 1.25])
  assert.deepEqual(anilhasPorLado(20, 20), { lado: [], sobra: 0, abaixoDaBarra: false })
  assert.equal(anilhasPorLado(15, 20).abaixoDaBarra, true)
  assert.deepEqual(anilhasPorLado(0, 20), { lado: [], sobra: 0, abaixoDaBarra: false })
})

test('anilhas: o que nao fecha aparece como sobra', () => {
  const m = anilhasPorLado(21, 20)
  assert.deepEqual(m.lado, [])
  assert.equal(m.sobra, 1)
  assert.equal(anilhasPorLado(41, 15).sobra, 1)
})

test('series por musculo contam a rotina uma vez por dia e ignoram rotina sem dia', () => {
  const grupos = { supino: 'peito', remada: 'costas', esteira: 'cardio', rosca: 'biceps' }
  const it = (exercicioId, series) => ({ exercicioId, series, repsAlvo: '8-12', descansoSeg: 60 })
  const r = seriesPorGrupo([
    { itens: [it('supino', 4), it('esteira', 1)], dias: [1, 4] },
    { itens: [it('remada', 3)], dias: [2] },
    { itens: [it('rosca', 10)], dias: [] },
  ], id => grupos[id])
  const de = g => r.find(x => x.grupo === g)
  assert.equal(de('peito').series, 8)
  assert.equal(de('costas').series, 3)
  assert.equal(de('biceps').series, 0, 'rotina sem dia nao entra na semana')
  assert.equal(de('cardio'), undefined)
  assert.equal(r[0].grupo, 'peito')
  assert.ok(de('posterior'), 'musculo grande aparece mesmo zerado')
})

test('duracao estimada soma series, descanso e troca, de 5 em 5 min', () => {
  const it = (series, descansoSeg, repsAlvo = '8-12') => ({ exercicioId: 'x', series, repsAlvo, descansoSeg })
  // 4 series: 4x45 + 3x90 + 90 = 540 s = 9 min -> 10
  assert.equal(duracaoEstimada([it(4, 90)]), 10)
  // esteira de 20 min conta os 20
  assert.equal(duracaoEstimada([it(1, 0, '20min')]), 20)
  assert.equal(duracaoEstimada([]), 0)
})

test('1RM estimado pela formula de Epley, so ate 12 reps', () => {
  assert.equal(umRM(100, 1), 100)
  assert.equal(umRM(100, 10), 133.3)
  assert.equal(umRM(100, 15), null)
  assert.equal(umRM(0, 5), null)
  assert.equal(melhorUmRM([{ carga: 100, reps: 5 }, { carga: 90, reps: 10 }, { carga: 120, reps: 20 }]), 120)
  assert.equal(melhorUmRM([{ carga: 50, reps: 30 }]), null)
  assert.equal(arredondarCarga(71.3), 72.5)
})

test('texto do treino leva so as series de trabalho feitas', () => {
  const s = (exercicioId, carga, reps, extra = {}) => ({ exercicioId, serie: 1, carga, reps, feito: true, ...extra })
  const txt = textoDoTreino({
    nome: 'Treino A', data: 'sex, 27 de nov', duracao: '58 min',
    series: [
      s('supino', 20, 15, { aquecimento: true }),
      s('supino', 60, 10), s('supino', 60, 8),
      s('remada', 40, 12), s('remada', 45, 10),
      s('flexao', 0, 20),
      s('rosca', 10, 12, { feito: false }),
    ],
    nomeDe: id => ({ supino: 'Supino', remada: 'Remada', flexao: 'Flexão', rosca: 'Rosca' })[id],
    recordes: ['Supino 60 kg'],
  })
  assert.match(txt, /^Treino A\nsex, 27 de nov - 58 min - 5 séries - 2\.010 kg levantados/)
  assert.match(txt, /- Supino: 60 kg x 10, 8/)
  assert.match(txt, /- Remada: 40x12, 45x10/)
  assert.match(txt, /- Flexão: 20 reps/)
  assert.doesNotMatch(txt, /Rosca/)
  assert.match(txt, /Recordes: Supino 60 kg/)
})
