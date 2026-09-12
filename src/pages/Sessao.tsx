import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useMapaExercicios } from '../state/hooks'
import {
  concluirSessao, descartarSessao, ultimaCarga, recordeDe, volumeSessao,
  renumerarSeries, type ResumoSessao, type Recorde,
} from '../lib/acoes'
import { corGrupo } from '../db/seedExercicios'
import { Seletor } from '../components/SeletorExercicio'
import { Btn, Sheet, Confirmar, Textarea, Card } from '../components/ui'
import { Icone } from '../components/Icone'
import { ImagemExercicio } from '../components/ImagemExercicio'
import { useUI, vibrar } from '../state/ui'
import { tempo, duracao, peso, n0 } from '../lib/format'
import type { SerieLog } from '../db/types'

const SEM_RECORDE: Recorde = { carga: 0, reps: 0, volume: 0 }

/* ------------------------------------------------------------------ */
/* CRONOMETRO DE DESCANSO                                              */
/* ------------------------------------------------------------------ */

function useDescanso() {
  const [alvo, setAlvo] = useState<number | null>(null)
  const [restante, setRestante] = useState(0)
  const tocou = useRef(false)

  useEffect(() => {
    if (alvo == null) return
    const tick = () => {
      const r = Math.max(0, Math.round((alvo - Date.now()) / 1000))
      setRestante(r)
      if (r === 0 && !tocou.current) {
        tocou.current = true
        vibrar([120, 80, 120])
        bipe()
      }
    }
    tick()
    const i = setInterval(tick, 250)
    return () => clearInterval(i)
  }, [alvo])

  return {
    restante,
    ativo: alvo != null,
    iniciar: (seg: number) => { tocou.current = false; setAlvo(Date.now() + seg * 1000) },
    somar: (seg: number) => setAlvo(a => (a ? a + seg * 1000 : Date.now() + seg * 1000)),
    parar: () => { setAlvo(null); setRestante(0) },
  }
}

/** Bipe curto via WebAudio - nao precisa de arquivo de som. */
function bipe() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45)
    osc.start(); osc.stop(ctx.currentTime + 0.5)
    setTimeout(() => ctx.close(), 900)
  } catch { /* som bloqueado pelo navegador, tudo bem */ }
}

/* ------------------------------------------------------------------ */

export default function Sessao() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { celebrar, toast } = useUI()
  // `?? null` separa "carregando" de "nao existe" - ver DetalheSessao
  const sessao = useLiveQuery(() => db.sessoes.get(id).then(s => s ?? null), [id])
  const mapaEx = useMapaExercicios()
  const rotina = useLiveQuery(
    () => (sessao?.rotinaId ? db.rotinas.get(sessao.rotinaId) : undefined),
    [sessao?.rotinaId],
  )

  const descanso = useDescanso()
  const [agora, setAgora] = useState(Date.now())
  const [seletor, setSeletor] = useState(false)
  /** id do exercicio que vai ser trocado por outro, mantendo o lugar na lista. */
  const [trocando, setTrocando] = useState<string | null>(null)
  const [removerEx, setRemoverEx] = useState<string | null>(null)
  const [confirmarFim, setConfirmarFim] = useState(false)
  const [confirmarSair, setConfirmarSair] = useState(false)
  const [resumo, setResumo] = useState<ResumoSessao | null>(null)
  const [notas, setNotas] = useState(false)
  const [recordes, setRecordes] = useState<Record<string, Recorde>>({})
  const [anteriores, setAnteriores] = useState<Record<string, { carga: number; reps: number } | null>>({})

  useEffect(() => {
    const i = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(i)
  }, [])

  // carrega recordes e ultima carga de cada exercicio da sessao
  const idsEx = useMemo(
    () => [...new Set(sessao?.series.map(s => s.exercicioId) ?? [])].join(','),
    [sessao?.series.length, sessao?.id],
  )
  useEffect(() => {
    if (!idsEx) return
    let vivo = true
    ;(async () => {
      const recs: Record<string, Recorde> = {}
      const ants: Record<string, { carga: number; reps: number } | null> = {}
      for (const exId of idsEx.split(',')) {
        recs[exId] = await recordeDe(exId)
        ants[exId] = await ultimaCarga(exId)
      }
      if (vivo) { setRecordes(recs); setAnteriores(ants) }
    })()
    return () => { vivo = false }
  }, [idsEx, id])

  if (sessao === undefined) {
    return <div className="p-10 text-center text-muted text-sm">Carregando treino...</div>
  }
  if (sessao === null) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-muted mb-4">Esse treino nao existe mais.</p>
        <Btn variant="primary" onClick={() => nav('/')}>Voltar ao inicio</Btn>
      </div>
    )
  }
  if (sessao.concluida && !resumo) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-muted mb-4">Esse treino ja foi finalizado.</p>
        <Btn variant="primary" onClick={() => nav('/')}>Voltar ao inicio</Btn>
      </div>
    )
  }

  /* ------------- agrupa por exercicio, mantendo a ordem ------------- */
  const grupos: { exercicioId: string; series: { s: SerieLog; i: number }[] }[] = []
  sessao.series.forEach((s, i) => {
    let g = grupos.find(x => x.exercicioId === s.exercicioId)
    if (!g) { g = { exercicioId: s.exercicioId, series: [] }; grupos.push(g) }
    g.series.push({ s, i })
  })

  const feitas = sessao.series.filter(s => s.feito).length
  const totalSeries = sessao.series.length
  const volume = volumeSessao(sessao)

  const salvar = (series: SerieLog[]) =>
    db.sessoes.update(id, { series, atualizadoEm: Date.now() })

  async function alterar(i: number, patch: Partial<SerieLog>) {
    const series = [...sessao!.series]
    series[i] = { ...series[i], ...patch }
    await salvar(series)
  }

  async function marcar(i: number) {
    const s = sessao!.series[i]
    if (s.feito) return alterar(i, { feito: false, ts: undefined })

    if (s.reps <= 0) {
      toast('Preencha as repeticoes', 'erro')
      return
    }
    vibrar([15, 40, 15])
    await alterar(i, { feito: true, ts: Date.now() })

    // recorde novo? avisa na hora - e o momento de maior dopamina do treino
    const rec = recordes[s.exercicioId] ?? SEM_RECORDE
    const volume = s.carga * s.reps
    if (!s.aquecimento && rec.carga > 0) {
      if (s.carga > rec.carga) {
        setRecordes(r => ({ ...r, [s.exercicioId]: { ...rec, carga: s.carga, reps: s.reps, volume: Math.max(rec.volume, volume) } }))
        toast('RECORDE PESSOAL!', 'xp', `${s.carga} kg - antes era ${rec.carga} kg`)
        vibrar([40, 60, 40, 60, 120])
      } else if (volume > rec.volume) {
        // mesma carga, mais repeticoes: antes isso passava batido
        setRecordes(r => ({ ...r, [s.exercicioId]: { ...rec, volume } }))
        toast('MELHOR SERIE!', 'xp', `${s.carga} kg x ${s.reps} - mais que qualquer outra`)
        vibrar([30, 50, 30, 80])
      }
    }

    // descanso automatico com o tempo da rotina
    const item = rotina?.itens.find(it => it.exercicioId === s.exercicioId)
    if (!s.aquecimento) descanso.iniciar(item?.descansoSeg ?? 90)
  }

  async function addSerie(exercicioId: string) {
    const doEx = sessao!.series.filter(s => s.exercicioId === exercicioId)
    const ultima = doEx[doEx.length - 1]
    const idx = sessao!.series.lastIndexOf(ultima)
    const series = [...sessao!.series]
    series.splice(idx + 1, 0, {
      exercicioId, serie: doEx.length + 1,
      reps: ultima?.reps ?? 0, carga: ultima?.carga ?? 0, feito: false,
    })
    await salvar(renumerarSeries(series))
  }

  async function removerSerie(i: number) {
    await salvar(renumerarSeries(sessao!.series.filter((_, k) => k !== i)))
  }

  /** Tira o exercicio inteiro - todas as series dele - de dentro da sessao. */
  async function removerExercicio(exercicioId: string) {
    await salvar(renumerarSeries(sessao!.series.filter(s => s.exercicioId !== exercicioId)))
  }

  /**
   * Troca um exercicio por outro sem sair do lugar. O caso e banal na academia:
   * a maquina esta ocupada e voce faz outra coisa no lugar. Tirar e adicionar
   * resolveria, mas jogaria o exercicio pro fim da lista e perderia as series
   * ja marcadas como feitas.
   *
   * Serie ja feita e preservada como feita: voce fez aquilo, so nao no aparelho
   * planejado. A carga vira a ultima daquele exercicio novo, se houver - o peso
   * do supino nao serve de palpite pro crucifixo.
   */
  async function trocarExercicio(de: string, para: string) {
    const ant = await ultimaCarga(para)
    const series = sessao!.series.map(s =>
      s.exercicioId === de
        ? { ...s, exercicioId: para, carga: s.feito ? s.carga : (ant?.carga ?? 0), reps: s.feito ? s.reps : (ant?.reps ?? 0) }
        : s)
    await salvar(renumerarSeries(series))
    setAnteriores(a => ({ ...a, [para]: ant }))
    recordeDe(para).then(rec => setRecordes(r => ({ ...r, [para]: rec })))
    setTrocando(null)
  }

  async function finalizar() {
    setConfirmarFim(false)
    const r = await concluirSessao(id)
    if (!r) return
    descanso.parar()
    setResumo(r)
    celebrar(r.ganho)
  }

  return (
    <div className="pb-40">
      {/* -------- cabecalho fixo -------- */}
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur-lg border-b border-line safe-t">
        <div className="flex items-center gap-2 px-3 h-14">
          <button onClick={() => setConfirmarSair(true)}
            className="toque w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-muted active:bg-surface-2 text-lg">
            ×
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold truncate leading-tight">{sessao.nome}</p>
            <p className="text-[11.5px] text-muted tabular-nums">
              {duracao(agora - sessao.inicio)} - {feitas}/{totalSeries} series - {peso(volume)}
            </p>
          </div>
          <Btn size="sm" variant="primary" onClick={() => setConfirmarFim(true)}>Finalizar</Btn>
        </div>
        <div className="h-0.5 bg-surface-2">
          <div className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${totalSeries ? (feitas / totalSeries) * 100 : 0}%` }} />
        </div>
      </header>

      <div className="px-3 pt-3 space-y-3">
        {grupos.length === 0 && (
          <div className="text-center py-14 px-6">
            <div className="flex justify-center mb-3 text-muted/50"><Icone nome="halter" tamanho={36} traco={1.5} /></div>
            <p className="font-semibold mb-1">Treino livre</p>
            <p className="text-[13px] text-muted mb-4">Adicione o primeiro exercicio.</p>
            <Btn variant="primary" onClick={() => setSeletor(true)}>Adicionar exercicio</Btn>
          </div>
        )}

        {grupos.map(g => {
          const ex = mapaEx.get(g.exercicioId)
          const item = rotina?.itens.find(it => it.exercicioId === g.exercicioId)
          const ant = anteriores[g.exercicioId]
          const rec = recordes[g.exercicioId] ?? SEM_RECORDE
          return (
            <Card key={g.exercicioId} className="p-3">
              <div className="flex items-start gap-2.5 mb-3">
                <span className="w-1 self-stretch rounded-full shrink-0"
                  style={{ background: ex ? corGrupo(ex.grupo) : 'var(--color-muted)' }} />
                <Link to={`/exercicios/${g.exercicioId}`} className="shrink-0">
                  <ImagemExercicio exercicioId={g.exercicioId} tamanho="mini" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={`/exercicios/${g.exercicioId}`} className="text-[14.5px] font-bold leading-tight block">
                    {ex?.nome ?? 'Exercicio'}
                    <span className="text-muted font-normal text-[11px] ml-1.5 whitespace-nowrap">ver execucao ›</span>
                  </Link>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted">
                    {item && <span>alvo {item.series}x{item.repsAlvo}</span>}
                    {ant && <span>anterior {ant.carga} kg x {ant.reps}</span>}
                    {rec.carga > 0 && <span className="text-xp">recorde {rec.carga} kg</span>}
                  </div>
                  {item?.obs && <p className="text-[11.5px] text-accent/90 mt-1">{item.obs}</p>}
                </div>
                <button onClick={() => setTrocando(g.exercicioId)}
                  aria-label={`Trocar ${ex?.nome ?? 'exercicio'} por outro`}
                  className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-muted active:bg-accent/15 active:text-accent">
                  <Icone nome="arrastar" tamanho={16} />
                </button>
                <button onClick={() => setRemoverEx(g.exercicioId)}
                  aria-label={`Tirar ${ex?.nome ?? 'exercicio'} do treino`}
                  className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-muted active:bg-bad/15 active:text-bad">
                  <Icone nome="lixeira" tamanho={16} />
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  <span className="w-8 text-center shrink-0">Set</span>
                  <span className="flex-1 text-center">Carga (kg)</span>
                  <span className="flex-1 text-center">Reps</span>
                  <span className="w-10 shrink-0" />
                </div>
                {g.series.map(({ s, i }) => (
                  <LinhaSerie
                    key={i} serie={s}
                    ehRecorde={!s.aquecimento && rec.carga > 0
                      && (s.carga > rec.carga || s.carga * s.reps > rec.volume)}
                    onCarga={v => alterar(i, { carga: v })}
                    onReps={v => alterar(i, { reps: v })}
                    onMarcar={() => marcar(i)}
                    onAquecimento={() => alterar(i, { aquecimento: !s.aquecimento })}
                    onRemover={() => removerSerie(i)}
                  />
                ))}
              </div>

              <button onClick={() => addSerie(g.exercicioId)}
                className="w-full mt-2 h-11 rounded-xl text-[12.5px] font-semibold text-muted bg-surface-2/60 active:bg-surface-2">
                + Adicionar serie
              </button>
            </Card>
          )
        })}

        {grupos.length > 0 && (
          <Btn className="w-full" onClick={() => setSeletor(true)}>+ Adicionar exercicio</Btn>
        )}
        <Btn variant="ghost" className="w-full" onClick={() => setNotas(true)}>
          {sessao.notas ? 'Editar anotacoes' : 'Adicionar anotacao'}
        </Btn>
      </div>

      {/* -------- descanso -------- */}
      {descanso.ativo && (
        <div className="fixed left-3 right-3 bottom-4 z-40 max-w-[534px] mx-auto anim-up">
          <div className={`rounded-2xl border shadow-2xl overflow-hidden ${
            descanso.restante === 0 ? 'bg-good/20 border-good/50' : 'bg-surface border-line'
          }`}>
            <div className="flex items-center gap-3 px-4 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted font-semibold">Descanso</p>
                <p className={`text-2xl font-black tabular-nums leading-tight ${
                  descanso.restante === 0 ? 'text-good' : 'text-txt'
                }`}>
                  {descanso.restante === 0 ? 'Bora!' : tempo(descanso.restante)}
                </p>
              </div>
              <div className="flex-1" />
              <Btn size="sm" onClick={() => descanso.somar(15)}>+15s</Btn>
              <Btn size="sm" variant="primary" onClick={descanso.parar}>Pular</Btn>
            </div>
          </div>
        </div>
      )}

      {/* -------- sheets -------- */}
      <Seletor aberto={seletor} fechar={() => setSeletor(false)}
        jaEscolhidos={grupos.map(g => g.exercicioId)}
        onEscolher={async ex => {
          const ant = await ultimaCarga(ex.id)
          const novas: SerieLog[] = [1, 2, 3].map(n => ({
            exercicioId: ex.id, serie: n, reps: ant?.reps ?? 0, carga: ant?.carga ?? 0, feito: false,
          }))
          await salvar([...sessao.series, ...novas])
          setAnteriores(a => ({ ...a, [ex.id]: ant }))
          setRecordes(r => ({ ...r, [ex.id]: SEM_RECORDE }))
          recordeDe(ex.id).then(rec => setRecordes(r => ({ ...r, [ex.id]: rec })))
          setSeletor(false)
        }} />

      <Seletor aberto={!!trocando} fechar={() => setTrocando(null)}
        jaEscolhidos={grupos.map(g => g.exercicioId).filter(x => x !== trocando)}
        onEscolher={ex => { if (trocando) trocarExercicio(trocando, ex.id) }} />

      <Sheet aberto={notas} fechar={() => setNotas(false)} titulo="Anotacoes do treino">
        <Textarea rows={6} defaultValue={sessao.notas ?? ''}
          placeholder="Como foi? Dor, energia, o que mudar na proxima..."
          onBlur={e => db.sessoes.update(id, { notas: e.target.value })} />
        <Btn variant="primary" className="w-full mt-3" onClick={() => setNotas(false)}>Pronto</Btn>
      </Sheet>

      <Confirmar aberto={!!removerEx} perigo titulo="Tirar do treino?"
        texto={(() => {
          if (!removerEx) return undefined
          const nome = mapaEx.get(removerEx)?.nome ?? 'Esse exercicio'
          const feitasEx = sessao.series.filter(s => s.exercicioId === removerEx && s.feito).length
          return feitasEx > 0
            ? `${nome} sai do treino de hoje e ${feitasEx === 1
                ? 'a serie ja marcada nao vai contar'
                : `as ${feitasEx} series ja marcadas nao vao contar`}.`
            : `${nome} sai do treino de hoje. Da pra adicionar de novo depois.`
        })()}
        onNao={() => setRemoverEx(null)}
        onSim={async () => {
          const nome = mapaEx.get(removerEx!)?.nome
          await removerExercicio(removerEx!)
          setRemoverEx(null)
          toast(nome ? `${nome} saiu do treino` : 'Exercicio removido', 'ok')
        }} />

      <Confirmar aberto={confirmarFim} titulo="Finalizar treino?"
        texto={feitas < totalSeries
          ? `Voce fez ${feitas} de ${totalSeries} series. As nao marcadas nao contam.`
          : `${feitas} series concluidas. Mandou bem.`}
        onSim={finalizar} onNao={() => setConfirmarFim(false)} />

      <Confirmar aberto={confirmarSair} titulo="Sair do treino?"
        texto={feitas > 0
          ? 'O treino continua em andamento e voce pode voltar depois pela tela inicial.'
          : 'Nada foi registrado ainda. O treino sera descartado.'}
        onNao={() => setConfirmarSair(false)}
        onSim={async () => {
          if (feitas === 0) await descartarSessao(id)
          nav('/')
        }} />

      {resumo && <TelaResumo resumo={resumo} sessao={sessao} onFechar={() => nav('/')} mapaEx={mapaEx} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function LinhaSerie({ serie, ehRecorde, onCarga, onReps, onMarcar, onAquecimento, onRemover }: {
  serie: SerieLog; ehRecorde: boolean
  onCarga: (v: number) => void; onReps: (v: number) => void
  onMarcar: () => void; onAquecimento: () => void; onRemover: () => void
}) {
  const [menu, setMenu] = useState(false)
  return (
    <>
      <div className={`flex items-center gap-2 rounded-xl transition-colors ${
        serie.feito ? 'bg-good/10' : ''
      }`}>
        <button onClick={() => setMenu(true)} aria-label={`Opcoes da serie ${serie.serie}`}
          className={`w-9 h-11 shrink-0 rounded-lg text-[12px] font-bold ${
            serie.aquecimento ? 'text-warn' : serie.feito ? 'text-good' : 'text-muted'
          }`}>
          {serie.aquecimento ? 'A' : serie.serie}
        </button>

        <NumInput valor={serie.carga} onChange={onCarga} passo={2.5} feito={serie.feito} destaque={ehRecorde} />
        <NumInput valor={serie.reps} onChange={onReps} passo={1} feito={serie.feito} inteiro />

        <button onClick={onMarcar}
          className={`w-11 h-11 shrink-0 rounded-xl border-2 flex items-center justify-center transition-all active:scale-90 ${
            serie.feito
              ? 'bg-good border-good text-[#0a0714]'
              : 'border-line text-muted active:border-accent'
          }`}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </button>
      </div>

      <Sheet aberto={menu} fechar={() => setMenu(false)} titulo={`Serie ${serie.serie}`}>
        <Btn className="w-full mb-2" onClick={() => { onAquecimento(); setMenu(false) }}>
          {serie.aquecimento ? 'Marcar como serie normal' : 'Marcar como aquecimento'}
        </Btn>
        <p className="text-[11.5px] text-muted mb-4 px-1 leading-relaxed">
          Series de aquecimento nao contam volume, nem XP, nem recorde.
        </p>
        <Btn variant="danger" className="w-full" onClick={() => { onRemover(); setMenu(false) }}>
          Remover essa serie
        </Btn>
      </Sheet>
    </>
  )
}

function NumInput({ valor, onChange, passo, feito, inteiro, destaque }: {
  valor: number; onChange: (v: number) => void; passo: number
  feito?: boolean; inteiro?: boolean; destaque?: boolean
}) {
  return (
    <div className="flex-1 flex items-center rounded-xl bg-bg-soft border border-line overflow-hidden h-11">
      <button onClick={() => onChange(Math.max(0, Number((valor - passo).toFixed(2))))}
        aria-label="Diminuir"
        className="w-9 h-full shrink-0 text-muted text-base active:bg-surface-2">-</button>
      <input
        type="number" inputMode="decimal"
        value={valor === 0 ? '' : valor} placeholder="0"
        onChange={e => {
          const v = Number(e.target.value || 0)
          onChange(inteiro ? Math.round(v) : v)
        }}
        className={`flex-1 min-w-0 h-full text-center bg-transparent font-bold text-[15px] outline-none tabular-nums ${
          destaque ? 'text-xp' : feito ? 'text-good' : 'text-txt'
        }`} />
      <button onClick={() => onChange(Number((valor + passo).toFixed(2)))}
        aria-label="Aumentar"
        className="w-9 h-full shrink-0 text-muted text-base active:bg-surface-2">+</button>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function TelaResumo({ resumo, sessao, onFechar, mapaEx }: {
  resumo: ResumoSessao
  sessao: { nome: string }
  onFechar: () => void
  mapaEx: Map<string, { nome: string }>
}) {
  return (
    <div className="fixed inset-0 z-[65] bg-bg overflow-y-auto">
      <div className="max-w-[560px] mx-auto px-6 py-10 safe-t safe-b">
        <div className="text-center mb-8 anim-pop">
          <div className="flex justify-center mb-4 text-accent"><Icone nome="chama" tamanho={60} traco={1.5} /></div>
          <h1 className="text-3xl font-black mb-1.5">Treino concluido</h1>
          <p className="text-sm text-muted">{sessao.nome}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <Estatistica rotulo="Duracao" valor={duracao(resumo.duracaoMs)} />
          <Estatistica rotulo="Series" valor={String(resumo.series)} />
          <Estatistica rotulo="Volume" valor={peso(resumo.volume)} />
          <Estatistica rotulo="XP ganho" valor={`+${n0(resumo.ganho.xp)}`} destaque />
        </div>

        {resumo.prs.length > 0 && (
          <div className="rounded-2xl border border-xp/40 bg-xp/8 p-4 mb-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-xp mb-3">
              {resumo.prs.length} recorde{resumo.prs.length > 1 ? 's' : ''} pessoal{resumo.prs.length > 1 ? 'is' : ''}
            </p>
            <div className="space-y-2.5">
              {resumo.prs.map(pr => (
                <div key={pr.exercicioId} className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold truncate">
                      {mapaEx.get(pr.exercicioId)?.nome ?? 'Exercicio'}
                    </p>
                    <p className="text-[10.5px] uppercase tracking-wider text-muted">
                      {pr.tipo === 'carga' ? 'carga' : 'melhor serie'}
                    </p>
                  </div>
                  <span className="text-[13px] font-bold text-xp shrink-0 tabular-nums text-right">
                    {pr.tipo === 'carga'
                      ? `${pr.anterior} → ${pr.valor} kg`
                      : `${pr.carga} kg x ${pr.reps}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Btn variant="primary" size="lg" className="w-full" onClick={onFechar}>Voltar ao inicio</Btn>
      </div>
    </div>
  )
}

function Estatistica({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface border border-line/70 p-4">
      <p className="text-[10.5px] uppercase tracking-wider text-muted font-semibold mb-1">{rotulo}</p>
      <p className={`text-xl font-black tabular-nums ${destaque ? 'text-xp' : 'text-txt'}`}>{valor}</p>
    </div>
  )
}
