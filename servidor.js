/**
 * Servidor do OneMore: serve o site compilado (site/) e a API sob /api/.
 *
 * A Discloud exige que TYPE=site escute em 0.0.0.0:8080, entao a pasta do
 * site nao sobe sozinha - precisa de alguem servindo.
 *
 * Site e API no MESMO processo e na MESMA origem de proposito: assim nao existe
 * CORS, nao existe mixed content e o cookie de sessao pode ser HttpOnly - que e
 * o que mantem o token fora do alcance de qualquer script da pagina.
 */
// PRIMEIRO import de proposito: popula process.env antes que banco.js seja
// avaliado e va procurar a DATABASE_URL.
import './servidor/env.js'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { conectarComRetentativa } from './servidor/banco.js'
import { tratarApi } from './servidor/api.js'
import { CABECALHOS_SEGURANCA } from './servidor/seguranca.js'

// "site" e nao "dist" de proposito - veja build.outDir no vite.config.ts
const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), 'site')
/**
 * 8080 e o que a Discloud espera de um TYPE=site. `--porta` existe so pro
 * desenvolvimento em maquina onde a 8080 ja esta ocupada - e argumento, e nao
 * PORT no .env, porque o .env sobe junto com o app e um PORT errado la
 * derrubaria o site em producao.
 */
const argPorta = process.argv.find(a => a.startsWith('--porta='))
const PORTA = process.env.PORT || argPorta?.split('=')[1] || 8080

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
 * atualizado nunca chega no celular. O resto do build tem hash no nome, entao
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

const servidor = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local')
    // a API vem antes do disco: senao /api/dados cairia no fallback do index
    if (await tratarApi(req, res, url.pathname)) return
    // o app usa rotas em #/, entao qualquer caminho desconhecido e o index mesmo
    const alvo = (await achar(url.pathname)) ?? join(RAIZ, 'index.html')
    const corpo = await readFile(alvo)
    res.writeHead(200, {
      'Content-Type': TIPOS[extname(alvo)] ?? 'application/octet-stream',
      'Cache-Control': cacheDe(alvo.replace(/\\/g, '/')),
      ...CABECALHOS_SEGURANCA,
    })
    res.end(corpo)
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', ...CABECALHOS_SEGURANCA })
    res.end('Erro ao servir: ' + e.message)
  }
})

/**
 * Sem site/index.html todo caminho vira 500, e a Discloud troca 5xx pela
 * pagina de erro DELA - o log fica limpo e o motivo real, invisivel. Ja custou
 * um deploy inteiro de diagnostico, entao agora o aviso sai na subida.
 */
try {
  await stat(join(RAIZ, 'index.html'))
} catch {
  console.error(
    `[site] ${join(RAIZ, 'index.html')} NAO existe - o site vai responder 500 em tudo.\n`
    + '       Rode `npm run build:site` e garanta que site/ esta no pacote enviado.',
  )
}

// escuta PRIMEIRO e conecta no banco depois, em segundo plano: o site e
// estatico e nao depende do Postgres pra nada. Enquanto a conexao nao vem, a
// API responde 503 e o site funciona normal.
servidor.listen(PORTA, '0.0.0.0', () => {
  console.log(`OneMore em http://0.0.0.0:${PORTA} (site + /api)`)
})
conectarComRetentativa()
