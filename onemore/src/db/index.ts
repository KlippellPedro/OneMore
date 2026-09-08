import Dexie, { type Table } from 'dexie'
import type {
  Exercicio, Rotina, Sessao, Alimento, PlanoRefeicao, DietaSalva,
  RegistroDieta, RegistroCorpo, EventoXP, Perfil, Agua, RegistroGlicemia,
} from './types'

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
  }
}

export const db = new OneMoreDB()

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
