import { db, uid, hoje, getPerfil } from '../db'
import type { Rotina, Sessao, SerieLog, Alimento } from '../db/types'
import { darXP, XP, type GanhoXP } from './xp'
import { macrosDe, totalDoDia, diaBatido, paraGramas } from './nutricao'

/* ------------------------------------------------------------------ */
/* TREINO                                                              */
/* ------------------------------------------------------------------ */

/** Cria a sessao a partir de uma rotina, ja com as series planejadas. */
export async function iniciarSessao(rotina?: Rotina, nomeLivre?: string): Promise<string> {
  // so pode existir uma sessao aberta; a anterior vira lixo se estiver vazia
  const abertas = await db.sessoes.filter(s => !s.concluida).toArray()
  for (const a of abertas) {
    if (a.series.every(s => !s.feito)) await db.sessoes.delete(a.id)
  }

  const series: SerieLog[] = []
  if (rotina) {
    for (const item of rotina.itens) {
      const anterior = await ultimaCarga(item.exercicioId)
      for (let i = 1; i <= item.series; i++) {
        series.push({
          exercicioId: item.exercicioId,
          serie: i,
          reps: 0,
          carga: anterior?.carga ?? item.cargaAlvo ?? 0,
          feito: false,
        })
      }
    }
  }

  const id = uid()
  await db.sessoes.put({
    id,
    rotinaId: rotina?.id,
    nome: nomeLivre ?? rotina?.nome ?? 'Treino livre',
    inicio: Date.now(),
    series,
    concluida: false,
    atualizadoEm: Date.now(),
  })
  return id
}

/** Ultima carga usada num exercicio (pra ja vir preenchido na proxima). */
export async function ultimaCarga(exercicioId: string): Promise<{ carga: number; reps: number } | null> {
  const sessoes = await db.sessoes.filter(s => s.concluida).toArray()
  sessoes.sort((a, b) => b.inicio - a.inicio)
  for (const s of sessoes) {
    const feitas = s.series.filter(g => g.exercicioId === exercicioId && g.feito && !g.aquecimento)
    if (feitas.length) {
      const melhor = feitas.reduce((a, b) => (b.carga > a.carga ? b : a))
      return { carga: melhor.carga, reps: melhor.reps }
    }
  }
  return null
}

export interface Recorde { carga: number; reps: number; volume: number }

/** Melhor marca historica de um exercicio (ignora a sessao informada). */
export async function recordeDe(exercicioId: string, exceto?: string): Promise<Recorde> {
  const sessoes = await db.sessoes.filter(s => s.concluida && s.id !== exceto).toArray()
  let carga = 0, reps = 0, volume = 0
  for (const s of sessoes) {
    for (const g of s.series) {
      if (g.exercicioId !== exercicioId || !g.feito || g.aquecimento) continue
      if (g.carga > carga) { carga = g.carga; reps = g.reps }
      volume = Math.max(volume, g.carga * g.reps)
    }
  }
  return { carga, reps, volume }
}

export interface ResumoSessao {
  series: number
  volume: number
  duracaoMs: number
  prs: { exercicioId: string; carga: number; anterior: number }[]
  ganho: GanhoXP
}

/** Fecha o treino: conta volume, detecta recordes e distribui XP. */
export async function concluirSessao(id: string): Promise<ResumoSessao | null> {
  const s = await db.sessoes.get(id)
  if (!s || s.concluida) return null

  const feitas = s.series.filter(g => g.feito && !g.aquecimento)
  const volume = feitas.reduce((t, g) => t + g.reps * g.carga, 0)

  // recordes: compara com o historico ANTES de marcar essa sessao como concluida
  const prs: ResumoSessao['prs'] = []
  const porExercicio = new Map<string, number>()
  for (const g of feitas) {
    porExercicio.set(g.exercicioId, Math.max(porExercicio.get(g.exercicioId) ?? 0, g.carga))
  }
  for (const [exId, carga] of porExercicio) {
    if (carga <= 0) continue
    const rec = await recordeDe(exId, id)
    if (rec.carga > 0 && carga > rec.carga) prs.push({ exercicioId: exId, carga, anterior: rec.carga })
  }

  const fim = Date.now()
  const baseXP = XP.TREINO + feitas.length * XP.SERIE + prs.length * XP.PR_CARGA

  await db.sessoes.update(id, { concluida: true, fim, atualizadoEm: fim })

  for (const pr of prs) {
    await db.xp.put({
      id: uid(), ts: fim, tipo: 'pr', xp: 0, data: hoje(),
      motivo: `Recorde: ${pr.carga} kg`,
    })
  }

  const motivo = prs.length
    ? `${feitas.length} series - ${prs.length} recorde${prs.length > 1 ? 's' : ''}!`
    : `${feitas.length} series concluidas`
  const ganho = await darXP('treino', motivo, baseXP)
  await db.sessoes.update(id, { xpGanho: ganho.xp })

  return { series: feitas.length, volume, duracaoMs: fim - s.inicio, prs, ganho }
}

export async function descartarSessao(id: string) {
  await db.sessoes.delete(id)
}

/** Volume total de uma sessao (usado em varios lugares). */
export function volumeSessao(s: Sessao) {
  return s.series
    .filter(g => g.feito && !g.aquecimento)
    .reduce((t, g) => t + g.reps * g.carga, 0)
}

/* ------------------------------------------------------------------ */
/* DIETA                                                               */
/* ------------------------------------------------------------------ */

export async function registrarAlimento(
  data: string, refeicao: string, alimento: Alimento, qtd: number, medida: string,
) {
  const gramas = paraGramas(alimento, qtd, medida)
  await db.dieta.put({
    id: uid(), data, refeicao, alimentoId: alimento.id,
    qtd, medida, gramas, ts: Date.now(), atualizadoEm: Date.now(),
  })
  return macrosDe(alimento, gramas)
}

export async function removerRegistro(id: string) {
  await db.dieta.delete(id)
}

/**
 * Checa se o dia bateu as metas e concede o XP diario (uma vez por dia).
 * Chamado depois de qualquer alteracao no diario.
 */
export async function checarMetasDoDia(data: string): Promise<GanhoXP[]> {
  if (data !== hoje()) return []   // so premia o dia corrente
  const perfil = await getPerfil()
  const registros = await db.dieta.where('data').equals(data).toArray()
  if (!registros.length) return []

  const alimentos = await db.alimentos.toArray()
  const mapa = new Map(alimentos.map(a => [a.id, a]))
  const total = totalDoDia(registros, mapa)
  const { kcalOk, protOk } = diaBatido(total, perfil)

  const jaDados = await db.xp.where('data').equals(data).toArray()
  const tem = (t: string) => jaDados.some(e => e.tipo === t)

  const ganhos: GanhoXP[] = []
  if (protOk && !tem('proteina')) {
    ganhos.push(await darXP('proteina', 'Meta de proteina batida', XP.PROTEINA_OK))
  }
  if (kcalOk && protOk && !tem('dieta')) {
    ganhos.push(await darXP('dieta', 'Dia de dieta na regua', XP.DIETA_OK))
  }
  return ganhos
}

/* ------------------------------------------------------------------ */
/* AGUA E CORPO                                                        */
/* ------------------------------------------------------------------ */

export async function addAgua(ml: number, data = hoje()): Promise<GanhoXP | null> {
  const atual = await db.agua.get(data)
  const novo = Math.max(0, (atual?.ml ?? 0) + ml)
  await db.agua.put({ id: data, data, ml: novo, atualizadoEm: Date.now() })

  if (data !== hoje()) return null
  const perfil = await getPerfil()
  const jaDados = await db.xp.where('data').equals(data).toArray()
  if (novo >= perfil.metaAgua && !jaDados.some(e => e.tipo === 'agua')) {
    return darXP('agua', 'Meta de agua batida', XP.AGUA_OK)
  }
  return null
}

export async function registrarCorpo(
  data: string, dados: { peso?: number; gorduraPct?: number; cintura?: number; braco?: number; peito?: number; coxa?: number; quadril?: number },
): Promise<GanhoXP | null> {
  const existente = await db.corpo.get(data)
  await db.corpo.put({ id: data, data, ...existente, ...dados, atualizadoEm: Date.now() })

  // o peso do perfil acompanha o ultimo registro (as metas dependem dele)
  if (dados.peso) {
    const perfil = await getPerfil()
    const ultimos = await db.corpo.orderBy('data').toArray()
    const maisRecente = ultimos.filter(r => r.peso).pop()
    if (maisRecente?.data === data && perfil.pesoKg !== dados.peso) {
      await db.perfil.update('me', { pesoKg: dados.peso })
    }
  }

  if (!existente && data === hoje()) {
    return darXP('peso', 'Medidas registradas', XP.PESO)
  }
  return null
}
