import { useMemo } from 'react'
import { n0, n1, dataNumerica } from '../lib/format'

export interface Ponto { x: string; y: number }

/**
 * Grafico de linha em SVG puro. Uma serie so, sem eixo X poluido:
 * mostra apenas primeiro e ultimo rotulo, que e o que se le num celular.
 */
export function Grafico({ pontos, cor = 'var(--color-accent)', sufixo = '', altura = 150, minimoZero }: {
  pontos: Ponto[]
  cor?: string
  sufixo?: string
  altura?: number
  /** Forca o eixo Y a comecar no zero (bom pra volume, ruim pra peso corporal). */
  minimoZero?: boolean
}) {
  const W = 320
  const H = altura
  const padY = 18
  const padX = 6

  const { d, area, pts, min, max } = useMemo(() => {
    if (pontos.length < 2) return { d: '', area: '', pts: [], min: 0, max: 0 }
    const ys = pontos.map(p => p.y)
    let min = minimoZero ? 0 : Math.min(...ys)
    let max = Math.max(...ys)
    if (max === min) { max = min + 1; min = Math.max(0, min - 1) }
    const span = max - min
    // respiro de 8% em cima e embaixo pra linha nao encostar na borda
    const lo = min - span * 0.08
    const hi = max + span * 0.08

    const px = (i: number) => padX + (i / (pontos.length - 1)) * (W - padX * 2)
    const py = (v: number) => padY + (1 - (v - lo) / (hi - lo)) * (H - padY * 2)

    const pts = pontos.map((p, i) => ({ x: px(i), y: py(p.y), v: p.y, rot: p.x }))
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    const area = `${d} L${pts[pts.length - 1].x.toFixed(1)} ${H - padY} L${pts[0].x.toFixed(1)} ${H - padY} Z`
    return { d, area, pts, min, max }
  }, [pontos, H, minimoZero])

  if (pontos.length < 2) {
    return (
      <div className="flex items-center justify-center text-[12px] text-muted" style={{ height: altura }}>
        Poucos dados para o grafico ainda.
      </div>
    )
  }

  const fmt = (v: number) => (v >= 100 ? n0(v) : n1(v)) + sufixo
  const gid = `g${Math.round(pontos.length * 977 + max)}`

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height: altura }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity="0.28" />
            <stop offset="100%" stopColor={cor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map(t => (
          <line key={t} x1={padX} x2={W - padX}
            y1={padY + t * (H - padY * 2)} y2={padY + t * (H - padY * 2)}
            stroke="var(--color-line)" strokeWidth="1" strokeDasharray="3 5" opacity="0.55" />
        ))}

        <path d={area} fill={`url(#${gid})`} />
        <path d={d} fill="none" stroke={cor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y}
            r={i === pts.length - 1 ? 4 : 2.5}
            fill={i === pts.length - 1 ? cor : 'var(--color-bg)'}
            stroke={cor} strokeWidth="2" />
        ))}
      </svg>

      <div className="flex items-center justify-between text-[10.5px] text-muted mt-1 px-1 tabular-nums">
        <span>{rotulo(pontos[0].x)}</span>
        <span className="text-txt font-semibold">
          {fmt(min)} → {fmt(max)}
        </span>
        <span>{rotulo(pontos[pontos.length - 1].x)}</span>
      </div>
    </div>
  )
}

function rotulo(x: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(x) ? dataNumerica(x) : x
}

/** Barras verticais simples - usado no volume por semana. */
export function Barras({ dados, cor = 'var(--color-accent)', altura = 120, sufixo = '' }: {
  dados: { rotulo: string; valor: number; destaque?: boolean }[]
  cor?: string
  altura?: number
  sufixo?: string
}) {
  const max = Math.max(1, ...dados.map(d => d.valor))
  const semDados = dados.every(d => d.valor === 0)

  if (semDados) {
    return (
      <div className="flex items-center justify-center text-[12px] text-muted" style={{ height: altura }}>
        Sem dados ainda para esse periodo.
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: altura }}>
        {dados.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col justify-end items-center gap-1 h-full">
            {d.valor > 0 && (
              <span className="text-[9.5px] text-muted tabular-nums">
                {d.valor >= 1000 ? n1(d.valor / 1000) + 'k' : n0(d.valor)}
              </span>
            )}
            <div
              className="w-full rounded-t-md transition-[height] duration-500"
              style={{
                height: `${(d.valor / max) * 100}%`,
                minHeight: d.valor > 0 ? 3 : 2,
                background: d.valor > 0 ? cor : 'var(--color-surface-2)',
                opacity: d.destaque === false ? 0.45 : 1,
              }} />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {dados.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[9.5px] text-muted truncate">{d.rotulo}</span>
        ))}
      </div>
      {sufixo && <p className="text-center text-[10px] text-muted mt-1">{sufixo}</p>}
    </div>
  )
}
