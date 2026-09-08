import { useMemo, useState } from 'react'
import { useAlimentos } from '../state/hooks'
import {
  equivalentes, noMacro, ROTULO_CHAVE, UNIDADE_CHAVE, type Substituto,
} from '../lib/substituicoes'
import { Sheet, Chip, Card } from './ui'
import { n0, n1, nq } from '../lib/format'
import type { Alimento } from '../db/types'

/** O que esta na mesa e vai ser trocado. */
export interface AlvoTroca {
  alimento: Alimento
  qtd: number
  medida: string
  gramas: number
}

/**
 * Lista o que da pra comer no lugar de um alimento, com a porcao ja ajustada
 * pra entregar o mesmo tanto do macro que importa.
 */
export function SheetSubstituir({ alvo, fechar, onEscolher, onManter, manterTexto = 'Comi esse mesmo', priorizarCarbo, acaoTexto = 'Toque pra trocar' }: {
  alvo: AlvoTroca | null
  fechar: () => void
  onEscolher: (s: Substituto) => void
  /** Quando existe, a sheet tambem deixa lancar o alimento original do jeito que esta. */
  onManter?: () => void
  manterTexto?: string
  priorizarCarbo?: boolean
  acaoTexto?: string
}) {
  const todos = useAlimentos()
  const [ampliar, setAmpliar] = useState(false)

  const eq = useMemo(
    () => (alvo ? equivalentes(alvo.alimento, alvo.gramas, todos, { priorizarCarbo, ampliar }) : null),
    [alvo, todos, ampliar, priorizarCarbo],
  )

  if (!alvo || !eq) return null

  const emGramas = alvo.medida === 'g' || alvo.medida === 'ml'

  return (
    <Sheet aberto fechar={fechar} titulo="Comer no lugar" alto>
      <Card className="p-3.5 mb-3">
        <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted mb-1">
          No lugar de
        </p>
        <p className="text-[14px] font-bold leading-tight">{alvo.alimento.nome}</p>
        <p className="text-[11.5px] text-muted mt-1">
          {nq(alvo.qtd)} {alvo.medida}{emGramas ? '' : ` (${n0(alvo.gramas)} g)`}
          {' · '}{n0(eq.original.carb)} g carbo · {n0(eq.original.kcal)} kcal
        </p>
        {onManter && (
          <button onClick={onManter}
            className="w-full mt-3 h-9 rounded-xl bg-surface-2 border border-line text-[12.5px] font-semibold text-muted active:bg-line">
            {manterTexto}
          </button>
        )}
      </Card>

      {eq.alvo > 0 && (
        <p className="text-[11.5px] text-muted leading-relaxed mb-3">
          Porcoes ajustadas pra bater o mesmo tanto de {ROTULO_CHAVE[eq.chave]} da porcao
          acima -{' '}
          <span className="text-txt font-semibold">
            {eq.chave === 'kcal' ? n0(eq.alvo) : n1(eq.alvo)} {UNIDADE_CHAVE[eq.chave]}
          </span>.{' '}
          A caloria e os outros macros mudam um pouco: a lista comeca pelo que muda menos.
        </p>
      )}

      <div className="flex gap-1.5 mb-3">
        <Chip ativo={!ampliar} onClick={() => setAmpliar(false)}>Parecidos</Chip>
        <Chip ativo={ampliar} onClick={() => setAmpliar(true)}>Qualquer alimento</Chip>
      </div>

      {eq.lista.length === 0 ? (
        <p className="text-center text-[12.5px] text-muted py-10 leading-relaxed">
          {eq.alvo <= 0
            ? 'Esse alimento nao tem macro suficiente pra calcular uma troca.'
            : ampliar
              ? 'Nao achei nada equivalente. Cadastre mais alimentos em Perfil > Alimentos.'
              : 'Nada parecido na mesma categoria. Tente "Qualquer alimento".'}
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            {eq.lista.map(s => (
              <LinhaSubstituto key={s.alimento.id} s={s} chave={eq.chave}
                onClick={() => onEscolher(s)} />
            ))}
          </div>
          <p className="text-[11px] text-muted/80 text-center mt-3">{acaoTexto}</p>
        </>
      )}
    </Sheet>
  )
}

function LinhaSubstituto({ s, chave, onClick }: {
  s: Substituto; chave: Parameters<typeof noMacro>[1]; onClick: () => void
}) {
  const emGramas = s.medida === 'g' || s.medida === 'ml'
  // trocando quantidade por quantidade a grama ja aparece a esquerda: mostra a caloria
  const exibida = chave === 'peso' ? 'kcal' : chave
  const destaque = noMacro(s.macros, exibida)
  const delta = Math.round(s.difKcal)

  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface border border-line/60 text-left active:bg-surface-2">
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold truncate">{s.alimento.nome}</p>
        <p className="text-[11px] text-muted truncate">
          {nq(s.qtd)} {s.medida}{emGramas ? '' : ` (${n0(s.gramas)} g)`}
          {!s.mesmaFamilia && <span className="text-muted/70"> · {s.alimento.categoria}</span>}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[12.5px] font-bold text-accent tabular-nums">
          {n0(destaque)} <span className="text-[10px] font-semibold">{UNIDADE_CHAVE[exibida]}</span>
        </p>
        <p className="text-[10px] tabular-nums text-muted">
          {exibida === 'kcal' ? `${n0(s.macros.carb)} g carbo` : `${n0(s.macros.kcal)} kcal`}
          {exibida !== 'kcal' && Math.abs(delta) >= 15 && (
            <span className={delta > 0 ? 'text-warn' : 'text-good'}>
              {' '}{delta > 0 ? '+' : '−'}{n0(Math.abs(delta))}
            </span>
          )}
        </p>
      </div>
    </button>
  )
}
