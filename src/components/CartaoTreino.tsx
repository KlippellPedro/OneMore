import { Card } from './ui'
import { Icone } from './Icone'
import { treinosNaSemana, gradeDeDias, quandoFoi, type Cartao } from '../lib/cartao'
import { calcNivel, rankDoNivel, streakVivo } from '../lib/xp'
import { n0, n1, nq, pl } from '../lib/format'

/**
 * O cartao de treino de alguem: nivel, sequencia, semana, as ultimas 4
 * semanas, os ultimos treinos e as maiores cargas. Usado na tela de Amigos e
 * no painel do treinador - sempre a partir do Cartao (lib/cartao.ts), que e
 * tudo que sai da conta da pessoa pra esses lugares.
 */

export function BotaoRemover({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Desfazer amizade"
      className="toque w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-muted active:bg-surface-2">
      <Icone nome="x" tamanho={16} />
    </button>
  )
}

const INICIAIS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

const volume = (kg: number) => (kg >= 1000 ? `${n1(kg / 1000)} t` : `${n0(kg)} kg`)

export function CartaoTreino({ cartao: c, hoje: hj, atualizado, onRemover, proprio }: {
  cartao: Cartao; hoje: string; atualizado?: string | null; onRemover?: () => void; proprio?: boolean
}) {
  const { nivel } = calcNivel(c.xp)
  const rank = rankDoNivel(nivel)
  const streak = streakVivo({ streak: c.streak, ultimoDiaAtivo: c.ultimoDiaAtivo ?? undefined }, hj)
  const semana = treinosNaSemana(c, hj)
  const grade = gradeDeDias(c, hj)
  const noMes = grade.flat().filter(d => d.treinou).length

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-3.5">
        <div className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center border-2"
          style={{ borderColor: rank.cor, background: rank.cor + '14' }}>
          <span className="text-[19px] font-black" style={{ color: rank.cor }}>{nivel}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold truncate leading-tight">
            {c.nome}{proprio && <span className="text-muted font-medium"> (você)</span>}
          </p>
          <p className="text-[12px] flex items-center gap-1.5" style={{ color: rank.cor }}>
            Rank {rank.nome}
            <span className="font-mono text-[10px] px-1.5 rounded border" style={{ borderColor: rank.cor }}>{rank.letra}</span>
          </p>
        </div>
        <div className={`flex items-center gap-1 text-[13px] font-bold ${streak ? 'text-warn' : 'text-muted'}`}
          title="Dias seguidos de atividade">
          <Icone nome="chama" tamanho={16} />{streak}
        </div>
        {onRemover && <BotaoRemover onClick={onRemover} />}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3.5">
        <Numero rotulo="Esta semana" valor={c.metaSemana ? `${semana}/${c.metaSemana}` : String(semana)} />
        <Numero rotulo="Treinos" valor={n0(c.treinos)} />
        <Numero rotulo="Recordes" valor={n0(c.prs)} />
      </div>

      <div className="mb-3.5">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted mb-1.5">Últimas 4 semanas</p>
        <div className="flex items-end gap-4">
          <div className="grid gap-[3px] shrink-0" style={{ gridTemplateColumns: 'repeat(7, 18px)' }}>
            {INICIAIS.map((l, i) => (
              <span key={i} className="text-[9px] text-muted/70 text-center leading-none pb-0.5">{l}</span>
            ))}
            {grade.flat().map(d => (
              <div key={d.dia} title={d.dia}
                className={`h-[18px] rounded-[5px] ${d.treinou ? '' : d.futuro ? 'border border-line/40' : 'bg-surface-2'} ${d.hoje ? 'ring-1 ring-txt/60' : ''}`}
                style={d.treinou ? { background: 'var(--cor-secao, var(--color-accent))' } : undefined} />
            ))}
          </div>
          <div className="min-w-0 text-[11.5px] text-muted leading-relaxed">
            <p><b className="text-txt text-[14px]">{noMes}</b> {noMes === 1 ? 'treino' : 'treinos'} nessas 4 semanas</p>
            <p>Melhor sequência: {pl(c.melhorStreak, 'dia')}</p>
          </div>
        </div>
      </div>

      {c.ultimos.length > 0 && (
        <div className="mb-1">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted mb-1">Últimos treinos</p>
          {c.ultimos.slice(0, 3).map((t, i) => (
            <div key={i} className="flex items-baseline gap-2 py-1.5 border-b border-line/40 last:border-0">
              <p className="text-[13px] font-semibold flex-1 min-w-0 truncate">{t.nome}</p>
              <p className="text-[11.5px] text-muted shrink-0">
                {pl(t.series, 'série')} - {volume(t.volume)}{t.minutos ? ` - ${t.minutos} min` : ''}
              </p>
              <p className="text-[11.5px] text-muted shrink-0 w-14 text-right">{quandoFoi(t.dia, hj)}</p>
            </div>
          ))}
        </div>
      )}

      {c.recordes.length > 0 && (
        <div className="mt-3">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-muted mb-1.5">Maiores cargas</p>
          <div className="flex flex-wrap gap-1.5">
            {c.recordes.map(r => (
              <span key={r.nome} className="text-[11.5px] px-2.5 py-1 rounded-full bg-surface-2 border border-line">
                {r.nome} <b>{nq(r.carga)} kg</b>{r.reps ? ` x${r.reps}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {c.ultimos.length === 0 && (
        <p className="text-[12px] text-muted">Nenhum treino nas últimas semanas.</p>
      )}

      {atualizado && <p className="text-[10.5px] text-muted/70 mt-3">Atualizado {atualizado}</p>}
    </Card>
  )
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-xl bg-surface-2/60 border border-line/60 px-2 py-2 text-center">
      <p className="text-[16px] font-black tabular-nums leading-tight">{valor}</p>
      <p className="text-[10.5px] text-muted">{rotulo}</p>
    </div>
  )
}
