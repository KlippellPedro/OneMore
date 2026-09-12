/**
 * Conexao com o Postgres da Discloud e criacao das tabelas.
 *
 * As tabelas sao criadas na subida do servidor (create if not exists), entao
 * nao existe passo manual de instalacao: provisionou o banco, colocou a
 * DATABASE_URL no .env e subiu - na primeira execucao o esquema ja nasce.
 */
import pg from 'pg'

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
`

/**
 * Vira true quando o esquema existe. A API so atende depois disso - antes,
 * responde 503 em vez de estourar erro de tabela inexistente.
 */
export let pronto = false

async function migrar() {
  await pool.query(ESQUEMA)
  // sessao vencida nao serve pra nada e a tabela so cresce
  const { rowCount } = await pool.query('delete from sessoes where expira_em < now()')
  if (rowCount) console.log(`[banco] ${rowCount} sessao(oes) vencida(s) removida(s)`)
  pronto = true
  console.log('[banco] conectado, tabelas prontas')
}

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
