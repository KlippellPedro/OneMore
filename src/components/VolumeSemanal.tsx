import { useState } from 'react'
import { Card } from './ui'
import { corGrupo, nomeGrupo } from '../db/seedExercicios'
import { seriesPorGrupo, FAIXA_SEMANAL } from '../lib/treino'
import type { Exercicio, Rotina } from '../db/types'

/**
 * Series de cada musculo na semana montada, com a faixa de referencia. E a
 * conta que ninguem faz de cabeca montando treino: o posterior de coxa com 3
 * series na semana inteira, o peito com 28.
 */
export function VolumeSemanal({ rotinas, mapaEx }: { rotinas: Rotina[]; mapaEx: Map<string, Exercicio> }) {
  const [aberto, setAberto] = useState(false)
  const linhas = seriesPorGrupo(rotinas, id => mapaEx.get(id)?.grupo)
  const comTreino = linhas.filter(l => l.series > 0)
  if (!comTreino.length) return null

  const poucos = linhas.filter(l => l.principal && l.series < FAIXA_SEMANAL.min)
  const demais = linhas.filter(l => l.principal && l.series > FAIXA_SEMANAL.max)
  const escala = Math.max(FAIXA_SEMANAL.max + 4, ...linhas.map(l => l.series))
  const pct = (v: number) => `${(v / escala) * 100}%`
  // fechado: so os musculos grandes; aberto: antebraco, abdomen, lombar... tambem
  const visiveis = aberto ? linhas : linhas.filter(l => l.principal)

  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between mb-2.5 px-1">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted">Séries por músculo</h2>
        <span className="text-[11px] text-muted">na semana</span>
      </div>
      <Card className="p-4">
        <p className="text-[12px] text-muted leading-relaxed mb-3.5">
          {poucos.length === 0 && demais.length === 0
            ? 'Todos os músculos grandes estão na faixa de 10 a 20 séries por semana. Semana equilibrada.'
            : [
              poucos.length ? `${poucos.map(l => nomeGrupo(l.grupo)).join(', ')} com menos de ${FAIXA_SEMANAL.min}` : '',
              demais.length ? `${demais.map(l => nomeGrupo(l.grupo)).join(', ')} com mais de ${FAIXA_SEMANAL.max}` : '',
            ].filter(Boolean).join('; ') + '. A faixa de referência pra hipertrofia é 10 a 20 séries por músculo na semana.'}
        </p>

        <div className="space-y-2">
          {visiveis.map(l => {
            const fora = l.principal && (l.series < FAIXA_SEMANAL.min || l.series > FAIXA_SEMANAL.max)
            return (
              <div key={l.grupo} className="flex items-center gap-2.5">
                <span className="w-[78px] shrink-0 text-[12px] font-medium truncate">{nomeGrupo(l.grupo)}</span>
                <div className="relative flex-1 h-2.5 rounded-full bg-surface-2 overflow-hidden">
                  {/* a faixa de 10 a 20, de fundo */}
                  <div className="absolute inset-y-0 bg-good/15"
                    style={{ left: pct(FAIXA_SEMANAL.min), width: pct(FAIXA_SEMANAL.max - FAIXA_SEMANAL.min) }} />
                  <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                    style={{ width: pct(l.series), background: corGrupo(l.grupo) }} />
                </div>
                <span className={`w-7 shrink-0 text-right text-[12.5px] font-bold tabular-nums ${
                  !l.principal ? 'text-muted' : fora ? 'text-warn' : 'text-good'
                }`}>{l.series}</span>
              </div>
            )
          })}
        </div>

        {linhas.length > visiveis.length || aberto ? (
          <button onClick={() => setAberto(a => !a)}
            className="toque mt-3 text-[12px] font-semibold text-accent">
            {aberto ? 'Mostrar menos' : `Ver todos (${linhas.length})`}
          </button>
        ) : null}
      </Card>
    </div>
  )
}
