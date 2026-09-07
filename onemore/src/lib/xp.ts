import { db, uid, hoje, isoDia, diffDias, getPerfil, salvarPerfil } from '../db'
import type { Perfil } from '../db/types'

/* ------------------------------------------------------------------ */
/* CURVA DE NIVEL                                                      */
/* ------------------------------------------------------------------ */

/** XP necessario para sair do nivel n e ir pro n+1. */
export function xpDoNivel(n: number) {
  return Math.round(100 * Math.pow(n, 1.35))
}

/** XP acumulado total necessario para ESTAR no nivel n. */
export function xpAcumuladoAte(n: number) {
  let t = 0
  for (let i = 1; i < n; i++) t += xpDoNivel(i)
  return t
}

export interface EstadoNivel {
  nivel: number
  xpNoNivel: number
  xpParaProximo: number
  progresso: number // 0..1
  xpTotal: number
}

export function calcNivel(xpTotal: number): EstadoNivel {
  let nivel = 1
  let restante = Math.max(0, Math.floor(xpTotal))
  while (restante >= xpDoNivel(nivel) && nivel < 999) {
    restante -= xpDoNivel(nivel)
    nivel++
  }
  const need = xpDoNivel(nivel)
  return {
    nivel,
    xpNoNivel: restante,
    xpParaProximo: need,
    progresso: need ? restante / need : 0,
    xpTotal,
  }
}

export interface Rank { nome: string; cor: string; min: number }

export const RANKS: Rank[] = [
  { nome: 'Ferro', cor: '#8b98a9', min: 1 },
  { nome: 'Bronze', cor: '#c07b42', min: 5 },
  { nome: 'Prata', cor: '#cfd8e3', min: 10 },
  { nome: 'Ouro', cor: '#ffc857', min: 20 },
  { nome: 'Platina', cor: '#5ee7c4', min: 35 },
  { nome: 'Diamante', cor: '#6cc5ff', min: 55 },
  { nome: 'Mestre', cor: '#c084fc', min: 80 },
  { nome: 'Lenda', cor: '#ff6b35', min: 100 },
]

export function rankDoNivel(nivel: number): Rank {
  let r = RANKS[0]
  for (const cand of RANKS) if (nivel >= cand.min) r = cand
  return r
}

/* ------------------------------------------------------------------ */
/* TABELA DE XP                                                        */
/* ------------------------------------------------------------------ */

export const XP = {
  SERIE: 6,
  TREINO: 60,
  PR_CARGA: 40,
  PR_REPS: 20,
  REFEICAO: 5,
  DIETA_OK: 50,
  PROTEINA_OK: 30,
  AGUA_OK: 15,
  PESO: 15,
  GLICEMIA: 10,
} as const

/** Streak multiplica tudo: 30 dias seguidos = 1.6x. */
export function multiplicadorStreak(streak: number) {
  return 1 + Math.min(streak, 30) * 0.02
}

export interface GanhoXP {
  xp: number
  motivo: string
  subiuNivel: boolean
  nivel: number
  conquistas: Conquista[]
}

/**
 * Registra XP, atualiza streak, checa level-up e conquistas.
 * Toda concessao de XP do app passa por aqui.
 */
export async function darXP(
  tipo: string,
  motivo: string,
  base: number,
): Promise<GanhoXP> {
  const perfil = await getPerfil()
  const hj = hoje()

  // streak: conta dias com QUALQUER atividade registrada
  let streak = perfil.streak
  if (perfil.ultimoDiaAtivo !== hj) {
    const d = perfil.ultimoDiaAtivo ? diffDias(perfil.ultimoDiaAtivo, hj) : 999
    streak = d === 1 ? perfil.streak + 1 : 1
  }

  const mult = multiplicadorStreak(streak)
  const xp = Math.round(base * mult)

  const antes = calcNivel(perfil.xp)
  const depois = calcNivel(perfil.xp + xp)

  await db.xp.put({ id: uid(), ts: Date.now(), tipo, motivo, xp, data: hj })
  const novo = await salvarPerfil({
    xp: perfil.xp + xp,
    streak,
    melhorStreak: Math.max(perfil.melhorStreak, streak),
    ultimoDiaAtivo: hj,
  })

  const conquistas = await checarConquistas(novo)

  return {
    xp,
    motivo,
    subiuNivel: depois.nivel > antes.nivel,
    nivel: depois.nivel,
    conquistas,
  }
}

/* ------------------------------------------------------------------ */
/* CONQUISTAS                                                          */
/* ------------------------------------------------------------------ */

export interface StatsConquista {
  treinos: number
  series: number
  volumeTotal: number
  streak: number
  melhorStreak: number
  diasDieta: number
  prs: number
  nivel: number
  exerciciosDistintos: number
  pesosRegistrados: number
}

export interface Conquista {
  id: string
  nome: string
  desc: string
  /** Nome do icone em components/Icone.tsx - nunca emoji. */
  icone: string
  xp: number
  alvo: number
  atual: (s: StatsConquista) => number
}

const c = (
  id: string, nome: string, desc: string, icone: string, xp: number,
  atual: (s: StatsConquista) => number, alvo: number,
): Conquista => ({ id, nome, desc, icone, xp, atual, alvo })

export const CONQUISTAS: Conquista[] = [
  c('t1', 'Primeiro Ferro', 'Conclua seu primeiro treino', 'chama', 50, s => s.treinos, 1),
  c('t10', 'Constante', 'Conclua 10 treinos', 'halter', 120, s => s.treinos, 10),
  c('t50', 'Veterano', 'Conclua 50 treinos', 'medalha', 400, s => s.treinos, 50),
  c('t100', 'Centuriao', 'Conclua 100 treinos', 'escudo', 900, s => s.treinos, 100),
  c('t250', 'Inabalavel', 'Conclua 250 treinos', 'montanha', 2500, s => s.treinos, 250),

  c('s500', 'Meio Milhar', 'Complete 500 series', 'grafico-linha', 200, s => s.series, 500),
  c('s2000', 'Maquina', 'Complete 2000 series', 'chip', 700, s => s.series, 2000),

  c('v50', '50 Toneladas', 'Levante 50.000 kg no total', 'anilha', 250, s => s.volumeTotal, 50000),
  c('v250', '250 Toneladas', 'Levante 250.000 kg no total', 'predio', 800, s => s.volumeTotal, 250000),
  c('v1m', 'Um Milhao', 'Levante 1.000.000 kg no total', 'planeta', 3000, s => s.volumeTotal, 1000000),

  c('st7', 'Semana Cheia', '7 dias seguidos de atividade', 'calendario', 150, s => s.melhorStreak, 7),
  c('st30', 'Mes Perfeito', '30 dias seguidos de atividade', 'lua', 600, s => s.melhorStreak, 30),
  c('st100', 'Disciplina', '100 dias seguidos de atividade', 'diamante', 2000, s => s.melhorStreak, 100),

  c('d7', 'Dieta na Regua', '7 dias batendo a meta de calorias', 'folha', 200, s => s.diasDieta, 7),
  c('d30', 'Chef do Shape', '30 dias batendo a meta de calorias', 'chapeu', 700, s => s.diasDieta, 30),

  c('pr10', 'Mais Forte', 'Bata 10 recordes de carga', 'foguete', 250, s => s.prs, 10),
  c('pr50', 'Evolucao Constante', 'Bata 50 recordes de carga', 'barras', 900, s => s.prs, 50),

  c('ex20', 'Explorador', 'Treine 20 exercicios diferentes', 'bussola', 150, s => s.exerciciosDistintos, 20),
  c('p10', 'Sob Controle', 'Registre seu peso 10 vezes', 'balanca', 120, s => s.pesosRegistrados, 10),

  c('n5', 'Aquecendo', 'Alcance o nivel 5', 'raio', 0, s => s.nivel, 5),
  c('n10', 'Prata', 'Alcance o nivel 10', 'estrela', 0, s => s.nivel, 10),
  c('n20', 'Ouro', 'Alcance o nivel 20', 'trofeu', 0, s => s.nivel, 20),
  c('n35', 'Platina', 'Alcance o nivel 35', 'hexagono', 0, s => s.nivel, 35),
  c('n50', 'Elite', 'Alcance o nivel 50', 'coroa', 0, s => s.nivel, 50),
]

export async function coletarStats(perfil?: Perfil): Promise<StatsConquista> {
  const p = perfil ?? await getPerfil()
  const sessoes = await db.sessoes.filter(s => s.concluida).toArray()

  let series = 0
  let volume = 0
  const exSet = new Set<string>()
  for (const s of sessoes) {
    for (const g of s.series) {
      if (!g.feito || g.aquecimento) continue
      series++
      volume += g.reps * g.carga
      exSet.add(g.exercicioId)
    }
  }

  const prs = await db.xp.filter(e => e.tipo === 'pr').count()
  const diasDieta = await db.xp.filter(e => e.tipo === 'dieta').count()
  const pesos = await db.corpo.filter(r => r.peso != null).count()

  return {
    treinos: sessoes.length,
    series,
    volumeTotal: volume,
    streak: p.streak,
    melhorStreak: p.melhorStreak,
    diasDieta,
    prs,
    nivel: calcNivel(p.xp).nivel,
    exerciciosDistintos: exSet.size,
    pesosRegistrados: pesos,
  }
}

/** Desbloqueia o que estiver batido e devolve SOMENTE as novas. */
export async function checarConquistas(perfil?: Perfil): Promise<Conquista[]> {
  const p = perfil ?? await getPerfil()
  const stats = await coletarStats(p)
  const novas: Conquista[] = []
  let bonus = 0

  for (const q of CONQUISTAS) {
    if (p.conquistas.includes(q.id)) continue
    if (q.atual(stats) >= q.alvo) {
      novas.push(q)
      bonus += q.xp
    }
  }

  if (novas.length) {
    // XP de conquista entra direto, sem multiplicador e sem recursao.
    const ids = [...p.conquistas, ...novas.map(n => n.id)]
    if (bonus > 0) {
      await db.xp.put({
        id: uid(), ts: Date.now(), tipo: 'conquista',
        motivo: novas.map(n => n.nome).join(', '), xp: bonus, data: isoDia(new Date()),
      })
    }
    await salvarPerfil({ conquistas: ids, xp: p.xp + bonus })
  }

  return novas
}
