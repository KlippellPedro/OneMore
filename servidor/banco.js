/**
 * Conexao com o Postgres da Discloud e criacao das tabelas.
 *
 * As tabelas sao criadas na subida do servidor (create if not exists), entao
 * nao existe passo manual de instalacao: provisionou o banco, colocou a
 * DATABASE_URL no .env e subiu - na primeira execucao o esquema ja nasce.
 */
import pg from 'pg'
import { emailCanonico } from './email.js'

const { Pool } = pg

/**
 * O Postgres da Discloud fica na rede interna e nao fala TLS. Um banco externo
 * (Neon, Supabase, Railway) exige. Por isso e uma chave: PGSSL=1 liga.
 * rejectUnauthorized:false porque esses provedores usam certificado proprio -
 * so entra aqui quem ja escolheu ligar.
 */
const ssl = process.env.PGSSL === '1' ? { rejectUnauthorized: false } : undefined

/**
 * Sem DATABASE_URL o app NAO morre: o site e estatico e funciona sozinho, so a
 * API fica fora do ar (503). Isso importa no primeiro deploy da Discloud, onde
 * o app sobe antes de as variaveis de ambiente existirem - com AUTORESTART=true
 * um process.exit(1) aqui viraria loop de reinicio e levaria o site junto.
 */
export const configurado = !!process.env.DATABASE_URL

if (!configurado) {
  console.error(
    '[banco] DATABASE_URL nao definida - a API vai responder 503.\n'
    + '        Discloud: painel do app > Variaveis. Local: .env (veja .env.example).',
  )
}

export const pool = configurado
  ? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl,
    // o app e pequeno e a Discloud da pouca RAM: poucas conexoes abertas bastam
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
  : null

pool?.on('error', e => console.error('[banco] conexao ociosa caiu:', e.message))

export const consultar = (texto, valores) => pool.query(texto, valores)

/**
 * `id` e gerado no Node com crypto.randomUUID() em vez de gen_random_uuid():
 * a funcao do Postgres depende da extensao pgcrypto em versoes mais antigas, e
 * criar extensao exige superusuario - coisa que um banco gerenciado nem sempre
 * da. Gerando aqui, funciona em qualquer Postgres.
 */
const ESQUEMA = `
create table if not exists usuarios (
  id          uuid primary key,
  email       text not null unique,
  senha_hash  text not null,
  criado_em   timestamptz not null default now()
);

-- codigo de recuperacao: e o que permite trocar a senha sem servidor de e-mail.
-- Guardado com o mesmo scrypt da senha, nunca em texto puro. E "add column if
-- not exists" porque contas criadas antes desta versao existem e ficam com NULL
-- ate gerarem um codigo pelo Perfil.
-- (sem crase neste arquivo: isto esta dentro de um template literal)
alter table usuarios add column if not exists codigo_hash text;

create table if not exists sessoes (
  token_hash  text primary key,
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  criado_em   timestamptz not null default now(),
  visto_em    timestamptz not null default now(),
  expira_em   timestamptz not null
);
create index if not exists sessoes_usuario on sessoes (usuario_id);
create index if not exists sessoes_expira on sessoes (expira_em);

create table if not exists dados (
  usuario_id    uuid primary key references usuarios(id) on delete cascade,
  payload       jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- chave/valor do proprio servidor. Hoje: as chaves VAPID do push, geradas na
-- primeira subida (ver servidor/push.js)
create table if not exists config (
  chave text primary key,
  valor text not null
);

-- um aparelho que aceitou receber push. O endpoint e a URL do servico de push
-- do navegador - unica por aparelho, por isso e a chave
create table if not exists push_inscricoes (
  endpoint    text primary key,
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  criado_em   timestamptz not null default now()
);
create index if not exists push_inscricoes_usuario on push_inscricoes (usuario_id);

-- a agenda de lembretes que o aparelho mandou; o servidor so entrega na hora
create table if not exists push_avisos (
  endpoint    text not null references push_inscricoes(endpoint) on delete cascade,
  id          text not null,
  ts          timestamptz not null,
  payload     jsonb not null,
  enviado_em  timestamptz,
  primary key (endpoint, id)
);
create index if not exists push_avisos_pendentes on push_avisos (ts) where enviado_em is null;

-- AMIGOS (ver servidor/amigos.js). Um codigo de convite por conta: gerar outro
-- troca o antigo, que e como se fecha a porta de um codigo que vazou
create table if not exists convites (
  usuario_id  uuid primary key references usuarios(id) on delete cascade,
  codigo      text not null unique,
  criado_em   timestamptz not null default now()
);

-- uma linha por par, com o menor id sempre em "a": assim (x, y) e (y, x) nao
-- viram duas amizades, e a chave primaria segura dois aceites ao mesmo tempo
create table if not exists amizades (
  a          uuid not null references usuarios(id) on delete cascade,
  b          uuid not null references usuarios(id) on delete cascade,
  criado_em  timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
create index if not exists amizades_b on amizades (b);

-- o resumo que os amigos veem - nunca o backup. So existe pra quem usa amigos
create table if not exists cartoes (
  usuario_id     uuid primary key references usuarios(id) on delete cascade,
  cartao         jsonb not null,
  atualizado_em  timestamptz not null default now()
);

-- EQUIPE (ver servidor/equipe.js): um treinador, uma equipe, um codigo
create table if not exists equipes (
  id          uuid primary key,
  dono        uuid not null unique references usuarios(id) on delete cascade,
  nome        text not null,
  treinador   text not null,
  codigo      text not null unique,
  criado_em   timestamptz not null default now()
);

-- o aluno esta em no maximo UMA equipe (usuario_id e a chave). permissoes diz
-- o que ele liberou; programa e dieta sao o que o treinador montou pra ele
create table if not exists equipe_membros (
  usuario_id   uuid primary key references usuarios(id) on delete cascade,
  equipe_id    uuid not null references equipes(id) on delete cascade,
  permissoes   jsonb not null,
  programa     jsonb,
  programa_em  timestamptz,
  dieta        jsonb,
  dieta_em     timestamptz,
  entrou_em    timestamptz not null default now()
);
create index if not exists equipe_membros_equipe on equipe_membros (equipe_id);

-- treino ou dieta mandado de uma conta pra outra (amigo, ou treinador pro
-- aluno), pendente ate quem recebeu usar ou recusar
create table if not exists envios (
  id         uuid primary key,
  de         uuid not null references usuarios(id) on delete cascade,
  para       uuid not null references usuarios(id) on delete cascade,
  origem     text not null,
  tipo       text not null,
  nome       text not null,
  conteudo   jsonb not null,
  criado_em  timestamptz not null default now()
);
create index if not exists envios_para on envios (para);
`

/**
 * Vira true quando o esquema existe. A API so atende depois disso - antes,
 * responde 503 em vez de estourar erro de tabela inexistente.
 */
export let pronto = false

/**
 * Uma conta por e-mail DE VERDADE: `email` e unico, mas "a@gmail.com" e
 * "a+x@gmail.com" sao textos diferentes na mesma caixa. `email_canonico` guarda
 * a forma normalizada (ver email.js) e leva o indice unico.
 *
 * Contas antigas nao tem a coluna preenchida: o preenchimento roda aqui, em JS,
 * porque a regra mora no Node. E se duas contas JA existentes colidem na forma
 * canonica, o indice unico nao pode ser criado - e isso NAO pode derrubar a
 * subida (conectarComRetentativa tentaria pra sempre e a API ficaria em 503).
 * Nesse caso so avisa no log; a checagem do cadastro continua valendo pra
 * contas novas, e quem resolver as duplicadas na mao ganha o indice no
 * proximo restart.
 */
async function garantirEmailUnico() {
  await pool.query('alter table usuarios add column if not exists email_canonico text')
  const { rows } = await pool.query('select id, email from usuarios where email_canonico is null')
  for (const r of rows) {
    await pool.query('update usuarios set email_canonico = $2 where id = $1', [r.id, emailCanonico(r.email)])
  }
  if (rows.length) console.log(`[banco] ${rows.length} conta(s) com e-mail canonico preenchido`)
  // olha ANTES de criar: assim o caso comum (conta duplicada antiga) e um aviso
  // normal e nao depende de o banco se recuperar de um erro de indice
  const { rows: dup } = await pool.query(
    `select email_canonico, count(*)::int as contas from usuarios
      group by email_canonico having count(*) > 1`,
  )
  if (dup.length) {
    console.error(
      `[banco] ${dup.length} e-mail(s) com mais de uma conta (mesma caixa, grafia diferente) - `
      + 'indice unico NAO criado. Junte ou apague as duplicadas: '
      + dup.map(d => `${d.email_canonico} x${d.contas}`).join(', '),
    )
    return
  }
  try {
    await pool.query(
      'create unique index if not exists usuarios_email_canonico on usuarios (email_canonico)',
    )
  } catch (e) {
    // corrida: alguem criou uma duplicada entre a checagem e o indice. Tentara no proximo restart
    if (e.code !== '23505') throw e
    console.error('[banco] duplicata apareceu durante a criacao do indice unico de e-mail; tente reiniciar')
  }
}

async function migrar() {
  await pool.query(ESQUEMA)
  await garantirEmailUnico()
  // sessao vencida nao serve pra nada e a tabela so cresce
  const { rowCount } = await pool.query('delete from sessoes where expira_em < now()')
  if (rowCount) console.log(`[banco] ${rowCount} sessao(oes) vencida(s) removida(s)`)
  pronto = true
  console.log('[banco] conectado, tabelas prontas')
  // so limpava na subida: um servidor que fica semanas no ar acumulava sessao vencida
  if (!limpeza) {
    limpeza = setInterval(() => {
      pool.query('delete from sessoes where expira_em < now()').catch(() => {})
    }, 6 * 60 * 60 * 1000)
    limpeza.unref()
  }
}
let limpeza = null

/**
 * Tenta migrar sem nunca derrubar o processo. O banco da Discloud fica numa
 * rede privada e pode nao estar alcancavel no instante em que o app sobe -
 * se isso jogasse uma excecao no topo do modulo, o AUTORESTART transformaria
 * uma indisponibilidade de dez segundos num loop de reinicio sem fim.
 * Enquanto nao conecta, o site continua servindo e a API responde 503.
 */
export async function conectarComRetentativa() {
  if (!configurado) return
  const ESPERAS = [1, 2, 5, 10, 20, 30, 60]
  for (let i = 0; ; i++) {
    try {
      await migrar()
      return
    } catch (e) {
      const espera = ESPERAS[Math.min(i, ESPERAS.length - 1)]
      console.error(`[banco] falhou (${e.code ?? e.message}); tentando de novo em ${espera}s`)
      await new Promise(r => setTimeout(r, espera * 1000))
    }
  }
}
