import test from 'node:test'
import assert from 'node:assert/strict'
import { validarInscricao, validarAgenda, MAX_AVISOS } from './push.js'

// formato real: p256dh e um ponto P-256 (65 bytes), auth sao 16 bytes - em base64url
const CHAVES = {
  p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
  auth: 'tBHItJI5svbpez7KI4CCXg',
}
const insc = endpoint => ({ endpoint, keys: CHAVES })

test('aceita inscricao dos servicos de push dos navegadores', () => {
  for (const url of [
    'https://fcm.googleapis.com/fcm/send/abc:123',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/QGuQyavXutnMqQ',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ]) {
    assert.ok(validarInscricao(insc(url)), url)
  }
})

/**
 * O servidor faz POST na URL que o aparelho mandou. Sem a lista de servicos,
 * uma conta qualquer cadastraria um endereco interno e usaria o servidor pra
 * bater la dentro (SSRF) - inclusive no IP de metadados de nuvem.
 */
test('recusa endereco que nao e servico de push (SSRF)', () => {
  for (const url of [
    'http://localhost:8080/api/dados',
    'https://127.0.0.1/x',
    'http://169.254.169.254/latest/meta-data',
    'http://fcm.googleapis.com/fcm/send/abc', // sem https
    'https://fcm.googleapis.com.atacante.com/x', // sufixo enganoso
    'https://atacantefcm.googleapis.com.evil/x',
    'https://evil-push.apple.com.br/x',
    'nao e url',
  ]) {
    assert.equal(validarInscricao(insc(url)), null, url)
  }
})

test('recusa inscricao sem as chaves de criptografia certas', () => {
  const url = 'https://fcm.googleapis.com/fcm/send/abc'
  assert.equal(validarInscricao({ endpoint: url }), null)
  assert.equal(validarInscricao({ endpoint: url, keys: { p256dh: 'curto', auth: CHAVES.auth } }), null)
  assert.equal(validarInscricao({ endpoint: url, keys: { p256dh: CHAVES.p256dh, auth: 'com espaco e acento á' } }), null)
  assert.equal(validarInscricao(null), null)
})

const agora = Date.UTC(2026, 9, 29, 12)
const aviso = (extra = {}) => ({
  id: 'agua-1', ts: agora + 60_000, tipo: 'agua', titulo: 'Hora de beber água', corpo: 'Meta: 3 L', rota: '#/dieta', ...extra,
})

test('validarAgenda: mantem o aviso bom como veio', () => {
  assert.deepEqual(validarAgenda([aviso()], agora), [aviso()])
})

test('validarAgenda: descarta item a item, sem derrubar a agenda', () => {
  const r = validarAgenda([
    aviso({ id: 'ok' }),
    aviso({ id: 'tipo-estranho', tipo: 'spam' }),
    aviso({ id: 'sem-titulo', titulo: '' }),
    aviso({ id: 'passado', ts: agora - 10 * 60_000 }),
    aviso({ id: 'longe-demais', ts: agora + 30 * 24 * 3600_000 }),
    aviso({ id: 'ts-texto', ts: 'amanha' }),
    null,
  ], agora)
  assert.deepEqual(r.map(a => a.id), ['ok'])
})

test('validarAgenda: rota so dentro do app (vira o endereco aberto ao tocar)', () => {
  const r = validarAgenda([
    aviso({ id: 'a', rota: 'https://site-de-golpe.com' }),
    aviso({ id: 'b', rota: 'javascript:alert(1)' }),
    aviso({ id: 'c', rota: '#/?beber=250' }),
  ], agora)
  assert.deepEqual(r.map(a => a.rota), ['#/', '#/', '#/?beber=250'])
})

test('validarAgenda: corta texto comprido e limita a quantidade', () => {
  const r = validarAgenda([aviso({ titulo: 'x'.repeat(500), corpo: 'y'.repeat(5000) })], agora)
  assert.equal(r[0].titulo.length, 80)
  assert.equal(r[0].corpo.length, 200)
  const muitos = Array.from({ length: MAX_AVISOS + 50 }, (_, i) => aviso({ id: `a${i}` }))
  assert.equal(validarAgenda(muitos, agora).length, MAX_AVISOS)
  assert.deepEqual(validarAgenda('nao e lista', agora), [])
})

/**
 * As opcoes viram cabecalhos HTTP do protocolo. Nome errado (ou topico com
 * caractere proibido) a biblioteca rejeita - so que na hora de mandar, em
 * producao, calado no log. Aqui a propria biblioteca monta a requisicao.
 */
test('opcoesEnvio vira os cabecalhos certos do Web Push, pra todo tipo de aviso', async () => {
  const { default: webpush } = await import('web-push')
  const { createECDH, randomBytes } = await import('node:crypto')
  const { opcoesEnvio } = await import('./push.js')

  const vapid = webpush.generateVAPIDKeys()
  const aparelho = createECDH('prime256v1')
  aparelho.generateKeys()
  const inscricao = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/teste',
    keys: { p256dh: aparelho.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') },
  }
  for (const tipo of ['agua', 'refeicao', 'treino', 'glicemia', 'teste']) {
    const r = webpush.generateRequestDetails(inscricao, JSON.stringify({ tipo, titulo: 'x' }), {
      ...opcoesEnvio(tipo),
      vapidDetails: { subject: 'mailto:suporte@onemore.app', publicKey: vapid.publicKey, privateKey: vapid.privateKey },
    })
    assert.equal(r.headers.TTL, 3600)
    assert.equal(r.headers.Urgency, 'high')
    assert.equal(r.headers.Topic, tipo)
    assert.equal(r.headers['Content-Encoding'], 'aes128gcm')
    assert.match(r.headers.Authorization, /^vapid t=.+, k=/)
  }
})
