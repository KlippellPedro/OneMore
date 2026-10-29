/**
 * Tema de cor do app.
 *
 * A paleta inteira sai de UMA cor. Nao da pra so trocar o destaque: o fundo e
 * as superficies sao tingidos com o mesmo matiz do roxo original, e um verde
 * em cima de fundo roxo fica com cara de erro. Por isso tudo e calculado em
 * OKLCH (luminosidade, croma, matiz): mantem a luminosidade de cada token como
 * esta no index.css e troca so o matiz - o contraste fica igual em qualquer
 * cor, e o roxo padrao sai identico ao que sempre foi.
 *
 * Sem dependencia de proposito: o teste importa direto no Node. So
 * aplicarTema/restaurarTemaSalvo mexem no DOM, e so rodam no navegador.
 */

export type ModoTema = 'fixa' | 'treino' | 'semana'
export type FundoTema = 'tingido' | 'neutro' | 'preto'

export interface Tema {
  /**
   * fixa = sempre `cor`; treino = a cor da rotina do dia (ou do treino em
   * andamento); semana = uma cor escolhida pra cada dia da semana.
   */
  modo: ModoTema
  /** A cor fixa - e tambem a dos dias sem treino e sem cor escolhida. */
  cor: string
  /** Uma cor por dia, 0=Dom ... 6=Sab. So vale no modo semana. */
  semana?: (string | null)[]
  fundo: FundoTema
  /** false = Dieta, Progresso e o resto tambem na cor do tema. */
  secoesColoridas: boolean
}

export const COR_PADRAO = '#8b6dd6'

export const TEMA_PADRAO: Tema = {
  modo: 'fixa', cor: COR_PADRAO, fundo: 'tingido', secoesColoridas: true,
}

/** As cores das rotinas e dos grupos musculares - a paleta que o app ja usa. */
export const CORES_TEMA = [
  '#8b6dd6', '#7b81be', '#5a8cbf', '#4f9aad', '#4fa385', '#8ba055',
  '#c9a049', '#c2854e', '#c96a4a', '#c25f70', '#bd7095', '#a86eaf',
]

/** Preenche o que faltar com o padrao - perfil de antes do tema nao tem o campo. */
export const temaDe = (t?: Partial<Tema>): Tema => ({ ...TEMA_PADRAO, ...t })

/** Resumo de uma linha, pro Perfil. */
export function resumoTema(t?: Partial<Tema>) {
  const tema = temaDe(t)
  const modo = { fixa: 'Cor fixa', treino: 'Cor do treino do dia', semana: 'Uma cor por dia' }[tema.modo]
  const fundo = { tingido: '', neutro: ' - fundo neutro', preto: ' - fundo preto' }[tema.fundo]
  return modo + fundo
}

/* ------------------------------------------------------------------ */
/* QUE COR VALE HOJE                                                   */
/* ------------------------------------------------------------------ */

export interface ContextoDia {
  /** 0=Dom ... 6=Sab */
  dia: number
  /** Cor da rotina marcada pra esse dia na semana, se houver. */
  corRotinaDoDia?: string
  /** Cor da rotina do treino em andamento - e o que voce esta treinando agora. */
  corTreinoAtivo?: string
}

export function corDoDia(tema: Tema, ctx: ContextoDia): string {
  if (tema.modo === 'treino') return ctx.corTreinoAtivo ?? ctx.corRotinaDoDia ?? tema.cor
  if (tema.modo === 'semana') return tema.semana?.[ctx.dia] ?? tema.cor
  return tema.cor
}

/* ------------------------------------------------------------------ */
/* CONVERSAO sRGB <-> OKLCH                                            */
/* ------------------------------------------------------------------ */

const HEX = /^#[0-9a-f]{6}$/i
export const corValida = (c: unknown): c is string => typeof c === 'string' && HEX.test(c)

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const gama = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/** [L, C, H] - L de 0 a 1, H em graus. */
export function hexParaOklch(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => linear(v / 255))
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  return [L, Math.hypot(a, bb), (Math.atan2(bb, a) * 180 / Math.PI + 360) % 360]
}

/** sRGB de 0 a 1, sem cortar - fora de [0, 1] quer dizer fora da tela. */
function oklchParaRgb(L: number, C: number, H: number): [number, number, number] {
  const a = C * Math.cos(H * Math.PI / 180)
  const b = C * Math.sin(H * Math.PI / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ].map(gama) as [number, number, number]
}

const naTela = (rgb: number[]) => rgb.every(v => v >= -0.0005 && v <= 1.0005)

/**
 * Hex de um ponto OKLCH. Se a cor nao cabe no sRGB (verde ou ciano muito
 * saturado), tira croma ate caber - cortar o canal mudaria o matiz.
 */
export function oklchParaHex(L: number, C: number, H: number): string {
  let rgb = oklchParaRgb(L, C, H)
  if (!naTela(rgb)) {
    let lo = 0, hi = C
    for (let i = 0; i < 18; i++) {
      const meio = (lo + hi) / 2
      if (naTela(oklchParaRgb(L, meio, H))) lo = meio
      else hi = meio
    }
    rgb = oklchParaRgb(L, lo, H)
  }
  return '#' + rgb.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')
}

/* ------------------------------------------------------------------ */
/* PALETA                                                              */
/* ------------------------------------------------------------------ */

/**
 * Luminosidade e croma de cada token neutro, medidos do roxo original
 * (index.css). O croma e o do roxo, que tem croma 0.155 - uma cor menos
 * saturada tinge proporcionalmente menos.
 */
const NEUTROS: [token: string, L: number, C: number, Lpreto: number][] = [
  ['--color-bg', 0.141, 0.029, 0],
  ['--color-bg-soft', 0.173, 0.041, 0.15],
  ['--color-surface', 0.204, 0.061, 0.19],
  ['--color-surface-2', 0.245, 0.076, 0.235],
  ['--color-line', 0.294, 0.089, 0.29],
  ['--color-txt', 0.939, 0.024, 0.939],
  ['--color-muted', 0.681, 0.065, 0.681],
]
const CROMA_ROXO = 0.155

/** Neutro e preto ainda levam um fio do matiz - cinza puro fica sem vida. */
const TINTA: Record<FundoTema, number> = { tingido: 1, neutro: 0.2, preto: 0.2 }

/**
 * Cor das secoes (ver lib/secoes.ts). Sempre as quatro, nos dois modos: sem
 * isso, voltar de "tudo na cor do tema" deixaria o valor velho preso no estilo.
 */
const SECOES_COLORIDAS = {
  '--secao-dieta': 'var(--color-good)',
  '--secao-progresso': 'var(--color-xp)',
  '--secao-diario': 'var(--color-bad)',
  '--secao-perfil': 'var(--color-accent-2)',
}

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/**
 * As variaveis CSS do tema pra uma cor. O destaque fica numa faixa de
 * luminosidade em que funciona sobre o fundo escuro; a variante "deep" (fundo
 * de botao com texto branco) nunca passa de 0.55, que e o que segura o
 * contraste do texto branco em 4.5:1 ou mais.
 */
export function variaveisDoTema(cor: string, tema: Pick<Tema, 'fundo' | 'secoesColoridas'>): Record<string, string> {
  const [L0, C0, H] = hexParaOklch(corValida(cor) ? cor : COR_PADRAO)
  const L = limitar(L0, 0.56, 0.74)
  const C = Math.min(C0, 0.17)
  const tinta = Math.min(C / CROMA_ROXO, 1) * TINTA[tema.fundo]

  const vars: Record<string, string> = {}
  for (const [token, Ln, Cn, Lpreto] of NEUTROS) {
    vars[token] = oklchParaHex(tema.fundo === 'preto' ? Lpreto : Ln, Cn * tinta, H)
  }
  vars['--color-accent'] = oklchParaHex(L, C, H)
  vars['--color-accent-soft'] = oklchParaHex(L + 0.085, C * 0.79, H)
  vars['--color-accent-deep'] = oklchParaHex(Math.min(L - 0.095, 0.55), C, H)

  const secoes = tema.secoesColoridas
    ? SECOES_COLORIDAS
    : Object.fromEntries(Object.keys(SECOES_COLORIDAS).map(k => [k, 'var(--color-accent)']))
  return { ...vars, ...secoes }
}

/* ------------------------------------------------------------------ */
/* APLICAR NA PAGINA                                                   */
/* ------------------------------------------------------------------ */

const CHAVE = 'onemore:tema'

/**
 * Escreve as variaveis no <html>. O Tailwind compila `bg-accent/15` e afins
 * como referencia a var(--color-accent), entao trocar a variavel repinta o
 * app inteiro sem recompilar nada.
 */
export function aplicarTema(vars: Record<string, string>) {
  const estilo = document.documentElement.style
  for (const [k, v] of Object.entries(vars)) estilo.setProperty(k, v)
  // a barra do navegador/sistema acompanha o fundo
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', vars['--color-bg'])
  try { localStorage.setItem(CHAVE, JSON.stringify(vars)) } catch { /* sem storage, so nao lembra */ }
}

/**
 * Reaplica o ultimo tema antes do React montar. Sem isso o app abre roxo e
 * troca de cor um instante depois, quando o perfil chega do banco.
 */
export function restaurarTemaSalvo() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? 'null')
    if (salvo && typeof salvo === 'object') aplicarTema(salvo)
  } catch { /* tema salvo corrompido: fica o padrao do CSS */ }
}
