import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, isoDia } from '../db'
import { useMapaExercicios } from '../state/hooks'
import { volumeSessao, apagarSessao, corrigirSessao } from '../lib/acoes'
import { porExercicio } from '../db/melhores'
import { corGrupo } from '../db/seedExercicios'
import { Cabecalho } from '../components/Cabecalho'
import { Card, Vazio, Btn, Stepper, Confirmar } from '../components/ui'
import { ImagemExercicio } from '../components/ImagemExercicio'
import { useUI } from '../state/ui'
import { dataCurta, duracao, horaDe, peso, n0, pl } from '../lib/format'
import type { SerieLog } from '../db/types'

/**
 * Um treino que ja passou, serie por serie.
 *
 * O historico so mostrava nome, data e volume - dava pra saber QUE voce treinou,
 * nunca O QUE voce fez. E justamente isso que se quer olhar antes de repetir o
 * treino: quanto foi o supino da semana passada, quantas reps saíram na ultima.
 */
export default function DetalheSessao() {
  const { id = '' } = useParams()
  // o `?? null` separa "ainda carregando" de "não existe": o get() do Dexie
  // devolve undefined nos dois casos, e sem isso um treino apagado ficava
  // preso em "Carregando..." pra sempre
  const sessao = useLiveQuery(() => db.sessoes.get(id).then(s => s ?? null), [id])
  const mapaEx = useMapaExercicios()
  const nav = useNavigate()
  const { toast } = useUI()
  /** Rascunho das series enquanto corrige. null = so olhando. */
  const [editando, setEditando] = useState<SerieLog[] | null>(null)
  const [apagar, setApagar] = useState(false)

  if (sessao === undefined) {
    return <div className="p-10 text-center text-muted text-sm">Carregando...</div>
  }
  if (sessao === null) {
    return (
      <div>
        <Cabecalho titulo="Treino" voltarPara="/progresso" />
        <Vazio icone="prancheta" titulo="Treino não encontrado"
          texto="Ele pode ter sido apagado."
          acao={<Btn variant="primary" onClick={() => history.back()}>Voltar</Btn>} />
      </div>
    )
  }

  const dia = isoDia(new Date(sessao.inicio))
  // corrigindo, os numeros do topo acompanham o rascunho
  const series = editando ?? sessao.series
  const feitas = series.filter(g => g.feito)
  const validas = feitas.filter(g => !g.aquecimento)
  const grupos = [...porExercicio(series)]

  const alterar = (i: number, patch: Partial<SerieLog>) =>
    setEditando(e => e && e.map((g, j) => (j === i ? { ...g, ...patch } : g)))

  async function salvarCorrecao() {
    if (!editando) return
    await corrigirSessao(id, editando)
    setEditando(null)
    toast('Treino corrigido', 'ok', 'Recordes recalculados')
  }

  return (
    <div>
      <Cabecalho titulo={sessao.nome} voltarPara="/progresso"
        sub={`${dataCurta(dia)} - ${horaDe(sessao.inicio)}`} />

      <div className="px-4 pt-4 pb-6">
        {/* 2 colunas: em 4, "1h 00min" nao cabe num celular de 375px */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Numero rotulo="Duração" valor={sessao.fim ? duracao(sessao.fim - sessao.inicio) : '-'} />
          <Numero rotulo="Séries" valor={String(validas.length)} />
          <Numero rotulo="Volume" valor={peso(volumeSessao({ ...sessao, series }))} />
          <Numero rotulo="XP" valor={`+${n0(sessao.xpGanho ?? 0)}`} destaque />
        </div>

        {sessao.notas && (
          <Card className="p-4 mb-4">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2">Anotações</h2>
            <p className="text-[13px] leading-relaxed text-txt/85 whitespace-pre-wrap">{sessao.notas}</p>
          </Card>
        )}

        {grupos.length === 0 ? (
          <Vazio icone="halter" titulo="Nenhuma série registrada" />
        ) : (
          <div className="space-y-2.5">
            {grupos.map(([exId, doGrupo]) => {
              const ex = mapaEx.get(exId)
              const doEx = doGrupo.filter(g => g.feito && !g.aquecimento)
              const volume = doEx.reduce((t, g) => t + g.carga * g.reps, 0)
              const topo = doEx.reduce((m, g) => Math.max(m, g.carga), 0)
              return (
                <Card key={exId} className="p-3">
                  <div className="flex items-start gap-3 mb-2.5">
                    <span className="w-1 self-stretch rounded-full shrink-0 min-h-[40px]"
                      style={{ background: ex ? corGrupo(ex.grupo) : 'var(--color-muted)' }} />
                    <Link to={`/exercicios/${exId}`} className="shrink-0">
                      <ImagemExercicio exercicioId={exId} tamanho="mini" animar={false} />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/exercicios/${exId}`} className="text-[14px] font-bold leading-tight block truncate">
                        {ex?.nome ?? 'Exercício removido'}
                      </Link>
                      <p className="text-[11.5px] text-muted mt-0.5">
                        {pl(doEx.length, 'série')}
                        {topo > 0 ? ` - até ${topo} kg` : ''}
                        {volume > 0 ? ` - ${peso(volume)}` : ''}
                      </p>
                    </div>
                  </div>

                  {editando ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                        <span className="w-7 shrink-0" />
                        <span className="flex-1 text-center">Carga (kg)</span>
                        <span className="flex-1 text-center">Reps</span>
                      </div>
                      {doGrupo.map(g => {
                        // porExercicio devolve os proprios objetos do rascunho:
                        // o indice deles e o que `alterar` precisa
                        const i = editando.indexOf(g)
                        return (
                          <div key={i} className={`flex items-center gap-2 ${g.feito ? '' : 'opacity-45'}`}>
                            <span className={`w-7 shrink-0 text-center text-[11px] font-bold ${
                              g.aquecimento ? 'text-warn' : g.feito ? 'text-good' : 'text-muted'
                            }`}>
                              {g.aquecimento ? 'A' : g.serie}
                            </span>
                            <div className="flex-1 min-w-0">
                              <Stepper valor={g.carga} passo={2.5} max={1000}
                                setValor={v => alterar(i, { carga: v })} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <Stepper valor={g.reps} max={999}
                                setValor={v => alterar(i, { reps: Math.round(v) })} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                  <div className="space-y-1">
                    {doGrupo.map((g, i) => (
                      <div key={i} className={`flex items-center gap-2 text-[12.5px] px-1 py-1 rounded-lg ${
                        g.feito ? '' : 'opacity-45'
                      }`}>
                        <span className={`w-7 shrink-0 text-center text-[11px] font-bold ${
                          g.aquecimento ? 'text-warn' : g.feito ? 'text-good' : 'text-muted'
                        }`}>
                          {g.aquecimento ? 'A' : g.serie}
                        </span>
                        <span className="flex-1 tabular-nums">
                          {g.carga > 0 ? `${g.carga} kg` : 'sem carga'} <span className="text-muted">x</span> {g.reps}
                        </span>
                        {!g.feito && <span className="text-[10.5px] text-muted shrink-0">não feita</span>}
                        {g.feito && g.ts && (
                          <span className="text-[10.5px] text-muted shrink-0 tabular-nums">{horaDe(g.ts)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}

        {editando ? (
          <div className="mt-4">
            <p className="text-[11.5px] text-muted leading-relaxed mb-3 px-1">
              Recorde e última carga são recalculados com os números corrigidos.
              O XP do treino continua o mesmo.
            </p>
            <div className="flex gap-2">
              <Btn variant="ghost" className="flex-1" onClick={() => setEditando(null)}>Cancelar</Btn>
              <Btn variant="primary" className="flex-1" onClick={salvarCorrecao}>Salvar correção</Btn>
            </div>
          </div>
        ) : sessao.concluida === 1 && (
          <div className="flex gap-2 mt-4">
            {grupos.length > 0 && (
              <Btn className="flex-1" onClick={() => setEditando(sessao.series)}>Corrigir números</Btn>
            )}
            <Btn variant="danger" className="flex-1" onClick={() => setApagar(true)}>Apagar treino</Btn>
          </div>
        )}
      </div>

      <Confirmar aberto={apagar} perigo titulo="Apagar este treino?"
        texto={`Ele some do histórico junto com os ${n0(sessao.xpGanho ?? 0)} XP que deu, e os recordes são recalculados sem ele. Conquista já desbloqueada continua.`}
        onNao={() => setApagar(false)}
        onSim={async () => {
          setApagar(false)
          await apagarSessao(id)
          toast('Treino apagado', 'ok')
          nav('/progresso', { replace: true })
        }} />
    </div>
  )
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-xl bg-surface border border-line/70 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-0.5">{rotulo}</p>
      <p className={`text-[15px] font-black tabular-nums ${destaque ? 'text-xp' : ''}`}>{valor}</p>
    </div>
  )
}
