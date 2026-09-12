import type { ItemRefeicao } from './types'

export interface RefeicaoPronta {
  nome: string
  horario: string
  itens: ItemRefeicao[]
  /** Por que essa refeicao e montada assim. Aparece ao abrir a dieta. */
  nota?: string
}

export interface DietaPronta {
  id: string
  nome: string
  apelido?: string
  /** Uma linha: o que e. */
  resumo: string
  /** Por que funciona - o criterio pra escolher. */
  porque: string
  /** Pra quem NAO serve. */
  cuidado?: string
  refeicoes: RefeicaoPronta[]
}

const i = (alimentoId: string, qtd: number, medida: string, gramas: number): ItemRefeicao =>
  ({ alimentoId, qtd, medida, gramas })

/* ================================================================== */

export const DIETAS_PRONTAS: DietaPronta[] = [
  {
    id: 'dieta-hibrido',
    nome: 'Dieta do Hibrido',
    apelido: 'Metodo Hibrido - Edição 01',
    resumo: '~2.800 kcal em 3 refeições grandes, com comida barata de mercado.',
    porque:
      'A aposta e praticidade: três refeições, nenhum alimento caro e nada que precise '
      + 'de preparo complicado. Arroz, cuscuz, pão, ovo, sobrecoxa e macarrão seguram '
      + 'cerca de 155 g de proteína e 285 g de carboidrato sem você cozinhar seis vezes '
      + 'por dia. Se comer mais vezes te atrapalha mais do que ajuda, esse formato ganha '
      + 'do plano de 7 refeições no único criterio que decide dieta: o que você consegue '
      + 'repetir por meses. A regra fixa do metodo e encaixar uma fruta em cada refeição.',
    cuidado:
      'Aplicar isso com diabetes tipo 1 exige conversa com o endocrinologista ANTES. '
      + 'A janta sozinha tem ~136 g de carboidrato e ~84 g de gordura: e bolus grande e '
      + 'absorcao lenta pela gordura, ou seja, risco de hipo cedo e de subir tarde, de '
      + 'madrugada. Se você for testar, quebre a janta em duas (jantar e ceia) e meca '
      + 'antes de dormir e na madrugada nos primeiros dias. Fora isso: 3 refeições deixam '
      + 'cerca de 250 kcal a menos que o seu plano atual e cortam boa parte das verduras, '
      + 'frutas e laticínios - a fruta por refeição não e enfeite, e o que fecha a conta.',
    refeicoes: [
      {
        nome: 'Café da manhã', horario: '07:00',
        nota: 'Opção 2: 3 paes francês + 3 fatias de queijo + 3 ovos. Encaixe uma fruta.',
        itens: [
          i('al_cuscuz-de-milho-cozido', 2, 'prato', 300),
          i('al_ovo-de-galinha-cozido', 3, 'unidade', 150),
        ],
      },
      {
        nome: 'Almoço', horario: '12:30',
        nota:
          'Opção 2: 200 g de macarrão + 120 g de sobrecoxa. Opção 3: 120 g de goma de '
          + 'tapioca + 120 g de sobrecoxa + salada. A salada e a vontade - o alface e o '
          + 'tomate aqui sao só o mínimo pra conta não ficar zerada.',
        itens: [
          i('al_arroz-branco-cozido', 250, 'g', 250),
          i('al_sobrecoxa-assada-sem-pele', 120, 'g', 120),
          i('al_alface', 1, 'prato', 60),
          i('al_tomate', 1, 'unidade média', 90),
        ],
      },
      {
        nome: 'Janta', horario: '20:00',
        nota: 'Opção 2: repetir o almoço - e a versão mais leve e mais fácil de dosar insulina.',
        itens: [
          i('al_pao-frances', 4, 'unidade', 200),
          i('al_hamburguer-bovino', 4, 'unidade', 320),
          i('al_queijo-mussarela', 4, 'fatia', 80),
        ],
      },
    ],
  },
  {
    id: 'dieta-t1d-bulking',
    nome: 'Ganho de massa com diabetes tipo 1',
    apelido: 'T1D + bulking',
    resumo: '~3.050 kcal com carboidrato espalhado igual e ceia anti-hipo.',
    porque:
      'Carboidrato distribuido entre 40 e 70 g por refeição, sem pico: dose parecida '
      + 'todo dia e dose que você acerta. O pre-treino não leva gordura nem fibra, pra '
      + 'absorcao ser previsivel, e a ceia leva proteína e gordura pra segurar a madrugada '
      + 'depois de treinar a noite. Proteína alta (cerca de 2,4 g/kg pra 70 kg) porque, alem '
      + 'do músculo, ela ajuda o tempo no alvo depois do exercício.',
    cuidado:
      'São 7 refeições. Se você usa caneta, e bolus demais no dia - junte o lanche da '
      + 'manhã no café e vire 6. E confirme tudo com seu endocrinologista antes: mudar '
      + 'carboidrato muda insulina.',
    refeicoes: [
      {
        nome: 'Café da manhã', horario: '07:00',
        itens: [
          i('al_aveia-em-flocos', 4, 'colher de sopa', 60),
          i('al_leite-integral', 1, 'copo (200 ml)', 200),
          i('al_banana-prata', 1, 'unidade média', 70),
          i('al_ovo-de-galinha-cozido', 2, 'unidade', 100),
          i('al_pasta-de-amendoim-integral', 1, 'colher de sopa', 15),
        ],
      },
      {
        nome: 'Lanche da manhã', horario: '10:00',
        itens: [
          i('al_pao-de-forma-integral', 3, 'fatia', 75),
          i('al_queijo-minas-frescal', 1, 'fatia', 30),
          i('al_maca', 1, 'unidade média', 130),
        ],
      },
      {
        nome: 'Almoço', horario: '12:30',
        itens: [
          i('al_arroz-branco-cozido', 2, 'escumadeira', 160),
          i('al_feijao-carioca-cozido', 1, 'concha média', 80),
          i('al_peito-de-frango-grelhado', 1, 'file medio', 120),
          i('al_brocolis-cozido', 1, 'prato', 80),
          i('al_cenoura-crua', 1, 'colher de sopa', 20),
          i('al_azeite-de-oliva', 1, 'fio', 5),
        ],
      },
      {
        nome: 'Lanche da tarde', horario: '16:00',
        itens: [
          i('al_iogurte-grego', 1, 'pote', 130),
          i('al_granola', 2, 'colher de sopa', 30),
          i('al_mamao-papaia', 1, 'fatia', 100),
          i('al_castanha-de-caju', 1, 'punhado', 30),
        ],
      },
      {
        nome: 'Pre-treino', horario: '18:00',
        nota: 'Sem gordura e sem fibra de proposito - absorve rápido e previsivel.',
        itens: [
          i('al_tapioca-goma-hidratada', 1, 'beiju medio', 60),
          i('al_banana-nanica', 1, 'unidade média', 85),
        ],
      },
      {
        nome: 'Jantar', horario: '21:00',
        itens: [
          i('al_arroz-integral-cozido', 2, 'escumadeira', 160),
          i('al_feijao-preto-cozido', 1, 'concha média', 80),
          i('al_patinho-grelhado', 1, 'bife medio', 100),
          i('al_tomate', 1, 'unidade média', 90),
          i('al_azeite-de-oliva', 1, 'fio', 5),
        ],
      },
      {
        nome: 'Ceia', horario: '22:30',
        nota: 'Proteína e gordura pra atravessar a madrugada depois do treino da noite.',
        itens: [
          i('al_iogurte-natural-integral', 1, 'copo', 200),
          i('al_aveia-em-flocos', 1, 'colher de sopa', 15),
          i('al_pasta-de-amendoim-integral', 1, 'colher de sopa', 15),
        ],
      },
    ],
  },
]

export const getDietaPronta = (id: string) => DIETAS_PRONTAS.find(d => d.id === id)
