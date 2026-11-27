/**
 * Semana de treino salva: o retrato das rotinas, a comparacao entre dois
 * retratos, o arquivo que a pessoa guarda fora do app e o plano de restaurar.
 *
 * Tudo aqui e funcao pura, sem banco - quem grava e lib/acoes.ts. Assim da pra
 * testar com `node --test` sem levar o Dexie junto.
 */
import type {
  Equipamento, Exercicio, GrupoMuscular, ItemRotina, Rotina, RotinaSalva,
} from '../db/types'

/** Copias automaticas guardadas. A mais velha sai quando entra uma nova. */
export const MAX_AUTOMATICAS = 5

export interface ConteudoSemana {
  rotinas: RotinaSalva[]
  exercicios?: Exercicio[]
}

/* ------------------------------------------------------------------ */
/* RETRATO                                                             */
/* ------------------------------------------------------------------ */

function copiarRotina(r: Rotina | RotinaSalva): RotinaSalva {
  const copia: RotinaSalva = {
    id: r.id,
    nome: r.nome,
    cor: r.cor,
    itens: r.itens.map(i => ({ ...i })),
    dias: [...(r.dias ?? [])],
    ordem: r.ordem,
  }
  if (r.descricao) copia.descricao = r.descricao
  return copia
}

/**
 * Foto tirada do celular vira data URL de centenas de KB. Repetida em cada
 * semana salva, e sincronizada, isso pesaria mais que todo o resto junto - o
 * exercicio volta sem a foto, com nome, musculo, execucao e video.
 */
function semFotoEmbutida(e: Exercicio): Exercicio {
  if (!e.imagemUrl?.startsWith('data:')) return { ...e }
  const { imagemUrl: _, ...resto } = e
  return resto
}

/** O que esta valendo agora: as rotinas ativas e os exercicios criados pela pessoa que elas usam. */
export function retratoDaSemana(rotinas: Rotina[], exercicios: Exercicio[]): Required<ConteudoSemana> {
  const ativas = rotinas.filter(r => !r.arquivada).sort((a, b) => a.ordem - b.ordem)
  const usados = new Set(ativas.flatMap(r => r.itens.map(i => i.exercicioId)))
  return {
    rotinas: ativas.map(copiarRotina),
    exercicios: exercicios.filter(e => e.custom && usados.has(e.id)).map(semFotoEmbutida),
  }
}

/** Forma canonica pra comparar: mesma ordem de chaves, rotinas por id. */
function canonica(s: ConteudoSemana) {
  return JSON.stringify([...s.rotinas]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(r => [r.id, r.nome, r.descricao ?? '', r.cor, [...(r.dias ?? [])].sort(), r.ordem,
      r.itens.map(i => [i.exercicioId, i.series, i.repsAlvo, i.cargaAlvo ?? 0, i.descansoSeg, i.obs ?? '', i.supersetId ?? ''])]))
}

/**
 * Mesmo treino? Ignora carimbos e os exercicios avulsos - so o que a pessoa ve
 * na tela. E o que evita encher a lista com copia automatica identica.
 */
export function mesmaSemana(a: ConteudoSemana, b: ConteudoSemana) {
  return canonica(a) === canonica(b)
}

export interface ResumoSemana {
  treinos: number
  exercicios: number
  series: number
  /** Dia da semana (0=Dom) -> nome do treino. */
  porDia: Map<number, RotinaSalva>
}

export function resumoSemana(s: ConteudoSemana): ResumoSemana {
  const porDia = new Map<number, RotinaSalva>()
  for (const r of [...s.rotinas].sort((a, b) => a.ordem - b.ordem)) {
    for (const d of r.dias ?? []) if (!porDia.has(d)) porDia.set(d, r)
  }
  return {
    treinos: s.rotinas.length,
    exercicios: s.rotinas.reduce((t, r) => t + r.itens.length, 0),
    series: s.rotinas.reduce((t, r) => t + r.itens.reduce((x, i) => x + i.series, 0), 0),
    porDia,
  }
}

/** Ids das copias automaticas que passaram do limite - as mais velhas. */
export function automaticasDemais(
  semanas: { id: string; auto?: string; criadoEm: number }[], max = MAX_AUTOMATICAS,
): string[] {
  return semanas
    .filter(s => s.auto)
    .sort((a, b) => b.criadoEm - a.criadoEm)
    .slice(max)
    .map(s => s.id)
}

/* ------------------------------------------------------------------ */
/* RESTAURAR                                                           */
/* ------------------------------------------------------------------ */

export interface PlanoRestauracao {
  /** Rotinas da semana salva, ativas de novo, com carimbo novo. */
  gravar: Rotina[]
  /** Ids das rotinas ativas agora que nao fazem parte da semana salva. */
  arquivar: string[]
  /** Exercicios criados pela pessoa que nao existem mais neste aparelho. */
  exercicios: Exercicio[]
}

/**
 * Restaurar devolve as MESMAS rotinas (mesmos ids): o historico de treinos
 * aponta pra elas e continua ligado. A que esta ativa e nao faz parte da
 * semana salva e arquivada, nunca apagada - mesmo motivo, e da pra trazer de
 * volta em Treino > Rotinas. O carimbo novo e o que faz a fusao levar a
 * restauracao pros outros aparelhos, inclusive por cima de uma lapide: rotina
 * editada depois de apagada conta como recriada (ver fundirTabela).
 */
export function planoDeRestauracao(
  atuais: Rotina[], semana: ConteudoSemana, exerciciosExistentes: Set<string>, agora: number,
): PlanoRestauracao {
  const ids = new Set(semana.rotinas.map(r => r.id))
  return {
    gravar: semana.rotinas.map(r => ({ ...copiarRotina(r), arquivada: 0, atualizadoEm: agora })),
    arquivar: atuais.filter(r => !r.arquivada && !ids.has(r.id)).map(r => r.id),
    exercicios: (semana.exercicios ?? [])
      .filter(e => !exerciciosExistentes.has(e.id))
      .map(e => ({ ...e, custom: true, atualizadoEm: agora })),
  }
}

/* ------------------------------------------------------------------ */
/* ARQUIVO                                                             */
/* ------------------------------------------------------------------ */

export const TIPO_ARQUIVO = 'semana'

export interface ArquivoSemana {
  app: 'onemore'
  tipo: typeof TIPO_ARQUIVO
  versao: 1
  criadoEm: string
  nome: string
  rotinas: RotinaSalva[]
  exercicios: Exercicio[]
}

export function paraArquivo(nome: string, s: ConteudoSemana, agora = new Date()): ArquivoSemana {
  return {
    app: 'onemore', tipo: TIPO_ARQUIVO, versao: 1, criadoEm: agora.toISOString(),
    nome, rotinas: s.rotinas.map(copiarRotina), exercicios: (s.exercicios ?? []).map(semFotoEmbutida),
  }
}

const GRUPOS_VALIDOS = new Set<GrupoMuscular>([
  'peito', 'costas', 'ombro', 'biceps', 'triceps', 'antebraco', 'quadriceps', 'posterior',
  'gluteo', 'adutores', 'panturrilha', 'abdomen', 'lombar', 'cardio', 'corpo-inteiro',
])
const EQUIPAMENTOS_VALIDOS = new Set<Equipamento>([
  'barra', 'halter', 'maquina', 'cabo', 'peso-corporal', 'kettlebell', 'elastico', 'anilha', 'cardio', 'outro',
])

type Bruto = Record<string, unknown>
const obj = (v: unknown): v is Bruto => !!v && typeof v === 'object' && !Array.isArray(v)
const texto = (v: unknown, max = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const textos = (v: unknown) => (Array.isArray(v) ? v.map(x => texto(x, 500)).filter((x): x is string => !!x) : [])

function lerItem(v: unknown): ItemRotina | null {
  if (!obj(v)) return null
  const exercicioId = texto(v.exercicioId, 120)
  if (!exercicioId) return null
  const item: ItemRotina = {
    exercicioId,
    series: Math.min(20, Math.max(1, Math.round(numero(v.series) ?? 3))),
    repsAlvo: texto(v.repsAlvo, 30) ?? '8-12',
    descansoSeg: Math.min(900, Math.max(0, Math.round(numero(v.descansoSeg) ?? 90))),
  }
  const carga = numero(v.cargaAlvo)
  if (carga && carga > 0) item.cargaAlvo = Math.min(999, carga)
  const obs = texto(v.obs)
  if (obs) item.obs = obs
  const ss = texto(v.supersetId, 60)
  if (ss) item.supersetId = ss
  return item
}

function lerRotina(v: unknown, indice: number): RotinaSalva | null {
  if (!obj(v)) return null
  const id = texto(v.id, 120)
  const nome = texto(v.nome, 120)
  if (!id || !nome) return null
  const cor = typeof v.cor === 'string' && /^#[0-9a-f]{3,8}$/i.test(v.cor) ? v.cor : '#8b6dd6'
  const dias = Array.isArray(v.dias)
    ? [...new Set(v.dias.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : []
  const itens = Array.isArray(v.itens) ? v.itens.map(lerItem).filter((i): i is ItemRotina => !!i) : []
  // o mesmo exercicio duas vezes quebra a lista do editor e a numeracao das series
  const vistos = new Set<string>()
  const r: RotinaSalva = {
    id, nome, cor, dias, ordem: numero(v.ordem) ?? indice,
    itens: itens.filter(i => !vistos.has(i.exercicioId) && vistos.add(i.exercicioId)).slice(0, 60),
  }
  const descricao = texto(v.descricao, 1000)
  if (descricao) r.descricao = descricao
  return r
}

function lerExercicio(v: unknown): Exercicio | null {
  if (!obj(v)) return null
  const id = texto(v.id, 120)
  const nome = texto(v.nome, 120)
  if (!id || !nome) return null
  const ex: Exercicio = {
    id, nome, custom: true,
    grupo: GRUPOS_VALIDOS.has(v.grupo as GrupoMuscular) ? v.grupo as GrupoMuscular : 'corpo-inteiro',
    equipamento: EQUIPAMENTOS_VALIDOS.has(v.equipamento as Equipamento) ? v.equipamento as Equipamento : 'outro',
    execucao: textos(v.execucao),
    erros: textos(v.erros),
    atualizadoEm: numero(v.atualizadoEm) ?? 0,
  }
  const video = texto(v.videoUrl, 500)
  if (video) ex.videoUrl = video
  const familia = texto(v.familia, 60)
  if (familia) ex.familia = familia
  if (Array.isArray(v.gruposSecundarios)) {
    ex.gruposSecundarios = v.gruposSecundarios.filter((g): g is GrupoMuscular => GRUPOS_VALIDOS.has(g as GrupoMuscular))
  }
  return ex
}

/** Cada dia tem no maximo um treino: o primeiro (pela ordem) fica com o dia. */
function semDiaRepetido(rotinas: RotinaSalva[]): RotinaSalva[] {
  const ocupados = new Set<number>()
  return [...rotinas].sort((a, b) => a.ordem - b.ordem).map(r => {
    const dias = (r.dias ?? []).filter(d => !ocupados.has(d))
    dias.forEach(d => ocupados.add(d))
    return { ...r, dias }
  })
}

export interface SemanaLida extends Required<ConteudoSemana> { nome: string }

/**
 * Le o arquivo que a pessoa escolheu. Aceita o arquivo da semana e tambem o
 * backup completo do Perfil - dele so sai o treino, sem tocar em dieta e
 * historico. Tudo e revalidado campo a campo: o arquivo pode ter vindo de
 * outra versao do app ou ter sido editado a mao.
 */
export function lerArquivoSemana(json: unknown): SemanaLida {
  if (!obj(json) || json.app !== 'onemore') {
    throw new Error('Esse arquivo não é do OneMore.')
  }

  let nome: string
  let rotinasBrutas: unknown[]
  let exerciciosBrutos: unknown[]
  if (json.tipo === TIPO_ARQUIVO) {
    nome = texto(json.nome, 80) ?? 'Semana do arquivo'
    rotinasBrutas = Array.isArray(json.rotinas) ? json.rotinas : []
    exerciciosBrutos = Array.isArray(json.exercicios) ? json.exercicios : []
  } else if (obj(json.dados)) {
    const quando = texto(json.criadoEm, 40)?.slice(0, 10)
    nome = quando ? `Do backup de ${quando.split('-').reverse().join('/')}` : 'Do backup'
    rotinasBrutas = Array.isArray(json.dados.rotinas)
      ? json.dados.rotinas.filter(r => obj(r) && !r.arquivada)
      : []
    exerciciosBrutos = Array.isArray(json.dados.exercicios)
      ? json.dados.exercicios.filter(e => obj(e) && e.custom)
      : []
  } else {
    throw new Error('Esse arquivo não tem treinos.')
  }

  const rotinas = semDiaRepetido(
    rotinasBrutas.slice(0, 40).map(lerRotina).filter((r): r is RotinaSalva => !!r),
  )
  if (!rotinas.length) throw new Error('Esse arquivo não tem nenhum treino.')

  const usados = new Set(rotinas.flatMap(r => r.itens.map(i => i.exercicioId)))
  const exercicios = exerciciosBrutos.map(lerExercicio)
    .filter((e): e is Exercicio => !!e && usados.has(e.id))
  return { nome, rotinas, exercicios }
}
