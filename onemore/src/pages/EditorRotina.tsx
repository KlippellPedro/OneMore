import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useMapaExercicios } from '../state/hooks'
import { iniciarSessao } from '../lib/acoes'
import { corGrupo, nomeGrupo } from '../db/seedExercicios'
import { Cabecalho } from '../components/Cabecalho'
import { Seletor } from '../components/SeletorExercicio'
import { Card, Btn, Vazio, Sheet, Campo, Input, Textarea, Chip, Stepper, Confirmar } from '../components/ui'
import { useUI, vibrar } from '../state/ui'
import { diaCurto, tempo, pl } from '../lib/format'
import type { ItemRotina } from '../db/types'

const CORES = ['#ff6b35', '#4dabf7', '#3ddc97', '#ffc857', '#c084fc', '#ff5470', '#22d3ee', '#a3e635']

export default function EditorRotina() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { toast } = useUI()
  const rotina = useLiveQuery(() => db.rotinas.get(id), [id])
  const mapaEx = useMapaExercicios()

  const [seletor, setSeletor] = useState(false)
  const [editando, setEditando] = useState<number | null>(null)
  const [config, setConfig] = useState(false)
  const [apagarIdx, setApagarIdx] = useState<number | null>(null)

  // rascunho do cabecalho (nome/cor/dias)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [cor, setCor] = useState(CORES[0])
  const [dias, setDias] = useState<number[]>([])

  useEffect(() => {
    if (!rotina) return
    setNome(rotina.nome); setCor(rotina.cor)
    setDias(rotina.dias ?? []); setDescricao(rotina.descricao ?? '')
  }, [rotina?.id])

  if (!rotina) {
    return <div className="p-10 text-center text-muted text-sm">Carregando...</div>
  }

  const salvarItens = (itens: ItemRotina[]) =>
    db.rotinas.update(id, { itens, atualizadoEm: Date.now() })

  async function salvarConfig() {
    if (!nome.trim()) return toast('O treino precisa de um nome', 'erro')
    await db.rotinas.update(id, {
      nome: nome.trim(), cor, dias, descricao: descricao.trim() || undefined,
      atualizadoEm: Date.now(),
    })
    setConfig(false)
  }

  async function mover(i: number, delta: number) {
    const itens = [...rotina!.itens]
    const j = i + delta
    if (j < 0 || j >= itens.length) return
    ;[itens[i], itens[j]] = [itens[j], itens[i]]
    vibrar()
    await salvarItens(itens)
  }

  const totalSeries = rotina.itens.reduce((t, i) => t + i.series, 0)
  const tempoEstimado = rotina.itens.reduce(
    (t, i) => t + i.series * (i.descansoSeg + 45), 0,
  )

  return (
    <div>
      <Cabecalho titulo={rotina.nome} voltarPara="/treinos"
        sub={`${pl(rotina.itens.length, 'exercicio')} - ${pl(totalSeries, 'serie')}`}
        acao={<Btn size="sm" onClick={() => setConfig(true)}>Ajustes</Btn>} />

      <div className="px-4 pt-4">
        {rotina.descricao && (
          <p className="text-[13px] text-muted leading-relaxed mb-4 px-1">{rotina.descricao}</p>
        )}

        {rotina.itens.length === 0 ? (
          <Vazio icone="➕" titulo="Treino vazio"
            texto="Adicione os exercicios na ordem em que voce vai executar."
            acao={<Btn variant="primary" onClick={() => setSeletor(true)}>Adicionar exercicio</Btn>} />
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4 px-1 text-[12px] text-muted">
              <span>{pl(totalSeries, 'serie')}</span>
              <span>~{Math.round(tempoEstimado / 60)} min estimados</span>
            </div>

            <div className="space-y-2">
              {rotina.itens.map((item, i) => {
                const ex = mapaEx.get(item.exercicioId)
                return (
                  <Card key={i} className="p-3">
                    <div className="flex items-start gap-3">
                      <span className="w-1 self-stretch rounded-full shrink-0 min-h-[44px]"
                        style={{ background: ex ? corGrupo(ex.grupo) : 'var(--color-muted)' }} />

                      <button className="flex-1 min-w-0 text-left" onClick={() => setEditando(i)}>
                        <p className="text-[14px] font-semibold leading-tight">
                          {ex?.nome ?? 'Exercicio removido'}
                        </p>
                        <p className="text-[11.5px] text-muted mt-1">
                          {item.series} x {item.repsAlvo}
                          {item.cargaAlvo ? ` - ${item.cargaAlvo} kg` : ''}
                          {' - '}descanso {tempo(item.descansoSeg)}
                        </p>
                        {item.obs && <p className="text-[11.5px] text-accent/90 mt-1">{item.obs}</p>}
                      </button>

                      <div className="flex flex-col shrink-0">
                        <button onClick={() => mover(i, -1)} disabled={i === 0}
                          className="w-7 h-6 text-muted disabled:opacity-25 active:text-txt text-xs">▲</button>
                        <button onClick={() => mover(i, 1)} disabled={i === rotina.itens.length - 1}
                          className="w-7 h-6 text-muted disabled:opacity-25 active:text-txt text-xs">▼</button>
                      </div>
                      <button onClick={() => setApagarIdx(i)}
                        className="w-7 h-7 shrink-0 text-muted active:text-bad text-lg leading-none">×</button>
                    </div>
                  </Card>
                )
              })}
            </div>
          </>
        )}

        <Btn className="w-full mt-3" onClick={() => setSeletor(true)}>+ Adicionar exercicio</Btn>

        {rotina.itens.length > 0 && (
          <Btn variant="primary" size="lg" className="w-full mt-3" onClick={async () => {
            const sid = await iniciarSessao(rotina)
            nav(`/sessao/${sid}`)
          }}>
            Comecar esse treino agora
          </Btn>
        )}
      </div>

      {/* -------- adicionar exercicio -------- */}
      <Seletor aberto={seletor} fechar={() => setSeletor(false)}
        jaEscolhidos={rotina.itens.map(i => i.exercicioId)}
        onEscolher={async ex => {
          await salvarItens([...rotina.itens, {
            exercicioId: ex.id, series: 3, repsAlvo: '8-12', descansoSeg: 90,
          }])
          setSeletor(false)
          toast(`${ex.nome} adicionado`, 'ok')
        }} />

      {/* -------- editar item -------- */}
      <EditorItem
        indice={editando}
        item={editando != null ? rotina.itens[editando] : null}
        nomeEx={editando != null ? (mapaEx.get(rotina.itens[editando].exercicioId)?.nome ?? '') : ''}
        grupoEx={editando != null ? mapaEx.get(rotina.itens[editando].exercicioId)?.grupo : undefined}
        fechar={() => setEditando(null)}
        salvar={async novo => {
          const itens = [...rotina.itens]
          itens[editando!] = novo
          await salvarItens(itens)
          setEditando(null)
        }} />

      {/* -------- ajustes da rotina -------- */}
      <Sheet aberto={config} fechar={() => setConfig(false)} titulo="Ajustes do treino">
        <Campo label="Nome"><Input value={nome} onChange={e => setNome(e.target.value)} /></Campo>
        <Campo label="Observacoes" hint="Aparece no topo do treino. Bom pra lembrete de tecnica.">
          <Textarea rows={3} value={descricao} onChange={e => setDescricao(e.target.value)}
            placeholder="Ex: aquecer 2 series leves antes do supino" />
        </Campo>
        <Campo label="Cor">
          <div className="flex gap-2 flex-wrap">
            {CORES.map(c => (
              <button key={c} onClick={() => setCor(c)} className="w-9 h-9 rounded-xl"
                style={{ background: c, boxShadow: cor === c ? `0 0 0 3px var(--color-bg-soft), 0 0 0 5px ${c}` : undefined }} />
            ))}
          </div>
        </Campo>
        <Campo label="Dias da semana">
          <div className="flex gap-1.5">
            {[0, 1, 2, 3, 4, 5, 6].map(d => (
              <Chip key={d} ativo={dias.includes(d)} cor={cor}
                onClick={() => setDias(v => v.includes(d) ? v.filter(x => x !== d) : [...v, d].sort())}>
                {diaCurto(d)}
              </Chip>
            ))}
          </div>
        </Campo>
        <Btn variant="primary" size="lg" className="w-full mt-2" onClick={salvarConfig}>Salvar</Btn>
      </Sheet>

      <Confirmar aberto={apagarIdx != null} perigo titulo="Tirar do treino?"
        onNao={() => setApagarIdx(null)}
        onSim={async () => {
          await salvarItens(rotina.itens.filter((_, i) => i !== apagarIdx))
          setApagarIdx(null)
        }} />
    </div>
  )
}

/* ------------------------------------------------------------------ */

const REPS_RAPIDAS = ['5', '6-8', '8-12', '10-12', '12-15', '15-20', '30s', '45s', '60s', 'ate a falha']
const DESCANSOS = [30, 45, 60, 90, 120, 150, 180]

function EditorItem({ indice, item, nomeEx, grupoEx, fechar, salvar }: {
  indice: number | null
  item: ItemRotina | null
  nomeEx: string
  grupoEx?: string
  fechar: () => void
  salvar: (i: ItemRotina) => void
}) {
  const [series, setSeries] = useState(3)
  const [reps, setReps] = useState('8-12')
  const [carga, setCarga] = useState(0)
  const [descanso, setDescanso] = useState(90)
  const [obs, setObs] = useState('')

  useEffect(() => {
    if (!item) return
    setSeries(item.series); setReps(item.repsAlvo)
    setCarga(item.cargaAlvo ?? 0); setDescanso(item.descansoSeg); setObs(item.obs ?? '')
  }, [indice])

  if (indice == null || !item) return null

  return (
    <Sheet aberto fechar={fechar} titulo={nomeEx}>
      {grupoEx && (
        <p className="text-[11.5px] font-semibold mb-4 -mt-1" style={{ color: corGrupo(grupoEx as never) }}>
          {nomeGrupo(grupoEx as never)}
        </p>
      )}

      <Campo label="Series">
        <Stepper valor={series} setValor={setSeries} min={1} max={20} largo />
      </Campo>

      <Campo label="Repeticoes alvo">
        <Input value={reps} onChange={e => setReps(e.target.value)} placeholder="8-12" />
        <div className="flex gap-1.5 flex-wrap mt-2">
          {REPS_RAPIDAS.map(r => (
            <Chip key={r} ativo={reps === r} onClick={() => setReps(r)}>{r}</Chip>
          ))}
        </div>
      </Campo>

      <Campo label="Carga alvo (kg)" hint="Opcional. Deixe 0 e o app usa a ultima carga que voce fez.">
        <Stepper valor={carga} setValor={setCarga} passo={2.5} max={999} sufixo="kg" />
      </Campo>

      <Campo label="Descanso entre series">
        <div className="flex gap-1.5 flex-wrap">
          {DESCANSOS.map(d => (
            <Chip key={d} ativo={descanso === d} onClick={() => setDescanso(d)}>{tempo(d)}</Chip>
          ))}
        </div>
      </Campo>

      <Campo label="Observacao">
        <Input value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: pegada aberta, cadencia 3-1-1" />
      </Campo>

      <Btn variant="primary" size="lg" className="w-full mt-2" onClick={() => salvar({
        ...item, series, repsAlvo: reps.trim() || '8-12',
        cargaAlvo: carga || undefined, descansoSeg: descanso, obs: obs.trim() || undefined,
      })}>
        Salvar
      </Btn>
    </Sheet>
  )
}
