import { useState } from 'react'
import { db, uid, salvarPerfil } from '../db'
import { usePerfil, useMapaAlimentos, usePlanos } from '../state/hooks'
import { macrosDe, somaMacros, paraGramas, ZERO } from '../lib/nutricao'
import { gerarPlano, paraPlanoRefeicao } from '../lib/gerarPlano'
import { SeletorAlimento, SheetQuantidade } from '../components/SeletorAlimento'
import { Cabecalho } from '../components/Cabecalho'
import { Card, Btn, Sheet, Campo, Input, Confirmar, Barra, Vazio } from '../components/ui'
import { useUI } from '../state/ui'
import { n0, nq, clamp } from '../lib/format'
import type { Alimento, ItemRefeicao, PlanoRefeicao } from '../db/types'

export default function PlanoAlimentar() {
  const { toast } = useUI()
  const perfil = usePerfil()
  const planos = usePlanos()
  const mapa = useMapaAlimentos()

  const [refAlvo, setRefAlvo] = useState<PlanoRefeicao | null>(null)
  const [escolhido, setEscolhido] = useState<Alimento | null>(null)
  const [editando, setEditando] = useState<{ plano: PlanoRefeicao; idx: number } | null>(null)
  const [novaRef, setNovaRef] = useState(false)
  const [nome, setNome] = useState('')
  const [horario, setHorario] = useState('12:00')
  const [apagarRef, setApagarRef] = useState<string | null>(null)
  const [config, setConfig] = useState<PlanoRefeicao | null>(null)
  const [gerar, setGerar] = useState(false)
  const [alinhar, setAlinhar] = useState(false)

  const fora = (atual: number, meta: number) => meta > 0 && Math.abs(atual - meta) / meta > 0.1

  const totalPlano = somaMacros(
    ...planos.flatMap(p => p.itens.map(i => {
      const a = mapa.get(i.alimentoId)
      return a ? macrosDe(a, i.gramas) : ZERO
    })),
  )

  const desalinhado =
    fora(totalPlano.prot, perfil.metaProt) ||
    fora(totalPlano.carb, perfil.metaCarb) ||
    fora(totalPlano.gord, perfil.metaGord)

  async function addItem(plano: PlanoRefeicao, a: Alimento, qtd: number, medida: string) {
    const item: ItemRefeicao = {
      alimentoId: a.id, qtd, medida, gramas: paraGramas(a, qtd, medida),
    }
    await db.planos.update(plano.id, { itens: [...plano.itens, item], atualizadoEm: Date.now() })
    setRefAlvo(null)
    toast(`${a.nome} no plano`, 'ok')
  }

  /** Monta o cardapio inteiro em cima das metas atuais. */
  async function gerarAutomatico() {
    const plano = gerarPlano(perfil, mapa)
    await db.planos.clear()
    await db.planos.bulkPut(paraPlanoRefeicao(plano))
    setGerar(false)
    toast('Plano gerado', 'ok', `${n0(plano.total.kcal)} kcal - ${n0(plano.total.carb)} g de carbo`)
  }

  /**
   * Alinha as metas ao que o plano realmente entrega. Comida de verdade traz
   * proteina junto do carboidrato (arroz, feijao, pao), entao a divisao teorica
   * de macros quase nunca fecha com um cardapio montado com comida brasileira.
   * O que precisa fechar e a caloria - o resto e consequencia.
   */
  async function alinharMetas() {
    await salvarPerfil({
      metaProt: Math.round(totalPlano.prot),
      metaCarb: Math.round(totalPlano.carb),
      metaGord: Math.round(totalPlano.gord),
    })
    setAlinhar(false)
    toast('Metas ajustadas ao plano', 'ok')
  }

  async function criarRefeicao() {
    if (!nome.trim()) return toast('Da um nome pra refeicao', 'erro')
    await db.planos.put({
      id: uid(), nome: nome.trim(), horario, itens: [],
      ordem: planos.length, atualizadoEm: Date.now(),
    })
    setNome(''); setHorario('12:00'); setNovaRef(false)
  }

  return (
    <div>
      <Cabecalho titulo="Plano alimentar" voltarPara="/dieta"
        sub="O cardapio padrao que voce lanca com um toque"
        acao={<Btn size="sm" variant="primary" onClick={() => setNovaRef(true)}>+</Btn>} />

      <div className="px-4 pt-4">
        {/* -------- total do plano vs metas -------- */}
        <Card className="p-4 mb-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted">Total do plano</h2>
            <span className={`text-[11.5px] font-bold ${
              Math.abs(totalPlano.kcal - perfil.metaKcal) <= perfil.metaKcal * 0.05 ? 'text-good' : 'text-warn'
            }`}>
              {n0(totalPlano.kcal)} / {n0(perfil.metaKcal)} kcal
            </span>
          </div>
          <div className="mb-3"><Barra valor={totalPlano.kcal / perfil.metaKcal} altura={8} /></div>
          <div className="grid grid-cols-3 gap-3">
            <Alvo nome="Prot" atual={totalPlano.prot} meta={perfil.metaProt} cor="var(--color-good)" />
            <Alvo nome="Carb" atual={totalPlano.carb} meta={perfil.metaCarb} cor="var(--color-warn)" />
            <Alvo nome="Gord" atual={totalPlano.gord} meta={perfil.metaGord} cor="#c084fc" />
          </div>
          {totalPlano.kcal > 0 && desalinhado && (
            <div className="mt-3 pt-3 border-t border-line/50">
              <p className="text-[11.5px] text-muted leading-relaxed mb-2.5">
                O plano fecha nas calorias, mas a divisao de macros ficou diferente
                da meta - arroz, feijao e pao trazem proteina junto do carboidrato.
              </p>
              <Btn size="sm" onClick={() => setAlinhar(true)}>Ajustar metas a este plano</Btn>
            </div>
          )}

          {totalPlano.kcal > 0 && Math.abs(totalPlano.kcal - perfil.metaKcal) > perfil.metaKcal * 0.08 && (
            <p className="text-[11.5px] text-muted mt-3 leading-relaxed">
              {totalPlano.kcal < perfil.metaKcal
                ? `Faltam ${n0(perfil.metaKcal - totalPlano.kcal)} kcal no plano pra bater sua meta diaria.`
                : `O plano esta ${n0(totalPlano.kcal - perfil.metaKcal)} kcal acima da meta.`}
            </p>
          )}
        </Card>

        <Card className="p-4 mb-4 border-accent/25">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 shrink-0 rounded-xl grad-accent flex items-center justify-center text-white text-lg">
              ⚡
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold">Gerar cardapio automatico</p>
              <p className="text-[11.5px] text-muted mt-0.5 leading-relaxed">
                Monta as 6 refeicoes em cima das suas metas, com carboidrato
                distribuido de forma parecida entre elas.
              </p>
              <Btn size="sm" variant="primary" className="mt-3" onClick={() => setGerar(true)}>
                {planos.some(p => p.itens.length) ? 'Refazer o plano' : 'Gerar agora'}
              </Btn>
            </div>
          </div>
        </Card>

        {planos.length === 0 && (
          <Vazio icone="🍽️" titulo="Nenhuma refeicao"
            texto="Crie as refeicoes do seu dia e monte o cardapio de cada uma."
            acao={<Btn variant="primary" onClick={() => setNovaRef(true)}>Criar refeicao</Btn>} />
        )}

        {planos.map(p => {
          const m = somaMacros(...p.itens.map(i => {
            const a = mapa.get(i.alimentoId)
            return a ? macrosDe(a, i.gramas) : ZERO
          }))
          return (
            <div key={p.id} className="mb-4">
              <div className="flex items-baseline justify-between mb-2 px-1">
                <button onClick={() => setConfig(p)} className="flex items-baseline gap-2 min-w-0">
                  <h2 className="text-[13.5px] font-bold truncate">{p.nome}</h2>
                  <span className="text-[11px] text-muted shrink-0">{p.horario}</span>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  {m.carb > 0 && (
                    <span className="text-[11.5px] font-black text-accent tabular-nums px-2 py-0.5 rounded-md bg-accent/12">
                      {n0(m.carb)} g carbo
                    </span>
                  )}
                  <span className="text-[11.5px] text-muted tabular-nums">{n0(m.kcal)} kcal</span>
                </div>
              </div>

              <Card className="overflow-hidden">
                {p.itens.map((item, idx) => {
                  const a = mapa.get(item.alimentoId)
                  const mm = a ? macrosDe(a, item.gramas) : ZERO
                  return (
                    <button key={idx} onClick={() => setEditando({ plano: p, idx })}
                      className="w-full flex items-center gap-3 px-3.5 py-3 border-b border-line/40 last:border-0 text-left active:bg-surface-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-medium truncate">{a?.nome ?? 'Alimento removido'}</p>
                        <p className="text-[11px] text-muted">
                          {nq(item.qtd)} {item.medida}
                          {item.medida !== 'g' && item.medida !== 'ml' ? ` (${n0(item.gramas)} g)` : ''}
                        </p>
                      </div>
                      <span className="text-[13px] font-bold tabular-nums shrink-0">{n0(mm.kcal)}</span>
                    </button>
                  )
                })}
                <button onClick={() => setRefAlvo(p)}
                  className="w-full h-11 text-[13px] font-semibold text-accent active:bg-surface-2">
                  + Adicionar alimento
                </button>
              </Card>
            </div>
          )
        })}
      </div>

      {/* -------- sheets -------- */}
      <SeletorAlimento aberto={!!refAlvo && !escolhido} fechar={() => setRefAlvo(null)}
        titulo={refAlvo?.nome ?? ''} onEscolher={setEscolhido} />

      <SheetQuantidade alimento={escolhido} fechar={() => setEscolhido(null)} textoBotao="Adicionar ao plano"
        onConfirmar={(q, md) => { if (refAlvo && escolhido) addItem(refAlvo, escolhido, q, md) }} />

      {/* editar item existente do plano */}
      {editando && (
        <SheetQuantidade
          alimento={mapa.get(editando.plano.itens[editando.idx].alimentoId) ?? null}
          qtdInicial={editando.plano.itens[editando.idx].qtd}
          medidaInicial={editando.plano.itens[editando.idx].medida}
          textoBotao="Salvar"
          fechar={() => setEditando(null)}
          onConfirmar={async (q, md) => {
            const { plano, idx } = editando
            const a = mapa.get(plano.itens[idx].alimentoId)
            if (!a) return
            const itens = [...plano.itens]
            itens[idx] = { alimentoId: a.id, qtd: q, medida: md, gramas: paraGramas(a, q, md) }
            await db.planos.update(plano.id, { itens, atualizadoEm: Date.now() })
            setEditando(null)
          }} />
      )}
      {editando && (
        <button
          onClick={async () => {
            const { plano, idx } = editando
            await db.planos.update(plano.id, {
              itens: plano.itens.filter((_, i) => i !== idx), atualizadoEm: Date.now(),
            })
            setEditando(null)
            toast('Item removido do plano', 'ok')
          }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[55] h-10 px-5 rounded-xl bg-bad/20 border border-bad/40 text-bad text-[13px] font-semibold">
          Remover do plano
        </button>
      )}

      <Sheet aberto={novaRef} fechar={() => setNovaRef(false)} titulo="Nova refeicao">
        <Campo label="Nome"><Input value={nome} onChange={e => setNome(e.target.value)}
          placeholder="Ceia" autoFocus /></Campo>
        <Campo label="Horario"><Input type="time" value={horario} onChange={e => setHorario(e.target.value)} /></Campo>
        <Btn variant="primary" size="lg" className="w-full mt-2" onClick={criarRefeicao}>Criar</Btn>
      </Sheet>

      <Sheet aberto={!!config} fechar={() => setConfig(null)} titulo={config?.nome}>
        {config && (
          <>
            <Campo label="Nome">
              <Input defaultValue={config.nome}
                onBlur={e => db.planos.update(config.id, { nome: e.target.value.trim() || config.nome })} />
            </Campo>
            <Campo label="Horario">
              <Input type="time" defaultValue={config.horario}
                onBlur={e => db.planos.update(config.id, { horario: e.target.value })} />
            </Campo>
            <p className="text-[11.5px] text-muted mb-4 leading-relaxed">
              Renomear a refeicao nao muda o que ja foi registrado no diario com o nome antigo.
            </p>
            <Btn variant="danger" className="w-full" onClick={() => { setApagarRef(config.id); setConfig(null) }}>
              Apagar refeicao
            </Btn>
          </>
        )}
      </Sheet>

      <Confirmar aberto={alinhar} titulo="Ajustar as metas?"
        texto={`Proteina ${n0(totalPlano.prot)} g, carboidrato ${n0(totalPlano.carb)} g e gordura ${n0(totalPlano.gord)} g passam a ser as suas metas diarias. As calorias nao mudam.`}
        onNao={() => setAlinhar(false)} onSim={alinharMetas} />

      <Confirmar aberto={gerar} titulo="Gerar o cardapio?"
        texto="As refeicoes atuais do plano sao substituidas por um cardapio novo, calculado nas suas metas. O que ja foi registrado no diario nao muda."
        onNao={() => setGerar(false)} onSim={gerarAutomatico} />

      <Confirmar aberto={!!apagarRef} perigo titulo="Apagar refeicao?"
        texto="O cardapio dela se perde. O diario ja registrado continua."
        onNao={() => setApagarRef(null)}
        onSim={async () => { await db.planos.delete(apagarRef!); setApagarRef(null) }} />
    </div>
  )
}

function Alvo({ nome, atual, meta, cor }: { nome: string; atual: number; meta: number; cor: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-1">{nome}</p>
      <p className="text-[14px] font-bold tabular-nums leading-none mb-1.5">
        {n0(atual)}<span className="text-[9.5px] text-muted font-medium">/{n0(meta)}g</span>
      </p>
      <Barra valor={clamp(atual / meta, 0, 1.15)} cor={cor} altura={4} />
    </div>
  )
}
