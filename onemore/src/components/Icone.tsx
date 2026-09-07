import type { ReactNode } from 'react'

/**
 * Icones de traco, desenhados na mesma grade 24x24 e sempre em currentColor.
 * Emoji muda de desenho em cada sistema, vem colorido de fabrica e briga com
 * a paleta do app - aqui a cor e o peso do traco sao nossos.
 */
const ICONES: Record<string, ReactNode> = {
  /* -------- acoes e estado -------- */
  check: <path d="M20 6.5 9.2 17.3 4 12.1" />,
  x: <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />,
  mais: <path d="M12 5v14M5 12h14" />,
  alerta: <><path d="M12 3.2 2.3 20.3h19.4z" /><path d="M12 9.5v4.3M12 17.1h.01" /></>,
  'chevron-cima': <path d="M6 14.5 12 8.5l6 6" />,
  'chevron-baixo': <path d="M6 9.5 12 15.5l6-6" />,
  'link-externo': <>
    <path d="M14 3.8h6.2V10" /><path d="M20.2 3.8 10.5 13.5" />
    <path d="M18 14v5.7a1.5 1.5 0 0 1-1.5 1.5H5.3a1.5 1.5 0 0 1-1.5-1.5V8.5A1.5 1.5 0 0 1 5.3 7H11" />
  </>,

  /* -------- navegacao -------- */
  casa: <><path d="M3 10.4 12 3l9 7.4" /><path d="M5.2 9.3V20.8h13.6V9.3" /></>,
  pessoa: <><circle cx="12" cy="8" r="3.6" /><path d="M4.6 20.4c1.2-4 4-6 7.4-6s6.2 2 7.4 6" /></>,

  /* -------- treino, dieta e saude -------- */
  halter: <path d="M4 9v6M7 6.5v11M17 6.5v11M20 9v6M7 12h10" />,
  gota: <path d="M12 2.8c0 0 6.2 6.7 6.2 10.7a6.2 6.2 0 1 1-12.4 0C5.8 9.5 12 2.8 12 2.8z" />,
  sangue: <>
    <path d="M12 2.8c0 0 6.2 6.7 6.2 10.7a6.2 6.2 0 1 1-12.4 0C5.8 9.5 12 2.8 12 2.8z" />
    <path d="M10.2 14.2h3.6M12 12.4v3.6" />
  </>,
  talheres: <>
    <path d="M7 3v7.4a2.2 2.2 0 0 0 4.4 0V3M9.2 10.4V21" />
    <path d="M17.6 3c-1.6 1.3-2.4 3.1-2.4 5.3 0 2 .9 3.1 2.4 3.1V21" />
  </>,
  prato: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.4" /></>,
  prancheta: <>
    <rect x="5" y="4.6" width="14" height="16" rx="2.2" />
    <path d="M9.2 4.6V3.4h5.6v1.2M9.2 11h5.6M9.2 15h3.8" />
  </>,
  faisca: <>
    <path d="M11.2 3 13 7.4 17.4 9.2 13 11 11.2 15.4 9.4 11 5 9.2 9.4 7.4z" />
    <path d="M18.2 14.6l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" />
  </>,

  /* -------- conquistas -------- */
  // o recorte na base e o que diferencia a chama da gota - sem ele viram o mesmo desenho
  chama: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
  medalha: <>
    <circle cx="12" cy="8.6" r="5.8" />
    <path d="M15.6 13.3 17.2 21.4 12 18.3 6.8 21.4l1.6-8.1" />
  </>,
  escudo: <path d="M12 2.9 19.1 5.8v5.4c0 4.4-2.9 7.4-7.1 8.9-4.2-1.5-7.1-4.5-7.1-8.9V5.8z" />,
  montanha: <path d="M2.4 19.2 9.6 6.8l3.6 6.2 2-3.2 6.4 9.4z" />,
  'grafico-linha': <><path d="M3.2 20.2h17.6" /><path d="M5.2 16.4 10.2 10.6l3 3 5.6-6.8" /></>,
  chip: <>
    <rect x="6.8" y="6.8" width="10.4" height="10.4" rx="2.2" />
    <rect x="10.2" y="10.2" width="3.6" height="3.6" rx="1" />
    <path d="M10 3.2v3.6M14 3.2v3.6M10 17.2v3.6M14 17.2v3.6M3.2 10h3.6M3.2 14h3.6M17.2 10h3.6M17.2 14h3.6" />
  </>,
  anilha: <>
    <circle cx="12" cy="12" r="8.6" /><circle cx="12" cy="12" r="5.6" /><circle cx="12" cy="12" r="2.2" />
  </>,
  predio: <>
    <path d="M5.2 20.8V6.6L12 3l6.8 3.6v14.2M3 20.8h18" />
    <path d="M9.4 10h.01M14.6 10h.01M9.4 14h.01M14.6 14h.01" />
  </>,
  planeta: <>
    <circle cx="12" cy="12" r="6.4" />
    <ellipse cx="12" cy="12" rx="10.4" ry="3.6" transform="rotate(-22 12 12)" />
  </>,
  calendario: <>
    <rect x="3.4" y="5" width="17.2" height="15.6" rx="2.4" />
    <path d="M8 3.2v3.6M16 3.2v3.6M3.4 10h17.2" />
  </>,
  lua: <path d="M20.4 14.1A8.6 8.6 0 0 1 9.9 3.6 8.6 8.6 0 1 0 20.4 14.1z" />,
  diamante: <>
    <path d="M6.2 3.8h11.6L21 9.2 12 20.6 3 9.2z" />
    <path d="M3 9.2h18M9 3.8 7.4 9.2 12 20.6l4.6-11.4L15 3.8" />
  </>,
  folha: <>
    <path d="M20.4 3.6C20.4 13 15 18.4 5.6 18.4 5.6 9 11 3.6 20.4 3.6z" />
    <path d="M4 20.4 11.6 12.8" />
  </>,
  chapeu: <>
    <path d="M7.6 20.6h8.8v-5.2H7.6z" />
    <path d="M7.6 15.4a3.8 3.8 0 0 1-1-7.5 3.8 3.8 0 0 1 7.1-1.9 3.8 3.8 0 0 1 6.1 3.1 3.8 3.8 0 0 1-3.4 6.3" />
  </>,
  foguete: <>
    <path d="M12 2.6c2.8 2.7 4.3 5.6 4.3 8.7 0 2.7-1.4 5-4.3 7-2.9-2-4.3-4.3-4.3-7 0-3.1 1.5-6 4.3-8.7z" />
    <circle cx="12" cy="9.6" r="1.7" />
    <path d="M8.2 15 5 19.2l4.3-1.3M15.8 15 19 19.2l-4.3-1.3" />
  </>,
  barras: <path d="M6 20.4V11M12 20.4V4.6M18 20.4v-6.6M3 20.4h18" />,
  bussola: <>
    <circle cx="12" cy="12" r="8.7" />
    <path d="M15.6 8.4 13.6 13.6 8.4 15.6 10.4 10.4z" />
  </>,
  balanca: <>
    <path d="M12 3.4v17M6.4 20.4h11.2M3.6 8h16.8" />
    <path d="M3.6 8 1.2 13.4a3.1 3.1 0 0 0 4.8 0z" />
    <path d="M20.4 8 18 13.4a3.1 3.1 0 0 0 4.8 0z" />
  </>,
  raio: <path d="M13.2 2.6 4.6 13.6h6.2l-1 7.8 8.6-11h-6.2z" />,
  estrela: <path d="M12 3.2l2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6L3.2 9.6l6.1-.9z" />,
  trofeu: <>
    <path d="M8 3.6h8v5.4a4 4 0 0 1-8 0z" />
    <path d="M8 5.2H5.4v1.5a3.2 3.2 0 0 0 3 3.2M16 5.2h2.6v1.5a3.2 3.2 0 0 1-3 3.2" />
    <path d="M10 13.2v3.4h4v-3.4M7.4 20.4h9.2" />
  </>,
  hexagono: <>
    <path d="M12 2.8 19.9 7.4v9.2L12 21.2 4.1 16.6V7.4z" />
    <path d="M12 8.2l3.5 2v3.6l-3.5 2-3.5-2v-3.6z" />
  </>,
  coroa: <path d="M3.4 18.6h17.2M3.4 18.6 1.9 7.8l5.6 3.8L12 4.4l4.5 7.2 5.6-3.8-1.5 10.8" />,
}

export type NomeIcone = keyof typeof ICONES

export function Icone({ nome, tamanho = 20, className = '', preenchido, traco = 1.8 }: {
  nome: string
  tamanho?: number
  className?: string
  /** Preenche em vez de so contornar - usado na estrela de favorito. */
  preenchido?: boolean
  traco?: number
}) {
  const d = ICONES[nome]
  if (!d) return null
  return (
    <svg
      viewBox="0 0 24 24" width={tamanho} height={tamanho} className={className}
      fill={preenchido ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth={traco}
      strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false"
    >
      {d}
    </svg>
  )
}

/** Botao de favoritar, usado em varias listas. */
export function BotaoFavorito({ ativo, onClick, className = '' }: {
  ativo?: boolean; onClick: () => void; className?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ativo ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
      aria-pressed={ativo}
      className={`shrink-0 flex items-center justify-center transition-colors ${
        ativo ? 'text-xp' : 'text-line'
      } ${className}`}
    >
      <Icone nome="estrela" preenchido={ativo} tamanho={19} />
    </button>
  )
}
