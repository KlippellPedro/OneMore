import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, hoje, diaMais } from '../db'
import {
  usePerfil, useMapaAlimentos, usePlanos, useAguaDoDia, useGlicemiaDoDia,
} from '../state/hooks'
import { totalDoDia, macrosDe, somaMacros, ZERO } from '../lib/nutricao'
import {
  registrarAlimento, removerRegistro, checarMetasDoDia, addAgua, removerGlicemia,
} from '../lib/acoes'
import { SeletorAlimento, SheetQuantidade } from '../components/SeletorAlimento'
import { SheetGlicemia, LinhaGlicemia } from '../components/Glicemia'
import { Titulo } from '../components/Cabecalho'
import { Card, Btn, Anel, Barra, Sheet, Confirmar } from '../components/ui'
import { useUI, vibrar } from '../state/ui'
import { n0, n1, nq, dataCurta, clamp } from '../lib/format'
import type { Alimento, RegistroDieta, MomentoGlicemia } from '../db/types'

export default function Dieta() {
  const { toast, celebrar } = useUI()
  const perfil = usePerfil()
  const mapa = useMapaAlimentos()
  const planos = usePlanos()
  const [data, setData] = useState(hoje())
  const registros = useLiveQuery(() => db.dieta.where('data').equals(data).toArray(), [data], []) ?? []
  const agua = useAguaDoDia(data)
  const glicemias = useGlicemiaDoDia(data)

  const [refeicaoAlvo, setRefeicaoAlvo] = useState<string | null>(null)
  const [escolhido, setEscolhido] = useState<Alimento | null>(null)
  const [detalhe, setDetalhe] = useState<RegistroDieta | null>(null)
  const [aplicarPlano, setAplicarPlano] = useState<string | null>(null)
  const [glicemia, setGlicemia] = useState<{ momento?: MomentoGlicemia; carbo?: number } | null>(null)
  const [apagarGli, setApagarGli] = useState<string | null>(null)

  const total = totalDoDia(registros, mapa)
  const restante = perfil.metaKcal - total.kcal
  const ehHoje = data === hoje()
  const diabetes = perfil.diabetesTipo1 === true

  const nomesRefeicao = planos.length
    ? planos.map(p => p.nome)
    : ['Cafe da manha', 'Almoco', 'Jantar', 'Lanches']

  async function adicionar(a: Alimento, qtd: number, medida: string) {
    if (!refeicaoAlvo) return
    vibrar()
    await registrarAlimento(data, refeicaoAlvo, a, qtd, medida)
    const ganhos = await checarMetasDoDia(data)
    if (ganhos.length) ganhos.forEach(celebrar)
    else toast(`${a.nome} adicionado`, 'ok')
    setRefeicaoAlvo(null)
  }

  async function aplicar(nomeRefeicao: string) {
    const plano = planos.find(p => p.nome === nomeRefeicao)
    if (!plano?.itens.length) return
    for (const item of plano.itens) {
      const a = mapa.get(item.alimentoId)
      if (a) await registrarAlimento(data, nomeRefeicao, a, item.qtd, item.medida)
    }
    setAplicarPlano(null)
    vibrar([20, 40, 20])
    const ganhos = await checarMetasDoDia(data)
    if (ganhos.length) ganhos.forEach(celebrar)
    else toast('Refeicao do plano lancada', 'ok')
  }

  async function copiarOntem() {
    const ontem = diaMais(data, -1)
    const doDia = await db.dieta.where('data').equals(ontem).toArray()
    if (!doDia.length) return toast('Nao ha nada registrado ontem', 'erro')
    for (const r of doDia) {
      const a = mapa.get(r.alimentoId)
      if (a) await registrarAlimento(data, r.refeicao, a, r.qtd, r.medida)
    }
    const ganhos = await checarMetasDoDia(data)
    ganhos.forEach(celebrar)
    toast(`${doDia.length} itens copiados de ontem`, 'ok')
  }

  return (
    <div>
      <Titulo titulo="Dieta" sub={dataCurta(data)}
        acao={<Link to="/dieta/plano"><Btn size="sm">Plano</Btn></Link>} />

      <div className="px-4">
        {/* -------- navegacao de dia -------- */}
        <div className="flex items-center gap-2 mb-4">
          <Btn size="sm" onClick={() => setData(d => diaMais(d, -1))}>‹</Btn>
          <button onClick={() => setData(hoje())}
            className={`flex-1 h-9 rounded-xl text-[13px] font-semibold ${
              ehHoje ? 'bg-surface-2 text-muted' : 'bg-accent/15 text-accent'
            }`}>
            {ehHoje ? 'Hoje' : 'Voltar para hoje'}
          </button>
          <Btn size="sm" disabled={data >= hoje()} onClick={() => setData(d => diaMais(d, 1))}>›</Btn>
        </div>

        {/* -------- resumo do dia -------- */}
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <Anel valor={total.kcal / perfil.metaKcal} cor="var(--color-accent)" tamanho={86} espessura={8}>
              <span className="text-[19px] font-black leading-none">{n0(total.kcal)}</span>
              <span className="text-[9px] text-muted mt-0.5">kcal</span>
            </Anel>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted font-semibold">
                Meta {n0(perfil.metaKcal)} kcal
              </p>
              <p className={`text-[19px] font-black leading-tight mt-0.5 ${
                restante < -100 ? 'text-bad' : restante < 200 ? 'text-good' : 'text-txt'
              }`}>
                {restante >= 0 ? `${n0(restante)}` : `+${n0(-restante)}`}
                <span className="text-[12px] font-medium text-muted ml-1.5">
                  {restante >= 0 ? 'restantes' : 'acima'}
                </span>
              </p>
              {total.fibra > 0 && (
                <p className="text-[11.5px] text-muted mt-1">Fibra {n1(total.fibra)} g</p>
              )}
            </div>
          </div>

          {/* carboidrato primeiro: e o numero que voce usa pra dosar */}
          <div className="grid grid-cols-3 gap-3">
            <Macro nome="Carboidrato" atual={total.carb} meta={perfil.metaCarb} cor="var(--color-accent)" />
            <Macro nome="Proteina" atual={total.prot} meta={perfil.metaProt} cor="var(--color-good)" />
            <Macro nome="Gordura" atual={total.gord} meta={perfil.metaGord} cor="var(--color-warn)" />
          </div>
        </Card>

        {/* -------- glicemia -------- */}
        {diabetes && (
          <Card className="overflow-hidden mb-4">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-line/40">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold">Glicemia</p>
                <p className="text-[11px] text-muted">
                  {glicemias.length
                    ? `${glicemias.length} medic${glicemias.length === 1 ? 'ao' : 'oes'} - media ${
                        n0(glicemias.reduce((t, g) => t + g.valor, 0) / glicemias.length)} mg/dL`
                    : 'Nenhuma medicao nesse dia'}
                </p>
              </div>
              {ehHoje && (
                <Btn size="sm" variant="primary" onClick={() => setGlicemia({})}>+ Medir</Btn>
              )}
            </div>
            {glicemias.slice(0, 4).map(g => (
              <LinhaGlicemia key={g.id} r={g} onClick={() => setApagarGli(g.id)} />
            ))}
            {glicemias.length > 4 && (
              <Link to="/progresso"
                className="block text-center text-[12px] text-muted py-2.5 active:bg-surface-2">
                ver todas ({glicemias.length}) ›
              </Link>
            )}
          </Card>
        )}

        {/* -------- agua -------- */}
        <Card className="p-3.5 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-lg">💧</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[13px] font-bold">{n1((agua?.ml ?? 0) / 1000)} L</span>
                <span className="text-[11px] text-muted">meta {n1(perfil.metaAgua / 1000)} L</span>
              </div>
              <Barra valor={(agua?.ml ?? 0) / perfil.metaAgua} cor="var(--color-accent-2)" altura={6} />
            </div>
            <Btn size="sm" onClick={async () => {
              const g = await addAgua(250, data); vibrar()
              if (g) celebrar(g)
            }}>+250</Btn>
          </div>
        </Card>

        {/* -------- refeicoes -------- */}
        {nomesRefeicao.map(nome => {
          const itens = registros.filter(r => r.refeicao === nome)
          const plano = planos.find(p => p.nome === nome)
          const m = somaMacros(...itens.map(r => {
            const a = mapa.get(r.alimentoId)
            return a ? macrosDe(a, r.gramas) : ZERO
          }))
          return (
            <div key={nome} className="mb-4">
              <div className="flex items-center justify-between gap-2 mb-2 px-1">
                <h2 className="text-[13.5px] font-bold truncate">{nome}</h2>
                {itens.length > 0 ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[12px] font-black text-accent tabular-nums px-2 py-0.5 rounded-md bg-accent/12">
                      {n0(m.carb)} g carbo
                    </span>
                    <span className="text-[11.5px] text-muted tabular-nums">{n0(m.kcal)} kcal</span>
                  </div>
                ) : (
                  <span className="text-[11.5px] text-muted shrink-0">{plano?.horario ?? ''}</span>
                )}
              </div>

              <Card className="overflow-hidden">
                {itens.map(r => {
                  const a = mapa.get(r.alimentoId)
                  const mm = a ? macrosDe(a, r.gramas) : ZERO
                  return (
                    <button key={r.id} onClick={() => setDetalhe(r)}
                      className="w-full flex items-center gap-3 px-3.5 py-3 border-b border-line/40 last:border-0 text-left active:bg-surface-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-medium truncate">{a?.nome ?? 'Alimento removido'}</p>
                        <p className="text-[11px] text-muted">
                          {nq(r.qtd)} {r.medida}
                          {r.medida !== 'g' && r.medida !== 'ml' ? ` (${n0(r.gramas)} g)` : ''}
                          {' - '}P {n1(mm.prot)}g G {n1(mm.gord)}g
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-bold text-accent tabular-nums">{n0(mm.carb)}g</p>
                        <p className="text-[10.5px] text-muted tabular-nums">{n0(mm.kcal)} kcal</p>
                      </div>
                    </button>
                  )
                })}

                <div className="flex border-t border-line/40">
                  <button onClick={() => setRefeicaoAlvo(nome)}
                    className="flex-1 h-11 text-[13px] font-semibold text-accent active:bg-surface-2">
                    + Adicionar
                  </button>
                  {plano && plano.itens.length > 0 && itens.length === 0 && (
                    <button onClick={() => setAplicarPlano(nome)}
                      className="flex-1 h-11 text-[13px] font-semibold text-muted border-l border-line/40 active:bg-surface-2">
                      Lancar plano
                    </button>
                  )}
                  {diabetes && ehHoje && itens.length > 0 && (
                    <button onClick={() => setGlicemia({ momento: 'antes-refeicao', carbo: m.carb })}
                      className="flex-1 h-11 text-[13px] font-semibold text-muted border-l border-line/40 active:bg-surface-2">
                      Glicemia
                    </button>
                  )}
                </div>
              </Card>
            </div>
          )
        })}

        {registros.length === 0 && (
          <Btn className="w-full mb-4" onClick={copiarOntem}>Copiar tudo de ontem</Btn>
        )}

        <Link to="/alimentos" className="block text-center text-[12.5px] text-muted py-3">
          Gerenciar alimentos ›
        </Link>
      </div>

      {/* -------- sheets -------- */}
      <SeletorAlimento aberto={!!refeicaoAlvo && !escolhido} fechar={() => setRefeicaoAlvo(null)}
        titulo={refeicaoAlvo ?? ''} onEscolher={setEscolhido} />

      <SheetQuantidade alimento={escolhido} fechar={() => setEscolhido(null)}
        onConfirmar={(q, md) => { if (escolhido) adicionar(escolhido, q, md) }} />

      <SheetGlicemia aberto={!!glicemia} fechar={() => setGlicemia(null)}
        momentoInicial={glicemia?.momento} carboSugerido={glicemia?.carbo} />

      <Sheet aberto={!!detalhe} fechar={() => setDetalhe(null)}
        titulo={detalhe ? (mapa.get(detalhe.alimentoId)?.nome ?? 'Item') : ''}>
        {detalhe && (
          <>
            <p className="text-[13px] text-muted mb-4">
              {nq(detalhe.qtd)} {detalhe.medida} - {n0(detalhe.gramas)} g em {detalhe.refeicao}
            </p>
            <Btn variant="danger" className="w-full" onClick={async () => {
              await removerRegistro(detalhe.id)
              setDetalhe(null)
              toast('Removido', 'ok')
            }}>Remover do diario</Btn>
          </>
        )}
      </Sheet>

      <Confirmar aberto={!!aplicarPlano} titulo="Lancar a refeicao do plano?"
        texto="Todos os alimentos planejados para essa refeicao entram no diario do dia."
        onNao={() => setAplicarPlano(null)}
        onSim={() => aplicarPlano && aplicar(aplicarPlano)} />

      <Confirmar aberto={!!apagarGli} perigo titulo="Apagar essa medicao?"
        onNao={() => setApagarGli(null)}
        onSim={async () => {
          if (apagarGli) await removerGlicemia(apagarGli)
          setApagarGli(null)
        }} />
    </div>
  )
}

function Macro({ nome, atual, meta, cor }: { nome: string; atual: number; meta: number; cor: string }) {
  const falta = meta - atual
  return (
    <div>
      <span className="block text-[10.5px] text-muted font-semibold uppercase tracking-wide mb-1">
        {nome}
      </span>
      <p className="text-[16px] font-black leading-none tabular-nums">
        {n0(atual)}<span className="text-[10px] text-muted font-medium">/{n0(meta)}g</span>
      </p>
      <div className="my-1.5"><Barra valor={clamp(atual / meta, 0, 1.15)} cor={cor} altura={5} /></div>
      <p className={`text-[10px] font-medium ${falta < 0 ? 'text-bad' : 'text-muted'}`}>
        {falta >= 0 ? `faltam ${n0(falta)}g` : `${n0(-falta)}g acima`}
      </p>
    </div>
  )
}
