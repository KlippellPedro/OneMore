import test from 'node:test'
import assert from 'node:assert/strict'
import { NOMES_MARCADOS, MARCADORES, MARCADORES_POR_ALIMENTO, marcadoresDe, PRESETS } from './marcadores.ts'
import { ALIMENTOS_SEED } from './seedAlimentos.ts'

const nomesDoCatalogo = new Set(ALIMENTOS_SEED.map(a => a.nome))
const idsDoCatalogo = new Set(ALIMENTOS_SEED.map(a => a.id))

test('todo alimento marcado existe no catalogo', () => {
  const fantasmas = []
  for (const [marcador, nomes] of Object.entries(NOMES_MARCADOS)) {
    for (const nome of nomes) if (!nomesDoCatalogo.has(nome)) fantasmas.push(`${marcador}: ${nome}`)
  }
  assert.deepEqual(fantasmas, [], 'nomes que nao existem no catalogo')
})

test('todo id derivado bate com um id real do catalogo', () => {
  const orfaos = Object.keys(MARCADORES_POR_ALIMENTO).filter(id => !idsDoCatalogo.has(id))
  assert.deepEqual(orfaos, [], 'ids gerados que nao existem')
})

test('todo marcador usado tem descricao', () => {
  for (const marcador of Object.keys(NOMES_MARCADOS)) {
    assert.ok(MARCADORES[marcador], `marcador sem descricao: ${marcador}`)
    assert.ok(MARCADORES[marcador].rotulo.length > 0)
  }
})

test('os presets so usam marcadores que existem', () => {
  for (const p of PRESETS) {
    for (const m of p.marcadores) assert.ok(MARCADORES[m], `${p.id} usa marcador inexistente: ${m}`)
  }
})

test('quem nao tem marcador nenhum devolve lista vazia', () => {
  assert.deepEqual(marcadoresDe('al_arroz-branco-cozido'), [])
  assert.deepEqual(marcadoresDe('al_nao-existe'), [])
})

test('casos que importam estao marcados certo', () => {
  assert.ok(marcadoresDe('al_leite-integral').includes('leite'))
  assert.ok(marcadoresDe('al_pao-frances').includes('gluten'))
  assert.ok(marcadoresDe('al_cerveja').includes('gluten'), 'cerveja tem cevada')
  assert.ok(marcadoresDe('al_shoyu').includes('gluten'), 'shoyu leva trigo')
  assert.ok(marcadoresDe('al_shoyu').includes('soja'))
  assert.ok(marcadoresDe('al_maionese').includes('ovo'))
  assert.ok(marcadoresDe('al_albumina').includes('ovo'), 'albumina e clara de ovo')
  assert.ok(marcadoresDe('al_aveia-em-flocos').includes('gluten'), 'contaminacao cruzada')
  assert.ok(marcadoresDe('al_pizza-de-mussarela').includes('lactose'))
  assert.ok(marcadoresDe('al_pizza-de-mussarela').includes('gluten'))
  // arroz, fruta e verdura nao podem ter marcador nenhum
  for (const id of ['al_arroz-branco-cozido', 'al_banana-prata', 'al_brocolis-cozido', 'al_azeite-de-oliva']) {
    assert.deepEqual(marcadoresDe(id), [], id)
  }
})

test('sem lactose NAO some pra quem tem intolerancia - mas some pra vegano', () => {
  for (const id of ['al_leite-sem-lactose-integral', 'al_iogurte-sem-lactose']) {
    const m = marcadoresDe(id)
    assert.ok(!m.includes('lactose'), `${id} nao pode ter lactose`)
    assert.ok(m.includes('leite'), `${id} continua sendo derivado de leite`)
  }
})

test('todo alimento com lactose tambem conta como derivado de leite', () => {
  const falhas = Object.entries(MARCADORES_POR_ALIMENTO)
    .filter(([, ms]) => ms.includes('lactose') && !ms.includes('leite'))
    .map(([id]) => id)
  assert.deepEqual(falhas, [])
})

test('os alimentos novos foram marcados', () => {
  assert.ok(marcadoresDe('al_file-de-merluza-grelhado').includes('peixe'))
  assert.ok(marcadoresDe('al_figado-bovino-grelhado').includes('carne'))
  assert.ok(marcadoresDe('al_ovo-de-codorna-cozido').includes('ovo'))
  assert.ok(marcadoresDe('al_proteina-de-soja-texturizada-hidratada').includes('soja'))
  assert.ok(marcadoresDe('al_pasta-de-castanha-de-caju').includes('castanhas'))
  assert.ok(marcadoresDe('al_queijo-coalho').includes('lactose'))
  // os novos carboidratos de mandioca sao naturalmente sem gluten
  for (const id of ['al_polvilho-doce', 'al_farinha-de-mandioca', 'al_quinoa-cozida', 'al_inhame-cozido']) {
    assert.ok(!marcadoresDe(id).includes('gluten'), id)
  }
})
