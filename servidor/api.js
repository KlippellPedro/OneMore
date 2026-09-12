/**
 * A API do OneMore. Mora no MESMO servidor que serve o site, sob /api/, e isso
 * e uma decisao de projeto: mesma origem significa zero CORS, zero mixed
 * content e cookie HttpOnly funcionando - que e o unico jeito de guardar
 * sessao sem deixar o token ao alcance de qualquer script da pagina.
 *
 * Rotas:
 *   POST   /api/conta    cria a conta e ja deixa logado
 *   POST   /api/sessao   entra
 *   DELETE /api/sessao   sai
 *   GET    /api/eu       quem esta logado (204 se ninguem)
 *   POST   /api/recuperacao  gera um codigo de recuperacao novo (logado)
 *   POST   /api/senha        troca a senha usando o codigo (sem estar logado)
 *   GET    /api/dados    baixa o backup da conta (204 se ainda nao enviou nada)
 *   PUT    /api/dados    sobe o backup da conta
 */
import { consultar, configurado, pronto } from './banco.js'
import {
  COOKIE, hashSenha, conferirSenha, criarSessao, usuarioDaSessao, encerrarSessao,
  criarUsuario, acharPorEmail, normalizarEmail, emailValido,
  gerarCodigo, hashCodigo, conferirCodigo, trocarSenha,
  lerCookie, cookieSessao, cookieLimpo,
} from './auth.js'

/** O backup inteiro vai num JSON so. 12 MB cobre anos de treino com folga. */
const LIMITE_CORPO = 12 * 1024 * 1024
const SENHA_MINIMA = 8

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */

function responder(res, status, corpo, cabecalhos = {}) {
  const texto = corpo === undefined ? '' : JSON.stringify(corpo)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...cabecalhos,
  })
  res.end(texto)
}

const erro = (res, status, msg, cab) => responder(res, status, { erro: msg }, cab)

function lerCorpo(req) {
  return new Promise((ok, falhou) => {
    let tam = 0
    const partes = []
    req.on('data', p => {
      tam += p.length
      if (tam > LIMITE_CORPO) {
        falhou(Object.assign(new Error('Backup grande demais.'), { status: 413 }))
        req.destroy()
        return
      }
      partes.push(p)
    })
    req.on('end', () => {
      if (!partes.length) return ok({})
      try {
        ok(JSON.parse(Buffer.concat(partes).toString('utf8')))
      } catch {
        falhou(Object.assign(new Error('JSON invalido.'), { status: 400 }))
      }
    })
    req.on('error', falhou)
  })
}

/**
 * Freio por IP nas rotas de senha. E memoria do processo: se o app reinicia,
 * zera - e tudo bem. Serve pra travar forca bruta, nao pra ser contabilidade.
 */
const tentativas = new Map()
const JANELA_MS = 15 * 60 * 1000
const MAX_TENTATIVAS = 10

function ipDe(req) {
  const f = req.headers['x-forwarded-for']
  return (typeof f === 'string' ? f.split(',')[0].trim() : '') || req.socket.remoteAddress || '?'
}

function freado(req) {
  const ip = ipDe(req)
  const agora = Date.now()
  const reg = tentativas.get(ip)
  if (!reg || agora > reg.ate) {
    tentativas.set(ip, { n: 1, ate: agora + JANELA_MS })
    return false
  }
  reg.n++
  return reg.n > MAX_TENTATIVAS
}

/** Login certo limpa o contador - senao o uso normal ia acumulando ate travar. */
const desfrear = req => tentativas.delete(ipDe(req))

// a cada 30 min joga fora quem ja venceu, pro Map nao virar vazamento de memoria
setInterval(() => {
  const agora = Date.now()
  for (const [ip, reg] of tentativas) if (agora > reg.ate) tentativas.delete(ip)
}, 30 * 60 * 1000).unref()

/* ------------------------------------------------------------------ */
/* ROTAS                                                               */
/* ------------------------------------------------------------------ */

async function exigirLogin(req, res) {
  const u = await usuarioDaSessao(lerCookie(req, COOKIE))
  if (!u) {
    erro(res, 401, 'Entre na sua conta.')
    return null
  }
  return u
}

async function postConta(req, res) {
  if (freado(req)) return erro(res, 429, 'Muitas tentativas. Espere uns minutos.')

  const corpo = await lerCorpo(req)
  const email = normalizarEmail(corpo.email)
  const senha = String(corpo.senha ?? '')

  if (!emailValido(email)) return erro(res, 400, 'E-mail invalido.')
  if (senha.length < SENHA_MINIMA) {
    return erro(res, 400, `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`)
  }
  if (await acharPorEmail(email)) return erro(res, 409, 'Ja existe uma conta com esse e-mail.')

  let usuario
  try {
    usuario = await criarUsuario(email, senha)
  } catch (e) {
    // corrida entre dois cadastros do mesmo e-mail: o unique do banco decide
    if (e.code === '23505') return erro(res, 409, 'Ja existe uma conta com esse e-mail.')
    throw e
  }

  const { token, expira } = await criarSessao(usuario.id)
  desfrear(req)
  // o codigo de recuperacao volta AQUI e so aqui - depois disso so existe o hash
  responder(res, 201, { email: usuario.email, codigo: usuario.codigo },
    { 'Set-Cookie': cookieSessao(req, token, expira) })
}

/**
 * Gera um codigo novo pra quem esta logado. Serve pra dois casos: conta criada
 * antes de existir codigo, e "perdi o papel mas ainda estou dentro".
 * O codigo antigo para de valer na hora.
 */
async function postRecuperacao(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const codigo = gerarCodigo()
  await consultar('update usuarios set codigo_hash = $2 where id = $1', [u.id, await hashCodigo(codigo)])
  responder(res, 200, { codigo })
}

/**
 * Troca a senha usando o codigo de recuperacao. E a unica porta sem servidor de
 * e-mail, entao ela e o alvo obvio de quem quiser invadir conta - por isso o
 * freio por IP vale aqui tambem.
 *
 * Erro generico de proposito: dizer "esse e-mail nao existe" ou "o codigo esta
 * errado" entregaria quem tem conta aqui e ajudaria a garimpar codigo.
 */
async function postSenha(req, res) {
  if (freado(req)) return erro(res, 429, 'Muitas tentativas. Espere uns minutos.')

  const corpo = await lerCorpo(req)
  const email = normalizarEmail(corpo.email)
  const senha = String(corpo.senha ?? '')
  const codigo = String(corpo.codigo ?? '')

  if (senha.length < SENHA_MINIMA) {
    return erro(res, 400, `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`)
  }

  const usuario = await acharPorEmail(email)
  const ok = usuario?.codigo_hash
    ? await conferirCodigo(codigo, usuario.codigo_hash)
    : (await hashSenha(codigo), false)
  if (!ok) return erro(res, 401, 'E-mail ou codigo de recuperacao incorretos.')

  const novoCodigo = await trocarSenha(usuario.id, senha)
  // entra ja logado: a pessoa acabou de provar que e dona da conta
  const { token, expira } = await criarSessao(usuario.id)
  desfrear(req)
  responder(res, 200, { email: usuario.email, codigo: novoCodigo },
    { 'Set-Cookie': cookieSessao(req, token, expira) })
}

async function postSessao(req, res) {
  if (freado(req)) return erro(res, 429, 'Muitas tentativas. Espere uns minutos.')

  const corpo = await lerCorpo(req)
  const email = normalizarEmail(corpo.email)
  const senha = String(corpo.senha ?? '')

  const usuario = await acharPorEmail(email)
  /**
   * Mesma mensagem pra e-mail inexistente e senha errada, de proposito: dizer
   * "esse e-mail nao existe" entrega quem tem conta aqui. E quando o usuario
   * nao existe ainda assim roda um hash descartavel, senao a resposta voltaria
   * rapido demais e o tempo entregaria a mesma informacao.
   */
  const ok = usuario
    ? await conferirSenha(senha, usuario.senha_hash)
    : (await hashSenha(senha), false)
  if (!ok) return erro(res, 401, 'E-mail ou senha incorretos.')

  const { token, expira } = await criarSessao(usuario.id)
  desfrear(req)
  responder(res, 200, { email: usuario.email }, { 'Set-Cookie': cookieSessao(req, token, expira) })
}

async function deleteSessao(req, res) {
  await encerrarSessao(lerCookie(req, COOKIE))
  responder(res, 200, { ok: true }, { 'Set-Cookie': cookieLimpo(req) })
}

async function getEu(req, res) {
  const u = await usuarioDaSessao(lerCookie(req, COOKIE))
  if (!u) return responder(res, 204)
  responder(res, 200, { email: u.email })
}

async function getDados(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const { rows } = await consultar(
    'select payload, atualizado_em from dados where usuario_id = $1', [u.id],
  )
  if (!rows.length) return responder(res, 204)
  responder(res, 200, { payload: rows[0].payload, atualizadoEm: rows[0].atualizado_em })
}

/**
 * So o carimbo de tempo, sem o payload. Existe pra sincronizacao continua: o
 * aparelho pergunta "mudou?" de poucos em poucos segundos, e baixar o estado
 * inteiro so pra descobrir que nada mudou seria desperdicio de banda a cada
 * consulta - aqui a resposta tem algumas dezenas de bytes.
 */
async function getVersao(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const { rows } = await consultar(
    'select atualizado_em from dados where usuario_id = $1', [u.id],
  )
  responder(res, 200, { atualizadoEm: rows.length ? rows[0].atualizado_em : null })
}

async function putDados(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const corpo = await lerCorpo(req)
  const payload = corpo?.payload
  if (!payload || typeof payload !== 'object' || payload.app !== 'onemore') {
    return erro(res, 400, 'Payload invalido.')
  }
  const { rows } = await consultar(
    `insert into dados (usuario_id, payload, atualizado_em) values ($1, $2, now())
     on conflict (usuario_id) do update set payload = excluded.payload, atualizado_em = now()
     returning atualizado_em`,
    [u.id, payload],
  )
  responder(res, 200, { atualizadoEm: rows[0].atualizado_em })
}

const ROTAS = {
  'POST /api/conta': postConta,
  'POST /api/sessao': postSessao,
  'DELETE /api/sessao': deleteSessao,
  'GET /api/eu': getEu,
  'POST /api/recuperacao': postRecuperacao,
  'POST /api/senha': postSenha,
  'GET /api/dados': getDados,
  'GET /api/dados/versao': getVersao,
  'PUT /api/dados': putDados,
}

/**
 * Devolve true se tratou a requisicao. O servidor de arquivos so e consultado
 * quando isso retorna false, entao /api nunca cai no index.html.
 */
export async function tratarApi(req, res, caminho) {
  if (caminho !== '/api' && !caminho.startsWith('/api/')) return false

  // sem banco a conta nao funciona, mas o site continua servindo normalmente
  if (!configurado || !pronto) {
    erro(res, 503, 'O servidor ainda nao esta conectado ao banco. Tente daqui a pouco.')
    return true
  }

  const rota = ROTAS[`${req.method} ${caminho}`]
  if (!rota) {
    erro(res, 404, 'Rota nao encontrada.')
    return true
  }

  try {
    await rota(req, res)
  } catch (e) {
    console.error(`[api] ${req.method} ${caminho}:`, e)
    if (!res.headersSent) {
      // mensagem generica pra fora: detalhe de erro interno so no log
      erro(res, e.status ?? 500, e.status ? e.message : 'Erro no servidor.')
    }
  }
  return true
}
