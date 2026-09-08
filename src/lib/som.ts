/**
 * Sons curtos de celebracao via WebAudio - mesmo approach do bipe do
 * cronometro de descanso (Sessao.tsx), sem precisar de arquivo de audio.
 */
function contexto() {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  return new Ctx()
}

function nota(ctx: AudioContext, freq: number, inicio: number, duracao: number, volume = 0.18) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain); gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + inicio)
  gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + inicio + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + duracao)
  osc.start(ctx.currentTime + inicio)
  osc.stop(ctx.currentTime + inicio + duracao + 0.05)
}

/** Subiu de nivel - duas notas curtas. */
export function tocarNivel() {
  try {
    const ctx = contexto()
    nota(ctx, 523.25, 0, 0.14)
    nota(ctx, 783.99, 0.12, 0.22)
    setTimeout(() => ctx.close(), 600)
  } catch { /* som bloqueado pelo navegador, tudo bem */ }
}

/** Mudou de rank - arpejo maior, festa maior. */
export function tocarRank() {
  try {
    const ctx = contexto()
    nota(ctx, 523.25, 0, 0.12)
    nota(ctx, 659.25, 0.1, 0.12)
    nota(ctx, 783.99, 0.2, 0.12)
    nota(ctx, 1046.5, 0.32, 0.4, 0.2)
    setTimeout(() => ctx.close(), 900)
  } catch { /* som bloqueado pelo navegador, tudo bem */ }
}

/** Conquista desbloqueada - ping curto. */
export function tocarConquista() {
  try {
    const ctx = contexto()
    nota(ctx, 880, 0, 0.1)
    nota(ctx, 1174.66, 0.08, 0.22)
    setTimeout(() => ctx.close(), 500)
  } catch { /* som bloqueado pelo navegador, tudo bem */ }
}
