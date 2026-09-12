import type { Alimento, Perfil } from '../db/types'
import { marcadoresDe, MARCADORES, type Marcador } from '../db/marcadores'

/**
 * Restricoes alimentares: o que a pessoa marcou que precisa evitar.
 *
 * O app faz com isso a mesma coisa que faz com o carboidrato de quem tem
 * diabetes - deixa visivel e tira do caminho, sem opinar sobre saude:
 *
 *   - avisa quando um alimento restrito esta no plano alimentar;
 *   - marca o alimento no catalogo;
 *   - nao sugere o alimento como substituicao;
 *   - nao usa o alimento no cardapio gerado automaticamente.
 *
 * O que ele NAO faz: dizer que voce tem alguma coisa, ou impedir voce de comer.
 * Marcar continua sendo escolha sua, e nada fica bloqueado.
 */

export const restricoesDoPerfil = (p?: Perfil): Marcador[] =>
  ((p?.restricoes ?? []) as Marcador[]).filter(r => r in MARCADORES)

/** Marcadores deste alimento que a pessoa pediu pra evitar. Vazio = liberado. */
export function conflitos(alimentoId: string, restricoes: Marcador[]): Marcador[] {
  if (!restricoes.length) return []
  const tem = marcadoresDe(alimentoId)
  return tem.filter(m => restricoes.includes(m))
}

export const temConflito = (alimentoId: string, restricoes: Marcador[]) =>
  conflitos(alimentoId, restricoes).length > 0

/** Texto curto pro aviso na tela: "contém leite e glúten". */
export function textoConflito(ms: Marcador[]): string {
  const nomes = ms.map(m => MARCADORES[m].nome.toLowerCase())
  if (nomes.length === 1) return `contém ${nomes[0]}`
  return `contém ${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

/** Tira da lista o que conflita. Usado na substituicao e no gerador de plano. */
export const semConflito = <T extends Alimento>(lista: T[], restricoes: Marcador[]): T[] =>
  restricoes.length ? lista.filter(a => !temConflito(a.id, restricoes)) : lista
