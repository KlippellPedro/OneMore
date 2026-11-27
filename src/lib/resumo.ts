import type { EventoXP, Sessao } from '../db/types'

/**
 * A semana em numeros, comparada com a anterior NO MESMO TRECHO: quarta de
 * manha compara segunda-a-quarta com segunda-a-quarta da semana passada. Contra
 * a semana passada inteira, toda semana "piorava" ate domingo. Puro de proposito.
 */

export interface NumerosSemana {
  treinos: number
  series: number
  volume: number
  /** Dias com o XP de cada meta - o app so da uma vez por dia, entao e contagem de dia. */
  diasDieta: number
  diasProteina: number
  diasAgua: number
}

export interface ResumoSemanal {
  atual: NumerosSemana
  anterior: NumerosSemana
  /** Quantos dias da semana ja passaram (1 = segunda, 7 = domingo). */
  dias: number
  inicio: string
}

const doIso = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d) }
const paraIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const mais = (iso: string, n: number) => { const d = doIso(iso); d.setDate(d.getDate() + n); return paraIso(d) }

function numeros(sessoes: Sessao[], eventos: EventoXP[], de: string, ate: string): NumerosSemana {
  const dentro = (iso: string) => iso >= de && iso <= ate
  const s = sessoes.filter(x => x.concluida && dentro(paraIso(new Date(x.inicio))))
  const feitas = s.flatMap(x => x.series.filter(g => g.feito && !g.aquecimento))
  const dias = (tipo: string) => new Set(eventos.filter(e => e.tipo === tipo && dentro(e.data)).map(e => e.data)).size
  return {
    treinos: s.length,
    series: feitas.length,
    volume: feitas.reduce((t, g) => t + g.carga * g.reps, 0),
    diasDieta: dias('dieta'),
    diasProteina: dias('proteina'),
    diasAgua: dias('agua'),
  }
}

export function resumoSemanal(sessoes: Sessao[], eventos: EventoXP[], hoje: string): ResumoSemanal {
  const dow = doIso(hoje).getDay()          // 0 = domingo
  const dias = dow === 0 ? 7 : dow           // semana comeca na segunda
  const inicio = mais(hoje, -(dias - 1))
  return {
    atual: numeros(sessoes, eventos, inicio, hoje),
    anterior: numeros(sessoes, eventos, mais(inicio, -7), mais(hoje, -7)),
    dias,
    inicio,
  }
}

/** A semana em texto, pra compartilhar. */
export function textoDaSemana(r: ResumoSemanal, nivel?: { nivel: number; rank: string }): string {
  const n = (v: number) => Math.round(v).toLocaleString('pt-BR')
  const a = r.atual
  const linhas = [
    'Minha semana no OneMore',
    '',
    `Treinos: ${a.treinos}`,
    `Séries: ${n(a.series)}`,
    `Volume: ${n(a.volume)} kg`,
    `Dias com a dieta na meta: ${a.diasDieta} de ${r.dias}`,
    `Dias batendo a proteína: ${a.diasProteina} de ${r.dias}`,
    `Dias batendo a água: ${a.diasAgua} de ${r.dias}`,
  ]
  if (nivel) linhas.push('', `Nível ${nivel.nivel} - Rank ${nivel.rank}`)
  return linhas.join('\n')
}
