import { useEffect, useState } from 'react'
import { imagemExercicio } from '../db/imagensExercicios'

/**
 * Ilustracao de execucao. Os dois quadros (inicio e fim) alternam sozinhos -
 * parado, um desenho so nao mostra o movimento; alternando, mostra.
 */
export function ImagemExercicio({ exercicioId, tamanho = 'grande', animar = true }: {
  exercicioId: string
  tamanho?: 'grande' | 'mini'
  animar?: boolean
}) {
  const [quadro, setQuadro] = useState<1 | 2>(1)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => { setQuadro(1); setFalhou(false) }, [exercicioId])

  useEffect(() => {
    if (!animar || falhou) return
    const t = setInterval(() => setQuadro(q => (q === 1 ? 2 : 1)), 1100)
    return () => clearInterval(t)
  }, [animar, falhou])

  const src = imagemExercicio(exercicioId, quadro)
  if (!src || falhou) return null

  // 44px deixa esse tipo de desenho ilegivel - 64 e o minimo pra reconhecer o movimento
  const mini = tamanho === 'mini'
  return (
    <div className={`shrink-0 flex items-center justify-center overflow-hidden ${
      mini ? 'w-16 h-16 rounded-xl bg-surface-2/60' : 'w-full h-44 rounded-2xl bg-surface-2/40'
    }`}>
      <img src={src} alt="" aria-hidden="true" loading="lazy"
        onError={() => setFalhou(true)}
        className={`object-contain transition-opacity duration-200 ${mini ? 'w-15 h-15' : 'h-40'}`} />
    </div>
  )
}
