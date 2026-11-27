import test from 'node:test'
import assert from 'node:assert/strict'
import {
  pacoteDeTreino, lerPacoteTreino, rotinasParaAdicionar, comIdsNovos, pacoteDeDieta, lerPacoteDieta,
} from './pacotes.ts'
import { problemaNoPacote } from '../../servidor/equipe.js'

let n = 0
const novoId = () => `novo-${++n}`
const item = (exercicioId, extra = {}) => ({ exercicioId, series: 3, repsAlvo: '8-12', descansoSeg: 90, ...extra })
const rotina = (id, extra = {}) => ({ id, nome: `Treino ${id}`, cor: '#8b6dd6', itens: [item('supino')], dias: [], ordem: 0, ...extra })
const meuEx = { id: 'meu-ex', nome: 'Meu exercicio', grupo: 'peito', equipamento: 'halter', execucao: [], custom: true, atualizadoEm: 1 }

/* ---------- treino ---------- */

test('pacote de treino: ida e volta, e passa na checagem do servidor', () => {
  const p = pacoteDeTreino('ABC', {
    rotinas: [rotina('a', { dias: [1], itens: [item('supino'), item('meu-ex', { cargaAlvo: 20, obs: 'devagar' })] })],
    exercicios: [meuEx],
  })
  assert.equal(problemaNoPacote('treino', JSON.parse(JSON.stringify(p))), null)
  const lida = lerPacoteTreino(JSON.parse(JSON.stringify(p)))
  assert.equal(lida.nome, 'ABC')
  assert.deepEqual(lida.rotinas[0].itens.map(i => i.exercicioId), ['supino', 'meu-ex'])
  assert.equal(lida.rotinas[0].itens[1].obs, 'devagar')
  assert.deepEqual(lida.exercicios.map(e => e.id), ['meu-ex'])
})

test('lerPacoteTreino: recusa o que nao e treino do app', () => {
  assert.throws(() => lerPacoteTreino({ app: 'outro' }))
  assert.throws(() => lerPacoteTreino({ app: 'onemore', tipo: 'semana', rotinas: [] }))
})

/**
 * Treino de amigo entra como copia: id novo (pra editar sem mexer no de quem
 * mandou, e receber de novo nao sobrescrever a copia ajustada), no fim da
 * lista e sem roubar o dia de um treino que a pessoa ja tem.
 */
test('rotinasParaAdicionar: ids novos, no fim da lista, so nos dias livres', () => {
  const ativas = [{ dias: [1, 3], ordem: 0 }, { dias: [5], ordem: 1 }]
  const novas = rotinasParaAdicionar(
    { rotinas: [rotina('x', { dias: [1, 2], ordem: 0 }), rotina('y', { dias: [2, 4], ordem: 1 })] },
    ativas, 1000, novoId,
  )
  assert.ok(novas.every(r => r.id.startsWith('novo-')))
  assert.deepEqual(novas.map(r => r.ordem), [2, 3])
  assert.deepEqual(novas.map(r => r.dias), [[2], [4]])
  assert.ok(novas.every(r => r.arquivada === 0 && r.atualizadoEm === 1000))
})

test('comIdsNovos: troca so o id das rotinas', () => {
  const s = comIdsNovos({ nome: 'X', rotinas: [rotina('a')], exercicios: [meuEx] }, novoId)
  assert.notEqual(s.rotinas[0].id, 'a')
  assert.equal(s.rotinas[0].nome, 'Treino a')
  assert.deepEqual(s.exercicios, [meuEx])
})

/* ---------- dieta ---------- */

const minhaMarmita = {
  id: 'marmita', nome: 'Marmita', categoria: 'Pratos', kcal: 150, prot: 12, carb: 15, gord: 4,
  unidadeBase: 'g', medidas: [{ nome: 'pote', gramas: 300 }], custom: true, favorito: true, atualizadoEm: 1,
}
const arroz = { id: 'arroz', nome: 'Arroz', categoria: 'Grãos', kcal: 130, prot: 2.5, carb: 28, gord: 0.3, unidadeBase: 'g', medidas: [], atualizadoEm: 0 }
const refeicoes = [
  { nome: 'Almoço', horario: '12:00', ordem: 0, itens: [
    { alimentoId: 'arroz', qtd: 150, medida: 'g', gramas: 150 },
    { alimentoId: 'marmita', qtd: 1, medida: 'pote', gramas: 300 },
  ] },
  { nome: 'Jantar', horario: '20:00', ordem: 1, itens: [] },
]

test('pacote de dieta: leva so os alimentos criados que o cardapio usa, sem favorito', () => {
  const p = pacoteDeDieta('Cutting', refeicoes, [minhaMarmita, arroz, { ...minhaMarmita, id: 'outro' }],
    { kcal: 2100, prot: 160, carb: 200, gord: 60 })
  assert.deepEqual(p.alimentos.map(a => a.id), ['marmita'])
  assert.equal(p.alimentos[0].favorito, undefined)
  assert.equal(problemaNoPacote('dieta', JSON.parse(JSON.stringify(p))), null)
})

test('lerPacoteDieta: ida e volta, com metas', () => {
  const p = JSON.parse(JSON.stringify(pacoteDeDieta('Cutting', refeicoes, [minhaMarmita], { kcal: 2100, prot: 160, carb: 200, gord: 60 })))
  const lida = lerPacoteDieta(p)
  assert.equal(lida.nome, 'Cutting')
  assert.deepEqual(lida.refeicoes.map(r => [r.nome, r.horario, r.itens.length]), [['Almoço', '12:00', 2], ['Jantar', '20:00', 0]])
  assert.deepEqual(lida.metas, { kcal: 2100, prot: 160, carb: 200, gord: 60 })
  assert.equal(lida.alimentos[0].medidas[0].gramas, 300)
})

test('lerPacoteDieta: item estragado cai, horario estranho vira meio-dia, meta absurda nao entra', () => {
  const lida = lerPacoteDieta({
    app: 'onemore', tipo: 'dieta', nome: 'X',
    refeicoes: [{ nome: 'A', horario: '99:99', itens: [
      { alimentoId: 'arroz', gramas: 100 }, { alimentoId: '', gramas: 50 }, { alimentoId: 'arroz', gramas: 'muito' }, null,
    ] }],
    metas: { kcal: 50 },
  })
  assert.equal(lida.refeicoes[0].horario, '12:00')
  assert.equal(lida.refeicoes[0].itens.length, 1)
  assert.deepEqual(lida.refeicoes[0].itens[0], { alimentoId: 'arroz', qtd: 100, medida: 'g', gramas: 100 })
  assert.equal(lida.metas, undefined)
})

test('lerPacoteDieta: recusa o que nao e dieta', () => {
  assert.throws(() => lerPacoteDieta({ app: 'onemore', tipo: 'semana' }))
  assert.throws(() => lerPacoteDieta({ app: 'onemore', tipo: 'dieta', refeicoes: [] }))
  assert.throws(() => lerPacoteDieta(null))
})
