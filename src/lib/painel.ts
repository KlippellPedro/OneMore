import type { Alimento, RegistroDieta, Sessao } from '../db/types'
// com .ts: o node --test importa este arquivo direto, e sem extensao ele nao acha o vizinho
import { maisDias, paraIso, segundaDe, treinosNaSemana, type Cartao } from './cartao.ts'

/**
 * As contas do painel do treinador. Puro (sem Dexie), testado em
 * painel.test.mjs: o treinador ve o aluno a partir do que veio do servidor,
 * nao do banco do proprio aparelho.
 */

const DIA_MS = 86400000
const doIso = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d) }
const diffDias = (de: string, ate: string) => Math.round((doIso(ate).getTime() - doIso(de).getTime()) / DIA_MS)

/** Series que valem: feitas e fora do aquecimento. */
const valem = (s: Sessao) => s.series.filter(g => g.feito && !g.aquecimento)
const concluidas = (sessoes: Sessao[]) => sessoes.filter(s => s.concluida && valem(s).length > 0)

/* ------------------------------------------------------------------ */
/* LISTA DA EQUIPE                                                     */
/* ------------------------------------------------------------------ */

export type Situacao = 'em-dia' | 'atencao' | 'parado' | 'sem-dados'

export interface SituacaoAluno {
  situacao: Situacao
  treinosSemana: number
  meta: number
  /** Dias desde o ultimo treino; null = nenhum treino nas ultimas semanas. */
  diasSemTreinar: number | null
}

/**
 * Como o aluno esta, pelo cartao. "Parado" e uma semana sem treinar; "atencao"
 * e 4 dias, ou a semana ja passou da metade e o aluno esta longe da meta.
 */
export function situacaoDoCartao(c: Cartao | null, hoje: string): SituacaoAluno {
  if (!c) return { situacao: 'sem-dados', treinosSemana: 0, meta: 0, diasSemTreinar: null }
  const treinosSemana = treinosNaSemana(c, hoje)
  const ultimo = c.dias[0] ?? c.ultimos[0]?.dia ?? null
  const diasSemTreinar = ultimo ? diffDias(ultimo, hoje) : null
  const meta = c.metaSemana
  const diaDaSemana = diffDias(segundaDe(hoje), hoje) + 1 // 1 = segunda
  const esperado = meta ? Math.floor((meta * diaDaSemana) / 7) : 0
  let situacao: Situacao = 'em-dia'
  if (diasSemTreinar == null || diasSemTreinar >= 7) situacao = 'parado'
  else if (diasSemTreinar >= 4 || treinosSemana + 1 < esperado) situacao = 'atencao'
  return { situacao, treinosSemana, meta, diasSemTreinar }
}

/** Ordem da lista: quem precisa de atencao primeiro. */
const PESO: Record<Situacao, number> = { parado: 0, atencao: 1, 'sem-dados': 2, 'em-dia': 3 }
export const ordemDeAtencao = (a: SituacaoAluno, b: SituacaoAluno) => PESO[a.situacao] - PESO[b.situacao]

/* ------------------------------------------------------------------ */
/* DETALHE DO ALUNO                                                    */
/* ------------------------------------------------------------------ */

export interface SemanaDeTreino { inicio: string; treinos: number; volume: number; series: number }

/** As ultimas `n` semanas (segunda a domingo), da mais velha pra atual. */
export function semanasDeTreino(sessoes: Sessao[], hoje: string, n = 8): SemanaDeTreino[] {
  const seg = segundaDe(hoje)
  const semanas = Array.from({ length: n }, (_, i) => ({ inicio: maisDias(seg, -7 * (n - 1 - i)), treinos: 0, volume: 0, series: 0 }))
  for (const s of concluidas(sessoes)) {
    const dia = paraIso(new Date(s.inicio))
    const idx = Math.floor(diffDias(semanas[0].inicio, dia) / 7)
    if (idx < 0 || idx >= n || dia > hoje) continue
    const feitas = valem(s)
    semanas[idx].treinos++
    semanas[idx].series += feitas.length
    semanas[idx].volume += feitas.reduce((t, g) => t + g.carga * g.reps, 0)
  }
  return semanas.map(s => ({ ...s, volume: Math.round(s.volume) }))
}

/** Fracao das semanas completas (sem contar a atual) em que a meta foi batida. */
export function constancia(semanas: SemanaDeTreino[], meta: number): number | null {
  const completas = semanas.slice(0, -1)
  if (!meta || !completas.length) return null
  return completas.filter(s => s.treinos >= meta).length / completas.length
}

export interface TreinoFeito {
  id: string
  nome: string
  dia: string
  minutos: number
  series: number
  volume: number
  exercicios: { exercicioId: string; series: { carga: number; reps: number }[] }[]
}

/** Historico do mais novo pro mais velho, com as series agrupadas por exercicio. */
export function historico(sessoes: Sessao[], limite = 30): TreinoFeito[] {
  return concluidas(sessoes)
    .sort((a, b) => b.inicio - a.inicio)
    .slice(0, limite)
    .map(s => {
      const feitas = valem(s)
      const porEx = new Map<string, { carga: number; reps: number }[]>()
      for (const g of feitas) {
        if (!porEx.has(g.exercicioId)) porEx.set(g.exercicioId, [])
        porEx.get(g.exercicioId)!.push({ carga: g.carga, reps: g.reps })
      }
      return {
        id: s.id, nome: s.nome, dia: paraIso(new Date(s.inicio)),
        minutos: s.fim ? Math.max(0, Math.round((s.fim - s.inicio) / 60000)) : 0,
        series: feitas.length,
        volume: Math.round(feitas.reduce((t, g) => t + g.carga * g.reps, 0)),
        exercicios: [...porEx].map(([exercicioId, series]) => ({ exercicioId, series })),
      }
    })
}

export interface DiaDeDieta { dia: string; kcal: number; prot: number; registros: number }

/** Calorias e proteina registradas nos ultimos `n` dias, do mais velho pra hoje. */
export function diasDeDieta(
  registros: RegistroDieta[], alimentos: Map<string, Pick<Alimento, 'kcal' | 'prot'>>, hoje: string, n = 7,
): DiaDeDieta[] {
  const dias = Array.from({ length: n }, (_, i) => ({ dia: maisDias(hoje, -(n - 1 - i)), kcal: 0, prot: 0, registros: 0 }))
  const porDia = new Map(dias.map(d => [d.dia, d]))
  for (const r of registros) {
    const d = porDia.get(r.data)
    const a = alimentos.get(r.alimentoId)
    if (!d || !a) continue
    d.kcal += (a.kcal * r.gramas) / 100
    d.prot += (a.prot * r.gramas) / 100
    d.registros++
  }
  return dias.map(d => ({ ...d, kcal: Math.round(d.kcal), prot: Math.round(d.prot) }))
}
