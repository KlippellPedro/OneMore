import { db, uid, hoje, getPerfil } from '../db'
import type { Rotina, Sessao, SerieLog, Alimento, MomentoGlicemia } from '../db/types'
import type { Programa } from '../db/programas'
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
          reps: anterior?.reps ?? 0,
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

/** Desfaz uma refeicao inteira - tira do diario tudo que foi lancado nela naquele dia. */
export async function removerRefeicaoDoDia(data: string, refeicao: string) {
  const ids = await db.dieta.where('[data+refeicao]').equals([data, refeicao]).primaryKeys()
  await db.dieta.bulkDelete(ids)
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

/* ------------------------------------------------------------------ */
/* PROGRAMAS DE TREINO                                                 */
/* ------------------------------------------------------------------ */

/**
 * Transforma um programa da biblioteca em rotinas de verdade.
 * As rotinas antigas sao ARQUIVADAS, nunca apagadas - o historico de
 * treinos aponta pra elas e ficaria orfao.
 */
export async function aplicarPrograma(
  prog: Programa,
  opts: { substituir?: boolean; dias?: (number | null)[] } = {},
): Promise<Rotina[]> {
  if (opts.substituir) {
    const atuais = await db.rotinas.filter(r => !r.arquivada).toArray()
    for (const r of atuais) {
      await db.rotinas.update(r.id, { arquivada: true, atualizadoEm: Date.now() })
    }
  }

  const base = await db.rotinas.count()
  const dias = opts.dias ?? prog.sugestaoDias
  const rotinas: Rotina[] = prog.treinos.map((t, i) => {
    const d = dias[i]
    return {
      id: uid(),
      nome: t.nome,
      descricao: t.descricao,
      cor: t.cor,
      itens: t.itens,
      dias: d == null ? [] : [d],
      ordem: base + i,
      atualizadoEm: Date.now(),
    }
  })
  await db.rotinas.bulkPut(rotinas)
  return rotinas
}

/**
 * Coloca uma rotina num dia da semana. Cada dia tem no maximo uma rotina,
 * entao atribuir tira esse dia de quem estava nele antes.
 * rotinaId null = dia de descanso.
 */
export async function atribuirDia(dia: number, rotinaId: string | null) {
  const rotinas = await db.rotinas.filter(r => !r.arquivada).toArray()
  for (const r of rotinas) {
    const tinha = r.dias?.includes(dia) ?? false
    const deveTer = r.id === rotinaId
    if (tinha === deveTer) continue
    const dias = deveTer
      ? [...(r.dias ?? []), dia].sort()
      : (r.dias ?? []).filter(d => d !== dia)
    await db.rotinas.update(r.id, { dias, atualizadoEm: Date.now() })
  }
}

/* ------------------------------------------------------------------ */
/* GLICEMIA                                                            */
/* ------------------------------------------------------------------ */

/**
 * Anota uma medicao de glicemia (e, se houver, a insulina aplicada).
 * O app registra e mostra - nao calcula dose, razao nem correcao.
 */
export async function registrarGlicemia(dados: {
  valor: number
  momento: MomentoGlicemia
  insulinaUnidades?: number
  insulinaTipo?: 'rapida' | 'basal'
  carboG?: number
  obs?: string
}): Promise<GanhoXP | null> {
  const agora = Date.now()
  const data = hoje()
  await db.glicemia.put({
    id: uid(), data, ts: agora, atualizadoEm: agora, ...dados,
  })

  // XP so nas 4 primeiras do dia: recompensa o habito sem incentivar excesso
  const doDia = await db.glicemia.where('data').equals(data).count()
  if (doDia > 4) return null
  return darXP('glicemia', 'Glicemia registrada', XP.GLICEMIA)
}

export async function removerGlicemia(id: string) {
  await db.glicemia.delete(id)
}

/** Faixa de referencia mais usada pra tempo no alvo. Confirmar com o medico. */
export const FAIXA_ALVO = { min: 70, max: 180 }

export function classificarGlicemia(v: number) {
  if (v < 54) return { rotulo: 'Muito baixa', cor: 'var(--color-bad)' }
  if (v < FAIXA_ALVO.min) return { rotulo: 'Baixa', cor: 'var(--color-bad)' }
  if (v <= FAIXA_ALVO.max) return { rotulo: 'No alvo', cor: 'var(--color-good)' }
  if (v <= 250) return { rotulo: 'Alta', cor: 'var(--color-warn)' }
  return { rotulo: 'Muito alta', cor: 'var(--color-bad)' }
}

/**
 * Faixas no padrao internacional de "tempo no alvo" (consenso AGP/ATTD para
 * diabetes tipo 1: <54 muito baixa, 54-69 baixa, 70-180 alvo, 181-250 alta,
 * >250 muito alta). Aqui e "% das medicoes" - o app nao tem sensor continuo,
 * entao nao da pra falar em "% do tempo" de verdade, so por leitura.
 */
export const BANDAS_GLICEMIA = [
  { id: 'muito-baixa', teste: (v: number) => v < 54, rotulo: 'Muito baixa', legenda: '<54', cor: '#7f1d1d' },
  { id: 'baixa', teste: (v: number) => v >= 54 && v < FAIXA_ALVO.min, rotulo: 'Baixa', legenda: '54-69', cor: 'var(--color-bad)' },
  { id: 'alvo', teste: (v: number) => v >= FAIXA_ALVO.min && v <= FAIXA_ALVO.max, rotulo: 'No alvo', legenda: `${FAIXA_ALVO.min}-${FAIXA_ALVO.max}`, cor: 'var(--color-good)' },
  { id: 'alta', teste: (v: number) => v > FAIXA_ALVO.max && v <= 250, rotulo: 'Alta', legenda: '181-250', cor: 'var(--color-warn)' },
  { id: 'muito-alta', teste: (v: number) => v > 250, rotulo: 'Muito alta', legenda: '>250', cor: '#f97316' },
] as const

export interface EstatisticaGlicemia {
  total: number
  media: number
  desvio: number
  /** Coeficiente de variacao (%) - abaixo de 36% e considerado estavel. */
  cv: number
  minimo: number
  maximo: number
  bandas: { id: string; rotulo: string; legenda: string; cor: string; count: number; pct: number }[]
  pctAlvo: number
  porMomento: { momento: MomentoGlicemia; media: number; count: number }[]
}

/** Estatisticas do periodo, no formato que relatorios de glicemia (AGP, apps de CGM) costumam usar. */
export function estatisticasGlicemia(registros: { valor: number; momento: MomentoGlicemia }[]): EstatisticaGlicemia {
  const total = registros.length
  if (!total) {
    return {
      total: 0, media: 0, desvio: 0, cv: 0, minimo: 0, maximo: 0, pctAlvo: 0,
      bandas: BANDAS_GLICEMIA.map(b => ({ id: b.id, rotulo: b.rotulo, legenda: b.legenda, cor: b.cor, count: 0, pct: 0 })),
      porMomento: [],
    }
  }

  const valores = registros.map(r => r.valor)
  const media = valores.reduce((t, v) => t + v, 0) / total
  const variancia = valores.reduce((t, v) => t + (v - media) ** 2, 0) / total
  const desvio = Math.sqrt(variancia)

  const bandas = BANDAS_GLICEMIA.map(b => {
    const count = valores.filter(b.teste).length
    return { id: b.id, rotulo: b.rotulo, legenda: b.legenda, cor: b.cor, count, pct: count / total }
  })

  const porMomentoMapa = new Map<MomentoGlicemia, number[]>()
  for (const r of registros) {
    if (!porMomentoMapa.has(r.momento)) porMomentoMapa.set(r.momento, [])
    porMomentoMapa.get(r.momento)!.push(r.valor)
  }
  const porMomento = [...porMomentoMapa.entries()]
    .map(([momento, vs]) => ({ momento, media: vs.reduce((t, v) => t + v, 0) / vs.length, count: vs.length }))
    .sort((a, b) => b.count - a.count)

  return {
    total, media, desvio, cv: media ? (desvio / media) * 100 : 0,
    minimo: Math.min(...valores), maximo: Math.max(...valores),
    pctAlvo: bandas.find(b => b.id === 'alvo')!.pct,
    bandas, porMomento,
  }
}
