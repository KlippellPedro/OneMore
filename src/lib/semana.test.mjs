import test from 'node:test'
import assert from 'node:assert/strict'
import {
  retratoDaSemana, mesmaSemana, resumoSemana, automaticasDemais, planoDeRestauracao,
  paraArquivo, lerArquivoSemana,
} from './semana.ts'

const item = (exercicioId, extra = {}) => ({ exercicioId, series: 3, repsAlvo: '8-12', descansoSeg: 90, ...extra })
const rotina = (id, extra = {}) => ({
  id, nome: `Treino ${id}`, cor: '#8b6dd6', itens: [item('ex_supino')], dias: [],
  ordem: 0, arquivada: 0, atualizadoEm: 1, ...extra,
})

test('retrato leva so as rotinas ativas, na ordem, sem carimbo', () => {
  const r = retratoDaSemana([
    rotina('b', { ordem: 2, dias: [3] }),
    rotina('velha', { arquivada: 1 }),
    rotina('a', { ordem: 1, dias: [1] }),
  ], [])
  assert.deepEqual(r.rotinas.map(x => x.id), ['a', 'b'])
  assert.equal('atualizadoEm' in r.rotinas[0], false)
  assert.equal('arquivada' in r.rotinas[0], false)
})

test('retrato copia: editar a rotina depois nao muda a semana salva', () => {
  const original = rotina('a', { dias: [1] })
  const r = retratoDaSemana([original], [])
  original.itens[0].series = 9
  original.dias.push(4)
  assert.equal(r.rotinas[0].itens[0].series, 3)
  assert.deepEqual(r.rotinas[0].dias, [1])
})

test('retrato leva os exercicios criados pela pessoa que as rotinas usam, sem foto embutida', () => {
  const r = retratoDaSemana([rotina('a', { itens: [item('usr_1'), item('ex_supino')] })], [
    { id: 'usr_1', nome: 'Meu', grupo: 'peito', equipamento: 'outro', execucao: [], custom: true, imagemUrl: 'data:image/png;base64,AAAA', atualizadoEm: 1 },
    { id: 'usr_2', nome: 'Nao usado', grupo: 'peito', equipamento: 'outro', execucao: [], custom: true, atualizadoEm: 1 },
    { id: 'ex_supino', nome: 'Supino', grupo: 'peito', equipamento: 'barra', execucao: [], atualizadoEm: 0 },
  ])
  assert.deepEqual(r.exercicios.map(e => e.id), ['usr_1'])
  assert.equal(r.exercicios[0].imagemUrl, undefined)
})

test('mesmaSemana ignora carimbo e ordem do array, mas ve qualquer mudanca de treino', () => {
  const a = retratoDaSemana([rotina('a', { ordem: 0 }), rotina('b', { ordem: 1 })], [])
  const b = { rotinas: [...a.rotinas].reverse() }
  assert.equal(mesmaSemana(a, b), true)
  const c = retratoDaSemana([rotina('a', { ordem: 0, itens: [item('ex_supino', { series: 4 })] }), rotina('b', { ordem: 1 })], [])
  assert.equal(mesmaSemana(a, c), false)
  const d = retratoDaSemana([rotina('a', { ordem: 0, dias: [2] }), rotina('b', { ordem: 1 })], [])
  assert.equal(mesmaSemana(a, d), false)
})

test('resumo conta treinos, exercicios, series e diz o treino de cada dia', () => {
  const s = resumoSemana({ rotinas: [
    { ...rotina('a', { dias: [1, 4], itens: [item('x'), item('y', { series: 4 })] }) },
    { ...rotina('b', { dias: [2] }) },
  ] })
  assert.equal(s.treinos, 2)
  assert.equal(s.exercicios, 3)
  assert.equal(s.series, 10)
  assert.equal(s.porDia.get(4).id, 'a')
  assert.equal(s.porDia.get(2).id, 'b')
  assert.equal(s.porDia.has(0), false)
})

test('automaticas: so as velhas alem do limite saem, as salvas a mao nunca', () => {
  const semanas = [
    { id: 'm', auto: undefined, criadoEm: 0 },
    ...[1, 2, 3, 4, 5, 6, 7].map(n => ({ id: `a${n}`, auto: 'programa', criadoEm: n })),
  ]
  assert.deepEqual(automaticasDemais(semanas, 5).sort(), ['a1', 'a2'])
})

test('restaurar devolve as mesmas rotinas e arquiva as que nao fazem parte', () => {
  const atuais = [rotina('a'), rotina('nova'), rotina('arquivada', { arquivada: 1 })]
  const semana = retratoDaSemana([rotina('a', { dias: [1] }), rotina('apagada', { dias: [3] })], [])
  const p = planoDeRestauracao(atuais, semana, new Set(), 500)
  assert.deepEqual(p.gravar.map(r => r.id).sort(), ['a', 'apagada'])
  assert.ok(p.gravar.every(r => r.arquivada === 0 && r.atualizadoEm === 500))
  assert.deepEqual(p.arquivar, ['nova'])
})

test('restaurar recria so o exercicio que nao existe mais', () => {
  const semana = {
    rotinas: [rotina('a')],
    exercicios: [
      { id: 'usr_1', nome: 'A', grupo: 'peito', equipamento: 'outro', execucao: [], custom: true, atualizadoEm: 1 },
      { id: 'usr_2', nome: 'B', grupo: 'peito', equipamento: 'outro', execucao: [], custom: true, atualizadoEm: 1 },
    ],
  }
  const p = planoDeRestauracao([], semana, new Set(['usr_1']), 900)
  assert.deepEqual(p.exercicios.map(e => e.id), ['usr_2'])
  assert.equal(p.exercicios[0].atualizadoEm, 900)
})

test('arquivo da semana vai e volta igual', () => {
  const semana = retratoDaSemana([rotina('a', { dias: [1], descricao: 'Peito' }), rotina('b', { ordem: 1, dias: [3] })], [])
  const lida = lerArquivoSemana(JSON.parse(JSON.stringify(paraArquivo('Minha semana', semana))))
  assert.equal(lida.nome, 'Minha semana')
  assert.equal(mesmaSemana(lida, semana), true)
})

test('backup completo vira semana: so rotinas ativas e exercicios criados usados', () => {
  const backup = {
    app: 'onemore', versao: 1, criadoEm: '2026-11-20T10:00:00.000Z',
    dados: {
      rotinas: [rotina('a', { dias: [1], itens: [item('usr_1')] }), rotina('x', { arquivada: 1 })],
      exercicios: [
        { id: 'usr_1', nome: 'Meu', grupo: 'peito', equipamento: 'halter', execucao: ['a'], custom: true, atualizadoEm: 3 },
        { id: 'ex_supino', nome: 'Supino', grupo: 'peito', equipamento: 'barra', execucao: [], atualizadoEm: 0 },
      ],
      sessoes: [{ id: 's1' }],
    },
  }
  const lida = lerArquivoSemana(backup)
  assert.deepEqual(lida.rotinas.map(r => r.id), ['a'])
  assert.deepEqual(lida.exercicios.map(e => e.id), ['usr_1'])
  assert.equal(lida.nome, 'Do backup de 20/11/2026')
})

test('arquivo estranho e recusado, e campo ruim e consertado', () => {
  assert.throws(() => lerArquivoSemana({ app: 'outro' }))
  assert.throws(() => lerArquivoSemana(null))
  assert.throws(() => lerArquivoSemana({ app: 'onemore', tipo: 'semana', rotinas: [{ nome: 'sem id' }] }))

  const lida = lerArquivoSemana({
    app: 'onemore', tipo: 'semana', nome: 'X',
    rotinas: [
      { id: 'a', nome: 'A', cor: 'red; background:url(x)', dias: [1, 1, 9, 'x'], ordem: 0,
        itens: [{ exercicioId: 'e1', series: 99, descansoSeg: -5 }, { exercicioId: 'e1' }, { series: 3 }] },
      { id: 'b', nome: 'B', dias: [1, 2], ordem: 1, itens: [] },
    ],
  })
  const [a, b] = lida.rotinas
  assert.equal(a.cor, '#8b6dd6')
  assert.deepEqual(a.dias, [1])
  assert.equal(a.itens.length, 1, 'exercicio repetido e item sem exercicio saem')
  assert.equal(a.itens[0].series, 20)
  assert.equal(a.itens[0].descansoSeg, 0)
  assert.equal(a.itens[0].repsAlvo, '8-12')
  assert.deepEqual(b.dias, [2], 'o dia ja ocupado pelo primeiro treino sai do segundo')
})
