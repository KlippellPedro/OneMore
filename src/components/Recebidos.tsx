import { useEffect, useMemo, useState } from 'react'
import { Card, Btn, Sheet, Confirmar } from './ui'
import { Icone } from './Icone'
import { useUI, vibrar } from '../state/ui'
import { useMapaExercicios, useMapaAlimentos } from '../state/hooks'
import { ultimoSync } from '../lib/sync'
import {
  listarRecebidos, resolverEnvio, adicionarTreinoRecebido, guardarTreinoRecebido, usarTreinoDoTreinador,
  usarDietaRecebida, guardarDietaRecebida, type Envio, type TipoEnvio,
} from '../lib/envios'
import { lerPacoteTreino, lerPacoteDieta } from '../lib/pacotes'
import { haQuanto } from '../lib/cartao'
import { macrosDe, somaMacros, ZERO } from '../lib/nutricao'
import { diaCurto, n0, pl } from '../lib/format'

/**
 * Treinos (ou dietas) que mandaram pra pessoa e ela ainda nao decidiu. Some
 * sozinho quando a caixa esta vazia ou quando nao ha conta - quem nao usa
 * amigos nem treinador nao ve nada disto.
 *
 * Nenhuma das acoes apaga o que a pessoa tem: adicionar cria copias, guardar
 * vai pras salvas, e usar o do treinador guarda a semana (ou o cardapio) de
 * antes como copia automatica.
 */
export function Recebidos({ tipo }: { tipo: TipoEnvio }) {
  const { toast } = useUI()
  const [envios, setEnvios] = useState<Envio[]>([])
  const [aberto, setAberto] = useState<Envio | null>(null)
  const [recusar, setRecusar] = useState<Envio | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    // sem nunca ter sincronizado aqui nao ha conta: seria so um 401 a cada visita
    if (!ultimoSync()) return
    let vivo = true
    listarRecebidos().then(l => { if (vivo) setEnvios(l.filter(e => e.tipo === tipo)) }).catch(() => {})
    return () => { vivo = false }
  }, [tipo])

  async function concluir(e: Envio, fazer: () => Promise<string>) {
    if (ocupado) return
    setOcupado(true)
    try {
      const msg = await fazer()
      await resolverEnvio(e.id).catch(() => {})
      setEnvios(l => l.filter(x => x.id !== e.id))
      setAberto(null)
      vibrar(20)
      toast(msg, 'ok')
    } catch (err) {
      toast('Não deu certo', 'erro', (err as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  async function confirmarRecusa() {
    const e = recusar
    setRecusar(null)
    if (!e) return
    await resolverEnvio(e.id).catch(() => {})
    setEnvios(l => l.filter(x => x.id !== e.id))
    setAberto(null)
    toast('Recusado', 'ok')
  }

  if (!envios.length) return null

  return (
    <section className="mb-5">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2 px-1">
        {tipo === 'treino' ? 'Treinos recebidos' : 'Dietas recebidas'}
      </h2>
      <div className="space-y-2">
        {envios.map(e => (
          <Card key={e.id} onClick={() => setAberto(e)} destaque={e.origem === 'treinador'} className="p-3.5">
            <div className="flex items-center gap-3">
              <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${
                e.origem === 'treinador' ? 'grad-accent text-white' : 'bg-accent/12 text-accent'}`}>
                <Icone nome={e.origem === 'treinador' ? 'prancheta' : 'pessoa'} tamanho={19} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold truncate">{e.nome}</p>
                <p className="text-[11.5px] text-muted truncate">
                  {e.origem === 'treinador' ? `Do seu treinador, ${e.de.nome}` : `De ${e.de.nome}`}
                  {' - '}{haQuanto(new Date(e.criadoEm).getTime())}
                </p>
              </div>
              <span className="text-accent text-[12.5px] font-bold shrink-0">Ver</span>
            </div>
          </Card>
        ))}
      </div>

      <Sheet aberto={!!aberto} fechar={() => setAberto(null)} titulo={aberto?.nome}>
        {aberto && (aberto.tipo === 'treino'
          ? <DetalheTreino envio={aberto} ocupado={ocupado} recusar={() => setRecusar(aberto)}
              adicionar={() => concluir(aberto, async () => {
                const novas = await adicionarTreinoRecebido(aberto.conteudo)
                return `${pl(novas.length, 'treino')} na sua lista`
              })}
              guardar={() => concluir(aberto, async () => {
                await guardarTreinoRecebido(aberto.conteudo, `${aberto.nome} (de ${aberto.de.nome})`, aberto.origem === 'treinador')
                return 'Guardado em Semanas salvas'
              })}
              usar={() => concluir(aberto, async () => {
                await usarTreinoDoTreinador(aberto.conteudo, aberto.nome)
                return 'Treino do seu treinador em uso. O de antes ficou em Semanas salvas'
              })} />
          : <DetalheDieta envio={aberto} ocupado={ocupado} recusar={() => setRecusar(aberto)}
              usar={() => concluir(aberto, async () => {
                await usarDietaRecebida(aberto.conteudo, aberto.de.nome)
                return 'Dieta em uso. A de antes ficou nas dietas salvas'
              })}
              guardar={() => concluir(aberto, async () => {
                await guardarDietaRecebida(aberto.conteudo, `${aberto.nome} (de ${aberto.de.nome})`)
                return 'Guardada nas dietas salvas'
              })} />)}
      </Sheet>

      <Confirmar aberto={!!recusar} titulo="Recusar?"
        texto={recusar?.origem === 'treinador'
          ? 'Some da sua caixa. Seu treinador pode mandar de novo quando quiser.'
          : 'Some da sua caixa. Nada muda nos seus treinos.'}
        onNao={() => setRecusar(null)} onSim={confirmarRecusa} />
    </section>
  )
}

/* ------------------------------------------------------------------ */

function DetalheTreino({ envio, ocupado, adicionar, guardar, usar, recusar }: {
  envio: Envio; ocupado: boolean
  adicionar: () => void; guardar: () => void; usar: () => void; recusar: () => void
}) {
  const mapa = useMapaExercicios()
  const lida = useMemo(() => {
    try { return lerPacoteTreino(envio.conteudo) } catch { return null }
  }, [envio])
  if (!lida) {
    return (
      <>
        <p className="text-[13px] text-muted mb-4">Esse treino veio estragado e não dá pra abrir.</p>
        <Btn className="w-full" onClick={recusar}>Tirar da caixa</Btn>
      </>
    )
  }
  const doPacote = new Map(lida.exercicios.map(e => [e.id, e]))
  const nome = (id: string) => mapa.get(id)?.nome ?? doPacote.get(id)?.nome ?? 'Exercício'
  const doTreinador = envio.origem === 'treinador'

  return (
    <>
      <p className="text-[12px] text-muted mb-3 -mt-1">
        {doTreinador ? `Montado pelo seu treinador, ${envio.de.nome}` : `Mandado por ${envio.de.nome}`}
        {' - '}{pl(lida.rotinas.length, 'treino')}
      </p>
      <div className="space-y-2 mb-4">
        {lida.rotinas.map(r => (
          <Card key={r.id} className="p-3.5">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-1 h-5 rounded-full shrink-0" style={{ background: r.cor }} />
              <p className="text-[14px] font-bold flex-1 truncate">{r.nome}</p>
              {r.dias?.length ? <span className="text-[11px] text-muted shrink-0">{r.dias.map(diaCurto).join(', ')}</span> : null}
            </div>
            <ul className="text-[12px] text-muted space-y-0.5">
              {r.itens.map(i => (
                <li key={i.exercicioId} className="flex gap-2">
                  <span className="flex-1 truncate text-txt/85">{nome(i.exercicioId)}</span>
                  <span className="shrink-0">{i.series}x {i.repsAlvo}{i.cargaAlvo ? ` - ${i.cargaAlvo} kg` : ''}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {doTreinador ? (
        <>
          <Btn variant="primary" size="lg" className="w-full mb-2" onClick={usar} disabled={ocupado}>Usar agora</Btn>
          <p className="text-[11.5px] text-muted leading-relaxed mb-3 px-1">
            Vira a sua semana de treino. A semana de agora fica guardada em Semanas salvas e volta com um toque.
          </p>
        </>
      ) : (
        <>
          <Btn variant="primary" size="lg" className="w-full mb-2" onClick={adicionar} disabled={ocupado}>
            Adicionar aos meus treinos
          </Btn>
          <p className="text-[11.5px] text-muted leading-relaxed mb-3 px-1">
            Entra como cópia, do lado dos seus. Mude o que quiser, que o de quem mandou não muda.
          </p>
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Btn onClick={guardar} disabled={ocupado}>Só guardar</Btn>
        <Btn variant="ghost" onClick={recusar} disabled={ocupado}>Recusar</Btn>
      </div>
    </>
  )
}

function DetalheDieta({ envio, ocupado, usar, guardar, recusar }: {
  envio: Envio; ocupado: boolean; usar: () => void; guardar: () => void; recusar: () => void
}) {
  const mapa = useMapaAlimentos()
  const lida = useMemo(() => {
    try { return lerPacoteDieta(envio.conteudo) } catch { return null }
  }, [envio])
  if (!lida) {
    return (
      <>
        <p className="text-[13px] text-muted mb-4">Essa dieta veio estragada e não dá pra abrir.</p>
        <Btn className="w-full" onClick={recusar}>Tirar da caixa</Btn>
      </>
    )
  }
  const doPacote = new Map(lida.alimentos.map(a => [a.id, a]))
  const alimento = (id: string) => mapa.get(id) ?? doPacote.get(id)
  const macrosDaRefeicao = (itens: { alimentoId: string; gramas: number }[]) =>
    somaMacros(...itens.map(i => { const a = alimento(i.alimentoId); return a ? macrosDe(a, i.gramas) : ZERO }))
  const total = somaMacros(...lida.refeicoes.map(r => macrosDaRefeicao(r.itens)))

  return (
    <>
      <p className="text-[12px] text-muted mb-3 -mt-1">
        {envio.origem === 'treinador' ? `Montada pelo seu treinador, ${envio.de.nome}` : `Mandada por ${envio.de.nome}`}
        {' - '}{n0(total.kcal)} kcal - P {n0(total.prot)} C {n0(total.carb)} G {n0(total.gord)}
      </p>
      <div className="space-y-2 mb-4">
        {lida.refeicoes.map(r => (
          <Card key={r.ordem} className="p-3.5">
            <div className="flex items-baseline gap-2 mb-1">
              <p className="text-[14px] font-bold flex-1 truncate">{r.nome}</p>
              <span className="text-[11px] text-muted shrink-0">{r.horario} - {n0(macrosDaRefeicao(r.itens).kcal)} kcal</span>
            </div>
            <ul className="text-[12px] text-muted space-y-0.5">
              {r.itens.map((i, k) => (
                <li key={k} className="flex gap-2">
                  <span className="flex-1 truncate text-txt/85">{alimento(i.alimentoId)?.nome ?? 'Alimento'}</span>
                  <span className="shrink-0">{n0(i.gramas)} g</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Btn variant="primary" size="lg" className="w-full mb-2" onClick={usar} disabled={ocupado}>Usar esta dieta</Btn>
      <p className="text-[11.5px] text-muted leading-relaxed mb-3 px-1">
        Vira o seu plano alimentar. O de agora fica nas dietas salvas e volta com um toque.
        {lida.metas ? ` Suas metas passam a ser ${n0(lida.metas.kcal)} kcal, P ${lida.metas.prot} C ${lida.metas.carb} G ${lida.metas.gord}.` : ''}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Btn onClick={guardar} disabled={ocupado}>Só guardar</Btn>
        <Btn variant="ghost" onClick={recusar} disabled={ocupado}>Recusar</Btn>
      </div>
    </>
  )
}
