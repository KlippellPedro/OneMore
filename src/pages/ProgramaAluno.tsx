import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Cabecalho } from '../components/Cabecalho'
import { Card, Btn, Input, Textarea, Campo, Sheet, Stepper, Chip, Confirmar, Vazio } from '../components/ui'
import { Icone } from '../components/Icone'
import { Seletor } from '../components/SeletorExercicio'
import { useUI, vibrar } from '../state/ui'
import { useExercicios, useRotinas, useSemanas } from '../state/hooks'
import { uid } from '../db'
import { lerAluno, prescrever, type DetalheAluno } from '../lib/equipe'
import { pacoteDeTreino, lerPacoteTreino } from '../lib/pacotes'
import { retratoDaSemana } from '../lib/semana'
import { diaCurto, pl } from '../lib/format'
import type { Exercicio, ItemRotina, RotinaSalva } from '../db/types'

/**
 * O treinador monta a semana de treino de um aluno. Nao mexe em nada do
 * proprio treinador: o rascunho fica neste aparelho (localStorage, por aluno)
 * ate ser mandado, e o mandado fica no vinculo com o aluno, no servidor - e
 * de la que a edicao seguinte comeca.
 *
 * Do lado do aluno, chega como "Treino do seu treinador" e so vira a semana
 * dele quando ele tocar em Usar (com a semana de antes guardada).
 */

interface Programa { nome: string; rotinas: RotinaSalva[]; exercicios: Exercicio[] }

const CORES = ['#8b6dd6', '#4f9aad', '#4caf87', '#c9a049', '#bd7095', '#c25f70', '#7b81be', '#a86eaf']
const SEMANA = [1, 2, 3, 4, 5, 6, 0]
const chaveRascunho = (id: string) => `onemore:rascunho:treino:${id}`

function lerRascunho(id: string): Programa | null {
  try {
    const r = JSON.parse(localStorage.getItem(chaveRascunho(id)) ?? 'null')
    return r && Array.isArray(r.rotinas) ? r : null
  } catch { return null }
}

const novaRotina = (ordem: number): RotinaSalva => ({
  id: uid(), nome: `Treino ${String.fromCharCode(65 + (ordem % 26))}`, cor: CORES[ordem % CORES.length],
  itens: [], dias: [], ordem,
})

export default function ProgramaAluno() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { toast } = useUI()
  const [d, setD] = useState<DetalheAluno | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [prog, setProg] = useState<Programa | null>(() => lerRascunho(id))
  const [rascunho, setRascunho] = useState(() => !!lerRascunho(id))
  const [editandoRotina, setEditandoRotina] = useState<string | null>(null)
  const [editandoItem, setEditandoItem] = useState<{ rotina: string; idx: number } | null>(null)
  const [adicionarEm, setAdicionarEm] = useState<string | null>(null)
  const [tirarRotina, setTirarRotina] = useState<string | null>(null)
  const [escolherSemana, setEscolherSemana] = useState(false)
  const [descartar, setDescartar] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const meusExercicios = useExercicios()
  const minhasRotinas = useRotinas()
  const minhasSemanas = useSemanas()

  useEffect(() => {
    let vivo = true
    lerAluno(id).then(r => {
      if (!vivo) return
      setD(r)
      // sem rascunho aberto, a edicao comeca do que foi mandado da ultima vez
      if (r?.programa && !lerRascunho(id)) {
        try {
          const lido = lerPacoteTreino(r.programa)
          setProg({ nome: lido.nome, rotinas: lido.rotinas, exercicios: lido.exercicios })
        } catch { /* pacote velho estragado: comeca do zero */ }
      }
    }).catch(e => { if (vivo) setErro((e as Error).message) })
    return () => { vivo = false }
  }, [id])

  /** Toda mudanca vira rascunho: sair da tela ou trocar de aparelho no meio nao perde o que foi montado aqui. */
  function mudar(fn: (p: Programa) => Programa) {
    setProg(p => {
      if (!p) return p
      const novo = fn(p)
      localStorage.setItem(chaveRascunho(id), JSON.stringify(novo))
      return novo
    })
    setRascunho(true)
  }

  function comecar(p: Programa) {
    localStorage.setItem(chaveRascunho(id), JSON.stringify(p))
    setProg(p)
    setRascunho(true)
  }

  const mapa = useMemo(() => {
    const m = new Map<string, Exercicio>()
    for (const e of d?.dados?.exercicios ?? []) m.set(e.id, e)
    for (const e of prog?.exercicios ?? []) m.set(e.id, e)
    for (const e of meusExercicios) m.set(e.id, e)
    return m
  }, [d, prog, meusExercicios])
  const nomeEx = (exId: string) => mapa.get(exId)?.nome ?? 'Exercício removido'

  const nomeAluno = d?.cartao?.nome ?? d?.dados?.perfil.nome ?? 'aluno'

  async function enviar() {
    if (!prog) return
    if (!prog.rotinas.some(r => r.itens.length)) return toast('Coloque exercícios em pelo menos um treino', 'erro')
    setEnviando(true)
    try {
      const usados = new Set(prog.rotinas.flatMap(r => r.itens.map(i => i.exercicioId)))
      const exercicios = [...mapa.values()].filter(e => e.custom && usados.has(e.id))
      const nome = prog.nome.trim() || 'Treino'
      // pacoteDeTreino filtra as arquivadas: as rotinas do programa entram todas como ativas
      const pacote = pacoteDeTreino(nome, retratoDaSemana(
        prog.rotinas.map((r, i) => ({ ...r, ordem: i, arquivada: 0 as const, atualizadoEm: 0 })), exercicios,
      ))
      await prescrever(id, 'treino', nome, pacote)
      localStorage.removeItem(chaveRascunho(id))
      setRascunho(false)
      vibrar(20)
      toast(`Treino mandado pra ${nomeAluno}`, 'ok', 'Aparece no app do aluno, na tela de Treino')
      nav(`/equipe/aluno/${id}`)
    } catch (e) {
      toast('Não deu pra mandar', 'erro', (e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  if (erro) {
    return (
      <div>
        <Cabecalho titulo="Treino do aluno" voltarPara={`/equipe/aluno/${id}`} />
        <Vazio icone="alerta" titulo="Não deu pra abrir" texto={erro} />
      </div>
    )
  }

  const rotinaAberta = prog?.rotinas.find(r => r.id === editandoRotina) ?? null
  const itemAberto = editandoItem && prog
    ? prog.rotinas.find(r => r.id === editandoItem.rotina)?.itens[editandoItem.idx] ?? null
    : null

  return (
    <div>
      <Cabecalho titulo={`Treino de ${nomeAluno}`} sub={rascunho ? 'Rascunho - ainda não mandado' : d?.programa ? 'Igual ao que foi mandado' : 'Nada mandado ainda'}
        voltarPara={`/equipe/aluno/${id}`} />

      <div className="px-4 pt-4 pb-28">
        {!prog ? (
          <>
            <p className="text-[13px] text-muted mb-3 px-1">Por onde começar?</p>
            <div className="space-y-2">
              {(d?.dados?.rotinas.length ?? 0) > 0 && (
                <Opcao icone="pessoa" titulo="Do treino atual do aluno" texto="Ajusta em cima do que o aluno já faz, e o histórico continua ligado aos mesmos treinos"
                  onClick={() => {
                    const r = retratoDaSemana(d!.dados!.rotinas, d!.dados!.exercicios)
                    comecar({ nome: 'Treino atualizado', rotinas: r.rotinas, exercicios: r.exercicios })
                  }} />
              )}
              {minhasSemanas.length > 0 && (
                <Opcao icone="calendario" titulo="De uma das minhas semanas salvas" texto="Usa um modelo seu como base"
                  onClick={() => setEscolherSemana(true)} />
              )}
              {minhasRotinas.length > 0 && (
                <Opcao icone="halter" titulo="Do meu treino atual" texto="Copia a sua semana de agora"
                  onClick={() => {
                    const r = retratoDaSemana(minhasRotinas, meusExercicios)
                    comecar({ nome: 'Treino', rotinas: r.rotinas.map(x => ({ ...x, id: uid() })), exercicios: r.exercicios })
                  }} />
              )}
              <Opcao icone="mais" titulo="Do zero" texto="Um treino vazio pra montar exercício por exercício"
                onClick={() => comecar({ nome: 'Treino', rotinas: [novaRotina(0)], exercicios: [] })} />
            </div>
          </>
        ) : (
          <>
            <Campo label="Nome do treino (o aluno vê)">
              <Input value={prog.nome} maxLength={80} onChange={e => mudar(p => ({ ...p, nome: e.target.value }))} />
            </Campo>

            <div className="space-y-3 mb-4">
              {prog.rotinas.map((r, ri) => (
                <Card key={r.id} className="overflow-hidden">
                  <button onClick={() => setEditandoRotina(r.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b border-line/40 text-left active:bg-surface-2">
                    <span className="w-1 self-stretch rounded-full shrink-0 min-h-[30px]" style={{ background: r.cor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14.5px] font-bold truncate">{r.nome}</p>
                      <p className="text-[11.5px] text-muted truncate">
                        {r.dias?.length ? r.dias.map(diaCurto).join(', ') : 'Sem dia fixo'} - {pl(r.itens.length, 'exercício')}
                      </p>
                    </div>
                    <Icone nome="lapis" tamanho={16} className="text-muted shrink-0" />
                  </button>
                  {r.itens.map((it, idx) => (
                    <button key={it.exercicioId} onClick={() => setEditandoItem({ rotina: r.id, idx })}
                      className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-line/40 text-left active:bg-surface-2">
                      <span className="w-5 text-[11px] font-bold text-muted shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{nomeEx(it.exercicioId)}</p>
                        <p className="text-[11px] text-muted truncate">
                          {it.series}x {it.repsAlvo} - {it.descansoSeg}s{it.cargaAlvo ? ` - ${it.cargaAlvo} kg` : ''}{it.obs ? ` - ${it.obs}` : ''}
                        </p>
                      </div>
                    </button>
                  ))}
                  <div className="grid grid-cols-2">
                    <button onClick={() => setAdicionarEm(r.id)}
                      className="h-11 text-[12.5px] font-semibold text-accent border-r border-line/40 active:bg-surface-2">
                      + Exercícios
                    </button>
                    <button onClick={() => setTirarRotina(r.id)} disabled={prog.rotinas.length === 1 && ri === 0}
                      className="h-11 text-[12.5px] font-semibold text-muted active:bg-surface-2 disabled:opacity-40">
                      Tirar treino
                    </button>
                  </div>
                </Card>
              ))}
            </div>

            <Btn className="w-full mb-5" onClick={() => mudar(p => ({ ...p, rotinas: [...p.rotinas, novaRotina(p.rotinas.length)] }))}>
              + Outro treino na semana
            </Btn>

            {rascunho && (
              <button onClick={() => setDescartar(true)} className="w-full text-center text-[12.5px] font-semibold text-muted py-2">
                Descartar rascunho
              </button>
            )}
          </>
        )}
      </div>

      {prog && (
        <div className="fixed left-0 right-0 bottom-[64px] z-30 px-4 pb-3 pt-2 bg-gradient-to-t from-bg via-bg/95 to-transparent">
          <div className="max-w-[528px] mx-auto">
            <Btn variant="primary" size="lg" className="w-full" onClick={enviar} disabled={enviando}>
              <Icone nome="compartilhar" tamanho={18} /> Mandar pra {nomeAluno}
            </Btn>
          </div>
        </div>
      )}

      {/* -------- escolher semana salva -------- */}
      <Sheet aberto={escolherSemana} fechar={() => setEscolherSemana(false)} titulo="Minhas semanas salvas">
        <div className="space-y-2">
          {minhasSemanas.map(s => (
            <Card key={s.id} className="p-3.5" onClick={() => {
              setEscolherSemana(false)
              comecar({ nome: s.nome, rotinas: s.rotinas.map(x => ({ ...x, id: uid(), itens: x.itens.map(i => ({ ...i })) })), exercicios: s.exercicios ?? [] })
            }}>
              <p className="text-[14px] font-semibold">{s.nome}</p>
              <p className="text-[11.5px] text-muted">{pl(s.rotinas.length, 'treino')}</p>
            </Card>
          ))}
        </div>
      </Sheet>

      {/* -------- ajustes de uma rotina -------- */}
      <Sheet aberto={!!rotinaAberta} fechar={() => setEditandoRotina(null)} titulo="Ajustes do treino">
        {rotinaAberta && prog && (
          <AjustesRotina rotina={rotinaAberta} outras={prog.rotinas.filter(r => r.id !== rotinaAberta.id)}
            salvar={nova => {
              mudar(p => ({
                ...p,
                rotinas: p.rotinas.map(r => {
                  if (r.id === nova.id) return nova
                  // um dia, um treino: o dia que esta ganhou sai das outras
                  return { ...r, dias: (r.dias ?? []).filter(dd => !(nova.dias ?? []).includes(dd)) }
                }),
              }))
              setEditandoRotina(null)
            }}
            mover={delta => {
              mudar(p => {
                const i = p.rotinas.findIndex(r => r.id === rotinaAberta.id)
                const j = i + delta
                if (j < 0 || j >= p.rotinas.length) return p
                const rotinas = [...p.rotinas]
                ;[rotinas[i], rotinas[j]] = [rotinas[j], rotinas[i]]
                return { ...p, rotinas }
              })
            }} />
        )}
      </Sheet>

      {/* -------- um exercicio -------- */}
      <Sheet aberto={!!itemAberto} fechar={() => setEditandoItem(null)} titulo={itemAberto ? nomeEx(itemAberto.exercicioId) : ''}>
        {itemAberto && editandoItem && prog && (
          <AjustesItem item={itemAberto}
            salvar={novo => {
              mudar(p => ({ ...p, rotinas: p.rotinas.map(r => r.id !== editandoItem.rotina ? r
                : { ...r, itens: r.itens.map((x, k) => (k === editandoItem.idx ? novo : x)) }) }))
              setEditandoItem(null)
            }}
            remover={() => {
              mudar(p => ({ ...p, rotinas: p.rotinas.map(r => r.id !== editandoItem.rotina ? r
                : { ...r, itens: r.itens.filter((_, k) => k !== editandoItem.idx) }) }))
              setEditandoItem(null)
            }}
            mover={delta => {
              const { rotina, idx } = editandoItem
              const total = prog.rotinas.find(r => r.id === rotina)?.itens.length ?? 0
              const j = idx + delta
              if (j < 0 || j >= total) return
              mudar(p => ({ ...p, rotinas: p.rotinas.map(r => {
                if (r.id !== rotina) return r
                const itens = [...r.itens]
                ;[itens[idx], itens[j]] = [itens[j], itens[idx]]
                return { ...r, itens }
              }) }))
              setEditandoItem({ rotina, idx: j })
            }} />
        )}
      </Sheet>

      <Seletor aberto={!!adicionarEm} fechar={() => setAdicionarEm(null)} titulo="Adicionar exercícios"
        jaEscolhidos={prog?.rotinas.find(r => r.id === adicionarEm)?.itens.map(i => i.exercicioId) ?? []}
        onEscolherVarios={exs => {
          const alvo = adicionarEm
          setAdicionarEm(null)
          if (!alvo) return
          mudar(p => ({
            ...p,
            exercicios: [...p.exercicios.filter(e => !exs.some(x => x.id === e.id)), ...exs.filter(e => e.custom)],
            rotinas: p.rotinas.map(r => r.id !== alvo ? r : {
              ...r,
              itens: [...r.itens, ...exs.filter(e => !r.itens.some(i => i.exercicioId === e.id))
                .map((e): ItemRotina => ({ exercicioId: e.id, series: 3, repsAlvo: '8-12', descansoSeg: 90 }))],
            }),
          }))
        }} />

      <Confirmar aberto={!!tirarRotina} perigo titulo="Tirar esse treino?"
        texto="Ele sai deste programa. Nada muda no app do aluno até você mandar."
        onNao={() => setTirarRotina(null)}
        onSim={() => { const alvo = tirarRotina; setTirarRotina(null); mudar(p => ({ ...p, rotinas: p.rotinas.filter(r => r.id !== alvo) })) }} />

      <Confirmar aberto={descartar} perigo titulo="Descartar o rascunho?"
        texto="O que você mudou aqui e não mandou some. O que já foi mandado pro aluno continua."
        onNao={() => setDescartar(false)}
        onSim={() => {
          setDescartar(false)
          localStorage.removeItem(chaveRascunho(id))
          setRascunho(false)
          try {
            const lido = d?.programa ? lerPacoteTreino(d.programa) : null
            setProg(lido ? { nome: lido.nome, rotinas: lido.rotinas, exercicios: lido.exercicios } : null)
          } catch { setProg(null) }
        }} />
    </div>
  )
}

function Opcao({ icone, titulo, texto, onClick }: { icone: string; titulo: string; texto: string; onClick: () => void }) {
  return (
    <Card className="p-4" onClick={onClick}>
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 shrink-0 rounded-xl bg-accent/12 text-accent flex items-center justify-center">
          <Icone nome={icone} tamanho={19} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold">{titulo}</p>
          <p className="text-[11.5px] text-muted mt-0.5 leading-snug">{texto}</p>
        </div>
        <span className="text-accent shrink-0">›</span>
      </div>
    </Card>
  )
}

function AjustesRotina({ rotina, outras, salvar, mover }: {
  rotina: RotinaSalva; outras: RotinaSalva[]; salvar: (r: RotinaSalva) => void; mover: (delta: number) => void
}) {
  const [nome, setNome] = useState(rotina.nome)
  const [dias, setDias] = useState<number[]>(rotina.dias ?? [])
  const [descricao, setDescricao] = useState(rotina.descricao ?? '')
  const [cor, setCor] = useState(rotina.cor)
  const deQuem = (d: number) => outras.find(o => o.dias?.includes(d))?.nome

  return (
    <>
      <Campo label="Nome"><Input value={nome} maxLength={120} onChange={e => setNome(e.target.value)} /></Campo>
      <Campo label="Dias da semana" hint="Um treino por dia: escolher um dia ocupado tira esse dia do outro treino">
        <div className="flex gap-1.5 flex-wrap">
          {SEMANA.map(d => (
            <Chip key={d} ativo={dias.includes(d)} onClick={() => setDias(x => (x.includes(d) ? x.filter(y => y !== d) : [...x, d].sort()))}>
              {diaCurto(d)}{!dias.includes(d) && deQuem(d) ? ' *' : ''}
            </Chip>
          ))}
        </div>
      </Campo>
      <Campo label="Cor">
        <div className="flex gap-2 flex-wrap">
          {CORES.map(c => (
            <button key={c} onClick={() => setCor(c)} aria-label={`Cor ${c}`} className="w-9 h-9 rounded-xl"
              style={{ background: c, boxShadow: cor === c ? `0 0 0 3px var(--color-bg-soft), 0 0 0 5px ${c}` : undefined }} />
          ))}
        </div>
      </Campo>
      <Campo label="Orientação pro aluno (opcional)">
        <Textarea rows={3} value={descricao} maxLength={1000} onChange={e => setDescricao(e.target.value)}
          placeholder="Ex: foco em cadência controlada, 2 s na descida" />
      </Campo>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Btn onClick={() => mover(-1)}>Subir na lista</Btn>
        <Btn onClick={() => mover(1)}>Descer na lista</Btn>
      </div>
      <Btn variant="primary" size="lg" className="w-full" disabled={!nome.trim()}
        onClick={() => {
          const r: RotinaSalva = { ...rotina, nome: nome.trim(), dias, cor }
          if (descricao.trim()) r.descricao = descricao.trim()
          else delete r.descricao
          salvar(r)
        }}>
        Salvar
      </Btn>
    </>
  )
}

function AjustesItem({ item, salvar, remover, mover }: {
  item: ItemRotina; salvar: (i: ItemRotina) => void; remover: () => void; mover: (delta: number) => void
}) {
  const [series, setSeries] = useState(item.series)
  const [reps, setReps] = useState(item.repsAlvo)
  const [descanso, setDescanso] = useState(item.descansoSeg)
  const [carga, setCarga] = useState(item.cargaAlvo ?? 0)
  const [obs, setObs] = useState(item.obs ?? '')

  return (
    <>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Campo label="Séries"><Stepper valor={series} setValor={setSeries} min={1} max={20} /></Campo>
        <Campo label="Repetições"><Input value={reps} maxLength={30} onChange={e => setReps(e.target.value)} placeholder="8-12" /></Campo>
        <Campo label="Descanso"><Stepper valor={descanso} setValor={setDescanso} passo={15} min={0} max={600} sufixo="s" /></Campo>
        <Campo label="Carga sugerida"><Stepper valor={carga} setValor={setCarga} passo={2.5} min={0} max={999} sufixo="kg" /></Campo>
      </div>
      <Campo label="Observação (opcional)">
        <Input value={obs} maxLength={300} onChange={e => setObs(e.target.value)} placeholder="Ex: pegada fechada, drop-set na última" />
      </Campo>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Btn size="sm" onClick={() => mover(-1)}>Subir</Btn>
        <Btn size="sm" onClick={() => mover(1)}>Descer</Btn>
        <Btn size="sm" variant="danger" onClick={remover}>Tirar</Btn>
      </div>
      <Btn variant="primary" size="lg" className="w-full"
        onClick={() => {
          const novo: ItemRotina = { ...item, series, repsAlvo: reps.trim() || '8-12', descansoSeg: descanso }
          if (carga > 0) novo.cargaAlvo = carga
          else delete novo.cargaAlvo
          if (obs.trim()) novo.obs = obs.trim()
          else delete novo.obs
          salvar(novo)
        }}>
        Salvar
      </Btn>
    </>
  )
}
