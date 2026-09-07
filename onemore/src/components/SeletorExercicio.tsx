import { useMemo, useState } from 'react'
import { useExercicios } from '../state/hooks'
import { GRUPOS, corGrupo, nomeGrupo, nomeEquip } from '../db/seedExercicios'
import { Sheet, Input, Chip, useAutoFoco } from './ui'
import type { Exercicio, GrupoMuscular } from '../db/types'

export function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function Seletor({ aberto, fechar, onEscolher, titulo = 'Escolher exercicio', jaEscolhidos = [] }: {
  aberto: boolean
  fechar: () => void
  onEscolher: (ex: Exercicio) => void
  titulo?: string
  /** Ids ja na rotina - ficam marcados, mas ainda dao pra adicionar de novo. */
  jaEscolhidos?: string[]
}) {
  const todos = useExercicios()
  const [busca, setBusca] = useState('')
  const [grupo, setGrupo] = useState<GrupoMuscular | 'todos' | 'favoritos'>('todos')
  const ref = useAutoFoco<HTMLInputElement>(aberto)

  const lista = useMemo(() => {
    const q = normalizar(busca.trim())
    return todos
      .filter(e => {
        if (grupo === 'favoritos' && !e.favorito) return false
        if (grupo !== 'todos' && grupo !== 'favoritos' && e.grupo !== grupo) return false
        if (!q) return true
        return normalizar(e.nome).includes(q) || normalizar(nomeGrupo(e.grupo)).includes(q)
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [todos, busca, grupo])

  const gruposComItens = GRUPOS.filter(g => todos.some(e => e.grupo === g.id))

  return (
    <Sheet aberto={aberto} fechar={fechar} titulo={titulo} alto>
      <div className="sticky -top-4 -mx-5 px-5 pt-1 pb-3 bg-bg-soft z-10">
        <Input ref={ref} value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar exercicio..." className="mb-3" />
        <div className="flex gap-1.5 overflow-x-auto -mx-5 px-5 pb-1">
          <Chip ativo={grupo === 'todos'} onClick={() => setGrupo('todos')}>Todos</Chip>
          <Chip ativo={grupo === 'favoritos'} onClick={() => setGrupo('favoritos')}>★ Favoritos</Chip>
          {gruposComItens.map(g => (
            <Chip key={g.id} ativo={grupo === g.id} cor={g.cor} onClick={() => setGrupo(g.id)}>
              {g.nome}
            </Chip>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="text-center text-[13px] text-muted py-10">Nenhum exercicio encontrado.</p>
      ) : (
        <div className="space-y-1.5">
          {lista.map(e => (
            <button key={e.id} onClick={() => onEscolher(e)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface border border-line/60 text-left active:bg-surface-2">
              <span className="w-1 h-9 rounded-full shrink-0" style={{ background: corGrupo(e.grupo) }} />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold truncate">{e.nome}</p>
                <p className="text-[11.5px] text-muted truncate">
                  {nomeGrupo(e.grupo)} - {nomeEquip(e.equipamento)}
                </p>
              </div>
              {e.favorito && <span className="text-xp text-sm shrink-0">★</span>}
              {jaEscolhidos.includes(e.id) && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-good/15 text-good shrink-0">NA LISTA</span>
              )}
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}
