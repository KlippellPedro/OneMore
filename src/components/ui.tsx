import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { clamp } from '../lib/format'
import { Icone } from './Icone'

/* ------------------------------------------------------------------ */
/* CARD / SECAO                                                        */
/* ------------------------------------------------------------------ */

export function Card({ children, className = '', onClick, destaque }: {
  children: ReactNode; className?: string; onClick?: () => void
  /** Card que puxa o olho da tela - use no maximo um por tela. */
  destaque?: boolean
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`w-full rounded-2xl border ${destaque ? 'cartao-destaque border-accent/30' : 'cartao border-line/70'} ${onClick ? 'text-left active:scale-[.985] transition-transform' : ''} ${className}`}
    >
      {children}
    </Tag>
  )
}

export function Secao({ titulo, acao, children, cor }: {
  titulo: string; acao?: ReactNode; children: ReactNode
  /**
   * Cor do marcador. O padrao e a cor da secao em que a pagina esta (ver
   * lib/secoes.ts); passe explicito quando o bloco falar de OUTRA secao - e o
   * caso da Home, que mostra um pedaco de cada uma.
   */
  cor?: string
}) {
  return (
    <section className="mb-6">
      <div className="flex items-end justify-between mb-2.5 px-1">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted flex items-center gap-2">
          <span className="w-1 h-3.5 rounded-full shrink-0"
            style={{ background: cor ?? 'var(--cor-secao, var(--color-accent))' }} />
          {titulo}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* BOTOES                                                             */
/* ------------------------------------------------------------------ */

type BtnProps = {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'surface' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit'
  /** Recebe o foco quando o dialogo em volta abre (ver useDialogo). */
  focoInicial?: boolean
}

export function Btn({
  children, onClick, variant = 'surface', size = 'md', className = '', disabled, type = 'button', focoInicial,
}: BtnProps) {
  const v = {
    primary: 'grad-accent glow-accent text-white font-bold active:brightness-110',
    ghost: 'bg-transparent text-muted active:bg-surface-2',
    surface: 'bg-surface-2 text-txt border border-line active:bg-line',
    danger: 'bg-bad/15 text-bad border border-bad/30 active:bg-bad/25',
  }[variant]
  const s = {
    sm: 'h-9 px-3 text-[13px] rounded-xl',
    md: 'h-11 px-4 text-sm rounded-xl',
    lg: 'h-14 px-5 text-base rounded-2xl font-semibold',
  }[size]
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      {...(focoInicial ? { 'data-foco-inicial': '' } : {})}
      className={`inline-flex items-center justify-center gap-2 transition-all active:scale-[.97] disabled:opacity-40 disabled:active:scale-100 ${v} ${s} ${className}`}
    >
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* INPUTS                                                             */
/* ------------------------------------------------------------------ */

/**
 * Clique no TEXTO de um <label>: o navegador repassa o clique pro primeiro
 * controle de dentro. Com um campo de texto isso e o que se quer (foca o
 * campo), mas o Campo tambem embrulha grupos de botoes e o Stepper - e ai
 * tocar em "Nível de atividade" escolhia "Sedentário" sozinho, e tocar em
 * "Peso" diminuia o peso. Quando o primeiro controle e um botao, o clique no
 * rotulo so foca o campo de digitar que houver (o do Stepper), sem apertar nada.
 */
function aoClicarNoRotulo(e: React.MouseEvent<HTMLLabelElement>) {
  if ((e.target as HTMLElement).closest('button, input, select, textarea, a')) return
  const primeiro = e.currentTarget.querySelector('button, input, select, textarea, meter, output, progress')
  if (primeiro?.tagName !== 'BUTTON') return
  e.preventDefault()
  e.currentTarget.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea')?.focus()
}

export function Campo({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block mb-3.5" onClick={aoClicarNoRotulo}>
      <span className="block text-[12px] font-medium text-muted mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted/70 mt-1.5">{hint}</span>}
    </label>
  )
}

// text-base (16px) e o minimo: abaixo disso o Safari do iPhone da zoom na
// pagina inteira ao tocar no campo - e nao desfaz quando sai dele
const inputBase =
  'w-full h-11 px-3.5 rounded-xl bg-bg-soft border border-line text-txt text-base ' +
  'outline-none focus:border-accent/60 transition-colors placeholder:text-muted/50'

export function Input(props: React.ComponentProps<'input'>) {
  const { className = '', ...rest } = props
  return <input {...rest} className={`${inputBase} ${className}`} />
}

export function Textarea(props: React.ComponentProps<'textarea'>) {
  const { className = '', ...rest } = props
  return <textarea {...rest} className={`${inputBase} h-auto py-3 leading-relaxed ${className}`} />
}

export function Select(props: React.ComponentProps<'select'>) {
  const { className = '', children, ...rest } = props
  return (
    <select {...rest} className={`${inputBase} appearance-none pr-9 ${className}`}
      style={{
        backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238b98a9\' stroke-width=\'2\'><path d=\'M6 9l6 6 6-6\'/></svg>")',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        backgroundSize: '16px',
      }}>
      {children}
    </select>
  )
}

/** Input numerico com +/-. Feito pra usar com o dedo suado na academia. */
export function Stepper({ valor, setValor, passo = 1, min = 0, max = 9999, sufixo, largo }: {
  valor: number; setValor: (v: number) => void
  passo?: number; min?: number; max?: number; sufixo?: string; largo?: boolean
}) {
  const dec = () => setValor(Number(clamp(valor - passo, min, max).toFixed(2)))
  const inc = () => setValor(Number(clamp(valor + passo, min, max).toFixed(2)))
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={dec} aria-label={`Diminuir ${passo}`} disabled={valor <= min}
        className="w-9 h-11 shrink-0 rounded-l-xl bg-surface-2 border border-line text-muted text-lg active:bg-line disabled:opacity-40">-</button>
      <div className="relative flex-1">
        <input
          type="number" inputMode="decimal" value={valor === 0 ? '' : valor}
          placeholder="0"
          onChange={e => setValor(clamp(Number(e.target.value || 0), min, max))}
          className={`w-full h-11 text-center bg-bg-soft border-y border-line text-txt font-semibold outline-none focus:border-accent/60 ${largo ? 'text-lg' : 'text-base'}`}
        />
        {sufixo && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted pointer-events-none">
            {sufixo}
          </span>
        )}
      </div>
      <button type="button" onClick={inc} aria-label={`Aumentar ${passo}`} disabled={valor >= max}
        className="w-9 h-11 shrink-0 rounded-r-xl bg-surface-2 border border-line text-muted text-lg active:bg-line disabled:opacity-40">+</button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* BOTTOM SHEET                                                        */
/* ------------------------------------------------------------------ */

/**
 * Dialogos abertos, do de baixo pro de cima. So o de cima responde ao teclado:
 * um Confirmar aberto por cima de um Sheet fecha sozinho no Esc, sem levar o
 * Sheet junto.
 */
const pilhaDialogos: symbol[] = []
/** Sheets abertos agora - a rolagem da pagina so volta quando o ultimo fecha. */
let sheetsAbertos = 0

const FOCAVEIS = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), '
  + 'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Os dois ultimos elementos que receberam foco. Um dialogo com campo
 * `autoFocus` (glicemia, link de video) ja puxou o foco pra dentro quando o
 * efeito roda - o `activeElement` ali e o campo, nao o botao que abriu. O
 * penultimo foco e quem abriu, e e pra ele que o foco volta ao fechar.
 */
let focoAtual: HTMLElement | null = null
let focoAnterior: HTMLElement | null = null
if (typeof document !== 'undefined') {
  document.addEventListener('focusin', e => {
    if (!(e.target instanceof HTMLElement) || e.target === focoAtual) return
    focoAnterior = focoAtual
    focoAtual = e.target
  }, true)
}

/**
 * O que todo dialogo precisa pra teclado e leitor de tela (WCAG 2.1.2 e
 * 2.4.3): ao abrir, o foco entra nele (no botao marcado com
 * data-foco-inicial, ou no proprio painel); o Tab fica dando a volta la
 * dentro em vez de escapar pra pagina de tras; Esc fecha; e ao fechar o foco
 * volta pra quem abriu. No toque nada disso aparece - so o teclado ve.
 */
function useDialogo(aberto: boolean, painel: React.RefObject<HTMLElement | null>, aoEsc: () => void) {
  // ref e nao dependencia: quem usa passa `() => setX(null)` novo a cada
  // render, e o efeito rodando de novo a cada render perderia quem abriu
  const esc = useRef(aoEsc)
  useEffect(() => { esc.current = aoEsc })

  useEffect(() => {
    if (!aberto) return
    const eu = Symbol('dialogo')
    pilhaDialogos.push(eu)
    const el = painel.current
    const ativo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // campo com autoFocus ja pegou o foco: quem abriu e o foco de antes dele
    const antes = ativo && el?.contains(ativo) ? focoAnterior : ativo
    el?.querySelector<HTMLElement>('[data-foco-inicial]')?.focus({ preventScroll: true })
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true })

    const tecla = (e: KeyboardEvent) => {
      if (pilhaDialogos[pilhaDialogos.length - 1] !== eu || !painel.current) return
      if (e.key === 'Escape') { e.preventDefault(); esc.current(); return }
      if (e.key !== 'Tab') return
      const lista = [...painel.current.querySelectorAll<HTMLElement>(FOCAVEIS)].filter(f => f.offsetParent !== null)
      if (!lista.length) { e.preventDefault(); return }
      const [primeiro, ultimo] = [lista[0], lista[lista.length - 1]]
      const atual = document.activeElement
      if (e.shiftKey && (atual === primeiro || atual === painel.current)) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && (atual === ultimo || !painel.current.contains(atual))) { e.preventDefault(); primeiro.focus() }
    }
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('keydown', tecla)
      pilhaDialogos.splice(pilhaDialogos.indexOf(eu), 1)
      if (antes?.isConnected) antes.focus({ preventScroll: true })
    }
  }, [aberto, painel])
}

export function Sheet({ aberto, fechar, titulo, children, alto }: {
  aberto: boolean; fechar: () => void; titulo?: string; children: ReactNode; alto?: boolean
}) {
  const painel = useRef<HTMLDivElement>(null)
  const idTitulo = useId()
  useDialogo(aberto, painel, fechar)

  useEffect(() => {
    if (!aberto) return
    sheetsAbertos++
    document.body.style.overflow = 'hidden'
    return () => { if (--sheetsAbertos === 0) document.body.style.overflow = '' }
  }, [aberto])

  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={fechar} aria-hidden="true" />
      <div ref={painel} role="dialog" aria-modal="true" tabIndex={-1}
        {...(titulo ? { 'aria-labelledby': idTitulo } : { 'aria-label': 'Painel' })}
        className={`relative w-full max-w-[560px] bg-bg-soft border-t border-line rounded-t-3xl anim-up flex flex-col outline-none ${alto ? 'h-[88vh]' : 'max-h-[85vh]'}`}>
        <div className="shrink-0 pt-2.5 pb-1 flex justify-center" onClick={fechar} aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-line" />
        </div>
        {titulo && (
          <div className="shrink-0 px-5 pb-3 pt-1 flex items-center justify-between border-b border-line/60">
            <h3 id={idTitulo} className="text-base font-bold">{titulo}</h3>
            <button onClick={fechar} aria-label="Fechar"
              className="toque w-8 h-8 rounded-lg text-muted active:bg-surface-2 text-xl leading-none">
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-5 py-4 safe-b flex-1">{children}</div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* BARRAS E ANEIS                                                      */
/* ------------------------------------------------------------------ */

export function Barra({ valor, cor = 'var(--color-accent)', altura = 8, brilho }: {
  valor: number; cor?: string; altura?: number; brilho?: boolean
}) {
  const p = clamp(valor, 0, 1) * 100
  const estourou = valor > 1
  return (
    <div className="w-full rounded-full bg-surface-2 overflow-hidden relative" style={{ height: altura }}>
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out relative barra-cheia ${brilho ? 'xp-shine' : ''}`}
        style={{ width: `${p}%`, ['--cor-barra' as string]: estourou ? 'var(--color-bad)' : cor }}
      />
    </div>
  )
}

export function Anel({ valor, cor, tamanho = 62, espessura = 6, children }: {
  valor: number; cor: string; tamanho?: number; espessura?: number; children?: ReactNode
}) {
  const r = (tamanho - espessura) / 2
  const circ = 2 * Math.PI * r
  const p = clamp(valor, 0, 1)
  return (
    <div className="relative shrink-0" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} className="-rotate-90">
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none"
          stroke="var(--color-surface-2)" strokeWidth={espessura} />
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none"
          stroke={valor > 1.1 ? 'var(--color-bad)' : cor} strokeWidth={espessura} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - p)}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* DIVERSOS                                                            */
/* ------------------------------------------------------------------ */

export function Chip({ ativo, onClick, children, cor }: {
  ativo?: boolean; onClick?: () => void; children: ReactNode; cor?: string
}) {
  return (
    <button onClick={onClick} aria-pressed={ativo ?? false}
      className={`shrink-0 h-9 px-3.5 rounded-full text-[12.5px] font-medium border transition-colors ${
        ativo
          ? cor ? 'text-[#0a0714] font-semibold' : 'grad-accent text-white font-semibold border-transparent'
          : 'bg-surface-2 border-line text-muted'
      }`}
      style={ativo && cor ? { background: cor, borderColor: cor } : undefined}>
      {children}
    </button>
  )
}

/** Liga/desliga. O mesmo botao que ja existia na tela de saude. */
export function Switch({ ligado, onChange, rotulo }: {
  ligado: boolean; onChange: (v: boolean) => void; rotulo?: string
}) {
  return (
    <button onClick={() => onChange(!ligado)} role="switch" aria-checked={ligado} aria-label={rotulo}
      className={`toque w-12 h-7 shrink-0 rounded-full transition-colors relative ${
        ligado ? 'grad-accent' : 'bg-surface-2 border border-line'
      }`}>
      <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${
        ligado ? 'left-6' : 'left-1'
      }`} />
    </button>
  )
}

export function Vazio({ icone, titulo, texto, acao }: {
  /** Nome do icone em components/Icone.tsx. */
  icone: string; titulo: string; texto?: string; acao?: ReactNode
}) {
  return (
    <div className="text-center py-12 px-6">
      <div className="aro-vazio w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center text-accent/65">
        <Icone nome={icone} tamanho={38} traco={1.5} />
      </div>
      <p className="font-bold text-[15px] text-txt mb-1">{titulo}</p>
      {texto && <p className="text-[13px] text-muted mb-4 leading-relaxed max-w-[280px] mx-auto">{texto}</p>}
      {acao}
    </div>
  )
}

/**
 * Confirmacao. Nada de window.confirm - fica horrivel no celular.
 *
 * `onSim` pode devolver uma promessa: enquanto ela nao termina, o Confirmar
 * fica travado. Sem isso, dois toques rapidos antes de o dialogo sumir rodavam
 * a acao duas vezes - finalizar treino pagava o XP em dobro, apagar apagava
 * duas vezes. A trava e um ref, nao estado: dois cliques no mesmo quadro veem
 * o mesmo estado antigo, mas o ref ja mudou.
 */
export function Confirmar({ aberto, titulo, texto, onSim, onNao, perigo }: {
  aberto: boolean; titulo: string; texto?: string
  onSim: () => unknown; onNao: () => void; perigo?: boolean
}) {
  const painel = useRef<HTMLDivElement>(null)
  const trava = useRef(false)
  const [rodando, setRodando] = useState(false)
  const idTitulo = useId()
  const idTexto = useId()
  useDialogo(aberto, painel, () => { if (!trava.current) onNao() })

  if (!aberto) return null

  async function sim() {
    if (trava.current) return
    trava.current = true
    setRodando(true)
    try { await onSim() } finally { trava.current = false; setRodando(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/70" onClick={() => { if (!trava.current) onNao() }} aria-hidden="true" />
      <div ref={painel} role="alertdialog" aria-modal="true" tabIndex={-1}
        aria-labelledby={idTitulo} {...(texto ? { 'aria-describedby': idTexto } : {})}
        className="relative w-full max-w-[340px] bg-surface border border-line rounded-2xl p-5 anim-pop outline-none">
        <h3 id={idTitulo} className="font-bold text-base mb-1.5">{titulo}</h3>
        {texto && <p id={idTexto} className="text-[13px] text-muted leading-relaxed mb-5">{texto}</p>}
        <div className="flex gap-2">
          {/* o foco comeca no caminho que nao estraga nada: Cancelar quando e perigoso */}
          <Btn variant="ghost" className="flex-1" onClick={onNao} disabled={rodando} focoInicial={perigo}>Cancelar</Btn>
          <Btn variant={perigo ? 'danger' : 'primary'} className="flex-1" onClick={sim} disabled={rodando}
            focoInicial={!perigo}>
            {rodando ? 'Um instante...' : 'Confirmar'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

/** Foca o input assim que monta - útil em sheets de busca. */
export function useAutoFoco<T extends HTMLElement>(ativo: boolean) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (ativo) setTimeout(() => ref.current?.focus(), 120)
  }, [ativo])
  return ref
}
