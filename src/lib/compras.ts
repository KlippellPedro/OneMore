import type { Alimento, PlanoRefeicao } from '../db/types'
import { equivalentes, type Substituto } from './substituicoes'
import { n0, n1 } from './format'

/**
 * Transforma o cardapio do plano numa lista de mercado: junta o mesmo alimento
 * de todas as refeicoes, multiplica pelos dias e traz as trocas de cada item -
 * o que interessa no corredor do mercado e "se nao tiver, levo o que?".
 */

/** Ordem de corredor, nao ordem de macro: hortifruti, acougue, mercearia. */
const ORDEM_CATEGORIAS = [
  'Frutas', 'Verduras e legumes', 'Proteinas', 'Laticinios', 'Carboidratos',
  'Leguminosas', 'Gorduras', 'Molhos', 'Bebidas', 'Doces e lanches', 'Suplementos',
]

export interface ItemCompra {
  alimento: Alimento
  /** Quanto o cardapio usa por dia, somando todas as refeicoes. */
  gramasDia: number
  gramasTotal: number
  /** Em quais refeicoes ele aparece. */
  refeicoes: string[]
  /** Quantas unidades comprar, quando o alimento e contado na unidade. */
  unidades: number | null
  /** Equivalentes ja na quantidade total do periodo. */
  trocas: { nome: string; gramas: number; alimento: Alimento }[]
}

export interface GrupoCompra {
  categoria: string
  itens: ItemCompra[]
}

/** "1,2 kg" / "450 g" / "3,5 L" - quantidade de mercado, sem precisao falsa. */
export function pesoCompra(gramas: number, unidade: 'g' | 'ml') {
  if (gramas >= 1000) return `${n1(gramas / 1000)} ${unidade === 'ml' ? 'L' : 'kg'}`
  if (gramas >= 100) return `${n0(Math.round(gramas / 10) * 10)} ${unidade}`
  // abaixo de 20 g arredondar de 5 em 5 faz a conta do dia nao fechar com a do periodo
  if (gramas >= 20) return `${n0(Math.round(gramas / 5) * 5)} ${unidade}`
  return `${n0(gramas)} ${unidade}`
}

/** Medida do tipo "unidade", "unidade media"... - so essas dao pra contar no carrinho. */
function medidaUnidade(a: Alimento) {
  return a.medidas.find(m => m.nome.toLowerCase().startsWith('unidade')) ?? null
}

export function listaDeCompras(
  planos: PlanoRefeicao[],
  mapa: Map<string, Alimento>,
  pool: Alimento[],
  dias: number,
  opts: { priorizarCarbo?: boolean; trocasPorItem?: number } = {},
): GrupoCompra[] {
  const porAlimento = new Map<string, { gramas: number; refeicoes: string[] }>()

  for (const p of planos) {
    for (const it of p.itens) {
      const atual = porAlimento.get(it.alimentoId) ?? { gramas: 0, refeicoes: [] }
      atual.gramas += it.gramas
      if (!atual.refeicoes.includes(p.nome)) atual.refeicoes.push(p.nome)
      porAlimento.set(it.alimentoId, atual)
    }
  }

  const itens: ItemCompra[] = []
  for (const [id, { gramas, refeicoes }] of porAlimento) {
    const a = mapa.get(id)
    if (!a) continue
    const gramasTotal = gramas * dias

    // as trocas saem de uma porcao de referencia e depois escalam pro periodo:
    // porcao gigante estoura o limite do calculo e nao acharia equivalente nenhum
    const ref = Math.min(gramas, 250)
    const escala = ref > 0 ? gramasTotal / ref : 0
    const eq = equivalentes(a, ref, pool, {
      priorizarCarbo: opts.priorizarCarbo, limite: opts.trocasPorItem ?? 3,
    })

    const md = medidaUnidade(a)
    itens.push({
      alimento: a,
      gramasDia: gramas,
      gramasTotal,
      refeicoes,
      unidades: md && md.gramas > 0 ? Math.ceil(gramasTotal / md.gramas) : null,
      trocas: eq.lista.map((s: Substituto) => ({
        nome: s.alimento.nome, alimento: s.alimento, gramas: s.gramas * escala,
      })),
    })
  }

  const grupos = new Map<string, ItemCompra[]>()
  for (const i of itens) {
    const c = i.alimento.categoria
    grupos.set(c, [...(grupos.get(c) ?? []), i])
  }

  return [...grupos.entries()]
    .map(([categoria, lista]) => ({
      categoria,
      itens: lista.sort((x, y) => x.alimento.nome.localeCompare(y.alimento.nome, 'pt-BR')),
    }))
    .sort((a, b) => {
      const ia = ORDEM_CATEGORIAS.indexOf(a.categoria)
      const ib = ORDEM_CATEGORIAS.indexOf(b.categoria)
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
    })
}
