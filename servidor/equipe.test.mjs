import test from 'node:test'
import assert from 'node:assert/strict'
import { validarPermissoes, problemaNoPacote, dadosDoAluno, LIMITE_PACOTE } from './equipe.js'

/* ---------- permissoes ---------- */

test('validarPermissoes: treinos sempre; corpo e dieta so com true de verdade (consentimento nao vem marcado)', () => {
  assert.deepEqual(validarPermissoes(undefined), { treinos: true, corpo: false, dieta: false })
  assert.deepEqual(validarPermissoes({ corpo: 'sim', dieta: 1, treinos: false }), { treinos: true, corpo: false, dieta: false })
  assert.deepEqual(validarPermissoes({ corpo: true, dieta: true, glicemia: true }), { treinos: true, corpo: true, dieta: true })
})

/* ---------- pacote ---------- */

const rotina = (extra = {}) => ({ id: 'r1', nome: 'Treino A', itens: [{ exercicioId: 'supino', series: 3 }], ...extra })
const treino = (extra = {}) => ({ app: 'onemore', tipo: 'semana', versao: 1, nome: 'ABC', rotinas: [rotina()], exercicios: [], ...extra })
const dieta = (extra = {}) => ({
  app: 'onemore', tipo: 'dieta', versao: 1, nome: 'Cutting',
  refeicoes: [{ nome: 'Almoço', horario: '12:00', itens: [{ alimentoId: 'arroz', qtd: 100, medida: 'g', gramas: 100 }] }],
  ...extra,
})

test('problemaNoPacote: treino e dieta bons passam', () => {
  assert.equal(problemaNoPacote('treino', treino()), null)
  assert.equal(problemaNoPacote('dieta', dieta()), null)
})

test('problemaNoPacote: recusa tipo trocado, conteudo de fora do app e lista vazia ou enorme', () => {
  assert.ok(problemaNoPacote('outro', treino()))
  assert.ok(problemaNoPacote('treino', dieta()))
  assert.ok(problemaNoPacote('dieta', treino()))
  assert.ok(problemaNoPacote('treino', { ...treino(), app: 'outro' }))
  assert.ok(problemaNoPacote('treino', treino({ rotinas: [] })))
  assert.ok(problemaNoPacote('treino', treino({ rotinas: Array.from({ length: 41 }, () => rotina()) })))
  assert.ok(problemaNoPacote('treino', treino({ rotinas: [rotina({ itens: Array.from({ length: 61 }, () => ({})) })] })))
  assert.ok(problemaNoPacote('dieta', dieta({ refeicoes: Array.from({ length: 13 }, () => ({ itens: [] })) })))
  assert.ok(problemaNoPacote('treino', null))
})

test('problemaNoPacote: tem teto de tamanho', () => {
  assert.ok(problemaNoPacote('treino', treino({ descricao: 'x'.repeat(LIMITE_PACOTE) })))
})

/* ---------- o que o treinador ve ---------- */

const AGORA = Date.UTC(2026, 10, 27, 12)
const DIA = 86400000
const backup = () => ({
  perfil: [{
    id: 'me', nome: 'Ana', objetivo: 'bulking', metaTreinosSemana: 4, xp: 3000, streak: 3, melhorStreak: 9,
    sexo: 'F', idade: 29, alturaCm: 165, pesoKg: 61, metaKcal: 2300, metaProt: 130,
    diabetesTipo1: true, restricoes: ['lactose'], hipertensao: true, lembretes: { ativo: true },
  }],
  sessoes: [
    { id: 's1', inicio: AGORA - 2 * DIA, concluida: 1, series: [{ exercicioId: 'meu-ex', carga: 40, reps: 10, feito: true }] },
    { id: 's-aberta', inicio: AGORA - DIA, concluida: 0, series: [] },
    { id: 's-velha', inicio: AGORA - 400 * DIA, concluida: 1, series: [] },
  ],
  rotinas: [
    { id: 'r1', nome: 'A', arquivada: 0, itens: [{ exercicioId: 'supino' }] },
    { id: 'r-arq', nome: 'Velha', arquivada: 1, itens: [] },
  ],
  exercicios: [
    { id: 'meu-ex', nome: 'Meu exercicio', custom: true, imagemUrl: 'data:image/png;base64,AAAA' },
    { id: 'outro-custom', nome: 'Nao usado', custom: true },
    { id: 'supino', nome: 'Supino' },
  ],
  corpo: [{ id: 'c1', data: '2026-11-20', peso: 61.2 }],
  planos: [{ id: 'p1', nome: 'Almoço', itens: [{ alimentoId: 'meu-alimento', gramas: 100 }] }],
  dieta: [
    { id: 'd1', data: '2026-11-26', alimentoId: 'arroz', gramas: 150 },
    { id: 'd-velho', data: '2026-08-01', alimentoId: 'arroz', gramas: 150 },
  ],
  agua: [{ id: 'a1', data: '2026-11-26', ml: 2000 }],
  alimentos: [{ id: 'meu-alimento', nome: 'Marmita', custom: true }, { id: 'arroz', nome: 'Arroz' }],
  glicemia: [{ id: 'g1', valor: 140 }],
  semanas: [{ id: 'sem1' }],
})

test('dadosDoAluno: so treino - nada de corpo, dieta, saude ou glicemia', () => {
  const d = dadosDoAluno(backup(), {}, AGORA)
  assert.deepEqual(Object.keys(d).sort(), ['exercicios', 'perfil', 'rotinas', 'sessoes'])
  assert.deepEqual(Object.keys(d.perfil).sort(), ['melhorStreak', 'metaTreinosSemana', 'nome', 'objetivo', 'streak', 'xp'])
  // sessao aberta e sessao de mais de um ano ficam de fora
  assert.deepEqual(d.sessoes.map(s => s.id), ['s1'])
  assert.deepEqual(d.rotinas.map(r => r.id), ['r1'])
  // so o exercicio criado pela pessoa E usado, e sem a foto embutida
  assert.deepEqual(d.exercicios.map(e => e.id), ['meu-ex'])
  assert.equal(d.exercicios[0].imagemUrl, undefined)
})

test('dadosDoAluno: corpo liberado traz medidas e dados do corpo do perfil', () => {
  const d = dadosDoAluno(backup(), { corpo: true }, AGORA)
  assert.deepEqual(d.corpo.map(c => c.id), ['c1'])
  assert.equal(d.perfil.pesoKg, 61)
  assert.equal(d.perfil.alturaCm, 165)
  assert.equal(d.dieta, undefined)
  assert.equal(d.perfil.metaKcal, undefined)
})

test('dadosDoAluno: dieta liberada traz plano, 60 dias de registro, agua, metas e so os alimentos criados que aparecem', () => {
  const d = dadosDoAluno(backup(), { dieta: true }, AGORA)
  assert.deepEqual(d.dieta.map(r => r.id), ['d1'])
  assert.deepEqual(d.planos.map(p => p.id), ['p1'])
  assert.deepEqual(d.agua.map(a => a.id), ['a1'])
  assert.deepEqual(d.alimentos.map(a => a.id), ['meu-alimento'])
  assert.equal(d.perfil.metaKcal, 2300)
  assert.equal(d.corpo, undefined)
})

/**
 * Mesmo com tudo liberado, saude (diabetes, restricoes, hipertensao),
 * glicemia e o resto do backup nunca chegam ao treinador.
 */
test('dadosDoAluno: com tudo liberado, saude e glicemia continuam de fora', () => {
  const d = dadosDoAluno(backup(), { corpo: true, dieta: true }, AGORA)
  const texto = JSON.stringify(d)
  for (const proibido of ['diabetesTipo1', 'restricoes', 'hipertensao', 'lembretes', 'glicemia', 'valor":140', 'sem1']) {
    assert.ok(!texto.includes(proibido), proibido)
  }
})

test('dadosDoAluno: backup vazio ou estranho nao quebra', () => {
  for (const ruim of [null, undefined, {}, { perfil: 'x', sessoes: 5 }]) {
    const d = dadosDoAluno(ruim, { corpo: true, dieta: true }, AGORA)
    assert.deepEqual(d.sessoes, [])
    assert.deepEqual(d.perfil, {})
  }
})
