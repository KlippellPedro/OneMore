/**
 * Equipe (treinador e alunos) e envios (treino ou dieta mandados de uma conta
 * pra outra).
 *
 * EQUIPE. Um treinador cria UMA equipe e ganha um codigo. O aluno entra com o
 * codigo e escolhe o que libera: treinos (sempre - e o motivo de entrar),
 * medidas do corpo e dieta (cada um opcional e desligado ate o aluno ligar,
 * porque e dado de saude e consentimento nao vem pre-marcado). Glicemia nunca
 * sai: nem e lida do banco (ver CONSULTA_ALUNO).
 *
 * O treinador LE o que foi liberado direto do backup do aluno (tabela `dados`)
 * - campo a campo, aqui no servidor, sem nunca escrever nele. O treino e a
 * dieta que ele monta ficam no vinculo (equipe_membros) e chegam ao aluno como
 * um ENVIO: o aluno decide quando usar, e o app guarda a semana/dieta de antes
 * como copia automatica. Ninguem mexe no backup de ninguem pelo servidor.
 *
 * ENVIOS. Entre amigos, ou do treinador pro aluno. Ficam pendentes ate quem
 * recebeu usar ou recusar. O conteudo e o mesmo formato do arquivo de semana
 * (src/lib/semana.ts) ou de dieta (src/lib/pacotes.ts) e e revalidado campo a
 * campo no aparelho de quem recebe; aqui so se confere forma e tamanho.
 */
import { randomUUID } from 'node:crypto'
import { consultar } from './banco.js'
import { gerarConvite, uuidValido } from './amigos.js'

/* ------------------------------------------------------------------ */
/* VALIDACAO (pura - testada em equipe.test.mjs)                       */
/* ------------------------------------------------------------------ */

export const MAX_ALUNOS = 200
export const MAX_PENDENTES = 30
/** Uma semana de treino cheia (40 rotinas x 60 exercicios) fica bem abaixo disto. */
export const LIMITE_PACOTE = 256 * 1024

const obj = v => !!v && typeof v === 'object' && !Array.isArray(v)
const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** O que o aluno libera. Treinos sempre; o resto so se vier true de verdade. */
export function validarPermissoes(p) {
  return { treinos: true, corpo: p?.corpo === true, dieta: p?.dieta === true }
}

/**
 * Forma do conteudo de um envio, sem olhar campo por campo (isso o app de
 * quem recebe faz). Devolve o motivo da recusa, ou null se passa.
 */
export function problemaNoPacote(tipo, conteudo) {
  if (tipo !== 'treino' && tipo !== 'dieta') return 'Tipo de envio inválido.'
  if (!obj(conteudo) || conteudo.app !== 'onemore') return 'Conteúdo inválido.'
  if (JSON.stringify(conteudo).length > LIMITE_PACOTE) return 'Conteúdo grande demais.'
  if (tipo === 'treino') {
    if (conteudo.tipo !== 'semana') return 'Conteúdo inválido.'
    const r = conteudo.rotinas
    if (!Array.isArray(r) || !r.length || r.length > 40) return 'O treino precisa ter de 1 a 40 rotinas.'
    if (r.some(x => !obj(x) || !Array.isArray(x.itens) || x.itens.length > 60)) return 'Rotina inválida.'
    if (conteudo.exercicios != null && (!Array.isArray(conteudo.exercicios) || conteudo.exercicios.length > 300)) {
      return 'Lista de exercícios inválida.'
    }
  } else {
    if (conteudo.tipo !== 'dieta') return 'Conteúdo inválido.'
    const r = conteudo.refeicoes
    if (!Array.isArray(r) || !r.length || r.length > 12) return 'A dieta precisa ter de 1 a 12 refeições.'
    if (r.some(x => !obj(x) || !Array.isArray(x.itens) || x.itens.length > 40)) return 'Refeição inválida.'
    if (conteudo.alimentos != null && (!Array.isArray(conteudo.alimentos) || conteudo.alimentos.length > 300)) {
      return 'Lista de alimentos inválida.'
    }
  }
  return null
}

const DIA_MS = 24 * 60 * 60 * 1000
const lista = v => (Array.isArray(v) ? v.filter(obj) : [])
const diaIso = ts => new Date(ts).toISOString().slice(0, 10)

/** Campos do perfil por permissao. Nome, objetivo e gamificacao vao sempre (sao do treino). */
const PERFIL_TREINO = ['nome', 'objetivo', 'metaTreinosSemana', 'xp', 'streak', 'melhorStreak', 'ultimoDiaAtivo']
const PERFIL_CORPO = ['sexo', 'nascimento', 'idade', 'alturaCm', 'pesoKg']
const PERFIL_DIETA = ['metaKcal', 'metaProt', 'metaCarb', 'metaGord', 'metaAgua']

function escolher(o, campos) {
  const saida = {}
  for (const c of campos) if (o[c] !== undefined) saida[c] = o[c]
  return saida
}

/**
 * O que o treinador ve do backup do aluno, conforme o que foi liberado. Recebe
 * so as tabelas que CONSULTA_ALUNO tirou do banco (glicemia, semanas, dietas
 * salvas, XP e lapides nem chegam aqui) e ainda filtra por permissao e por
 * tempo: um ano de treino, dois meses de dieta.
 */
export function dadosDoAluno(dados, permissoes, agora = Date.now()) {
  const p = validarPermissoes(permissoes)
  const d = obj(dados) ? dados : {}
  const perfil = lista(d.perfil)[0] ?? {}

  const desdeTreino = agora - 365 * DIA_MS
  const sessoes = lista(d.sessoes).filter(s => s.concluida && Number(s.inicio) >= desdeTreino)
  const rotinas = lista(d.rotinas).filter(r => !r.arquivada)
  const usados = new Set([...sessoes, ...rotinas].flatMap(x => lista(x.series ?? x.itens).map(i => i.exercicioId)))
  const exercicios = lista(d.exercicios).filter(e => e.custom && usados.has(e.id))
    // foto tirada no celular vira data URL enorme: o nome e o musculo bastam aqui
    .map(e => (typeof e.imagemUrl === 'string' && e.imagemUrl.startsWith('data:') ? { ...e, imagemUrl: undefined } : e))

  const saida = {
    perfil: {
      ...escolher(perfil, PERFIL_TREINO),
      ...(p.corpo ? escolher(perfil, PERFIL_CORPO) : {}),
      ...(p.dieta ? escolher(perfil, PERFIL_DIETA) : {}),
    },
    sessoes, rotinas, exercicios,
  }

  if (p.corpo) saida.corpo = lista(d.corpo)

  if (p.dieta) {
    const desdeDieta = diaIso(agora - 60 * DIA_MS)
    const registros = lista(d.dieta).filter(r => typeof r.data === 'string' && r.data >= desdeDieta)
    const planos = lista(d.planos)
    const alimentosUsados = new Set([...registros, ...planos.flatMap(x => lista(x.itens))].map(i => i.alimentoId))
    saida.dieta = registros
    saida.planos = planos
    saida.agua = lista(d.agua).filter(a => typeof a.data === 'string' && a.data >= desdeDieta)
    saida.alimentos = lista(d.alimentos).filter(a => a.custom && alimentosUsados.has(a.id))
  }
  return saida
}

/* ------------------------------------------------------------------ */
/* EQUIPE - BANCO                                                      */
/* ------------------------------------------------------------------ */

const formatar = c => (c ? `${c.slice(0, 4)}-${c.slice(4)}` : null)

/** A equipe de quem e treinador, com os alunos e o cartao de cada um. */
export async function minhaEquipe(usuarioId) {
  const { rows } = await consultar(
    'select id, nome, treinador, codigo, criado_em from equipes where dono = $1', [usuarioId],
  )
  const e = rows[0]
  if (!e) return null
  const { rows: alunos } = await consultar(
    `select m.usuario_id as id, m.entrou_em, m.permissoes, m.programa_em, m.dieta_em,
            c.cartao, c.atualizado_em
       from equipe_membros m
       left join cartoes c on c.usuario_id = m.usuario_id
      where m.equipe_id = $1
      order by m.entrou_em`,
    [e.id],
  )
  return {
    id: e.id, nome: e.nome, treinador: e.treinador, codigo: formatar(e.codigo), criadoEm: e.criado_em,
    alunos: alunos.map(a => ({
      id: a.id, entrouEm: a.entrou_em, permissoes: validarPermissoes(a.permissoes),
      programaEm: a.programa_em, dietaEm: a.dieta_em,
      cartao: a.cartao ?? null, atualizadoEm: a.atualizado_em ?? null,
    })),
  }
}

/** A equipe em que a conta e aluna, se for. */
export async function equipeQueParticipo(usuarioId) {
  const { rows } = await consultar(
    `select e.nome, e.treinador, m.entrou_em, m.permissoes, m.programa_em, m.dieta_em
       from equipe_membros m join equipes e on e.id = m.equipe_id
      where m.usuario_id = $1`,
    [usuarioId],
  )
  const r = rows[0]
  if (!r) return null
  return {
    nome: r.nome, treinador: r.treinador, entrouEm: r.entrou_em, permissoes: validarPermissoes(r.permissoes),
    programaEm: r.programa_em, dietaEm: r.dieta_em,
  }
}

/** Cria a equipe (uma por conta). false = ja tem. */
export async function criarEquipe(usuarioId, nome, treinador) {
  for (let i = 0; i < 5; i++) {
    try {
      const { rowCount } = await consultar(
        `insert into equipes (id, dono, nome, treinador, codigo) values ($1, $2, $3, $4, $5)
         on conflict (dono) do nothing`,
        [randomUUID(), usuarioId, nome, treinador, gerarConvite()],
      )
      return rowCount > 0
    } catch (e) {
      // codigo sorteado ja existe em outra equipe: sorteia de novo
      if (e.code !== '23505') throw e
    }
  }
  throw new Error('Nao consegui gerar um codigo de equipe unico.')
}

export async function editarEquipe(usuarioId, { nome, treinador, novoCodigo }) {
  if (nome) await consultar('update equipes set nome = $2 where dono = $1', [usuarioId, nome])
  if (treinador) await consultar('update equipes set treinador = $2 where dono = $1', [usuarioId, treinador])
  if (novoCodigo) {
    for (let i = 0; i < 5; i++) {
      try {
        await consultar('update equipes set codigo = $2 where dono = $1', [usuarioId, gerarConvite()])
        return
      } catch (e) {
        if (e.code !== '23505') throw e
      }
    }
  }
}

/** Desfaz a equipe: os vinculos saem junto (cascade). O que o aluno ja usou fica com ele. */
export async function apagarEquipe(usuarioId) {
  await consultar(
    `delete from envios where origem = 'treinador' and de = $1`, [usuarioId],
  )
  await consultar('delete from equipes where dono = $1', [usuarioId])
}

/** 'nao-existe' | 'propria' | 'ja-tem' (ja e aluno de outra) | 'lotada' | null (entrou) */
export async function entrarNaEquipe(usuarioId, codigo, permissoes) {
  const { rows } = await consultar('select id, dono from equipes where codigo = $1', [codigo])
  const e = rows[0]
  if (!e) return 'nao-existe'
  if (e.dono === usuarioId) return 'propria'
  const { rows: atual } = await consultar('select equipe_id from equipe_membros where usuario_id = $1', [usuarioId])
  if (atual[0]) return atual[0].equipe_id === e.id ? null : 'ja-tem'
  const { rows: n } = await consultar('select count(*)::int as n from equipe_membros where equipe_id = $1', [e.id])
  if (n[0].n >= MAX_ALUNOS) return 'lotada'
  try {
    await consultar(
      'insert into equipe_membros (equipe_id, usuario_id, permissoes) values ($1, $2, $3::jsonb)',
      [e.id, usuarioId, JSON.stringify(validarPermissoes(permissoes))],
    )
  } catch (err) {
    // corrida: entrou em outra equipe entre a checagem e o insert (usuario_id e unico)
    if (err.code === '23505') return 'ja-tem'
    throw err
  }
  return null
}

export async function mudarPermissoes(usuarioId, permissoes) {
  const { rowCount } = await consultar(
    'update equipe_membros set permissoes = $2::jsonb where usuario_id = $1',
    [usuarioId, JSON.stringify(validarPermissoes(permissoes))],
  )
  return rowCount > 0
}

/** O aluno sai. O que o treinador mandou e ainda nao foi usado some junto. */
export async function sairDaEquipe(usuarioId) {
  const { rows } = await consultar(
    `delete from equipe_membros m using equipes e
      where m.usuario_id = $1 and e.id = m.equipe_id
      returning e.dono`,
    [usuarioId],
  )
  if (rows[0]) {
    await consultar(
      `delete from envios where origem = 'treinador' and de = $1 and para = $2`, [rows[0].dono, usuarioId],
    )
  }
  await limparCartaoSemUso(usuarioId)
  return rows.length > 0
}

/** O treinador tira um aluno. false = esse aluno nao e da equipe dele. */
export async function removerAluno(treinadorId, alunoId) {
  const { rowCount } = await consultar(
    `delete from equipe_membros m using equipes e
      where e.dono = $1 and m.equipe_id = e.id and m.usuario_id = $2`,
    [treinadorId, alunoId],
  )
  if (rowCount) {
    await consultar(
      `delete from envios where origem = 'treinador' and de = $1 and para = $2`, [treinadorId, alunoId],
    )
    await limparCartaoSemUso(alunoId)
  }
  return rowCount > 0
}

/** Mesma regra de amigos.js: sem amigo, sem codigo e sem equipe, o cartao nao tem quem veja. */
async function limparCartaoSemUso(usuarioId) {
  await consultar(
    `delete from cartoes where usuario_id = $1
       and not exists (select 1 from convites where usuario_id = $1)
       and not exists (select 1 from amizades where a = $1 or b = $1)
       and not exists (select 1 from equipe_membros where usuario_id = $1)`,
    [usuarioId],
  )
}

/** O vinculo treinador -> aluno, ou null se esse aluno nao e da equipe dele. */
async function vinculo(treinadorId, alunoId) {
  if (!uuidValido(alunoId)) return null
  const { rows } = await consultar(
    `select m.usuario_id, m.entrou_em, m.permissoes, m.programa, m.programa_em, m.dieta, m.dieta_em,
            e.treinador
       from equipe_membros m join equipes e on e.id = m.equipe_id
      where e.dono = $1 and m.usuario_id = $2`,
    [treinadorId, alunoId],
  )
  return rows[0] ?? null
}

/**
 * Le do backup SO as tabelas que podem interessar ao treinador. Glicemia,
 * semanas salvas, dietas salvas, XP e lapides nem saem do banco.
 */
const CONSULTA_ALUNO = `
  select jsonb_build_object(
    'perfil', payload->'dados'->'perfil',
    'sessoes', payload->'dados'->'sessoes',
    'rotinas', payload->'dados'->'rotinas',
    'exercicios', payload->'dados'->'exercicios',
    'corpo', payload->'dados'->'corpo',
    'planos', payload->'dados'->'planos',
    'dieta', payload->'dados'->'dieta',
    'agua', payload->'dados'->'agua',
    'alimentos', payload->'dados'->'alimentos'
  ) as dados, atualizado_em
  from dados where usuario_id = $1`

export async function lerAluno(treinadorId, alunoId) {
  const v = await vinculo(treinadorId, alunoId)
  if (!v) return null
  const permissoes = validarPermissoes(v.permissoes)
  const [{ rows }, { rows: cartao }] = await Promise.all([
    consultar(CONSULTA_ALUNO, [alunoId]),
    consultar('select cartao, atualizado_em from cartoes where usuario_id = $1', [alunoId]),
  ])
  return {
    aluno: {
      id: alunoId, entrouEm: v.entrou_em, permissoes,
      programaEm: v.programa_em, dietaEm: v.dieta_em,
    },
    cartao: cartao[0]?.cartao ?? null,
    dados: rows[0] ? dadosDoAluno(rows[0].dados, permissoes) : null,
    sincronizadoEm: rows[0]?.atualizado_em ?? null,
    programa: v.programa ?? null,
    dieta: v.dieta ?? null,
  }
}

/**
 * Guarda o treino (ou dieta) que o treinador montou e manda pro aluno. Um
 * envio pendente do treinador por tipo: mandar de novo troca o anterior que o
 * aluno ainda nao usou, em vez de empilhar versoes velhas na caixa dele.
 */
export async function prescrever(treinadorId, alunoId, tipo, nome, conteudo) {
  const v = await vinculo(treinadorId, alunoId)
  if (!v) return false
  const coluna = tipo === 'treino' ? 'programa' : 'dieta'
  await consultar(
    `update equipe_membros set ${coluna} = $2::jsonb, ${coluna}_em = now() where usuario_id = $1`,
    [alunoId, JSON.stringify(conteudo)],
  )
  await consultar(
    `delete from envios where origem = 'treinador' and de = $1 and para = $2 and tipo = $3`,
    [treinadorId, alunoId, tipo],
  )
  await consultar(
    `insert into envios (id, de, para, origem, tipo, nome, conteudo)
     values ($1, $2, $3, 'treinador', $4, $5, $6::jsonb)`,
    [randomUUID(), treinadorId, alunoId, tipo, nome, JSON.stringify(conteudo)],
  )
  return true
}

/* ------------------------------------------------------------------ */
/* ENVIOS - BANCO                                                      */
/* ------------------------------------------------------------------ */

/** Pendentes que chegaram pra conta, com o nome de quem mandou. */
export async function recebidos(usuarioId) {
  const { rows } = await consultar(
    `select v.id, v.de, v.origem, v.tipo, v.nome, v.conteudo, v.criado_em,
            case when v.origem = 'treinador'
                 then (select e.treinador from equipes e where e.dono = v.de)
                 else (select c.cartao->>'nome' from cartoes c where c.usuario_id = v.de) end as quem
       from envios v
      where v.para = $1
      order by v.criado_em desc`,
    [usuarioId],
  )
  return rows.map(r => ({
    id: r.id, de: { id: r.de, nome: r.quem || (r.origem === 'treinador' ? 'Seu treinador' : 'Um amigo') },
    origem: r.origem, tipo: r.tipo, nome: r.nome, conteudo: r.conteudo, criadoEm: r.criado_em,
  }))
}

/**
 * Manda um treino ou dieta pra amigos. So vai pra quem e amigo de verdade;
 * quem estiver com a caixa cheia fica de fora. Devolve quantos receberam.
 */
export async function enviarParaAmigos(usuarioId, para, tipo, nome, conteudo) {
  let enviados = 0
  for (const outro of [...new Set(para)].filter(uuidValido).slice(0, 50)) {
    const { rowCount } = await consultar(
      `insert into envios (id, de, para, origem, tipo, nome, conteudo)
       select $1, $2::uuid, $3::uuid, 'amigo', $4, $5, $6::jsonb
        where exists (select 1 from amizades
                       where a = least($2::uuid, $3::uuid) and b = greatest($2::uuid, $3::uuid))
          and (select count(*) from envios where para = $3::uuid) < $7`,
      [randomUUID(), usuarioId, outro, tipo, nome, JSON.stringify(conteudo), MAX_PENDENTES],
    )
    enviados += rowCount
  }
  return enviados
}

/** Quem recebeu usou ou recusou: o envio sai da caixa. */
export async function resolverEnvio(usuarioId, id) {
  if (!uuidValido(id)) return false
  const { rowCount } = await consultar('delete from envios where id = $1 and para = $2', [id, usuarioId])
  return rowCount > 0
}

export { texto as textoLimpo }
