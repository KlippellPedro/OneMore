import { useLiveQuery } from 'dexie-react-hooks'
import { db, PERFIL_PADRAO, hoje } from '../db'
import { calcNivel, rankDoNivel } from '../lib/xp'
import type { Alimento, Exercicio } from '../db/types'

export function usePerfil() {
  return useLiveQuery(() => db.perfil.get('me'), [], PERFIL_PADRAO) ?? PERFIL_PADRAO
}

export function useNivel() {
  const p = usePerfil()
  const nivel = calcNivel(p.xp)
  return { ...nivel, rank: rankDoNivel(nivel.nivel), perfil: p }
}

export function useExercicios() {
  return useLiveQuery(() => db.exercicios.toArray(), [], [] as Exercicio[]) ?? []
}

export function useMapaExercicios() {
  const lista = useExercicios()
  return new Map(lista.map(e => [e.id, e]))
}

export function useAlimentos() {
  return useLiveQuery(() => db.alimentos.toArray(), [], [] as Alimento[]) ?? []
}

export function useMapaAlimentos() {
  const lista = useAlimentos()
  return new Map(lista.map(a => [a.id, a]))
}

export function useRotinas() {
  return useLiveQuery(
    () => db.rotinas.filter(r => !r.arquivada).sortBy('ordem'), [], [],
  ) ?? []
}

/** A sessao de treino em andamento, se houver. So pode existir uma. */
export function useSessaoAtiva() {
  return useLiveQuery(
    async () => (await db.sessoes.filter(s => !s.concluida).toArray())
      .sort((a, b) => b.inicio - a.inicio)[0] ?? null,
    [], null,
  )
}

export function useRegistrosDoDia(data: string = hoje()) {
  return useLiveQuery(
    () => db.dieta.where('data').equals(data).toArray(), [data], [],
  ) ?? []
}

export function useAguaDoDia(data: string = hoje()) {
  return useLiveQuery(() => db.agua.get(data), [data], undefined)
}

export function usePlanos() {
  return useLiveQuery(() => db.planos.orderBy('ordem').toArray(), [], []) ?? []
}
