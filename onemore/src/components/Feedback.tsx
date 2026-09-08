import { useEffect, useMemo } from 'react'
import { useUI, vibrar } from '../state/ui'
import { rankDoNivel } from '../lib/xp'
import { tocarNivel, tocarRank, tocarConquista } from '../lib/som'
import { Btn } from './ui'
import { Icone } from './Icone'

const CORES_CONFETE = ['#8b6dd6', '#9b7fc7', '#d9b654', '#4caf87', '#4f9aad', '#c25f70']

/** Confete de puro CSS - sem lib, algumas divs caindo com rotacao e cor aleatoria. */
function Confete({ quantidade = 24 }: { quantidade?: number }) {
  const pecas = useMemo(() => Array.from({ length: quantidade }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.35,
    duracao: 1.1 + Math.random() * 0.7,
    cor: CORES_CONFETE[i % CORES_CONFETE.length],
    rotacao: Math.round(Math.random() * 360),
  })), [quantidade])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {pecas.map(p => (
        <span key={p.id} className="confete" style={{
          left: `${p.left}%`, background: p.cor,
          animationDelay: `${p.delay}s`, animationDuration: `${p.duracao}s`,
          transform: `rotate(${p.rotacao}deg)`,
        }} />
      ))}
    </div>
  )
}

export function Feedback() {
  const { toasts, levelUp, conquista, fecharLevelUp, proximaConquista } = useUI()

  useEffect(() => {
    if (!levelUp) return
    if (levelUp.subiuRank) { vibrar([30, 50, 30, 50, 30, 80, 120]); tocarRank() }
    else { vibrar([30, 60, 30, 60, 90]); tocarNivel() }
  }, [levelUp])

  useEffect(() => {
    if (!conquista) return
    vibrar([20, 50, 60])
    tocarConquista()
  }, [conquista])

  const rank = levelUp ? rankDoNivel(levelUp.nivel) : null

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

      {/* level up / rank up - janela do "sistema", deliberadamente fora do visual roxo do resto do app */}
      {levelUp && rank && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 overflow-hidden" onClick={fecharLevelUp}>
          <div className="absolute inset-0 bg-black/88 backdrop-blur-sm" />
          <Confete quantidade={levelUp.subiuRank ? 42 : 22} />
          <div className="painel-sistema relative w-full max-w-[340px] rounded-lg p-6 text-center anim-pop font-mono"
            style={levelUp.subiuRank ? { boxShadow: '0 0 0 1px var(--color-accent-2), 0 10px 34px -12px rgba(0,0,0,.8)' } : undefined}>
            <span className="canto canto-tl" /><span className="canto canto-tr" />
            <span className="canto canto-bl" /><span className="canto canto-br" />

            <p className="text-[11px] font-bold uppercase tracking-[0.35em] mb-5" style={{ color: 'var(--color-accent-2)' }}>
              [ SISTEMA ]<span className="cursor-sistema">_</span>
            </p>

            <p className="text-[13px] uppercase tracking-widest mb-1" style={{ color: 'var(--color-accent-2)' }}>
              {levelUp.subiuRank ? '>> novo rank desbloqueado' : '>> voce subiu de nivel'}
            </p>

            <div className="my-5 py-4 border-y" style={{ borderColor: 'color-mix(in srgb, var(--color-accent-2) 35%, transparent)' }}>
              <p className="text-[11px] text-muted uppercase tracking-widest mb-1">Nivel</p>
              <p className="text-6xl font-black leading-none" style={{ color: rank.cor }}>{levelUp.nivel}</p>
            </div>

            <p className="text-sm mb-6">
              RANK: <span className="font-bold" style={{ color: rank.cor }}>{rank.nome.toUpperCase()}</span>
              {' '}
              <span className="px-1.5 border rounded" style={{ borderColor: rank.cor, color: rank.cor }}>{rank.letra}</span>
            </p>

            <button onClick={fecharLevelUp}
              className="w-full h-11 rounded-md font-bold text-sm tracking-widest uppercase transition-colors"
              style={{
                border: `1px solid var(--color-accent-2)`, color: 'var(--color-accent-2)',
                background: 'color-mix(in srgb, var(--color-accent-2) 10%, transparent)',
              }}>
              [ Continuar ]
            </button>
          </div>
        </div>
      )}

      {/* conquista */}
      {conquista && !levelUp && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-6 overflow-hidden" onClick={proximaConquista}>
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
          <Confete quantidade={16} />
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
