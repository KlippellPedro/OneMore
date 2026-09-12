import type { Sessao } from '../db/types'

/**
 * Quais exercicios estao subindo e quais empacaram.
 *
 * A tela de cada exercicio ja mostra a curva de carga dele. Faltava a pergunta
 * que a pessoa realmente faz olhando o treino inteiro: "o que parou de subir?"
 * Abrir exercicio por exercicio pra descobrir isso nao acontece na pratica.
 *
 * O criterio e a melhor carga de cada sessao, comparando a media das sessoes
 * mais recentes com a media das anteriores. Media e nao "último valor" porque
 * um dia ruim (dormiu mal, treinou com pressa) nao e estagnacao.
 */

export type Tendencia = 'subindo' | 'parado' | 'caindo' | 'novo'

export interface Progressao {
  exercicioId: string
  /** Melhor carga na sessao mais recente. */
  atual: number
  /** Melhor carga de todos os tempos. */
  recorde: number
  /** Diferenca entre a media recente e a anterior, em kg. */
  delta: number
  tendencia: Tendencia
  sessoes: number
  ultimaData: string
}

/** Menos que isso e ruido de arredondamento de anilha, nao progresso. */
const MINIMO_KG = 1.5
/** Quantas sessoes entram em cada metade da comparacao. */
const JANELA = 3

export function calcularProgressao(sessoes: Sessao[]): Progressao[] {
  // melhor carga por exercicio por sessao, em ordem de tempo
  const porEx = new Map<string, { dia: string; carga: number }[]>()

  for (const s of sessoes) {
    if (!s.concluida) continue
    const dia = new Date(s.inicio).toISOString().slice(0, 10)
    const melhorNaSessao = new Map<string, number>()
    for (const g of s.series) {
      if (!g.feito || g.aquecimento || !g.carga) continue
      melhorNaSessao.set(g.exercicioId, Math.max(melhorNaSessao.get(g.exercicioId) ?? 0, g.carga))
    }
    for (const [exId, carga] of melhorNaSessao) {
      ;(porEx.get(exId) ?? porEx.set(exId, []).get(exId)!).push({ dia, carga })
    }
  }

  const saida: Progressao[] = []
  for (const [exercicioId, pontos] of porEx) {
    pontos.sort((a, b) => a.dia.localeCompare(b.dia))
    const cargas = pontos.map(p => p.carga)
    const recorde = Math.max(...cargas)
    const atual = cargas[cargas.length - 1]

    let tendencia: Tendencia = 'novo'
    let delta = 0
    // precisa de pelo menos duas sessoes de cada lado pra media significar algo
    if (pontos.length >= 4) {
      const recentes = cargas.slice(-JANELA)
      const anteriores = cargas.slice(-JANELA * 2, -JANELA)
      if (anteriores.length) {
        const media = (a: number[]) => a.reduce((t, v) => t + v, 0) / a.length
        delta = media(recentes) - media(anteriores)
        tendencia = delta >= MINIMO_KG ? 'subindo' : delta <= -MINIMO_KG ? 'caindo' : 'parado'
      }
    }

    saida.push({
      exercicioId, atual, recorde, delta, tendencia,
      sessoes: pontos.length,
      ultimaData: pontos[pontos.length - 1].dia,
    })
  }

  // quem treinou mais vezes primeiro: e o exercicio sobre o qual ha o que dizer
  return saida.sort((a, b) => b.sessoes - a.sessoes || b.recorde - a.recorde)
}

export const ROTULO_TENDENCIA: Record<Tendencia, { texto: string; cor: string }> = {
  subindo: { texto: 'subindo', cor: 'var(--color-good)' },
  parado: { texto: 'parado', cor: 'var(--color-warn)' },
  caindo: { texto: 'caindo', cor: 'var(--color-bad)' },
  novo: { texto: 'pouco histórico', cor: 'var(--color-muted)' },
}
