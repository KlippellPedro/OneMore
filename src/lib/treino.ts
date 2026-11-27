import type { Equipamento, GrupoMuscular, ItemRotina, SerieLog } from '../db/types'
import type { SerieAnterior } from '../db/melhores'

/**
 * Contas do treino que nao dependem do banco: faixa de repeticoes, sugestao
 * de carga, anilhas, series por musculo, duracao, 1RM e o texto pra
 * compartilhar. Puro de proposito - os testes importam direto, sem Dexie.
 */

const num = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

/* ------------------------------------------------------------------ */
/* REPETICOES ALVO                                                     */
/* ------------------------------------------------------------------ */

export interface FaixaReps { min: number; max: number }

/**
 * "8-12" -> 8 a 12, "10" -> 10 a 10, "8 a 12" tambem. Alvo que nao e
 * contagem de repeticao ("30s", "20min", "até a falha") devolve null: nao ha
 * numero honesto pra preencher nem topo pra bater.
 */
export function faixaDeReps(alvo: string | undefined): FaixaReps | null {
  const m = (alvo ?? '').trim().match(/^(\d{1,3})(?:\s*(?:-|–|a|até)\s*(\d{1,3}))?$/i)
  if (!m) return null
  const a = Number(m[1])
  const b = m[2] ? Number(m[2]) : a
  if (!a || !b) return null
  return { min: Math.min(a, b), max: Math.max(a, b) }
}

/**
 * Repeticoes pra pre-preencher quando o exercicio nunca foi feito: o piso da
 * faixa. E por onde a progressao dupla comeca, e poupa o "Preencha as
 * repeticoes" em toda serie do primeiro treino.
 */
export const repsIniciais = (alvo: string | undefined) => faixaDeReps(alvo)?.min ?? 0

/* ------------------------------------------------------------------ */
/* SUGESTAO DE CARGA (PROGRESSAO DUPLA)                                */
/* ------------------------------------------------------------------ */

/**
 * Quanto sobe por vez em cada aparelho: o menor salto que da pra fazer na
 * academia. Barra sobe 1,25 de cada lado; halter anda de 2 em 2. Peso do
 * corpo, elastico e cardio nao tem carga pra subir.
 */
export const PASSO_CARGA: Partial<Record<Equipamento, number>> = {
  barra: 2.5, maquina: 2.5, cabo: 2.5, anilha: 2.5, halter: 2, kettlebell: 4,
}

export interface SugestaoCarga {
  /** A carga pra tentar hoje. */
  carga: number
  /** A maior carga da ultima vez. */
  anterior: number
  /** O topo da faixa, que foi batido em todas as series. */
  topo: number
}

/**
 * Progressao dupla: sobe a repeticao dentro da faixa e, quando bate o topo em
 * TODAS as series, sobe a carga e volta pro piso. "Todas" e nao "a melhor"
 * porque 12 na primeira e 8 na ultima e sinal de que o peso ainda esta pesado.
 */
export function sugerirCarga(
  anteriores: SerieAnterior[] | undefined, alvo: string | undefined, equipamento: Equipamento | undefined,
): SugestaoCarga | null {
  const faixa = faixaDeReps(alvo)
  const passo = equipamento ? PASSO_CARGA[equipamento] : undefined
  if (!faixa || !passo || !anteriores?.length) return null
  if (!anteriores.every(a => a.carga > 0 && a.reps >= faixa.max)) return null
  const anterior = Math.max(...anteriores.map(a => a.carga))
  return { carga: Math.round((anterior + passo) * 100) / 100, anterior, topo: faixa.max }
}

/* ------------------------------------------------------------------ */
/* ANILHAS                                                             */
/* ------------------------------------------------------------------ */

/** Anilhas de academia, da maior pra menor. */
export const ANILHAS = [25, 20, 15, 10, 5, 2.5, 1.25]
export const BARRAS = [20, 15, 10]

export interface MontagemBarra {
  /** Anilhas de UM lado, da maior pra menor. */
  lado: number[]
  /** O que nao fecha com as anilhas que existem (0 = fecha certinho). */
  sobra: number
  /** A carga e menor que a propria barra. */
  abaixoDaBarra: boolean
}

/**
 * Quais anilhas por lado pra chegar na carga TOTAL (com a barra). Guloso, da
 * maior pra menor - com essa serie de anilhas o guloso ja e o melhor. Conta em
 * quartos de quilo pra 1,25 nao virar 1,2499999.
 */
export function anilhasPorLado(total: number, barra = 20, disponiveis = ANILHAS): MontagemBarra {
  if (!(total > 0) || total < barra) return { lado: [], sobra: 0, abaixoDaBarra: total > 0 && total < barra }
  let resto = Math.round(((total - barra) / 2) * 4)
  const lado: number[] = []
  for (const a of disponiveis) {
    const q = Math.round(a * 4)
    while (q > 0 && resto >= q) { lado.push(a); resto -= q }
  }
  return { lado, sobra: (resto / 4) * 2, abaixoDaBarra: false }
}

/* ------------------------------------------------------------------ */
/* SERIES POR MUSCULO NA SEMANA                                        */
/* ------------------------------------------------------------------ */

/**
 * Faixa de series semanais por musculo que a literatura de hipertrofia usa
 * como referencia (~10 a 20). Nao e regra: e o que deixa ver o musculo
 * esquecido e o que esta afogado de volume.
 */
export const FAIXA_SEMANAL = { min: 10, max: 20 }

/** Os grandes, que sempre aparecem - com zero series tambem, que e justo o aviso. */
export const GRUPOS_PRINCIPAIS: GrupoMuscular[] = [
  'peito', 'costas', 'ombro', 'biceps', 'triceps', 'quadriceps', 'posterior', 'gluteo', 'panturrilha',
]

export interface SeriesDoGrupo { grupo: GrupoMuscular; series: number; principal: boolean }

/**
 * Series de trabalho por musculo na semana montada: cada rotina conta uma vez
 * por dia em que esta marcada. Rotina sem dia nao entra - ela nao acontece na
 * semana. Cardio fica de fora (serie de cardio nao e volume de musculo).
 */
export function seriesPorGrupo(
  rotinas: { itens: ItemRotina[]; dias?: number[] }[],
  grupoDe: (exercicioId: string) => GrupoMuscular | undefined,
): SeriesDoGrupo[] {
  const soma = new Map<GrupoMuscular, number>()
  for (const r of rotinas) {
    const vezes = new Set(r.dias ?? []).size
    if (!vezes) continue
    for (const it of r.itens) {
      const g = grupoDe(it.exercicioId)
      if (!g || g === 'cardio') continue
      soma.set(g, (soma.get(g) ?? 0) + it.series * vezes)
    }
  }
  for (const g of GRUPOS_PRINCIPAIS) if (!soma.has(g)) soma.set(g, 0)
  return [...soma.entries()]
    .map(([grupo, series]) => ({ grupo, series, principal: GRUPOS_PRINCIPAIS.includes(grupo) }))
    .sort((a, b) => b.series - a.series || Number(b.principal) - Number(a.principal))
}

/* ------------------------------------------------------------------ */
/* DURACAO ESTIMADA                                                    */
/* ------------------------------------------------------------------ */

/** Tempo de uma serie fazendo, sem o descanso. */
const EXECUCAO_SEG = 45
/** Trocar de aparelho, ajustar banco, montar a barra. */
const TROCA_SEG = 90

/** "20min" -> 20, "30s" -> 0,5. Nada de tempo no alvo -> null. */
function minutosDoAlvo(alvo: string): number | null {
  const m = alvo.trim().match(/^(\d{1,3})\s*(min|m|s|seg)\b/i)
  if (!m) return null
  return m[2].toLowerCase().startsWith('s') ? Number(m[1]) / 60 : Number(m[1])
}

/**
 * Quanto o treino leva, em minutos, arredondado de 5 em 5: series fazendo,
 * descanso entre elas e a troca de um exercicio pro outro. Alvo em tempo
 * ("20min" de esteira, "45s" de prancha) conta o tempo dele no lugar da serie.
 */
export function duracaoEstimada(itens: ItemRotina[]): number {
  let seg = 0
  for (const it of itens) {
    const n = Math.max(1, it.series)
    const porTempo = minutosDoAlvo(it.repsAlvo)
    const fazendo = porTempo != null ? porTempo * 60 : EXECUCAO_SEG
    seg += n * fazendo + (n - 1) * Math.max(0, it.descansoSeg) + TROCA_SEG
  }
  if (!seg) return 0
  return Math.max(5, Math.round(seg / 60 / 5) * 5)
}

/* ------------------------------------------------------------------ */
/* 1RM ESTIMADO                                                        */
/* ------------------------------------------------------------------ */

/**
 * Carga maxima pra 1 repeticao, estimada pela formula de Epley. Acima de 12
 * repeticoes a estimativa desanda, entao essas series nao entram.
 */
export function umRM(carga: number, reps: number): number | null {
  if (!(carga > 0) || !(reps >= 1) || reps > 12) return null
  if (reps === 1) return carga
  return Math.round(carga * (1 + reps / 30) * 10) / 10
}

/** O melhor 1RM estimado entre as series - null se nenhuma serve pra estimar. */
export function melhorUmRM(series: { carga: number; reps: number }[]): number | null {
  let melhor: number | null = null
  for (const s of series) {
    const v = umRM(s.carga, s.reps)
    if (v != null && (melhor == null || v > melhor)) melhor = v
  }
  return melhor
}

/** Porcentagens de treino a partir do 1RM, com as repeticoes que cada uma costuma render. */
export const ZONAS_RM = [
  { pct: 90, reps: '3-4' },
  { pct: 80, reps: '6-8' },
  { pct: 70, reps: '10-12' },
  { pct: 60, reps: '15+' },
]

/** Arredonda pra anilha de 2,5 kg - ninguem monta 71,3 kg na barra. */
export const arredondarCarga = (kg: number, passo = 2.5) => Math.round(kg / passo) * passo

/* ------------------------------------------------------------------ */
/* COMPARTILHAR                                                        */
/* ------------------------------------------------------------------ */

/**
 * O treino em texto, pra mandar no WhatsApp ou postar. So series de trabalho
 * feitas; exercicio sem nenhuma fica de fora.
 */
export function textoDoTreino(t: {
  nome: string
  data: string
  duracao: string
  series: SerieLog[]
  nomeDe: (exercicioId: string) => string
  recordes?: string[]
}): string {
  const porEx = new Map<string, SerieLog[]>()
  for (const s of t.series) {
    if (!s.feito || s.aquecimento) continue
    porEx.set(s.exercicioId, [...(porEx.get(s.exercicioId) ?? []), s])
  }
  const feitas = [...porEx.values()].flat()
  const volume = feitas.reduce((v, s) => v + s.carga * s.reps, 0)

  const linhas = [
    t.nome,
    [t.data, t.duracao, `${feitas.length} ${feitas.length === 1 ? 'série' : 'séries'}`,
      volume > 0 ? `${num(Math.round(volume))} kg levantados` : null].filter(Boolean).join(' - '),
    '',
  ]
  for (const [exId, ss] of porEx) {
    const mesmaCarga = ss.every(s => s.carga === ss[0].carga)
    const detalhe = ss[0].carga <= 0
      ? ss.map(s => s.reps).join(', ') + ' reps'
      : mesmaCarga
        ? `${num(ss[0].carga)} kg x ${ss.map(s => s.reps).join(', ')}`
        : ss.map(s => `${num(s.carga)}x${s.reps}`).join(', ')
    linhas.push(`- ${t.nomeDe(exId)}: ${detalhe}`)
  }
  if (t.recordes?.length) linhas.push('', `Recordes: ${t.recordes.join('; ')}`)
  linhas.push('', 'Registrado no OneMore')
  return linhas.join('\n')
}
