import { Link } from 'react-router-dom'
import { usePerfil, useMapaAlimentos, usePlanos } from '../state/hooks'
import { totalDoPlano, macrosDe } from '../lib/nutricao'
import { n0, nq } from '../lib/format'

export default function ImprimirDieta() {
  const perfil = usePerfil()
  const mapa = useMapaAlimentos()
  const planos = usePlanos()

  const totalDia = totalDoPlano(planos.flatMap(p => p.itens), mapa)
  const geradoEm = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

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

        <header className="mb-8 border-b-2 border-gray-900 pb-4">
          <h1 className="text-2xl font-black">Plano alimentar</h1>
          <p className="text-sm text-gray-500 mt-1">{perfil.nome} · gerado em {geradoEm}</p>
        </header>

        <section className="grid grid-cols-4 gap-3 mb-8">
          <MetaBox rotulo="Calorias" valor={`${n0(perfil.metaKcal)} kcal`} />
          <MetaBox rotulo="Carboidrato" valor={`${n0(perfil.metaCarb)} g`} />
          <MetaBox rotulo="Proteina" valor={`${n0(perfil.metaProt)} g`} />
          <MetaBox rotulo="Gordura" valor={`${n0(perfil.metaGord)} g`} />
        </section>

        {planos.length === 0 ? (
          <p className="text-gray-500">Nenhum plano alimentar configurado ainda. Monte um em Dieta → Plano.</p>
        ) : (
          <div className="space-y-7">
            {planos.map(p => {
              const m = totalDoPlano(p.itens, mapa)
              return (
                <section key={p.id} style={{ breakInside: 'avoid' }}>
                  <div className="flex items-baseline justify-between border-b border-gray-300 pb-1.5 mb-2">
                    <h2 className="text-[15px] font-bold">{p.nome}</h2>
                    <span className="text-xs text-gray-500">{p.horario}</span>
                  </div>
                  {p.itens.length === 0 ? (
                    <p className="text-[13px] text-gray-400 italic py-2">Sem alimentos definidos.</p>
                  ) : (
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="text-left text-[10.5px] uppercase tracking-wide text-gray-400">
                          <th className="py-1 pr-2 font-semibold">Alimento</th>
                          <th className="py-1 pl-2 font-semibold text-right">Qtd</th>
                          <th className="py-1 pl-2 font-semibold text-right">Carbo</th>
                          <th className="py-1 pl-2 font-semibold text-right">Prot</th>
                          <th className="py-1 pl-2 font-semibold text-right">Gord</th>
                          <th className="py-1 pl-2 font-semibold text-right">Kcal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.itens.map((it, i) => {
                          const a = mapa.get(it.alimentoId)
                          const mm = a ? macrosDe(a, it.gramas) : null
                          return (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="py-1.5 pr-2">{a?.nome ?? 'Alimento removido'}</td>
                              <td className="py-1.5 pl-2 text-right tabular-nums whitespace-nowrap">{nq(it.qtd)} {it.medida}</td>
                              <td className="py-1.5 pl-2 text-right tabular-nums">{mm ? `${n0(mm.carb)}g` : '-'}</td>
                              <td className="py-1.5 pl-2 text-right tabular-nums">{mm ? `${n0(mm.prot)}g` : '-'}</td>
                              <td className="py-1.5 pl-2 text-right tabular-nums">{mm ? `${n0(mm.gord)}g` : '-'}</td>
                              <td className="py-1.5 pl-2 text-right tabular-nums font-semibold">{mm ? n0(mm.kcal) : '-'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-800 font-bold">
                          <td className="py-1.5 pr-2" colSpan={2}>Total da refeicao</td>
                          <td className="py-1.5 pl-2 text-right tabular-nums">{n0(m.carb)}g</td>
                          <td className="py-1.5 pl-2 text-right tabular-nums">{n0(m.prot)}g</td>
                          <td className="py-1.5 pl-2 text-right tabular-nums">{n0(m.gord)}g</td>
                          <td className="py-1.5 pl-2 text-right tabular-nums">{n0(m.kcal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </section>
              )
            })}

            <section className="mt-6 pt-4 border-t-2 border-gray-900" style={{ breakInside: 'avoid' }}>
              <div className="flex justify-between font-black text-[15px]">
                <span>Total do dia</span>
                <span>{n0(totalDia.kcal)} kcal</span>
              </div>
              <div className="flex justify-between text-[12.5px] text-gray-600 mt-1.5">
                <span>Carboidrato {n0(totalDia.carb)} g</span>
                <span>Proteina {n0(totalDia.prot)} g</span>
                <span>Gordura {n0(totalDia.gord)} g</span>
              </div>
            </section>
          </div>
        )}

        <footer className="mt-10 pt-4 border-t border-gray-200 text-[10.5px] text-gray-400">
          Gerado pelo OneMore em {geradoEm}. Plano calculado a partir das metas cadastradas no app -
          confirme com seu nutricionista antes de seguir.
        </footer>
      </div>
    </div>
  )
}

function MetaBox({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="border border-gray-200 rounded-lg py-3 text-center">
      <p className="text-[9.5px] uppercase tracking-wider text-gray-400 font-semibold">{rotulo}</p>
      <p className="text-[17px] font-black mt-0.5">{valor}</p>
    </div>
  )
}
