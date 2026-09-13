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
import { CABECALHOS_SEGURANCA } from './seguranca.js'
import {
  COOKIE, hashSenha, conferirSenha, criarSessao, usuarioDaSessao, encerrarSessao,
  criarUsuario, acharPorEmail, normalizarEmail, emailValido,
  gerarCodigo, hashCodigo, conferirCodigo, trocarSenha,
  lerCookie, cookieSessao, cookieLimpo,
} from './auth.js'

/** O backup inteiro vai num JSON so. 12 MB cobre anos de treino com folga. */
const LIMITE_CORPO = 12 * 1024 * 1024
/** E-mail + senha (+ codigo): cabe de sobra em 4 KB, mesmo com folga generosa. */
export const LIMITE_CORPO_CONTA = 4 * 1024
const SENHA_MINIMA = 8
/**
 * Nenhuma senha de verdade chega perto disso. Sem um teto, um corpo de ate
 * 12 MB (o limite do lerCorpo acima) virava uma senha gigante jogada direto
 * no scrypt - que e caro DE PROPOSITO (16 MB de memoria, ~100 ms por
 * tentativa, ver hashSenha em auth.js). Poucas requisicoes assim ja pressionam
 * CPU e os 512 MB de RAM do processo, e essas rotas nao exigem login.
 */
export const SENHA_MAXIMA = 128
/** Sobra generosa: o codigo de verdade tem 12 caracteres uteis (ver gerarCodigo em auth.js). */
export const CODIGO_MAXIMO = 32

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */

function responder(res, status, corpo, cabecalhos = {}) {
  const texto = corpo === undefined ? '' : JSON.stringify(corpo)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...CABECALHOS_SEGURANCA,
    ...cabecalhos,
  })
  res.end(texto)
}

const erro = (res, status, msg, cab) => responder(res, status, { erro: msg }, cab)

/**
 * `limite` e por chamada, nao fixo em LIMITE_CORPO: as rotas de conta
 * (e-mail + senha, no maximo umas dezenas de bytes) nao tem motivo pra aceitar
 * o mesmo teto de 12 MB do backup. Sem um limite proprio pra elas, um corpo
 * gigante era lido e bufferizado POR INTEIRO antes de qualquer validacao de
 * campo rodar - poucas requisicoes assim concorrentes ja pressionam os 512 MB
 * de RAM do processo, numa rota que nem exige login. Cortando aqui, durante o
 * streaming, a conexao e derrubada assim que passa do teto - nunca chega a
 * bufferizar o resto.
 */
export function lerCorpo(req, limite = LIMITE_CORPO) {
  return new Promise((ok, falhou) => {
    let tam = 0
    const partes = []
    req.on('data', p => {
      tam += p.length
      if (tam > limite) {
        falhou(Object.assign(new Error('Corpo da requisicao grande demais.'), { status: 413 }))
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
 * Freio de forca bruta nas rotas de senha: por IP E por CONTA ao mesmo tempo.
 *
 * So por IP tem um buraco duplo: (1) um atacante com muitos IPs nunca esbarra
 * no limite de nenhum deles individualmente, e pode tentar senha sem fim
 * contra uma conta especifica; (2) mesmo de UM IP so, o cabecalho que decide
 * "qual IP" (ver ipDe) pode ser forjado pra girar a cada requisicao. O freio
 * por conta fecha os dois: ele conta pelo e-mail ALVO, nao por quem esta
 * pedindo, entao continua valendo em qualquer um dos dois casos.
 *
 * E memoria do processo: se o app reinicia, zera - e tudo bem, serve pra
 * travar forca bruta, nao pra ser contabilidade.
 */
const tentativas = new Map()
const JANELA_MS = 15 * 60 * 1000
export const MAX_POR_IP = 10
/**
 * O dobro do limite por IP de proposito: um atacante de UM IP so ja esbarra
 * no limite por IP antes de chegar aqui. Isto so entra em jogo pra quem
 * distribui as tentativas entre pelo menos dois IPs (ou os forja) - travando
 * BEM acima do que uma pessoa de carne e osso erraria a propria senha.
 */
export const MAX_POR_CONTA = 20

/**
 * `X-Forwarded-For` e uma lista "cliente, proxy1, proxy2..." - cada proxy
 * ACRESCENTA ao final o IP de quem conectou nele, sem apagar o que veio antes.
 * Pegar o PRIMEIRO valor (erro comum) pega o que o proprio cliente escreveu no
 * pedido - ele controla esse valor livremente, entao um valor forjado
 * diferente a cada requisicao fazia o freio por IP nunca acumular nada. A
 * Discloud fica entre a internet e este processo, entao o ULTIMO valor da
 * lista e o que ELA viu conectar - esse ninguem de fora forja. (Se um dia
 * entrar um segundo proxy na frente, tipo um CDN, isto precisa contar dois
 * valores do fim pra tras, nao um.)
 */
export function ipDe(req) {
  const bruto = req.headers['x-forwarded-for']
  if (typeof bruto === 'string' && bruto.trim()) {
    const partes = bruto.split(',').map(s => s.trim()).filter(Boolean)
    if (partes.length) return partes[partes.length - 1]
  }
  return req.socket.remoteAddress || '?'
}

function contar(chave, max) {
  const agora = Date.now()
  const reg = tentativas.get(chave)
  if (!reg || agora > reg.ate) {
    tentativas.set(chave, { n: 1, ate: agora + JANELA_MS })
    return false
  }
  reg.n++
  return reg.n > max
}

export const freadoPorIp = req => contar(`ip:${ipDe(req)}`, MAX_POR_IP)
export const freadoPorConta = email => contar(`conta:${email}`, MAX_POR_CONTA)

/** Sucesso limpa os dois contadores - senao o uso normal ia acumulando ate travar. */
function desfrear(req, email) {
  tentativas.delete(`ip:${ipDe(req)}`)
  tentativas.delete(`conta:${email}`)
}

// a cada 30 min joga fora quem ja venceu, pro Map nao virar vazamento de memoria
setInterval(() => {
  const agora = Date.now()
  for (const [chave, reg] of tentativas) if (agora > reg.ate) tentativas.delete(chave)
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
  if (freadoPorIp(req)) return erro(res, 429, 'Muitas tentativas. Espere uns minutos.')

  const corpo = await lerCorpo(req, LIMITE_CORPO_CONTA)
  const email = normalizarEmail(corpo.email)
  const senha = String(corpo.senha ?? '')

  if (!emailValido(email)) return erro(res, 400, 'E-mail invalido.')
  if (senha.length < SENHA_MINIMA) {
    return erro(res, 400, `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`)
  }
  if (senha.length > SENHA_MAXIMA) {
    return erro(res, 400, `A senha pode ter no maximo ${SENHA_MAXIMA} caracteres.`)
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
  desfrear(req, email)
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
  if (freadoPorIp(req)) return erro(res, 429, 'Muitas tentativas. Espere uns minutos.')

  const corpo = await lerCorpo(req, LIMITE_CORPO_CONTA)
  const email = normalizarEmail(corpo.email)
  const senha = String(corpo.senha ?? '')
  /**
   * Corta ANTES de qualquer hash, sem virar mensagem de erro nova: `codigo` e
   * um segredo sendo ADIVINHADO (como a senha no login), nao uma senha nova
   * sendo validada - o excesso so vira mais um jeito de errar, do mesmo jeito
   * que qualquer outro codigo incorreto (ver o comentario acima da funcao).
   */
  const codigo = String(corpo.codigo ?? '').slice(0, CODIGO_MAXIMO)

  // pelo e-mail ALVO, nao pelo IP de quem pede - pega quem distribui as
  // tentativas entre varios IPs (ou forja o cabecalho) contra a mesma conta
  if (freadoPorConta(email)) return erro(res, 429, 'Muitas tentativas. Espere uns minutos.')

  if (senha.length < SENHA_MINIMA) {
    return erro(res, 400, `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`)
  }
  if (senha.length > SENHA_MAXIMA) {
    return erro(res, 400, `A senha pode ter no maximo ${SENHA_MAXIMA} caracteres.`)
  }

  const usuario = await acharPorEmail(email)
  const ok = usuario?.codigo_hash
    ? await conferirCodigo(codigo, usuario.codigo_hash)
    : (await hashSenha(codigo), false)
  if (!ok) return erro(res, 401, 'E-mail ou codigo de recuperacao incorretos.')

  const novoCodigo = await trocarSenha(usuario.id, senha)
  // entra ja logado: a pessoa acabou de provar que e dona da conta
  const { token, expira } = await criarSessao(usuario.id)
  desfrear(req, email)
  responder(res, 200, { email: usuario.email, codigo: novoCodigo },
    { 'Set-Cookie': cookieSessao(req, token, expira) })
}

async function postSessao(req, res) {
  if (freadoPorIp(req)) return erro(res, 429, 'Muitas tentativas. Espere uns minutos.')

  const corpo = await lerCorpo(req, LIMITE_CORPO_CONTA)
  const email = normalizarEmail(corpo.email)
  /**
   * Corta ANTES de qualquer hash, sem virar mensagem de erro nova: e um
   * segredo sendo ADIVINHADO (login), e o excesso so vira mais um jeito de
   * errar - a mesma resposta generica de "senha incorreta" logo abaixo.
   */
  const senha = String(corpo.senha ?? '').slice(0, SENHA_MAXIMA)

  // pelo e-mail ALVO, nao pelo IP de quem pede - mesmo motivo do postSenha
  if (freadoPorConta(email)) return erro(res, 429, 'Muitas tentativas. Espere uns minutos.')

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
  desfrear(req, email)
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
 * Uma linha por requisicao, sucesso ou erro - e nao so quando estoura excecao.
 * Sem isto, a unica visibilidade de erro era `console.error` nos casos que
 * derrubam excecao, e a falha de sincronizacao guardada no proprio aparelho
 * de quem tomou o erro (ver registrarFalha em lib/sync.ts) - que ninguem mais
 * ve sem pedir print. Isto nao manda nada pra lugar nenhum, so loga: o log da
 * Discloud ja da pra somar "quantos 503 hoje" ou "que fracao das tentativas de
 * login volta 401" sem precisar de servico de telemetria nenhum.
 */
function logarAcesso(req, caminho, status, desde) {
  console.log(`[api] ${req.method} ${caminho} -> ${status} (${Date.now() - desde}ms)`)
}

/**
 * Devolve true se tratou a requisicao. O servidor de arquivos so e consultado
 * quando isso retorna false, entao /api nunca cai no index.html.
 */
export async function tratarApi(req, res, caminho) {
  if (caminho !== '/api' && !caminho.startsWith('/api/')) return false
  const desde = Date.now()

  // sem banco a conta nao funciona, mas o site continua servindo normalmente
  if (!configurado || !pronto) {
    erro(res, 503, 'O servidor ainda nao esta conectado ao banco. Tente daqui a pouco.')
    logarAcesso(req, caminho, 503, desde)
    return true
  }

  const rota = ROTAS[`${req.method} ${caminho}`]
  if (!rota) {
    erro(res, 404, 'Rota nao encontrada.')
    logarAcesso(req, caminho, 404, desde)
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
  logarAcesso(req, caminho, res.statusCode, desde)
  return true
}
