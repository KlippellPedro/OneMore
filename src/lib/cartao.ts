import type { Sessao } from '../db/types'
import type { MelhorExercicio } from '../db/melhores'

/**
 * O cartao de amigos: o resumo que as pessoas que voce adicionou conseguem ver.
 * E montado AQUI, no aparelho, a partir do que ja existe - e so isto sai pra
 * conta dos outros. Dieta, peso, medidas, glicemia, saude e e-mail nunca
 * entram: nao ha campo pra eles, e o servidor descarta qualquer campo a mais
 * (validarCartao em servidor/amigos.js).
 *
 * Puro de proposito (sem Dexie), pra ser testado em cartao.test.mjs - inclusive
 * contra a validacao do servidor, pra os dois lados nao divergirem.
 */

export interface TreinoCartao {
  nome: string
  dia: string            // YYYY-MM-DD
  series: number
  volume: number         // kg
  minutos: number
}

export interface RecordeCartao { nome: string; carga: number; reps: number }

export interface Cartao {
  v: 1
  nome: string
  xp: number
  /** Como estava no perfil; quem le aplica streakVivo, porque o cartao envelhece. */
  streak: number
  melhorStreak: number
  ultimoDiaAtivo: string | null
  metaSemana: number
  treinos: number
  prs: number
  /** Dias com treino nas ultimas semanas, do mais novo pro mais velho. */
  dias: string[]
  ultimos: TreinoCartao[]
  recordes: RecordeCartao[]
}

/** Janela dos `dias`: 5 semanas cobrem a grade de 4 com folga de fuso. */
export const DIAS_NO_CARTAO = 35
const ULTIMOS = 5
const RECORDES = 3

const doIso = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d) }
export const paraIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const maisDias = (iso: string, n: number) => { const d = doIso(iso); d.setDate(d.getDate() + n); return paraIso(d) }

const um = (v: number) => Math.round(v * 10) / 10

export interface EntradaCartao {
  perfil: {
    nome: string; xp: number; streak: number; melhorStreak: number
    ultimoDiaAtivo?: string; metaTreinosSemana: number
  }
  /** Sessoes recentes (concluidas ou nao - as abertas sao ignoradas aqui). */
  sessoes: Sessao[]
  /** Contagens de toda a vida, de coletarStats. */
  treinos: number
  prs: number
  melhores: MelhorExercicio[]
  nomeDoExercicio: (id: string) => string | undefined
  hoje: string
}

export function montarCartao(e: EntradaCartao): Cartao {
  const corte = maisDias(e.hoje, -(DIAS_NO_CARTAO - 1))

  // treino que conta: concluido e com pelo menos uma serie de trabalho
  const validas = e.sessoes
    .filter(s => s.concluida === 1)
    .map(s => ({ s, feitas: s.series.filter(g => g.feito && !g.aquecimento) }))
    .filter(x => x.feitas.length > 0)
    .sort((a, b) => b.s.inicio - a.s.inicio)

  const dias = [...new Set(validas.map(x => paraIso(new Date(x.s.inicio))))]
    .filter(d => d >= corte && d <= e.hoje)

  const ultimos = validas.slice(0, ULTIMOS).map(({ s, feitas }) => ({
    nome: s.nome.trim().slice(0, 60) || 'Treino',
    dia: paraIso(new Date(s.inicio)),
    series: feitas.length,
    volume: um(feitas.reduce((t, g) => t + g.carga * g.reps, 0)),
    minutos: s.fim ? Math.min(1440, Math.max(0, Math.round((s.fim - s.inicio) / 60000))) : 0,
  }))

  const recordes = e.melhores
    .filter(m => m.recordeCarga > 0)
    .map(m => ({ m, nome: e.nomeDoExercicio(m.exercicioId)?.trim() ?? '' }))
    .filter(x => x.nome)
    .sort((a, b) => b.m.recordeCarga - a.m.recordeCarga)
    .slice(0, RECORDES)
    .map(({ m, nome }) => ({ nome: nome.slice(0, 60), carga: um(m.recordeCarga), reps: m.recordeReps }))

  return {
    v: 1,
    nome: e.perfil.nome.trim().slice(0, 40) || 'Jogador',
    xp: Math.max(0, Math.floor(e.perfil.xp)),
    streak: e.perfil.streak,
    melhorStreak: e.perfil.melhorStreak,
    ultimoDiaAtivo: e.perfil.ultimoDiaAtivo ?? null,
    metaSemana: e.perfil.metaTreinosSemana,
    treinos: e.treinos,
    prs: e.prs,
    dias,
    ultimos,
    recordes,
  }
}

/* ------------------------------------------------------------------ */
/* LEITURA (quem ve o cartao do amigo)                                 */
/* ------------------------------------------------------------------ */

/** Segunda-feira da semana de `iso` - a semana do app comeca na segunda. */
export function segundaDe(iso: string) {
  const dow = doIso(iso).getDay()
  return maisDias(iso, -(dow === 0 ? 6 : dow - 1))
}

/**
 * Treinos desta semana, contados por quem LE. O cartao pode ter dias de
 * atraso (o amigo nao abriu o app), entao "treinos da semana" guardado pronto
 * mostraria a semana passada como se fosse esta.
 */
export function treinosNaSemana(c: Pick<Cartao, 'dias'>, hoje: string) {
  const seg = segundaDe(hoje)
  return c.dias.filter(d => d >= seg && d <= hoje).length
}

/**
 * As 4 ultimas semanas, de segunda a domingo, da mais velha pra mais nova:
 * cada celula diz se treinou e se e futuro (o resto da semana atual).
 */
export function gradeDeDias(c: Pick<Cartao, 'dias'>, hoje: string, semanas = 4) {
  const feitos = new Set(c.dias)
  const inicio = maisDias(segundaDe(hoje), -7 * (semanas - 1))
  return Array.from({ length: semanas }, (_, s) =>
    Array.from({ length: 7 }, (_, d) => {
      const dia = maisDias(inicio, s * 7 + d)
      return { dia, treinou: feitos.has(dia), futuro: dia > hoje, hoje: dia === hoje }
    }))
}

/** "hoje", "ontem", "há 3 dias" - pra data de treino. */
export function quandoFoi(dia: string, hoje: string) {
  const n = Math.round((doIso(hoje).getTime() - doIso(dia).getTime()) / 86400000)
  if (n <= 0) return 'hoje'
  if (n === 1) return 'ontem'
  if (n < 7) return `há ${n} dias`
  const [, m, d] = dia.split('-')
  return `${d}/${m}`
}

/** "agora", "há 5 min", "há 2 h", "há 3 dias" - pra quando o cartao foi atualizado. */
export function haQuanto(ts: number, agora = Date.now()) {
  const min = Math.floor((agora - ts) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const dias = Math.floor(h / 24)
  return dias === 1 ? 'ontem' : `há ${dias} dias`
}

/** Tira o codigo de um link de convite colado inteiro, ou devolve o texto como veio. */
export function codigoDoTexto(texto: string) {
  const m = texto.match(/(?:convite|codigo)=([0-9A-Za-z-]+)/)
  return (m ? m[1] : texto).trim()
}
