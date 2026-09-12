import test from 'node:test'
import assert from 'node:assert/strict'
import io from 'node:fs'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

function fontes(dir = RAIZ, saida = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) { fontes(caminho, saida); continue }
    if (/\.tsx?$/.test(nome) && !nome.endsWith('.d.ts')) saida.push(caminho)
  }
  return saida
}

/** Tabelas que viajam na sincronizacao, lidas do proprio esquema. */
const esquema = io.readFileSync(join(RAIZ, 'db/index.ts'), 'utf8')
const SINCRONIZADAS = [
  ...esquema.match(/export type TabelaSync =([\s\S]*?)(?:\r?\n){2}/)[1].matchAll(/'(\w+)'/g),
].map(m => m[1]).concat('perfil')

/**
 * Tira comentario antes de varrer: estes testes citam o padrao errado no
 * proprio texto que explica por que ele e errado, e sem isto o comentario se
 * acusa sozinho.
 */
const semComentario = txt =>
  txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** Pega o texto de uma chamada a partir do "(", equilibrando parenteses. */
function chamada(texto, inicio) {
  let nivel = 0
  for (let i = inicio; i < texto.length; i++) {
    if (texto[i] === '(') nivel++
    else if (texto[i] === ')' && --nivel === 0) return texto.slice(inicio, i + 1)
  }
  return texto.slice(inicio)
}

/**
 * Edicao sem carimbo nao se propaga. A fusao compara `atualizadoEm` de cada
 * linha; quem grava sem mexer nele deixa a linha com a cara de velha, e a
 * copia do outro aparelho ganha - o favorito que voce marcou aqui volta
 * desmarcado depois de sincronizar, sem erro nenhum na tela.
 */
test('todo update em tabela sincronizada carimba atualizadoEm', () => {
  const faltando = []
  for (const arquivo of fontes()) {
    const txt = semComentario(io.readFileSync(arquivo, 'utf8'))
    for (const tabela of SINCRONIZADAS) {
      const alvo = `db.${tabela}.update(`
      let i = -1
      while ((i = txt.indexOf(alvo, i + 1)) >= 0) {
        const c = chamada(txt, i + alvo.length - 1)
        if (!c.includes('atualizadoEm')) {
          faltando.push(`${relative(RAIZ, arquivo)}: db.${tabela}.update${c.slice(0, 60)}`)
        }
      }
    }
  }
  assert.deepEqual(faltando, [])
})

/**
 * Apagar sem lapide nao se propaga: o registro some daqui e volta inteiro do
 * outro aparelho na proxima fusao. Quem apaga linha sincronizada tem que usar
 * apagarLinha/apagarLinhas, que gravam a lapide na mesma operacao.
 */
test('nada apaga tabela sincronizada por fora do apagarLinha', () => {
  const crus = []
  for (const arquivo of fontes()) {
    // db/index.ts e onde apagarLinha/apagarLinhas moram - e o unico que pode
    if (relative(RAIZ, arquivo) === join('db', 'index.ts')) continue
    const txt = semComentario(io.readFileSync(arquivo, 'utf8'))
    for (const tabela of SINCRONIZADAS) {
      for (const op of ['clear()', 'delete(', 'bulkDelete(']) {
        if (txt.includes(`db.${tabela}.${op}`)) crus.push(`${relative(RAIZ, arquivo)}: db.${tabela}.${op}`)
      }
    }
  }
  assert.deepEqual(crus, [])
})
