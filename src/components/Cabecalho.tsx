import { useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'

/**
 * Tela de cima, pra quando nao ha tela do app pra onde voltar - a pagina foi
 * aberta direto por link de convite, notificacao, atalho do icone ou recarga.
 * Os catalogos e as telas sociais sao abertos a partir do Perfil.
 */
function paiDe(caminho: string): string {
  const p = caminho.replace(/\/+$/, '') || '/'
  if (/^\/historico\//.test(p)) return '/progresso'
  if (/^\/equipe\/aluno\/[^/]+$/.test(p)) return '/equipe'
  if (/^\/(amigos|equipe|lembretes|privacidade|exercicios|alimentos)$/.test(p)) return '/perfil'
  return p.slice(0, p.lastIndexOf('/')) || '/'
}

/** Cabecalho de pagina interna, com voltar. */
export function Cabecalho({ titulo, sub, acao, voltarPara }: {
  titulo: string; sub?: string; acao?: ReactNode; voltarPara?: string
}) {
  const nav = useNavigate()
  const loc = useLocation()

  function voltar() {
    if (voltarPara) return nav(voltarPara)
    /**
     * O roteador guarda a posicao no historico em `idx`. Zero = esta e a
     * primeira tela do app nesta aba: `nav(-1)` saia do app (ou nao fazia
     * nada, numa aba nova) - o botao parecia quebrado. Ai sobe um nivel.
     */
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) return nav(-1)
    nav(paiDe(loc.pathname), { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur-lg border-b border-line/60 safe-t relative">
      <FioDaSecao />
      <div className="flex items-center gap-2 px-3 h-14">
        <button onClick={voltar} aria-label="Voltar"
          className="toque w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-muted active:bg-surface-2">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] font-bold truncate leading-tight">{titulo}</h1>
          {sub && <p className="text-[11.5px] text-muted truncate">{sub}</p>}
        </div>
        {acao}
      </div>
    </header>
  )
}

/** Cabecalho de aba (sem voltar). */
export function Titulo({ titulo, sub, acao }: { titulo: string; sub?: string; acao?: ReactNode }) {
  return (
    <header className="px-4 pt-4 pb-3 safe-t">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-black leading-tight tracking-tight">{titulo}</h1>
          {sub && <p className="text-[13px] text-muted mt-0.5">{sub}</p>}
        </div>
        {acao}
      </div>
      <div className="h-[3px] w-12 rounded-full mt-3"
        style={{ background: 'var(--cor-secao, var(--color-accent))' }} />
    </header>
  )
}

/**
 * Fio fino no pe do cabecalho, na cor da secao. E o suficiente pra a pagina
 * dizer onde voce esta antes de voce ler o titulo, sem colorir a tela toda.
 */
function FioDaSecao() {
  return (
    <div className="absolute left-0 right-0 bottom-0 h-px pointer-events-none"
      style={{
        background: 'linear-gradient(90deg, var(--cor-secao, var(--color-accent)), transparent 62%)',
        opacity: 0.55,
      }} />
  )
}
