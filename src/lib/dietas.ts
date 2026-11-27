import type { ItemRefeicao, RefeicaoSalva } from '../db/types'

/**
 * Contas da dieta que nao dependem do banco: o retrato do plano pra copia
 * automatica e o texto do dia pra compartilhar. Puro - os testes importam
 * direto, sem Dexie.
 */

const num = (v: number) => Math.round(v).toLocaleString('pt-BR')
const qtd = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

/** As refeicoes do plano como ficam guardadas numa dieta salva: copia, sem id nem carimbo. */
export function retratoDoPlano(
  planos: { nome: string; horario: string; itens: ItemRefeicao[]; ordem: number }[],
): RefeicaoSalva[] {
  return [...planos]
    .sort((a, b) => a.ordem - b.ordem)
    .map((p, i) => ({ nome: p.nome, horario: p.horario, itens: p.itens.map(it => ({ ...it })), ordem: i }))
}

/** Mesmo cardapio, refeicao por refeicao e item por item - o que decide se vale tirar outra copia. */
export function mesmoCardapio(a: RefeicaoSalva[], b: RefeicaoSalva[]): boolean {
  const canonico = (rs: RefeicaoSalva[]) => JSON.stringify(
    [...rs].sort((x, y) => x.ordem - y.ordem).map(r => ({
      nome: r.nome, horario: r.horario,
      itens: r.itens.map(i => ({ a: i.alimentoId, q: i.qtd, m: i.medida, g: i.gramas })),
    })),
  )
  return canonico(a) === canonico(b)
}

export interface LinhaDoDia { nome: string; qtd: number; medida: string; kcal: number; carb: number }
export interface MacrosDia { kcal: number; prot: number; carb: number; gord: number }

/**
 * O dia da dieta em texto, pra mandar pro nutricionista ou guardar. Carboidrato
 * vai em cada refeicao porque e o numero que quem conta carbo precisa ver.
 */
export function textoDoDia(d: {
  data: string
  refeicoes: { nome: string; itens: LinhaDoDia[] }[]
  total: MacrosDia
  metaKcal: number
  aguaMl?: number
}): string {
  const linhas = [
    `Dieta - ${d.data}`,
    `${num(d.total.kcal)} kcal (meta ${num(d.metaKcal)}) - proteína ${num(d.total.prot)} g - carbo ${num(d.total.carb)} g - gordura ${num(d.total.gord)} g`,
  ]
  for (const r of d.refeicoes) {
    if (!r.itens.length) continue
    const kcal = r.itens.reduce((t, i) => t + i.kcal, 0)
    const carb = r.itens.reduce((t, i) => t + i.carb, 0)
    linhas.push('', `${r.nome} - ${num(kcal)} kcal, ${num(carb)} g de carbo`)
    for (const i of r.itens) linhas.push(`- ${qtd(i.qtd)} ${i.medida} de ${i.nome}`)
  }
  if (d.aguaMl) linhas.push('', `Água: ${(d.aguaMl / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`)
  linhas.push('', 'Registrado no OneMore')
  return linhas.join('\n')
}
