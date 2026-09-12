import { useState } from 'react'
import { db, uid, salvarPerfil, apagarLinha } from '../db'
import { restricoesDoPerfil, temConflito, conflitos, textoConflito } from '../lib/restricoes'
import type { Marcador } from '../db/marcadores'
import { usePerfil, useMapaAlimentos, usePlanos, useDietasSalvas } from '../state/hooks'
import { macrosDe, somaMacros, paraGramas, ZERO, nomeMedida } from '../lib/nutricao'
import { gerarPlano, paraPlanoRefeicao } from '../lib/gerarPlano'
import { DIETAS_PRONTAS, type DietaPronta } from '../db/dietasProntas'
import { SeletorAlimento, SheetQuantidade } from '../components/SeletorAlimento'
import { SheetSubstituir, type AlvoTroca } from '../components/Substituicoes'
import { SheetMetas } from '../components/SheetMetas'
import { Cabecalho } from '../components/Cabecalho'
import { Card, Btn, Sheet, Campo, Input, Confirmar, Barra, Vazio } from '../components/ui'
import { useUI } from '../state/ui'
import { n0, nq, clamp } from '../lib/format'
import { Icone } from '../components/Icone'
import type { Alimento, ItemRefeicao, PlanoRefeicao, DietaSalva } from '../db/types'

export default function PlanoAlimentar() {
  const { toast } = useUI()
  const perfil = usePerfil()
  const evitar = restricoesDoPerfil(perfil)
  const planos = usePlanos()
  const dietas = useDietasSalvas()
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
  const [editarMetas, setEditarMetas] = useState(false)
  const [dietaPronta, setDietaPronta] = useState<DietaPronta | null>(null)
  const [trocar, setTrocar] = useState<{ plano: PlanoRefeicao; idx: number; alvo: AlvoTroca } | null>(null)

  // dietas salvas
  const [salvarNome, setSalvarNome] = useState<string | null>(null)
  const [carregar, setCarregar] = useState<DietaSalva | null>(null)
  const [apagarDieta, setApagarDieta] = useState<DietaSalva | null>(null)
  const [sobrescrever, setSobrescrever] = useState<DietaSalva | null>(null)

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
    /**
     * O gerador ja descarta slot cujo alimento nao esta no mapa, entao basta
     * entregar um mapa sem o que a pessoa evita - ele redistribui o resto
     * sozinho. Zero mudanca no gerador.
     */
    const disponivel = evitar.length
      ? new Map([...mapa].filter(([id]) => !temConflito(id, evitar)))
      : mapa
    const plano = gerarPlano(perfil, disponivel)
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

  /** Substitui um item do cardapio por um equivalente, ja na porcao sugerida. */
  async function trocarItem(plano: PlanoRefeicao, idx: number, a: Alimento, qtd: number, medida: string) {
    const antigo = mapa.get(plano.itens[idx].alimentoId)?.nome ?? 'Item'
    const itens = [...plano.itens]
    itens[idx] = { alimentoId: a.id, qtd, medida, gramas: paraGramas(a, qtd, medida) }
    await db.planos.update(plano.id, { itens, atualizadoEm: Date.now() })
    setTrocar(null)
    toast(`${antigo} trocado por ${a.nome}`, 'ok')
  }

  async function criarRefeicao() {
    if (!nome.trim()) return toast('Da um nome pra refeição', 'erro')
    await db.planos.put({
      id: uid(), nome: nome.trim(), horario, itens: [],
      ordem: planos.length, atualizadoEm: Date.now(),
    })
    setNome(''); setHorario('12:00'); setNovaRef(false)
  }

  /* ---------------- dietas salvas ---------------- */

  const instantaneo = () => planos.map(p => ({
    nome: p.nome, horario: p.horario, itens: p.itens.map(i => ({ ...i })), ordem: p.ordem,
  }))

  async function salvarDieta(nomeDieta: string) {
    if (!nomeDieta.trim()) return toast('Da um nome pra dieta', 'erro')
    if (!planos.length) return toast('Monte as refeições antes de salvar', 'erro')
    const agora = Date.now()
    await db.dietas.put({
      id: uid(), nome: nomeDieta.trim(), refeicoes: instantaneo(),
      criadoEm: agora, atualizadoEm: agora,
    })
    setSalvarNome(null)
    toast(`Dieta "${nomeDieta.trim()}" salva`, 'ok')
  }

  async function atualizarDieta(d: DietaSalva) {
    await db.dietas.update(d.id, { refeicoes: instantaneo(), atualizadoEm: Date.now() })
    setSobrescrever(null)
    toast(`"${d.nome}" atualizada`, 'ok')
  }

  async function carregarDieta(d: DietaSalva) {
    await db.planos.clear()
    await db.planos.bulkPut(d.refeicoes.map((r, i) => ({
      id: uid(), nome: r.nome, horario: r.horario,
      itens: r.itens.map(it => ({ ...it })),
      ordem: r.ordem ?? i, atualizadoEm: Date.now(),
    })))
    setCarregar(null)
    toast(`"${d.nome}" carregada`, 'ok')
  }

  /** Traz uma dieta pronta do catalogo do app pro plano em uso. */
  async function aplicarDietaPronta(d: DietaPronta) {
    await db.planos.clear()
    await db.planos.bulkPut(d.refeicoes.map((r, idx) => ({
      id: uid(), nome: r.nome, horario: r.horario,
      itens: r.itens.map(it => ({ ...it })), ordem: idx, atualizadoEm: Date.now(),
    })))
    setDietaPronta(null)
    toast(`"${d.nome}" aplicada`, 'ok')
  }

  const macrosDeRefeicoes = (refeicoes: { itens: { alimentoId: string; gramas: number }[] }[]) =>
    somaMacros(...refeicoes.flatMap(r => r.itens.map(i => {
      const a = mapa.get(i.alimentoId)
      return a ? macrosDe(a, i.gramas) : ZERO
    })))

  const kcalDeDieta = (d: DietaSalva) => somaMacros(
    ...d.refeicoes.flatMap(r => r.itens.map(i => {
      const a = mapa.get(i.alimentoId)
      return a ? macrosDe(a, i.gramas) : ZERO
    })),
  ).kcal

  return (
    <div>
      <Cabecalho titulo="Plano alimentar" voltarPara="/dieta"
        sub="O cardápio padrão que você lanca com um toque"
        acao={<Btn size="sm" variant="primary" onClick={() => setNovaRef(true)}>+ Refeição</Btn>} />

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
          <button onClick={() => setEditarMetas(true)} className="w-full grid grid-cols-3 gap-3 text-left">
            <Alvo nome="Prot" atual={totalPlano.prot} meta={perfil.metaProt} cor="var(--color-good)" />
            <Alvo nome="Carb" atual={totalPlano.carb} meta={perfil.metaCarb} cor="var(--color-warn)" />
            <Alvo nome="Gord" atual={totalPlano.gord} meta={perfil.metaGord} cor="#9b7fc7" />
          </button>
          <button onClick={() => setEditarMetas(true)}
            className="w-full mt-3 pt-3 border-t border-line/50 flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-muted active:text-accent">
            <Icone nome="lapis" tamanho={13} />
            Editar metas do dia
          </button>
          {totalPlano.kcal > 0 && desalinhado && (
            <div className="mt-3 pt-3 border-t border-line/50">
              <p className="text-[11.5px] text-muted leading-relaxed mb-2.5">
                O plano fecha nas calorias, mas a divisao de macros ficou diferente
                da meta - arroz, feijão e pão trazem proteína junto do carboidrato.
              </p>
              <Btn size="sm" onClick={() => setAlinhar(true)}>Ajustar metas a este plano</Btn>
            </div>
          )}

          {totalPlano.kcal > 0 && Math.abs(totalPlano.kcal - perfil.metaKcal) > perfil.metaKcal * 0.08 && (
            <p className="text-[11.5px] text-muted mt-3 leading-relaxed">
              {totalPlano.kcal < perfil.metaKcal
                ? `Faltam ${n0(perfil.metaKcal - totalPlano.kcal)} kcal no plano pra bater sua meta diaria.`
                : `O plano está ${n0(totalPlano.kcal - perfil.metaKcal)} kcal acima da meta.`}
            </p>
          )}
        </Card>

        {/* -------- minhas dietas -------- */}
        <div className="flex items-end justify-between mb-2 px-1">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted">Minhas dietas</h2>
          {planos.length > 0 && (
            <button onClick={() => setSalvarNome('')}
              className="toque text-[12px] font-semibold text-accent">
              Salvar está
            </button>
          )}
        </div>

        <Card className="overflow-hidden mb-6">
          {dietas.length === 0 ? (
            <p className="px-4 py-4 text-[12.5px] text-muted leading-relaxed">
              Monte o cardápio do seu jeito nas refeições abaixo e toque em
              <span className="text-accent font-semibold"> Salvar está</span> pra guardar
              como uma dieta sua. Da pra ter varias e alternar entre elas.
            </p>
          ) : (
            dietas.map(d => (
              <div key={d.id}
                className="flex items-center gap-2 px-3.5 py-3 border-b border-line/40 last:border-0">
                <button onClick={() => setCarregar(d)} className="flex-1 min-w-0 text-left">
                  <p className="text-[13.5px] font-semibold truncate">{d.nome}</p>
                  <p className="text-[11px] text-muted">
                    {d.refeicoes.length} refeic{d.refeicoes.length === 1 ? 'ao' : 'oes'}
                    {' - '}{n0(kcalDeDieta(d))} kcal
                  </p>
                </button>
                <button onClick={() => setSobrescrever(d)} aria-label="Atualizar com o plano atual"
                  className="w-11 h-11 shrink-0 rounded-lg flex items-center justify-center text-muted active:bg-surface-2 active:text-accent">
                  <Icone nome="copiar" tamanho={16} />
                </button>
                <button onClick={() => setApagarDieta(d)} aria-label="Apagar dieta"
                  className="w-11 h-11 shrink-0 rounded-lg flex items-center justify-center text-muted active:bg-surface-2 active:text-bad">
                  <Icone nome="lixeira" tamanho={16} />
                </button>
              </div>
            ))
          )}
        </Card>

        {/* -------- refeicoes -------- */}
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2 px-1">
          Refeições do plano
        </h2>

        {planos.length === 0 && (
          <Vazio icone="prato" titulo="Nenhuma refeição"
            texto="Crie as refeições do seu dia e monte o cardápio de cada uma do seu jeito."
            acao={<Btn variant="primary" onClick={() => setNovaRef(true)}>Criar refeição</Btn>} />
        )}

        {planos.map(p => {
          const m = somaMacros(...p.itens.map(i => {
            const a = mapa.get(i.alimentoId)
            return a ? macrosDe(a, i.gramas) : ZERO
          }))
          return (
            <div key={p.id} className="mb-4">
              <div className="flex items-center justify-between mb-1 px-1">
                <button onClick={() => setConfig(p)} aria-label={`Ajustar ${p.nome}`}
                  className="flex items-baseline gap-2 min-w-0 h-11 pr-2">
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
                          {nq(item.qtd)} {nomeMedida(a, item.medida)}
                          {item.medida !== 'g' && item.medida !== 'ml' ? ` (${n0(item.gramas)} g)` : ''}
                        </p>
                        <AvisoRestricao alimentoId={item.alimentoId} evitar={evitar} />
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

        {/* -------- dietas prontas do app -------- */}
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2 px-1 mt-6">
          Dietas prontas
        </h2>
        {DIETAS_PRONTAS.map(d => {
          const m = macrosDeRefeicoes(d.refeicoes)
          return (
            <Card key={d.id} className="p-4 mb-3 border-accent/25">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 shrink-0 rounded-xl grad-accent flex items-center justify-center text-white">
                  <Icone nome="prato" tamanho={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold leading-tight">{d.nome}</p>
                  <p className="text-[11.5px] text-muted mt-0.5">{d.resumo}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-surface-2 text-muted">
                      {d.refeicoes.length} refeições
                    </span>
                    <span className="text-[10.5px] font-black px-2 py-0.5 rounded-md bg-accent/12 text-accent tabular-nums">
                      {n0(m.carb)} g carbo
                    </span>
                    <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-surface-2 text-muted tabular-nums">
                      {n0(m.kcal)} kcal - P {n0(m.prot)} G {n0(m.gord)}
                    </span>
                  </div>
                  <Btn size="sm" variant="primary" className="mt-3" onClick={() => setDietaPronta(d)}>
                    Ver e usar
                  </Btn>
                </div>
              </div>
            </Card>
          )
        })}

        {/* -------- gerador: atalho, nao o caminho principal -------- */}
        <Card className="p-4 mt-6 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-surface-2 flex items-center justify-center text-muted">
              <Icone nome="faisca" tamanho={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold">Gerar um cardápio pronto</p>
              <p className="text-[11.5px] text-muted mt-0.5 leading-relaxed">
                Atalho pra ter um ponto de partida: monta 6 refeições nas suas metas e
                você edita o que quiser depois. Substitui as refeições atuais - salve a
                sua dieta antes se não quiser perder.
              </p>
              <Btn size="sm" className="mt-3" onClick={() => setGerar(true)}>
                {planos.some(p => p.itens.length) ? 'Refazer o plano' : 'Gerar agora'}
              </Btn>
            </div>
          </div>
        </Card>
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
          textoRemover="Remover"
          extra={
            <Btn className="w-full mb-3" onClick={() => {
              const { plano, idx } = editando
              const it = plano.itens[idx]
              const a = mapa.get(it.alimentoId)
              if (!a) return
              setTrocar({ plano, idx, alvo: { alimento: a, qtd: it.qtd, medida: it.medida, gramas: it.gramas } })
              setEditando(null)
            }}>Ver equivalentes</Btn>
          }
          fechar={() => setEditando(null)}
          onRemover={async () => {
            const { plano, idx } = editando
            await db.planos.update(plano.id, {
              itens: plano.itens.filter((_, i) => i !== idx), atualizadoEm: Date.now(),
            })
            setEditando(null)
            toast('Item removido do plano', 'ok')
          }}
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

      <SheetSubstituir alvo={trocar?.alvo ?? null} fechar={() => setTrocar(null)}
        priorizarCarbo={perfil.diabetesTipo1 === true}
        acaoTexto="Toque num equivalente pra trocar no cardápio"
        onEscolher={sub => {
          if (trocar) trocarItem(trocar.plano, trocar.idx, sub.alimento, sub.qtd, sub.medida)
        }} />

      <SheetMetas aberto={editarMetas} fechar={() => setEditarMetas(false)} perfil={perfil} />

      <Sheet aberto={!!dietaPronta} fechar={() => setDietaPronta(null)} titulo={dietaPronta?.nome} alto>
        {dietaPronta && (
          <>
            <p className="text-[12.5px] text-muted leading-relaxed mb-3">{dietaPronta.porque}</p>
            {dietaPronta.cuidado && (
              <Card className="p-3 mb-4 border-warn/30">
                <p className="text-[11px] font-bold uppercase tracking-widest text-warn mb-1">Atenção</p>
                <p className="text-[12px] text-muted leading-relaxed">{dietaPronta.cuidado}</p>
              </Card>
            )}

            <div className="space-y-2 mb-4">
              {dietaPronta.refeicoes.map(r => {
                const m = macrosDeRefeicoes([r])
                return (
                  <Card key={r.nome} className="p-3">
                    <div className="flex items-baseline justify-between gap-2 mb-1.5">
                      <p className="text-[13px] font-bold truncate">{r.horario} {r.nome}</p>
                      <span className="text-[11px] font-black text-accent tabular-nums shrink-0">
                        {n0(m.carb)} g carbo
                      </span>
                    </div>
                    <p className="text-[11.5px] text-muted leading-relaxed">
                      {r.itens.map(it => mapa.get(it.alimentoId)?.nome ?? '?').join(', ')}
                    </p>
                    {r.nota && <p className="text-[11px] text-accent/90 mt-1.5 leading-relaxed">{r.nota}</p>}
                  </Card>
                )
              })}
            </div>

            <p className="text-[11.5px] text-muted mb-4 leading-relaxed">
              Aplicar substitui as refeições do plano atual. Salve a sua dieta antes se
              não quiser perder - e depois use "Ajustar metas a este plano" pra suas
              metas baterem com o cardápio.
            </p>
            <Btn variant="primary" size="lg" className="w-full"
              onClick={() => aplicarDietaPronta(dietaPronta)}>
              Usar essa dieta
            </Btn>
          </>
        )}
      </Sheet>

      <Sheet aberto={novaRef} fechar={() => setNovaRef(false)} titulo="Nova refeição">
        <Campo label="Nome"><Input value={nome} onChange={e => setNome(e.target.value)}
          placeholder="Ceia" autoFocus /></Campo>
        <Campo label="Horário"><Input type="time" value={horario} onChange={e => setHorario(e.target.value)} /></Campo>
        <Btn variant="primary" size="lg" className="w-full mt-2" onClick={criarRefeicao}>Criar</Btn>
      </Sheet>

      <Sheet aberto={salvarNome !== null} fechar={() => setSalvarNome(null)} titulo="Salvar dieta">
        <Campo label="Nome da dieta" hint="Ex: bulking, cutting, dia de treino.">
          <Input value={salvarNome ?? ''} onChange={e => setSalvarNome(e.target.value)}
            placeholder="Minha dieta" autoFocus />
        </Campo>
        <p className="text-[11.5px] text-muted mb-4 leading-relaxed">
          Guarda as {planos.length} refeições do plano atual do jeito que estão. Depois e
          só tocar nela pra voltar a usar esse cardápio.
        </p>
        <Btn variant="primary" size="lg" className="w-full"
          onClick={() => salvarDieta(salvarNome ?? '')}>Salvar dieta</Btn>
      </Sheet>

      <Sheet aberto={!!config} fechar={() => setConfig(null)} titulo={config?.nome}>
        {config && (
          <>
            <Campo label="Nome">
              <Input defaultValue={config.nome}
                onBlur={e => db.planos.update(config.id, { nome: e.target.value.trim() || config.nome })} />
            </Campo>
            <Campo label="Horário">
              <Input type="time" defaultValue={config.horario}
                onBlur={e => db.planos.update(config.id, { horario: e.target.value })} />
            </Campo>
            <p className="text-[11.5px] text-muted mb-4 leading-relaxed">
              Renomear a refeição não muda o que já foi registrado no diário com o nome antigo.
            </p>
            <Btn variant="danger" className="w-full" onClick={() => { setApagarRef(config.id); setConfig(null) }}>
              Apagar refeição
            </Btn>
          </>
        )}
      </Sheet>

      <Confirmar aberto={alinhar} titulo="Ajustar as metas?"
        texto={`Proteína ${n0(totalPlano.prot)} g, carboidrato ${n0(totalPlano.carb)} g e gordura ${n0(totalPlano.gord)} g passam a ser as suas metas diarias. As calorias não mudam.`}
        onNao={() => setAlinhar(false)} onSim={alinharMetas} />

      <Confirmar aberto={gerar} titulo="Gerar o cardápio?"
        texto="As refeições atuais do plano sao substituidas por um cardápio novo, calculado nas suas metas. O que já foi registrado no diário não muda."
        onNao={() => setGerar(false)} onSim={gerarAutomatico} />

      <Confirmar aberto={!!carregar} titulo={`Usar "${carregar?.nome}"?`}
        texto="As refeições do plano atual sao substituidas pelas dessa dieta. O diário já registrado não muda."
        onNao={() => setCarregar(null)}
        onSim={() => carregar && carregarDieta(carregar)} />

      <Confirmar aberto={!!sobrescrever} titulo={`Atualizar "${sobrescrever?.nome}"?`}
        texto="A dieta salva passa a guardar as refeições do plano atual."
        onNao={() => setSobrescrever(null)}
        onSim={() => sobrescrever && atualizarDieta(sobrescrever)} />

      <Confirmar aberto={!!apagarDieta} perigo titulo="Apagar essa dieta?"
        texto="So a dieta salva se perde. O plano que está em uso continua."
        onNao={() => setApagarDieta(null)}
        onSim={async () => {
          if (apagarDieta) await apagarLinha('dietas', apagarDieta.id)
          setApagarDieta(null)
          toast('Dieta apagada', 'ok')
        }} />

      <Confirmar aberto={!!apagarRef} perigo titulo="Apagar refeição?"
        texto="O cardápio dela se perde. O diário já registrado continua."
        onNao={() => setApagarRef(null)}
        onSim={async () => { await apagarLinha('planos', apagarRef!); setApagarRef(null) }} />
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

/** Selo discreto quando um item do plano bate numa restricao do perfil. */
function AvisoRestricao({ alimentoId, evitar }: { alimentoId: string; evitar: Marcador[] }) {
  const bate = conflitos(alimentoId, evitar)
  if (!bate.length) return null
  return (
    <p className="text-[10.5px] font-semibold text-warn mt-1 flex items-center gap-1">
      <Icone nome="alerta" tamanho={11} />
      {textoConflito(bate)}
    </p>
  )
}
