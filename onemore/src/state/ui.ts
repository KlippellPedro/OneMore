import { create } from 'zustand'
import type { Conquista, GanhoXP } from '../lib/xp'

export interface Toast {
  id: number
  texto: string
  sub?: string
  tipo: 'xp' | 'ok' | 'erro' | 'info'
}

interface UIState {
  toasts: Toast[]
  levelUp: number | null
  conquista: Conquista | null
  filaConquistas: Conquista[]

  toast: (texto: string, tipo?: Toast['tipo'], sub?: string) => void
  fecharToast: (id: number) => void
  /** Consome o resultado de darXP(): toast de XP + level up + conquistas. */
  celebrar: (g: GanhoXP) => void
  fecharLevelUp: () => void
  proximaConquista: () => void
}

let seq = 1

export const useUI = create<UIState>((set, get) => ({
  toasts: [],
  levelUp: null,
  conquista: null,
  filaConquistas: [],

  toast: (texto, tipo = 'info', sub) => {
    const id = seq++
    set(s => ({ toasts: [...s.toasts, { id, texto, tipo, sub }] }))
    setTimeout(() => get().fecharToast(id), tipo === 'erro' ? 4500 : 2600)
  },

  fecharToast: id => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  celebrar: g => {
    if (g.xp > 0) get().toast(`+${g.xp} XP`, 'xp', g.motivo)
    const fila = g.conquistas
    set(s => ({
      levelUp: g.subiuNivel ? g.nivel : s.levelUp,
      filaConquistas: [...s.filaConquistas, ...fila],
    }))
    if (!get().conquista) get().proximaConquista()
  },

  fecharLevelUp: () => set({ levelUp: null }),

  proximaConquista: () => set(s => {
    const [prox, ...resto] = s.filaConquistas
    return { conquista: prox ?? null, filaConquistas: resto }
  }),
}))

/** Vibra o celular, se o aparelho deixar. Pequeno reforco tatil. */
export function vibrar(padrao: number | number[] = 12) {
  try { navigator.vibrate?.(padrao) } catch { /* sem suporte */ }
}
