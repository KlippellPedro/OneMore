/**
 * Inscricao deste aparelho no Web Push do servidor (servidor/push.js).
 *
 * E o que faz o lembrete chegar NA HORA com o app fechado - no Android e no
 * iPhone (iOS 16.4+, com o app instalado na Tela de Inicio). O servidor guarda
 * a agenda por conta, entao precisa estar logado; sem conta, sobra o rodizio
 * com o app aberto e o Periodic Background Sync do Android (lib/lembretes.ts).
 */

const API = '/api/push'

export const temPush = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator
  && 'PushManager' in window && 'Notification' in window

/**
 * Este aparelho ja sincronizou com uma conta - a marca que lib/sync.ts grava a
 * cada sincronizacao e sair() apaga. Evita bater no servidor a cada 15 min so
 * pra ouvir "entre na sua conta" de quem nunca criou uma.
 */
export const temConta = () => localStorage.getItem('onemore:sync') != null

async function api<T>(metodo: string, rota: string, corpo?: unknown): Promise<T> {
  const r = await fetch(API + rota, {
    method: metodo,
    credentials: 'include',
    headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const texto = await r.text()
  const json = texto ? JSON.parse(texto) : null
  if (!r.ok) throw Object.assign(new Error(json?.erro ?? `Erro ${r.status}.`), { status: r.status })
  return json as T
}

/**
 * O service worker deste app. getRegistration e nao `ready`: no `npm run dev`
 * nao existe service worker, e `ready` ficaria esperando pra sempre.
 */
const registro = () => navigator.serviceWorker.getRegistration()

export async function inscricaoAtual(): Promise<PushSubscription | null> {
  if (!temPush()) return null
  return (await (await registro())?.pushManager.getSubscription()) ?? null
}

/** A chave VAPID vem em base64url; o navegador quer os bytes. */
function bytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return Uint8Array.from(bin, c => c.charCodeAt(0))
}

const mesmosBytes = (a: ArrayBuffer | null, b: Uint8Array) => {
  if (!a || a.byteLength !== b.length) return false
  const x = new Uint8Array(a)
  return x.every((v, i) => v === b[i])
}

/**
 * Liga o push neste aparelho: inscreve no servico de push do navegador e
 * entrega a inscricao pro servidor. false = nao da aqui (sem suporte, sem
 * notificacao liberada, sem service worker). Erro de rede ou de login sobe.
 */
export async function ligarPush(): Promise<boolean> {
  if (!temPush() || Notification.permission !== 'granted') return false
  const reg = await registro()
  if (!reg) return false
  const { chave } = await api<{ chave: string }>('GET', '/chave')
  const chaveBytes = bytes(chave)

  let insc = await reg.pushManager.getSubscription()
  // inscricao feita com outra chave nao recebe nada desta: refaz
  if (insc && !mesmosBytes(insc.options.applicationServerKey, chaveBytes)) {
    await insc.unsubscribe()
    insc = null
  }
  insc ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes })
  await api('POST', '/inscricao', insc.toJSON())
  return true
}

/** Sai do push: o servidor esquece este aparelho e o navegador tambem. */
export async function desligarPush() {
  const insc = await inscricaoAtual()
  if (!insc) return
  await api('DELETE', '/inscricao', { endpoint: insc.endpoint }).catch(() => {})
  await insc.unsubscribe().catch(() => {})
}

export interface AvisoPush {
  id: string
  ts: number
  tipo: string
  titulo: string
  corpo: string
  rota: string
}

/** Troca a agenda deste aparelho no servidor. false = nao ha inscricao aqui. */
export async function enviarAgenda(itens: AvisoPush[]): Promise<boolean> {
  const insc = await inscricaoAtual()
  if (!insc) return false
  try {
    await api('PUT', '/agenda', { endpoint: insc.endpoint, itens })
  } catch (e) {
    // o servidor nao conhece a inscricao (expirou, ou o aparelho trocou de conta): refaz e manda de novo
    if ((e as { status?: number }).status !== 404 || !(await ligarPush())) throw e
    const nova = await inscricaoAtual()
    await api('PUT', '/agenda', { endpoint: nova!.endpoint, itens })
  }
  return true
}

/** Pede pro servidor mandar um aviso agora - prova que o caminho inteiro funciona. */
export async function testarPush() {
  const insc = await inscricaoAtual()
  if (!insc) throw new Error('Este aparelho ainda não está inscrito.')
  await api('POST', '/teste', { endpoint: insc.endpoint })
}
