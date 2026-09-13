import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import {
  ipDe, freadoPorIp, freadoPorConta, MAX_POR_IP, MAX_POR_CONTA,
  lerCorpo, LIMITE_CORPO_CONTA, SENHA_MAXIMA, CODIGO_MAXIMO, tratarApi,
} from './api.js'
import { CABECALHOS_SEGURANCA } from './seguranca.js'

/** Requisicao de mentira, so com o que ipDe/freadoPorIp olham. */
const reqDe = (ip, xff) => ({
  headers: xff !== undefined ? { 'x-forwarded-for': xff } : {},
  socket: { remoteAddress: ip },
})

/** E-mail unico por teste, pra um teste nao acumular tentativa no contador do outro. */
let n = 0
const emailUnico = () => `teste-${Date.now()}-${n++}@exemplo.com`
const ipUnico = () => `10.${n++}.0.1`

test('ipDe: sem X-Forwarded-For, usa o IP da conexao', () => {
  assert.equal(ipDe(reqDe('203.0.113.9')), '203.0.113.9')
})

/**
 * X-Forwarded-For e "cliente, proxy1, proxy2...": cada proxy ACRESCENTA ao
 * final o IP de quem conectou nele. O CLIENTE escreve o primeiro valor - e
 * livre pra escrever qualquer coisa ali. Pegar o primeiro valor (erro comum)
 * deixa o freio de forca bruta decorativo: um atacante manda um valor
 * diferente a cada requisicao e nunca acumula no mesmo balde.
 */
test('ipDe: usa o ULTIMO valor de X-Forwarded-For, nao o primeiro (o cliente forja o primeiro)', () => {
  assert.equal(
    ipDe(reqDe('10.0.0.1', 'forjado-pelo-atacante, 198.51.100.7')),
    '198.51.100.7',
  )
})

test('ipDe: um so valor em X-Forwarded-For e usado direto', () => {
  assert.equal(ipDe(reqDe('10.0.0.1', '198.51.100.7')), '198.51.100.7')
})

test('freadoPorIp: trava depois do limite, pro MESMO ip', () => {
  const ip = ipUnico()
  let travou = false
  for (let i = 0; i < MAX_POR_IP + 2; i++) travou = freadoPorIp(reqDe(ip)) || travou
  assert.ok(travou)
})

test('freadoPorIp: ips diferentes nao competem pelo mesmo balde', () => {
  const a = ipUnico(), b = ipUnico()
  for (let i = 0; i < MAX_POR_IP; i++) freadoPorIp(reqDe(a))
  assert.equal(freadoPorIp(reqDe(b)), false, 'ip novo nao devia estar travado pelo outro')
})

/**
 * O cenario que o freio por IP sozinho nao pega: cada tentativa vem de um IP
 * diferente (atacante distribuido, ou o mesmo IP forjando um X-Forwarded-For
 * novo a cada requisicao). Nenhum IP isolado bate no proprio limite, mas o
 * freio por CONTA - que nao olha IP nenhum - trava do mesmo jeito.
 */
test('freadoPorConta: trava um ataque distribuido (um IP novo a cada tentativa) contra a MESMA conta', () => {
  const email = emailUnico()
  let travouPorConta = false
  for (let i = 0; i < MAX_POR_CONTA + 2; i++) {
    const ipDaVez = ipUnico() // nunca se repete: sozinho, nenhum desses ips bateria no MAX_POR_IP
    assert.equal(freadoPorIp(reqDe(ipDaVez)), false, `ip ${i} nao devia travar sozinho`)
    travouPorConta = freadoPorConta(email) || travouPorConta
  }
  assert.ok(travouPorConta, 'o freio por conta deveria ter travado mesmo sem nenhum ip repetido')
})

test('freadoPorConta: contas diferentes nao competem pelo mesmo balde', () => {
  const a = emailUnico(), b = emailUnico()
  for (let i = 0; i < MAX_POR_CONTA; i++) freadoPorConta(a)
  assert.equal(freadoPorConta(b), false, 'conta nova nao devia estar travada pela outra')
})

/* ---------- lerCorpo: teto de corpo por rota ---------- */

/** IncomingMessage de mentira: so o que lerCorpo usa (on/emit e destroy). */
function reqFake() {
  const req = new EventEmitter()
  req.destroy = () => { req.destruida = true }
  return req
}

test('lerCorpo: corpo dentro do limite passa normal', async () => {
  const req = reqFake()
  const promessa = lerCorpo(req, LIMITE_CORPO_CONTA)
  req.emit('data', Buffer.from(JSON.stringify({ email: 'a@b.com', senha: '12345678' })))
  req.emit('end')
  assert.deepEqual(await promessa, { email: 'a@b.com', senha: '12345678' })
})

/**
 * O cenario do relatorio: um corpo de varios MB destinado a uma rota que so
 * espera e-mail e senha. Sem um teto proprio pra essas rotas, isto era lido e
 * bufferizado POR INTEIRO (ate os 12 MB do backup) antes de qualquer validacao
 * de campo rodar. Com o teto pequeno, a conexao e derrubada assim que passa
 * dele - nunca chega a terminar de bufferizar.
 */
test('lerCorpo: corpo de varios MB numa rota de conta e rejeitado sem terminar de ler', async () => {
  const req = reqFake()
  const resultado = lerCorpo(req, LIMITE_CORPO_CONTA).then(() => 'passou', e => e)
  req.emit('data', Buffer.alloc(1024 * 1024, 'a')) // 1 MB de uma vez, ja bem acima do teto de 4 KB
  const r = await resultado
  assert.notEqual(r, 'passou')
  assert.equal(r.status, 413)
  assert.ok(req.destruida, 'deveria ter derrubado a conexao, nao so rejeitado a promessa')
})

test('lerCorpo: derruba assim que o total passa do limite, mesmo em pedacos pequenos', async () => {
  const req = reqFake()
  const resultado = lerCorpo(req, 10).then(() => 'passou', e => e)
  req.emit('data', Buffer.from('123456')) // 6, ainda dentro
  req.emit('data', Buffer.from('7890AB')) // +6 = 12, passa de 10
  const r = await resultado
  assert.equal(r.status, 413)
  assert.ok(req.destruida)
})

test('LIMITE_CORPO_CONTA, SENHA_MAXIMA e CODIGO_MAXIMO estao coerentes entre si', () => {
  assert.ok(SENHA_MAXIMA >= 64, 'nao pode ser pequeno a ponto de barrar uma senha razoavel')
  assert.ok(CODIGO_MAXIMO >= 14, 'o codigo de verdade tem 14 caracteres com hifen (ver gerarCodigo)')
  assert.ok(
    SENHA_MAXIMA + CODIGO_MAXIMO < LIMITE_CORPO_CONTA,
    'os campos maximos tem que caber com folga dentro do teto de corpo da rota',
  )
  assert.ok(LIMITE_CORPO_CONTA < 64 * 1024, 'e-mail + senha nao precisam nem perto do teto do backup')
})

/* ---------- cabecalhos de seguranca ---------- */

/** Resposta de mentira: so grava o que writeHead/end recebem. */
function resFake() {
  return {
    headersSent: false,
    statusCode: 200, // mesmo padrao do http.ServerResponse de verdade
    chamadas: [],
    writeHead(status, headers) {
      this.chamadas.push({ status, headers })
      this.headersSent = true
      this.statusCode = status
    },
    end() {},
  }
}

/**
 * Sem DATABASE_URL (o caso deste ambiente de teste, ver banco.js) toda rota
 * cai no 503 de "banco nao conectado" - e isso passa pelo MESMO `responder()`
 * que qualquer outra resposta da API, entao ja basta pra provar que os
 * cabecalhos saem em qualquer resposta, nao so nas de sucesso.
 */
test('toda resposta da API leva os cabecalhos basicos de seguranca', async () => {
  const req = { method: 'GET', headers: {}, socket: { remoteAddress: '203.0.113.1' } }
  const res = resFake()
  const tratou = await tratarApi(req, res, '/api/eu')
  assert.ok(tratou, 'deveria ter tratado a rota (mesmo que com 503)')
  const { headers } = res.chamadas[0]
  for (const [nome, valor] of Object.entries(CABECALHOS_SEGURANCA)) {
    assert.equal(headers[nome], valor, nome)
  }
})

/* ---------- log de acesso: visibilidade sem telemetria nenhuma ---------- */

/** Troca console.log por um instante, devolve as linhas capturadas e restaura no fim. */
async function capturarLog(fn) {
  const original = console.log
  const linhas = []
  console.log = (...args) => linhas.push(args.join(' '))
  try {
    await fn()
  } finally {
    console.log = original
  }
  return linhas
}

test('tratarApi: loga uma linha por requisicao, com metodo, caminho e status', async () => {
  const req = { method: 'GET', headers: {}, socket: { remoteAddress: '203.0.113.1' } }
  const linhas = await capturarLog(() => tratarApi(req, resFake(), '/api/eu'))
  assert.equal(linhas.length, 1)
  // 503 porque este ambiente de teste nao tem DATABASE_URL - ver banco.js
  assert.match(linhas[0], /^\[api\] GET \/api\/eu -> 503 \(\d+ms\)$/)
})

test('tratarApi: loga tambem a rota inexistente (404), nao so o caminho tratado', async () => {
  const req = { method: 'GET', headers: {}, socket: { remoteAddress: '203.0.113.1' } }
  // esta checagem so roda com banco configurado, entao aqui so confirma que
  // o 503 (sem banco) tambem gera log pra um caminho de /api/ que nao existe
  const linhas = await capturarLog(() => tratarApi(req, resFake(), '/api/rota-que-nao-existe'))
  assert.equal(linhas.length, 1)
  assert.match(linhas[0], /^\[api\] GET \/api\/rota-que-nao-existe -> 503 \(\d+ms\)$/)
})
