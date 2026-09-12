import { db, normalizarFlags } from '../db'
import { resetarCacheSeed } from '../db/seed'
import { reconstruirMelhores } from './acoes'

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

/** Manda o estado local inteiro pra nuvem. */
export async function enviar(): Promise<Date> {
  const payload = await exportar()
  const r = await chamar<{ atualizadoEm: string }>('/dados', {
    method: 'PUT',
    body: JSON.stringify({ payload }),
  })
  const agora = new Date(r!.atualizadoEm)
  localStorage.setItem('onemore:sync', agora.toISOString())
  return agora
}

export interface DadosNuvem { atualizadoEm: Date; backup: Backup }

export async function espiar(): Promise<DadosNuvem | null> {
  const r = await chamar<{ payload: Backup; atualizadoEm: string }>('/dados')
  if (!r) return null
  return { atualizadoEm: new Date(r.atualizadoEm), backup: r.payload }
}

/** Puxa da nuvem e SUBSTITUI o que esta no aparelho. */
export async function baixar(): Promise<ResultadoImport> {
  const nuvem = await espiar()
  if (!nuvem) throw new Error('Nao ha nada salvo na nuvem ainda.')
  const r = await importar(nuvem.backup)
  localStorage.setItem('onemore:sync', new Date().toISOString())
  return r
}

export function ultimoSync(): Date | null {
  const s = localStorage.getItem('onemore:sync')
  return s ? new Date(s) : null
}
