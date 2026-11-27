import { useEffect, useMemo, useState } from 'react'
import { useExercicios } from '../state/hooks'
import { GRUPOS, corGrupo, nomeGrupo, nomeEquip } from '../db/seedExercicios'
import { Sheet, Input, Chip, Btn, useAutoFoco } from './ui'
import { Icone } from './Icone'
import { FormExercicio } from './FormExercicio'
import { pl } from '../lib/format'
import type { Exercicio, GrupoMuscular } from '../db/types'

export function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function Seletor({
  aberto, fechar, onEscolher, onEscolherVarios, titulo = 'Escolher exercício', jaEscolhidos = [],
}: {
  aberto: boolean
  fechar: () => void
  onEscolher?: (ex: Exercicio) => void
  /**
   * Presente = escolhe varios de uma vez: cada toque marca, e um botao no pe
   * adiciona todos na ordem em que foram marcados. Montar um treino de 7
   * exercicios era abrir e fechar esta lista 7 vezes.
   */
  onEscolherVarios?: (exs: Exercicio[]) => void
  titulo?: string
  /**
   * Ids ja no treino. Escolhendo um so (troca, treino livre), ficam marcados
   * mas ainda dao pra escolher. Escolhendo varios, ficam travados: o mesmo
   * exercicio duas vezes na rotina embaralha a lista e a numeracao das series.
   */
  jaEscolhidos?: string[]
}) {
  const todos = useExercicios()
  const [busca, setBusca] = useState('')
  const [grupo, setGrupo] = useState<GrupoMuscular | 'todos' | 'favoritos'>('todos')
  const [marcados, setMarcados] = useState<string[]>([])
  const [criando, setCriando] = useState(false)
  const ref = useAutoFoco<HTMLInputElement>(aberto)
  const varios = !!onEscolherVarios

  // cada abertura comeca do zero - marcacao de ontem nao e escolha de hoje
  useEffect(() => { if (!aberto) setMarcados([]) }, [aberto])

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
  const mapa = useMemo(() => new Map(todos.map(e => [e.id, e])), [todos])

  function tocar(e: Exercicio) {
    if (!varios) return onEscolher?.(e)
    if (jaEscolhidos.includes(e.id)) return
    setMarcados(m => m.includes(e.id) ? m.filter(x => x !== e.id) : [...m, e.id])
  }

  function concluir() {
    const exs = marcados.map(id => mapa.get(id)).filter((e): e is Exercicio => !!e)
    if (exs.length) onEscolherVarios?.(exs)
  }

  return (
    <>
      <Sheet aberto={aberto} fechar={fechar} titulo={titulo} alto>
        <div className="sticky -top-4 -mx-5 px-5 pt-1 pb-3 bg-bg-soft z-10">
          <Input ref={ref} value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar exercício..." className="mb-3" />
          <div className="flex gap-1.5 overflow-x-auto -mx-5 px-5 pb-1">
            <Chip ativo={grupo === 'todos'} onClick={() => setGrupo('todos')}>Todos</Chip>
            <Chip ativo={grupo === 'favoritos'} onClick={() => setGrupo('favoritos')}>Favoritos</Chip>
            {gruposComItens.map(g => (
              <Chip key={g.id} ativo={grupo === g.id} cor={g.cor} onClick={() => setGrupo(g.id)}>
                {g.nome}
              </Chip>
            ))}
          </div>
        </div>

        {lista.length === 0 ? (
          <p className="text-center text-[13px] text-muted pt-10 pb-4">Nenhum exercício encontrado.</p>
        ) : (
          <div className="space-y-1.5">
            {lista.map(e => {
              const noTreino = jaEscolhidos.includes(e.id)
              const ordem = marcados.indexOf(e.id)
              const travado = varios && noTreino
              return (
                <button key={e.id} onClick={() => tocar(e)} disabled={travado} aria-pressed={varios ? ordem >= 0 : undefined}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                    ordem >= 0 ? 'bg-accent/10 border-accent/60' : 'bg-surface border-line/60 active:bg-surface-2'
                  } ${travado ? 'opacity-55' : ''}`}>
                  <span className="w-1 h-9 rounded-full shrink-0" style={{ background: corGrupo(e.grupo) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold truncate">{e.nome}</p>
                    <p className="text-[11.5px] text-muted truncate">
                      {nomeGrupo(e.grupo)} - {nomeEquip(e.equipamento)}{e.custom ? ' - meu' : ''}
                    </p>
                  </div>
                  {e.favorito && <Icone nome="estrela" preenchido tamanho={15} className="text-xp shrink-0" />}
                  {noTreino && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-good/15 text-good shrink-0">NO TREINO</span>
                  )}
                  {varios && !noTreino && (
                    <span className={`w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center text-[12px] font-black ${
                      ordem >= 0 ? 'grad-accent border-transparent text-white' : 'border-line text-transparent'
                    }`}>
                      {ordem >= 0 ? ordem + 1 : ''}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <button onClick={() => setCriando(true)}
          className="w-full mt-3 p-3 rounded-xl border border-dashed border-line text-left flex items-center gap-3 active:bg-surface-2">
          <span className="w-9 h-9 shrink-0 rounded-xl bg-accent/12 text-accent flex items-center justify-center">
            <Icone nome="mais" tamanho={18} traco={2.2} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[13.5px] font-semibold truncate">
              Criar {busca.trim() ? `"${busca.trim()}"` : 'um exercício novo'}
            </span>
            <span className="block text-[11.5px] text-muted">Não achou? Cadastre o seu e ele já entra aqui</span>
          </span>
        </button>

        {varios && (
          <div className="sticky bottom-0 -mx-5 px-5 pt-3 pb-3 mt-3 bg-bg-soft border-t border-line/60">
            <Btn variant="primary" size="lg" className="w-full" disabled={!marcados.length} onClick={concluir}>
              {marcados.length ? `Adicionar ${pl(marcados.length, 'exercício')}` : 'Toque nos exercícios pra marcar'}
            </Btn>
          </div>
        )}
      </Sheet>

      {/* fora do Sheet: dentro dele, o transform da animacao prenderia o fixed deste */}
      <FormExercicio aberto={criando} fechar={() => setCriando(false)} nomeInicial={busca.trim()}
        grupoInicial={grupo !== 'todos' && grupo !== 'favoritos' ? grupo : undefined}
        onSalvo={ex => {
          setBusca('')
          if (varios) setMarcados(m => [...m, ex.id])
          else onEscolher?.(ex)
        }} />
    </>
  )
}
