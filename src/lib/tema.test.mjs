import test from 'node:test'
import assert from 'node:assert/strict'
import io from 'node:fs'
import {
  variaveisDoTema, corDoDia, temaDe, hexParaOklch, oklchParaHex, corValida,
  TEMA_PADRAO, CORES_TEMA, COR_PADRAO,
} from './tema.ts'

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const lum = hex => {
  const [r, g, b] = rgb(hex).map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

test('o roxo padrao sai igual aos tokens do index.css', () => {
  // quem nunca mexeu no tema nao pode ver o app mudar de cor
  const css = io.readFileSync(new URL('../index.css', import.meta.url), 'utf8')
  const vars = variaveisDoTema(COR_PADRAO, TEMA_PADRAO)
  for (const token of ['bg', 'bg-soft', 'surface', 'surface-2', 'line', 'txt', 'muted', 'accent', 'accent-soft', 'accent-deep']) {
    const original = css.match(new RegExp(`--color-${token}: (#[0-9a-f]{6});`))?.[1]
    assert.ok(original, `token ${token} no index.css`)
    const diferenca = Math.max(...rgb(vars[`--color-${token}`]).map((v, i) => Math.abs(v - rgb(original)[i])))
    assert.ok(diferenca <= 4, `${token}: ${vars[`--color-${token}`]} vs ${original}`)
  }
})

test('ida e volta hex -> oklch -> hex nao muda a cor', () => {
  for (const c of [...CORES_TEMA, '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff']) {
    assert.equal(oklchParaHex(...hexParaOklch(c)), c)
  }
})

const CORES_DIFICEIS = [...CORES_TEMA, '#ffff00', '#00ffff', '#ffffff', '#000000', '#00ff00', '#808080']

test('texto branco no botao (accent-deep) tem contraste 4.5:1 em qualquer cor', () => {
  for (const cor of CORES_DIFICEIS) {
    const fundo = variaveisDoTema(cor, TEMA_PADRAO)['--color-accent-deep']
    assert.ok(contraste('#ffffff', fundo) >= 4.5, `${cor} -> ${fundo}`)
  }
})

test('texto e texto apagado continuam legiveis sobre o fundo e o card, em todo fundo', () => {
  for (const cor of CORES_DIFICEIS) {
    for (const fundo of ['tingido', 'neutro', 'preto']) {
      const v = variaveisDoTema(cor, { fundo, secoesColoridas: true })
      assert.ok(contraste(v['--color-txt'], v['--color-surface']) >= 7, `${cor}/${fundo} txt`)
      assert.ok(contraste(v['--color-muted'], v['--color-surface']) >= 4.5, `${cor}/${fundo} muted`)
      assert.ok(contraste(v['--color-accent'], v['--color-bg']) >= 3, `${cor}/${fundo} accent`)
    }
  }
})

test('fundo preto e preto de verdade (tela OLED desliga o pixel)', () => {
  assert.equal(variaveisDoTema('#4fa385', { fundo: 'preto', secoesColoridas: true })['--color-bg'], '#000000')
})

test('cor invalida cai no roxo padrao em vez de quebrar a pagina', () => {
  const padrao = variaveisDoTema(COR_PADRAO, TEMA_PADRAO)
  assert.deepEqual(variaveisDoTema('roxo', TEMA_PADRAO), padrao)
  assert.deepEqual(variaveisDoTema(undefined, TEMA_PADRAO), padrao)
  assert.ok(!corValida('#fff') && corValida('#FFAA00'))
})

test('as mesmas variaveis existem em todo modo - voltar nao deixa valor velho preso', () => {
  const a = Object.keys(variaveisDoTema('#c96a4a', { fundo: 'preto', secoesColoridas: false })).sort()
  const b = Object.keys(variaveisDoTema('#c96a4a', { fundo: 'tingido', secoesColoridas: true })).sort()
  assert.deepEqual(a, b)
  const uniforme = variaveisDoTema('#c96a4a', { fundo: 'tingido', secoesColoridas: false })
  assert.equal(uniforme['--secao-dieta'], 'var(--color-accent)')
})

test('corDoDia: fixa ignora treino e dia', () => {
  const t = temaDe({ cor: '#4fa385' })
  assert.equal(corDoDia(t, { dia: 1, corRotinaDoDia: '#c96a4a', corTreinoAtivo: '#5a8cbf' }), '#4fa385')
})

test('corDoDia: modo treino usa o treino em andamento, depois a rotina do dia, depois a fixa', () => {
  const t = temaDe({ modo: 'treino', cor: '#4fa385' })
  assert.equal(corDoDia(t, { dia: 1, corRotinaDoDia: '#c96a4a', corTreinoAtivo: '#5a8cbf' }), '#5a8cbf')
  assert.equal(corDoDia(t, { dia: 1, corRotinaDoDia: '#c96a4a' }), '#c96a4a')
  // dia de descanso
  assert.equal(corDoDia(t, { dia: 0 }), '#4fa385')
})

test('corDoDia: modo semana usa a cor do dia, e a fixa onde nao escolheu', () => {
  const t = temaDe({ modo: 'semana', cor: '#4fa385', semana: [null, '#c96a4a', '#5a8cbf'] })
  assert.equal(corDoDia(t, { dia: 1 }), '#c96a4a')
  assert.equal(corDoDia(t, { dia: 0 }), '#4fa385')
  assert.equal(corDoDia(t, { dia: 6 }), '#4fa385')
})

test('temaDe completa perfil sem tema (ou com tema de versao antiga)', () => {
  assert.deepEqual(temaDe(undefined), TEMA_PADRAO)
  assert.equal(temaDe({ modo: 'treino' }).fundo, 'tingido')
})
