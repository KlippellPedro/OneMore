import { db, uid, getPerfil } from './index'
import { EXERCICIOS_SEED } from './seedExercicios'
import { ALIMENTOS_SEED, REFEICOES_PADRAO } from './seedAlimentos'
import type { Rotina } from './types'

const VERSAO_SEED = 1

/**
 * Popula o catalogo na primeira execucao e atualiza os itens de catalogo
 * em versoes futuras SEM apagar o que o usuario personalizou
 * (video, imagem, favorito) nem tocar nos itens criados por ele.
 */
export async function rodarSeed() {
  const marca = localStorage.getItem('forja:seed')
  const jaRodou = marca === String(VERSAO_SEED)

  const exAtuais = await db.exercicios.toArray()
  const mapaEx = new Map(exAtuais.map(e => [e.id, e]))
  const novosEx = EXERCICIOS_SEED.map(s => {
    const atual = mapaEx.get(s.id)
    if (!atual) return s
    // preserva o que e do usuario
    return { ...s, videoUrl: atual.videoUrl, imagemUrl: atual.imagemUrl, favorito: atual.favorito }
  })
  await db.exercicios.bulkPut(novosEx)

  const alAtuais = await db.alimentos.toArray()
  const mapaAl = new Map(alAtuais.map(a => [a.id, a]))
  const novosAl = ALIMENTOS_SEED.map(s => {
    const atual = mapaAl.get(s.id)
    if (!atual) return s
    return { ...s, favorito: atual.favorito }
  })
  await db.alimentos.bulkPut(novosAl)

  if (!jaRodou) {
    if (await db.planos.count() === 0) {
      await db.planos.bulkPut(REFEICOES_PADRAO.map((r, i) => ({
        id: uid(), nome: r.nome, horario: r.horario, itens: [], ordem: i,
        atualizadoEm: Date.now(),
      })))
    }
    if (await db.rotinas.count() === 0) {
      await db.rotinas.bulkPut(rotinasExemplo())
    }
    await getPerfil()
    localStorage.setItem('forja:seed', String(VERSAO_SEED))
  }
}

/** Um ABC classico pra nao comecar com a tela vazia. */
function rotinasExemplo(): Rotina[] {
  const t = Date.now()
  const item = (exercicioId: string, series: number, repsAlvo: string, descansoSeg = 90) =>
    ({ exercicioId, series, repsAlvo, descansoSeg })

  return [
    {
      id: uid(), nome: 'Treino A - Peito, Ombro e Triceps', cor: '#ff6b35', ordem: 0,
      dias: [1, 4], atualizadoEm: t,
      descricao: 'Empurrar. Comece pesado no supino e va reduzindo a carga.',
      itens: [
        item('ex_supino-reto-com-barra', 4, '6-10', 120),
        item('ex_supino-inclinado-com-halteres', 3, '8-12'),
        item('ex_crucifixo-reto-com-halteres', 3, '10-15', 60),
        item('ex_desenvolvimento-com-halteres', 3, '8-12'),
        item('ex_elevacao-lateral-com-halteres', 4, '12-15', 45),
        item('ex_triceps-pulley-com-corda', 3, '10-15', 60),
        item('ex_triceps-testa-com-barra-w', 3, '8-12', 60),
      ],
    },
    {
      id: uid(), nome: 'Treino B - Costas e Biceps', cor: '#4dabf7', ordem: 1,
      dias: [2, 5], atualizadoEm: t,
      descricao: 'Puxar. Foque em iniciar cada repeticao pela escapula.',
      itens: [
        item('ex_barra-fixa-pronada', 4, 'ate a falha', 120),
        item('ex_remada-curvada-com-barra', 4, '6-10', 120),
        item('ex_puxada-frontal-na-polia', 3, '10-12'),
        item('ex_remada-baixa-no-cabo', 3, '10-12'),
        item('ex_crucifixo-inverso-com-halteres', 3, '12-15', 45),
        item('ex_rosca-direta-com-barra', 3, '8-12', 60),
        item('ex_rosca-martelo', 3, '10-12', 60),
      ],
    },
    {
      id: uid(), nome: 'Treino C - Pernas e Abdomen', cor: '#3ddc97', ordem: 2,
      dias: [3, 6], atualizadoEm: t,
      descricao: 'O treino que a maioria pula. Nao pule.',
      itens: [
        item('ex_agachamento-livre', 4, '6-10', 150),
        item('ex_leg-press-45', 4, '10-15', 120),
        item('ex_cadeira-extensora', 3, '12-15', 60),
        item('ex_mesa-flexora', 4, '10-12', 60),
        item('ex_stiff-com-barra', 3, '8-12', 90),
        item('ex_elevacao-pelvica-hip-thrust', 3, '10-12', 90),
        item('ex_panturrilha-em-pe-na-maquina', 4, '15-20', 45),
        item('ex_prancha', 3, '45s', 45),
      ],
    },
  ]
}
