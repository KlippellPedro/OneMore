/**
 * Amigos. Duas contas que se ligaram por um codigo de convite passam a ver o
 * CARTAO uma da outra: um resumo pequeno (nome, XP, sequencia, dias em que
 * treinou, ultimos treinos, maiores cargas) que o proprio aparelho monta e
 * manda - ver src/lib/cartao.ts.
 *
 * O backup (tabela `dados`) nunca sai daqui pra outra conta. E nele que moram
 * dieta, peso, medidas e glicemia, e e por isso que o cartao e uma tabela a
 * parte, com campo por campo validado aqui: o que nao estiver na lista abaixo
 * e descartado, mesmo que um aparelho com bug (ou mal-intencionado) mande.
 *
 * O e-mail tambem nunca vai pro amigo. Quem aparece na lista e o `nome` do
 * cartao, que a pessoa escolhe no app.
 */
import { randomInt } from 'node:crypto'
import { consultar } from './banco.js'

/* ------------------------------------------------------------------ */
/* CODIGO DE CONVITE                                                   */
/* ------------------------------------------------------------------ */

/** O mesmo alfabeto do codigo de recuperacao: sem 0/O/1/I/L, que se confundem ditados. */
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
/**
 * 8 caracteres de 31 = ~40 bits. Quem tenta adivinhar esbarra no freio da rota
 * (10 erros a cada 15 min por conta e por IP, ver api.js) - a esse ritmo, achar
 * UM codigo qualquer entre mil contas levaria milhares de anos. E o pior que um
 * codigo achado entrega e o cartao, nao a conta.
 */
export const TAMANHO_CONVITE = 8
/** Teto por conta: a lista de amigos vem inteira numa resposta so. */
export const MAX_AMIGOS = 100

export function gerarConvite() {
  let c = ''
  for (let i = 0; i < TAMANHO_CONVITE; i++) c += ALFABETO[randomInt(ALFABETO.length)]
  return c
}

/** "k7q2-xp9m", "K7Q2 XP9M" e "K7Q2XP9M" sao o mesmo codigo. null = nao e um codigo. */
export function normalizarConvite(bruto) {
  const c = String(bruto ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (c.length !== TAMANHO_CONVITE) return null
  for (const ch of c) if (!ALFABETO.includes(ch)) return null
  return c
}

/** Como o codigo aparece na tela: K7Q2-XP9M. */
export const formatarConvite = c => (c ? `${c.slice(0, 4)}-${c.slice(4)}` : null)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Confere antes de mandar pro banco: um texto qualquer num `uuid` vira erro 500 la dentro. */
export const uuidValido = v => typeof v === 'string' && UUID.test(v)

/* ------------------------------------------------------------------ */
/* CARTAO (validacao pura - testada em amigos.test.mjs)                */
/* ------------------------------------------------------------------ */

export const VERSAO_CARTAO = 1
export const MAX_DIAS = 40
export const MAX_ULTIMOS = 5
export const MAX_RECORDES = 3

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const inteiro = (v, max) => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0
}
const decimal = (v, max) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n * 10) / 10, 0), max) : 0
}
const DIA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/
const dia = v => (typeof v === 'string' && DIA.test(v) ? v : null)

/**
 * O cartao limpo, ou null se nem objeto for. Campo estranho some; numero fora
 * da faixa e cortado; lista comprida e aparada. Nao recusa o cartao inteiro por
 * um campo ruim: um app desatualizado mandando um campo velho nao pode deixar a
 * pessoa sem aparecer pros amigos.
 */
export function validarCartao(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null

  const dias = Array.isArray(c.dias)
    ? [...new Set(c.dias.map(dia).filter(Boolean))].sort().reverse().slice(0, MAX_DIAS)
    : []

  const ultimos = (Array.isArray(c.ultimos) ? c.ultimos : [])
    .filter(u => u && typeof u === 'object' && dia(u.dia))
    .slice(0, MAX_ULTIMOS)
    .map(u => ({
      nome: texto(u.nome, 60) || 'Treino',
      dia: u.dia,
      series: inteiro(u.series, 500),
      volume: decimal(u.volume, 10_000_000),
      minutos: inteiro(u.minutos, 1440),
    }))

  const recordes = (Array.isArray(c.recordes) ? c.recordes : [])
    .filter(r => r && typeof r === 'object' && texto(r.nome, 60))
    .slice(0, MAX_RECORDES)
    .map(r => ({ nome: texto(r.nome, 60), carga: decimal(r.carga, 2000), reps: inteiro(r.reps, 1000) }))

  return {
    v: VERSAO_CARTAO,
    nome: texto(c.nome, 40) || 'Jogador',
    xp: inteiro(c.xp, 1_000_000_000),
    streak: inteiro(c.streak, 100_000),
    melhorStreak: inteiro(c.melhorStreak, 100_000),
    ultimoDiaAtivo: dia(c.ultimoDiaAtivo),
    metaSemana: inteiro(c.metaSemana, 14),
    treinos: inteiro(c.treinos, 100_000),
    prs: inteiro(c.prs, 1_000_000),
    dias,
    ultimos,
    recordes,
  }
}

/* ------------------------------------------------------------------ */
/* BANCO                                                               */
/* ------------------------------------------------------------------ */

export async function meuConvite(usuarioId) {
  const { rows } = await consultar('select codigo from convites where usuario_id = $1', [usuarioId])
  return rows[0]?.codigo ?? null
}

/**
 * Gera (ou TROCA) o codigo da conta. Trocar e o jeito de fechar a porta de um
 * codigo que vazou: o antigo para de valer na hora, e quem ja e amigo continua.
 */
export async function novoConvite(usuarioId) {
  for (let i = 0; i < 5; i++) {
    const codigo = gerarConvite()
    try {
      await consultar(
        `insert into convites (usuario_id, codigo) values ($1, $2)
         on conflict (usuario_id) do update set codigo = excluded.codigo, criado_em = now()`,
        [usuarioId, codigo],
      )
      return codigo
    } catch (e) {
      // o codigo sorteado ja e de outra conta (raro): sorteia de novo
      if (e.code !== '23505') throw e
    }
  }
  throw new Error('Nao consegui gerar um codigo de convite unico.')
}

export async function apagarConvite(usuarioId) {
  await consultar('delete from convites where usuario_id = $1', [usuarioId])
  await limparCartaoSeSozinho(usuarioId)
}

const contarAmigos = async id => (await consultar(
  'select count(*)::int as n from amizades where a = $1 or b = $1', [id],
)).rows[0].n

/**
 * Liga quem usou o codigo ao dono dele. Devolve o motivo quando nao liga, pra
 * rota escolher a mensagem: 'nao-existe', 'proprio', 'ja-amigos', 'limite'.
 */
export async function adicionarAmigo(usuarioId, codigo) {
  const { rows } = await consultar('select usuario_id from convites where codigo = $1', [codigo])
  const dono = rows[0]?.usuario_id
  if (!dono) return { motivo: 'nao-existe' }
  if (dono === usuarioId) return { motivo: 'proprio' }
  if ((await contarAmigos(usuarioId)) >= MAX_AMIGOS || (await contarAmigos(dono)) >= MAX_AMIGOS) {
    return { motivo: 'limite' }
  }
  // least/greatest no proprio banco: a ordem de uuid e a do Postgres, e o check (a < b) e dele
  const { rowCount } = await consultar(
    `insert into amizades (a, b) values (least($1::uuid, $2::uuid), greatest($1::uuid, $2::uuid))
     on conflict do nothing`,
    [usuarioId, dono],
  )
  if (!rowCount) return { motivo: 'ja-amigos', amigoId: dono }
  return { amigoId: dono }
}

/** Desfaz dos DOIS lados: amizade aqui e de mao dupla. */
export async function removerAmigo(usuarioId, outroId) {
  await consultar(
    'delete from amizades where a = least($1::uuid, $2::uuid) and b = greatest($1::uuid, $2::uuid)',
    [usuarioId, outroId],
  )
  await limparCartaoSeSozinho(usuarioId)
  await limparCartaoSeSozinho(outroId)
}

/**
 * Sem codigo, sem amigo e sem equipe, ninguem mais pode ver o cartao - entao nao tem
 * por que continuar guardado. Desligar tudo apaga o que foi compartilhado.
 */
async function limparCartaoSeSozinho(usuarioId) {
  await consultar(
    `delete from cartoes where usuario_id = $1
       and not exists (select 1 from convites where usuario_id = $1)
       and not exists (select 1 from amizades where a = $1 or b = $1)
       and not exists (select 1 from equipe_membros where usuario_id = $1)`,
    [usuarioId],
  )
}

/** Os amigos da conta, cada um com o cartao (null se ainda nao mandou nenhum). */
export async function listarAmigos(usuarioId) {
  const { rows } = await consultar(
    `select z.amigo as id, z.criado_em as desde, c.cartao, c.atualizado_em
       from (
         select b as amigo, criado_em from amizades where a = $1
         union all
         select a as amigo, criado_em from amizades where b = $1
       ) z
       left join cartoes c on c.usuario_id = z.amigo
      order by c.atualizado_em desc nulls last, z.criado_em desc`,
    [usuarioId],
  )
  return rows.map(r => ({
    id: r.id, desde: r.desde, cartao: r.cartao ?? null, atualizadoEm: r.atualizado_em ?? null,
  }))
}

/**
 * Guarda o cartao SO de quem usa amigos ou equipe (codigo, amigo ou treinador). Quem nunca
 * entrou nessa tela nao deixa resumo nenhum aqui, mesmo que o app mande.
 * Devolve se guardou: o aparelho usa isso pra nao ficar reenviando a toa.
 */
export async function salvarCartao(usuarioId, cartao) {
  // casts explicitos: num insert ... select, parametro sem tipo vira text, e
  // text nao entra numa coluna jsonb sem cast
  const { rowCount } = await consultar(
    `insert into cartoes (usuario_id, cartao, atualizado_em)
     select $1::uuid, $2::jsonb, now()
      where exists (select 1 from convites where usuario_id = $1)
         or exists (select 1 from amizades where a = $1 or b = $1)
         or exists (select 1 from equipe_membros where usuario_id = $1)
     on conflict (usuario_id) do update set cartao = excluded.cartao, atualizado_em = now()`,
    [usuarioId, cartao],
  )
  return rowCount > 0
}
