import type { Alimento, ItemRefeicao, PlanoRefeicao, Perfil } from '../db/types'
import { macrosDe, somaMacros, ZERO, type Macros } from './nutricao'
import { uid } from '../db'

/**
 * Monta o plano alimentar a partir das metas do perfil.
 *
 * A ordem de calculo importa e nao e obvia:
 *
 * 1. FIXOS  - verdura, fruta e leite, em quantidade que nao negocia.
 * 2. PROT   - porcao minima realista por refeicao (um file de frango e 120 g,
 *             nao 47 g), subindo se ainda faltar proteina.
 * 3. GORD   - completa a meta de gordura descontando o que as outras comidas
 *             ja trouxeram.
 * 4. CARBO  - fecha as CALORIAS. E o macro elastico aqui, e cada refeicao
 *             recebe uma fatia parecida do que sobrou - carbo parecido em
 *             todas as refeicoes deixa a dose de insulina previsivel, que
 *             importa mais do que cravar um total exato de gramas.
 *
 * Calcular o carboidrato antes da proteina parece natural e da errado: arroz,
 * pao e aveia carregam proteina junto, e o total de calorias estoura.
 */

type Papel = 'proteina' | 'carbo' | 'gordura' | 'fixo'

interface Slot {
  alimento: string
  papel: Papel
  /** Peso relativo dentro do papel. Nao precisa somar 1. */
  peso?: number
  /** Gramas fixas, quando papel = 'fixo'. */
  gramas?: number
  /** Porcao minima, pra nao gerar "50 g de frango". */
  min?: number
}

interface Modelo {
  nome: string
  horario: string
  nota?: string
  /** Fatia do carboidrato diario. A soma das refeicoes da 1. */
  carbo: number
  slots: Slot[]
}

/**
 * Cardapio base: comida de mercado, nada exotico.
 * As fatias de carboidrato sao propositalmente parecidas entre as refeicoes -
 * dose de insulina previsivel vale mais que otimizar timing de macro.
 */
const MODELO: Modelo[] = [
  {
    nome: 'Cafe da manha', horario: '07:30', carbo: 0.17,
    slots: [
      { alimento: 'al_aveia-em-flocos', papel: 'carbo', peso: 2 },
      { alimento: 'al_banana-prata', papel: 'carbo', peso: 1 },
      { alimento: 'al_ovo-de-galinha-cozido', papel: 'proteina', peso: 1, min: 100 },
      { alimento: 'al_leite-integral', papel: 'fixo', gramas: 200 },
      { alimento: 'al_pasta-de-amendoim-integral', papel: 'gordura', peso: 1.2 },
    ],
  },
  {
    nome: 'Lanche da manha', horario: '10:00', carbo: 0.16,
    slots: [
      { alimento: 'al_pao-de-forma-integral', papel: 'carbo', peso: 2.2 },
      { alimento: 'al_maca', papel: 'carbo', peso: 1 },
      { alimento: 'al_queijo-minas-frescal', papel: 'proteina', peso: 0.7, min: 30 },
    ],
  },
  {
    nome: 'Almoco', horario: '12:30', carbo: 0.18,
    slots: [
      { alimento: 'al_arroz-branco-cozido', papel: 'carbo', peso: 2.4 },
      { alimento: 'al_feijao-carioca-cozido', papel: 'carbo', peso: 1 },
      { alimento: 'al_peito-de-frango-grelhado', papel: 'proteina', peso: 1.6, min: 110 },
      { alimento: 'al_brocolis-cozido', papel: 'fixo', gramas: 80 },
      { alimento: 'al_cenoura-crua', papel: 'fixo', gramas: 60 },
      { alimento: 'al_azeite-de-oliva', papel: 'gordura', peso: 1 },
    ],
  },
  {
    nome: 'Lanche da tarde', horario: '16:00', carbo: 0.15,
    slots: [
      { alimento: 'al_granola', papel: 'carbo', peso: 1 },
      { alimento: 'al_mamao-papaia', papel: 'carbo', peso: 1.2 },
      { alimento: 'al_iogurte-natural-integral', papel: 'fixo', gramas: 170 },
      { alimento: 'al_whey-protein-concentrado', papel: 'proteina', peso: 1, min: 30 },
      { alimento: 'al_castanha-de-caju', papel: 'gordura', peso: 1 },
    ],
  },
  {
    nome: 'Pre-treino', horario: '18:00', carbo: 0.16,
    nota: 'So carboidrato de proposito: proteina e gordura antes do treino atrapalham a digestao, e voce ja comeu whey as 16h.',
    slots: [
      { alimento: 'al_batata-doce-cozida', papel: 'carbo', peso: 2.5 },
      { alimento: 'al_pao-frances', papel: 'carbo', peso: 1 },
    ],
  },
  {
    nome: 'Jantar', horario: '21:00', carbo: 0.18,
    slots: [
      { alimento: 'al_arroz-integral-cozido', papel: 'carbo', peso: 2.2 },
      { alimento: 'al_feijao-preto-cozido', papel: 'carbo', peso: 1 },
      { alimento: 'al_patinho-grelhado', papel: 'proteina', peso: 1.5, min: 110 },
      { alimento: 'al_alface', papel: 'fixo', gramas: 40 },
      { alimento: 'al_tomate', papel: 'fixo', gramas: 90 },
      { alimento: 'al_azeite-de-oliva', papel: 'gordura', peso: 0.8 },
    ],
  },
]

/* ------------------------------------------------------------------ */

/** Quanto de um macro 1 g do alimento entrega. */
const porGrama = (a: Alimento, macro: 'prot' | 'carb' | 'gord' | 'kcal') => a[macro] / 100

/** Arredonda pra multiplo util, sem virar 137 g de arroz. */
function arredondar(g: number, papel: Papel) {
  if (papel === 'gordura') return Math.round(g / 2.5) * 2.5
  if (g < 40) return Math.round(g / 5) * 5
  return Math.round(g / 10) * 10
}

/**
 * Troca gramas por medida caseira quando o encaixe e limpo.
 * 150 g de arroz vira "6 colheres de sopa"; 137 g continua em gramas.
 */
function melhorMedida(a: Alimento, gramas: number): { qtd: number; medida: string } {
  let melhor: { qtd: number; medida: string; erro: number } | null = null
  for (const m of a.medidas) {
    if (m.gramas <= 0) continue
    const arred = Math.round((gramas / m.gramas) * 2) / 2   // aceita meia unidade
    if (arred < 0.5 || arred > 12) continue                 // ninguem conta "23 colheres"
    const erro = Math.abs(arred * m.gramas - gramas) / gramas
    if (erro > 0.08) continue
    if (!melhor || erro < melhor.erro) melhor = { qtd: arred, medida: m.nome, erro }
  }
  return melhor
    ? { qtd: melhor.qtd, medida: melhor.medida }
    : { qtd: gramas, medida: a.unidadeBase }
}

export interface RefeicaoGerada {
  nome: string
  horario: string
  nota?: string
  itens: ItemRefeicao[]
  macros: Macros
}

export interface PlanoGerado {
  refeicoes: RefeicaoGerada[]
  total: Macros
  metas: Pick<Perfil, 'metaKcal' | 'metaProt' | 'metaCarb' | 'metaGord'>
}

export function gerarPlano(
  perfil: Pick<Perfil, 'metaKcal' | 'metaProt' | 'metaCarb' | 'metaGord'>,
  alimentos: Map<string, Alimento>,
): PlanoGerado {
  // trabalha so com o que existe no catalogo
  const modelo = MODELO
    .map(m => ({ ...m, slots: m.slots.filter(s => alimentos.has(s.alimento)) }))
    .filter(m => m.slots.length > 0)

  const gramas = new Map<Slot, number>()
  const acc = { prot: 0, carb: 0, gord: 0, kcal: 0 }

  const registrar = (slot: Slot, g: number) => {
    const a = alimentos.get(slot.alimento)!
    const final = Math.max(0, g)
    gramas.set(slot, final)
    acc.prot += porGrama(a, 'prot') * final
    acc.carb += porGrama(a, 'carb') * final
    acc.gord += porGrama(a, 'gord') * final
    acc.kcal += porGrama(a, 'kcal') * final
  }

  /* 1. fixos ------------------------------------------------------- */
  for (const m of modelo) {
    for (const s of m.slots) if (s.papel === 'fixo') registrar(s, s.gramas ?? 100)
  }

  /* 2. proteina: porcao minima realista, subindo se faltar ---------- */
  const slotsProt = modelo.flatMap(m => m.slots.filter(s => s.papel === 'proteina'))
  const faltaProt = Math.max(0, perfil.metaProt - acc.prot)
  const pesosProt = slotsProt.reduce((t, s) => t + (s.peso ?? 1), 0) || 1
  for (const s of slotsProt) {
    const d = porGrama(alimentos.get(s.alimento)!, 'prot')
    if (d <= 0) continue
    const proporcional = (faltaProt * ((s.peso ?? 1) / pesosProt)) / d
    registrar(s, arredondar(Math.max(s.min ?? 0, proporcional), 'proteina'))
  }

  /* 3. gordura: completa a meta descontando o que ja veio ------------ */
  const slotsGord = modelo.flatMap(m => m.slots.filter(s => s.papel === 'gordura'))
  const faltaGord = Math.max(slotsGord.length * 2.5, perfil.metaGord - acc.gord)
  const pesosGord = slotsGord.reduce((t, s) => t + (s.peso ?? 1), 0) || 1
  for (const s of slotsGord) {
    registrar(s, arredondar(faltaGord * ((s.peso ?? 1) / pesosGord), 'gordura'))
  }

  /* 4. carboidrato: fecha as calorias, dividido por refeicao ---------- */
  const somaFatias = modelo.reduce((t, m) => t + m.carbo, 0) || 1
  // usa a densidade CALORICA, nao a de carboidrato: aveia e granola trazem
  // gordura junto, e dividir por 4 subestimaria o quanto elas pesam no total
  const kcalRestante = Math.max(0, perfil.metaKcal - acc.kcal)
  for (const m of modelo) {
    const slots = m.slots.filter(s => s.papel === 'carbo')
    if (!slots.length) continue
    const kcalDaRefeicao = kcalRestante * (m.carbo / somaFatias)
    const pesos = slots.reduce((t, s) => t + (s.peso ?? 1), 0)
    for (const s of slots) {
      const d = porGrama(alimentos.get(s.alimento)!, 'kcal')
      if (d <= 0) continue
      registrar(s, arredondar((kcalDaRefeicao * ((s.peso ?? 1) / pesos)) / d, 'carbo'))
    }
  }

  /* monta o resultado ------------------------------------------------ */
  const refeicoes: RefeicaoGerada[] = modelo.map(m => {
    const itens: ItemRefeicao[] = m.slots
      .map(s => {
        const a = alimentos.get(s.alimento)!
        const g = gramas.get(s) ?? 0
        const { qtd, medida } = melhorMedida(a, g)
        return { alimentoId: a.id, qtd, medida, gramas: g }
      })
      .filter(i => i.gramas > 0)

    const macros = somaMacros(...itens.map(i => {
      const a = alimentos.get(i.alimentoId)
      return a ? macrosDe(a, i.gramas) : ZERO
    }))

    return { nome: m.nome, horario: m.horario, nota: m.nota, itens, macros }
  })

  return {
    refeicoes,
    total: somaMacros(...refeicoes.map(r => r.macros)),
    metas: {
      metaKcal: perfil.metaKcal, metaProt: perfil.metaProt,
      metaCarb: perfil.metaCarb, metaGord: perfil.metaGord,
    },
  }
}

/** Converte o plano gerado em registros prontos pro banco. */
export function paraPlanoRefeicao(p: PlanoGerado): PlanoRefeicao[] {
  return p.refeicoes.map((r, i) => ({
    id: uid(),
    nome: r.nome,
    horario: r.horario,
    itens: r.itens,
    ordem: i,
    atualizadoEm: Date.now(),
  }))
}
