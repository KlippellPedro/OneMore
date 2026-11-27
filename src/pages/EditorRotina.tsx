import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useMapaExercicios, useRotinas } from '../state/hooks'
import { iniciarSessao, definirDias, ultimasSeries } from '../lib/acoes'
import { corGrupo, nomeGrupo } from '../db/seedExercicios'
import { Cabecalho } from '../components/Cabecalho'
import { Seletor } from '../components/SeletorExercicio'
import { TrocarExercicio } from '../components/Variacoes'
import { Card, Btn, Vazio, Sheet, Campo, Input, Textarea, Chip, Stepper, Confirmar } from '../components/ui'
import { useUI, vibrar } from '../state/ui'
import { diaCurto, tempo, pl } from '../lib/format'
import { Icone } from '../components/Icone'
import { duracaoEstimada } from '../lib/treino'
import type { Exercicio, GrupoMuscular, ItemRotina } from '../db/types'

const CORES = ['#c96a4a', '#5a8cbf', '#4fa385', '#c9a049', '#9b7fc7', '#c25f70', '#4f9aad', '#8ba055']

/**
 * Configuracao de um exercicio recem-adicionado. Copia series, reps e descanso
 * do ultimo da rotina - quem monta um treino de 4x6-8 nao quer corrigir cada
 * exercicio novo de 3x8-12 pra 4x6-8. Cardio nao segue o padrao da musculacao
 * (nem serve de modelo pra ela).
 */
function itemNovo(ex: Exercicio, ultimo?: ItemRotina): ItemRotina {
  if (ex.grupo === 'cardio') return { exercicioId: ex.id, series: 1, repsAlvo: '20min', descansoSeg: 0 }
  const modelo = ultimo && !/min/i.test(ultimo.repsAlvo) && ultimo.descansoSeg > 0 ? ultimo : undefined
  return {
    exercicioId: ex.id,
    series: modelo?.series ?? 3,
    repsAlvo: modelo?.repsAlvo ?? '8-12',
    descansoSeg: modelo?.descansoSeg ?? 90,
  }
}

export default function EditorRotina() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { toast } = useUI()
  // `?? null` separa "carregando" de "não existe" - ver DetalheSessao
  const rotina = useLiveQuery(() => db.rotinas.get(id).then(r => r ?? null), [id])
  const mapaEx = useMapaExercicios()
  const ativas = useRotinas()

  const [seletor, setSeletor] = useState(false)
  const [editando, setEditando] = useState<number | null>(null)
  // troca do exercicio de uma posicao, guardando o que estava no formulario
  const [troca, setTroca] = useState<{ indice: number; item: ItemRotina; catalogo: boolean } | null>(null)
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
      nome: nome.trim(), cor, descricao: descricao.trim() || undefined,
      atualizadoEm: Date.now(),
    })
    // os dias passam pelo definirDias: o dia que esta rotina ganha sai da outra
    await definirDias(id, dias)
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

  /**
   * Troca o exercicio mantendo series, reps, descanso, observacao e a posicao -
   * antes era tirar e adicionar de novo, e o substituto ia pro fim da lista
   * com 3x8-12. A carga alvo nao vem junto: o peso do supino com barra nao
   * serve de alvo pra maquina, e sem alvo o treino usa a ultima carga dele.
   */
  async function trocarPor(ex: Exercicio) {
    if (!troca) return
    const { indice, item } = troca
    if (ex.id !== item.exercicioId && rotina!.itens.some((it, j) => j !== indice && it.exercicioId === ex.id)) {
      return toast(`${ex.nome} já está nesse treino`, 'erro')
    }
    const antigo = mapaEx.get(item.exercicioId)?.nome
    const itens = [...rotina!.itens]
    itens[indice] = { ...item, exercicioId: ex.id, cargaAlvo: ex.id === item.exercicioId ? item.cargaAlvo : undefined }
    await salvarItens(itens)
    setTroca(null)
    setEditando(indice)
    vibrar()
    if (ex.id !== item.exercicioId) toast(antigo ? `${antigo} trocado por ${ex.nome}` : `${ex.nome} no treino`, 'ok')
  }

  /** Fechou a troca sem escolher: grava o que estava no formulario e volta pra ficha. */
  async function desistirDaTroca() {
    if (!troca) return
    const { indice, item } = troca
    setTroca(null)
    if (JSON.stringify(rotina!.itens[indice]) !== JSON.stringify(item)) {
      const itens = [...rotina!.itens]
      itens[indice] = item
      await salvarItens(itens)
    }
    setEditando(indice)
  }

  // dias que esta rotina vai tomar de outra - avisa antes, em vez de sumir com o treino do outro dia
  const tomados = dias.flatMap(d => {
    const dono = ativas.find(r => r.id !== id && r.dias?.includes(d))
    return dono ? [{ d, dono }] : []
  })

  const totalSeries = rotina.itens.reduce((t, i) => t + i.series, 0)
  const minutos = duracaoEstimada(rotina.itens)
  // series de cada musculo nesse treino - o que ele trabalha de fato, na ordem do que mais pesa
  const porGrupo = [...rotina.itens.reduce((m, it) => {
    const g = mapaEx.get(it.exercicioId)?.grupo
    if (g && g !== 'cardio') m.set(g, (m.get(g) ?? 0) + it.series)
    return m
  }, new Map<GrupoMuscular, number>())].sort((a, b) => b[1] - a[1])

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
            texto="Marque os exercícios na ordem em que você vai executar - dá pra escolher vários de uma vez."
            acao={<Btn variant="primary" onClick={() => setSeletor(true)}>Adicionar exercícios</Btn>} />
        ) : (
          <>
            <div className="flex items-center gap-4 mb-2 px-1 text-[12px] text-muted">
              <span>{pl(totalSeries, 'série')}</span>
              <span className="flex items-center gap-1">
                <Icone nome="relogio" tamanho={13} /> ~{minutos} min
              </span>
            </div>
            {porGrupo.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4 px-1">
                {porGrupo.map(([g, n]) => (
                  <span key={g} className="text-[10.5px] font-semibold px-2 py-0.5 rounded-md tabular-nums"
                    style={{ background: corGrupo(g) + '22', color: corGrupo(g) }}>
                    {nomeGrupo(g)} {n}
                  </span>
                ))}
              </div>
            )}

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

        {rotina.itens.length > 0 && (
          <Btn className="w-full mt-3" onClick={() => setSeletor(true)}>+ Adicionar exercícios</Btn>
        )}

        {rotina.itens.length > 0 && (
          <Btn variant="primary" size="lg" className="w-full mt-3" onClick={async () => {
            const sid = await iniciarSessao(rotina)
            nav(`/sessao/${sid}`)
          }}>
            Começar esse treino agora
          </Btn>
        )}
      </div>

      {/* -------- adicionar exercicios (varios de uma vez) -------- */}
      <Seletor aberto={seletor} fechar={() => setSeletor(false)} titulo="Adicionar exercícios"
        jaEscolhidos={rotina.itens.map(i => i.exercicioId)}
        onEscolherVarios={async exs => {
          const itens = [...rotina.itens]
          for (const ex of exs) itens.push(itemNovo(ex, itens[itens.length - 1]))
          await salvarItens(itens)
          setSeletor(false)
          vibrar()
          toast(exs.length === 1 ? `${exs[0].nome} adicionado` : `${pl(exs.length, 'exercício')} adicionados`,
            'ok', 'Toque em um pra ajustar séries, reps e carga')
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
        trocar={emEdicao => {
          const i = editando!
          setEditando(null)
          setTroca({ indice: i, item: emEdicao, catalogo: false })
        }}
        salvar={async novo => {
          const itens = [...rotina.itens]
          itens[editando!] = novo
          await salvarItens(itens)
          setEditando(null)
        }} />

      {/* -------- trocar o exercicio de uma posicao: variacoes primeiro, catalogo se nada servir -------- */}
      <TrocarExercicio exercicioId={troca && !troca.catalogo ? troca.item.exercicioId : null}
        fechar={desistirDaTroca}
        noTreino={rotina.itens.map(i => i.exercicioId).filter(x => x !== troca?.item.exercicioId)}
        nota="Séries, repetições, descanso e a posição no treino continuam."
        verTodos={() => setTroca(t => t && { ...t, catalogo: true })}
        onEscolher={ex => trocarPor(ex)} />
      <Seletor aberto={!!troca?.catalogo} titulo="Trocar por outro exercício"
        fechar={desistirDaTroca}
        jaEscolhidos={rotina.itens.map(i => i.exercicioId).filter(x => x !== troca?.item.exercicioId)}
        onEscolher={ex => trocarPor(ex)} />

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
          <div className="flex gap-1.5 overflow-x-auto -mx-5 px-5 pb-1">
            {[1, 2, 3, 4, 5, 6, 0].map(d => (
              <Chip key={d} ativo={dias.includes(d)} cor={cor}
                onClick={() => setDias(v => v.includes(d) ? v.filter(x => x !== d) : [...v, d].sort())}>
                {diaCurto(d)}
              </Chip>
            ))}
          </div>
          {tomados.length > 0 && (
            <span className="block text-[11.5px] text-warn mt-1.5 leading-relaxed">
              {tomados.map(t => `${diaCurto(t.d)} sai de ${t.dono.nome}`).join(' - ')}. Cada dia tem um treino só.
            </span>
          )}
        </Campo>
        <Btn variant="primary" size="lg" className="w-full mt-2" onClick={salvarConfig}>Salvar</Btn>
      </Sheet>

      <Confirmar aberto={apagarIdx != null} perigo titulo="Tirar do treino?"
        texto={apagarIdx != null
          ? `${mapaEx.get(rotina.itens[apagarIdx]?.exercicioId ?? '')?.nome ?? 'O exercício'} sai dessa rotina. Os treinos já registrados no histórico continuam lá.`
          : undefined}
        onNao={() => setApagarIdx(null)}
        onSim={async () => {
          const idx = apagarIdx!
          const removido = rotina.itens[idx]
          const fora = mapaEx.get(removido?.exercicioId ?? '')?.nome
          await salvarItens(rotina.itens.filter((_, i) => i !== idx))
          setApagarIdx(null)
          toast(fora ? `${fora} saiu do treino` : 'Exercício removido', 'ok', undefined, removido && {
            rotulo: 'Desfazer',
            // volta pro mesmo lugar, em cima do que estiver gravado agora - nao do retrato antigo
            fazer: async () => {
              const atual = await db.rotinas.get(id)
              if (!atual || atual.itens.some(i => i.exercicioId === removido.exercicioId)) return
              const itens = [...atual.itens]
              itens.splice(Math.min(idx, itens.length), 0, removido)
              await db.rotinas.update(id, { itens, atualizadoEm: Date.now() })
            },
          })
        }} />
    </div>
  )
}

/* ------------------------------------------------------------------ */

const REPS_RAPIDAS = ['5', '6-8', '8-12', '10-12', '12-15', '15-20', '30s', '45s', '60s', 'até a falha']
const DESCANSOS = [30, 45, 60, 90, 120, 150, 180, 240]

/** O que o formulario guarda, sem campo vazio - pra comparar com o que esta gravado. */
const limpo = (i: ItemRotina) => JSON.stringify({
  ...i, cargaAlvo: i.cargaAlvo || undefined, obs: i.obs?.trim() || undefined,
})

function EditorItem({
  indice, item, nomeEx, grupoEx, fechar, salvar, remover, mover, trocar, podeSubir, podeDescer,
}: {
  indice: number | null
  item: ItemRotina | null
  nomeEx: string
  grupoEx?: string
  fechar: () => void
  salvar: (i: ItemRotina) => void
  remover: () => void
  mover: (delta: number, emEdicao: ItemRotina) => void
  /** Abre a troca do exercicio, levando o que esta no formulario. */
  trocar: (emEdicao: ItemRotina) => void
  podeSubir: boolean
  podeDescer: boolean
}) {
  const [series, setSeries] = useState(3)
  const [reps, setReps] = useState('8-12')
  const [carga, setCarga] = useState(0)
  const [descanso, setDescanso] = useState(90)
  const [obs, setObs] = useState('')

  // a ficha e remontada pelo indice E pelo exercicio: trocar o exercicio mantem a posicao
  useEffect(() => {
    if (!item) return
    setSeries(item.series); setReps(item.repsAlvo)
    setCarga(item.cargaAlvo ?? 0); setDescanso(item.descansoSeg); setObs(item.obs ?? '')
  }, [indice, item?.exercicioId])

  // o que foi feito da ultima vez: e com isso que se decide a carga alvo
  const anteriores = useLiveQuery(
    () => (item ? ultimasSeries(item.exercicioId) : Promise.resolve([])), [item?.exercicioId],
  ) ?? []

  if (indice == null || !item) return null

  const doFormulario = (): ItemRotina => ({
    ...item, series, repsAlvo: reps.trim() || '8-12',
    cargaAlvo: carga || undefined, descansoSeg: descanso, obs: obs.trim() || undefined,
  })

  /**
   * Fechar (X, arrastar pra baixo, tocar fora) grava. Antes so o botao Salvar
   * gravava, e quem ajustava series e reps e fechava tocando fora perdia tudo
   * sem aviso - o mesmo gesto que fecha qualquer outra ficha do app.
   */
  const fecharGravando = () => {
    const atual = doFormulario()
    if (limpo(atual) !== limpo(item)) salvar(atual)
    else fechar()
  }

  return (
    <Sheet aberto fechar={fecharGravando} titulo={nomeEx}>
      <div className="flex items-center gap-2 mb-4 -mt-1">
        {grupoEx && (
          <p className="flex-1 min-w-0 text-[11.5px] font-semibold" style={{ color: corGrupo(grupoEx as never) }}>
            {nomeGrupo(grupoEx as never)}
          </p>
        )}
        <Btn size="sm" className="shrink-0 ml-auto" onClick={() => trocar(doFormulario())}>
          <Icone nome="trocar" tamanho={15} /> Trocar exercício
        </Btn>
      </div>

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
        {anteriores.length > 0 && anteriores.some(a => a.carga > 0) && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[11.5px] text-muted">
            <span>Última vez: {anteriores.map(a => `${a.carga} x ${a.reps}`).join(' · ')}</span>
            {!carga && (
              <button type="button" onClick={() => setCarga(Math.max(...anteriores.map(a => a.carga)))}
                className="toque font-semibold text-accent">
                usar {Math.max(...anteriores.map(a => a.carga))} kg
              </button>
            )}
          </span>
        )}
      </Campo>

      <Campo label={`Descanso entre séries - ${tempo(descanso)}`}>
        <div className="flex gap-1.5 flex-wrap mb-2">
          {DESCANSOS.map(d => (
            <Chip key={d} ativo={descanso === d} onClick={() => setDescanso(d)}>{tempo(d)}</Chip>
          ))}
        </div>
        <Stepper valor={descanso} setValor={setDescanso} passo={15} max={900} sufixo="seg" />
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
        <Input value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex: pegada aberta, cadência 3-1-1" />
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
