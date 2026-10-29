/**
 * Web Push: o servidor manda o lembrete na hora certa, com o app fechado.
 *
 * Sem isto, quem acordava o app fechado era o Periodic Background Sync do
 * Android - que so existe no Chrome com o app instalado, decide sozinho quando
 * rodar (na pratica, horas de atraso) e nao existe no iPhone. Aqui o aparelho
 * manda a AGENDA dele (os proximos avisos, ja com titulo e texto - quem sabe
 * montar e o app, ver lib/lembretes.ts) e o servidor so entrega cada um no
 * horario. O service worker ainda confere, na chegada, se o aviso continua
 * valendo (ver public/lembretes-sw.js).
 *
 * As chaves VAPID (que provam pro servico de push que o aviso vem daqui) sao
 * geradas na primeira subida e ficam no banco: sem passo manual, e iguais em
 * todo reinicio - trocar a chave invalidaria a inscricao de todo aparelho.
 */
import webpush from 'web-push'
import { consultar } from './banco.js'

/** Quem responde pelos avisos - o servico de push da Apple recusa sem isso. */
const CONTATO = process.env.VAPID_CONTATO || 'mailto:suporte@onemore.app'

/**
 * So os servicos de push dos navegadores. A URL vem do aparelho, e o servidor
 * faz POST nela: sem esta lista, qualquer conta poderia cadastrar um endereco
 * interno (http://localhost..., o IP de metadados da nuvem) e usar o servidor
 * pra fazer requisicao la dentro.
 */
const SERVICOS_PUSH = [
  'fcm.googleapis.com', 'android.googleapis.com', // Chrome, Edge no Android, Samsung
  'push.services.mozilla.com', // Firefox
  'push.apple.com', // Safari, iPhone
  'notify.windows.com', // Edge no Windows
]

export const MAX_AVISOS = 200
/** A agenda cobre 3 dias (regerarAgenda); um pouco de folga pra fuso e virada. */
const HORIZONTE_MS = 4 * 24 * 60 * 60 * 1000
/** Aviso que o servidor nao conseguiu entregar em meia hora ja perdeu o sentido. */
const ATRASO_MAXIMO = '30 minutes'
const TIPOS = new Set(['agua', 'refeicao', 'treino', 'glicemia'])

let chavePublica = null

/* ------------------------------------------------------------------ */
/* VALIDACAO (pura - testada em push.test.mjs)                         */
/* ------------------------------------------------------------------ */

const base64url = (s, min, max) =>
  typeof s === 'string' && s.length >= min && s.length <= max && /^[A-Za-z0-9_-]+=*$/.test(s)

/** A inscricao que o navegador entrega (PushSubscription.toJSON()), ou null se nao presta. */
export function validarInscricao(corpo) {
  const endpoint = corpo?.endpoint
  if (typeof endpoint !== 'string' || endpoint.length > 1024) return null
  let url
  try { url = new URL(endpoint) } catch { return null }
  if (url.protocol !== 'https:') return null
  const host = url.hostname
  if (!SERVICOS_PUSH.some(s => host === s || host.endsWith('.' + s))) return null
  const { p256dh, auth } = corpo.keys ?? {}
  // p256dh: ponto P-256 de 65 bytes (~87 em base64url); auth: 16 bytes (~22)
  if (!base64url(p256dh, 80, 100) || !base64url(auth, 16, 32)) return null
  return { endpoint, p256dh, auth }
}

const texto = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')

/**
 * Os avisos da agenda, limpos. O que vier estranho e descartado item a item
 * (nao derruba a agenda inteira), e o tamanho tem teto: e o servidor que vai
 * guardar e mandar isso.
 */
export function validarAgenda(itens, agora = Date.now()) {
  if (!Array.isArray(itens)) return []
  const saida = []
  for (const i of itens) {
    if (saida.length >= MAX_AVISOS) break
    const ts = Number(i?.ts)
    if (!Number.isFinite(ts) || ts < agora - 60_000 || ts > agora + HORIZONTE_MS) continue
    const id = texto(i.id, 100)
    const titulo = texto(i.titulo, 80)
    if (!id || !titulo || !TIPOS.has(i.tipo)) continue
    // a rota vira o endereco aberto ao tocar na notificacao: so dentro do app
    const rota = typeof i.rota === 'string' && /^#\/[\w/?=&-]*$/.test(i.rota) ? i.rota : '#/'
    saida.push({ id, ts, tipo: i.tipo, titulo, corpo: texto(i.corpo, 200), rota })
  }
  return saida
}

/* ------------------------------------------------------------------ */
/* BANCO                                                               */
/* ------------------------------------------------------------------ */

/** Le as chaves do ambiente ou do banco; gera e guarda na primeira vez. */
export async function iniciarPush() {
  let pub = process.env.VAPID_PUBLICA
  let priv = process.env.VAPID_PRIVADA
  if (!pub || !priv) {
    const { rows } = await consultar(
      "select chave, valor from config where chave in ('vapid_publica', 'vapid_privada')",
    )
    const salvo = Object.fromEntries(rows.map(r => [r.chave, r.valor]))
    if (salvo.vapid_publica && salvo.vapid_privada) {
      pub = salvo.vapid_publica
      priv = salvo.vapid_privada
    } else {
      const novas = webpush.generateVAPIDKeys()
      // "on conflict do nothing" + reler: dois processos subindo juntos ficam com a MESMA chave
      await consultar(
        `insert into config (chave, valor) values ('vapid_publica', $1), ('vapid_privada', $2)
         on conflict (chave) do nothing`,
        [novas.publicKey, novas.privateKey],
      )
      return iniciarPush()
    }
  }
  webpush.setVapidDetails(CONTATO, pub, priv)
  chavePublica = pub
  console.log('[push] chaves VAPID prontas')
}

export const chaveVapid = () => chavePublica

export async function salvarInscricao(usuarioId, insc) {
  // o mesmo aparelho pode trocar de conta: a inscricao passa pra quem entrou
  await consultar(
    `insert into push_inscricoes (endpoint, usuario_id, p256dh, auth) values ($1, $2, $3, $4)
     on conflict (endpoint) do update
       set usuario_id = excluded.usuario_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [insc.endpoint, usuarioId, insc.p256dh, insc.auth],
  )
}

export async function apagarInscricao(usuarioId, endpoint) {
  await consultar('delete from push_inscricoes where endpoint = $1 and usuario_id = $2', [endpoint, usuarioId])
}

/** Troca a agenda inteira do aparelho. false = esse endpoint nao e desta conta. */
export async function salvarAgenda(usuarioId, endpoint, itens) {
  const { rowCount } = await consultar(
    'select 1 from push_inscricoes where endpoint = $1 and usuario_id = $2', [endpoint, usuarioId],
  )
  if (!rowCount) return false
  // o que ja foi enviado fica (e o que impede mandar de novo); o resto e substituido
  await consultar('delete from push_avisos where endpoint = $1 and enviado_em is null', [endpoint])
  if (itens.length) {
    await consultar(
      `insert into push_avisos (endpoint, id, ts, payload)
       select $1, x.id, to_timestamp(x.ts / 1000.0), x.payload
         from jsonb_to_recordset($2::jsonb) as x(id text, ts double precision, payload jsonb)
       on conflict (endpoint, id) do nothing`,
      [endpoint, JSON.stringify(itens.map(i => ({ id: i.id, ts: i.ts, payload: i })))],
    )
  }
  return true
}

/* ------------------------------------------------------------------ */
/* ENVIO                                                               */
/* ------------------------------------------------------------------ */

export const opcoesEnvio = tipo => ({
  // celular sem sinal: o servico de push segura por 1 h; depois disso o aviso ja perdeu a hora
  TTL: 3600,
  // 'high' fura o modo soneca do Android (Doze) - lembrete atrasado nao serve
  urgency: 'high',
  // com o celular offline, so o ultimo aviso de cada tipo chega - nao uma pilha de "beba agua"
  topic: tipo,
})

async function enviar(insc, payload) {
  return webpush.sendNotification(
    { endpoint: insc.endpoint, keys: { p256dh: insc.p256dh, auth: insc.auth } },
    JSON.stringify(payload),
    opcoesEnvio(payload.tipo),
  )
}

/** Inscricao que o navegador matou (app desinstalado, permissao revogada). */
const morta = e => e?.statusCode === 404 || e?.statusCode === 410

/** Manda agora um aviso de teste pro aparelho - e o botao "Testar" da tela de lembretes. */
export async function enviarTeste(usuarioId, endpoint) {
  const { rows } = await consultar(
    'select endpoint, p256dh, auth from push_inscricoes where endpoint = $1 and usuario_id = $2',
    [endpoint, usuarioId],
  )
  if (!rows.length) return false
  const agora = new Date()
  const hora = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
  try {
    await enviar(rows[0], {
      id: `teste-${agora.getTime()}`, tipo: 'teste', titulo: 'Deu certo',
      corpo: `Chegou pelo servidor às ${hora}. Os lembretes vão chegar assim, mesmo com o app fechado.`,
      rota: '#/lembretes',
    })
  } catch (e) {
    if (morta(e)) await consultar('delete from push_inscricoes where endpoint = $1', [endpoint])
    throw e
  }
  return true
}

let rodando = false

/** Entrega o que venceu. Roda a cada 30 s (ver iniciarEntregas). */
export async function entregarVencidos() {
  if (rodando) return
  rodando = true
  try {
    const { rows } = await consultar(
      `select a.endpoint, a.id, a.payload, i.p256dh, i.auth
         from push_avisos a join push_inscricoes i on i.endpoint = a.endpoint
        where a.enviado_em is null and a.ts <= now() and a.ts > now() - interval '${ATRASO_MAXIMO}'
        order by a.ts limit 200`,
    )
    for (const r of rows) {
      try {
        await enviar(r, r.payload)
      } catch (e) {
        if (morta(e)) {
          await consultar('delete from push_inscricoes where endpoint = $1', [r.endpoint])
          continue
        }
        // erro passageiro (rede, 5xx, 429): fica pendente e tenta de novo no proximo giro
        console.error(`[push] falhou (${e?.statusCode ?? e?.message})`)
        continue
      }
      await consultar('update push_avisos set enviado_em = now() where endpoint = $1 and id = $2', [r.endpoint, r.id])
    }
    // historico de envio so serve pra nao mandar de novo: um dia basta
    await consultar("delete from push_avisos where ts < now() - interval '1 day'")
  } finally {
    rodando = false
  }
}

export function iniciarEntregas() {
  setInterval(() => {
    entregarVencidos().catch(e => console.error('[push] giro falhou:', e.message))
  }, 30_000)
}
