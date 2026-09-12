/**
 * Fusao de dois estados do app - o deste aparelho e o que esta na nuvem.
 *
 * Antes a sincronizacao era substituicao: enviar jogava o estado local por cima
 * da nuvem, baixar fazia o contrario. Quem treinasse registrando no celular e
 * depois abrisse o PC e enviasse perdia o treino do celular, sem aviso.
 *
 * A regra agora e por REGISTRO, nao por aparelho: cada linha e comparada pelo
 * seu carimbo de tempo e vence a mais recente. Linha que so existe de um lado
 * entra. Linha com lapide mais nova que a propria edicao sai - e o que impede
 * que o que voce apagou aqui volte do outro aparelho.
 */

export interface LinhaSync {
  id: string
  atualizadoEm?: number
  /** EventoXP nao tem atualizadoEm: ele e imutavel e usa ts. */
  ts?: number
}

export interface Lapide {
  id: string
  tabela: string
  chave: string
  ts: number
}

/** Carimbo de uma linha, com os nomes que as tabelas usam de verdade. */
export const quando = (l: LinhaSync) => l.atualizadoEm ?? l.ts ?? 0

/**
 * Funde uma tabela. `lapides` mapeia chave -> instante em que foi apagada,
 * ja filtrado pra esta tabela.
 */
export function fundirTabela<T extends LinhaSync>(
  local: T[] = [], nuvem: T[] = [], lapides = new Map<string, number>(),
): T[] {
  const saida = new Map<string, T>()

  // nuvem primeiro e local depois: em empate de carimbo (mesmo segundo, ou
  // registro sem carimbo nenhum) o que esta neste aparelho prevalece, que e o
  // que a pessoa acabou de ver na tela
  for (const linha of nuvem) if (linha?.id != null) saida.set(linha.id, linha)
  for (const linha of local) {
    if (linha?.id == null) continue
    const atual = saida.get(linha.id)
    if (!atual || quando(linha) >= quando(atual)) saida.set(linha.id, linha)
  }

  for (const [chave, ts] of lapides) {
    const linha = saida.get(chave)
    // so apaga se a lapide for mais nova que a ultima edicao: se a linha foi
    // editada DEPOIS de ter sido apagada noutro aparelho, ela foi recriada
    if (linha && quando(linha) <= ts) saida.delete(chave)
  }

  return [...saida.values()]
}

/** Une as lapides dos dois lados, ficando com a mais recente de cada. */
export function fundirLapides(local: Lapide[] = [], nuvem: Lapide[] = []): Lapide[] {
  const saida = new Map<string, Lapide>()
  for (const l of [...nuvem, ...local]) {
    if (!l?.id) continue
    const atual = saida.get(l.id)
    if (!atual || l.ts > atual.ts) saida.set(l.id, l)
  }
  return [...saida.values()]
}

/** Lapides de uma tabela, no formato que fundirTabela espera. */
export function lapidesDe(lapides: Lapide[], tabela: string) {
  const m = new Map<string, number>()
  for (const l of lapides) {
    if (l.tabela !== tabela) continue
    const atual = m.get(l.chave)
    if (atual == null || l.ts > atual) m.set(l.chave, l.ts)
  }
  return m
}

/**
 * Uma tabela mudou na fusao? Compara por IDENTIDADE de objeto, nao por
 * conteudo: `fundirTabela` devolve as proprias linhas que recebeu, entao uma
 * linha que veio do lado local e continua sendo o mesmo objeto. Se todas as
 * linhas do resultado sao objetos do lado local e a contagem bate, aquele lado
 * nao tem nada novo pra gravar.
 *
 * Isto decide QUAIS tabelas o `importar` reescreve. Por isso nao serve a
 * assinatura barata daqui de baixo: ela resume a tabela em contagem + carimbo
 * mais alto, e duas tabelas diferentes podem cair no mesmo resumo (apagar uma
 * linha e criar outra no mesmo milissegundo). Errar pra menos aqui significa
 * nao gravar uma mudanca que chegou.
 */
export function mudouTabela<T>(local: T[] = [], fundido: T[] = []): boolean {
  if (local.length !== fundido.length) return true
  const daqui = new Set<unknown>(local)
  return fundido.some(l => !daqui.has(l))
}

/**
 * Assinatura barata do estado, pra saber se vale a pena reenviar pra nuvem.
 * Nao precisa ser criptografica - so precisa mudar quando algo mudou.
 */
export function assinatura(dados: Record<string, unknown[]>): string {
  const partes: string[] = []
  for (const tabela of Object.keys(dados).sort()) {
    const linhas = (dados[tabela] ?? []) as LinhaSync[]
    let max = 0
    for (const l of linhas) max = Math.max(max, quando(l))
    partes.push(`${tabela}:${linhas.length}:${max}`)
  }
  return partes.join('|')
}
