import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { db, uid } from '../db'
import { useRotinas, useMapaExercicios, useSessaoAtiva } from '../state/hooks'
import { iniciarSessao } from '../lib/acoes'
import { corGrupo, nomeGrupo } from '../db/seedExercicios'
import { Titulo } from '../components/Cabecalho'
import { Card, Btn, Vazio, Confirmar, Sheet, Campo, Input, Chip } from '../components/ui'
import { useUI, vibrar } from '../state/ui'
import { diaCurto, pl } from '../lib/format'
import type { GrupoMuscular } from '../db/types'

const CORES = ['#ff6b35', '#4dabf7', '#3ddc97', '#ffc857', '#c084fc', '#ff5470', '#22d3ee', '#a3e635']

export default function Treinos() {
  const nav = useNavigate()
  const { toast } = useUI()
  const rotinas = useRotinas()
  const mapaEx = useMapaExercicios()
  const sessaoAtiva = useSessaoAtiva()
  const [novo, setNovo] = useState(false)
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(CORES[0])
  const [dias, setDias] = useState<number[]>([])
  const [apagar, setApagar] = useState<string | null>(null)

  async function criar() {
    if (!nome.trim()) return toast('Da um nome pro treino', 'erro')
    const id = uid()
    await db.rotinas.put({
      id, nome: nome.trim(), cor, dias, itens: [],
      ordem: rotinas.length, atualizadoEm: Date.now(),
    })
    setNovo(false); setNome(''); setDias([]); setCor(CORES[0])
    nav(`/treinos/${id}`)
  }

  async function comecar(rotinaId: string) {
    const r = rotinas.find(x => x.id === rotinaId)
    if (!r) return
    if (!r.itens.length) return toast('Esse treino esta vazio', 'erro', 'Adicione exercicios primeiro')
    vibrar(20)
    const id = await iniciarSessao(r)
    nav(`/sessao/${id}`)
  }

  async function confirmarApagar() {
    if (apagar) await db.rotinas.delete(apagar)
    setApagar(null)
    toast('Treino removido', 'ok')
  }

  return (
    <div>
      <Titulo titulo="Meus treinos" sub={`${rotinas.length} rotina${rotinas.length === 1 ? '' : 's'}`}
        acao={<Btn variant="primary" size="sm" onClick={() => setNovo(true)}>+ Novo</Btn>} />

      <div className="px-4">
        {sessaoAtiva && (
          <Card className="p-4 mb-4 border-accent/40 bg-accent/8" onClick={() => nav(`/sessao/${sessaoAtiva.id}`)}>
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              <p className="flex-1 text-[14px] font-bold truncate">{sessaoAtiva.nome}</p>
              <span className="text-accent text-sm font-bold">Continuar</span>
            </div>
          </Card>
        )}

        {rotinas.length === 0 ? (
          <Vazio icone="🏋️" titulo="Nenhum treino ainda"
            texto="Crie uma rotina, escolha os exercicios e defina series e repeticoes."
            acao={<Btn variant="primary" onClick={() => setNovo(true)}>Criar treino</Btn>} />
        ) : (
          <div className="space-y-3">
            {rotinas.map(r => {
              const grupos = [...new Set(
                r.itens.map(i => mapaEx.get(i.exercicioId)?.grupo).filter(Boolean) as GrupoMuscular[],
              )].slice(0, 4)
              const totalSeries = r.itens.reduce((t, i) => t + i.series, 0)
              return (
                <Card key={r.id} className="overflow-hidden">
                  <div className="flex">
                    <div className="w-1.5 shrink-0" style={{ background: r.cor }} />
                    <div className="flex-1 min-w-0 p-4">
                      <div className="flex items-start gap-2 mb-2">
                        <Link to={`/treinos/${r.id}`} className="flex-1 min-w-0">
                          <p className="font-bold text-[15px] leading-tight">{r.nome}</p>
                          <p className="text-[11.5px] text-muted mt-1">
                            {pl(r.itens.length, 'exercicio')} - {pl(totalSeries, 'serie')}
                            {r.dias?.length ? ' - ' + r.dias.map(diaCurto).join(', ') : ''}
                          </p>
                        </Link>
                        <button onClick={() => setApagar(r.id)}
                          className="w-8 h-8 shrink-0 rounded-lg text-muted active:bg-surface-2 text-lg leading-none">
                          ×
                        </button>
                      </div>

                      {grupos.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {grupos.map(g => (
                            <span key={g} className="text-[10.5px] font-semibold px-2 py-0.5 rounded-md"
                              style={{ background: corGrupo(g) + '22', color: corGrupo(g) }}>
                              {nomeGrupo(g)}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Btn size="sm" className="flex-1" onClick={() => nav(`/treinos/${r.id}`)}>Editar</Btn>
                        <Btn size="sm" variant="primary" className="flex-1" onClick={() => comecar(r.id)}>
                          Comecar
                        </Btn>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        <Card className="p-4 mt-3" onClick={async () => {
          const id = await iniciarSessao(undefined, 'Treino livre')
          nav(`/sessao/${id}`)
        }}>
          <p className="text-[14px] font-semibold">Treino livre</p>
          <p className="text-[12px] text-muted mt-0.5">Sem rotina. Vai adicionando os exercicios na hora.</p>
        </Card>
      </div>

      <Sheet aberto={novo} fechar={() => setNovo(false)} titulo="Novo treino">
        <Campo label="Nome">
          <Input value={nome} onChange={e => setNome(e.target.value)}
            placeholder="Treino A - Peito e Triceps" autoFocus />
        </Campo>
        <Campo label="Cor">
          <div className="flex gap-2 flex-wrap">
            {CORES.map(c => (
              <button key={c} onClick={() => setCor(c)}
                className={`w-9 h-9 rounded-xl transition-transform ${cor === c ? 'scale-110 ring-2 ring-offset-2 ring-offset-bg-soft' : ''}`}
                style={{ background: c, ...(cor === c ? { boxShadow: `0 0 0 2px ${c}` } : {}) }} />
            ))}
          </div>
        </Campo>
        <Campo label="Dias da semana" hint="Opcional. Serve pra sugerir o treino certo na tela inicial.">
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4, 5, 6].map(d => (
              <Chip key={d} ativo={dias.includes(d)} cor={cor}
                onClick={() => setDias(v => v.includes(d) ? v.filter(x => x !== d) : [...v, d].sort())}>
                {diaCurto(d)}
              </Chip>
            ))}
          </div>
        </Campo>
        <Btn variant="primary" size="lg" className="w-full mt-2" onClick={criar}>Criar e escolher exercicios</Btn>
      </Sheet>

      <Confirmar aberto={!!apagar} perigo titulo="Apagar treino?"
        texto="A rotina sai da lista. Os treinos ja registrados no historico continuam la."
        onSim={confirmarApagar} onNao={() => setApagar(null)} />
    </div>
  )
}
