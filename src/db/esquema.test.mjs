import test from 'node:test'
import assert from 'node:assert/strict'
import io from 'node:fs'

const fonte = io.readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
const icones = io.readFileSync(new URL('../components/Icone.tsx', import.meta.url), 'utf8')

// codePointAt em vez de regex de faixa: dizer "acima de 127" e mais direto
// que uma classe negada, e nao esbarra na regra de caractere de controle
const temAcento = s => [...s].some(c => c.codePointAt(0) > 127)

/**
 * Isto ja quebrou o app DUAS vezes durante a acentuacao do texto de tela: os
 * valores dentro de .stores({}) sao nomes de INDICE do IndexedDB, nao texto.
 * "inicio" virou "início" e "concluida" virou "concluída", e o app inteiro
 * abriu em tela branca com SchemaError - o typecheck nao acusa nada disso.
 */
test('nenhum indice do Dexie tem acento', () => {
  const blocos = [...fonte.matchAll(/stores\(\{([\s\S]*?)\}\)/g)].map(m => m[1])
  assert.ok(blocos.length >= 5, 'deveria achar os blocos de schema')
  const ruins = []
  for (const b of blocos) {
    for (const m of b.matchAll(/'([^']*)'/g)) if (temAcento(m[1])) ruins.push(m[1])
  }
  assert.deepEqual(ruins, [], 'indice do IndexedDB precisa ser ASCII puro')
})

/** Mesmo motivo: a chave do icone e consultada por <Icone nome="..."> em ASCII. */
test('nenhuma chave de icone tem acento', () => {
  const chaves = [...icones.matchAll(/'([^']+)':\s*</g)].map(m => m[1])
  assert.ok(chaves.length >= 3)
  assert.deepEqual(chaves.filter(temAcento), [])
})

/** Caminho de modulo com acento nao resolve. */
test('nenhum import tem acento no caminho', () => {
  const arquivos = ['./index.ts', '../lib/sync.ts', '../lib/nutricao.ts', '../pages/Dieta.tsx']
  for (const a of arquivos) {
    const txt = io.readFileSync(new URL(a, import.meta.url), 'utf8')
    const caminhos = [...txt.matchAll(/from\s+'([^']+)'/g)].map(m => m[1])
    assert.deepEqual(caminhos.filter(temAcento), [], a)
  }
})

/**
 * O nome de tabela dentro do sync e indexado por `db[nome]`: errou uma letra e
 * `exportar()` estoura num `undefined.toArray()`. Pior, `sincronizarEmSilencio`
 * engole o erro - foi assim que `'sessões'` deixou a sincronizacao e o backup
 * mudos por inteiro, sem nada aparecer na tela. Nem typecheck nem lint pegam:
 * o acesso e por string. Este teste pega.
 */
test('toda tabela citada no sync existe no banco', () => {
  const sync = io.readFileSync(new URL('../lib/sync.ts', import.meta.url), 'utf8')
  const tabelas = [...fonte.matchAll(/^ {2}(\w+)!: Table/gm)].map(m => m[1])
  assert.ok(tabelas.length >= 10, 'deveria achar as tabelas do Dexie')

  const listas = [...sync.matchAll(/const (TABELAS\w*) = \[([\s\S]*?)\] as const/g)]
  assert.equal(listas.length, 2, 'deveria achar TABELAS e TABELAS_DERIVADAS')

  for (const [, nome, bloco] of listas) {
    const citadas = [...bloco.matchAll(/'([^']+)'/g)].map(m => m[1])
    assert.ok(citadas.length, `${nome} nao deveria estar vazia`)
    assert.deepEqual(citadas.filter(t => !tabelas.includes(t)), [], nome)
  }
})
