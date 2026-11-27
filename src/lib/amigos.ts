import { db, getPerfil, hoje } from '../db'
import { chamar } from './sync'
import { coletarStats } from './xp'
import { montarCartao, DIAS_NO_CARTAO, type Cartao } from './cartao'

/**
 * Amigos: conversa com /api/amigos (servidor/amigos.js) e mantem o cartao
 * desta conta atualizado la. O cartao e montado em lib/cartao.ts - e so ele
 * que os amigos veem, nunca o backup.
 */

export interface Amigo {
  id: string
  desde: string
  cartao: Cartao | null
  atualizadoEm: string | null
}

export interface EstadoAmigos { convite: string | null; amigos: Amigo[] }

export const listarAmigos = () => chamar<EstadoAmigos>('/amigos')

/** Gera o codigo, ou troca o atual (o antigo para de valer). */
export const gerarConvite = () =>
  chamar<{ convite: string }>('/amigos/convite', { method: 'POST', body: JSON.stringify({}) })

/** Ninguem mais consegue te adicionar. Quem ja e amigo continua. */
export const desligarConvite = () => chamar('/amigos/convite', { method: 'DELETE' })

export const adicionarAmigo = (codigo: string) =>
  chamar<{ amigo: Amigo | null; jaEram: boolean }>('/amigos', {
    method: 'POST', body: JSON.stringify({ codigo }),
  })

export const removerAmigo = (id: string) =>
  chamar('/amigos', { method: 'DELETE', body: JSON.stringify({ id }) })

/** Link que abre o app direto na tela de amigos, com o codigo ja preenchido. */
export function linkDeConvite(codigo: string) {
  return `${location.origin}${location.pathname}#/amigos?convite=${encodeURIComponent(codigo)}`
}

/* ------------------------------------------------------------------ */
/* CARTAO DESTA CONTA                                                  */
/* ------------------------------------------------------------------ */

/** O cartao montado com o que esta neste aparelho agora. */
export async function cartaoLocal(): Promise<Cartao> {
  const perfil = await getPerfil()
  const desde = Date.now() - (DIAS_NO_CARTAO + 1) * 86400000
  const [sessoes, stats, melhores, exercicios] = await Promise.all([
    db.sessoes.where('inicio').above(desde).toArray(),
    coletarStats(perfil),
    db.melhores.toArray(),
    db.exercicios.toArray(),
  ])
  const nomes = new Map(exercicios.map(x => [x.id, x.nome]))
  // os ultimos 5 treinos podem ser mais velhos que a janela: completa se faltar
  const recentes = sessoes.filter(s => s.concluida === 1).length >= 5
    ? sessoes
    : await db.sessoes.where('concluida').equals(1).toArray()
  return montarCartao({
    perfil, sessoes: recentes, treinos: stats.treinos, prs: stats.prs,
    melhores, nomeDoExercicio: id => nomes.get(id), hoje: hoje(),
  })
}

/**
 * Marca do ultimo envio. `guardado: false` = o servidor nao guardou porque a
 * conta nao usa amigos (sem codigo e sem amigo) - ai nao adianta insistir a
 * cada sincronizacao.
 */
const CHAVE = 'onemore:cartao'
interface Marca { assinatura: string; em: number; guardado: boolean }

/** Cartao que nao mudou e reenviado de tempos em tempos mesmo assim (o servidor pode ter perdido). */
const REENVIO_MS = 12 * 60 * 60 * 1000
/** Conta sem amigos: pergunta de novo de hora em hora (pode ter ligado em outro aparelho). */
const SEM_AMIGOS_MS = 60 * 60 * 1000

function lerMarca(): Marca | null {
  try { return JSON.parse(localStorage.getItem(CHAVE) ?? 'null') } catch { return null }
}

/**
 * Manda o cartao pro servidor se ele mudou. Roda depois de cada sincronizacao
 * (App.tsx), entao terminar um treino aparece pros amigos em segundos. `forcar`
 * e pra tela de amigos, logo depois de ligar o codigo ou adicionar alguem.
 */
export async function publicarCartao(forcar = false) {
  const cartao = await cartaoLocal()
  const assinatura = JSON.stringify(cartao)
  const m = lerMarca()
  if (!forcar && m) {
    const idade = Date.now() - m.em
    if (!m.guardado && idade < SEM_AMIGOS_MS) return
    if (m.guardado && m.assinatura === assinatura && idade < REENVIO_MS) return
  }
  const r = await chamar<{ guardado: boolean }>('/amigos/cartao', {
    method: 'PUT', body: JSON.stringify({ cartao }),
  })
  localStorage.setItem(CHAVE, JSON.stringify({ assinatura, em: Date.now(), guardado: !!r?.guardado }))
}
