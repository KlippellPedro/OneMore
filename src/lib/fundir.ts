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

/** Registro com carimbo por campo - o formato que `salvarPerfil` grava em `perfil`. */
export interface ComCamposEm {
  id?: string
  atualizadoEm?: number
  camposEm?: Record<string, number>
  [chave: string]: unknown
}

/**
 * Funde `perfil` CAMPO A CAMPO, usando o carimbo de cada campo em `camposEm`
 * - nao o `atualizadoEm` da linha inteira.
 *
 * `fundirTabela` decide por linha inteira, e isso e certo pra sessoes, dieta,
 * rotinas: cada linha e uma coisa so, editada de um jeito so. `perfil` e
 * diferente - e uma linha UNICA que junta dados pessoais, saude, metas,
 * lembretes e gamificacao, e cada pedaco e editado numa tela diferente, num
 * momento diferente. Decidindo por linha inteira, marcar uma restricao
 * alimentar num aparelho enquanto liga um lembrete no outro faz um apagar o
 * outro por completo na proxima sincronizacao - sem precisar de corrida de
 * tempo nenhuma, so do uso normal em dois aparelhos.
 *
 * Campo sem carimbo dos dois lados (registro gravado antes desta mudanca, ou
 * tocado direto sem passar por `salvarPerfil`) cai pro criterio antigo -
 * `atualizadoEm` da linha inteira - como rede de seguranca de compatibilidade.
 *
 * Recebe e devolve no formato de tabela (array de 0 ou 1 linha) pra encaixar
 * no mesmo formato de `fundirBackups` - `perfil` e so mais uma tabela ali,
 * só que com no maximo uma linha.
 */
export function fundirPerfil<T extends ComCamposEm>(local: T[] = [], nuvem: T[] = []): T[] {
  const [l] = local
  const [n] = nuvem
  if (!l) return n ? [n] : []
  if (!n) return [l]

  const camposLocal = l.camposEm ?? {}
  const camposNuvem = n.camposEm ?? {}
  const chaves = new Set([...Object.keys(l), ...Object.keys(n)])
  chaves.delete('camposEm')
  chaves.delete('atualizadoEm')

  const saida: Record<string, unknown> = {}
  const camposEm: Record<string, number> = { ...camposLocal }

  for (const chave of chaves) {
    const tLocal = camposLocal[chave]
    const tNuvem = camposNuvem[chave]
    const semCarimboDosDois = tLocal == null && tNuvem == null
    const localVence = semCarimboDosDois
      ? (l.atualizadoEm ?? 0) >= (n.atualizadoEm ?? 0)
      : (tLocal ?? -1) >= (tNuvem ?? -1)

    saida[chave] = localVence ? l[chave] : n[chave]
    if (!localVence && tNuvem != null) camposEm[chave] = tNuvem
  }

  // nada mudou de fato em relacao ao que ja estava aqui: devolve a MESMA
  // referencia de `l`, pra `mudouTabela` ver que nao ha nada novo pra gravar
  const igualAoLocal = [...chaves].every(c => JSON.stringify(saida[c]) === JSON.stringify(l[c]))
  if (igualAoLocal) return [l]

  saida.id = l.id
  saida.atualizadoEm = Math.max(l.atualizadoEm ?? 0, n.atualizadoEm ?? 0)
  saida.camposEm = camposEm
  return [saida as T]
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

/**
 * Uma linha valida so precisa ter `id` de texto nao vazio - e o unico requisito
 * que toda tabela sincronizada compartilha (cada `interface` em db/types.ts
 * comeca com `id: string`) e o que `bulkPut` usa como chave primaria.
 *
 * Sem checar isto, um backup de versao futura/antiga do app, ou um arquivo
 * editado a mao antes de "Restaurar backup", e aceito e fundido/gravado do
 * mesmo jeito que um valido - o IndexedDB nao tem schema pra reclamar, e o
 * erro só aparece depois, tentando renderizar um campo que a linha nao tem.
 */
export const linhaValida = (l: unknown): l is { id: string } =>
  !!l && typeof l === 'object' && typeof (l as { id?: unknown }).id === 'string'
  && (l as { id: string }).id.length > 0

/**
 * Filtra linha invalida de cada tabela, sem mexer na forma do objeto
 * (tabela -> array de linhas). Chamar em toda porta de entrada de um backup
 * que nao veio do proprio `exportar()` deste aparelho - a nuvem (pode ter sido
 * gravada por uma versao diferente do app) e o arquivo de "Restaurar backup"
 * (escolhido a mao, sem garantia nenhuma do formato).
 */
export function sanitizarDados(dados: Record<string, unknown[]>): Record<string, unknown[]> {
  const saida: Record<string, unknown[]> = {}
  for (const [tabela, linhas] of Object.entries(dados)) {
    saida[tabela] = Array.isArray(linhas) ? linhas.filter(linhaValida) : []
  }
  return saida
}
