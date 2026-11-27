import { useEffect, useState } from 'react'
import { Sheet, Chip, Stepper, Btn } from './ui'
import { anilhasPorLado, BARRAS } from '../lib/treino'
import { nq } from '../lib/format'

/** Cores de competicao: e o que a maioria das academias pinta nas anilhas. */
const COR: Record<number, string> = {
  25: '#d64545', 20: '#3f7fd1', 15: '#d9b53f', 10: '#3fa66b', 5: '#e8e8ee', 2.5: '#c25f70', 1.25: '#9aa0ad',
}
/** Altura relativa da anilha no desenho. */
const ALTURA: Record<number, number> = { 25: 100, 20: 100, 15: 90, 10: 78, 5: 62, 2.5: 50, 1.25: 42 }

const CHAVE_BARRA = 'onemore:barra'

function barraSalva(): number {
  const v = Number(localStorage.getItem(CHAVE_BARRA))
  return BARRAS.includes(v) ? v : 20
}

/**
 * Quais anilhas por na barra pra chegar numa carga. A carga e a TOTAL, com a
 * barra - do jeito que o app registra a serie. Abre com a carga da proxima
 * serie, e da pra mexer ali mesmo pra usar como calculadora solta.
 */
export function CalculadoraAnilhas({ aberto, fechar, carga, onUsar }: {
  aberto: boolean
  fechar: () => void
  carga: number
  /** Quando vem, aparece "Usar X kg" - grava a carga ajustada nas series que faltam. */
  onUsar?: (carga: number) => void
}) {
  const [total, setTotal] = useState(carga)
  const [barra, setBarra] = useState(barraSalva)

  useEffect(() => { if (aberto) setTotal(carga > 0 ? carga : barraSalva()) }, [aberto, carga])

  const m = anilhasPorLado(total, barra)
  const escolherBarra = (b: number) => { setBarra(b); localStorage.setItem(CHAVE_BARRA, String(b)) }

  return (
    <Sheet aberto={aberto} fechar={fechar} titulo="Anilhas na barra">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted">Carga total</p>
          <p className="text-[11px] text-muted/80">com a barra</p>
        </div>
        <Stepper valor={total} setValor={setTotal} passo={2.5} max={500} sufixo="kg" />
      </div>

      <div className="flex items-center gap-2 mb-5">
        <span className="text-[11.5px] text-muted mr-1">Barra</span>
        {BARRAS.map(b => (
          <Chip key={b} ativo={barra === b} onClick={() => escolherBarra(b)}>{b} kg</Chip>
        ))}
      </div>

      {/* -------- desenho: um lado da barra, anilha maior encostada no batente -------- */}
      <div className="rounded-2xl bg-bg-soft border border-line px-3 py-5 mb-4" aria-hidden>
        <div className="relative h-24 flex items-center">
          <div className="absolute left-0 right-0 h-2.5 rounded-full bg-[#6b6f7a]" />
          <div className="relative w-3 h-10 rounded-sm bg-[#8a8f9b] shrink-0 ml-2" />
          <div className="relative flex items-center gap-[3px] ml-[3px]">
            {m.lado.map((a, i) => (
              <div key={i} className="rounded-[4px] anim-pop shadow-md flex items-center justify-center"
                style={{
                  width: a >= 15 ? 22 : a >= 5 ? 16 : 11,
                  height: `${ALTURA[a] ?? 50}px`,
                  maxHeight: 96,
                  background: COR[a] ?? '#9aa0ad',
                  animationDelay: `${i * 40}ms`,
                }} />
            ))}
          </div>
        </div>
      </div>

      {m.abaixoDaBarra ? (
        <p className="text-[13px] text-warn mb-4">Essa carga é menor que a barra sozinha ({barra} kg).</p>
      ) : m.lado.length === 0 ? (
        <p className="text-[13px] text-muted mb-4">Só a barra, sem anilha.</p>
      ) : (
        <div className="mb-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted mb-2">Em cada lado</p>
          <div className="flex flex-wrap gap-1.5">
            {m.lado.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-surface-2 text-[13px] font-bold tabular-nums">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: COR[a] }} />
                {nq(a)}
              </span>
            ))}
          </div>
          {m.sobra > 0 && (
            <p className="text-[12px] text-warn mt-2.5">
              Sobram {nq(m.sobra)} kg que as anilhas comuns não fecham - ficou em {nq(total - m.sobra)} kg.
            </p>
          )}
        </div>
      )}

      {onUsar && total !== carga && (
        <Btn variant="primary" className="w-full" onClick={() => { onUsar(total); fechar() }}>
          Usar {nq(total)} kg nas séries que faltam
        </Btn>
      )}
    </Sheet>
  )
}
