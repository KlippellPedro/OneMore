import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePerfil, useMapaAlimentos, usePlanos, useAlimentos } from '../state/hooks'
import { totalDoPlano } from '../lib/nutricao'
import { listaDeCompras, pesoCompra } from '../lib/compras'
import { n0, pl } from '../lib/format'

const DIAS = [1, 3, 7, 15, 30]

export default function ListaCompras() {
  const perfil = usePerfil()
  const mapa = useMapaAlimentos()
  const planos = usePlanos()
  const todos = useAlimentos()

  const [dias, setDias] = useState(7)
  const [jaTenho, setJaTenho] = useState<Set<string>>(new Set())

  const grupos = useMemo(
    () => listaDeCompras(planos, mapa, todos, dias, { priorizarCarbo: perfil.diabetesTipo1 === true }),
    [planos, mapa, todos, dias, perfil.diabetesTipo1],
  )

  const totalDia = totalDoPlano(planos.flatMap(p => p.itens), mapa)
  const quantos = grupos.reduce((t, g) => t + g.itens.length, 0)
  const geradoEm = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  function alternar(id: string) {
    setJaTenho(s => {
      const novo = new Set(s)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  return (
    <div className="bg-white text-gray-900 min-h-screen font-sans">
      <div className="max-w-[800px] mx-auto p-8">
        <div className="print:hidden flex justify-between items-center mb-6">
          <Link to="/dieta" className="text-sm text-gray-500">‹ Voltar pro app</Link>
          <button onClick={() => window.print()}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-bold">
            Baixar PDF
          </button>
        </div>

        <header className="mb-6 border-b-2 border-gray-900 pb-4">
          <h1 className="text-2xl font-black">Lista de compras</h1>
          <p className="text-sm text-gray-500 mt-1">
            {perfil.nome} · cardápio de {pl(dias, 'dia')} · gerado em {geradoEm}
          </p>
        </header>

        {/* -------- controles: so na tela, nao no papel -------- */}
        <div className="print:hidden mb-6">
          <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-2">
            Comprar para quantos dias
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {DIAS.map(d => (
              <button key={d} onClick={() => setDias(d)}
                className={`h-9 px-3.5 rounded-full text-[13px] font-semibold border transition-colors ${
                  dias === d
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'bg-white border-gray-300 text-gray-600'
                }`}>
                {d === 1 ? '1 dia' : `${d} dias`}
              </button>
            ))}
          </div>
          {quantos > 0 && (
            <p className="text-[12px] text-gray-500 mt-3 leading-relaxed">
              Toque num item pra marcar o que você <strong>já tem em casa</strong> - ele sai riscado
              no PDF. As quantidades saem do seu plano alimentar
              ({n0(totalDia.kcal)} kcal e {n0(totalDia.carb)} g de carbo por dia).
            </p>
          )}
        </div>

        {quantos === 0 ? (
          <p className="text-gray-500 text-[13px] leading-relaxed">
            Seu plano alimentar está vazio, entao não ha o que comprar ainda.
            Monte o cardápio em Dieta {'>'} Plano e volte aqui.
          </p>
        ) : (
          <>
            <p className="text-[13px] text-gray-500 mb-5">
              {pl(quantos, 'item', 'itens')} · {pl(dias, 'dia')} de cardápio
            </p>

            <div className="space-y-6">
              {grupos.map(g => (
                <section key={g.categoria} style={{ breakInside: 'avoid' }}>
                  <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-300 pb-1.5 mb-2">
                    {g.categoria}
                  </h2>
                  <ul>
                    {g.itens.map(i => {
                      const tem = jaTenho.has(i.alimento.id)
                      return (
                        <li key={i.alimento.id} className="border-b border-gray-100 last:border-0"
                          style={{ breakInside: 'avoid' }}>
                          <button onClick={() => alternar(i.alimento.id)}
                            className={`w-full flex items-start gap-2.5 py-2 text-left ${tem ? 'text-gray-400' : ''}`}>
                            <span className="mt-[3px] w-3.5 h-3.5 shrink-0 rounded-[3px] border border-gray-400 flex items-center justify-center text-[10px] leading-none">
                              {tem ? '✓' : ''}
                            </span>

                            <span className="flex-1 min-w-0">
                              <span className="flex items-baseline justify-between gap-3">
                                <span className={`text-[13.5px] font-semibold ${tem ? 'line-through' : ''}`}>
                                  {i.alimento.nome}
                                </span>
                                <span className="text-[13.5px] font-bold tabular-nums whitespace-nowrap">
                                  {pesoCompra(i.gramasTotal, i.alimento.unidadeBase)}
                                  {i.unidades !== null && i.unidades <= 200 && (
                                    <span className="font-medium text-gray-500"> ({i.unidades} un)</span>
                                  )}
                                </span>
                              </span>

                              <span className="block text-[11px] text-gray-500 mt-0.5">
                                {pesoCompra(i.gramasDia, i.alimento.unidadeBase)} por dia · {i.refeicoes.join(', ')}
                              </span>

                              {i.trocas.length > 0 && (
                                <span className="block text-[11px] text-gray-400 mt-0.5 leading-snug">
                                  Se não tiver:{' '}
                                  {i.trocas.map((t, k) => (
                                    <span key={t.alimento.id}>
                                      {k > 0 && ' · '}
                                      {t.nome} ({pesoCompra(t.gramas, t.alimento.unidadeBase)})
                                    </span>
                                  ))}
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}

        <footer className="mt-10 pt-4 border-t border-gray-200 text-[10.5px] text-gray-400 leading-relaxed">
          Gerado pelo OneMore em {geradoEm}. As quantidades sao as do alimento do jeito que
          voce lanca no app - alimento cozido pesa cozido, entao compre o cru com folga
          (arroz e feijao rendem cerca de 2,5x o peso seco). As trocas entregam o mesmo tanto
          do macro principal de cada item, com caloria parecida.
        </footer>
      </div>
    </div>
  )
}
