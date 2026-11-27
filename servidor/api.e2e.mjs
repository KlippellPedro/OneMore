/**
 * Teste de seguranca da API de ponta a ponta, por HTTP, contra um servidor
 * LOCAL com banco descartavel. Cria contas, tenta ler e mexer no que e dos
 * outros (backup, caixa de envios, alunos de outro treinador), forca bruta,
 * CSRF, corpo gigante e exclusao de conta - e confere que tudo e barrado.
 *
 * Nao entra no `npm test` porque precisa de Postgres. Pra rodar:
 *
 *   docker run -d --name onemore-pg -e POSTGRES_PASSWORD=teste -e POSTGRES_DB=onemore -p 127.0.0.1:55432:5432 postgres:16-alpine
 *   DATABASE_URL=postgres://postgres:teste@127.0.0.1:55432/onemore node servidor.js --porta=8099
 *   npm run test:api            (ou ONEMORE_API=http://127.0.0.1:8099/api npm run test:api)
 *
 * NUNCA aponte isto pra producao: ele cria contas e as apaga. Por isso so
 * aceita localhost.
 */
const B = process.env.ONEMORE_API || 'http://127.0.0.1:8099/api'
if (!/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\//.test(B)) {
  console.error(`Recusado: ${B} nao e local. Este teste cria e apaga contas.`)
  process.exit(2)
}
let falhas = 0, ok = 0
const checar = (cond, nome, extra = '') => {
  if (cond) { ok++; console.log('  ok   ', nome) } else { falhas++; console.log('  FALHA', nome, extra) }
}
const sufixo = Date.now().toString(36)
let ipN = 1
async function req(metodo, rota, corpo, cookie, hdr = {}) {
  const r = await fetch(B + rota, {
    method: metodo,
    headers: {
      ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      'x-forwarded-for': `10.0.${Math.floor(ipN / 250)}.${ipN++ % 250}`,
      ...hdr,
    },
    body: corpo === undefined ? undefined : (typeof corpo === 'string' ? corpo : JSON.stringify(corpo)),
  })
  const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch { /* nao e json */ }
  return { s: r.status, j, t, h: r.headers }
}
const ck = r => (r.h.get('set-cookie') || '').split(';')[0]
async function conta(nome) {
  const email = `${nome}-${sufixo}@teste.dev`
  const r = await req('POST', '/conta', { email, senha: 'Senha-forte-' + nome })
  return { email, cookie: ck(r), r }
}

console.log('# contas')
const A = await conta('a'), Bc = await conta('b'), C = await conta('c')
checar(A.r.s === 201 && A.cookie.startsWith('onemore_sessao='), 'cria conta A com cookie')
checar(/HttpOnly/.test(A.r.h.get('set-cookie')) && /SameSite=Lax/.test(A.r.h.get('set-cookie')), 'cookie HttpOnly + SameSite')
checar(typeof A.r.j?.codigo === 'string', 'codigo de recuperacao devolvido 1x')
const dup = await req('POST', '/conta', { email: A.email.replace('@', '+x@'), senha: 'Outra-senha-123' })
checar(dup.s === 409, 'mesma caixa com +tag nao cria 2a conta', dup.s)
const fraca = await req('POST', '/conta', { email: `f-${sufixo}@teste.dev`, senha: '12345678' })
checar(fraca.s === 400, 'senha comum recusada')
const longa = await req('POST', '/conta', { email: `g-${sufixo}@teste.dev`, senha: 'x'.repeat(5000) })
  .catch(() => ({ s: 'conexao-cortada' }))
checar(longa.s === 413, 'senha gigante recusada com 413 legivel', longa.s)

console.log('# sessao')
checar((await req('GET', '/dados')).s === 401, 'GET /dados sem login = 401')
checar((await req('GET', '/eu', undefined, 'onemore_sessao=lixo')).s === 204, 'cookie forjado nao autentica')
const login = await req('POST', '/sessao', { email: A.email, senha: 'Senha-forte-a' })
checar(login.s === 200, 'login A')
const A2 = ck(login)
const errado = await req('POST', '/sessao', { email: A.email, senha: 'errada-errada' })
const inexistente = await req('POST', '/sessao', { email: `nao-${sufixo}@teste.dev`, senha: 'errada-errada' })
checar(errado.s === 401 && inexistente.s === 401 && errado.j.erro === inexistente.j.erro, 'mesma msg pra senha errada e e-mail inexistente')
await req('DELETE', '/sessao', undefined, A2)
checar((await req('GET', '/eu', undefined, A2)).s === 204, 'logout invalida o token no servidor')

console.log('# CSRF')
const csrf = await req('PUT', '/dados', { payload: { app: 'onemore', dados: {} } }, A.cookie, { 'sec-fetch-site': 'cross-site' })
checar(csrf.s === 403, 'escrita cross-site bloqueada')

console.log('# dados (backup) - so o dono')
const payloadA = {
  app: 'onemore', versao: 1,
  dados: {
    perfil: [{ id: 'me', nome: 'A' }],
    glicemia: [{ id: 'g1', valor: 99 }],
    sessoes: [{ id: 's1', concluida: 1, inicio: Date.now(), series: [{ exercicioId: 'supino', feito: true }] }],
  },
}
checar((await req('PUT', '/dados', { payload: payloadA }, A.cookie)).s === 200, 'A grava backup')
checar((await req('PUT', '/dados', { payload: { app: 'outro' } }, A.cookie)).s === 400, 'payload de outro app recusado')
const bLe = await req('GET', '/dados', undefined, Bc.cookie)
checar(bLe.s === 204, 'B nao enxerga backup de A (204 vazio)', bLe.s)
{
  // estado grande desce comprimido e chega inteiro (o fetch descompacta sozinho)
  const grande = { ...payloadA, dados: { ...payloadA.dados, dieta: Array.from({ length: 400 }, (_, i) => ({ id: 'd' + i, data: '2026-01-01', refeicao: 'Almoço', gramas: 100 })) } }
  checar((await req('PUT', '/dados', { payload: grande }, A.cookie)).s === 200, 'A grava backup grande')
  const lido = await req('GET', '/dados', undefined, A.cookie, { 'accept-encoding': 'gzip' })
  checar(lido.s === 200 && lido.h.get('content-encoding') === 'gzip' && lido.j?.payload?.dados?.dieta?.length === 400,
    'backup grande desce em gzip e chega inteiro', `${lido.s} ${lido.h.get('content-encoding')}`)
  checar((await req('PUT', '/dados', { payload: payloadA }, A.cookie)).s === 200, 'A volta ao backup pequeno')
}
checar((await req('PUT', '/dados', '{lixo', A.cookie)).s === 400, 'JSON invalido = 400')

console.log('# amigos')
const convA = (await req('POST', '/amigos/convite', {}, A.cookie)).j.convite
checar(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(convA), 'convite gerado')
checar((await req('POST', '/amigos', { codigo: convA }, A.cookie)).s === 400, 'nao adiciona a si mesmo')
const add = await req('POST', '/amigos', { codigo: convA }, Bc.cookie)
checar(add.s === 201, 'B vira amigo de A')
checar(!JSON.stringify(add.j).includes(A.email), 'resposta de amigo nao vaza e-mail')
await req('PUT', '/amigos/cartao', {
  cartao: { nome: '<img src=x onerror=alert(1)>', xp: 1e15, extra: 'x', dias: ['2026-01-01', 'lixo'] },
}, A.cookie)
const amigosB = await req('GET', '/amigos', undefined, Bc.cookie)
const cartao = amigosB.j.amigos[0]?.cartao
checar(cartao && cartao.xp === 1_000_000_000 && !('extra' in cartao) && cartao.dias.length === 1, 'cartao validado campo a campo no servidor')

console.log('# envios - IDOR')
const pacote = { app: 'onemore', tipo: 'semana', rotinas: [{ nome: 'T', itens: [] }] }
const idAvistoPorB = amigosB.j.amigos[0].id
const envA = await req('POST', '/envios', { para: [idAvistoPorB], tipo: 'treino', nome: 'x', conteudo: pacote }, Bc.cookie)
checar(envA.s === 201, 'B manda treino pra amigo A')
const idBvistoPorA = (await req('GET', '/amigos', undefined, A.cookie)).j.amigos[0].id
const envNaoAmigo = await req('POST', '/envios', { para: [idBvistoPorA], tipo: 'treino', nome: 'x', conteudo: pacote }, C.cookie)
checar(envNaoAmigo.s === 409, 'C (nao amigo) nao consegue mandar pra B', envNaoAmigo.s)
const caixaA = await req('GET', '/envios', undefined, A.cookie)
const idEnvio = caixaA.j.envios[0]?.id
checar(!!idEnvio, 'A recebeu o envio')
await req('DELETE', '/envios', { id: idEnvio }, C.cookie)
checar((await req('GET', '/envios', undefined, A.cookie)).j.envios.length === 1, 'C nao apaga envio da caixa de A')
checar((await req('GET', '/envios', undefined, C.cookie)).j.envios.length === 0, 'C nao ve a caixa de A')

console.log('# equipe - IDOR')
const eq = await req('POST', '/equipe', { nome: 'Equipe C', treinador: 'Treinador C' }, C.cookie)
checar(eq.s === 201, 'C cria equipe')
const codEq = eq.j.minha.codigo
const entra = await req('POST', '/equipe/entrar', { codigo: codEq, permissoes: { corpo: false, dieta: false, glicemia: true } }, A.cookie)
checar(entra.s === 200 && entra.j.participo.permissoes.dieta === false, 'A entra na equipe sem liberar dieta')
const minha = await req('GET', '/equipe', undefined, C.cookie)
const idA = minha.j.minha.alunos[0].id
const leAluno = await req('GET', `/equipe/aluno?id=${idA}`, undefined, C.cookie)
checar(leAluno.s === 200, 'treinador C le aluno A')
checar(!JSON.stringify(leAluno.j).includes('"g1"'), 'glicemia de A nunca chega ao treinador')
checar(leAluno.j.dados && !('dieta' in leAluno.j.dados), 'dieta nao liberada nao chega')
const bLeA = await req('GET', `/equipe/aluno?id=${idA}`, undefined, Bc.cookie)
checar(bLeA.s === 404, 'B (nao treinador) nao le A', bLeA.s)
const prescB = await req('PUT', '/equipe/prescricao', { aluno: idA, tipo: 'treino', nome: 'x', conteudo: pacote }, Bc.cookie)
checar(prescB.s === 404, 'B nao prescreve pra aluno de C', prescB.s)
await req('DELETE', '/equipe/aluno', { id: idA }, Bc.cookie)
checar((await req('GET', '/equipe', undefined, C.cookie)).j.minha.alunos.length === 1, 'B nao tira aluno da equipe de C')
const sqli = await req('GET', `/equipe/aluno?id=${encodeURIComponent("' or 1=1 --")}`, undefined, C.cookie)
checar(sqli.s === 400, 'id com SQL recusado antes do banco')
const prescTipo = await req('PUT', '/equipe/prescricao', { aluno: idA, tipo: 'programa = null, dieta', nome: 'x', conteudo: pacote }, C.cookie)
checar(prescTipo.s === 400, 'tipo fora da lista nao vira SQL')

console.log('# limites')
const grande = await req('PUT', '/amigos/cartao', { cartao: { nome: 'x'.repeat(40000) } }, A.cookie).catch(e => ({ s: 'conexao-cortada', e }))
checar(grande.s === 413 && /grande demais/.test(grande.j?.erro ?? ''), 'corpo acima do teto da rota = 413 com mensagem', grande.s)
const enorme = await req('PUT', '/dados', { payload: { app: 'onemore', lixo: 'x'.repeat(13 * 1024 * 1024) } }, A.cookie)
  .catch(() => ({ s: 'conexao-cortada' }))
checar(enorme.s === 413 || enorme.s === 'conexao-cortada', 'backup acima de 12 MB recusado', enorme.s)
checar((await req('GET', '/eu', undefined, A.cookie)).s === 200, 'servidor segue de pe depois do corpo gigante')
const rota404 = await req('GET', '/naoexiste', undefined, A.cookie)
checar(rota404.s === 404 && !/at |Error/.test(rota404.t), '404 sem stack trace')
// site: asset que nao existe e 404 (senao o service worker guarda o index.html
// no lugar do JS); pagina desconhecida continua sendo o app
const SITE = B.replace(/\/api$/, '')
const assetFaltando = await fetch(SITE + '/assets/Nao-Existe-ABC123.js')
checar(assetFaltando.status === 404 && !/html/.test(assetFaltando.headers.get('content-type') ?? ''),
  'asset inexistente = 404, nao index.html', assetFaltando.status)
const paginaDesconhecida = await fetch(SITE + '/treinos')
checar(paginaDesconhecida.status === 200 && /html/.test(paginaDesconhecida.headers.get('content-type') ?? ''),
  'caminho de pagina continua abrindo o app')

console.log('# cabecalhos')
const h = (await req('GET', '/eu')).h
checar(h.get('x-content-type-options') === 'nosniff' && h.get('x-frame-options') === 'DENY'
  && /frame-ancestors 'none'/.test(h.get('content-security-policy')), 'nosniff, DENY, CSP')
checar(h.get('cache-control') === 'no-store', 'API no-store')

console.log('# forca bruta')
const alvo = `bruta-${sufixo}@teste.dev`
await req('POST', '/conta', { email: alvo, senha: 'Senha-forte-bruta' })
let travou = false
for (let i = 0; i < 25; i++) {
  const r = await req('POST', '/sessao', { email: alvo, senha: 'chute-' + i })
  if (r.s === 429) { travou = true; break }
}
checar(travou, 'login trava por conta mesmo trocando de IP')

console.log('# teto de escritas por conta')
let freou = false
for (let i = 0; i < 130 && !freou; i++) {
  const r = await req('PUT', '/amigos/cartao', { cartao: { nome: 'n' + i } }, C.cookie)
  if (r.s === 429) freou = true
}
checar(freou, 'conta logada nao consegue escrever sem parar (429)')
checar((await req('GET', '/equipe', undefined, C.cookie)).s === 200, 'leitura continua liberada com o teto de escrita')

console.log('# exclusao de conta')
const exclErr = await req('DELETE', '/conta', { senha: 'errada' }, Bc.cookie)
checar(exclErr.s === 401, 'excluir exige a senha certa')
const excl = await req('DELETE', '/conta', { senha: 'Senha-forte-b' }, Bc.cookie)
checar(excl.s === 200, 'B exclui a conta')
checar((await req('GET', '/eu', undefined, Bc.cookie)).s === 204, 'sessao de B morreu junto')
checar((await req('GET', '/amigos', undefined, A.cookie)).j.amigos.length === 0, 'amizade com B sumiu (cascade)')

console.log(`\n${ok} ok, ${falhas} falha(s)`)
process.exit(falhas ? 1 : 0)
