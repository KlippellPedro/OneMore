import { db, normalizarFlags, limparLapidesVelhas } from '../db'
import { resetarCacheSeed } from '../db/seed'
import { reconstruirMelhores } from './acoes'
import {
  fundirTabela, fundirLapides, lapidesDe, assinatura,
  type LinhaSync, type Lapide,
} from './fundir'

/* ------------------------------------------------------------------ */
/* BACKUP LOCAL (JSON)                                                 */
/* ------------------------------------------------------------------ */

export const VERSAO_BACKUP = 1

export interface Backup {
  app: 'onemore'
  versao: number
  criadoEm: string
  dados: Record<string, unknown[]>
}

/** O que entra no backup: dado que a pessoa criou. */
const TABELAS = [
  'exercicios', 'rotinas', 'sessoes', 'alimentos', 'planos', 'dietas',
  'dieta', 'corpo', 'xp', 'perfil', 'agua', 'glicemia',
  // as lapides viajam junto: sem elas o outro aparelho nao tem como saber que
  // um registro foi apagado, e a fusao o traria de volta
  'apagados',
] as const

/**
 * Tabelas derivadas: nao vao pro backup (sao recalculadas), mas TEM que ser
 * limpas junto. A agenda de lembretes ficava pra tras num "apagar tudo" e o
 * service worker seguia avisando de refeicao de um plano que nao existia mais.
 */
const TABELAS_DERIVADAS = ['lembretes', 'melhores'] as const

const limpar = (t: string) =>
  (db as unknown as Record<string, { clear(): Promise<void> }>)[t].clear()

export async function exportar(): Promise<Backup> {
  const dados: Record<string, unknown[]> = {}
  for (const t of TABELAS) {
    dados[t] = await (db as unknown as Record<string, { toArray(): Promise<unknown[]> }>)[t].toArray()
  }
  return { app: 'onemore', versao: VERSAO_BACKUP, criadoEm: new Date().toISOString(), dados }
}

export async function baixarBackup() {
  const backup = await exportar()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `onemore-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export interface ResultadoImport { tabelas: number; registros: number }

/** Substitui TUDO pelo conteudo do backup. */
export async function importar(backup: Backup): Promise<ResultadoImport> {
  if (backup?.app !== 'onemore' || !backup.dados) {
    throw new Error('Esse arquivo nao e um backup do OneMore.')
  }
  let registros = 0
  let tabelas = 0
  for (const t of TABELAS) {
    const linhas = backup.dados[t]
    if (!Array.isArray(linhas)) continue
    const tabela = (db as unknown as Record<string, {
      clear(): Promise<void>; bulkPut(v: unknown[]): Promise<unknown>
    }>)[t]
    await tabela.clear()
    if (linhas.length) await tabela.bulkPut(linhas)
    registros += linhas.length
    tabelas++
  }
  // um backup de antes da v6 traz `concluida`/`arquivada` como boolean, e nesse
  // formato a linha NAO entra no indice: as rotinas sumiriam da lista e o
  // historico ficaria invisivel. Normaliza antes de qualquer leitura
  await normalizarFlags()
  // o backup traz sessoes novas: os recordes derivados precisam ser refeitos,
  // e a agenda de lembretes velha aponta pra um plano que ja era
  await limpar('lembretes')
  await reconstruirMelhores()

  return { tabelas, registros }
}

export async function apagarTudo() {
  for (const t of [...TABELAS, ...TABELAS_DERIVADAS]) await limpar(t)
  localStorage.removeItem('onemore:seed')
  resetarCacheSeed()
}

/* ------------------------------------------------------------------ */
/* CONTA E NUVEM (API propria)                                         */
/* ------------------------------------------------------------------ */

/**
 * A API mora na mesma origem que serve o site (/api), entao nao ha URL pra
 * configurar nem CORS pra liberar. A sessao e um cookie HttpOnly: o token
 * nunca passa por JavaScript, por isso `credentials: 'include'` em tudo e
 * nenhuma chave e guardada aqui.
 */
const API = '/api'

export interface Usuario { email: string }

async function chamar<T>(rota: string, init: RequestInit = {}): Promise<T | null> {
  let r: Response
  try {
    r = await fetch(API + rota, {
      ...init,
      credentials: 'include',
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    })
  } catch {
    throw new Error('Sem conexao com o servidor.')
  }

  if (r.status === 204) return null
  const texto = await r.text()
  const corpo = texto ? JSON.parse(texto) : null
  if (!r.ok) throw new Error(corpo?.erro ?? `Erro ${r.status}.`)
  return corpo as T
}

export const usuarioAtual = () => chamar<Usuario>('/eu')

export const criarConta = (email: string, senha: string) =>
  chamar<Usuario>('/conta', { method: 'POST', body: JSON.stringify({ email, senha }) })

export const entrar = (email: string, senha: string) =>
  chamar<Usuario>('/sessao', { method: 'POST', body: JSON.stringify({ email, senha }) })

export const sair = () => chamar('/sessao', { method: 'DELETE' })

/* ------------------------------------------------------------------ */
/* SINCRONIZACAO POR FUSAO                                             */
/* ------------------------------------------------------------------ */

/**
 * Junta o que esta aqui com o que esta na nuvem, registro a registro, e grava
 * o resultado nos dois lados.
 *
 * O modelo antigo era substituicao - "enviar" jogava este aparelho por cima da
 * nuvem e "baixar" fazia o contrario. Treinar registrando no celular e depois
 * enviar do PC apagava o treino do celular, calado. Agora nada se perde: cada
 * linha e decidida pelo proprio carimbo de tempo, e so some de verdade o que
 * tem lapide (ver lib/fundir.ts).
 */
export function fundirBackups(local: Backup, nuvem: Backup): Backup {
  const lapides = fundirLapides(
    (local.dados.apagados ?? []) as Lapide[],
    (nuvem.dados.apagados ?? []) as Lapide[],
  )

  const dados: Record<string, unknown[]> = {}
  for (const t of TABELAS) {
    if (t === 'apagados') continue
    dados[t] = fundirTabela(
      (local.dados[t] ?? []) as LinhaSync[],
      (nuvem.dados[t] ?? []) as LinhaSync[],
      lapidesDe(lapides, t),
    )
  }
  dados.apagados = lapides

  return { app: 'onemore', versao: VERSAO_BACKUP, criadoEm: new Date().toISOString(), dados }
}

export interface ResultadoSync {
  quando: Date
  /** true = a nuvem estava vazia, entao este aparelho so publicou o que tinha. */
  primeiraVez: boolean
  /** Quantos registros entraram neste aparelho vindos da nuvem. */
  recebidos: number
  /** true = nada mudou dos dois lados, nem precisou reenviar. */
  semNovidade: boolean
}

/**
 * O caminho normal de sincronizar. Baixa, funde, grava aqui e publica - tudo
 * numa operacao so, pra nao existir mais "enviar por engano" nem "baixar por
 * engano".
 */
export async function sincronizar(): Promise<ResultadoSync> {
  const nuvem = await espiar()
  const local = await exportar()

  if (!nuvem) {
    await publicar(local)
    return { quando: marcarSync(), primeiraVez: true, recebidos: 0, semNovidade: false }
  }

  const fundido = fundirBackups(local, nuvem.backup)
  const antesLocal = assinatura(local.dados)
  const antesNuvem = assinatura(nuvem.backup.dados)
  const depois = assinatura(fundido.dados)

  const mudouAqui = depois !== antesLocal
  if (mudouAqui) await importar(fundido)

  if (depois !== antesNuvem) await publicar(fundido)

  const recebidos = mudouAqui ? contar(fundido.dados) - contar(local.dados) : 0
  return {
    quando: marcarSync(),
    primeiraVez: false,
    recebidos: Math.max(0, recebidos),
    semNovidade: !mudouAqui && depois === antesNuvem,
  }
}

const contar = (d: Record<string, unknown[]>) =>
  Object.values(d).reduce((t, linhas) => t + (linhas?.length ?? 0), 0)

async function publicar(backup: Backup) {
  await chamar<{ atualizadoEm: string }>('/dados', {
    method: 'PUT',
    body: JSON.stringify({ payload: backup }),
  })
}

function marcarSync(): Date {
  const agora = new Date()
  localStorage.setItem('onemore:sync', agora.toISOString())
  // aproveita a visita pra jogar fora lapide antiga demais pra importar
  limparLapidesVelhas().catch(() => {})
  return agora
}

export interface DadosNuvem { atualizadoEm: Date; backup: Backup }

export async function espiar(): Promise<DadosNuvem | null> {
  const r = await chamar<{ payload: Backup; atualizadoEm: string }>('/dados')
  if (!r) return null
  return { atualizadoEm: new Date(r.atualizadoEm), backup: r.payload }
}

export function ultimoSync(): Date | null {
  const s = localStorage.getItem('onemore:sync')
  return s ? new Date(s) : null
}

/* ------------------------------------------------------------------ */
/* SINCRONIZACAO AUTOMATICA                                            */
/* ------------------------------------------------------------------ */

const INTERVALO_MIN_MS = 2 * 60 * 1000

/**
 * Sincroniza sem incomodar: so se houver conta, so se houver internet, e no
 * maximo uma vez a cada dois minutos. Engole erro de proposito - se a rede
 * caiu, isso e problema de agora e nao motivo pra jogar um alerta na cara de
 * quem esta no meio de uma serie.
 */
export async function sincronizarEmSilencio(): Promise<ResultadoSync | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null

  const ultima = ultimoSync()
  if (ultima && Date.now() - ultima.getTime() < INTERVALO_MIN_MS) return null

  try {
    if (!(await usuarioAtual())) return null
    return await sincronizar()
  } catch {
    return null
  }
}

/**
 * Liga os gatilhos automaticos: ao abrir o app, ao voltar pra ele (trocar de
 * aba, destravar o celular) e quando a internet volta. Devolve a funcao que
 * desliga tudo.
 */
export function iniciarSyncAutomatico(aoSincronizar?: (r: ResultadoSync) => void) {
  let vivo = true

  const rodar = () => {
    if (!vivo) return
    sincronizarEmSilencio().then(r => { if (r && vivo && aoSincronizar) aoSincronizar(r) })
  }

  const aoVoltar = () => { if (document.visibilityState === 'visible') rodar() }

  rodar()
  document.addEventListener('visibilitychange', aoVoltar)
  window.addEventListener('online', rodar)

  return () => {
    vivo = false
    document.removeEventListener('visibilitychange', aoVoltar)
    window.removeEventListener('online', rodar)
  }
}
