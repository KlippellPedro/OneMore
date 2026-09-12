import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, hoje, diaMais } from '../db'
import { useUI } from '../state/ui'
import { removerGlicemia, estatisticasGlicemia, classificarGlicemia, FAIXA_ALVO } from '../lib/acoes'
import { SheetGlicemia, LinhaGlicemia, nomeMomento } from '../components/Glicemia'
import { Grafico } from '../components/Grafico'
import { Titulo } from '../components/Cabecalho'
import { Card, Btn, Chip, Vazio, Confirmar } from '../components/ui'
import { n0, pl, dataCurta, dataNumerica } from '../lib/format'
import type { RegistroGlicemia } from '../db/types'

const PERIODOS = [
  { dias: 7, rotulo: '7 dias' },
  { dias: 14, rotulo: '14 dias' },
  { dias: 30, rotulo: '30 dias' },
  { dias: 90, rotulo: '90 dias' },
  { dias: 0, rotulo: 'Tudo' },
]

export default function Diario() {
  const { toast } = useUI()
  const [periodo, setPeriodo] = useState(14)
  const [novaGlicemia, setNovaGlicemia] = useState(false)
  const [apagar, setApagar] = useState<string | null>(null)

  const todos = useLiveQuery(() => db.glicemia.orderBy('ts').reverse().toArray(), [], []) ?? []

  const registros = useMemo(() => {
    if (!periodo) return todos
    const limite = diaMais(hoje(), -periodo)
    return todos.filter(r => r.data >= limite)
  }, [todos, periodo])

  const stats = useMemo(() => estatisticasGlicemia(registros), [registros])

  const pontos = useMemo(() =>
    [...registros].reverse().map(r => ({ x: dataNumerica(r.data), y: r.valor })),
  [registros])

  const porDia = useMemo(() => {
    const mapa = new Map<string, RegistroGlicemia[]>()
    for (const r of registros) {
      if (!mapa.has(r.data)) mapa.set(r.data, [])
      mapa.get(r.data)!.push(r)
    }
    return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [registros])

  if (!todos.length) {
    return (
      <div>
        <Titulo titulo="Diário de glicemia" sub="Registro e histórico" />
        <div className="px-4">
          <Vazio icone="sangue" titulo="Nenhuma medição ainda"
            texto="Registre a glicemia e o diário monta sozinho: gráfico, tempo no alvo e a tabela pra levar no medico."
            acao={<Btn variant="primary" onClick={() => setNovaGlicemia(true)}>Registrar glicemia</Btn>} />
        </div>
        <SheetGlicemia aberto={novaGlicemia} fechar={() => setNovaGlicemia(false)} />
      </div>
    )
  }

  return (
    <div>
      <Titulo titulo="Diário de glicemia" sub={pl(stats.total, 'medição', 'medições')}
        acao={<Btn size="sm" variant="primary" onClick={() => setNovaGlicemia(true)}>+ Medir</Btn>} />

      <div className="px-4">
        {/* -------- periodo -------- */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto">
          {PERIODOS.map(p => (
            <Chip key={p.dias} ativo={periodo === p.dias} onClick={() => setPeriodo(p.dias)}>{p.rotulo}</Chip>
          ))}
        </div>

        {/* -------- tempo no alvo -------- */}
        <Card className="p-4 mb-3">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted">Tempo no alvo</h2>
          <p className="text-[30px] font-black leading-tight mt-0.5 tabular-nums" style={{ color: 'var(--color-good)' }}>
            {n0(stats.pctAlvo * 100)}%
          </p>
          <p className="text-[11px] text-muted mb-3">
            das medições entre {FAIXA_ALVO.min}-{FAIXA_ALVO.max} mg/dL
          </p>

          <div className="h-3.5 w-full rounded-full overflow-hidden flex bg-surface-2">
            {stats.bandas.map(b => b.pct > 0 && (
              <div key={b.id} style={{ width: `${b.pct * 100}%`, background: b.cor }} title={`${b.rotulo}: ${n0(b.pct * 100)}%`} />
            ))}
          </div>

          <div className="grid grid-cols-5 gap-1 mt-3">
            {stats.bandas.map(b => (
              <div key={b.id} className="text-center">
                <span className="block w-2 h-2 rounded-full mx-auto mb-1" style={{ background: b.cor }} />
                <p className="text-[12.5px] font-black tabular-nums leading-tight">{n0(b.pct * 100)}%</p>
                <p className="text-[9px] text-muted leading-tight mt-0.5">{b.legenda}</p>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted/80 leading-relaxed mt-4">
            % das medicoes registradas, nao % do tempo real (isso exigiria sensor continuo).
            Faixa de referencia geral - a sua e definida pelo seu endocrinologista.
          </p>
        </Card>

        {/* -------- stats rapidos -------- */}
        <div className="grid grid-cols-3 gap-2.5 mb-3">
          <Mini rotulo="Média" valor={n0(stats.media)} sufixo="mg/dL" />
          <Mini rotulo="Variabilidade" valor={`${n0(stats.cv)}%`} sufixo={stats.cv > 36 ? 'alta' : 'estavel'}
            destaque={stats.cv > 36} />
          <Mini rotulo="Faixa" valor={`${n0(stats.minimo)}-${n0(stats.maximo)}`} sufixo="mg/dL" />
        </div>

        {/* -------- evolucao -------- */}
        {pontos.length > 1 && (
          <Card className="p-4 mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">Evolucao</h2>
            <Grafico pontos={pontos} cor="var(--color-accent)" altura={150} />
          </Card>
        )}

        {/* -------- media por momento -------- */}
        {stats.porMomento.length > 1 && (
          <Card className="p-4 mb-3">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-3">Média por momento</h2>
            <div className="space-y-2.5">
              {stats.porMomento.map(m => (
                <div key={m.momento} className="flex items-center gap-3">
                  <span className="text-[12.5px] flex-1 min-w-0 truncate">{nomeMomento(m.momento)}</span>
                  <span className="text-[11px] text-muted shrink-0">{pl(m.count, 'medição', 'medições')}</span>
                  <span className="text-[13px] font-bold tabular-nums w-11 text-right shrink-0"
                    style={{ color: classificarGlicemia(m.media).cor }}>
                    {n0(m.media)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* -------- historico por dia -------- */}
        <div className="flex items-center justify-between mb-2 px-1 mt-5">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted">Histórico por dia</h2>
          <Link to={`/diário/imprimir?dias=${periodo || 90}`} className="toque text-[12px] font-semibold text-accent">
            Exportar PDF ›
          </Link>
        </div>

        <div className="space-y-3 pb-4">
          {porDia.map(([data, regs]) => {
            const mediaDia = regs.reduce((t, r) => t + r.valor, 0) / regs.length
            return (
              <Card key={data} className="overflow-hidden">
                <div className="flex items-center gap-3 px-3.5 py-2.5 border-b border-line/40 bg-surface-2/40">
                  <span className="text-[12.5px] font-bold flex-1">{dataCurta(data)}</span>
                  <span className="text-[11px] text-muted">média</span>
                  <span className="text-[13px] font-black tabular-nums" style={{ color: classificarGlicemia(mediaDia).cor }}>
                    {n0(mediaDia)}
                  </span>
                </div>
                {regs.map(r => <LinhaGlicemia key={r.id} r={r} onClick={() => setApagar(r.id)} />)}
              </Card>
            )
          })}
        </div>
      </div>

      <SheetGlicemia aberto={novaGlicemia} fechar={() => setNovaGlicemia(false)} />

      <Confirmar aberto={!!apagar} perigo titulo="Apagar essa medição?"
        onNao={() => setApagar(null)}
        onSim={async () => {
          if (apagar) await removerGlicemia(apagar)
          setApagar(null)
          toast('Removido', 'ok')
        }} />
    </div>
  )
}

function Mini({ rotulo, valor, sufixo, destaque }: {
  rotulo: string; valor: string; sufixo?: string; destaque?: boolean
}) {
  return (
    <Card className="p-3">
      <p className="text-[9.5px] uppercase tracking-wider text-muted font-semibold mb-1">{rotulo}</p>
      <p className={`text-[15px] font-black tabular-nums ${destaque ? 'text-warn' : ''}`}>{valor}</p>
      {sufixo && <p className="text-[10px] text-muted mt-0.5">{sufixo}</p>}
    </Card>
  )
}
