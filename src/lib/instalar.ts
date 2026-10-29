import { useSyncExternalStore } from 'react'

/**
 * "Instalar o app" de verdade, com um botao nosso.
 *
 * Instalado, o OneMore abre em tela cheia, ganha icone e - o que mais importa -
 * passa a poder receber lembrete com ele fechado (no iPhone, so instalado).
 * O Chrome do Android oferece instalar pelo evento `beforeinstallprompt`, que
 * dispara UMA vez, logo no carregamento: por isso a escuta liga em main.tsx,
 * antes do React, e o evento fica guardado aqui ate a pessoa tocar no botao.
 * O iPhone nao tem evento nenhum - la so da pra ensinar o caminho.
 */

interface EventoInstalar extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let evento: EventoInstalar | null = null
const ouvintes = new Set<() => void>()
const avisar = () => { for (const f of ouvintes) f() }

export function escutarInstalacao() {
  window.addEventListener('beforeinstallprompt', e => {
    // sem isso o Chrome mostra a barrinha dele na hora errada (no meio do treino)
    e.preventDefault()
    evento = e as EventoInstalar
    avisar()
  })
  window.addEventListener('appinstalled', () => { evento = null; avisar() })
}

/** Abre a pergunta do navegador. true = instalou. */
export async function instalar(): Promise<boolean> {
  if (!evento) return false
  const e = evento
  evento = null
  avisar()
  await e.prompt()
  return (await e.userChoice).outcome === 'accepted'
}

/** true enquanto o navegador deixa instalar (Android/Chrome, ainda nao instalado). */
export function usePodeInstalar() {
  return useSyncExternalStore(
    cb => { ouvintes.add(cb); return () => { ouvintes.delete(cb) } },
    () => evento != null,
  )
}

/** iPhone ou iPad - o iPad novo se apresenta como Mac, mas tem toque. */
export const ehIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** true quando o app esta rodando instalado (fora da aba do navegador). */
export const instalado = () =>
  window.matchMedia('(display-mode: standalone)').matches
  || (window.navigator as { standalone?: boolean }).standalone === true
