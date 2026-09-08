import type { Alimento } from '../db/types'
import { macrosDe, type Macros } from './nutricao'

/**
 * "Nao tenho esse alimento agora - o que como no lugar?"
 *
 * A conta e a mesma que nutricionista faz na mao: escolhe o macro que manda no
 * alimento (pra quem tem diabetes, o carboidrato sempre) e ajusta a porcao do
 * substituto pra entregar a MESMA quantidade daquele macro. Depois ordena pelo
 * que menos bagunca o resto (caloria e os outros dois macros).
 */

export type Chave = 'carb' | 'prot' | 'gord' | 'kcal' | 'peso'

export const ROTULO_CHAVE: Record<Chave, string> = {
  carb: 'carboidrato',
  prot: 'proteina',
  gord: 'gordura',
  kcal: 'caloria',
  peso: 'quantidade',
}

export const UNIDADE_CHAVE: Record<Chave, string> = {
  carb: 'g carbo', prot: 'g prot', gord: 'g gord', kcal: 'kcal', peso: 'g',
}

/**
 * Categorias que trocam entre si sem virar bizarrice. Arroz por macarrao sim,
 * arroz por azeite nao - mesmo que a conta feche.
 */
const PARENTES: Record<string, string[]> = {
  'Carboidratos': ['Leguminosas'],
  'Leguminosas': ['Carboidratos', 'Proteinas'],
  'Proteinas': ['Laticinios', 'Leguminosas'],
  'Laticinios': ['Proteinas', 'Bebidas'],
  'Frutas': [],
  'Verduras e legumes': [],
  'Gorduras': ['Laticinios'],
  'Suplementos': ['Proteinas', 'Laticinios'],
  'Bebidas': ['Laticinios'],
  'Doces e lanches': ['Carboidratos'],
  'Molhos': [],
}

function daFamilia(a: string, b: string) {
  return a === b || (PARENTES[a] ?? []).includes(b)
}

/** Quanto do macro-chave tem em 100 g. 'peso' e a propria grama: 100 em 100. */
const por100 = (a: Alimento, c: Chave) =>
  c === 'peso' ? 100
    : c === 'kcal' ? a.kcal : c === 'carb' ? a.carb : c === 'prot' ? a.prot : a.gord

export const noMacro = (m: Macros, c: Chave) =>
  c === 'kcal' ? m.kcal : c === 'carb' ? m.carb : c === 'prot' ? m.prot : m.gord

/** Folha e legume: quase nada de macro, entao a troca justa e prato por prato. */
const poucoDenso = (a: Alimento) => a.kcal < 60 && a.carb < 8

/**
 * Qual macro segurar fixo na troca. Diabetes tipo 1 trava no carboidrato
 * sempre que o alimento tiver carbo pra valer - e o numero que importa.
 */
export function chaveDe(a: Alimento, gramas: number, priorizarCarbo = false): Chave {
  const m = macrosDe(a, gramas)
  // alface por 40 g de milho fecha a caloria e nao serve pra nada
  if (poucoDenso(a)) return 'peso'
  if (priorizarCarbo && m.carb >= 5) return 'carb'
  const ranking: [Chave, number][] = [
    ['carb', m.carb * 4], ['prot', m.prot * 4], ['gord', m.gord * 9],
  ]
  ranking.sort((x, y) => y[1] - x[1])
  const chave = ranking[0][0]
  // porcao pequena demais pra igualar macro (folha de alface): cai pra caloria
  return noMacro(m, chave) >= 1 ? chave : 'kcal'
}

export interface Porcao {
  qtd: number
  medida: string
  gramas: number
  /** Erro relativo do arredondamento - entra no ranking. */
  erro: number
}

/**
 * Transforma "37,4 g" em algo que da pra servir: 1,5 colher de sopa, meia
 * unidade, 40 g. Prefere medida caseira e quantidade perto de 1-3.
 */
export function porcaoBonita(a: Alimento, gramas: number): Porcao {
  let melhor: (Porcao & { peso: number }) | null = null

  for (const md of a.medidas) {
    if (!md.gramas || md.gramas <= 0) continue
    const bruto = gramas / md.gramas
    const passo = bruto >= 3 ? 1 : 0.5
    const qtd = Math.max(passo, Math.round(bruto / passo) * passo)
    if (qtd > 12) continue
    const g = qtd * md.gramas
    const erro = Math.abs(g - gramas) / gramas
    if (erro > 0.34) continue
    // desempate: quantidade comoda ganha de quantidade exata mas esquisita
    const peso = erro + Math.abs(Math.log(qtd / 2)) * 0.03
    if (!melhor || peso < melhor.peso) melhor = { qtd, medida: md.nome, gramas: g, erro, peso }
  }
  if (melhor) return { qtd: melhor.qtd, medida: melhor.medida, gramas: melhor.gramas, erro: melhor.erro }

  const passo = gramas >= 100 ? 10 : gramas >= 30 ? 5 : 1
  const g = Math.max(passo, Math.round(gramas / passo) * passo)
  return { qtd: g, medida: a.unidadeBase, gramas: g, erro: Math.abs(g - gramas) / gramas }
}

export interface Substituto extends Porcao {
  alimento: Alimento
  macros: Macros
  /** Diferenca de caloria em relacao a porcao original. */
  difKcal: number
  /** false = veio de outra categoria (so aparece no modo ampliado). */
  mesmaFamilia: boolean
  score: number
}

export interface Equivalencia {
  chave: Chave
  /** Quanto da macro-chave a porcao original entrega. */
  alvo: number
  original: Macros
  lista: Substituto[]
}

const dif = (x: number, y: number, piso: number) => Math.abs(x - y) / Math.max(y, piso)

export function equivalentes(
  base: Alimento,
  gramas: number,
  pool: Alimento[],
  opts: { priorizarCarbo?: boolean; ampliar?: boolean; limite?: number } = {},
): Equivalencia {
  const chave = chaveDe(base, gramas, opts.priorizarCarbo)
  const original = macrosDe(base, gramas)
  const alvo = chave === 'peso' ? gramas : noMacro(original, chave)
  const lista: Substituto[] = []

  if (alvo > 0) {
    for (const a of pool) {
      if (a.id === base.id) continue
      const mesmaFamilia = daFamilia(base.categoria, a.categoria)
      if (!opts.ampliar && !mesmaFamilia) continue

      // quantidade por quantidade so entre alimentos igualmente leves
      if (chave === 'peso' && !poucoDenso(a)) continue
      const densidade = por100(a, chave)
      if (densidade <= 0) continue

      const ideal = (alvo * 100) / densidade
      if (ideal < 2 || ideal > 900) continue

      const p = porcaoBonita(a, ideal)
      if (p.gramas < 2 || p.gramas > 1000) continue

      const m = macrosDe(a, p.gramas)
      // troca que triplica ou corta pela metade a caloria nao e substituicao
      if (original.kcal > 20 && (m.kcal > original.kcal * 3 || m.kcal * 3 < original.kcal)) continue

      const score =
        dif(m.kcal, original.kcal, 60) * 1.0 +
        dif(m.carb, original.carb, 6) * (chave === 'carb' ? 0.3 : 0.6) +
        dif(m.prot, original.prot, 6) * 0.6 +
        dif(m.gord, original.gord, 5) * 0.5 +
        p.erro * 0.6 +
        (mesmaFamilia ? 0 : 0.45) +
        (a.favorito ? -0.25 : 0)

      lista.push({
        ...p, alimento: a, macros: m,
        difKcal: m.kcal - original.kcal, mesmaFamilia, score,
      })
    }
    lista.sort((x, y) => x.score - y.score)
  }

  return { chave, alvo, original, lista: lista.slice(0, opts.limite ?? 8) }
}
