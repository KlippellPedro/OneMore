import {
  db, normalizarFlags, limparLapidesVelhas, escutarEscrita, semAvisarEscrita,
} from '../db'
import { resetarCacheSeed } from '../db/seed'
import { reconstruirMelhores } from './acoes'
import { reconstruirGamificacao } from './xp'
import { regerarAgenda } from './lembretes'
import {
  fundirTabela, fundirPerfil, fundirLapides, lapidesDe, assinatura, mudouTabela, sanitizarDados,
  type LinhaSync, type Lapide, type ComCamposEm,
} from './fundir'

/* ------------------------------------------------------------------ */
/* BACKUP LOCAL (JSON)                                                 */
/* ------------------------------------------------------------------ */

export const VERSAO_BACKUP = 1

export interface Backup {
  app: 'onemore'
  versao: number
  criadoEm: string
  dados: Record<string, unknown[]>
}

/** O que entra no backup: dado que a pessoa criou. */
const TABELAS = [
  'exercicios', 'rotinas', 'sessoes', 'alimentos', 'planos', 'dietas',
  'dieta', 'corpo', 'xp', 'perfil', 'agua', 'glicemia',
  // as lapides viajam junto: sem elas o outro aparelho nao tem como saber que
  // um registro foi apagado, e a fusao o traria de volta
  'apagados',
] as const

/**
 * Tabelas derivadas: nao vao pro backup (sao recalculadas), mas TEM que ser
 * limpas junto. A agenda de lembretes ficava pra tras num "apagar tudo" e o
 * service worker seguia avisando de refeicao de um plano que nao existia mais.
 */
const TABELAS_DERIVADAS = ['lembretes', 'melhores'] as const

const limpar = (t: string) =>
  (db as unknown as Record<string, { clear(): Promise<void> }>)[t].clear()

export async function exportar(): Promise<Backup> {
  const dados: Record<string, unknown[]> = {}
  for (const t of TABELAS) {
    dados[t] = await (db as unknown as Record<string, { toArray(): Promise<unknown[]> }>)[t].toArray()
  }
  return { app: 'onemore', versao: VERSAO_BACKUP, criadoEm: new Date().toISOString(), dados }
}

export async function baixarBackup() {
  const backup = await exportar()
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `onemore-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export interface ResultadoImport { tabelas: number; registros: number }

/**
 * Substitui pelo conteudo do backup. Sem `apenas`, troca TUDO - e o que o
 * "Restaurar backup" faz.
 *
 * `apenas` existe pra sincronizacao continua: reescrever as 13 tabelas,
 * recalcular recordes e refazer a agenda a cada sincronizacao era trabalho
 * pesado demais pra acontecer de poucos em poucos segundos, e era por isso que
 * o sync automatico se recusava a rodar com treino em andamento. Recebendo so
 * as tabelas que a fusao mudou, o caso comum - nada mudou, ou mudou uma linha
 * de uma tabela - fica barato, e o trabalho derivado so roda se a tabela que o
 * alimenta tiver sido tocada.
 */
export async function importar(backup: Backup, apenas?: readonly string[]): Promise<ResultadoImport> {
  if (backup?.app !== 'onemore' || !backup.dados) {
    throw new Error('Esse arquivo não e um backup do OneMore.')
  }
  /**
   * Este backup pode vir de um arquivo escolhido a mao ("Restaurar backup") -
   * sem garantia nenhuma de formato. Filtra linha invalida ANTES de gravar,
   * senao bulkPut aceita qualquer coisa (o IndexedDB nao tem schema pra
   * reclamar) e o erro só aparece depois, renderizando um campo que a linha
   * nao tem. Ver linhaValida/sanitizarDados em lib/fundir.ts.
   */
  const dados = sanitizarDados(backup.dados)
  const alvo = apenas ?? TABELAS
  const mexeu = (t: string) => (alvo as readonly string[]).includes(t)
  let registros = 0
  let tabelas = 0
  for (const t of alvo) {
    const linhas = dados[t]
    if (!Array.isArray(linhas)) continue
    const tabela = (db as unknown as Record<string, {
      clear(): Promise<void>; bulkPut(v: unknown[]): Promise<unknown>
    }>)[t]
    /**
     * clear + bulkPut na MESMA transacao: como duas chamadas separadas, uma
     * leitura no meio do caminho (ex.: getPerfil rodando enquanto o `perfil`
     * esta sendo reimportado) via a tabela vazia bem entre as duas e podia se
     * "curar" com um valor padrao - que o bulkPut seguinte apagaria de volta,
     * perdendo o que estava justamente chegando da sincronizacao.
     */
    await db.transaction('rw', db.table(t), async () => {
      await tabela.clear()
      if (linhas.length) await tabela.bulkPut(linhas)
    })
    registros += linhas.length
    tabelas++
  }
  // um backup de antes da v6 traz `concluída`/`arquivada` como boolean, e nesse
  // formato a linha NAO entra no indice: as rotinas sumiriam da lista e o
  // historico ficaria invisivel. Normaliza antes de qualquer leitura
  if (mexeu('sessoes') || mexeu('rotinas')) await normalizarFlags()

  // o backup traz sessoes novas: os recordes derivados precisam ser refeitos
  if (mexeu('sessoes')) await reconstruirMelhores()

  /**
   * xp/streak/melhorStreak/conquistas sao um snapshot em `perfil`, e `perfil`
   * funde campo a campo (fundirPerfil) - o valor de `xp` que sobrevive e o de
   * UM aparelho, nao a soma dos dois. `sessoes` e `corpo` tambem entram nas
   * estatisticas de conquista (coletarStats), entao mudanca neles pode
   * desbloquear algo mesmo sem nenhum evento de xp novo ter chegado.
   */
  if (mexeu('xp') || mexeu('sessoes') || mexeu('corpo')) await reconstruirGamificacao()

  /**
   * Reconstruir a agenda AQUI e obrigatorio, nao um detalhe. O rodizio so
   * refaz a agenda a cada 15 minutos - sem isto o aparelho ficaria ate 15 min
   * com a agenda velha depois de receber um plano novo, e com o app fechado o
   * service worker leria a tabela desatualizada. Inclui os de glicemia.
   */
  if (mexeu('planos') || mexeu('perfil') || mexeu('dieta') || mexeu('glicemia')) {
    await limpar('lembretes')
    await regerarAgenda().catch(() => {})
  }

  return { tabelas, registros }
}

export async function apagarTudo() {
  for (const t of [...TABELAS, ...TABELAS_DERIVADAS]) await limpar(t)
  localStorage.removeItem('onemore:seed')
  resetarCacheSeed()
}

/* ------------------------------------------------------------------ */
/* CONTA E NUVEM (API propria)                                         */
/* ------------------------------------------------------------------ */

/**
 * A API mora na mesma origem que serve o site (/api), entao nao ha URL pra
 * configurar nem CORS pra liberar. A sessao e um cookie HttpOnly: o token
 * nunca passa por JavaScript, por isso `credentials: 'include'` em tudo e
 * nenhuma chave e guardada aqui.
 */
const API = '/api'

export interface Usuario { email: string }

/**
 * Resposta de cadastro e de redefinicao. O codigo vem UMA vez e nunca mais:
 * no servidor so fica o hash dele. Quem nao anotar precisa gerar outro estando
 * logado (novoCodigoRecuperacao) ou perde o acesso se esquecer a senha.
 */
export interface UsuarioComCodigo extends Usuario { codigo: string }

async function chamar<T>(rota: string, init: RequestInit = {}): Promise<T | null> {
  let r: Response
  try {
    r = await fetch(API + rota, {
      ...init,
      credentials: 'include',
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    })
  } catch {
    throw new Error('Sem conexao com o servidor.')
  }

  if (r.status === 204) return null
  const texto = await r.text()
  const corpo = texto ? JSON.parse(texto) : null
  if (!r.ok) throw new Error(corpo?.erro ?? `Erro ${r.status}.`)
  return corpo as T
}

export const usuarioAtual = () => chamar<Usuario>('/eu')

export const criarConta = (email: string, senha: string) =>
  chamar<UsuarioComCodigo>('/conta', { method: 'POST', body: JSON.stringify({ email, senha }) })

/** Gera um codigo novo (precisa estar logado). O anterior para de valer. */
export const novoCodigoRecuperacao = () =>
  chamar<{ codigo: string }>('/recuperacao', { method: 'POST', body: JSON.stringify({}) })

/** Troca a senha com o codigo de recuperacao. Entra logado ja no fim. */
export const redefinirSenha = (email: string, codigo: string, senha: string) =>
  chamar<UsuarioComCodigo>('/senha', {
    method: 'POST', body: JSON.stringify({ email, codigo, senha }),
  })

export const entrar = (email: string, senha: string) =>
  chamar<Usuario>('/sessao', { method: 'POST', body: JSON.stringify({ email, senha }) })

export const sair = () => chamar('/sessao', { method: 'DELETE' })

/* ------------------------------------------------------------------ */
/* SINCRONIZACAO POR FUSAO                                             */
/* ------------------------------------------------------------------ */

/**
 * Junta o que esta aqui com o que esta na nuvem, registro a registro, e grava
 * o resultado nos dois lados.
 *
 * O modelo antigo era substituicao - "enviar" jogava este aparelho por cima da
 * nuvem e "baixar" fazia o contrario. Treinar registrando no celular e depois
 * enviar do PC apagava o treino do celular, calado. Agora nada se perde: cada
 * linha e decidida pelo proprio carimbo de tempo, e so some de verdade o que
 * tem lapide (ver lib/fundir.ts).
 */
export function fundirBackups(localBruto: Backup, nuvemBruto: Backup): Backup {
  /**
   * `nuvem` pode ter sido gravada por outra versao do app (ou, em tese, por um
   * payload de conta comprometida) - filtra linha invalida ANTES de fundir,
   * senao ela entra no resultado como se fosse valida e acaba publicada de
   * volta pra nuvem e gravada neste aparelho. `local` sai do proprio banco
   * deste aparelho, mas sanitiza igual: barato, e cobre um IndexedDB que
   * tenha ficado com lixo de antes desta checagem existir.
   */
  const local = { ...localBruto, dados: sanitizarDados(localBruto.dados) }
  const nuvem = { ...nuvemBruto, dados: sanitizarDados(nuvemBruto.dados) }

  const lapides = fundirLapides(
    (local.dados.apagados ?? []) as Lapide[],
    (nuvem.dados.apagados ?? []) as Lapide[],
  )

  const dados: Record<string, unknown[]> = {}
  for (const t of TABELAS) {
    if (t === 'apagados') continue
    // perfil e uma linha SO que junta saude, metas, lembretes e gamificacao -
    // fundir por linha inteira faria editar uma coisa aqui apagar outra
    // editada no outro aparelho. fundirPerfil funde campo a campo. Ver lib/fundir.ts.
    dados[t] = t === 'perfil'
      ? fundirPerfil(local.dados[t] as ComCamposEm[], nuvem.dados[t] as ComCamposEm[])
      : fundirTabela(
          (local.dados[t] ?? []) as LinhaSync[],
          (nuvem.dados[t] ?? []) as LinhaSync[],
          lapidesDe(lapides, t),
        )
  }
  dados.apagados = lapides

  return { app: 'onemore', versao: VERSAO_BACKUP, criadoEm: new Date().toISOString(), dados }
}

export interface ResultadoSync {
  quando: Date
  /** true = a nuvem estava vazia, entao este aparelho so publicou o que tinha. */
  primeiraVez: boolean
  /** Quantos registros entraram neste aparelho vindos da nuvem. */
  recebidos: number
  /** true = nada mudou dos dois lados, nem precisou reenviar. */
  semNovidade: boolean
}

/**
 * O caminho normal de sincronizar. Baixa, funde, grava aqui e publica - tudo
 * numa operacao so, pra nao existir mais "enviar por engano" nem "baixar por
 * engano".
 */
export async function sincronizar(): Promise<ResultadoSync> {
  const nuvem = await espiar()
  const local = await exportar()

  if (!nuvem) {
    await publicar(local)
    return { quando: marcarSync(), primeiraVez: true, recebidos: 0, semNovidade: false }
  }

  const fundido = fundirBackups(local, nuvem.backup)

  // quais tabelas a fusao mudou deste lado: so essas sao reescritas
  const mudadas = TABELAS.filter(t => mudouTabela(local.dados[t] ?? [], fundido.dados[t] ?? []))
  const mudouAqui = mudadas.length > 0
  // semAvisarEscrita: gravar o que veio da nuvem nao pode contar como mudanca
  // local, senao o aparelho publica o eco e os dois se cutucam sem parar
  if (mudouAqui) await semAvisarEscrita(() => importar(fundido, mudadas))

  const mudouLa = assinatura(fundido.dados) !== assinatura(nuvem.backup.dados)
  if (mudouLa) await publicar(fundido)
  else marcarVersaoNuvem(nuvem.atualizadoEm)

  const recebidos = mudouAqui ? contar(fundido.dados) - contar(local.dados) : 0
  return {
    quando: marcarSync(),
    primeiraVez: false,
    recebidos: Math.max(0, recebidos),
    semNovidade: !mudouAqui && !mudouLa,
  }
}

const contar = (d: Record<string, unknown[]>) =>
  Object.values(d).reduce((t, linhas) => t + (linhas?.length ?? 0), 0)

async function publicar(backup: Backup) {
  const r = await chamar<{ atualizadoEm: string }>('/dados', {
    method: 'PUT',
    body: JSON.stringify({ payload: backup }),
  })
  // guarda o carimbo que o servidor acabou de gravar: e ele que a consulta
  // barata compara pra saber se a novidade la e nossa ou de outro aparelho
  if (r?.atualizadoEm) marcarVersaoNuvem(new Date(r.atualizadoEm))
}

function marcarSync(): Date {
  const agora = new Date()
  localStorage.setItem('onemore:sync', agora.toISOString())
  // deu certo: o que falhou antes virou historia
  localStorage.removeItem(CHAVE_FALHA)
  // aproveita a visita pra jogar fora lapide antiga demais pra importar
  limparLapidesVelhas().catch(() => {})
  return agora
}

export interface DadosNuvem { atualizadoEm: Date; backup: Backup }

export async function espiar(): Promise<DadosNuvem | null> {
  const r = await chamar<{ payload: Backup; atualizadoEm: string }>('/dados')
  if (!r) return null
  return { atualizadoEm: new Date(r.atualizadoEm), backup: r.payload }
}

export function ultimoSync(): Date | null {
  const s = localStorage.getItem('onemore:sync')
  return s ? new Date(s) : null
}

/* ------------------------------------------------------------------ */
/* ULTIMA FALHA DO SYNC AUTOMATICO                                     */
/* ------------------------------------------------------------------ */

const CHAVE_FALHA = 'onemore:sync-falha'

export interface FalhaSync { mensagem: string; quando: Date }

/**
 * O sync automatico engole erro de proposito - quem esta no meio de uma serie
 * nao merece um alerta na cara. Mas engolir sem deixar rastro foi o que fez um
 * bug de sincronizacao passar despercebido: o app tentava, falhava e nao
 * sobrava nada em lugar nenhum. Agora a ultima falha fica guardada e aparece em
 * Perfil > Sua conta, sem interromper ninguem.
 */
function registrarFalha(e: unknown) {
  try {
    localStorage.setItem(CHAVE_FALHA, JSON.stringify({
      mensagem: (e as Error)?.message || String(e),
      quando: new Date().toISOString(),
    }))
  } catch { /* storage cheio ou bloqueado nao e motivo pra derrubar o sync */ }
}

export function ultimaFalhaSync(): FalhaSync | null {
  const bruto = localStorage.getItem(CHAVE_FALHA)
  if (!bruto) return null
  try {
    const { mensagem, quando } = JSON.parse(bruto)
    return { mensagem, quando: new Date(quando) }
  } catch { return null }
}

/* ------------------------------------------------------------------ */
/* SINCRONIZACAO AUTOMATICA E CONTINUA                                 */
/* ------------------------------------------------------------------ */

/** Espera depois da ultima escrita antes de publicar. Junta a rajada de
 *  gravacoes de uma acao so (concluir treino grava sessao, xp e melhores). */
const ESPERA_ESCRITA_MS = 3000

/** Respiro depois de uma sincronizacao, pra dois gatilhos quase simultaneos
 *  nao virarem duas rodadas coladas. */
const RESPIRO_MS = 1500

/** Debounce dos gatilhos baratos (foco, internet de volta). */
const ESPERA_GATILHO_MS = 300

/** De quanto em quanto tempo perguntar "mudou?" com o app na tela. */
const INTERVALO_CONSULTA_MS = 10_000

const CHAVE_VERSAO = 'onemore:nuvem'

const marcarVersaoNuvem = (d: Date | null) => {
  if (d) localStorage.setItem(CHAVE_VERSAO, d.toISOString())
}

/**
 * Pergunta ao servidor so o carimbo de tempo da nuvem - algumas dezenas de
 * bytes, contra o estado inteiro do `espiar()`. E o que torna viavel perguntar
 * de 10 em 10 segundos.
 */
async function novidadeNaNuvem(): Promise<boolean> {
  const r = await chamar<{ atualizadoEm: string | null }>('/dados/versao')
  const remoto = r?.atualizadoEm ?? null
  // nuvem vazia: so ha novidade se este aparelho tem algo pra publicar
  if (!remoto) return true
  return remoto !== localStorage.getItem(CHAVE_VERSAO)
}

/**
 * Sincroniza sem incomodar: so se houver conta e internet. Engole erro de
 * proposito - se a rede caiu, isso e problema de agora e nao motivo pra jogar
 * um alerta na cara de quem esta no meio de uma serie -, mas guarda a falha
 * (ver ultimaFalhaSync).
 *
 * Nao ha mais recusa por treino em andamento: com o `importar` gravando so as
 * tabelas que a fusao mudou, o caso comum ficou barato o bastante pra rodar no
 * meio do descanso. A recusa antiga era permanente na pratica - uma sessao
 * abandonada pela metade desligava o sync daquele aparelho pra sempre.
 */
export async function sincronizarEmSilencio(): Promise<ResultadoSync | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null

  try {
    if (!(await usuarioAtual())) return null
    return await sincronizar()
  } catch (e) {
    registrarFalha(e)
    return null
  }
}

/**
 * Liga a sincronizacao continua. Sao tres gatilhos, e cada um fecha um buraco
 * diferente:
 *
 * - ESCRITA daqui: qualquer gravacao no banco agenda uma publicacao poucos
 *   segundos depois. Sem isto, mexer no PC e continuar no PC nao mandava nada
 *   pra lugar nenhum - so saia do aparelho quando voce trocasse de aba.
 * - CONSULTA periodica: com o app na tela, pergunta de 10 em 10s se a nuvem
 *   mudou (resposta minuscula) e so entao sincroniza de verdade. E o que faz o
 *   celular parado na mesa se atualizar sozinho.
 * - FOCO e INTERNET: voltar pro app e reconectar continuam disparando, que e o
 *   que cobre o aparelho que estava fechado.
 *
 * Com o app FECHADO nada chega - isso exigiria servidor de Web Push.
 *
 * Devolve a funcao que desliga tudo.
 */
export function iniciarSyncAutomatico(aoSincronizar?: (r: ResultadoSync) => void) {
  let vivo = true
  let rodando = false
  let pendente = false
  let agendado: ReturnType<typeof setTimeout> | null = null

  /**
   * Agenda uma rodada, juntando pedidos proximos num so. Todo gatilho passa
   * por aqui - ninguem chama `executar` direto.
   */
  const agendar = (espera: number) => {
    if (!vivo) return
    if (agendado) clearTimeout(agendado)
    agendado = setTimeout(() => { agendado = null; executar() }, espera)
  }

  /**
   * Pedido que chega com outra rodada em andamento NAO e descartado: fica
   * pendente e roda em seguida. Descartar era um jeito silencioso de perder
   * mudanca - voce mexia em algo bem no meio de uma sincronizacao e aquilo
   * ficava parado no aparelho ate o proximo gatilho, sem sinal nenhum.
   */
  async function executar() {
    if (!vivo) return
    if (rodando) { pendente = true; return }

    rodando = true
    try {
      const r = await sincronizarEmSilencio()
      if (r && vivo && aoSincronizar) aoSincronizar(r)
    } finally {
      rodando = false
    }

    if (pendente && vivo) {
      pendente = false
      agendar(RESPIRO_MS)
    }
  }

  /** Gravou algo aqui: publica depois que a rajada passar. */
  const aoEscrever = () => agendar(ESPERA_ESCRITA_MS)

  /**
   * Pergunta barata; so sincroniza de verdade se a nuvem mudou. E o que faz o
   * aparelho parado na mesa se atualizar sozinho.
   */
  const consultar = async () => {
    if (!vivo || rodando || document.visibilityState !== 'visible') return
    try {
      if (await novidadeNaNuvem()) await executar()
    } catch { /* rede instavel: a proxima consulta tenta de novo */ }
  }

  const aoVoltar = () => {
    if (document.visibilityState === 'visible') agendar(ESPERA_GATILHO_MS)
  }
  const aoVoltarInternet = () => agendar(ESPERA_GATILHO_MS)

  const desligarEscuta = escutarEscrita(aoEscrever)
  const timer = setInterval(consultar, INTERVALO_CONSULTA_MS)

  executar()
  document.addEventListener('visibilitychange', aoVoltar)
  window.addEventListener('online', aoVoltarInternet)

  return () => {
    vivo = false
    if (agendado) clearTimeout(agendado)
    clearInterval(timer)
    desligarEscuta()
    document.removeEventListener('visibilitychange', aoVoltar)
    window.removeEventListener('online', aoVoltarInternet)
  }
}
