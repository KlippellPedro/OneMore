import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { db, uid, restaurarLinhas } from '../db'
import { useRotinas, useRotinasArquivadas, useMapaExercicios, useSessaoAtiva } from '../state/hooks'
import {
  iniciarSessao, atribuirDia, restaurarRotina, arquivarRotina, desarquivarRotina, apagarArquivadas,
} from '../lib/acoes'
import { corGrupo, nomeGrupo } from '../db/seedExercicios'
import { Titulo } from '../components/Cabecalho'
import { Card, Btn, Vazio, Confirmar, Sheet, Campo, Input, Chip } from '../components/ui'
import { useUI, vibrar } from '../state/ui'
import { diaCurto, diaLongo, pl } from '../lib/format'
import { Icone } from '../components/Icone'
import { SemanasSalvas } from '../components/SemanasSalvas'
import { Recebidos } from '../components/Recebidos'
import { SheetEnviar } from '../components/SheetEnviar'
import { pacoteDaSemanaAtual } from '../lib/envios'
import { VolumeSemanal } from '../components/VolumeSemanal'
import { duracaoEstimada } from '../lib/treino'
import type { GrupoMuscular, Rotina } from '../db/types'

const CORES = ['#8b6dd6', '#4f9aad', '#4caf87', '#c9a049', '#bd7095', '#c25f70', '#7b81be', '#a86eaf']

/** Semana comecando na segunda, que e como as pessoas pensam em treino. */
const SEMANA = [1, 2, 3, 4, 5, 6, 0]

export default function Treinos() {
  const nav = useNavigate()
  const { toast } = useUI()
  const rotinas = useRotinas()
  const arquivadas = useRotinasArquivadas()
  const mapaEx = useMapaExercicios()
  const sessaoAtiva = useSessaoAtiva()

  const [novo, setNovo] = useState(false)
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(CORES[0])
  const [apagar, setApagar] = useState<string | null>(null)
  /** Rotina arquivada que vai ser apagada de vez. */
  const [apagarDeVez, setApagarDeVez] = useState<Rotina | null>(null)
  /** Confirmacao do "Apagar todos" dos Arquivados. */
  const [limparArquivados, setLimparArquivados] = useState(false)

  /** Apaga de vez e oferece o Desfazer - nenhum dos dois caminhos fica sem volta. */
  async function apagarDosArquivados(ids?: string[]) {
    const linhas = await apagarArquivadas(ids)
    if (!linhas.length) return
    vibrar()
    toast(linhas.length === 1 ? `${linhas[0].nome} apagado` : `${pl(linhas.length, 'treino')} apagados`, 'ok', undefined, {
      rotulo: 'Desfazer', fazer: () => { restaurarLinhas('rotinas', linhas) },
    })
  }
  const [diaAberto, setDiaAberto] = useState<number | null>(null)
  const [vista, setVista] = useState<'semana' | 'rotinas'>('semana')
  const [enviar, setEnviar] = useState(false)
  /** 'semana' = todas as rotinas ativas; senao, o id de uma rotina. */
  const [oQue, setOQue] = useState<string>('semana')

  const hojeDia = new Date().getDay()
  const doDia = (d: number) => rotinas.find(r => r.dias?.includes(d))

  async function criar() {
    if (!nome.trim()) return toast('Da um nome pro treino', 'erro')
    const id = uid()
    await db.rotinas.put({
      id, nome: nome.trim(), cor, dias: [], itens: [],
      ordem: rotinas.length, arquivada: 0, atualizadoEm: Date.now(),
    })
    setNovo(false); setNome(''); setCor(CORES[0])
    nav(`/treinos/${id}`)
  }

  async function comecar(r: Rotina) {
    if (!r.itens.length) return toast('Esse treino está vazio', 'erro', 'Adicione exercícios primeiro')
    vibrar(20)
    nav(`/sessao/${await iniciarSessao(r)}`)
  }

  async function duplicar(r: Rotina) {
    await db.rotinas.put({
      ...r,
      id: uid(),
      nome: r.nome + ' (copia)',
      dias: [],
      itens: r.itens.map(i => ({ ...i })),
      ordem: rotinas.length,
      arquivada: 0,
      atualizadoEm: Date.now(),
    })
    vibrar()
    toast('Treino duplicado', 'ok')
  }

  return (
    <div>
      <Titulo titulo="Treino" sub={pl(rotinas.length, 'rotina')}
        acao={
          <div className="flex items-center gap-1.5">
            {rotinas.length > 0 && (
              <button onClick={() => { setOQue('semana'); setEnviar(true) }} aria-label="Mandar treino pra amigo"
                className="toque h-9 px-2.5 rounded-xl flex items-center gap-1.5 text-[12.5px] font-semibold text-muted active:bg-surface-2">
                <Icone nome="compartilhar" tamanho={16} /> Mandar
              </button>
            )}
            <Btn variant="primary" size="sm" onClick={() => setNovo(true)}>+ Novo</Btn>
          </div>
        } />

      <div className="px-4">
        <Recebidos tipo="treino" />

        {sessaoAtiva && (
          <Card className="p-4 mb-4 border-accent/40" onClick={() => nav(`/sessao/${sessaoAtiva.id}`)}>
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
              <p className="flex-1 text-[14px] font-bold truncate">{sessaoAtiva.nome}</p>
              <span className="text-accent text-sm font-bold">Continuar</span>
            </div>
          </Card>
        )}

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

        {/* -------- semana / rotinas -------- */}
        <div className="flex items-center justify-between mb-2.5 px-1">
          <div className="flex gap-2">
            <Chip ativo={vista === 'semana'} onClick={() => setVista('semana')}>Semana</Chip>
            <Chip ativo={vista === 'rotinas'} onClick={() => setVista('rotinas')}>Rotinas</Chip>
          </div>
          {vista === 'semana' && <span className="text-[11px] text-muted">toque pra trocar</span>}
        </div>

        {vista === 'semana' ? (
          <Card className="overflow-hidden mb-6">
            {SEMANA.map(d => {
              const r = doDia(d)
              const ehHoje = d === hojeDia
              return (
                <div key={d} role="button" tabIndex={0} onClick={() => setDiaAberto(d)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setDiaAberto(d) }}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 border-b border-line/40 last:border-0 text-left active:bg-surface-2 cursor-pointer ${
                    ehHoje ? 'bg-accent/8' : ''
                  }`}>
                  <span className={`w-10 shrink-0 text-[12px] font-bold ${ehHoje ? 'text-accent' : 'text-muted'}`}>
                    {diaCurto(d)}
                  </span>
                  {r ? (
                    <>
                      <span className="w-1 self-stretch rounded-full shrink-0 min-h-[32px]" style={{ background: r.cor }} />
                      <div className="flex-1 min-w-0 py-0.5">
                        <p className="text-[13.5px] font-semibold leading-tight line-clamp-2">{r.nome}</p>
                        <p className="text-[11px] text-muted mt-0.5">
                          {pl(r.itens.length, 'exercício')}
                          {r.itens.length > 0 && ` - ~${duracaoEstimada(r.itens)} min`}
                        </p>
                      </div>
                      {ehHoje && r.itens.length > 0 && (
                        <div onClick={e => e.stopPropagation()}>
                          <Btn size="sm" variant="primary" onClick={() => comecar(r)}>Treinar</Btn>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="flex-1 text-[13px] text-muted/60">Descanso</span>
                  )}
                </div>
              )
            })}
          </Card>
        ) : rotinas.length === 0 ? (
          <Vazio icone="halter" titulo="Nenhum treino ainda"
            texto="Pegue um programa pronto ou monte a sua rotina do zero."
            acao={<Btn variant="primary" onClick={() => nav('/treinos/programas')}>Ver programas</Btn>} />
        ) : (
          <div className="space-y-3 mb-6">
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
                            {pl(r.itens.length, 'exercício')} - {pl(totalSeries, 'série')}
                            {r.itens.length > 0 && ` - ~${duracaoEstimada(r.itens)} min`}
                            {r.dias?.length ? ' - ' + r.dias.map(diaCurto).join(', ') : ' - sem dia fixo'}
                          </p>
                        </Link>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => duplicar(r)} aria-label="Duplicar treino"
                            className="w-11 h-11 rounded-lg text-muted active:bg-surface-2 flex items-center justify-center">
                            <Icone nome="copiar" tamanho={17} />
                          </button>
                          <button onClick={() => setApagar(r.id)} aria-label="Apagar treino"
                            className="w-11 h-11 rounded-lg text-muted active:bg-surface-2 active:text-bad flex items-center justify-center">
                            <Icone nome="lixeira" tamanho={17} />
                          </button>
                        </div>
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
                          Começar
                        </Btn>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* -------- equilibrio da semana -------- */}
        {vista === 'semana' && <VolumeSemanal rotinas={rotinas} mapaEx={mapaEx} />}

        {/* -------- o "save" da semana -------- */}
        {vista === 'semana' && <SemanasSalvas rotinas={rotinas} />}

        {/* -------- rotinas que sairam da lista ao trocar de programa -------- */}
        {vista === 'rotinas' && arquivadas.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between gap-3 mb-1 px-1">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted">
                Arquivados
              </h2>
              {arquivadas.length > 1 && (
                <button onClick={() => setLimparArquivados(true)}
                  className="h-8 -my-1 -mr-2 px-2 rounded-lg text-[12px] font-semibold text-muted active:bg-surface-2 active:text-bad flex items-center gap-1.5">
                  <Icone nome="lixeira" tamanho={14} />
                  Apagar todos
                </button>
              )}
            </div>
            <p className="text-[11.5px] text-muted leading-relaxed mb-2.5 px-1">
              Treinos que você apagou ou que saíram quando você trocou de programa. O histórico deles continua intacto.
            </p>
            <Card className="overflow-hidden">
              {arquivadas.map(r => (
                <div key={r.id}
                  className="flex items-center gap-3 px-3.5 py-3 border-b border-line/40 last:border-0">
                  <span className="w-1 self-stretch rounded-full shrink-0 min-h-[32px]" style={{ background: r.cor }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold leading-tight line-clamp-2">{r.nome}</p>
                    <p className="text-[11px] text-muted mt-0.5">{pl(r.itens.length, 'exercício')}</p>
                  </div>
                  <Btn size="sm" onClick={async () => {
                    await restaurarRotina(r.id)
                    vibrar()
                    toast(`${r.nome} voltou`, 'ok', 'Escolha o dia dela em Semana')
                  }}>Restaurar</Btn>
                  <button onClick={() => setApagarDeVez(r)} aria-label={`Apagar ${r.nome} de vez`}
                    className="w-10 h-10 -mr-1.5 shrink-0 rounded-lg text-muted active:bg-surface-2 active:text-bad flex items-center justify-center">
                    <Icone nome="lixeira" tamanho={16} />
                  </button>
                </div>
              ))}
            </Card>
          </div>
        )}

        <Card className="p-4 mt-3" onClick={async () => {
          nav(`/sessao/${await iniciarSessao(undefined, 'Treino livre')}`)
        }}>
          <p className="text-[14px] font-semibold">Treino livre</p>
          <p className="text-[12px] text-muted mt-0.5">Sem rotina. Vai adicionando os exercícios na hora.</p>
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
                  <p className="text-[11.5px] text-muted">{pl(r.itens.length, 'exercício')}</p>
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
            placeholder="Treino A - Peito e Tríceps" autoFocus />
        </Campo>
        <Campo label="Cor">
          <div className="flex gap-2 flex-wrap">
            {CORES.map(c => (
              <button key={c} onClick={() => setCor(c)} aria-label={`Cor ${c}`} className="w-11 h-11 rounded-xl"
                style={{ background: c, boxShadow: cor === c ? `0 0 0 3px var(--color-bg-soft), 0 0 0 5px ${c}` : undefined }} />
            ))}
          </div>
        </Campo>
        <p className="text-[11.5px] text-muted mb-4 leading-relaxed">
          O dia da semana você escolhe depois, em "Minha semana".
        </p>
        <Btn variant="primary" size="lg" className="w-full" onClick={criar}>
          Criar e escolher exercícios
        </Btn>
      </Sheet>

      <Confirmar aberto={!!apagar} perigo titulo="Apagar treino?"
        texto="Ele sai da lista e vai pros Arquivados, no fim de Rotinas - dá pra restaurar de lá. Os treinos já registrados no histórico continuam."
        onSim={async () => {
          const antes = apagar ? await arquivarRotina(apagar) : null
          setApagar(null)
          if (antes) {
            toast(`${antes.nome} foi pros Arquivados`, 'ok', undefined, {
              rotulo: 'Desfazer', fazer: () => { desarquivarRotina(antes) },
            })
          }
        }}
        onNao={() => setApagar(null)} />

      <Confirmar aberto={!!apagarDeVez} perigo titulo="Apagar de vez?"
        texto={`${apagarDeVez?.nome ?? 'Esse treino'} some dos Arquivados, aqui e nos seus outros aparelhos. Logo depois dá pra desfazer. Os treinos já feitos com ele continuam no histórico.`}
        onSim={async () => {
          const r = apagarDeVez
          setApagarDeVez(null)
          if (r) await apagarDosArquivados([r.id])
        }}
        onNao={() => setApagarDeVez(null)} />

      <Confirmar aberto={limparArquivados} perigo titulo={`Apagar os ${arquivadas.length} arquivados?`}
        texto="Todos somem dos Arquivados, aqui e nos seus outros aparelhos. Logo depois dá pra desfazer. Os treinos já feitos com eles continuam no histórico, e as rotinas da sua semana não são tocadas."
        onSim={async () => {
          setLimparArquivados(false)
          await apagarDosArquivados()
        }}
        onNao={() => setLimparArquivados(false)} />

      <SheetEnviar aberto={enviar} fechar={() => setEnviar(false)} tipo="treino"
        titulo="Mandar treino pra amigo"
        nomeInicial={oQue === 'semana' ? 'Minha semana de treino' : rotinas.find(r => r.id === oQue)?.nome ?? 'Treino'}
        montar={nome => pacoteDaSemanaAtual(nome, oQue === 'semana' ? undefined : [oQue])}>
        <p className="text-[12px] font-medium text-muted mb-1.5">O que mandar</p>
        <div className="flex gap-2 flex-wrap mb-4">
          <Chip ativo={oQue === 'semana'} onClick={() => setOQue('semana')}>Semana inteira</Chip>
          {rotinas.map(r => (
            <Chip key={r.id} ativo={oQue === r.id} onClick={() => setOQue(r.id)}>{r.nome}</Chip>
          ))}
        </div>
      </SheetEnviar>
    </div>
  )
}
