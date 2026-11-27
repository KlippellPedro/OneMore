/**
 * A API do OneMore. Mora no MESMO servidor que serve o site, sob /api/, e isso
 * e uma decisao de projeto: mesma origem significa zero CORS, zero mixed
 * content e cookie HttpOnly funcionando - que e o unico jeito de guardar
 * sessao sem deixar o token ao alcance de qualquer script da pagina.
 *
 * Rotas:
 *   POST   /api/conta    cria a conta e ja deixa logado (uma conta por e-mail)
 *   DELETE /api/conta    apaga a conta e tudo dela (logado + confirma a senha)
 *   POST   /api/sessao   entra
 *   DELETE /api/sessao   sai
 *   GET    /api/eu       quem esta logado (204 se ninguem)
 *   POST   /api/recuperacao  gera um codigo de recuperacao novo (logado)
 *   POST   /api/senha        troca a senha usando o codigo (sem estar logado)
 *   GET    /api/dados    baixa o backup da conta (204 se ainda nao enviou nada)
 *   PUT    /api/dados    sobe o backup da conta
 *   GET    /api/push/chave      chave VAPID publica, pro navegador se inscrever
 *   POST   /api/push/inscricao  este aparelho aceita push (logado)
 *   DELETE /api/push/inscricao  este aparelho nao quer mais (logado)
 *   PUT    /api/push/agenda     os proximos lembretes deste aparelho (logado)
 *   POST   /api/push/teste      manda um aviso agora, pra conferir (logado)
 *   GET    /api/amigos          meu codigo de convite + amigos com o cartao de cada um (logado)
 *   POST   /api/amigos          vira amigo de quem e dono do codigo (logado)
 *   DELETE /api/amigos          desfaz uma amizade, dos dois lados (logado)
 *   POST   /api/amigos/convite  gera ou troca meu codigo de convite (logado)
 *   DELETE /api/amigos/convite  desliga meu codigo: ninguem mais me adiciona (logado)
 *   PUT    /api/amigos/cartao   o resumo que meus amigos veem (logado)
 *   GET    /api/envios          treinos e dietas que mandaram pra mim, pendentes (logado)
 *   POST   /api/envios          manda treino ou dieta pra amigos (logado)
 *   DELETE /api/envios          usei ou recusei: tira da caixa (logado)
 *   GET    /api/equipe          minha equipe (se sou treinador) e a equipe em que sou aluno (logado)
 *   POST   /api/equipe          cria minha equipe de treinador (logado)
 *   PUT    /api/equipe          muda nome, meu nome ou o codigo da equipe (logado)
 *   DELETE /api/equipe          desfaz minha equipe (logado)
 *   POST   /api/equipe/entrar   entro numa equipe com o codigo, dizendo o que libero (logado)
 *   PUT    /api/equipe/permissoes  mudo o que libero pro treinador (logado)
 *   DELETE /api/equipe/sair     saio da equipe em que sou aluno (logado)
 *   GET    /api/equipe/aluno?id=  o que um aluno meu liberou (logado, treinador)
 *   DELETE /api/equipe/aluno    tiro um aluno da equipe (logado, treinador)
 *   PUT    /api/equipe/prescricao  mando treino ou dieta montados pra um aluno (logado, treinador)
 */
import { promisify } from 'node:util'
import { gzip as gzipCb } from 'node:zlib'
import { consultar, configurado, pronto } from './banco.js'
import { CABECALHOS_SEGURANCA } from './seguranca.js'
import {
  chaveVapid, validarInscricao, validarAgenda, salvarInscricao, apagarInscricao,
  salvarAgenda, enviarTeste,
} from './push.js'
import {
  normalizarConvite, formatarConvite, uuidValido, validarCartao,
  meuConvite, novoConvite, apagarConvite, adicionarAmigo, removerAmigo, listarAmigos, salvarCartao,
} from './amigos.js'
import {
  LIMITE_PACOTE, validarPermissoes, problemaNoPacote, textoLimpo,
  minhaEquipe, equipeQueParticipo, criarEquipe, editarEquipe, apagarEquipe, entrarNaEquipe,
  mudarPermissoes, sairDaEquipe, removerAluno, lerAluno, prescrever,
  recebidos, enviarParaAmigos, resolverEnvio,
} from './equipe.js'
import {
  COOKIE, hashSenha, conferirSenha, criarSessao, usuarioDaSessao, encerrarSessao,
  criarUsuario, acharPorEmail, normalizarEmail, emailCanonico, emailValido, problemaNaSenha,
  gerarCodigo, hashCodigo, conferirCodigo, trocarSenha,
  lerCookie, cookieSessao, cookieLimpo,
} from './auth.js'

/** O backup inteiro vai num JSON so. 12 MB cobre anos de treino com folga. */
const LIMITE_CORPO = 12 * 1024 * 1024
/** E-mail + senha (+ codigo): cabe de sobra em 4 KB, mesmo com folga generosa. */
export const LIMITE_CORPO_CONTA = 4 * 1024
const SENHA_MINIMA = 8
const MSG_EMAIL_EM_USO = 'Já existe uma conta com esse e-mail. Entre nela ou use "Esqueci a senha".'
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
/** Agenda de push: ate 200 avisos de ~300 bytes cada. */
const LIMITE_CORPO_AGENDA = 128 * 1024
/** Cartao de amigos: o cheio (40 dias, 5 treinos, 3 recordes) tem ~2 KB. */
const LIMITE_CORPO_CARTAO = 16 * 1024

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
    let estourou = false
    const partes = []
    req.on('data', p => {
      if (estourou) return
      tam += p.length
      if (tam > limite) {
        estourou = true
        partes.length = 0
        /**
         * Para de ler, mas NAO derruba a conexao aqui: derrubando antes de
         * responder, o navegador via so "conexao fechada" - e o app mostrava
         * "Sem conexao com o servidor" pra um backup grande demais, que e outra
         * coisa. Quem fecha e o tratarApi, depois que o 413 saiu (ver `fechar`).
         */
        req.pause()
        falhou(Object.assign(new Error('Corpo da requisição grande demais.'), { status: 413, fechar: true }))
        return
      }
      partes.push(p)
    })
    req.on('end', () => {
      if (estourou) return
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
/**
 * Conta pela forma CANONICA: `a@gmail.com`, `a+1@gmail.com`, `a+2@gmail.com`...
 * entram na MESMA conta (ver acharPorEmail), entao se cada grafia tivesse o
 * proprio contador o freio por conta nunca travava - bastava variar o "+".
 */
export const freadoPorConta = email => contar(`conta:${emailCanonico(email)}`, MAX_POR_CONTA)

/**
 * Freio do codigo de convite, por IP e por conta - mesma ideia do login: e um
 * segredo curto sendo adivinhado. Baldes proprios (`convite-*`), pra quem erra
 * codigo de amigo nao travar o proprio login. Sucesso zera os dois, entao so
 * o ERRO acumula: adicionar dez amigos seguidos nao trava ninguem.
 */
export const MAX_CONVITE = 10
export const freadoNoConvite = (req, usuarioId) =>
  contar(`convite-ip:${ipDe(req)}`, MAX_CONVITE) || contar(`convite-conta:${usuarioId}`, MAX_CONVITE)
function desfrearConvite(req, usuarioId) {
  tentativas.delete(`convite-ip:${ipDe(req)}`)
  tentativas.delete(`convite-conta:${usuarioId}`)
}

/** Sucesso limpa os dois contadores - senao o uso normal ia acumulando ate travar. */
function desfrear(req, email) {
  tentativas.delete(`ip:${ipDe(req)}`)
  tentativas.delete(`conta:${emailCanonico(email)}`)
}

// a cada 30 min joga fora quem ja venceu, pro Map nao virar vazamento de memoria
setInterval(() => {
  const agora = Date.now()
  for (const [chave, reg] of tentativas) if (agora > reg.ate) tentativas.delete(chave)
}, 30 * 60 * 1000).unref()

/* ------------------------------------------------------------------ */
/* ROTAS                                                               */
/* ------------------------------------------------------------------ */

/**
 * Teto de escritas por conta, por minuto. O app legitimo fica longe disso: a
 * publicacao do backup espera 3 s depois da ultima mudanca (no maximo ~20 por
 * minuto treinando), e o resto e ocasional. Isto e rede contra script: sem
 * teto, uma conta logada podia mandar PUT /api/dados de 12 MB sem parar e
 * ocupar o banco e os 512 MB do processo. Memoria do processo, igual ao freio
 * de senha - reiniciar zera, e tudo bem.
 */
export const MAX_ESCRITAS_POR_MINUTO = 120
const escritas = new Map()

export function escritasDemais(usuarioId, agora = Date.now()) {
  const reg = escritas.get(usuarioId)
  if (!reg || agora > reg.ate) {
    escritas.set(usuarioId, { n: 1, ate: agora + 60_000 })
    return false
  }
  reg.n++
  return reg.n > MAX_ESCRITAS_POR_MINUTO
}

setInterval(() => {
  const agora = Date.now()
  for (const [chave, reg] of escritas) if (agora > reg.ate) escritas.delete(chave)
}, 10 * 60 * 1000).unref()

async function exigirLogin(req, res) {
  const u = await usuarioDaSessao(lerCookie(req, COOKIE))
  if (!u) {
    erro(res, 401, 'Entre na sua conta.')
    return null
  }
  if (req.method !== 'GET' && req.method !== 'HEAD' && escritasDemais(u.id)) {
    erro(res, 429, 'Muitas alterações seguidas. Espere um minuto.')
    return null
  }
  return u
}

async function postConta(req, res) {
  if (freadoPorIp(req)) return erro(res, 429, 'Muitas tentativas. Espere uns minutos.')

  const corpo = await lerCorpo(req, LIMITE_CORPO_CONTA)
  const email = normalizarEmail(corpo.email)
  const senha = String(corpo.senha ?? '')

  if (!emailValido(email)) return erro(res, 400, 'E-mail inválido.')
  if (senha.length < SENHA_MINIMA) {
    return erro(res, 400, `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`)
  }
  if (senha.length > SENHA_MAXIMA) {
    return erro(res, 400, `A senha pode ter no máximo ${SENHA_MAXIMA} caracteres.`)
  }
  const ruim = problemaNaSenha(senha, email)
  if (ruim) return erro(res, 400, ruim)
  // pela forma canonica: a+x@gmail.com e a.b@gmail.com sao a mesma caixa
  if (await acharPorEmail(email)) return erro(res, 409, MSG_EMAIL_EM_USO)

  let usuario
  try {
    usuario = await criarUsuario(email, senha)
  } catch (e) {
    // corrida entre dois cadastros do mesmo e-mail: o unique do banco decide
    if (e.code === '23505') return erro(res, 409, MSG_EMAIL_EM_USO)
    throw e
  }

  const { token, expira } = await criarSessao(usuario.id)
  desfrear(req, email)
  // o codigo de recuperacao volta AQUI e so aqui - depois disso so existe o hash
  responder(res, 201, { email: usuario.email, codigo: usuario.codigo },
    { 'Set-Cookie': cookieSessao(req, token, expira) })
}

/**
 * Apaga a conta e tudo que e dela. Exige a SENHA de novo, mesmo logado: um
 * celular desbloqueado e esquecido por ai nao pode ser o bastante pra apagar
 * (ou, pior, pra um terceiro apagar) anos de treino. As tabelas filhas
 * (sessoes, dados, push_inscricoes, push_avisos, convites, amizades, cartoes,
 * equipes, equipe_membros e envios) saem junto por `on delete cascade` - ver
 * banco.js. Os dados DESTE aparelho ficam: sao da pessoa.
 */
async function deleteConta(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const corpo = await lerCorpo(req, LIMITE_CORPO_CONTA)
  const senha = String(corpo.senha ?? '').slice(0, SENHA_MAXIMA)
  // mesmo freio do login: aqui a senha tambem esta sendo adivinhada
  if (freadoPorConta(u.email)) return erro(res, 429, 'Muitas tentativas. Espere uns minutos.')
  const { rows } = await consultar('select senha_hash from usuarios where id = $1', [u.id])
  if (!rows.length || !(await conferirSenha(senha, rows[0].senha_hash))) {
    return erro(res, 401, 'Senha incorreta.')
  }
  await consultar('delete from usuarios where id = $1', [u.id])
  desfrear(req, u.email)
  responder(res, 200, { ok: true }, { 'Set-Cookie': cookieLimpo(req) })
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
    return erro(res, 400, `A senha pode ter no máximo ${SENHA_MAXIMA} caracteres.`)
  }

  const ruim = problemaNaSenha(senha, email)
  if (ruim) return erro(res, 400, ruim)

  const usuario = await acharPorEmail(email)
  const ok = usuario?.codigo_hash
    ? await conferirCodigo(codigo, usuario.codigo_hash)
    : (await hashSenha(codigo), false)
  if (!ok) return erro(res, 401, 'E-mail ou código de recuperação incorretos.')

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

const gzip = promisify(gzipCb)

async function getDados(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const { rows } = await consultar(
    'select payload, atualizado_em from dados where usuario_id = $1', [u.id],
  )
  if (!rows.length) return responder(res, 204)
  const corpo = { payload: rows[0].payload, atualizadoEm: rows[0].atualizado_em }
  /**
   * Comprimido: e o estado INTEIRO da conta, baixado a cada sincronizacao que
   * achou novidade - com o catalogo de exercicios e alimentos ja passa de
   * 100 KB numa conta nova e chega perto de 2 MB com dois anos de treino e
   * dieta. JSON comprime ~90%, e isso e o 4G de quem esta na academia.
   */
  const texto = JSON.stringify(corpo)
  if (texto.length > 8 * 1024 && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))) {
    const comprimido = await gzip(texto, { level: 6 })
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Encoding': 'gzip',
      Vary: 'Accept-Encoding',
      ...CABECALHOS_SEGURANCA,
    })
    return res.end(comprimido)
  }
  responder(res, 200, corpo)
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
    return erro(res, 400, 'Dados inválidos.')
  }
  const { rows } = await consultar(
    `insert into dados (usuario_id, payload, atualizado_em) values ($1, $2, now())
     on conflict (usuario_id) do update set payload = excluded.payload, atualizado_em = now()
     returning atualizado_em`,
    [u.id, payload],
  )
  responder(res, 200, { atualizadoEm: rows[0].atualizado_em })
}

/* ------------------------------------------------------------------ */
/* PUSH (ver servidor/push.js)                                         */
/* ------------------------------------------------------------------ */

async function getChavePush(req, res) {
  const chave = chaveVapid()
  if (!chave) return erro(res, 503, 'Os avisos ainda não estão prontos no servidor. Tente daqui a pouco.')
  responder(res, 200, { chave })
}

async function postInscricao(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const insc = validarInscricao(await lerCorpo(req, LIMITE_CORPO_CONTA))
  if (!insc) return erro(res, 400, 'Inscrição de aviso inválida.')
  await salvarInscricao(u.id, insc)
  responder(res, 200, { ok: true })
}

async function deleteInscricao(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const { endpoint } = await lerCorpo(req, LIMITE_CORPO_CONTA)
  if (typeof endpoint === 'string') await apagarInscricao(u.id, endpoint)
  responder(res, 200, { ok: true })
}

async function putAgenda(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const corpo = await lerCorpo(req, LIMITE_CORPO_AGENDA)
  if (typeof corpo.endpoint !== 'string') return erro(res, 400, 'Falta o endpoint.')
  const itens = validarAgenda(corpo.itens)
  // 404 e nao 403: o aparelho cuja inscricao sumiu (expirou, outra conta) se reinscreve
  if (!(await salvarAgenda(u.id, corpo.endpoint, itens))) return erro(res, 404, 'Este aparelho não está inscrito nos avisos.')
  responder(res, 200, { avisos: itens.length })
}

async function postTestePush(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const { endpoint } = await lerCorpo(req, LIMITE_CORPO_CONTA)
  try {
    if (!(await enviarTeste(u.id, String(endpoint ?? '')))) return erro(res, 404, 'Este aparelho não está inscrito nos avisos.')
  } catch (e) {
    return erro(res, 502, `O serviço de avisos recusou (${e?.statusCode ?? 'sem resposta'}).`)
  }
  responder(res, 200, { ok: true })
}

/* ------------------------------------------------------------------ */
/* AMIGOS (ver servidor/amigos.js)                                     */
/* ------------------------------------------------------------------ */

async function getAmigos(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const [convite, amigos] = await Promise.all([meuConvite(u.id), listarAmigos(u.id)])
  responder(res, 200, { convite: formatarConvite(convite), amigos })
}

async function postConvite(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  responder(res, 200, { convite: formatarConvite(await novoConvite(u.id)) })
}

async function deleteConvite(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  await apagarConvite(u.id)
  responder(res, 200, { ok: true })
}

const MSG_AMIGO = {
  'nao-existe': [404, 'Esse código não existe (ou o dono trocou por outro).'],
  proprio: [400, 'Esse é o seu próprio código.'],
  limite: [409, 'Limite de amigos atingido.'],
}

async function postAmigo(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  if (freadoNoConvite(req, u.id)) return erro(res, 429, 'Muitas tentativas. Espere uns minutos.')
  const { codigo: bruto } = await lerCorpo(req, LIMITE_CORPO_CONTA)
  const codigo = normalizarConvite(bruto)
  if (!codigo) return erro(res, 400, 'Código inválido. Ele tem 8 letras e números, tipo K7Q2-XP9M.')
  const r = await adicionarAmigo(u.id, codigo)
  // ja-amigos nao e erro: usar o codigo de novo so confirma o que ja existe
  if (r.motivo && r.motivo !== 'ja-amigos') return erro(res, ...MSG_AMIGO[r.motivo])
  desfrearConvite(req, u.id)
  const amigo = (await listarAmigos(u.id)).find(a => a.id === r.amigoId) ?? null
  responder(res, r.motivo ? 200 : 201, { amigo, jaEram: r.motivo === 'ja-amigos' })
}

async function deleteAmigo(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const { id } = await lerCorpo(req, LIMITE_CORPO_CONTA)
  if (!uuidValido(id)) return erro(res, 400, 'Amigo inválido.')
  await removerAmigo(u.id, id)
  responder(res, 200, { ok: true })
}

async function putCartao(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const cartao = validarCartao((await lerCorpo(req, LIMITE_CORPO_CARTAO)).cartao)
  if (!cartao) return erro(res, 400, 'Cartão inválido.')
  responder(res, 200, { guardado: await salvarCartao(u.id, cartao) })
}

/* ------------------------------------------------------------------ */
/* ENVIOS E EQUIPE (ver servidor/equipe.js)                            */
/* ------------------------------------------------------------------ */

/** Corpo de envio/prescricao: o pacote tem teto proprio, mais uma folga pro resto. */
const LIMITE_CORPO_PACOTE = LIMITE_PACOTE + 8 * 1024

async function getEnvios(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  responder(res, 200, { envios: await recebidos(u.id) })
}

async function postEnvio(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const { para, tipo, nome, conteudo } = await lerCorpo(req, LIMITE_CORPO_PACOTE)
  if (!Array.isArray(para) || !para.length) return erro(res, 400, 'Escolha pra quem mandar.')
  const ruim = problemaNoPacote(tipo, conteudo)
  if (ruim) return erro(res, 400, ruim)
  const enviados = await enviarParaAmigos(u.id, para, tipo, textoLimpo(nome, 80) || 'Treino', conteudo)
  if (!enviados) return erro(res, 409, 'Não deu pra mandar: só vai pra amigos, e a caixa deles tem limite.')
  responder(res, 201, { enviados })
}

async function deleteEnvio(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const { id } = await lerCorpo(req, LIMITE_CORPO_CONTA)
  await resolverEnvio(u.id, id)
  responder(res, 200, { ok: true })
}

async function getEquipe(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const [minha, participo] = await Promise.all([minhaEquipe(u.id), equipeQueParticipo(u.id)])
  responder(res, 200, { minha, participo })
}

async function postEquipe(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const corpo = await lerCorpo(req, LIMITE_CORPO_CONTA)
  const nome = textoLimpo(corpo.nome, 60)
  const treinador = textoLimpo(corpo.treinador, 60)
  if (!nome || !treinador) return erro(res, 400, 'Preencha o nome da equipe e o seu nome.')
  if (!(await criarEquipe(u.id, nome, treinador))) return erro(res, 409, 'Você já tem uma equipe.')
  responder(res, 201, { minha: await minhaEquipe(u.id) })
}

async function putEquipe(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const corpo = await lerCorpo(req, LIMITE_CORPO_CONTA)
  await editarEquipe(u.id, {
    nome: textoLimpo(corpo.nome, 60), treinador: textoLimpo(corpo.treinador, 60), novoCodigo: corpo.novoCodigo === true,
  })
  responder(res, 200, { minha: await minhaEquipe(u.id) })
}

async function deleteEquipe(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  await apagarEquipe(u.id)
  responder(res, 200, { ok: true })
}

const MSG_EQUIPE = {
  'nao-existe': [404, 'Esse código de equipe não existe (ou o treinador trocou por outro).'],
  propria: [400, 'Essa é a sua própria equipe.'],
  'ja-tem': [409, 'Você já está em outra equipe. Saia dela antes de entrar nesta.'],
  lotada: [409, 'Essa equipe está lotada.'],
}

async function postEntrarEquipe(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  // codigo de equipe e o mesmo tipo de segredo curto do convite de amigo: mesmo freio
  if (freadoNoConvite(req, u.id)) return erro(res, 429, 'Muitas tentativas. Espere uns minutos.')
  const { codigo: bruto, permissoes } = await lerCorpo(req, LIMITE_CORPO_CONTA)
  const codigo = normalizarConvite(bruto)
  if (!codigo) return erro(res, 400, 'Código inválido. Ele tem 8 letras e números, tipo K7Q2-XP9M.')
  const motivo = await entrarNaEquipe(u.id, codigo, permissoes)
  if (motivo) return erro(res, ...MSG_EQUIPE[motivo])
  desfrearConvite(req, u.id)
  responder(res, 200, { participo: await equipeQueParticipo(u.id) })
}

async function putPermissoes(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const { permissoes } = await lerCorpo(req, LIMITE_CORPO_CONTA)
  if (!(await mudarPermissoes(u.id, permissoes))) return erro(res, 404, 'Você não está em nenhuma equipe.')
  responder(res, 200, { permissoes: validarPermissoes(permissoes) })
}

async function deleteSairEquipe(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  await sairDaEquipe(u.id)
  responder(res, 200, { ok: true })
}

async function getAluno(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const id = new URL(req.url, 'http://local').searchParams.get('id')
  if (!uuidValido(id)) return erro(res, 400, 'Aluno inválido.')
  const aluno = await lerAluno(u.id, id)
  // 404 tanto pra "nao existe" quanto pra "nao e seu aluno": nao entrega quem existe
  if (!aluno) return erro(res, 404, 'Aluno não encontrado na sua equipe.')
  responder(res, 200, aluno)
}

async function deleteAluno(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const { id } = await lerCorpo(req, LIMITE_CORPO_CONTA)
  if (!uuidValido(id)) return erro(res, 400, 'Aluno inválido.')
  await removerAluno(u.id, id)
  responder(res, 200, { ok: true })
}

async function putPrescricao(req, res) {
  const u = await exigirLogin(req, res)
  if (!u) return
  const { aluno, tipo, nome, conteudo } = await lerCorpo(req, LIMITE_CORPO_PACOTE)
  if (!uuidValido(aluno)) return erro(res, 400, 'Aluno inválido.')
  const ruim = problemaNoPacote(tipo, conteudo)
  if (ruim) return erro(res, 400, ruim)
  const ok = await prescrever(u.id, aluno, tipo, textoLimpo(nome, 80) || (tipo === 'treino' ? 'Treino' : 'Dieta'), conteudo)
  if (!ok) return erro(res, 404, 'Aluno não encontrado na sua equipe.')
  responder(res, 200, { ok: true })
}

const ROTAS = {
  'GET /api/envios': getEnvios,
  'POST /api/envios': postEnvio,
  'DELETE /api/envios': deleteEnvio,
  'GET /api/equipe': getEquipe,
  'POST /api/equipe': postEquipe,
  'PUT /api/equipe': putEquipe,
  'DELETE /api/equipe': deleteEquipe,
  'POST /api/equipe/entrar': postEntrarEquipe,
  'PUT /api/equipe/permissoes': putPermissoes,
  'DELETE /api/equipe/sair': deleteSairEquipe,
  'GET /api/equipe/aluno': getAluno,
  'DELETE /api/equipe/aluno': deleteAluno,
  'PUT /api/equipe/prescricao': putPrescricao,
  'GET /api/amigos': getAmigos,
  'POST /api/amigos': postAmigo,
  'DELETE /api/amigos': deleteAmigo,
  'POST /api/amigos/convite': postConvite,
  'DELETE /api/amigos/convite': deleteConvite,
  'PUT /api/amigos/cartao': putCartao,
  'GET /api/push/chave': getChavePush,
  'POST /api/push/inscricao': postInscricao,
  'DELETE /api/push/inscricao': deleteInscricao,
  'PUT /api/push/agenda': putAgenda,
  'POST /api/push/teste': postTestePush,
  'POST /api/conta': postConta,
  'DELETE /api/conta': deleteConta,
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

  /**
   * CSRF, em camada dupla com o SameSite=Lax do cookie: o navegador informa em
   * `Sec-Fetch-Site` de onde veio a requisicao, e isso um site malicioso nao
   * consegue forjar. Escrita (POST/PUT/DELETE) vinda de OUTRO site e barrada
   * antes de chegar na rota. Nao se compara Origin/Host de proposito: atras do
   * proxy da Discloud o Host pode nao ser o que o navegador digitou, e isso
   * derrubaria o login de todo mundo. Navegador sem o cabecalho (antigo) segue
   * so com o SameSite - e `curl`/scripts, que nao sao vetor de CSRF, tambem.
   */
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const origem = req.headers['sec-fetch-site']
    if (origem === 'cross-site' || origem === 'same-site') {
      erro(res, 403, 'Requisição de outro site bloqueada.')
      logarAcesso(req, caminho, 403, desde)
      return true
    }
  }

  // sem banco a conta nao funciona, mas o site continua servindo normalmente
  if (!configurado || !pronto) {
    erro(res, 503, 'O servidor ainda não está conectado ao banco. Tente daqui a pouco.')
    logarAcesso(req, caminho, 503, desde)
    return true
  }

  const rota = ROTAS[`${req.method} ${caminho}`]
  if (!rota) {
    erro(res, 404, 'Rota não encontrada.')
    logarAcesso(req, caminho, 404, desde)
    return true
  }

  try {
    await rota(req, res)
  } catch (e) {
    // erro do cliente (400, 413) ja aparece na linha de acesso; stack so pro que e nosso
    if (!e.status || e.status >= 500) console.error(`[api] ${req.method} ${caminho}:`, e)
    if (!res.headersSent) {
      // mensagem generica pra fora: detalhe de erro interno so no log
      erro(res, e.status ?? 500, e.status ? e.message : 'Erro no servidor.',
        e.fechar ? { Connection: 'close' } : undefined)
    }
    // corpo grande demais: o resto nao vai ser lido, entao a conexao fecha depois da resposta
    if (e.fechar) res.once('finish', () => req.destroy())
  }
  logarAcesso(req, caminho, res.statusCode, desde)
  return true
}
