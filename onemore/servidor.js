/**
 * Servidor estatico do OneMore, sem dependencia nenhuma.
 *
 * A Discloud exige que TYPE=site escute em 0.0.0.0:8080, entao a pasta dist/
 * nao sobe sozinha - precisa de alguem servindo. Node puro resolve: menos coisa
 * pra instalar, menos RAM, menos coisa pra quebrar.
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), 'dist')
const PORTA = process.env.PORT || 8080

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

/**
 * O service worker e o index nunca podem ficar presos em cache, senao o app
 * atualizado nunca chega no celular. O resto do dist tem hash no nome, entao
 * pode cachear pra sempre.
 */
function cacheDe(caminho) {
  if (/(^|\/)(sw|registerSW)\.js$|\.webmanifest$|index\.html$/.test(caminho)) {
    return 'no-cache'
  }
  return caminho.includes('/assets/')
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=86400'
}

async function achar(urlPath) {
  // normalize + prefixo obrigatorio barram ../.. tentando sair da pasta
  const relativo = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '')
  let alvo = join(RAIZ, relativo)
  if (!alvo.startsWith(RAIZ)) return null

  try {
    if ((await stat(alvo)).isDirectory()) alvo = join(alvo, 'index.html')
    return alvo
  } catch {
    return null
  }
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local')
    // o app usa rotas em #/, entao qualquer caminho desconhecido e o index mesmo
    const alvo = (await achar(url.pathname)) ?? join(RAIZ, 'index.html')
    const corpo = await readFile(alvo)
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(alvo)] ?? 'application/octet-stream',
      'Cache-Control': cacheDe(alvo.replace(/\\/g, '/')),
    })
    res.end(corpo)
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Erro ao servir: ' + e.message)
  }
}).listen(PORTA, '0.0.0.0', () => {
  console.log(`OneMore servindo dist/ em http://0.0.0.0:${PORTA}`)
})
