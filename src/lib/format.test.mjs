import test from 'node:test'
import assert from 'node:assert/strict'
import { linkSeguro, imagemSegura, youtubeId, medidaPlural } from './format.ts'

test('linkSeguro: so http(s) passa - javascript:, data: e file: viram nada', () => {
  assert.equal(linkSeguro('https://youtu.be/abcdefghijk'), 'https://youtu.be/abcdefghijk')
  assert.equal(linkSeguro('  http://exemplo.com/video  '), 'http://exemplo.com/video')
  assert.equal(linkSeguro('javascript:alert(1)'), undefined)
  assert.equal(linkSeguro('JaVaScRiPt:alert(1)'), undefined)
  assert.equal(linkSeguro('data:text/html,<b>oi</b>'), undefined)
  assert.equal(linkSeguro('file:///etc/passwd'), undefined)
  assert.equal(linkSeguro('youtube.com/watch?v=x'), undefined, 'sem esquema nao e link')
  assert.equal(linkSeguro(''), undefined)
  assert.equal(linkSeguro(undefined), undefined)
})

test('imagemSegura: aceita foto embutida do celular e https, recusa SVG e script', () => {
  assert.equal(imagemSegura('data:image/jpeg;base64,AAAA'), 'data:image/jpeg;base64,AAAA')
  assert.equal(imagemSegura('https://exemplo.com/a.png'), 'https://exemplo.com/a.png')
  assert.equal(imagemSegura('data:image/svg+xml;base64,PHN2Zz4='), undefined, 'SVG pode carregar script')
  assert.equal(imagemSegura('javascript:alert(1)'), undefined)
})

test('youtubeId: acha o id nos formatos comuns de link', () => {
  assert.equal(youtubeId('https://www.youtube.com/watch?v=abcdefghijk'), 'abcdefghijk')
  assert.equal(youtubeId('https://youtu.be/abcdefghijk?t=10'), 'abcdefghijk')
  assert.equal(youtubeId('https://youtube.com/shorts/abcdefghijk'), 'abcdefghijk')
  assert.equal(youtubeId('https://vimeo.com/123'), null)
})

test('medidaPlural: concorda com a quantidade, so a partir de 2', () => {
  assert.equal(medidaPlural('unidade', 3), 'unidades')
  assert.equal(medidaPlural('unidade média', 2), 'unidades médias')
  assert.equal(medidaPlural('colher de sopa', 3.5), 'colheres de sopa')
  assert.equal(medidaPlural('colher de sopa', 1.5), 'colher de sopa', '1,5 colher: singular, como se fala')
  assert.equal(medidaPlural('colher de sopa', 1), 'colher de sopa')
  assert.equal(medidaPlural('prato (porção)', 2), 'pratos (porção)')
  assert.equal(medidaPlural('porção', 2), 'porções')
  assert.equal(medidaPlural('pegador', 2), 'pegadores')
  assert.equal(medidaPlural('filé médio', 2), 'filés médios')
  assert.equal(medidaPlural('copo americano', 2), 'copos americanos')
  assert.equal(medidaPlural('2 fatias', 3), '2 fatias', 'nome com numero fica')
  assert.equal(medidaPlural('g', 150), 'g')
})
