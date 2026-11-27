import { Card } from './ui'
import { Icone } from './Icone'
import { useUI } from '../state/ui'
import { resumoSemanal, textoDaSemana } from '../lib/resumo'
import { compartilharTexto } from '../lib/arquivo'
import { n0, peso, diaCurto } from '../lib/format'
import type { EventoXP, Sessao } from '../db/types'

/**
 * A semana ate agora contra o mesmo trecho da semana passada - treino e dieta
 * lado a lado, com a seta de subiu/caiu. E o "como estou indo" que o resto da
 * tela responde so olhando grafico.
 */
export function ResumoSemana({ sessoes, eventos, hoje, nivel }: {
  sessoes: Sessao[]
  eventos: EventoXP[]
  hoje: string
  nivel?: { nivel: number; rank: string }
}) {
  const { toast } = useUI()
  const r = resumoSemanal(sessoes, eventos, hoje)
  const de = r.dias === 1 ? 'Só segunda até agora' : `Seg a ${diaCurto(r.dias % 7).toLowerCase()}`

  const itens = [
    { rotulo: 'Treinos', atual: r.atual.treinos, antes: r.anterior.treinos, fmt: n0 },
    { rotulo: 'Séries', atual: r.atual.series, antes: r.anterior.series, fmt: n0 },
    { rotulo: 'Volume', atual: r.atual.volume, antes: r.anterior.volume, fmt: peso },
    { rotulo: 'Dieta na meta', atual: r.atual.diasDieta, antes: r.anterior.diasDieta, fmt: n0, dias: true },
    { rotulo: 'Proteína', atual: r.atual.diasProteina, antes: r.anterior.diasProteina, fmt: n0, dias: true },
    { rotulo: 'Água', atual: r.atual.diasAgua, antes: r.anterior.diasAgua, fmt: n0, dias: true },
  ]

  async function compartilhar() {
    const res = await compartilharTexto('Minha semana', textoDaSemana(r, nivel))
    if (res === 'copiado') toast('Semana copiada', 'ok', 'Cole no WhatsApp ou onde quiser')
    else if (res === 'falhou') toast('Não deu pra compartilhar daqui', 'erro')
  }

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted">Esta semana</h2>
          <p className="text-[11px] text-muted/80 mt-0.5">{de}, contra o mesmo trecho da passada</p>
        </div>
        <button onClick={compartilhar} aria-label="Compartilhar a semana"
          className="toque w-9 h-9 -mt-1.5 -mr-1.5 shrink-0 rounded-xl flex items-center justify-center text-muted active:bg-surface-2 active:text-accent">
          <Icone nome="compartilhar" tamanho={17} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-3.5">
        {itens.map(it => {
          const dif = it.atual - it.antes
          return (
            <div key={it.rotulo} className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted font-semibold truncate">{it.rotulo}</p>
              <p className="text-[17px] font-black tabular-nums leading-tight mt-0.5">
                {it.fmt(it.atual)}
                {it.dias && <span className="text-[11px] font-semibold text-muted">/{r.dias} dias</span>}
              </p>
              <p className={`text-[10.5px] font-semibold tabular-nums ${
                dif > 0 ? 'text-good' : dif < 0 ? 'text-warn' : 'text-muted/70'
              }`}>
                {it.atual === 0 && it.antes === 0 ? '-'
                  : dif === 0 ? 'igual'
                  : `${dif > 0 ? '▲' : '▼'} ${it.fmt(Math.abs(dif))}`}
              </p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
