import type { Alimento, Perfil, RegistroDieta, ItemRefeicao } from '../db/types'

export interface Macros { kcal: number; prot: number; carb: number; gord: number; fibra: number }

export const ZERO: Macros = { kcal: 0, prot: 0, carb: 0, gord: 0, fibra: 0 }

/** Macros de `gramas` de um alimento (a tabela e sempre por 100 g). */
export function macrosDe(a: Alimento, gramas: number): Macros {
  const f = gramas / 100
  return {
    kcal: a.kcal * f,
    prot: a.prot * f,
    carb: a.carb * f,
    gord: a.gord * f,
    fibra: (a.fibra ?? 0) * f,
  }
}

export function somaMacros(...ms: Macros[]): Macros {
  return ms.reduce((acc, m) => ({
    kcal: acc.kcal + m.kcal,
    prot: acc.prot + m.prot,
    carb: acc.carb + m.carb,
    gord: acc.gord + m.gord,
    fibra: acc.fibra + m.fibra,
  }), { ...ZERO })
}

export function totalDoDia(
  registros: RegistroDieta[],
  mapa: Map<string, Alimento>,
): Macros {
  return somaMacros(...registros.map(r => {
    const a = mapa.get(r.alimentoId)
    return a ? macrosDe(a, r.gramas) : ZERO
  }))
}

export function totalDoPlano(
  itens: ItemRefeicao[],
  mapa: Map<string, Alimento>,
): Macros {
  return somaMacros(...itens.map(i => {
    const a = mapa.get(i.alimentoId)
    return a ? macrosDe(a, i.gramas) : ZERO
  }))
}

/** Converte uma quantidade numa medida caseira para gramas. */
export function paraGramas(a: Alimento, qtd: number, medida: string): number {
  if (medida === 'g' || medida === 'ml') return qtd
  const m = a.medidas.find(x => x.nome === medida)
  return m ? qtd * m.gramas : qtd
}

/* ------------------------------------------------------------------ */
/* METAS                                                               */
/* ------------------------------------------------------------------ */

export function idadeDe(nascimento?: string, fallback = 25): number {
  if (!nascimento) return fallback
  const [a, m, d] = nascimento.split('-').map(Number)
  const hoje = new Date()
  let idade = hoje.getFullYear() - a
  const passou = hoje.getMonth() + 1 > m || (hoje.getMonth() + 1 === m && hoje.getDate() >= d)
  if (!passou) idade--
  return Math.max(10, Math.min(100, idade))
}

/** Taxa metabolica basal - Mifflin-St Jeor. */
export function tmb(p: Pick<Perfil, 'sexo' | 'pesoKg' | 'alturaCm' | 'nascimento' | 'idade'>): number {
  const idade = idadeDe(p.nascimento, p.idade)
  const base = 10 * p.pesoKg + 6.25 * p.alturaCm - 5 * idade
  return Math.round(p.sexo === 'M' ? base + 5 : base - 161)
}

export function gastoDiario(p: Pick<Perfil, 'sexo' | 'pesoKg' | 'alturaCm' | 'nascimento' | 'idade' | 'atividade'>): number {
  return Math.round(tmb(p) * p.atividade)
}

export const AJUSTE_OBJETIVO = {
  cutting: -0.20,
  manutencao: 0,
  bulking: 0.12,
} as const

export interface SugestaoMetas extends Macros { gasto: number; tmb: number }

/**
 * Sugere kcal + macros a partir do perfil.
 * Proteina e gordura por kg de peso; carboidrato leva o que sobra.
 */
export function sugerirMetas(
  p: Pick<Perfil, 'sexo' | 'pesoKg' | 'alturaCm' | 'nascimento' | 'idade' | 'atividade' | 'objetivo'>,
): SugestaoMetas {
  const base = tmb(p)
  const gasto = Math.round(base * p.atividade)
  const kcal = Math.round(gasto * (1 + AJUSTE_OBJETIVO[p.objetivo]))

  const protPorKg = p.objetivo === 'cutting' ? 2.2 : 2.0
  const prot = Math.round(p.pesoKg * protPorKg)

  const gordPorKg = p.objetivo === 'cutting' ? 0.8 : p.objetivo === 'bulking' ? 1.1 : 1.0
  let gord = Math.round(p.pesoKg * gordPorKg)
  // piso de seguranca: nunca abaixo de 20% das calorias
  gord = Math.max(gord, Math.round((kcal * 0.20) / 9))

  const carb = Math.max(0, Math.round((kcal - prot * 4 - gord * 9) / 4))

  return { kcal, prot, carb, gord, fibra: Math.round(kcal / 1000 * 14), gasto, tmb: base }
}

/** Percentual da meta atingido, limitado pra barra nao estourar visualmente. */
export function pct(atual: number, meta: number) {
  if (!meta) return 0
  return Math.max(0, atual / meta)
}

/** Dia "batido": calorias dentro de +-10% e proteina >= 90% da meta. */
export function diaBatido(t: Macros, p: Pick<Perfil, 'metaKcal' | 'metaProt'>) {
  const k = pct(t.kcal, p.metaKcal)
  const pr = pct(t.prot, p.metaProt)
  return { kcalOk: k >= 0.9 && k <= 1.1, protOk: pr >= 0.9 }
}
