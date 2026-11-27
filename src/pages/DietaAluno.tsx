import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Cabecalho } from '../components/Cabecalho'
import { Card, Btn, Input, Campo, Sheet, Confirmar, Vazio, Switch, Barra } from '../components/ui'
import { Icone } from '../components/Icone'
import { SeletorAlimento, SheetQuantidade } from '../components/SeletorAlimento'
import { useUI, vibrar } from '../state/ui'
import { useAlimentos, usePlanos, useDietasSalvas } from '../state/hooks'
import { lerAluno, prescrever, type DetalheAluno } from '../lib/equipe'
import { pacoteDeDieta, lerPacoteDieta, type MetasDieta } from '../lib/pacotes'
import { retratoDoPlano } from '../lib/dietas'
import { macrosDe, somaMacros, paraGramas, nomeMedida, ZERO } from '../lib/nutricao'
import { n0, nq } from '../lib/format'
import type { Alimento, RefeicaoSalva } from '../db/types'

/**
 * O treinador monta o plano alimentar de um aluno. Mesmo esquema do treino
 * (ProgramaAluno): rascunho neste aparelho, o mandado fica no vinculo, e no
 * aluno chega como "Dieta do seu treinador" - so vira o plano dele quando ele
 * tocar em Usar, e o plano de antes vai pras dietas salvas.
 */

interface Plano { nome: string; refeicoes: RefeicaoSalva[]; alimentos: Alimento[]; metas: MetasDieta | null }

const chaveRascunho = (id: string) => `onemore:rascunho:dieta:${id}`
const REFEICOES_PADRAO: RefeicaoSalva[] = [
  { nome: 'Café da manhã', horario: '07:00', itens: [], ordem: 0 },
  { nome: 'Almoço', horario: '12:00', itens: [], ordem: 1 },
  { nome: 'Lanche da tarde', horario: '16:00', itens: [], ordem: 2 },
  { nome: 'Jantar', horario: '20:00', itens: [], ordem: 3 },
]

function lerRascunho(id: string): Plano | null {
  try {
    const r = JSON.parse(localStorage.getItem(chaveRascunho(id)) ?? 'null')
    return r && Array.isArray(r.refeicoes) ? r : null
  } catch { return null }
}

export default function DietaAluno() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const { toast } = useUI()
  const [d, setD] = useState<DetalheAluno | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [plano, setPlano] = useState<Plano | null>(() => lerRascunho(id))
  const [rascunho, setRascunho] = useState(() => !!lerRascunho(id))
  const [escolherDieta, setEscolherDieta] = useState(false)
  const [buscarEm, setBuscarEm] = useState<number | null>(null)
  const [novo, setNovo] = useState<{ refeicao: number; alimento: Alimento } | null>(null)
  const [editando, setEditando] = useState<{ refeicao: number; idx: number } | null>(null)
  const [refeicaoAberta, setRefeicaoAberta] = useState<number | null>(null)
  const [descartar, setDescartar] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const meusAlimentos = useAlimentos()
  const meuPlano = usePlanos()
  const minhasDietas = useDietasSalvas()

  useEffect(() => {
    let vivo = true
    lerAluno(id).then(r => {
      if (!vivo) return
      setD(r)
      if (r?.dieta && !lerRascunho(id)) {
        try {
          const lida = lerPacoteDieta(r.dieta)
          setPlano({ nome: lida.nome, refeicoes: lida.refeicoes, alimentos: lida.alimentos, metas: lida.metas ?? null })
        } catch { /* comeca do zero */ }
      }
    }).catch(e => { if (vivo) setErro((e as Error).message) })
    return () => { vivo = false }
  }, [id])

  function mudar(fn: (p: Plano) => Plano) {
    setPlano(p => {
      if (!p) return p
      const novoPlano = fn(p)
      localStorage.setItem(chaveRascunho(id), JSON.stringify(novoPlano))
      return novoPlano
    })
    setRascunho(true)
  }

  const perfilAluno = d?.dados?.perfil
  const metasDoAluno: MetasDieta | null = perfilAluno?.metaKcal
    ? { kcal: perfilAluno.metaKcal, prot: perfilAluno.metaProt ?? 0, carb: perfilAluno.metaCarb ?? 0, gord: perfilAluno.metaGord ?? 0 }
    : null

  function comecar(refeicoes: RefeicaoSalva[], alimentos: Alimento[], nome: string) {
    const p: Plano = { nome, refeicoes: refeicoes.map((r, i) => ({ ...r, ordem: i, itens: r.itens.map(x => ({ ...x })) })), alimentos, metas: null }
    localStorage.setItem(chaveRascunho(id), JSON.stringify(p))
    setPlano(p)
    setRascunho(true)
  }

  const mapa = useMemo(() => {
    const m = new Map<string, Alimento>()
    for (const a of d?.dados?.alimentos ?? []) m.set(a.id, a)
    for (const a of plano?.alimentos ?? []) m.set(a.id, a)
    for (const a of meusAlimentos) m.set(a.id, a)
    return m
  }, [d, plano, meusAlimentos])

  const macrosRef = (r: RefeicaoSalva) =>
    somaMacros(...r.itens.map(i => { const a = mapa.get(i.alimentoId); return a ? macrosDe(a, i.gramas) : ZERO }))
  const total = plano ? somaMacros(...plano.refeicoes.map(macrosRef)) : ZERO
  const nomeAluno = d?.cartao?.nome ?? perfilAluno?.nome ?? 'aluno'

  async function enviar() {
    if (!plano) return
    if (!plano.refeicoes.some(r => r.itens.length)) return toast('Coloque alimentos em pelo menos uma refeição', 'erro')
    setEnviando(true)
    try {
      const nome = plano.nome.trim() || 'Dieta'
      await prescrever(id, 'dieta', nome, pacoteDeDieta(nome, plano.refeicoes, [...mapa.values()], plano.metas ?? undefined))
      localStorage.removeItem(chaveRascunho(id))
      setRascunho(false)
      vibrar(20)
      toast(`Dieta mandada pra ${nomeAluno}`, 'ok', 'Aparece no app do aluno, na tela de Dieta')
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
        <Cabecalho titulo="Dieta do aluno" voltarPara={`/equipe/aluno/${id}`} />
        <Vazio icone="alerta" titulo="Não deu pra abrir" texto={erro} />
      </div>
    )
  }

  const itemEditado = editando && plano ? plano.refeicoes[editando.refeicao]?.itens[editando.idx] : undefined
  const alimentoEditado = itemEditado ? mapa.get(itemEditado.alimentoId) ?? null : null
  const refeicao = refeicaoAberta != null && plano ? plano.refeicoes[refeicaoAberta] : null

  return (
    <div>
      <Cabecalho titulo={`Dieta de ${nomeAluno}`} sub={rascunho ? 'Rascunho - ainda não mandada' : d?.dieta ? 'Igual à que foi mandada' : 'Nada mandado ainda'}
        voltarPara={`/equipe/aluno/${id}`} />

      <div className="px-4 pt-4 pb-28">
        {!plano ? (
          <>
            <p className="text-[13px] text-muted mb-3 px-1">Por onde começar?</p>
            <div className="space-y-2">
              {(d?.dados?.planos?.length ?? 0) > 0 && (
                <Opcao titulo="Do plano atual do aluno" texto="Ajusta em cima do que o aluno já come"
                  onClick={() => comecar(retratoDoPlano(d!.dados!.planos!), d!.dados!.alimentos ?? [], 'Plano ajustado')} />
              )}
              {minhasDietas.length > 0 && (
                <Opcao titulo="De uma das minhas dietas salvas" texto="Usa um modelo seu como base" onClick={() => setEscolherDieta(true)} />
              )}
              {meuPlano.length > 0 && (
                <Opcao titulo="Do meu plano atual" texto="Copia o seu cardápio de agora"
                  onClick={() => comecar(retratoDoPlano(meuPlano), [], 'Plano alimentar')} />
              )}
              <Opcao titulo="Do zero" texto="Café, almoço, lanche e jantar vazios pra preencher"
                onClick={() => comecar(REFEICOES_PADRAO, [], 'Plano alimentar')} />
            </div>
          </>
        ) : (
          <>
            <Campo label="Nome da dieta (o aluno vê)">
              <Input value={plano.nome} maxLength={80} onChange={e => mudar(p => ({ ...p, nome: e.target.value }))} />
            </Campo>

            {/* -------- totais e metas -------- */}
            <Card className="p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <p className="text-[13.5px] font-semibold">Mandar metas junto</p>
                  <p className="text-[11.5px] text-muted">As metas de dieta do aluno passam a ser estas quando a dieta for usada</p>
                </div>
                <Switch ligado={!!plano.metas} rotulo="Mandar metas junto"
                  onChange={v => mudar(p => ({ ...p, metas: v ? (p.metas ?? metasDoAluno ?? { kcal: Math.round(total.kcal) || 2000, prot: Math.round(total.prot), carb: Math.round(total.carb), gord: Math.round(total.gord) }) : null }))} />
              </div>
              {plano.metas && (
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {(['kcal', 'prot', 'carb', 'gord'] as const).map(k => (
                    <label key={k} className="block">
                      <span className="block text-[10.5px] text-muted mb-1">{{ kcal: 'kcal', prot: 'Prot (g)', carb: 'Carbo (g)', gord: 'Gord (g)' }[k]}</span>
                      <Input type="number" inputMode="numeric" value={String(plano.metas![k])} className="px-2 text-center"
                        onChange={e => { const v = Math.max(0, Math.round(Number(e.target.value) || 0)); mudar(p => ({ ...p, metas: p.metas ? { ...p.metas, [k]: v } : p.metas })) }} />
                    </label>
                  ))}
                </div>
              )}
              {(['kcal', 'prot', 'carb', 'gord'] as const).map(k => {
                const alvo = plano.metas?.[k] ?? metasDoAluno?.[k] ?? 0
                return (
                  <div key={k} className="mb-1.5 last:mb-0">
                    <div className="flex justify-between text-[11.5px] mb-0.5">
                      <span className="text-muted">{{ kcal: 'Calorias', prot: 'Proteína', carb: 'Carboidrato', gord: 'Gordura' }[k]}</span>
                      <span className="font-semibold">{n0(total[k])}{k === 'kcal' ? '' : ' g'}{alvo ? ` / ${n0(alvo)}` : ''}</span>
                    </div>
                    {alvo > 0 && <Barra valor={total[k] / alvo} altura={5} />}
                  </div>
                )
              })}
              {!plano.metas && metasDoAluno && <p className="text-[11px] text-muted mt-2">Comparando com as metas atuais do aluno.</p>}
            </Card>

            <div className="space-y-3 mb-4">
              {plano.refeicoes.map((r, ri) => (
                <Card key={ri} className="overflow-hidden">
                  <button onClick={() => setRefeicaoAberta(ri)}
                    className="w-full flex items-center gap-3 px-4 py-3 border-b border-line/40 text-left active:bg-surface-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14.5px] font-bold truncate">{r.nome}</p>
                      <p className="text-[11.5px] text-muted">{r.horario} - {n0(macrosRef(r).kcal)} kcal - P {n0(macrosRef(r).prot)} g</p>
                    </div>
                    <Icone nome="lapis" tamanho={16} className="text-muted shrink-0" />
                  </button>
                  {r.itens.map((it, idx) => {
                    const a = mapa.get(it.alimentoId)
                    return (
                      <button key={idx} onClick={() => setEditando({ refeicao: ri, idx })}
                        className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-line/40 text-left active:bg-surface-2">
                        <p className="flex-1 min-w-0 text-[13px] font-semibold truncate">{a?.nome ?? 'Alimento removido'}</p>
                        <p className="text-[11.5px] text-muted shrink-0">{nq(it.qtd)} {nomeMedida(a, it.medida)}</p>
                        <p className="text-[11.5px] text-muted shrink-0 w-16 text-right">{a ? `${n0(macrosDe(a, it.gramas).kcal)} kcal` : ''}</p>
                      </button>
                    )
                  })}
                  <button onClick={() => setBuscarEm(ri)} className="w-full h-11 text-[12.5px] font-semibold text-accent active:bg-surface-2">
                    + Alimento
                  </button>
                </Card>
              ))}
            </div>

            <Btn className="w-full mb-5" onClick={() => mudar(p => ({
              ...p, refeicoes: [...p.refeicoes, { nome: `Refeição ${p.refeicoes.length + 1}`, horario: '18:00', itens: [], ordem: p.refeicoes.length }],
            }))} disabled={plano.refeicoes.length >= 12}>
              + Outra refeição
            </Btn>

            {rascunho && (
              <button onClick={() => setDescartar(true)} className="w-full text-center text-[12.5px] font-semibold text-muted py-2">
                Descartar rascunho
              </button>
            )}
          </>
        )}
      </div>

      {plano && (
        <div className="fixed left-0 right-0 bottom-[64px] z-30 px-4 pb-3 pt-2 bg-gradient-to-t from-bg via-bg/95 to-transparent">
          <div className="max-w-[528px] mx-auto">
            <Btn variant="primary" size="lg" className="w-full" onClick={enviar} disabled={enviando}>
              <Icone nome="compartilhar" tamanho={18} /> Mandar pra {nomeAluno}
            </Btn>
          </div>
        </div>
      )}

      <Sheet aberto={escolherDieta} fechar={() => setEscolherDieta(false)} titulo="Minhas dietas salvas">
        <div className="space-y-2">
          {minhasDietas.map(x => (
            <Card key={x.id} className="p-3.5" onClick={() => { setEscolherDieta(false); comecar(x.refeicoes, [], x.nome) }}>
              <p className="text-[14px] font-semibold">{x.nome}</p>
              <p className="text-[11.5px] text-muted">{x.refeicoes.length} refeições</p>
            </Card>
          ))}
        </div>
      </Sheet>

      <Sheet aberto={!!refeicao} fechar={() => setRefeicaoAberta(null)} titulo="Refeição">
        {refeicao && refeicaoAberta != null && (
          <AjustesRefeicao refeicao={refeicao} podeTirar={(plano?.refeicoes.length ?? 0) > 1}
            salvar={(nome, horario) => {
              mudar(p => ({ ...p, refeicoes: p.refeicoes.map((r, i) => (i === refeicaoAberta ? { ...r, nome, horario } : r)) }))
              setRefeicaoAberta(null)
            }}
            tirar={() => {
              mudar(p => ({ ...p, refeicoes: p.refeicoes.filter((_, i) => i !== refeicaoAberta).map((r, i) => ({ ...r, ordem: i })) }))
              setRefeicaoAberta(null)
            }} />
        )}
      </Sheet>

      <SeletorAlimento aberto={buscarEm != null} fechar={() => setBuscarEm(null)}
        onEscolher={a => { const ref = buscarEm; setBuscarEm(null); if (ref != null) setNovo({ refeicao: ref, alimento: a }) }} />

      <SheetQuantidade alimento={novo?.alimento ?? null} fechar={() => setNovo(null)} textoBotao="Adicionar"
        onConfirmar={(qtd, medida) => {
          if (!novo) return
          const { refeicao: ri, alimento: a } = novo
          setNovo(null)
          mudar(p => ({
            ...p,
            alimentos: a.custom && !p.alimentos.some(x => x.id === a.id) ? [...p.alimentos, a] : p.alimentos,
            refeicoes: p.refeicoes.map((r, i) => (i !== ri ? r
              : { ...r, itens: [...r.itens, { alimentoId: a.id, qtd, medida, gramas: paraGramas(a, qtd, medida) }] })),
          }))
        }} />

      <SheetQuantidade alimento={alimentoEditado} fechar={() => setEditando(null)} textoBotao="Salvar"
        qtdInicial={itemEditado?.qtd} medidaInicial={itemEditado?.medida}
        onRemover={() => {
          if (!editando) return
          const { refeicao: ri, idx } = editando
          setEditando(null)
          mudar(p => ({ ...p, refeicoes: p.refeicoes.map((r, i) => (i !== ri ? r : { ...r, itens: r.itens.filter((_, k) => k !== idx) })) }))
        }}
        onConfirmar={(qtd, medida) => {
          if (!editando || !alimentoEditado) return
          const { refeicao: ri, idx } = editando
          setEditando(null)
          mudar(p => ({ ...p, refeicoes: p.refeicoes.map((r, i) => (i !== ri ? r : {
            ...r, itens: r.itens.map((x, k) => (k !== idx ? x : { ...x, qtd, medida, gramas: paraGramas(alimentoEditado, qtd, medida) })),
          })) }))
        }} />

      <Confirmar aberto={descartar} perigo titulo="Descartar o rascunho?"
        texto="O que você mudou aqui e não mandou some. O que já foi mandado pro aluno continua."
        onNao={() => setDescartar(false)}
        onSim={() => {
          setDescartar(false)
          localStorage.removeItem(chaveRascunho(id))
          setRascunho(false)
          try {
            const lida = d?.dieta ? lerPacoteDieta(d.dieta) : null
            setPlano(lida ? { nome: lida.nome, refeicoes: lida.refeicoes, alimentos: lida.alimentos, metas: lida.metas ?? null } : null)
          } catch { setPlano(null) }
        }} />
    </div>
  )
}

function Opcao({ titulo, texto, onClick }: { titulo: string; texto: string; onClick: () => void }) {
  return (
    <Card className="p-4" onClick={onClick}>
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 shrink-0 rounded-xl bg-accent/12 text-accent flex items-center justify-center">
          <Icone nome="prato" tamanho={19} />
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

function AjustesRefeicao({ refeicao, salvar, tirar, podeTirar }: {
  refeicao: RefeicaoSalva; salvar: (nome: string, horario: string) => void; tirar: () => void; podeTirar: boolean
}) {
  const [nome, setNome] = useState(refeicao.nome)
  const [horario, setHorario] = useState(refeicao.horario)
  return (
    <>
      <Campo label="Nome"><Input value={nome} maxLength={60} onChange={e => setNome(e.target.value)} /></Campo>
      <Campo label="Horário"><Input type="time" value={horario} onChange={e => setHorario(e.target.value)} /></Campo>
      <div className="grid grid-cols-2 gap-2">
        <Btn variant="danger" onClick={tirar} disabled={!podeTirar}>Tirar refeição</Btn>
        <Btn variant="primary" onClick={() => salvar(nome.trim() || refeicao.nome, /^\d\d:\d\d$/.test(horario) ? horario : refeicao.horario)}>
          Salvar
        </Btn>
      </div>
    </>
  )
}
