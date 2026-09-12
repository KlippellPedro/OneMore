import { useParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, isoDia } from '../db'
import { useMapaExercicios } from '../state/hooks'
import { volumeSessao } from '../lib/acoes'
import { porExercicio } from '../db/melhores'
import { corGrupo } from '../db/seedExercicios'
import { Cabecalho } from '../components/Cabecalho'
import { Card, Vazio, Btn } from '../components/ui'
import { ImagemExercicio } from '../components/ImagemExercicio'
import { dataCurta, duracao, horaDe, peso, n0, pl } from '../lib/format'

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
  const feitas = sessao.series.filter(g => g.feito)
  const validas = feitas.filter(g => !g.aquecimento)
  const grupos = [...porExercicio(sessao.series)]

  return (
    <div>
      <Cabecalho titulo={sessao.nome} voltarPara="/progresso"
        sub={`${dataCurta(dia)} - ${horaDe(sessao.inicio)}`} />

      <div className="px-4 pt-4 pb-6">
        {/* 2 colunas: em 4, "1h 00min" nao cabe num celular de 375px */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Numero rotulo="Duração" valor={sessao.fim ? duracao(sessao.fim - sessao.inicio) : '-'} />
          <Numero rotulo="Séries" valor={String(validas.length)} />
          <Numero rotulo="Volume" valor={peso(volumeSessao(sessao))} />
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
            {grupos.map(([exId, series]) => {
              const ex = mapaEx.get(exId)
              const doEx = series.filter(g => g.feito && !g.aquecimento)
              const volume = doEx.reduce((t, g) => t + g.carga * g.reps, 0)
              const topo = doEx.reduce((m, g) => Math.max(m, g.carga), 0)
              return (
                <Card key={exId} className="p-3">
                  <div className="flex items-start gap-3 mb-2.5">
                    <span className="w-1 self-stretch rounded-full shrink-0 min-h-[40px]"
                      style={{ background: ex ? corGrupo(ex.grupo) : 'var(--color-muted)' }} />
                    <Link to={`/exercícios/${exId}`} className="shrink-0">
                      <ImagemExercicio exercicioId={exId} tamanho="mini" animar={false} />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/exercícios/${exId}`} className="text-[14px] font-bold leading-tight block truncate">
                        {ex?.nome ?? 'Exercício removido'}
                      </Link>
                      <p className="text-[11.5px] text-muted mt-0.5">
                        {pl(doEx.length, 'série')}
                        {topo > 0 ? ` - até ${topo} kg` : ''}
                        {volume > 0 ? ` - ${peso(volume)}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {series.map((g, i) => (
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
                </Card>
              )
            })}
          </div>
        )}
      </div>
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
