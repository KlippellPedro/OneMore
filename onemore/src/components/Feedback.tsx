import { useEffect } from 'react'
import { useUI, vibrar } from '../state/ui'
import { rankDoNivel } from '../lib/xp'
import { Btn } from './ui'
import { Icone } from './Icone'

export function Feedback() {
  const { toasts, levelUp, conquista, fecharLevelUp, proximaConquista } = useUI()

  useEffect(() => { if (levelUp) vibrar([30, 60, 30, 60, 90]) }, [levelUp])
  useEffect(() => { if (conquista) vibrar([20, 50, 60]) }, [conquista])

  const rank = levelUp ? rankDoNivel(levelUp) : null

  return (
    <>
      {/* toasts */}
      <div className="fixed left-0 right-0 top-0 z-[70] flex flex-col items-center gap-2 pt-3 px-4 pointer-events-none safe-t">
        {toasts.map(t => (
          <div key={t.id}
            className={`anim-pop max-w-[340px] w-full flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-lg ${
              t.tipo === 'xp' ? 'bg-xp/15 border-xp/40' :
              t.tipo === 'ok' ? 'bg-good/15 border-good/40' :
              t.tipo === 'erro' ? 'bg-bad/15 border-bad/40' :
              'bg-surface/95 border-line'
            }`}>
            {t.tipo === 'xp' && <Icone nome="raio" tamanho={20} className="shrink-0 text-xp" />}
            {t.tipo === 'ok' && <Icone nome="check" tamanho={20} className="shrink-0 text-good" traco={2.4} />}
            {t.tipo === 'erro' && <Icone nome="alerta" tamanho={20} className="shrink-0 text-bad" />}
            <div className="min-w-0">
              <p className={`text-sm font-bold leading-tight ${
                t.tipo === 'xp' ? 'text-xp' : t.tipo === 'ok' ? 'text-good' : t.tipo === 'erro' ? 'text-bad' : 'text-txt'
              }`}>{t.texto}</p>
              {t.sub && <p className="text-[11.5px] text-muted truncate">{t.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* level up */}
      {levelUp && rank && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6" onClick={fecharLevelUp}>
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
          <div className="relative text-center anim-pop">
            <p className="text-[13px] font-bold uppercase tracking-[0.3em] text-accent mb-4">Subiu de nivel</p>
            <div className="relative mx-auto w-36 h-36 mb-5">
              <div className="absolute inset-0 rounded-full anim-ring"
                style={{ background: `radial-gradient(circle, ${rank.cor}33, transparent 70%)` }} />
              <div className="absolute inset-2 rounded-full border-4 flex items-center justify-center"
                style={{ borderColor: rank.cor, background: 'var(--color-surface)' }}>
                <span className="text-5xl font-black" style={{ color: rank.cor }}>{levelUp}</span>
              </div>
            </div>
            <p className="text-2xl font-black mb-1">Nivel {levelUp}</p>
            <p className="text-sm font-semibold mb-6" style={{ color: rank.cor }}>Rank {rank.nome}</p>
            <Btn variant="primary" size="lg" onClick={fecharLevelUp}>Continuar</Btn>
          </div>
        </div>
      )}

      {/* conquista */}
      {conquista && !levelUp && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-6" onClick={proximaConquista}>
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
          <div className="relative w-full max-w-[320px] bg-surface border border-xp/40 rounded-3xl p-6 text-center anim-pop">
            <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-xp mb-4">Conquista desbloqueada</p>
            <div className="flex justify-center mb-4 text-xp">
              <Icone nome={conquista.icone} tamanho={64} traco={1.5} />
            </div>
            <p className="text-xl font-black mb-1.5">{conquista.nome}</p>
            <p className="text-[13px] text-muted leading-relaxed mb-4">{conquista.desc}</p>
            {conquista.xp > 0 && (
              <p className="inline-block px-3 py-1 rounded-full bg-xp/15 text-xp text-sm font-bold mb-5">
                +{conquista.xp} XP
              </p>
            )}
            <Btn variant="primary" className="w-full" onClick={proximaConquista}>Boa!</Btn>
          </div>
        </div>
      )}
    </>
  )
}
