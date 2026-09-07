import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { db, uid } from '../db'
import { useRotinas, useMapaExercicios, useSessaoAtiva } from '../state/hooks'
import { iniciarSessao, atribuirDia } from '../lib/acoes'
import { corGrupo, nomeGrupo } from '../db/seedExercicios'
import { Titulo } from '../components/Cabecalho'
import { Card, Btn, Vazio, Confirmar, Sheet, Campo, Input } from '../components/ui'
import { useUI, vibrar } from '../state/ui'
import { diaCurto, diaLongo, pl } from '../lib/format'
import { Icone } from '../components/Icone'
import type { GrupoMuscular, Rotina } from '../db/types'

const CORES = ['#a855f7', '#22d3ee', '#34d399', '#fbbf24', '#f472b6', '#fb7185', '#818cf8', '#c026d3']

/** Semana comecando na segunda, que e como as pessoas pensam em treino. */
const SEMANA = [1, 2, 3, 4, 5, 6, 0]

export default function Treinos() {
  const nav = useNavigate()
  const { toast } = useUI()
  const rotinas = useRotinas()
  const mapaEx = useMapaExercicios()
  const sessaoAtiva = useSessaoAtiva()

  const [novo, setNovo] = useState(false)
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(CORES[0])
  const [apagar, setApagar] = useState<string | null>(null)
  const [diaAberto, setDiaAberto] = useState<number | null>(null)

  const hojeDia = new Date().getDay()
  const doDia = (d: number) => rotinas.find(r => r.dias?.includes(d))

  async function criar() {
    if (!nome.trim()) return toast('Da um nome pro treino', 'erro')
    const id = uid()
    await db.rotinas.put({
      id, nome: nome.trim(), cor, dias: [], itens: [],
      ordem: rotinas.length, atualizadoEm: Date.now(),
    })
    setNovo(false); setNome(''); setCor(CORES[0])
    nav(`/treinos/${id}`)
  }

  async function comecar(r: Rotina) {
    if (!r.itens.length) return toast('Esse treino esta vazio', 'erro', 'Adicione exercicios primeiro')
    vibrar(20)
    nav(`/sessao/${await iniciarSessao(r)}`)
  }

  return (
    <div>
      <Titulo titulo="Treino" sub={pl(rotinas.length, 'rotina')}
        acao={<Btn variant="primary" size="sm" onClick={() => setNovo(true)}>+ Novo</Btn>} />

      <div className="px-4">
        {sessaoAtiva && (
          <Card className="p-4 mb-4 border-accent/40" onClick={() => nav(`/sessao/${sessaoAtiva.id}`)}>
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              <p className="flex-1 text-[14px] font-bold truncate">{sessaoAtiva.nome}</p>
              <span className="text-accent text-sm font-bold">Continuar</span>
            </div>
          </Card>
        )}

        {/* -------- minha semana -------- */}
        <section className="mb-6">
          <div className="flex items-end justify-between mb-2.5 px-1">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">Minha semana</h2>
            <span className="text-[11px] text-muted">toque pra trocar</span>
          </div>
          <Card className="overflow-hidden">
            {SEMANA.map(d => {
              const r = doDia(d)
              const ehHoje = d === hojeDia
              return (
                <button key={d} onClick={() => setDiaAberto(d)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 border-b border-line/40 last:border-0 text-left active:bg-surface-2 ${
                    ehHoje ? 'bg-accent/8' : ''
                  }`}>
                  <span className={`w-10 shrink-0 text-[12px] font-bold ${ehHoje ? 'text-accent' : 'text-muted'}`}>
                    {diaCurto(d)}
                  </span>
                  {r ? (
                    <>
                      <span className="w-1 h-8 rounded-full shrink-0" style={{ background: r.cor }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-semibold truncate">{r.nome}</p>
                        <p className="text-[11px] text-muted">
                          {pl(r.itens.length, 'exercicio')}
                        </p>
                      </div>
                      {ehHoje && r.itens.length > 0 && (
                        <Btn size="sm" variant="primary" onClick={() => comecar(r)}>Treinar</Btn>
                      )}
                    </>
                  ) : (
                    <span className="flex-1 text-[13px] text-muted/60">Descanso</span>
                  )}
                </button>
              )
            })}
          </Card>
        </section>

        {/* -------- biblioteca de programas -------- */}
        <Card className="p-4 mb-6 border-accent/25" onClick={() => nav('/treinos/programas')}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0 rounded-xl grad-accent flex items-center justify-center text-white">
              <Icone nome="prancheta" tamanho={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold">Programas prontos</p>
              <p className="text-[11.5px] text-muted mt-0.5">
                PPL, Upper/Lower, Full Body, Arnold, 5x5 e mais
              </p>
            </div>
            <span className="text-accent shrink-0">›</span>
          </div>
        </Card>

        {/* -------- rotinas -------- */}
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted mb-2.5 px-1">
          Minhas rotinas
        </h2>

        {rotinas.length === 0 ? (
          <Vazio icone="halter" titulo="Nenhum treino ainda"
            texto="Pegue um programa pronto ou monte a sua rotina do zero."
            acao={<Btn variant="primary" onClick={() => nav('/treinos/programas')}>Ver programas</Btn>} />
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
                            {r.dias?.length ? ' - ' + r.dias.map(diaCurto).join(', ') : ' - sem dia fixo'}
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
                        <Btn size="sm" variant="primary" className="flex-1" onClick={() => comecar(r)}>
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
          nav(`/sessao/${await iniciarSessao(undefined, 'Treino livre')}`)
        }}>
          <p className="text-[14px] font-semibold">Treino livre</p>
          <p className="text-[12px] text-muted mt-0.5">Sem rotina. Vai adicionando os exercicios na hora.</p>
        </Card>
      </div>

      {/* -------- escolher o treino do dia -------- */}
      <Sheet aberto={diaAberto != null} fechar={() => setDiaAberto(null)}
        titulo={diaAberto != null ? diaLongo(diaAberto) : ''}>
        <div className="space-y-1.5">
          {rotinas.map(r => {
            const ativo = r.dias?.includes(diaAberto ?? -1)
            return (
              <button key={r.id}
                onClick={async () => {
                  await atribuirDia(diaAberto!, ativo ? null : r.id)
                  vibrar()
                  setDiaAberto(null)
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left ${
                  ativo ? 'border-accent bg-accent/10' : 'border-line bg-surface'
                }`}>
                <span className="w-1 h-9 rounded-full shrink-0" style={{ background: r.cor }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold truncate">{r.nome}</p>
                  <p className="text-[11.5px] text-muted">{pl(r.itens.length, 'exercicio')}</p>
                </div>
                {ativo && <Icone nome="check" tamanho={17} traco={2.4} className="text-accent shrink-0" />}
              </button>
            )
          })}
          <button
            onClick={async () => { await atribuirDia(diaAberto!, null); setDiaAberto(null) }}
            className="w-full p-3 rounded-xl border border-line bg-surface text-left">
            <p className="text-[14px] font-semibold text-muted">Descanso</p>
            <p className="text-[11.5px] text-muted/70">Nenhum treino nesse dia</p>
          </button>
        </div>
      </Sheet>

      <Sheet aberto={novo} fechar={() => setNovo(false)} titulo="Novo treino">
        <Campo label="Nome">
          <Input value={nome} onChange={e => setNome(e.target.value)}
            placeholder="Treino A - Peito e Triceps" autoFocus />
        </Campo>
        <Campo label="Cor">
          <div className="flex gap-2 flex-wrap">
            {CORES.map(c => (
              <button key={c} onClick={() => setCor(c)} className="w-9 h-9 rounded-xl"
                style={{ background: c, boxShadow: cor === c ? `0 0 0 3px var(--color-bg-soft), 0 0 0 5px ${c}` : undefined }} />
            ))}
          </div>
        </Campo>
        <p className="text-[11.5px] text-muted mb-4 leading-relaxed">
          O dia da semana voce escolhe depois, em "Minha semana".
        </p>
        <Btn variant="primary" size="lg" className="w-full" onClick={criar}>
          Criar e escolher exercicios
        </Btn>
      </Sheet>

      <Confirmar aberto={!!apagar} perigo titulo="Apagar treino?"
        texto="A rotina sai da lista. Os treinos ja registrados no historico continuam la."
        onSim={async () => {
          if (apagar) await db.rotinas.delete(apagar)
          setApagar(null); toast('Treino removido', 'ok')
        }}
        onNao={() => setApagar(null)} />
    </div>
  )
}
