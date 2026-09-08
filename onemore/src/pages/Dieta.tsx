import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, hoje, diaMais } from '../db'
import {
  usePerfil, useMapaAlimentos, usePlanos, useAguaDoDia, useGlicemiaDoDia,
} from '../state/hooks'
import { totalDoDia, macrosDe, somaMacros, ZERO, type Macros } from '../lib/nutricao'
import {
  registrarAlimento, removerRegistro, removerRefeicaoDoDia, checarMetasDoDia, addAgua, removerGlicemia,
} from '../lib/acoes'
import { SeletorAlimento, SheetQuantidade } from '../components/SeletorAlimento'
import { SheetMetas } from '../components/SheetMetas'
import { SheetGlicemia, LinhaGlicemia } from '../components/Glicemia'
import { Icone } from '../components/Icone'
import { Titulo } from '../components/Cabecalho'
import { Card, Btn, Anel, Barra, Sheet, Confirmar } from '../components/ui'
import { useUI, vibrar } from '../state/ui'
import { n0, n1, nq, dataCurta, clamp } from '../lib/format'
import type { Alimento, RegistroDieta, PlanoRefeicao, MomentoGlicemia } from '../db/types'

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
  const [desfazerAlvo, setDesfazerAlvo] = useState<string | null>(null)
  const [glicemia, setGlicemia] = useState<{ momento?: MomentoGlicemia; carbo?: number } | null>(null)
  const [apagarGli, setApagarGli] = useState<string | null>(null)
  const [editarMetas, setEditarMetas] = useState(false)

  const total = totalDoDia(registros, mapa)
  const restante = perfil.metaKcal - total.kcal
  const ehHoje = data === hoje()
  const diabetes = perfil.diabetesTipo1 === true

  const nomesRefeicao = planos.length
    ? planos.map(p => p.nome)
    : ['Cafe da manha', 'Almoco', 'Jantar', 'Lanches']

  /** Refeicao do plano ainda pendente mais proxima do horario atual - só pra destacar na lista. */
  const proximaNome = (() => {
    if (!ehHoje || !planos.length) return null
    const pendentes = planos.filter(p => p.itens.length > 0 && !registros.some(r => r.refeicao === p.nome))
    if (!pendentes.length) return null
    const agora = new Date()
    const minAgora = agora.getHours() * 60 + agora.getMinutes()
    const comDif = pendentes.map(p => {
      const [h, m] = p.horario.split(':').map(Number)
      return { p, diff: (h * 60 + m) - minAgora }
    })
    const futuras = comDif.filter(x => x.diff >= -60)
    const lista = futuras.length ? futuras : comDif
    lista.sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff))
    return lista[0].p.nome
  })()

  async function adicionar(a: Alimento, qtd: number, medida: string) {
    if (!refeicaoAlvo) return
    vibrar()
    await registrarAlimento(data, refeicaoAlvo, a, qtd, medida)
    const ganhos = await checarMetasDoDia(data)
    if (ganhos.length) ganhos.forEach(celebrar)
    else toast(`${a.nome} adicionado`, 'ok')
    setRefeicaoAlvo(null)
  }

  async function comer(plano: PlanoRefeicao) {
    if (!plano.itens.length) return
    vibrar([20, 40, 20])
    for (const item of plano.itens) {
      const a = mapa.get(item.alimentoId)
      if (a) await registrarAlimento(data, plano.nome, a, item.qtd, item.medida)
    }
    const ganhos = await checarMetasDoDia(data)
    if (ganhos.length) ganhos.forEach(celebrar)
    else toast(`${plano.nome} marcada como comida`, 'ok')
  }

  async function desfazer(nome: string) {
    await removerRefeicaoDoDia(data, nome)
    setDesfazerAlvo(null)
    toast(`${nome} desfeita`, 'ok')
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
        acao={
          <div className="flex items-center gap-2">
            <Link to="/dieta/imprimir" className="text-[12px] font-semibold text-muted">PDF</Link>
            <Link to="/dieta/plano"><Btn size="sm">Plano</Btn></Link>
          </div>
        } />

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
              <button onClick={() => setEditarMetas(true)}
                className="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted font-semibold active:text-accent">
                Meta {n0(perfil.metaKcal)} kcal
                <Icone nome="lapis" tamanho={12} />
              </button>
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
          <button onClick={() => setEditarMetas(true)} className="w-full grid grid-cols-3 gap-3 text-left">
            <Macro nome="Carboidrato" atual={total.carb} meta={perfil.metaCarb} cor="var(--color-accent)" />
            <Macro nome="Proteina" atual={total.prot} meta={perfil.metaProt} cor="var(--color-good)" />
            <Macro nome="Gordura" atual={total.gord} meta={perfil.metaGord} cor="var(--color-warn)" />
          </button>
          <button onClick={() => setEditarMetas(true)}
            className="w-full mt-3 pt-3 border-t border-line/50 flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-muted active:text-accent">
            <Icone nome="lapis" tamanho={13} />
            Editar metas do dia
          </button>
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
              <Link to="/diario"
                className="block text-center text-[12px] text-muted py-2.5 active:bg-surface-2">
                ver todas ({glicemias.length}) ›
              </Link>
            )}
          </Card>
        )}

        {/* -------- agua -------- */}
        <Card className="p-3.5 mb-4">
          <div className="flex items-center gap-3">
            <Icone nome="gota" tamanho={19} className="text-accent-2 shrink-0" />
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
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2 px-1">
          Refeicoes do dia
        </h2>
        {nomesRefeicao.map(nome => {
          const itens = registros.filter(r => r.refeicao === nome)
          const plano = planos.find(p => p.nome === nome)
          return (
            <RefeicaoCard key={nome}
              nome={nome} plano={plano} itens={itens} mapa={mapa}
              comido={itens.length > 0} destaque={nome === proximaNome}
              diabetes={diabetes} ehHoje={ehHoje}
              onComer={() => plano && comer(plano)}
              onDesfazer={() => setDesfazerAlvo(nome)}
              onAdicionar={() => setRefeicaoAlvo(nome)}
              onAbrirItem={setDetalhe}
              onGlicemia={carbo => setGlicemia({ momento: 'antes-refeicao', carbo })}
            />
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

      <SheetMetas aberto={editarMetas} fechar={() => setEditarMetas(false)} perfil={perfil} />

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

      <Confirmar aberto={!!desfazerAlvo} perigo titulo="Desfazer essa refeicao?"
        texto="Tudo que foi lancado nela hoje sai do diario."
        onNao={() => setDesfazerAlvo(null)}
        onSim={() => desfazerAlvo && desfazer(desfazerAlvo)} />

      <Confirmar aberto={!!apagarGli} perigo titulo="Apagar essa medicao?"
        onNao={() => setApagarGli(null)}
        onSim={async () => {
          if (apagarGli) await removerGlicemia(apagarGli)
          setApagarGli(null)
        }} />
    </div>
  )
}

/**
 * Uma refeicao, sempre mostrando a mesma lista de alimentos - a do plano antes
 * de comer, a do que foi de fato lancado depois. So muda o estado (comido ou
 * nao), nunca a "forma" do cartao - e o que estava confuso antes.
 */
function RefeicaoCard({ nome, plano, itens, mapa, comido, destaque, diabetes, ehHoje, onComer, onDesfazer, onAdicionar, onAbrirItem, onGlicemia }: {
  nome: string
  plano?: PlanoRefeicao
  itens: RegistroDieta[]
  mapa: Map<string, Alimento>
  comido: boolean
  destaque: boolean
  diabetes: boolean
  ehHoje: boolean
  onComer: () => void
  onDesfazer: () => void
  onAdicionar: () => void
  onAbrirItem: (r: RegistroDieta) => void
  onGlicemia: (carbo: number) => void
}) {
  const temPlano = !!plano?.itens.length

  type Linha = { key: string; alimentoId: string; qtd: number; medida: string; gramas: number; registro: RegistroDieta | null }
  const linhas: Linha[] = comido
    ? itens.map(r => ({ key: r.id, alimentoId: r.alimentoId, qtd: r.qtd, medida: r.medida, gramas: r.gramas, registro: r }))
    : (plano?.itens ?? []).map(it => ({ key: it.alimentoId, alimentoId: it.alimentoId, qtd: it.qtd, medida: it.medida, gramas: it.gramas, registro: null }))

  const macros: Macros = somaMacros(...linhas.map(l => {
    const a = mapa.get(l.alimentoId)
    return a ? macrosDe(a, l.gramas) : ZERO
  }))

  return (
    <Card className={`overflow-hidden mb-3 ${
      comido ? 'border-good/35' : destaque ? 'border-accent/40' : ''
    }`}>
      <div className="flex items-center gap-3 px-3.5 py-3 border-b border-line/40">
        <button onClick={comido ? onDesfazer : (temPlano ? onComer : undefined)}
          disabled={!comido && !temPlano}
          aria-label={comido ? 'Desfazer' : 'Marcar como comida'}
          className={`w-9 h-9 shrink-0 rounded-full border-2 flex items-center justify-center transition-all active:scale-90 ${
            comido ? 'bg-good border-good text-[#0a0714]'
              : temPlano ? 'border-accent text-accent/70 active:border-good active:text-good'
              : 'border-line text-muted/30'
          }`}>
          <Icone nome="check" tamanho={16} traco={2.6} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h2 className="text-[13.5px] font-bold truncate">{nome}</h2>
            {destaque && !comido && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 bg-accent/15 text-accent">
                AGORA
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted truncate">
            {plano?.horario}{plano?.horario && linhas.length > 0 ? ' · ' : ''}
            {linhas.length > 0 && `${n0(macros.carb)} g carbo · ${n0(macros.kcal)} kcal`}
          </p>
        </div>

        {diabetes && ehHoje && comido && (
          <button onClick={() => onGlicemia(macros.carb)} aria-label="Registrar glicemia dessa refeicao"
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted active:text-accent active:bg-surface-2">
            <Icone nome="sangue" tamanho={17} />
          </button>
        )}
      </div>

      {linhas.length === 0 ? (
        <p className="px-3.5 py-4 text-[12.5px] text-muted text-center">
          Nada planejado pra essa refeicao ainda.
        </p>
      ) : (
        <div className={comido ? '' : 'opacity-70'}>
          {linhas.map(l => {
            const a = mapa.get(l.alimentoId)
            const mm = a ? macrosDe(a, l.gramas) : ZERO
            const conteudo = (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate">{a?.nome ?? 'Alimento removido'}</p>
                  <p className="text-[10.5px] text-muted">
                    {nq(l.qtd)} {l.medida}
                    {l.medida !== 'g' && l.medida !== 'ml' ? ` (${n0(l.gramas)} g)` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[12.5px] font-bold text-accent tabular-nums">{n0(mm.carb)}g</p>
                  <p className="text-[10px] text-muted tabular-nums">{n0(mm.kcal)} kcal</p>
                </div>
              </>
            )
            return l.registro ? (
              <button key={l.key} onClick={() => onAbrirItem(l.registro!)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 border-b border-line/40 last:border-0 text-left active:bg-surface-2">
                {conteudo}
              </button>
            ) : (
              <div key={l.key} className="w-full flex items-center gap-3 px-3.5 py-2.5 border-b border-line/40 last:border-0">
                {conteudo}
              </div>
            )
          })}
        </div>
      )}

      {!comido && temPlano && (
        <button onClick={onComer}
          className="w-full h-11 text-[13.5px] font-bold text-good active:bg-good/10 border-t border-line/40">
          Comi essa refeicao
        </button>
      )}

      <div className="flex border-t border-line/40">
        <button onClick={onAdicionar}
          className="flex-1 h-10 text-[12.5px] font-semibold text-muted active:bg-surface-2">
          + Adicionar {comido || !temPlano ? '' : 'outra coisa'}
        </button>
        {comido && (
          <button onClick={onDesfazer}
            className="flex-1 h-10 text-[12.5px] font-semibold text-muted border-l border-line/40 active:bg-surface-2">
            Desfazer
          </button>
        )}
      </div>
    </Card>
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
