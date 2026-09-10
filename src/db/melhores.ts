import type { SerieLog, Sessao } from './types'

/**
 * Resumo por exercicio: o recorde de sempre e o que foi feito na ultima vez.
 *
 * Existe porque responder "qual foi minha ultima carga no supino?" varria a
 * tabela inteira de sessoes - uma vez POR EXERCICIO. Comecar um treino de 7
 * exercicios eram 8 varreduras do historico inteiro, e isso so piora a cada
 * treino registrado.
 *
 * E dado DERIVADO: sai todo das sessoes concluidas e pode ser refeito a
 * qualquer momento com `reconstruirMelhores()`. Nao entra no backup.
 */
export interface MelhorExercicio {
  exercicioId: string
  /** Maior carga ja levantada numa serie valida. */
  recordeCarga: number
  /** Reps da serie que fez o recorde de carga. */
  recordeReps: number
  /** Maior carga x reps numa unica serie. */
  recordeVolume: number
  /** Melhor carga da sessao mais recente - e o que o app pre-preenche. */
  ultimaCarga: number
  ultimaReps: number
  /** `inicio` da sessao mais recente que tem esse exercicio. */
  ultimaEm: number
}

/** Series que contam: feitas e fora do aquecimento. */
const valem = (series: SerieLog[]) => series.filter(g => g.feito && !g.aquecimento)

/**
 * Dobra uma sessao no resumo do exercicio. E a MESMA funcao usada pelo caminho
 * incremental (ao concluir um treino) e pela reconstrucao - se fossem duas, uma
 * hora divergiam e o recorde da tela nao bateria com o do banco.
 */
export function dobrarSessao(
  atual: MelhorExercicio | undefined,
  exercicioId: string,
  series: SerieLog[],
  inicio: number,
): MelhorExercicio | null {
  const validas = valem(series)
  if (!validas.length) return atual ?? null

  const melhorDaVez = validas.reduce((a, b) => (b.carga > a.carga ? b : a))
  const volumeDaVez = validas.reduce((m, g) => Math.max(m, g.carga * g.reps), 0)

  const recordeAntes = atual?.recordeCarga ?? 0
  const bateuCarga = melhorDaVez.carga > recordeAntes
  // sessao fora de ordem (import, backup antigo) nao pode mandar na "ultima".
  // O `!atual` vem primeiro de proposito: com `inicio` invalido num backup
  // corrompido a comparacao daria false e a linha de baixo leria atual!.x
  const ehMaisRecente = !atual || inicio >= atual.ultimaEm

  return {
    exercicioId,
    recordeCarga: Math.max(recordeAntes, melhorDaVez.carga),
    recordeReps: bateuCarga ? melhorDaVez.reps : (atual?.recordeReps ?? melhorDaVez.reps),
    recordeVolume: Math.max(atual?.recordeVolume ?? 0, volumeDaVez),
    ultimaCarga: ehMaisRecente ? melhorDaVez.carga : atual!.ultimaCarga,
    ultimaReps: ehMaisRecente ? melhorDaVez.reps : atual!.ultimaReps,
    ultimaEm: ehMaisRecente ? inicio : atual!.ultimaEm,
  }
}

/** Agrupa as series de uma sessao por exercicio, mantendo a ordem. */
export function porExercicio(series: SerieLog[]): Map<string, SerieLog[]> {
  const m = new Map<string, SerieLog[]>()
  for (const g of series) {
    const lista = m.get(g.exercicioId)
    if (lista) lista.push(g)
    else m.set(g.exercicioId, [g])
  }
  return m
}

/** Recalcula tudo do zero a partir das sessoes concluidas. */
export function calcularMelhores(sessoes: Sessao[]): MelhorExercicio[] {
  const mapa = new Map<string, MelhorExercicio>()
  const concluidas = sessoes.filter(s => s.concluida).sort((a, b) => a.inicio - b.inicio)

  for (const s of concluidas) {
    for (const [exId, series] of porExercicio(s.series)) {
      const novo = dobrarSessao(mapa.get(exId), exId, series, s.inicio)
      if (novo) mapa.set(exId, novo)
    }
  }
  return [...mapa.values()]
}
