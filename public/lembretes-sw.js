/* eslint-disable no-undef */
/**
 * Parte do service worker que cuida dos lembretes.
 *
 * Entra no sw.js gerado pelo Workbox via `workbox.importScripts` (vite.config).
 * Roda quando o Android acorda o app pelo Periodic Background Sync - ou seja,
 * com o app fechado. Nao tem React, nao tem Dexie: le o IndexedDB na unha.
 *
 * A agenda (`lembretes`) ja vem com titulo e corpo prontos do app. Aqui so
 * confere se o aviso ainda faz sentido (ja bebeu? ja comeu? ja treinou?) e
 * mostra.
 */

const BANCO = 'onemore'
const MIN = 60000
const JANELA = 90 * MIN

async function abrirBanco() {
  // abrir um banco que nao existe CRIA um vazio, e ai o app tropeca na migracao
  if (indexedDB.databases) {
    const lista = await indexedDB.databases()
    if (!lista.some(b => b.name === BANCO)) throw new Error('banco ainda nao existe')
  }
  return new Promise((ok, erro) => {
    // sem versao: abre o que existir e nunca dispara upgrade (quem migra e o app)
    const req = indexedDB.open(BANCO)
    req.onsuccess = () => ok(req.result)
    req.onerror = () => erro(req.error)
    req.onblocked = () => erro(new Error('banco bloqueado'))
  })
}

function pedir(req) {
  return new Promise((ok, erro) => {
    req.onsuccess = () => ok(req.result)
    req.onerror = () => erro(req.error)
  })
}

function temLoja(bd, nome) {
  return Array.from(bd.objectStoreNames).includes(nome)
}

function ler(bd, loja) {
  if (!temLoja(bd, loja)) return Promise.resolve([])
  return pedir(bd.transaction(loja, 'readonly').objectStore(loja).getAll())
}

function lerUm(bd, loja, chave) {
  if (!temLoja(bd, loja)) return Promise.resolve(undefined)
  return pedir(bd.transaction(loja, 'readonly').objectStore(loja).get(chave))
}

function marcarDisparado(bd, lembrete) {
  return new Promise(ok => {
    const tx = bd.transaction('lembretes', 'readwrite')
    tx.objectStore('lembretes').put({ ...lembrete, disparadoEm: Date.now() })
    tx.oncomplete = ok
    tx.onerror = ok
    tx.onabort = ok
  })
}

function diaDe(ts) {
  const d = new Date(ts)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const umDecimal = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Mesma regra do app (lib/lembretes.ts): nao cobra o que ja foi feito. */
async function avaliar(bd, l) {
  if (l.tipo === 'agua') {
    const a = await lerUm(bd, 'agua', l.data)
    const ml = (a && a.ml) || 0
    const meta = l.metaMl || 0
    if (meta > 0 && ml >= meta) return null
    if (ml > 0) {
      const falta = meta - ml
      const quanto = falta >= 1000 ? `${umDecimal(falta / 1000)} L` : `${Math.round(falta)} ml`
      return `Voce bebeu ${umDecimal(ml / 1000)} L - faltam ${quanto}`
    }
    return l.corpo
  }

  if (l.tipo === 'refeicao') {
    const doDia = (await ler(bd, 'dieta')).filter(r => r.data === l.data)
    return doDia.some(r => r.refeicao === l.ref) ? null : l.corpo
  }

  if (l.tipo === 'treino') {
    const sessoes = await ler(bd, 'sessoes')
    const treinou = sessoes.some(s => s.concluida && diaDe(s.inicio) === l.data)
    return treinou ? null : l.corpo
  }

  if (l.tipo === 'glicemia') {
    const doDia = (await ler(bd, 'glicemia')).filter(g => g.data === l.data)
    return doDia.some(g => Math.abs(g.ts - l.ts) <= 60 * MIN) ? null : l.corpo
  }

  return l.corpo
}

async function checarLembretes() {
  let bd
  try {
    bd = await abrirBanco()
  } catch {
    return
  }
  if (!temLoja(bd, 'lembretes')) return

  const agora = Date.now()
  const vencidos = (await ler(bd, 'lembretes'))
    .filter(l => !l.disparadoEm && l.ts <= agora && l.ts > agora - JANELA)
    .sort((a, b) => a.ts - b.ts)

  for (const l of vencidos) {
    let corpo = null
    try {
      corpo = await avaliar(bd, l)
    } catch {
      corpo = l.corpo
    }
    if (corpo) {
      try {
        await self.registration.showNotification(l.titulo, {
          body: corpo,
          icon: 'icon-192.png',
          badge: 'icon-192.png',
          tag: l.tipo,
          data: { rota: l.rota },
        })
      } catch {
        // permissao revogada no meio do caminho: para por aqui e deixa os
        // proximos pendentes, em vez de marcar como avisado sem ter avisado
        return
      }
    }
    await marcarDisparado(bd, l)
  }
}

self.addEventListener('periodicsync', event => {
  if (event.tag === 'lembretes') event.waitUntil(checarLembretes())
})

// tambem serve pra um empurrao manual vindo do app
self.addEventListener('message', event => {
  if (event.data && event.data.tipo === 'checar-lembretes') {
    event.waitUntil(checarLembretes())
  }
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const rota = (event.notification.data && event.notification.data.rota) || '#/'
  event.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const c of abertas) {
      if ('focus' in c) {
        await c.focus()
        if ('navigate' in c) await c.navigate(new URL(rota, self.registration.scope).href)
        return
      }
    }
    await self.clients.openWindow(new URL(rota, self.registration.scope).href)
  })())
})
