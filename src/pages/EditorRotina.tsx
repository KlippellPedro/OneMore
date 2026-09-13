import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
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
import { Icone } from '../components/Icone'
import type { ItemRotina } from '../db/types'

const CORES = ['#c96a4a', '#5a8cbf', '#4fa385', '#c9a049', '#9b7fc7', '#c25f70', '#4f9aad', '#8ba055']

export default function EditorRotina() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { toast } = useUI()
  // `?? null` separa "carregando" de "não existe" - ver DetalheSessao
  const rotina = useLiveQuery(() => db.rotinas.get(id).then(r => r ?? null), [id])
  const mapaEx = useMapaExercicios()

  const [seletor, setSeletor] = useState(false)
  const [editando, setEditando] = useState<number | null>(null)
  const [config, setConfig] = useState(false)
  const [apagarIdx, setApagarIdx] = useState<number | null>(null)

  // ordem local dos exercicios: espelha rotina.itens, exceto durante um arrasto em andamento
  const [ordem, setOrdem] = useState<ItemRotina[]>([])
  const [arrastoId, setArrastoId] = useState<string | null>(null)
  const [arrastoTop, setArrastoTop] = useState(0)
  const [arrastoRect, setArrastoRect] = useState<{ left: number; width: number } | null>(null)
  const cardRefs = useRef<Record<string, HTMLElement | null>>({})
  const dragInfo = useRef<{ pointerId: number; grabOffsetY: number; height: number } | null>(null)
  const handlersRef = useRef<{
    mover: (e: { pointerId: number; clientY: number }) => void
    soltar: () => void
    cancelar: () => void
  }>({ mover: () => {}, soltar: () => {}, cancelar: () => {} })

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

  useEffect(() => {
    if (!dragInfo.current) setOrdem(rotina?.itens ?? [])
  }, [rotina?.itens])

  /**
   * Enquanto arrasta, os eventos ficam no window - nao no botao. Reordenar a
   * lista move o no do botao no DOM, o navegador solta o pointer capture e o
   * pointerup nunca chegaria nele: o arrasto travava com a copia flutuante presa
   * na tela. No window isso nao acontece, e o cleanup garante que sempre solta.
   */
  useEffect(() => {
    if (!arrastoId) return
    const mover = (e: PointerEvent) => handlersRef.current.mover(e)
    const soltar = () => handlersRef.current.soltar()
    const cancelar = () => handlersRef.current.cancelar()
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    window.addEventListener('pointercancel', cancelar)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', soltar)
      window.removeEventListener('pointercancel', cancelar)
    }
  }, [arrastoId])

  if (rotina === undefined) {
    return <div className="p-10 text-center text-muted text-sm">Carregando...</div>
  }
  if (rotina === null) {
    return (
      <div>
        <Cabecalho titulo="Treino" voltarPara="/treinos" />
        <Vazio icone="prancheta" titulo="Treino não encontrado"
          texto="Ele pode ter sido apagado."
          acao={<Btn variant="primary" onClick={() => nav('/treinos')}>Ver meus treinos</Btn>} />
      </div>
    )
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

  /* ---------------- arrastar pra reordenar (mouse e touch, via Pointer Events) --------------- */

  function iniciarArrasto(e: RPointerEvent, id: string) {
    const el = cardRefs.current[id]
    if (!el) return
    e.preventDefault()
    const rect = el.getBoundingClientRect()
    dragInfo.current = { pointerId: e.pointerId, grabOffsetY: e.clientY - rect.top, height: rect.height }
    setArrastoId(id)
    setArrastoTop(rect.top)
    setArrastoRect({ left: rect.left, width: rect.width })
    vibrar(10)
  }

  function moverArrasto(e: { pointerId: number; clientY: number }) {
    const info = dragInfo.current
    if (!info || e.pointerId !== info.pointerId || !arrastoId) return
    const novoTop = e.clientY - info.grabOffsetY
    setArrastoTop(novoTop)
    const centro = novoTop + info.height / 2

    let alvo = 0
    for (const it of ordem) {
      if (it.exercicioId === arrastoId) continue
      const el = cardRefs.current[it.exercicioId]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (r.top + r.height / 2 < centro) alvo++
    }

    const atual = ordem.findIndex(it => it.exercicioId === arrastoId)
    if (atual !== -1 && alvo !== atual) {
      setOrdem(prev => {
        const novo = [...prev]
        const [item] = novo.splice(atual, 1)
        novo.splice(alvo, 0, item)
        return novo
      })
    }
  }

  function finalizarArrasto() {
    if (!dragInfo.current) return
    dragInfo.current = null
    setArrastoId(null)
    setArrastoRect(null)
    if (JSON.stringify(ordem) !== JSON.stringify(rotina!.itens)) salvarItens(ordem)
  }

  function cancelarArrasto() {
    if (!dragInfo.current) return
    dragInfo.current = null
    setArrastoId(null)
    setArrastoRect(null)
    setOrdem(rotina!.itens)
  }

  // os handlers vivem em refs porque os listeners de window sao registrados uma
  // vez por arrasto, mas precisam enxergar a ordem do render atual
  handlersRef.current = { mover: moverArrasto, soltar: finalizarArrasto, cancelar: cancelarArrasto }

  const totalSeries = rotina.itens.reduce((t, i) => t + i.series, 0)
  const tempoEstimado = rotina.itens.reduce(
    (t, i) => t + i.series * (i.descansoSeg + 45), 0,
  )

  return (
    <div>
      <Cabecalho titulo={rotina.nome} voltarPara="/treinos"
        sub={`${pl(rotina.itens.length, 'exercício')} - ${pl(totalSeries, 'série')}`}
        acao={<Btn size="sm" onClick={() => setConfig(true)}>Ajustes</Btn>} />

      <div className="px-4 pt-4">
        {rotina.descricao && (
          <p className="text-[13px] text-muted leading-relaxed mb-4 px-1">{rotina.descricao}</p>
        )}

        {rotina.itens.length === 0 ? (
          <Vazio icone="mais" titulo="Treino vazio"
            texto="Adicione os exercícios na ordem em que você vai executar."
            acao={<Btn variant="primary" onClick={() => setSeletor(true)}>Adicionar exercício</Btn>} />
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4 px-1 text-[12px] text-muted">
              <span>{pl(totalSeries, 'série')}</span>
              <span>~{Math.round(tempoEstimado / 60)} min estimados</span>
            </div>

            <div className="space-y-2">
              {ordem.map((item, i) => {
                const ex = mapaEx.get(item.exercicioId)
                const arrastando = arrastoId === item.exercicioId
                return (
                  <div key={item.exercicioId}
                    ref={el => { cardRefs.current[item.exercicioId] = el }}
                    className={arrastando ? 'invisible' : ''}>
                    <Card className="p-3">
                      <div className="flex items-start gap-3">
                        <span className="w-1 self-stretch rounded-full shrink-0 min-h-[44px]"
                          style={{ background: ex ? corGrupo(ex.grupo) : 'var(--color-muted)' }} />

                        <button className="flex-1 min-w-0 text-left" onClick={() => setEditando(i)}>
                          <p className="text-[14px] font-semibold leading-tight">
                            {ex?.nome ?? 'Exercício removido'}
                          </p>
                          <p className="text-[11.5px] text-muted mt-1">
                            {item.series} x {item.repsAlvo}
                            {item.cargaAlvo ? ` - ${item.cargaAlvo} kg` : ''}
                            {' - '}descanso {tempo(item.descansoSeg)}
                          </p>
                          {item.obs && <p className="text-[11.5px] text-accent/90 mt-1">{item.obs}</p>}
                        </button>

                        {/* Duas acoes de 44px em vez de quatro apertadas. Subir/descer
                            foram pra ficha do exercicio (um toque no nome), onde cabem
                            inteiras - na linha elas eram alvos de 28x24. */}
                        <button aria-label="Arrastar para reordenar"
                          onPointerDown={e => iniciarArrasto(e, item.exercicioId)}
                          style={{ touchAction: 'none' }}
                          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-muted active:bg-surface-2 active:text-txt cursor-grab active:cursor-grabbing">
                          <Icone nome="arrastar" tamanho={17} preenchido />
                        </button>
                        <button onClick={() => setApagarIdx(i)} aria-label={`Tirar ${ex?.nome ?? 'exercicio'} do treino`}
                          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-muted active:bg-bad/15 active:text-bad">
                          <Icone nome="lixeira" tamanho={17} />
                        </button>
                      </div>
                    </Card>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* -------- copia flutuante do item sendo arrastado -------- */}
        {arrastoId && arrastoRect && (() => {
          const item = ordem.find(it => it.exercicioId === arrastoId)
          const ex = item && mapaEx.get(item.exercicioId)
          if (!item) return null
          return (
            <div className="fixed z-50 pointer-events-none"
              style={{ top: arrastoTop, left: arrastoRect.left, width: arrastoRect.width }}>
              <Card className="p-3 shadow-2xl ring-2 ring-accent/70">
                <div className="flex items-start gap-3">
                  <span className="w-1 self-stretch rounded-full shrink-0 min-h-[44px]"
                    style={{ background: ex ? corGrupo(ex.grupo) : 'var(--color-muted)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold leading-tight">{ex?.nome ?? 'Exercício removido'}</p>
                    <p className="text-[11.5px] text-muted mt-1">
                      {item.series} x {item.repsAlvo}
                      {item.cargaAlvo ? ` - ${item.cargaAlvo} kg` : ''}
                      {' - '}descanso {tempo(item.descansoSeg)}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )
        })()}

        <Btn className="w-full mt-3" onClick={() => setSeletor(true)}>+ Adicionar exercício</Btn>

        {rotina.itens.length > 0 && (
          <Btn variant="primary" size="lg" className="w-full mt-3" onClick={async () => {
            const sid = await iniciarSessao(rotina)
            nav(`/sessao/${sid}`)
          }}>
            Começar esse treino agora
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
        remover={() => { const i = editando!; setEditando(null); setApagarIdx(i) }}
        mover={async (delta, emEdicao) => {
          // grava o que estava no formulario junto com a troca de lugar: a ficha
          // e remontada no indice novo e perderia o que ainda nao foi salvo
          const i = editando!
          const j = i + delta
          const itens = [...rotina.itens]
          itens[i] = emEdicao
          ;[itens[i], itens[j]] = [itens[j], itens[i]]
          vibrar()
          await salvarItens(itens)
          setEditando(j)   // a ficha acompanha o exercicio que mudou de lugar
        }}
        podeSubir={editando != null && editando > 0}
        podeDescer={editando != null && editando < rotina.itens.length - 1}
        salvar={async novo => {
          const itens = [...rotina.itens]
          itens[editando!] = novo
          await salvarItens(itens)
          setEditando(null)
        }} />

      {/* -------- ajustes da rotina -------- */}
      <Sheet aberto={config} fechar={() => setConfig(false)} titulo="Ajustes do treino">
        <Campo label="Nome"><Input value={nome} onChange={e => setNome(e.target.value)} /></Campo>
        <Campo label="Observacoes" hint="Aparece no topo do treino. Bom pra lembrete de técnica.">
          <Textarea rows={3} value={descricao} onChange={e => setDescricao(e.target.value)}
            placeholder="Ex: aquecer 2 séries leves antes do supino" />
        </Campo>
        <Campo label="Cor">
          <div className="flex gap-2 flex-wrap">
            {CORES.map(c => (
              <button key={c} onClick={() => setCor(c)} aria-label={`Cor ${c}`} className="w-11 h-11 rounded-xl"
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
        texto={apagarIdx != null
          ? `${mapaEx.get(rotina.itens[apagarIdx]?.exercicioId ?? '')?.nome ?? 'O exercício'} sai dessa rotina. Os treinos já registrados no histórico continuam lá.`
          : undefined}
        onNao={() => setApagarIdx(null)}
        onSim={async () => {
          const fora = mapaEx.get(rotina.itens[apagarIdx!]?.exercicioId ?? '')?.nome
          await salvarItens(rotina.itens.filter((_, i) => i !== apagarIdx))
          setApagarIdx(null)
          toast(fora ? `${fora} saiu do treino` : 'Exercício removido', 'ok')
        }} />
    </div>
  )
}

/* ------------------------------------------------------------------ */

const REPS_RAPIDAS = ['5', '6-8', '8-12', '10-12', '12-15', '15-20', '30s', '45s', '60s', 'até a falha']
const DESCANSOS = [30, 45, 60, 90, 120, 150, 180]

function EditorItem({
  indice, item, nomeEx, grupoEx, fechar, salvar, remover, mover, podeSubir, podeDescer,
}: {
  indice: number | null
  item: ItemRotina | null
  nomeEx: string
  grupoEx?: string
  fechar: () => void
  salvar: (i: ItemRotina) => void
  remover: () => void
  mover: (delta: number, emEdicao: ItemRotina) => void
  podeSubir: boolean
  podeDescer: boolean
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

  const doFormulario = (): ItemRotina => ({
    ...item, series, repsAlvo: reps.trim() || '8-12',
    cargaAlvo: carga || undefined, descansoSeg: descanso, obs: obs.trim() || undefined,
  })

  return (
    <Sheet aberto fechar={fechar} titulo={nomeEx}>
      {grupoEx && (
        <p className="text-[11.5px] font-semibold mb-4 -mt-1" style={{ color: corGrupo(grupoEx as never) }}>
          {nomeGrupo(grupoEx as never)}
        </p>
      )}

      <Campo label="Séries">
        <Stepper valor={series} setValor={setSeries} min={1} max={20} largo />
      </Campo>

      <Campo label="Repetições alvo">
        <Input value={reps} onChange={e => setReps(e.target.value)} placeholder="8-12" />
        <div className="flex gap-1.5 flex-wrap mt-2">
          {REPS_RAPIDAS.map(r => (
            <Chip key={r} ativo={reps === r} onClick={() => setReps(r)}>{r}</Chip>
          ))}
        </div>
      </Campo>

      <Campo label="Carga alvo (kg)" hint="Opcional. Deixe 0 e o app usa a última carga que você fez.">
        <Stepper valor={carga} setValor={setCarga} passo={2.5} max={999} sufixo="kg" />
      </Campo>

      <Campo label="Descanso entre séries">
        <div className="flex gap-1.5 flex-wrap">
          {DESCANSOS.map(d => (
            <Chip key={d} ativo={descanso === d} onClick={() => setDescanso(d)}>{tempo(d)}</Chip>
          ))}
        </div>
      </Campo>

      <Campo label="Posição no treino">
        <div className="flex gap-2">
          <Btn className="flex-1" disabled={!podeSubir} onClick={() => mover(-1, doFormulario())}>
            <Icone nome="chevron-cima" tamanho={16} traco={2.2} /> Subir
          </Btn>
          <Btn className="flex-1" disabled={!podeDescer} onClick={() => mover(1, doFormulario())}>
            <Icone nome="chevron-baixo" tamanho={16} traco={2.2} /> Descer
          </Btn>
        </div>
      </Campo>

      <Campo label="Observação">
        <Input value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: pegada aberta, cadencia 3-1-1" />
      </Campo>

      <Btn variant="primary" size="lg" className="w-full mt-2" onClick={() => salvar(doFormulario())}>
        Salvar
      </Btn>

      <Btn variant="danger" className="w-full mt-2" onClick={remover}>
        Tirar esse exercício do treino
      </Btn>
    </Sheet>
  )
}
