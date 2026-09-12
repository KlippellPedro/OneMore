import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, hoje, diaMais } from '../db'
import { usePerfil } from '../state/hooks'
import { estatisticasGlicemia, FAIXA_ALVO } from '../lib/acoes'
import { nomeMomento } from '../components/Glicemia'
import { n0, dataCurta, horaDe } from '../lib/format'
import type { RegistroGlicemia } from '../db/types'

export default function ImprimirDiario() {
  const [params] = useSearchParams()
  const dias = Number(params.get('dias') ?? 30)
  const perfil = usePerfil()

  const todos = useLiveQuery(() => db.glicemia.orderBy('ts').toArray(), [], []) ?? []
  const limite = diaMais(hoje(), -dias)
  const registros = todos.filter(r => r.data >= limite)
  const stats = estatisticasGlicemia(registros)

  const porDia = (() => {
    const mapa = new Map<string, RegistroGlicemia[]>()
    for (const r of registros) {
      if (!mapa.has(r.data)) mapa.set(r.data, [])
      mapa.get(r.data)!.push(r)
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  })()

  const geradoEm = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="bg-white text-gray-900 min-h-screen font-sans">
      <div className="max-w-[800px] mx-auto p-8">
        <div className="print:hidden flex justify-between items-center mb-6">
          <Link to="/diario" className="text-sm text-gray-500">‹ Voltar pro app</Link>
          <button onClick={() => window.print()}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-bold">
            Baixar PDF
          </button>
        </div>

        <header className="mb-8 border-b-2 border-gray-900 pb-4">
          <h1 className="text-2xl font-black">Diário de glicemia</h1>
          <p className="text-sm text-gray-500 mt-1">
            {perfil.nome} · {registros.length ? `${dataCurta(porDia[0][0])} a ${dataCurta(porDia[porDia.length - 1][0])}` : `últimos ${dias} dias`} · gerado em {geradoEm}
          </p>
        </header>

        {registros.length === 0 ? (
          <p className="text-gray-500">Nenhuma medição registrada nesse período.</p>
        ) : (
          <>
            {/* -------- resumo -------- */}
            <section className="grid grid-cols-4 gap-3 mb-6" style={{ breakInside: 'avoid' }}>
              <MetaBox rotulo="Medições" valor={String(stats.total)} />
              <MetaBox rotulo="Média" valor={`${n0(stats.media)} mg/dL`} />
              <MetaBox rotulo="Tempo no alvo" valor={`${n0(stats.pctAlvo * 100)}%`} />
              <MetaBox rotulo="Variabilidade" valor={`${n0(stats.cv)}%`} />
            </section>

            <section className="mb-8" style={{ breakInside: 'avoid' }}>
              <div className="h-4 w-full rounded-full overflow-hidden flex border border-gray-200">
                {stats.bandas.map(b => b.pct > 0 && (
                  <div key={b.id} style={{ width: `${b.pct * 100}%`, background: corSolida(b.id) }} />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 mt-1.5">
                {stats.bandas.map(b => (
                  <span key={b.id}>{b.rotulo} ({b.legenda}): <strong className="text-gray-800">{n0(b.pct * 100)}%</strong></span>
                ))}
              </div>
              <p className="text-[10.5px] text-gray-400 mt-2 leading-relaxed">
                Faixa de referencia geral {FAIXA_ALVO.min}-{FAIXA_ALVO.max} mg/dL, confirme a sua com o endocrinologista.
                Percentuais sao por medição registrada, não por tempo continuo.
              </p>
            </section>

            {/* -------- tabela diaria -------- */}
            <table className="w-full text-[12.5px] border-collapse">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-wide text-gray-400 border-b-2 border-gray-800">
                  <th className="py-1.5 pr-2">Data</th>
                  <th className="py-1.5 pr-2">Hora</th>
                  <th className="py-1.5 pr-2 text-right">mg/dL</th>
                  <th className="py-1.5 pr-2">Contexto</th>
                  <th className="py-1.5 pr-2 text-right">Insulina</th>
                  <th className="py-1.5 pr-2 text-right">Carbo</th>
                  <th className="py-1.5">Obs</th>
                </tr>
              </thead>
              <tbody>
                {porDia.map(([data, regs]) => regs.map((r, i) => (
                  <tr key={r.id} className="border-b border-gray-100" style={{ breakInside: 'avoid' }}>
                    <td className="py-1.5 pr-2 text-gray-500 whitespace-nowrap">{i === 0 ? dataCurta(data) : ''}</td>
                    <td className="py-1.5 pr-2 tabular-nums whitespace-nowrap">{horaDe(r.ts)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums font-bold">{n0(r.valor)}</td>
                    <td className="py-1.5 pr-2">{nomeMomento(r.momento)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums whitespace-nowrap">
                      {r.insulinaUnidades ? `${r.insulinaUnidades}u ${r.insulinaTipo === 'basal' ? 'basal' : 'rapida'}` : '-'}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{r.carboG ? `${n0(r.carboG)}g` : '-'}</td>
                    <td className="py-1.5 text-gray-500">{r.obs ?? ''}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </>
        )}

        <footer className="mt-10 pt-4 border-t border-gray-200 text-[10.5px] text-gray-400">
          Gerado pelo OneMore em {geradoEm}. O app registra e mostra o histórico - não calcula dose,
          razao carbo/insulina nem avalia se um valor está bom ou ruim. Isso e com o endocrinologista.
        </footer>
      </div>
    </div>
  )
}

/** Cores solidas (sem var CSS) pra garantir que a impressao preserve a cor certa. */
function corSolida(bandaId: string) {
  switch (bandaId) {
    case 'muito-baixa': return '#7f1d1d'
    case 'baixa': return '#ef4444'
    case 'alvo': return '#22c55e'
    case 'alta': return '#f59e0b'
    case 'muito-alta': return '#f97316'
    default: return '#9ca3af'
  }
}

function MetaBox({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="border border-gray-200 rounded-lg py-3 text-center">
      <p className="text-[9.5px] uppercase tracking-wider text-gray-400 font-semibold">{rotulo}</p>
      <p className="text-[17px] font-black mt-0.5">{valor}</p>
    </div>
  )
}
