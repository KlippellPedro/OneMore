import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Cabecalho } from '../components/Cabecalho'
import { Card, Btn, Secao, Vazio, Confirmar } from '../components/ui'
import { Icone } from '../components/Icone'
import { Grafico } from '../components/Grafico'
import { CartaoTreino } from '../components/CartaoTreino'
import { useUI } from '../state/ui'
import { useMapaExercicios, useMapaAlimentos } from '../state/hooks'
import { hoje } from '../db'
import { calcularMelhores } from '../db/melhores'
import { lerAluno, removerAluno, type DetalheAluno } from '../lib/equipe'
import { semanasDeTreino, constancia, historico, diasDeDieta, situacaoDoCartao } from '../lib/painel'
import { haQuanto, quandoFoi } from '../lib/cartao'
import { diaCurto, n0, n1, nq, pl } from '../lib/format'

const OBJETIVO: Record<string, string> = { cutting: 'Perder gordura', manutencao: 'Manutenção', bulking: 'Ganhar massa' }

/**
 * Ficha do aluno, do lado do treinador. Tudo vem do servidor, ja filtrado pelo
 * que o aluno liberou - o que nao foi liberado nem chega aqui, e a tela diz.
 */
export default function Aluno() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { toast } = useUI()
  const mapaEx = useMapaExercicios()
  const mapaAl = useMapaAlimentos()
  const [d, setD] = useState<DetalheAluno | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [remover, setRemover] = useState(false)
  const hj = hoje()

  const carregar = useCallback(async () => {
    try {
      setD(await lerAluno(id))
      setErro(null)
    } catch (e) {
      setErro((e as Error).message)
    }
  }, [id])
  useEffect(() => { carregar() }, [carregar])

  const dados = d?.dados ?? null
  const nomeEx = useMemo(() => {
    const doAluno = new Map((dados?.exercicios ?? []).map(e => [e.id, e.nome]))
    return (exId: string) => mapaEx.get(exId)?.nome ?? doAluno.get(exId) ?? 'Exercício'
  }, [dados, mapaEx])

  const semanas = useMemo(() => (dados ? semanasDeTreino(dados.sessoes, hj, 8) : []), [dados, hj])
  const feitos = useMemo(() => (dados ? historico(dados.sessoes, 20) : []), [dados])
  const recordes = useMemo(() => (dados
    ? calcularMelhores(dados.sessoes).filter(m => m.recordeCarga > 0).sort((a, b) => b.recordeCarga - a.recordeCarga).slice(0, 6)
    : []), [dados])
  const dieta = useMemo(() => {
    if (!dados?.dieta) return null
    const alimentos = new Map([...mapaAl, ...(dados.alimentos ?? []).map(a => [a.id, a] as const)])
    return diasDeDieta(dados.dieta, alimentos, hj, 7)
  }, [dados, mapaAl, hj])

  if (erro) {
    return (
      <div>
        <Cabecalho titulo="Aluno" voltarPara="/equipe" />
        <Vazio icone="alerta" titulo="Não deu pra abrir" texto={erro}
          acao={<Btn onClick={() => { setErro(null); carregar() }}>Tentar de novo</Btn>} />
      </div>
    )
  }
  if (!d) {
    return (
      <div>
        <Cabecalho titulo="Aluno" voltarPara="/equipe" />
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-line border-t-accent animate-spin" />
        </div>
      </div>
    )
  }

  const perfil = dados?.perfil ?? {}
  const nome = d.cartao?.nome ?? perfil.nome ?? 'Aluno'
  const meta = perfil.metaTreinosSemana ?? d.cartao?.metaSemana ?? 0
  const s = situacaoDoCartao(d.cartao, hj)
  const taxa = constancia(semanas, meta)
  const pesos = (dados?.corpo ?? []).filter(c => c.peso != null).sort((a, b) => a.data.localeCompare(b.data))
  const ultimaMedida = [...(dados?.corpo ?? [])].sort((a, b) => b.data.localeCompare(a.data))[0]
  const metaKcal = perfil.metaKcal ?? 0

  return (
    <div>
      <Cabecalho titulo={nome} voltarPara="/equipe"
        sub={`Na equipe desde ${new Date(d.aluno.entrouEm).toLocaleDateString('pt-BR')}${
          d.sincronizadoEm ? ` - sincronizou ${haQuanto(new Date(d.sincronizadoEm).getTime())}` : ''}`} />

      <div className="px-4 pt-4">
        {/* -------- o que fazer -------- */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <Btn variant="primary" onClick={() => nav(`/equipe/aluno/${id}/treino`)}>
            <Icone nome="halter" tamanho={17} /> {d.programa ? 'Editar treino' : 'Montar treino'}
          </Btn>
          <Btn variant="primary" onClick={() => nav(`/equipe/aluno/${id}/dieta`)}>
            <Icone nome="prato" tamanho={17} /> {d.dieta ? 'Editar dieta' : 'Montar dieta'}
          </Btn>
        </div>
        {(d.aluno.programaEm || d.aluno.dietaEm) && (
          <p className="text-[11.5px] text-muted -mt-3 mb-5 px-1">
            {d.aluno.programaEm && `Treino mandado em ${new Date(d.aluno.programaEm).toLocaleDateString('pt-BR')}. `}
            {d.aluno.dietaEm && `Dieta mandada em ${new Date(d.aluno.dietaEm).toLocaleDateString('pt-BR')}.`}
          </p>
        )}

        {!dados ? (
          <Card className="p-4 mb-5 text-[13px] text-muted leading-relaxed">
            Esse aluno ainda não sincronizou nada com a conta. Os números aparecem depois que o app for aberto com internet.
          </Card>
        ) : (
          <>
            {/* -------- resumo -------- */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              <Mini valor={meta ? `${s.treinosSemana}/${meta}` : String(s.treinosSemana)} rotulo="nesta semana" />
              <Mini valor={taxa == null ? '-' : `${Math.round(taxa * 100)}%`} rotulo="semanas na meta" />
              <Mini valor={s.diasSemTreinar == null ? '-' : s.diasSemTreinar === 0 ? 'hoje' : `${s.diasSemTreinar}d`}
                rotulo="desde o último" cor={s.diasSemTreinar != null && s.diasSemTreinar >= 4 ? 'var(--color-warn)' : undefined} />
            </div>

            {perfil.objetivo && (
              <p className="text-[12px] text-muted mb-4 px-1">
                Objetivo: <b className="text-txt/85">{OBJETIVO[perfil.objetivo] ?? perfil.objetivo}</b>
                {meta ? ` - meta de ${pl(meta, 'treino')} por semana` : ''}
              </p>
            )}

            {d.cartao && <div className="mb-6"><CartaoTreino cartao={d.cartao} hoje={hj} /></div>}

            <Secao titulo="Volume por semana">
              <Card className="p-4">
                <Grafico pontos={semanas.map(x => ({ x: x.inicio, y: x.volume }))} sufixo=" kg" minimoZero />
                <div className="grid grid-cols-8 gap-1 mt-3">
                  {semanas.map(x => (
                    <div key={x.inicio} className="text-center">
                      <div className={`h-6 rounded-md flex items-center justify-center text-[10.5px] font-bold ${
                        meta && x.treinos >= meta ? 'text-white' : 'text-muted bg-surface-2'}`}
                        style={meta && x.treinos >= meta ? { background: 'var(--cor-secao, var(--color-accent))' } : undefined}>
                        {x.treinos}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10.5px] text-muted mt-1.5">Treinos por semana, nas últimas 8 (colorida = bateu a meta)</p>
              </Card>
            </Secao>

            {recordes.length > 0 && (
              <Secao titulo="Maiores cargas">
                <Card className="overflow-hidden">
                  {recordes.map(m => (
                    <div key={m.exercicioId} className="flex items-baseline gap-3 px-4 py-2.5 border-b border-line/40 last:border-0">
                      <p className="flex-1 min-w-0 text-[13px] font-semibold truncate">{nomeEx(m.exercicioId)}</p>
                      <p className="text-[13px] font-bold shrink-0">{nq(m.recordeCarga)} kg <span className="text-muted font-medium">x{m.recordeReps}</span></p>
                      <p className="text-[11px] text-muted shrink-0 w-24 text-right">última {nq(m.ultimaCarga)} kg</p>
                    </div>
                  ))}
                </Card>
              </Secao>
            )}

            <Secao titulo="Semana de treino atual">
              {dados.rotinas.length === 0 ? (
                <Card className="p-4 text-[13px] text-muted">Nenhuma rotina ativa.</Card>
              ) : (
                <Card className="overflow-hidden">
                  {[...dados.rotinas].sort((a, b) => a.ordem - b.ordem).map(r => (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-line/40 last:border-0">
                      <span className="w-1 self-stretch rounded-full shrink-0 min-h-[26px]" style={{ background: r.cor }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{r.nome}</p>
                        <p className="text-[11px] text-muted truncate">{r.itens.map(i => nomeEx(i.exercicioId)).join(', ') || 'Vazia'}</p>
                      </div>
                      <span className="text-[11px] text-muted shrink-0">{r.dias?.length ? r.dias.map(diaCurto).join(', ') : 'sem dia'}</span>
                    </div>
                  ))}
                </Card>
              )}
            </Secao>

            <Secao titulo="Histórico">
              {feitos.length === 0 ? (
                <Card className="p-4 text-[13px] text-muted">Nenhum treino registrado ainda.</Card>
              ) : (
                <Card className="overflow-hidden">
                  {feitos.map(t => (
                    <div key={t.id} className="border-b border-line/40 last:border-0">
                      <button onClick={() => setAberto(aberto === t.id ? null : t.id)}
                        className="w-full flex items-baseline gap-2 px-4 py-2.5 text-left active:bg-surface-2">
                        <p className="flex-1 min-w-0 text-[13px] font-semibold truncate">{t.nome}</p>
                        <p className="text-[11px] text-muted shrink-0">
                          {pl(t.series, 'série')} - {t.volume >= 1000 ? `${n1(t.volume / 1000)} t` : `${n0(t.volume)} kg`}{t.minutos ? ` - ${t.minutos} min` : ''}
                        </p>
                        <p className="text-[11px] text-muted shrink-0 w-14 text-right">{quandoFoi(t.dia, hj)}</p>
                      </button>
                      {aberto === t.id && (
                        <div className="px-4 pb-3 space-y-1">
                          {t.exercicios.map(e => (
                            <div key={e.exercicioId} className="flex gap-2 text-[12px]">
                              <span className="flex-1 min-w-0 truncate text-txt/85">{nomeEx(e.exercicioId)}</span>
                              <span className="text-muted shrink-0 text-right">
                                {e.series.map(x => `${nq(x.carga)}x${x.reps}`).join('  ')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </Card>
              )}
            </Secao>

            <Secao titulo="Corpo">
              {!d.aluno.permissoes.corpo ? (
                <Card className="p-4 text-[12.5px] text-muted">O aluno não liberou as medidas do corpo.</Card>
              ) : (
                <Card className="p-4">
                  {pesos.length > 1
                    ? <Grafico pontos={pesos.map(p => ({ x: p.data, y: p.peso! }))} sufixo=" kg" />
                    : <p className="text-[12.5px] text-muted mb-2">Poucos registros de peso pra um gráfico.</p>}
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <Mini valor={perfil.pesoKg ? `${n1(perfil.pesoKg)}` : '-'} rotulo="peso (kg)" />
                    <Mini valor={perfil.alturaCm ? String(perfil.alturaCm) : '-'} rotulo="altura (cm)" />
                    <Mini valor={ultimaMedida?.gorduraPct ? `${n1(ultimaMedida.gorduraPct)}%` : '-'} rotulo="gordura" />
                  </div>
                  {ultimaMedida && (
                    <p className="text-[11px] text-muted mt-2">
                      Última medida em {ultimaMedida.data.split('-').reverse().join('/')}
                      {ultimaMedida.cintura ? ` - cintura ${n1(ultimaMedida.cintura)} cm` : ''}
                      {ultimaMedida.braco ? ` - braço ${n1(ultimaMedida.braco)} cm` : ''}
                    </p>
                  )}
                </Card>
              )}
            </Secao>

            <Secao titulo="Dieta (últimos 7 dias)">
              {!d.aluno.permissoes.dieta || !dieta ? (
                <Card className="p-4 text-[12.5px] text-muted">O aluno não liberou a dieta.</Card>
              ) : (
                <Card className="p-4">
                  <div className="flex items-end gap-1.5 h-24 mb-1">
                    {dieta.map(x => {
                      const alt = metaKcal ? Math.min(1.25, x.kcal / metaKcal) : x.kcal ? 1 : 0
                      const perto = metaKcal && Math.abs(x.kcal - metaKcal) / metaKcal <= 0.1
                      return (
                        <div key={x.dia} className="flex-1 flex flex-col items-center justify-end h-full" title={`${x.dia}: ${x.kcal} kcal`}>
                          <div className="w-full rounded-md"
                            style={{
                              height: `${Math.max(alt * 80, x.kcal ? 4 : 2)}%`,
                              background: !x.registros ? 'var(--color-surface-2)' : perto ? 'var(--color-good)' : 'var(--cor-secao, var(--color-accent))',
                            }} />
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex gap-1.5">
                    {dieta.map(x => (
                      <p key={x.dia} className="flex-1 text-center text-[10px] text-muted">{diaCurto(new Date(`${x.dia}T12:00`).getDay())}</p>
                    ))}
                  </div>
                  <p className="text-[11.5px] text-muted mt-2 leading-relaxed">
                    {metaKcal ? `Meta ${n0(metaKcal)} kcal (verde = até 10% da meta). ` : ''}
                    Média nos dias registrados: {(() => {
                      const com = dieta.filter(x => x.registros)
                      if (!com.length) return 'nenhum registro'
                      return `${n0(com.reduce((t, x) => t + x.kcal, 0) / com.length)} kcal e ${n0(com.reduce((t, x) => t + x.prot, 0) / com.length)} g de proteína`
                    })()}
                  </p>
                </Card>
              )}
            </Secao>
          </>
        )}

        <button onClick={() => setRemover(true)} className="w-full text-center text-[12.5px] font-semibold text-bad py-3 mb-6">
          Tirar da equipe
        </button>
      </div>

      <Confirmar aberto={remover} perigo titulo="Tirar da equipe?"
        texto={`${nome} sai da equipe e você deixa de ver os dados. O treino e a dieta em uso continuam no app dessa pessoa.`}
        onNao={() => setRemover(false)}
        onSim={async () => {
          setRemover(false)
          try { await removerAluno(id); toast('Aluno tirado da equipe', 'ok'); nav('/equipe') } catch (e) { toast((e as Error).message, 'erro') }
        }} />
    </div>
  )
}

function Mini({ valor, rotulo, cor }: { valor: string; rotulo: string; cor?: string }) {
  return (
    <div className="rounded-xl bg-surface-2/60 border border-line/60 px-2 py-2 text-center">
      <p className="text-[16px] font-black tabular-nums leading-tight" style={cor ? { color: cor } : undefined}>{valor}</p>
      <p className="text-[10.5px] text-muted">{rotulo}</p>
    </div>
  )
}
