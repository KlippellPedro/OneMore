import {
  db, normalizarFlags, limparLapidesVelhas, escutarEscrita, semAvisarEscrita,
  apagarLinhas, hoje, PERFIL_PADRAO, type TabelaSync,
} from '../db'
import { resetarCacheSeed, rodarSeed, CHAVE_SETUP } from '../db/seed'
import { EXERCICIOS_SEED } from '../db/seedExercicios'
import { ALIMENTOS_SEED } from '../db/seedAlimentos'
import type { Perfil } from '../db/types'
import { reconstruirMelhores } from './acoes'
import { reconstruirGamificacao } from './xp'
import { regerarAgenda } from './lembretes'
import { desligarPush } from './push'
import { baixarJSON } from './arquivo'
import {
  fundirTabela, fundirPerfil, fundirLapides, lapidesDe, assinatura, mudouTabela, sanitizarDados,
  setupDeFabricaIntacto, semSetupDeFabrica,
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
  'dieta', 'corpo', 'xp', 'perfil', 'agua', 'glicemia', 'semanas',
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
  // hoje() e nao toISOString(): o UTC poe a data de amanha no backup feito depois das 21h
  baixarJSON(`onemore-backup-${hoje()}.json`, await exportar())
  localStorage.setItem(CHAVE_ULTIMO_BACKUP, String(Date.now()))
}

const CHAVE_ULTIMO_BACKUP = 'onemore:ultimoBackup'

/** Quando o ultimo arquivo de backup foi baixado neste aparelho (null = nunca). */
export function ultimoBackup(): Date | null {
  const v = Number(localStorage.getItem(CHAVE_ULTIMO_BACKUP))
  return v > 0 ? new Date(v) : null
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
    throw new Error('Esse arquivo não é um backup do OneMore.')
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

/**
 * Limpa ESTE aparelho - lapides inclusive. So serve pra quem nao sincroniza:
 * com conta, a proxima fusao junta o aparelho vazio com a nuvem cheia e traz
 * tudo de volta. Quem tem conta passa por apagarTudoNaConta.
 */
export async function apagarTudo() {
  for (const t of [...TABELAS, ...TABELAS_DERIVADAS]) await limpar(t)
  localStorage.removeItem('onemore:seed')
  // nao sobrou nada de conta nenhuma aqui: a proxima conta a entrar nao tem com quem conflitar
  localStorage.removeItem(CHAVE_DONO)
  resetarCacheSeed()
}

/** O que a pessoa criou e pode levar lapide inteiro. Catalogo fica de fora - ver abaixo. */
const CRIADAS_PELA_PESSOA: TabelaSync[] = [
  'rotinas', 'sessoes', 'planos', 'dietas', 'dieta', 'corpo', 'xp', 'agua', 'glicemia', 'semanas',
]

/**
 * "Apagar tudo" de quem tem conta. Em vez de limpar, apaga do jeito que a
 * fusao entende - e por isso apaga tambem na nuvem e nos outros aparelhos,
 * na proxima sincronizacao de cada um:
 *
 * - lapide pra cada linha do que a pessoa criou;
 * - catalogo (exercicios e alimentos): so o que a pessoa criou leva lapide.
 *   O que veio do seed volta em toda abertura do app, com carimbo 0, e uma
 *   lapide o mataria na fusao pra sempre. Ele volta limpo, com carimbo novo -
 *   e o que vence o favorito e o video que o outro aparelho ainda tem;
 * - perfil: zera com carimbo novo em TODO campo, inclusive os que o padrao
 *   nao tem (restricoes, lembretes, saude). Campo sem carimbo novo voltaria
 *   do outro aparelho, um por um, na fusao campo a campo (fundirPerfil).
 *
 * As gravacoes avisam a sincronizacao como qualquer outra. Quem chama roda o
 * seed depois, igual ao apagarTudo, pra montar o setup inicial de novo.
 */
export async function apagarTudoNaConta() {
  const agora = Date.now()

  for (const t of CRIADAS_PELA_PESSOA) {
    await apagarLinhas(t, (await db.table(t).toCollection().primaryKeys()) as string[])
  }

  await apagarLinhas('exercicios',
    (await db.exercicios.toArray()).filter(e => e.custom).map(e => e.id))
  await apagarLinhas('alimentos',
    (await db.alimentos.toArray()).filter(a => a.custom).map(a => a.id))
  await db.exercicios.bulkPut(EXERCICIOS_SEED.map(s => ({ ...s, atualizadoEm: agora })))
  await db.alimentos.bulkPut(ALIMENTOS_SEED.map(s => ({ ...s, atualizadoEm: agora })))

  const antes = await db.perfil.get('me')
  const campos = new Set([...Object.keys(antes ?? {}), ...Object.keys(PERFIL_PADRAO)])
  for (const c of ['id', 'atualizadoEm', 'camposEm']) campos.delete(c)
  const zerado: Record<string, unknown> = {}
  const camposEm: Record<string, number> = {}
  for (const c of campos) {
    // undefined pro que o padrao nao tem - com carimbo, e isso que a fusao leva
    zerado[c] = (PERFIL_PADRAO as unknown as Record<string, unknown>)[c]
    camposEm[c] = agora
  }
  await db.perfil.put({ ...zerado, id: 'me', atualizadoEm: agora, camposEm } as unknown as Perfil)

  for (const t of TABELAS_DERIVADAS) await limpar(t)
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

/** Erro da API com o status HTTP junto: a tela decide o que fazer (ex.: 409 = e-mail ja tem conta). */
export class ErroApi extends Error {
  status: number
  constructor(mensagem: string, status: number) {
    super(mensagem)
    this.status = status
  }
}

/** Exportado pra lib/amigos.ts: mesma sessao, mesmo tratamento de erro. */
export async function chamar<T>(rota: string, init: RequestInit = {}): Promise<T | null> {
  let r: Response
  try {
    r = await fetch(API + rota, {
      ...init,
      credentials: 'include',
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    })
  } catch {
    throw new Error('Sem conexão com o servidor.')
  }

  if (r.status === 204) return null
  const texto = await r.text()
  let corpo: { erro?: string } | null = null
  try {
    corpo = texto ? JSON.parse(texto) : null
  } catch {
    // resposta que nao e JSON (pagina de erro do proxy): cai na mensagem generica abaixo
  }
  if (!r.ok) throw new ErroApi(corpo?.erro ?? `Erro ${r.status}.`, r.status)
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

/**
 * Sai e esquece as marcas de sincronizacao deste aparelho. "Ja sincronizou
 * aqui" e o que o Apagar tudo usa, sem internet, pra saber se o aparelho esta
 * ligado a uma conta - quem saiu nao esta mais.
 */
export async function sair() {
  /**
   * A publicacao automatica espera alguns segundos depois da ultima escrita
   * (ESPERA_ESCRITA_MS). Sair nesse intervalo deixava a ultima serie ou o
   * ultimo alimento so neste aparelho - e, se a proxima conta a entrar aqui
   * escolher comecar limpo, isso se perdia. Sobe antes de largar a sessao.
   */
  await sincronizarEmSilencio().catch(() => {})
  // ANTES de encerrar a sessao: apagar a inscricao exige estar logado. Quem
  // saiu nao pode continuar recebendo os lembretes da conta neste aparelho
  await desligarPush().catch(() => {})
  await chamar('/sessao', { method: 'DELETE' })
  // onemore:cartao e a marca do ultimo cartao de amigos enviado (lib/amigos.ts):
  // a proxima conta a entrar aqui precisa mandar o dela, nao herdar a marca.
  // CHAVE_DONO fica de proposito: os dados continuam aqui e continuam sendo da
  // conta que saiu - e o que impede de irem parar na proxima (ver sincronizar)
  for (const chave of ['onemore:sync', CHAVE_VERSAO, CHAVE_FALHA, 'onemore:cartao']) localStorage.removeItem(chave)
}

/**
 * Apaga a conta e tudo que esta na nuvem (exige a senha). Os dados deste
 * aparelho ficam: o app continua funcionando offline, so sem conta.
 */
export async function excluirConta(senha: string) {
  // quem esta sendo excluida - antes de excluir, depois nao ha mais sessao pra perguntar
  const eu = await usuarioAtual().catch(() => null)
  // primeiro a conta: com a senha errada nada pode mudar (nem o push deste aparelho)
  await chamar('/conta', { method: 'DELETE', body: JSON.stringify({ senha }) })
  // o servidor ja esqueceu a inscricao (cascade); falta o navegador parar de receber
  await desligarPush().catch(() => {})
  // onemore:cartao e a marca do ultimo cartao de amigos enviado (lib/amigos.ts):
  // a proxima conta a entrar aqui precisa mandar o dela, nao herdar a marca.
  for (const chave of ['onemore:sync', CHAVE_VERSAO, CHAVE_FALHA, 'onemore:cartao']) localStorage.removeItem(chave)
  /**
   * A marca de dono so sai se os dados daqui eram DESTA conta - ai sao so da
   * pessoa, e uma conta nova pode adota-los. Se eram de outra (B entrou no
   * celular de A, viu o aviso e excluiu a propria conta), apagar a marca
   * deixava os dados de A sem dono, e a proxima conta a entrar os levava.
   */
  if (eu && donoDosDados() === eu.email) localStorage.removeItem(CHAVE_DONO)
}

/* ------------------------------------------------------------------ */
/* DE QUEM SAO OS DADOS DESTE APARELHO                                 */
/* ------------------------------------------------------------------ */

/**
 * O e-mail da conta com que os dados deste aparelho foram sincronizados por
 * ultimo. Fica guardado mesmo depois de sair, e e isso que segura o caso do
 * aparelho compartilhado: sem esta marca, a pessoa B entrava no celular onde A
 * tinha saido e a primeira sincronizacao FUNDIA os treinos, a dieta, o peso e
 * a glicemia de A dentro da conta de B - e mandava tudo pra nuvem dela (e pro
 * treinador dela). Aparelho que nunca sincronizou nao tem dono: entrar ou criar
 * conta leva os dados daqui pra conta, que e o que se espera.
 */
const CHAVE_DONO = 'onemore:dono'

export const donoDosDados = () => localStorage.getItem(CHAVE_DONO)

/** A conta logada nao e a dona dos dados deste aparelho - ver CHAVE_DONO. */
export class ErroOutraConta extends Error {
  dono: string
  conta: string
  constructor(dono: string, conta: string) {
    super(`Este aparelho tem os dados de ${dono}. Escolha em Perfil > Sua conta o que fazer com eles antes de sincronizar ${conta}.`)
    this.dono = dono
    this.conta = conta
  }
}

/**
 * Comecar limpo na conta logada: apaga ESTE aparelho (os dados da conta
 * anterior continuam salvos na nuvem dela) e traz os da conta atual. O setup de
 * fabrica que o seed monta logo depois perde pra conta na primeira fusao, como
 * num aparelho novo (ver setupDeFabricaIntacto).
 */
export async function comecarLimpoNaConta(conta: string): Promise<ResultadoSync> {
  /**
   * Confere ANTES de apagar: este passo tira do aparelho os dados de outra
   * conta, e so faz sentido se `conta` ainda esta logada. Se a sessao caiu,
   * a pessoa saiu ou excluiu a conta com o aviso aberto, apagar primeiro e
   * descobrir depois (no sincronizar) deixava o aparelho vazio e a conta
   * inexistente - os dados de quem era dono se perdiam daqui sem ir pra lugar
   * nenhum.
   */
  const logada = await usuarioAtual()
  if (logada?.email !== conta) {
    throw new ErroApi('Você não está mais nessa conta. Entre de novo pra escolher.', 401)
  }
  await apagarTudo()
  await rodarSeed()
  return sincronizar({ conta })
}

/** Levar o que esta neste aparelho pra conta logada, de proposito. */
export const juntarNaConta = (conta: string) => sincronizar({ conta, juntarOutraConta: true })

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

  /**
   * Tabela que esta versao nao conhece (veio de uma versao mais nova do app,
   * noutro aparelho) passa adiante intacta. Sem isto, o aparelho desatualizado
   * publicava a fusao sem ela e apagava da nuvem, por exemplo, as semanas de
   * treino salvas no aparelho novo. Nada disso e gravado aqui: `importar` so
   * escreve as TABELAS.
   */
  for (const [t, linhas] of Object.entries(nuvem.dados)) {
    if (!(t in dados)) dados[t] = linhas
  }

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
export async function sincronizar(opcoes: {
  /** E-mail da conta logada, se quem chama ja sabe - poupa uma ida ao /eu. */
  conta?: string
  /** A pessoa escolheu levar os dados de outra conta (CHAVE_DONO) pra esta. */
  juntarOutraConta?: boolean
} = {}): Promise<ResultadoSync> {
  const conta = opcoes.conta ?? (await usuarioAtual())?.email
  if (!conta) throw new ErroApi('Entre na sua conta.', 401)
  const dono = donoDosDados()
  if (dono && dono !== conta && !opcoes.juntarOutraConta) throw new ErroOutraConta(dono, conta)

  const nuvem = await espiar()
  const local = await exportar()

  if (!nuvem) {
    await publicar(local)
    localStorage.setItem(CHAVE_DONO, conta)
    return { quando: marcarSync(), primeiraVez: true, recebidos: 0, semNovidade: false }
  }

  /**
   * Aparelho que so tem o setup de fabrica (instalacao nova, ou dados do
   * navegador apagados): a conta manda. Fundir daria ao padrao recem-criado, com
   * carimbo de agora, o direito de vencer o perfil e as edicoes da conta, e
   * treino e dieta apareceriam em dobro. Compara com `local` de verdade (nao
   * com o vazio) abaixo, entao a tabela de fabrica e substituida pela da conta.
   */
  const setupEm = Number(localStorage.getItem(CHAVE_SETUP)) || null
  const deFabrica = setupDeFabricaIntacto(local.dados, setupEm)
  const fundido = fundirBackups(
    deFabrica ? { ...local, dados: semSetupDeFabrica(local.dados) } : local,
    nuvem.backup,
  )

  // quais tabelas a fusao mudou deste lado: so essas sao reescritas
  const mudadas = TABELAS.filter(t => mudouTabela(local.dados[t] ?? [], fundido.dados[t] ?? []))
  const mudouAqui = mudadas.length > 0
  // semAvisarEscrita: gravar o que veio da nuvem nao pode contar como mudanca
  // local, senao o aparelho publica o eco e os dois se cutucam sem parar
  if (mudouAqui) await semAvisarEscrita(() => importar(fundido, mudadas))

  const mudouLa = assinatura(fundido.dados) !== assinatura(nuvem.backup.dados)
  if (mudouLa) await publicar(fundido)
  else marcarVersaoNuvem(nuvem.atualizadoEm)
  // daqui em diante o que esta neste aparelho e desta conta
  localStorage.setItem(CHAVE_DONO, conta)

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
  // o aparelho ja foi juntado com a conta: o que vier daqui pra frente e dele
  localStorage.removeItem(CHAVE_SETUP)
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

export interface FalhaSync {
  mensagem: string
  quando: Date
  /** A falha foi o aviso de dados de outra conta - so a escolha da pessoa resolve. */
  outraConta?: boolean
}

/**
 * O sync automatico engole erro de proposito - quem esta no meio de uma serie
 * nao merece um alerta na cara. Mas engolir sem deixar rastro foi o que fez um
 * bug de sincronizacao passar despercebido: o app tentava, falhava e nao
 * sobrava nada em lugar nenhum. Agora a ultima falha fica guardada e aparece em
 * Perfil > Sua conta, sem interromper ninguem.
 */
/**
 * O texto que aparece em Perfil > Sua conta. "Erro 502." nao diz nada pra
 * quem usa o app: falha do servidor vira uma frase, o resto segue como veio.
 */
function mensagemDeFalha(e: unknown): string {
  if (e instanceof ErroApi && e.status >= 500) return 'O servidor não respondeu. O que você anotou está salvo aqui e sobe assim que ele voltar.'
  return (e as Error)?.message || String(e)
}

function registrarFalha(e: unknown) {
  try {
    localStorage.setItem(CHAVE_FALHA, JSON.stringify({
      mensagem: mensagemDeFalha(e),
      quando: new Date().toISOString(),
      outraConta: e instanceof ErroOutraConta,
    }))
  } catch { /* storage cheio ou bloqueado nao e motivo pra derrubar o sync */ }
}

export function ultimaFalhaSync(): FalhaSync | null {
  const bruto = localStorage.getItem(CHAVE_FALHA)
  if (!bruto) return null
  try {
    const { mensagem, quando, outraConta } = JSON.parse(bruto)
    return { mensagem, quando: new Date(quando), outraConta: outraConta === true }
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
    const u = await usuarioAtual()
    if (!u) return null
    return await sincronizar({ conta: u.email })
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
    // sem nunca ter sincronizado aqui (sem conta, ou saiu dela) nao ha nuvem
    // pra consultar: era uma requisicao a cada 10 s, pra sempre, so pra tomar
    // 401. Entrar na conta sincroniza na hora e a marca passa a existir
    if (!ultimoSync()) return
    try {
      /**
       * A nuvem nao mudou, mas a ultima tentativa daqui FALHOU (servidor fora,
       * erro 5xx): o que foi gravado nesse meio tempo ainda nao subiu. So a
       * pergunta "mudou la?" nunca mandava isso - ficava parado ate a proxima
       * escrita ou troca de aba, e o outro aparelho nao via o treino. Com o
       * servidor ainda fora, `novidadeNaNuvem` estoura antes e nada roda: nao
       * vira martelada de 10 em 10 s.
       *
       * O conflito de conta (ErroOutraConta) nao entra: ele so se resolve com
       * a escolha da pessoa, e tentar de novo sozinho nao mudaria nada.
       */
      const falha = ultimaFalhaSync()
      const pendente = falha != null && !falha.outraConta
      if ((await novidadeNaNuvem()) || pendente) await executar()
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
