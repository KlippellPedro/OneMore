/**
 * Senha, sessao e cookie. Tudo com o `node:crypto` que ja vem no Node - sem
 * bcrypt nem jsonwebtoken. Menos dependencia pra instalar na Discloud, menos
 * modulo nativo pra quebrar em deploy.
 */
import {
  randomBytes, randomUUID, randomInt, scrypt, timingSafeEqual, createHash,
} from 'node:crypto'
import { promisify } from 'node:util'
import { consultar } from './banco.js'

const scryptAsync = promisify(scrypt)

/* ------------------------------------------------------------------ */
/* SENHA                                                               */
/* ------------------------------------------------------------------ */

/**
 * scrypt com custo alto de proposito: derivar a chave leva ~100 ms, o que e
 * irrelevante pra quem digita a senha uma vez e caro pra quem tenta milhoes.
 * N*r*128 = 16 MB por hash, entao maxmem vai explicito - o padrao do Node e
 * 32 MB e estouraria se alguem subisse o N sem perceber.
 */
const N = 16384, R = 8, P = 1, TAM = 64, MAXMEM = 64 * 1024 * 1024

export async function hashSenha(senha) {
  const sal = randomBytes(16)
  const chave = await scryptAsync(senha.normalize('NFKC'), sal, TAM, { N, r: R, p: P, maxmem: MAXMEM })
  return `scrypt$${N}$${R}$${P}$${sal.toString('base64')}$${chave.toString('base64')}`
}

export async function conferirSenha(senha, guardado) {
  try {
    const [alg, n, r, p, sal, chave] = String(guardado).split('$')
    if (alg !== 'scrypt') return false
    const esperado = Buffer.from(chave, 'base64')
    const obtido = await scryptAsync(
      senha.normalize('NFKC'), Buffer.from(sal, 'base64'), esperado.length,
      { N: +n, r: +r, p: +p, maxmem: MAXMEM },
    )
    // comparacao de tempo constante: um `===` vazaria, pelo tempo de resposta,
    // quantos bytes do hash foram acertados
    return timingSafeEqual(esperado, obtido)
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/* SESSAO                                                              */
/* ------------------------------------------------------------------ */

export const COOKIE = 'onemore_sessao'
const DIAS = 90
const DURACAO_MS = DIAS * 24 * 60 * 60 * 1000

/**
 * O token guardado no banco e o SHA-256, nunca o token em si: se alguem ler a
 * tabela, nao consegue se passar por ninguem. SHA-256 puro basta aqui (e nao
 * scrypt, como na senha) porque o token ja tem 256 bits de entropia - nao ha
 * dicionario pra atacar.
 */
const hashToken = t => createHash('sha256').update(t).digest('hex')

export async function criarSessao(usuarioId) {
  const token = randomBytes(32).toString('base64url')
  const expira = new Date(Date.now() + DURACAO_MS)
  await consultar(
    'insert into sessoes (token_hash, usuario_id, expira_em) values ($1, $2, $3)',
    [hashToken(token), usuarioId, expira],
  )
  return { token, expira }
}

export async function usuarioDaSessao(token) {
  if (!token) return null
  const { rows } = await consultar(
    `select u.id, u.email, s.expira_em
       from sessoes s join usuarios u on u.id = s.usuario_id
      where s.token_hash = $1 and s.expira_em > now()`,
    [hashToken(token)],
  )
  if (!rows.length) return null
  // marca atividade sem segurar a resposta - se falhar, nao e motivo pra 500
  consultar('update sessoes set visto_em = now() where token_hash = $1', [hashToken(token)])
    .catch(() => {})
  return { id: rows[0].id, email: rows[0].email }
}

export async function encerrarSessao(token) {
  if (!token) return
  await consultar('delete from sessoes where token_hash = $1', [hashToken(token)])
}

/* ------------------------------------------------------------------ */
/* USUARIO                                                             */
/* ------------------------------------------------------------------ */

/** Guardado sempre em minusculo e sem espaco, pra "A@x.com" e "a@x.com " serem a mesma conta. */
export const normalizarEmail = e => String(e ?? '').trim().toLowerCase()

export const emailValido = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 254

export async function criarUsuario(email, senha) {
  const id = randomUUID()
  const codigo = gerarCodigo()
  await consultar(
    'insert into usuarios (id, email, senha_hash, codigo_hash) values ($1, $2, $3, $4)',
    [id, email, await hashSenha(senha), await hashCodigo(codigo)],
  )
  // o codigo volta UMA vez, aqui. Depois disso so existe o hash.
  return { id, email, codigo }
}

export async function acharPorEmail(email) {
  const { rows } = await consultar(
    'select id, email, senha_hash, codigo_hash from usuarios where email = $1', [email],
  )
  return rows[0] ?? null
}

/* ------------------------------------------------------------------ */
/* CODIGO DE RECUPERACAO                                               */
/* ------------------------------------------------------------------ */

/**
 * Alfabeto sem 0/O/1/I/L: o codigo vai ser copiado a mao de um papel, e
 * confundir zero com O e o jeito mais facil de alguem perder a propria conta.
 */
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const TAMANHO = 12

/**
 * Gera um codigo tipo ABCD-2345-EFGH. Sao 12 caracteres de 31 possibilidades,
 * ou ~59 bits - longe do alcance de quem tenta adivinhar, ainda mais com o
 * freio por IP na rota de recuperacao.
 *
 * randomInt e uniforme; usar randomBytes com modulo enviesaria as primeiras
 * letras do alfabeto.
 */
export function gerarCodigo() {
  let c = ''
  for (let i = 0; i < TAMANHO; i++) c += ALFABETO[randomInt(ALFABETO.length)]
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`
}

/** Aceita com ou sem hifen, em qualquer caixa - quem digita a mao erra nisso. */
export const normalizarCodigo = c =>
  String(c ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')

export const hashCodigo = codigo => hashSenha(normalizarCodigo(codigo))
export const conferirCodigo = (codigo, guardado) =>
  conferirSenha(normalizarCodigo(codigo), guardado)

/** Troca a senha E o codigo, e derruba todas as sessoes abertas da conta. */
export async function trocarSenha(usuarioId, novaSenha) {
  const codigo = gerarCodigo()
  await consultar(
    'update usuarios set senha_hash = $2, codigo_hash = $3 where id = $1',
    [usuarioId, await hashSenha(novaSenha), await hashCodigo(codigo)],
  )
  // quem trocou a senha quer justamente expulsar quem estiver dentro
  await consultar('delete from sessoes where usuario_id = $1', [usuarioId])
  return codigo
}

/* ------------------------------------------------------------------ */
/* COOKIE                                                              */
/* ------------------------------------------------------------------ */

export function lerCookie(req, nome) {
  const bruto = req.headers.cookie
  if (!bruto) return null
  for (const parte of bruto.split(';')) {
    const i = parte.indexOf('=')
    if (i < 0) continue
    if (parte.slice(0, i).trim() === nome) {
      return decodeURIComponent(parte.slice(i + 1).trim())
    }
  }
  return null
}

/**
 * Secure so entra quando a requisicao chegou por https - senao o cookie some no
 * `localhost` do desenvolvimento. A Discloud serve https, entao em producao ele
 * e sempre marcado. SameSite=Lax ja barra CSRF vindo de outro site.
 */
function seguro(req) {
  return req.headers['x-forwarded-proto'] === 'https' || process.env.PRODUCAO === '1'
}

export function cookieSessao(req, token, expira) {
  const p = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly', 'SameSite=Lax', 'Path=/',
    `Expires=${expira.toUTCString()}`,
    `Max-Age=${Math.floor(DURACAO_MS / 1000)}`,
  ]
  if (seguro(req)) p.push('Secure')
  return p.join('; ')
}

export function cookieLimpo(req) {
  const p = [`${COOKIE}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0']
  if (seguro(req)) p.push('Secure')
  return p.join('; ')
}
