import { db, getPerfil, salvarPerfil } from './index'
import { EXERCICIOS_SEED } from './seedExercicios'
import { ALIMENTOS_SEED } from './seedAlimentos'
import { getPrograma } from './programas'
import { aplicarPrograma } from '../lib/acoes'
import { sugerirMetas } from '../lib/nutricao'
import { gerarPlano, paraPlanoRefeicao } from '../lib/gerarPlano'
import { migrarDeForja } from './migrar'

const VERSAO_SEED = 2

let emExecucao: Promise<void> | null = null

/**
 * Chamadas simultaneas compartilham a MESMA execucao. Sem isso o StrictMode
 * do React monta o app duas vezes, as duas passam pela checagem de banco
 * vazio ao mesmo tempo e o setup inicial e aplicado em dobro.
 */
export function rodarSeed(): Promise<void> {
  emExecucao ??= executarSeed()
  return emExecucao
}

/**
 * Solta o cache acima. Precisa ser chamado depois de apagar tudo, senao o
 * seed seguinte devolve a promessa velha (ja resolvida) e o banco fica vazio.
 */
export function resetarCacheSeed() {
  emExecucao = null
}

/**
 * Popula o catalogo na primeira execucao e atualiza os itens de catalogo
 * em versoes futuras SEM apagar o que o usuario personalizou
 * (video, imagem, favorito) nem tocar nos itens criados por ele.
 */
async function executarSeed() {
  await migrarDeForja()
  await tirarCoresNeon()

  const marca = localStorage.getItem('onemore:seed')
  const jaRodou = marca === String(VERSAO_SEED)

  const exAtuais = await db.exercicios.toArray()
  const mapaEx = new Map(exAtuais.map(e => [e.id, e]))
  await db.exercicios.bulkPut(EXERCICIOS_SEED.map(s => {
    const atual = mapaEx.get(s.id)
    if (!atual) return s
    // preserva o que e do usuario
    return { ...s, videoUrl: atual.videoUrl, imagemUrl: atual.imagemUrl, favorito: atual.favorito }
  }))

  const alAtuais = await db.alimentos.toArray()
  const mapaAl = new Map(alAtuais.map(a => [a.id, a]))
  await db.alimentos.bulkPut(ALIMENTOS_SEED.map(s => {
    const atual = mapaAl.get(s.id)
    if (!atual) return s
    return { ...s, favorito: atual.favorito }
  }))

  if (jaRodou) return

  await getPerfil()
  // so monta o setup inicial num app realmente vazio - nunca por cima do que
  // ja existe, senao uma atualizacao de catalogo apagaria o plano do usuario
  const virgem = (await db.rotinas.count()) === 0
    && (await db.planos.count()) === 0
    && (await db.sessoes.count()) === 0

  if (virgem) await montarSetupInicial()
  localStorage.setItem('onemore:seed', String(VERSAO_SEED))
}

/** Paleta neon antiga -> equivalente solida. So o que era neon esta aqui. */
const CORES_ANTIGAS: Record<string, string> = {
  '#a855f7': '#8b6dd6', '#c084fc': '#9b7fc7', '#c026d3': '#a86eaf', '#7c3aed': '#6d51b8',
  '#22d3ee': '#4f9aad', '#34d399': '#4caf87', '#3ddc97': '#4fa385', '#a3e635': '#8ba055',
  '#fbbf24': '#c9a049', '#ffc857': '#c9a049', '#fcd34d': '#d9b654', '#fb923c': '#c2854e',
  '#fb7185': '#c25f70', '#ff5470': '#c25f70', '#f87171': '#c06a6a', '#ff6b35': '#c96a4a',
  '#f472b6': '#bd7095', '#e879f9': '#a86eaf', '#818cf8': '#7b81be', '#4dabf7': '#5a8cbf',
}

/**
 * As rotinas guardam a cor escolhida no banco, entao trocar a paleta no codigo
 * nao muda quem ja existe. Isso reescreve uma vez so as cores neon antigas pelas
 * novas - se o usuario tinha escolhido outra cor qualquer, nao mexe.
 */
async function tirarCoresNeon() {
  if (localStorage.getItem('onemore:cores-solidas') === '1') return
  const rotinas = await db.rotinas.toArray()
  for (const r of rotinas) {
    const nova = CORES_ANTIGAS[r.cor?.toLowerCase()]
    if (nova) await db.rotinas.update(r.id, { cor: nova })
  }
  localStorage.setItem('onemore:cores-solidas', '1')
}

/**
 * Setup pronto pro Pedro: perfil, metas calculadas, programa de treino
 * da semana e plano alimentar gerado em cima das metas.
 */
async function montarSetupInicial() {
  const base = {
    nome: 'Jogador',
    sexo: 'M' as const,
    idade: 20,
    alturaCm: 183,
    pesoKg: 70,
    // 5 dias de academia + 2 dias leves em casa. 1.55 e um ponto de partida
    // conservador de proposito: e melhor subir kcal olhando a balanca do que
    // comecar alto e ganhar gordura a toa.
    atividade: 1.55 as const,
    objetivo: 'bulking' as const,
    metaTreinosSemana: 5,
    metaAgua: 3500,
    // desligado de proposito: glicemia so aparece depois que a pessoa marca
    // diabetes tipo 1 em Perfil > Saude
    diabetesTipo1: false,
  }

  const metas = sugerirMetas(base)
  await salvarPerfil({
    ...base,
    metaKcal: metas.kcal,
    metaProt: metas.prot,
    metaCarb: metas.carb,
    metaGord: metas.gord,
  })

  // treino: 5 dias na academia + 2 dias de cardio e core em casa
  const academia = getPrograma('ppl-ul-5')
  const casa = getPrograma('casa-cardio-core')
  if (academia) await aplicarPrograma(academia)
  if (casa) await aplicarPrograma(casa)

  // dieta: plano gerado em cima das metas que acabaram de ser calculadas
  const alimentos = new Map((await db.alimentos.toArray()).map(a => [a.id, a]))
  const plano = gerarPlano(
    { metaKcal: metas.kcal, metaProt: metas.prot, metaCarb: metas.carb, metaGord: metas.gord },
    alimentos,
  )
  await db.planos.bulkPut(paraPlanoRefeicao(plano))
}
