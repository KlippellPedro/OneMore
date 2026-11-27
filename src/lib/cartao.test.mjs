import test from 'node:test'
import assert from 'node:assert/strict'
import {
  montarCartao, treinosNaSemana, gradeDeDias, segundaDe, quandoFoi, haQuanto, codigoDoTexto, paraIso,
} from './cartao.ts'
import { validarCartao } from '../../servidor/amigos.js'

const HOJE = '2026-11-27' // sexta
const ts = (iso, hora = 18) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d, hora).getTime() }
const serie = (extra = {}) => ({ exercicioId: 'supino', serie: 1, reps: 10, carga: 60, feito: true, ...extra })
const sessao = (id, dia, extra = {}) => ({
  id, nome: `Treino ${id}`, inicio: ts(dia), fim: ts(dia) + 55 * 60000,
  series: [serie(), serie({ serie: 2, reps: 8 })], concluida: 1, atualizadoEm: 0, ...extra,
})
const melhor = (exercicioId, recordeCarga, recordeReps = 5) => ({
  exercicioId, recordeCarga, recordeReps, recordeVolume: 0, ultimaCarga: 0, ultimaReps: 0, ultimaEm: 0,
})
const NOMES = { supino: 'Supino reto', agacha: 'Agachamento', terra: 'Levantamento terra', rosca: 'Rosca direta' }

const entrada = (extra = {}) => ({
  perfil: { nome: 'Pedro', xp: 4200.7, streak: 6, melhorStreak: 21, ultimoDiaAtivo: '2026-11-26', metaTreinosSemana: 4 },
  sessoes: [],
  treinos: 87,
  prs: 31,
  melhores: [],
  nomeDoExercicio: id => NOMES[id],
  hoje: HOJE,
  ...extra,
})

test('montarCartao: so treino concluido e com serie de trabalho conta', () => {
  const c = montarCartao(entrada({
    sessoes: [
      sessao('a', '2026-11-26'),
      sessao('aberto', '2026-11-25', { concluida: 0 }),
      sessao('so-aquecimento', '2026-11-24', { series: [serie({ aquecimento: true })] }),
      sessao('nada-feito', '2026-11-23', { series: [serie({ feito: false })] }),
    ],
  }))
  assert.deepEqual(c.dias, ['2026-11-26'])
  assert.deepEqual(c.ultimos.map(u => u.nome), ['Treino a'])
})

test('montarCartao: numeros do ultimo treino (series, volume, minutos)', () => {
  const c = montarCartao(entrada({ sessoes: [sessao('a', '2026-11-26')] }))
  assert.deepEqual(c.ultimos[0], { nome: 'Treino a', dia: '2026-11-26', series: 2, volume: 60 * 10 + 60 * 8, minutos: 55 })
})

test('montarCartao: dois treinos no mesmo dia sao um dia so; os mais novos primeiro; no maximo 5', () => {
  const dias = ['2026-11-26', '2026-11-26', '2026-11-24', '2026-11-20', '2026-11-18', '2026-11-16', '2026-11-12']
  const c = montarCartao(entrada({ sessoes: dias.map((d, i) => sessao(String(i), d, { inicio: ts(d, 8 + i) })) }))
  assert.deepEqual(c.dias, ['2026-11-26', '2026-11-24', '2026-11-20', '2026-11-18', '2026-11-16', '2026-11-12'])
  assert.equal(c.ultimos.length, 5)
  assert.equal(c.ultimos[0].dia, '2026-11-26')
})

test('montarCartao: dias fora da janela de 35 dias ficam de fora', () => {
  const c = montarCartao(entrada({ sessoes: [sessao('velho', '2026-10-01'), sessao('novo', '2026-11-26')] }))
  assert.deepEqual(c.dias, ['2026-11-26'])
  // mas o treino velho ainda vale como "ultimo treino" se for dos 5 mais recentes
  assert.equal(c.ultimos.length, 2)
})

test('montarCartao: as 3 maiores cargas, com nome do exercicio', () => {
  const c = montarCartao(entrada({
    melhores: [melhor('supino', 90), melhor('agacha', 140, 3), melhor('terra', 180, 1), melhor('rosca', 20, 10),
      melhor('sumiu', 500), melhor('zero', 0)],
  }))
  assert.deepEqual(c.recordes, [
    { nome: 'Levantamento terra', carga: 180, reps: 1 },
    { nome: 'Agachamento', carga: 140, reps: 3 },
    { nome: 'Supino reto', carga: 90, reps: 5 },
  ])
})

/**
 * O que importa de verdade: o cartao nao tem por onde carregar dado de saude.
 * Se algum dia alguem acrescentar um campo aqui, este teste avisa.
 */
test('montarCartao: so os campos do cartao - nada de peso, dieta, glicemia ou e-mail', () => {
  const c = montarCartao(entrada({
    perfil: { ...entrada().perfil, pesoKg: 82, diabetesTipo1: true, metaKcal: 2400, restricoes: ['lactose'] },
  }))
  assert.deepEqual(Object.keys(c).sort(), [
    'dias', 'melhorStreak', 'metaSemana', 'nome', 'prs', 'recordes', 'streak', 'treinos', 'ultimoDiaAtivo', 'ultimos', 'v', 'xp',
  ])
})

/**
 * O app e o servidor validam o cartao cada um do seu lado. Se divergirem, o
 * servidor corta calado e o amigo ve outra coisa. O cartao montado aqui tem que
 * passar intacto pela validacao de la.
 */
test('montarCartao -> validarCartao do servidor: passa intacto', () => {
  const c = montarCartao(entrada({
    perfil: { ...entrada().perfil, nome: '  Pedro com espaco  ' },
    sessoes: [sessao('a', '2026-11-26', { nome: '  Treino A - Peito  ' }), sessao('b', '2026-11-24')],
    melhores: [melhor('supino', 92.5), melhor('agacha', 140.25, 3)],
  }))
  assert.deepEqual(validarCartao(JSON.parse(JSON.stringify(c))), c)
})

test('montarCartao: sem nome vira Jogador', () => {
  assert.equal(montarCartao(entrada({ perfil: { ...entrada().perfil, nome: '   ' } })).nome, 'Jogador')
})

/* ---------- leitura ---------- */

test('segundaDe: a semana comeca na segunda, e domingo e o fim dela', () => {
  assert.equal(segundaDe('2026-11-27'), '2026-11-23') // sexta
  assert.equal(segundaDe('2026-11-23'), '2026-11-23') // segunda
  assert.equal(segundaDe('2026-11-29'), '2026-11-23') // domingo
})

test('treinosNaSemana: conta pela data de quem LE - cartao velho nao mostra a semana passada como esta', () => {
  const c = { dias: ['2026-11-26', '2026-11-24', '2026-11-20', '2026-11-18'] }
  assert.equal(treinosNaSemana(c, '2026-11-27'), 2)
  assert.equal(treinosNaSemana(c, '2026-12-01'), 0)
})

test('gradeDeDias: 4 semanas de segunda a domingo, terminando na semana de hoje', () => {
  const g = gradeDeDias({ dias: ['2026-11-26', '2026-11-02'] }, HOJE)
  assert.equal(g.length, 4)
  assert.ok(g.every(s => s.length === 7))
  assert.equal(g[0][0].dia, '2026-11-02')
  assert.equal(g[3][6].dia, '2026-11-29')
  assert.ok(g[0][0].treinou)
  assert.ok(g[3][3].treinou) // quinta 26
  assert.ok(g[3][4].hoje)
  assert.ok(g[3][5].futuro && g[3][6].futuro)
})

test('quandoFoi e haQuanto falam como gente', () => {
  assert.equal(quandoFoi('2026-11-27', HOJE), 'hoje')
  assert.equal(quandoFoi('2026-11-26', HOJE), 'ontem')
  assert.equal(quandoFoi('2026-11-24', HOJE), 'há 3 dias')
  assert.equal(quandoFoi('2026-11-02', HOJE), '02/11')
  const agora = Date.UTC(2026, 10, 27, 12)
  assert.equal(haQuanto(agora - 20_000, agora), 'agora')
  assert.equal(haQuanto(agora - 5 * 60000, agora), 'há 5 min')
  assert.equal(haQuanto(agora - 3 * 3600_000, agora), 'há 3 h')
  assert.equal(haQuanto(agora - 30 * 3600_000, agora), 'ontem')
  assert.equal(haQuanto(agora - 4 * 86400_000, agora), 'há 4 dias')
})

test('codigoDoTexto: aceita o link inteiro colado, ou so o codigo', () => {
  assert.equal(codigoDoTexto('https://onemore.app/#/amigos?convite=K7Q2-XP9M'), 'K7Q2-XP9M')
  assert.equal(codigoDoTexto('Me adiciona: https://x.y/#/amigos?convite=K7Q2-XP9M\nOu digite...'), 'K7Q2-XP9M')
  assert.equal(codigoDoTexto('  k7q2-xp9m '), 'k7q2-xp9m')
})

test('paraIso usa o dia local, nao o UTC', () => {
  assert.equal(paraIso(new Date(2026, 10, 27, 23, 30)), '2026-11-27')
})
