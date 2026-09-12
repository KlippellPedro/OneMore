import Dexie, { type Table } from 'dexie'
import type {
  Exercicio, Rotina, Sessao, Alimento, PlanoRefeicao, DietaSalva,
  RegistroDieta, RegistroCorpo, EventoXP, Perfil, Agua, RegistroGlicemia,
  Lembrete, Apagado,
} from './types'
import { calcularMelhores, type MelhorExercicio } from './melhores'

export class OneMoreDB extends Dexie {
  exercicios!: Table<Exercicio, string>
  rotinas!: Table<Rotina, string>
  sessoes!: Table<Sessao, string>
  alimentos!: Table<Alimento, string>
  planos!: Table<PlanoRefeicao, string>
  dieta!: Table<RegistroDieta, string>
  corpo!: Table<RegistroCorpo, string>
  xp!: Table<EventoXP, string>
  perfil!: Table<Perfil, string>
  agua!: Table<Agua, string>
  glicemia!: Table<RegistroGlicemia, string>
  dietas!: Table<DietaSalva, string>
  lembretes!: Table<Lembrete, string>
  melhores!: Table<MelhorExercicio, string>
  apagados!: Table<Apagado, string>

  constructor() {
    super('onemore')
    this.version(1).stores({
      exercicios: 'id, nome, grupo, equipamento, favorito, custom',
      rotinas: 'id, nome, ordem, arquivada',
      sessoes: 'id, rotinaId, inicio, concluida',
      alimentos: 'id, nome, categoria, favorito, custom',
      planos: 'id, ordem',
      dieta: 'id, data, refeicao, alimentoId, [data+refeicao]',
      corpo: 'id, data',
      xp: 'id, ts, data, tipo',
      perfil: 'id',
      agua: 'id, data',
    })

    // v2: registro de glicemia e insulina (diabetes tipo 1)
    this.version(2).stores({
      glicemia: 'id, data, ts, momento',
    })

    // v3: cardapios salvos com nome, pra ter mais de uma dieta e alternar
    this.version(3).stores({
      dietas: 'id, nome, atualizadoEm',
    })

    // v4: agenda de lembretes - o service worker le essa tabela direto
    this.version(4).stores({
      lembretes: 'id, ts, tipo',
    })

    // v5: resumo por exercicio (recorde e ultima carga). Dado derivado: existe
    // so pra nao varrer o historico inteiro a cada exercicio. Ver db/melhores.ts
    this.version(5).stores({
      melhores: 'exercicioId',
    }).upgrade(async tx => {
      const sessoes = await tx.table('sessoes').toArray()
      const linhas = calcularMelhores(sessoes)
      if (linhas.length) await tx.table('melhores').bulkPut(linhas)
    })

    /**
     * v6: flags indexadas viram 0/1.
     *
     * `concluida` e `arquivada` eram boolean, e o IndexedDB nao aceita boolean
     * como chave: o indice existia no schema mas nao indexava nada, entao toda
     * consulta caia em varredura da tabela inteira.
     *
     * `favorito` e `custom` saem do schema em vez de virar 0/1: as duas listas
     * sao carregadas inteiras pra montar os mapas, o filtro acontece em memoria
     * e nunca passou por indice nenhum.
     */
    this.version(6).stores({
      exercicios: 'id, nome, grupo, equipamento',
      alimentos: 'id, nome, categoria',
    }).upgrade(async tx => {
      await tx.table('sessoes').toCollection().modify(s => { s.concluida = s.concluida ? 1 : 0 })
      await tx.table('rotinas').toCollection().modify(r => { r.arquivada = r.arquivada ? 1 : 0 })
    })

    /**
     * v7: lapides. A sincronizacao passou a fundir os dois lados em vez de um
     * sobrescrever o outro, e fusao sem lapide nunca apaga nada - o registro
     * que voce removeu aqui volta do outro aparelho na proxima sincronizacao.
     */
    this.version(7).stores({
      apagados: 'id, ts, tabela',
    })
  }
}

export const db = new OneMoreDB()

/** Converte pra 0/1 - o formato que o IndexedDB aceita indexar. */
export const flag = (v: unknown): 0 | 1 => (v ? 1 : 0)

/**
 * Poe as flags indexadas no formato certo. Alem da migracao v6, precisa rodar
 * depois de QUALQUER importacao: backup antigo chega com boolean/undefined, e
 * nesse formato a linha nao entra no indice - as rotinas sumiriam da lista e o
 * historico de treinos ficaria invisivel.
 */
export async function normalizarFlags() {
  await db.sessoes.toCollection().modify(s => { s.concluida = flag(s.concluida) })
  await db.rotinas.toCollection().modify(r => { r.arquivada = flag(r.arquivada) })
}

/** Tabelas que entram na sincronizacao e podem receber lapide. */
export type TabelaSync =
  | 'exercicios' | 'rotinas' | 'sessoes' | 'alimentos' | 'planos' | 'dietas'
  | 'dieta' | 'corpo' | 'xp' | 'agua' | 'glicemia'

/**
 * Apaga uma linha E registra a lapide, na mesma operacao. Use SEMPRE isto em
 * vez de db.<tabela>.delete() no que for sincronizado: um delete solto some
 * daqui e volta do outro aparelho na proxima fusao.
 */
export async function apagarLinha(tabela: TabelaSync, chave: string) {
  await (db[tabela] as Table<{ id: string }, string>).delete(chave)
  await db.apagados.put({ id: `${tabela}:${chave}`, tabela, chave, ts: Date.now() })
}

/** Igual a apagarLinha, pra varias chaves da mesma tabela. */
export async function apagarLinhas(tabela: TabelaSync, chaves: string[]) {
  if (!chaves.length) return
  await (db[tabela] as Table<{ id: string }, string>).bulkDelete(chaves)
  const ts = Date.now()
  await db.apagados.bulkPut(chaves.map(chave => ({ id: `${tabela}:${chave}`, tabela, chave, ts })))
}

/**
 * Lapide velha nao serve pra nada: se o outro aparelho passou meses sem
 * sincronizar, o registro dele ja e historia antiga de qualquer jeito.
 */
const DIAS_LAPIDE = 180

export async function limparLapidesVelhas() {
  const corte = Date.now() - DIAS_LAPIDE * 24 * 60 * 60 * 1000
  await db.apagados.where('ts').below(corte).delete()
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export const hoje = () => isoDia(new Date())

export function isoDia(d: Date) {
  // Data LOCAL, nao UTC. toISOString() joga o dia pra tras no Brasil.
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function diaMais(iso: string, delta: number) {
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(a, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  return isoDia(dt)
}

export function diffDias(a: string, b: string) {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  const da = Date.UTC(ay, am - 1, ad)
  const dbb = Date.UTC(by, bm - 1, bd)
  return Math.round((dbb - da) / 86400000)
}

export const PERFIL_PADRAO: Perfil = {
  id: 'me',
  nome: 'Jogador',
  sexo: 'M',
  alturaCm: 175,
  pesoKg: 75,
  atividade: 1.55,
  objetivo: 'manutencao',
  metaKcal: 2400,
  metaProt: 150,
  metaCarb: 260,
  metaGord: 75,
  metaAgua: 3000,
  metaTreinosSemana: 4,
  xp: 0,
  streak: 0,
  melhorStreak: 0,
  conquistas: [],
  atualizadoEm: Date.now(),
}

export async function getPerfil(): Promise<Perfil> {
  const p = await db.perfil.get('me')
  if (p) return p
  await db.perfil.put(PERFIL_PADRAO)
  return PERFIL_PADRAO
}

export async function salvarPerfil(patch: Partial<Perfil>) {
  const atual = await getPerfil()
  const novo = { ...atual, ...patch, id: 'me' as const, atualizadoEm: Date.now() }
  await db.perfil.put(novo)
  return novo
}
