import type { SupabaseClient } from '@supabase/supabase-js'
import { db, getPerfil, salvarPerfil } from '../db'

/* ------------------------------------------------------------------ */
/* BACKUP LOCAL (JSON)                                                 */
/* ------------------------------------------------------------------ */

export const VERSAO_BACKUP = 1

export interface Backup {
  app: 'forja'
  versao: number
  criadoEm: string
  dados: Record<string, unknown[]>
}

const TABELAS = [
  'exercicios', 'rotinas', 'sessoes', 'alimentos', 'planos',
  'dieta', 'corpo', 'xp', 'perfil', 'agua',
] as const

export async function exportar(): Promise<Backup> {
  const dados: Record<string, unknown[]> = {}
  for (const t of TABELAS) {
    dados[t] = await (db as unknown as Record<string, { toArray(): Promise<unknown[]> }>)[t].toArray()
  }
  return { app: 'forja', versao: VERSAO_BACKUP, criadoEm: new Date().toISOString(), dados }
}

export async function baixarBackup() {
  const backup = await exportar()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `forja-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export interface ResultadoImport { tabelas: number; registros: number }

/** Substitui TUDO pelo conteudo do backup. */
export async function importar(backup: Backup): Promise<ResultadoImport> {
  if (backup?.app !== 'forja' || !backup.dados) {
    throw new Error('Esse arquivo nao e um backup do Forja.')
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
  return { tabelas, registros }
}

export async function apagarTudo() {
  for (const t of TABELAS) {
    await (db as unknown as Record<string, { clear(): Promise<void> }>)[t].clear()
  }
  localStorage.removeItem('forja:seed')
}

/* ------------------------------------------------------------------ */
/* SUPABASE                                                            */
/* ------------------------------------------------------------------ */

export const SQL_SUPABASE = `-- Cole isso no SQL Editor do seu projeto Supabase e clique em Run.
create table if not exists public.forja_dados (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  atualizado_em timestamptz not null default now()
);

alter table public.forja_dados enable row level security;

drop policy if exists "dono le" on public.forja_dados;
create policy "dono le" on public.forja_dados
  for select using (auth.uid() = user_id);

drop policy if exists "dono grava" on public.forja_dados;
create policy "dono grava" on public.forja_dados
  for insert with check (auth.uid() = user_id);

drop policy if exists "dono atualiza" on public.forja_dados;
create policy "dono atualiza" on public.forja_dados
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);`

let cliente: SupabaseClient | null = null
let chaveCliente = ''

export async function getCliente(): Promise<SupabaseClient | null> {
  const p = await getPerfil()
  if (!p.supabaseUrl || !p.supabaseKey) return null
  const chave = p.supabaseUrl + '|' + p.supabaseKey
  if (!cliente || chaveCliente !== chave) {
    // carregado sob demanda: o supabase-js sozinho dobra o tamanho do bundle
    const { createClient } = await import('@supabase/supabase-js')
    cliente = createClient(p.supabaseUrl, p.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'forja-auth' },
    })
    chaveCliente = chave
  }
  return cliente
}

export async function salvarCredenciais(url: string, key: string) {
  cliente = null
  await salvarPerfil({
    supabaseUrl: url.trim().replace(/\/+$/, '') || undefined,
    supabaseKey: key.trim() || undefined,
  })
}

export async function usuarioAtual() {
  const c = await getCliente()
  if (!c) return null
  const { data } = await c.auth.getUser()
  return data.user ?? null
}

export async function entrar(email: string, senha: string) {
  const c = await getCliente()
  if (!c) throw new Error('Configure a URL e a chave do Supabase primeiro.')
  const { data, error } = await c.auth.signInWithPassword({ email, password: senha })
  if (error) throw new Error(traduzir(error.message))
  return data.user
}

export async function criarConta(email: string, senha: string) {
  const c = await getCliente()
  if (!c) throw new Error('Configure a URL e a chave do Supabase primeiro.')
  const { data, error } = await c.auth.signUp({ email, password: senha })
  if (error) throw new Error(traduzir(error.message))
  return data.user
}

export async function sair() {
  const c = await getCliente()
  await c?.auth.signOut()
}

/** Manda o estado local inteiro pra nuvem. */
export async function enviar(): Promise<Date> {
  const c = await getCliente()
  if (!c) throw new Error('Supabase nao configurado.')
  const { data: u } = await c.auth.getUser()
  if (!u.user) throw new Error('Entre na sua conta primeiro.')

  const payload = await exportar()
  const { error } = await c.from('forja_dados').upsert({
    user_id: u.user.id,
    payload,
    atualizado_em: new Date().toISOString(),
  })
  if (error) throw new Error(traduzir(error.message))

  const agora = new Date()
  localStorage.setItem('forja:sync', agora.toISOString())
  return agora
}

export interface DadosNuvem { atualizadoEm: Date; backup: Backup }

export async function espiar(): Promise<DadosNuvem | null> {
  const c = await getCliente()
  if (!c) throw new Error('Supabase nao configurado.')
  const { data: u } = await c.auth.getUser()
  if (!u.user) throw new Error('Entre na sua conta primeiro.')

  const { data, error } = await c.from('forja_dados')
    .select('payload, atualizado_em').eq('user_id', u.user.id).maybeSingle()
  if (error) throw new Error(traduzir(error.message))
  if (!data) return null
  return { atualizadoEm: new Date(data.atualizado_em), backup: data.payload as Backup }
}

/** Puxa da nuvem e SUBSTITUI o que esta no aparelho. */
export async function baixar(): Promise<ResultadoImport> {
  const nuvem = await espiar()
  if (!nuvem) throw new Error('Nao ha nada salvo na nuvem ainda.')
  const r = await importar(nuvem.backup)
  localStorage.setItem('forja:sync', new Date().toISOString())
  return r
}

export function ultimoSync(): Date | null {
  const s = localStorage.getItem('forja:sync')
  return s ? new Date(s) : null
}

function traduzir(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.'
  if (m.includes('already registered')) return 'Ja existe uma conta com esse e-mail.'
  if (m.includes('password should be')) return 'A senha precisa de pelo menos 6 caracteres.'
  if (m.includes('email not confirmed')) return 'Confirme o e-mail que o Supabase enviou antes de entrar.'
  if (m.includes('relation') && m.includes('does not exist')) {
    return 'A tabela forja_dados nao existe. Rode o SQL de instalacao no Supabase.'
  }
  if (m.includes('failed to fetch')) return 'Sem conexao com o Supabase. Confira a URL e a internet.'
  return msg
}
