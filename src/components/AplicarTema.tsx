import { useEffect, useState } from 'react'
import { usePerfilCarregado, useRotinas, useSessaoAtiva } from '../state/hooks'
import { aplicarTema, corDoDia, temaDe, variaveisDoTema } from '../lib/tema'

/**
 * Pinta o app com o tema do perfil. Nao desenha nada: so escreve as variaveis
 * CSS no <html> sempre que algo que decide a cor muda - o tema, a rotina do
 * dia, o treino que comecou ou o proprio dia.
 */
export function AplicarTema() {
  const perfil = usePerfilCarregado()
  const rotinas = useRotinas()
  const sessao = useSessaoAtiva()
  const dia = useDiaDaSemana()

  useEffect(() => {
    // antes do perfil chegar vale o tema salvo (restaurarTemaSalvo, em main.tsx)
    if (!perfil) return
    const tema = temaDe(perfil.tema)
    const cor = corDoDia(tema, {
      dia,
      corRotinaDoDia: rotinas.find(r => r.dias?.includes(dia))?.cor,
      corTreinoAtivo: sessao?.rotinaId ? rotinas.find(r => r.id === sessao.rotinaId)?.cor : undefined,
    })
    aplicarTema(variaveisDoTema(cor, tema))
  }, [perfil, rotinas, sessao, dia])

  return null
}

/**
 * Dia da semana que se atualiza sozinho. O app fica aberto na tela do celular
 * por horas - sem isso, quem abriu na segunda a noite e voltou na terca de
 * manha veria a cor de segunda.
 */
function useDiaDaSemana() {
  const [dia, setDia] = useState(() => new Date().getDay())
  useEffect(() => {
    const conferir = () => setDia(new Date().getDay())
    const t = setInterval(conferir, 60_000)
    document.addEventListener('visibilitychange', conferir)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', conferir)
    }
  }, [])
  return dia
}
