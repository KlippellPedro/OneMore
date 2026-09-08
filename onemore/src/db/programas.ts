import type { ItemRotina } from './types'

export interface DiaPrograma {
  nome: string
  cor: string
  descricao?: string
  itens: ItemRotina[]
  /** true = da pra fazer em casa, sem equipamento de academia. */
  emCasa?: boolean
}

export interface Programa {
  id: string
  nome: string
  apelido?: string
  nivel: 'iniciante' | 'intermediario' | 'avancado'
  dias: number
  foco: string
  /** Uma linha: o que e. */
  resumo: string
  /** Por que esse programa funciona - o criterio pra escolher. */
  porque: string
  /** Pra quem NAO serve. Ninguem escreve isso e e o que mais ajuda a escolher. */
  cuidado?: string
  treinos: DiaPrograma[]
  /** Dias da semana sugeridos, na ordem dos treinos. 1=Seg ... 0=Dom */
  sugestaoDias: number[]
}

const it = (
  exercicioId: string, series: number, repsAlvo: string,
  descansoSeg = 90, obs?: string,
): ItemRotina => ({ exercicioId, series, repsAlvo, descansoSeg, obs })

const C = {
  push: '#8b6dd6', pull: '#4f9aad', legs: '#4caf87',
  upper: '#bd7095', lower: '#c9a049', full: '#7b81be',
  casa: '#9b7fc7', extra: '#c25f70',
}

/* ================================================================== */

export const PROGRAMAS: Programa[] = [
  /* ------------------------------------------------------------------ */
  {
    id: 'ppl-ul-5',
    nome: 'Push / Pull / Legs + Upper / Lower',
    apelido: 'PPL + UL',
    nivel: 'intermediario',
    dias: 5,
    foco: 'Hipertrofia',
    resumo: 'Cinco dias, cada musculo estimulado duas vezes por semana.',
    porque:
      'Cinco dias e onde o split de 3 (PPL) e o de 4 (Upper/Lower) se encontram. '
      + 'Voce comeca a semana com os tres dias pesados e fecha com dois dias de volume, '
      + 'batendo cada grupo 2x - que e a frequencia com mais evidencia a favor pra hipertrofia. '
      + 'E o melhor uso possivel de 5 dias.',
    cuidado: 'Exige comer e dormir de verdade. Com 5 dias mal recuperados voce rende menos que com 3 bem feitos.',
    sugestaoDias: [1, 2, 3, 5, 6],
    treinos: [
      {
        nome: 'A - Push (peito, ombro, triceps)', cor: C.push,
        descricao: 'Dia pesado de empurrar. Comece forte no supino, a carga cai nos acessorios.',
        itens: [
          it('ex_supino-reto-com-barra', 4, '6-8', 150, 'Serie mais pesada da semana pro peito'),
          it('ex_supino-inclinado-com-halteres', 3, '8-12', 120),
          it('ex_desenvolvimento-militar-com-barra', 3, '6-10', 120),
          it('ex_crucifixo-inclinado-com-halteres', 3, '12-15', 60),
          it('ex_elevacao-lateral-com-halteres', 4, '12-20', 45, 'Peso leve, foco em sentir o deltoide'),
          it('ex_triceps-pulley-com-corda', 3, '10-15', 60),
          it('ex_triceps-testa-com-barra-w', 3, '8-12', 60),
        ],
      },
      {
        nome: 'B - Pull (costas, biceps)', cor: C.pull,
        descricao: 'Dia pesado de puxar. Toda repeticao comeca pela escapula, nao pelo braco.',
        itens: [
          it('ex_barra-fixa-pronada', 4, '6-10', 150, 'Se sobrar facil, adicione peso'),
          it('ex_remada-curvada-com-barra', 4, '6-10', 150),
          it('ex_puxada-frontal-na-polia', 3, '10-12', 90),
          it('ex_remada-baixa-no-cabo', 3, '10-12', 90),
          it('ex_face-pull-no-cabo', 3, '15-20', 45, 'Saude do ombro. Nao pule.'),
          it('ex_rosca-direta-com-barra', 3, '8-12', 60),
          it('ex_rosca-martelo', 3, '10-12', 60),
        ],
      },
      {
        nome: 'C - Legs (pernas completo)', cor: C.legs,
        descricao: 'O treino que a maioria pula. Nao pule.',
        itens: [
          it('ex_agachamento-livre', 4, '5-8', 180, 'Aqueca com 2 series leves antes'),
          it('ex_leg-press-45', 3, '10-15', 120),
          it('ex_stiff-com-barra', 4, '8-12', 120),
          it('ex_mesa-flexora', 3, '10-15', 60),
          it('ex_cadeira-extensora', 3, '12-15', 60),
          it('ex_panturrilha-em-pe-na-maquina', 4, '12-20', 45),
          it('ex_abdominal-na-polia-ajoelhado', 3, '12-15', 45),
        ],
      },
      {
        nome: 'D - Upper (superior, volume)', cor: C.upper,
        descricao: 'Segunda passada no superior. Carga menor, mais repeticao, mais sangue no musculo.',
        itens: [
          it('ex_supino-inclinado-com-barra', 4, '8-12', 120),
          it('ex_puxada-com-triangulo', 4, '10-12', 90),
          it('ex_supino-na-maquina', 3, '12-15', 60),
          it('ex_remada-unilateral-com-halter', 3, '10-12', 60),
          it('ex_desenvolvimento-com-halteres', 3, '10-12', 90),
          it('ex_elevacao-lateral-no-cabo', 3, '15-20', 45),
          it('ex_rosca-scott', 3, '10-12', 60),
          it('ex_triceps-pulley-com-barra', 3, '10-15', 60),
        ],
      },
      {
        nome: 'E - Lower (inferior, volume)', cor: C.lower,
        descricao: 'Segunda passada nas pernas, com mais gluteo e posterior.',
        itens: [
          it('ex_agachamento-frontal', 3, '8-12', 150),
          it('ex_elevacao-pelvica-hip-thrust', 4, '8-12', 120),
          it('ex_agachamento-bulgaro', 3, '10-12', 90, 'Cada perna'),
          it('ex_cadeira-flexora-sentada', 3, '12-15', 60),
          it('ex_leg-press-45', 3, '15-20', 90, 'Pes altos na plataforma, foco posterior/gluteo'),
          it('ex_panturrilha-sentado', 4, '15-20', 45),
          it('ex_prancha', 3, '45s', 45),
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'casa-cardio-core',
    nome: 'Casa: cardio e core',
    apelido: 'Dias leves',
    nivel: 'iniciante',
    dias: 2,
    foco: 'Cardio e abdomen',
    resumo: 'Dois dias sem equipamento, pra fechar a semana sem atrapalhar a recuperacao.',
    porque:
      'Serve pra somar movimento e trabalhar o core sem cansar as pernas nem os ombros '
      + 'antes do proximo treino pesado. Cardio de baixa intensidade ainda ajuda a recuperacao '
      + 'em vez de atrapalhar. Encaixa depois de qualquer programa de academia.',
    sugestaoDias: [4, 0],
    treinos: [
      {
        nome: 'Casa 1 - Cardio e core', cor: C.casa, emCasa: true,
        descricao: 'Circuito curto. Faca os exercicios em sequencia, descanse 60s e repita.',
        itens: [
          it('ex_caminhada-rapida', 1, '25min', 0, 'Ou corrida leve, se estiver disposto'),
          it('ex_prancha', 3, '45s', 45),
          it('ex_abdominal-bicicleta', 3, '20', 45),
          it('ex_elevacao-de-pernas-deitado', 3, '12-15', 45),
          it('ex_prancha-lateral', 3, '30s', 30, 'Cada lado'),
          it('ex_mountain-climber', 3, '30s', 45),
        ],
      },
      {
        nome: 'Casa 2 - Mobilidade e abdomen', cor: C.casa, emCasa: true,
        descricao: 'Dia mais leve. O objetivo e chegar na segunda inteiro.',
        itens: [
          it('ex_mobilidade-e-alongamento', 1, '12min', 0),
          it('ex_dead-bug', 3, '10', 45, 'Cada lado, bem devagar'),
          it('ex_bird-dog', 3, '10', 45, 'Cada lado'),
          it('ex_prancha-com-toque-no-ombro', 3, '30s', 45),
          it('ex_ponte-de-gluteo', 3, '15', 45),
          it('ex_caminhada-rapida', 1, '20min', 0),
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'fullbody-3',
    nome: 'Full Body 3x',
    nivel: 'iniciante',
    dias: 3,
    foco: 'Base e forca',
    resumo: 'Corpo inteiro em cada treino, tres vezes por semana.',
    porque:
      'Pra quem esta comecando ou voltando, e imbativel: cada musculo recebe estimulo 3x por semana '
      + 'e voce pratica os movimentos principais com mais frequencia - e tecnica se constroi com repeticao. '
      + 'Tres dias tambem e facil de manter quando a rotina aperta.',
    cuidado: 'Depois de uns 6 meses o volume por sessao vira o limite. Ai vale migrar pra Upper/Lower.',
    sugestaoDias: [1, 3, 5],
    treinos: [
      {
        nome: 'Full Body A', cor: C.full,
        itens: [
          it('ex_agachamento-livre', 3, '5-8', 180),
          it('ex_supino-reto-com-barra', 3, '5-8', 150),
          it('ex_remada-curvada-com-barra', 3, '6-10', 120),
          it('ex_desenvolvimento-com-halteres', 3, '8-12', 90),
          it('ex_mesa-flexora', 3, '10-15', 60),
          it('ex_prancha', 3, '40s', 45),
        ],
      },
      {
        nome: 'Full Body B', cor: C.full,
        itens: [
          it('ex_levantamento-terra', 3, '5', 210, 'Tecnica antes de carga. Sempre.'),
          it('ex_supino-inclinado-com-halteres', 3, '8-12', 120),
          it('ex_puxada-frontal-na-polia', 3, '8-12', 90),
          it('ex_leg-press-45', 3, '10-15', 120),
          it('ex_elevacao-lateral-com-halteres', 3, '12-15', 45),
          it('ex_abdominal-supra-crunch', 3, '15-20', 45),
        ],
      },
      {
        nome: 'Full Body C', cor: C.full,
        itens: [
          it('ex_agachamento-frontal', 3, '6-10', 150),
          it('ex_mergulho-nas-paralelas', 3, '8-12', 120),
          it('ex_barra-fixa-pronada', 3, '6-10', 120),
          it('ex_stiff-com-barra', 3, '8-12', 120),
          it('ex_rosca-direta-com-barra', 3, '10-12', 60),
          it('ex_panturrilha-em-pe-na-maquina', 3, '15-20', 45),
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'upper-lower-4',
    nome: 'Upper / Lower 4x',
    nivel: 'intermediario',
    dias: 4,
    foco: 'Hipertrofia e forca',
    resumo: 'Superior e inferior, duas vezes cada por semana.',
    porque:
      'O melhor custo-beneficio pra maioria das pessoas. Frequencia 2x por musculo, '
      + 'volume dividido em sessoes que cabem em 1 hora, e ainda sobram 3 dias de folga. '
      + 'Se voce so consegue 4 dias, comece por aqui.',
    sugestaoDias: [1, 2, 4, 5],
    treinos: [
      {
        nome: 'Upper A (forca)', cor: C.upper,
        itens: [
          it('ex_supino-reto-com-barra', 4, '5-8', 150),
          it('ex_remada-curvada-com-barra', 4, '6-8', 150),
          it('ex_desenvolvimento-militar-com-barra', 3, '6-10', 120),
          it('ex_puxada-frontal-na-polia', 3, '10-12', 90),
          it('ex_rosca-direta-com-barra', 3, '8-12', 60),
          it('ex_triceps-testa-com-barra-w', 3, '8-12', 60),
        ],
      },
      {
        nome: 'Lower A (forca)', cor: C.lower,
        itens: [
          it('ex_agachamento-livre', 4, '5-8', 180),
          it('ex_stiff-com-barra', 3, '8-10', 120),
          it('ex_leg-press-45', 3, '10-15', 120),
          it('ex_mesa-flexora', 3, '10-15', 60),
          it('ex_panturrilha-em-pe-na-maquina', 4, '12-15', 45),
          it('ex_prancha', 3, '45s', 45),
        ],
      },
      {
        nome: 'Upper B (volume)', cor: C.upper,
        itens: [
          it('ex_supino-inclinado-com-halteres', 4, '8-12', 120),
          it('ex_barra-fixa-pronada', 4, '8-12', 120),
          it('ex_voador-peck-deck', 3, '12-15', 60),
          it('ex_remada-baixa-no-cabo', 3, '10-12', 90),
          it('ex_elevacao-lateral-com-halteres', 4, '12-20', 45),
          it('ex_face-pull-no-cabo', 3, '15-20', 45),
          it('ex_rosca-martelo', 3, '10-12', 60),
          it('ex_triceps-pulley-com-corda', 3, '12-15', 60),
        ],
      },
      {
        nome: 'Lower B (volume)', cor: C.lower,
        itens: [
          it('ex_agachamento-frontal', 3, '8-12', 150),
          it('ex_elevacao-pelvica-hip-thrust', 4, '8-12', 120),
          it('ex_agachamento-bulgaro', 3, '10-12', 90),
          it('ex_cadeira-flexora-sentada', 3, '12-15', 60),
          it('ex_cadeira-extensora', 3, '12-15', 60),
          it('ex_panturrilha-sentado', 4, '15-20', 45),
          it('ex_abdominal-na-polia-ajoelhado', 3, '12-15', 45),
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ppl-6',
    nome: 'Push / Pull / Legs 6x',
    apelido: 'PPL',
    nivel: 'avancado',
    dias: 6,
    foco: 'Hipertrofia',
    resumo: 'O split mais popular do mundo, rodando duas vezes na semana.',
    porque:
      'Agrupa os musculos que trabalham juntos, entao nada e treinado duas vezes por acidente. '
      + 'Rodando 2x na semana voce chega em volume alto sem sessao gigante. '
      + 'E o padrao da academia hoje por um motivo: funciona e e facil de entender.',
    cuidado: 'Seis dias e muita coisa. Se voce falta 2 dias por semana, o de 4 dias te da mais resultado.',
    sugestaoDias: [1, 2, 3, 4, 5, 6],
    treinos: [
      {
        nome: 'Push A (pesado)', cor: C.push,
        itens: [
          it('ex_supino-reto-com-barra', 4, '5-8', 150),
          it('ex_desenvolvimento-militar-com-barra', 3, '6-10', 120),
          it('ex_supino-inclinado-com-halteres', 3, '8-12', 90),
          it('ex_elevacao-lateral-com-halteres', 4, '12-20', 45),
          it('ex_triceps-testa-com-barra-w', 3, '8-12', 60),
          it('ex_triceps-pulley-com-corda', 3, '12-15', 60),
        ],
      },
      {
        nome: 'Pull A (pesado)', cor: C.pull,
        itens: [
          it('ex_levantamento-terra', 3, '5', 210),
          it('ex_barra-fixa-pronada', 4, '6-10', 120),
          it('ex_remada-curvada-com-barra', 3, '8-10', 120),
          it('ex_face-pull-no-cabo', 3, '15-20', 45),
          it('ex_rosca-direta-com-barra', 3, '8-12', 60),
          it('ex_rosca-martelo', 3, '10-12', 60),
        ],
      },
      {
        nome: 'Legs A (pesado)', cor: C.legs,
        itens: [
          it('ex_agachamento-livre', 4, '5-8', 180),
          it('ex_stiff-com-barra', 3, '8-10', 120),
          it('ex_leg-press-45', 3, '10-15', 120),
          it('ex_mesa-flexora', 3, '10-15', 60),
          it('ex_panturrilha-em-pe-na-maquina', 4, '12-15', 45),
        ],
      },
      {
        nome: 'Push B (volume)', cor: C.push,
        itens: [
          it('ex_supino-inclinado-com-barra', 4, '8-12', 120),
          it('ex_desenvolvimento-com-halteres', 3, '10-12', 90),
          it('ex_voador-peck-deck', 3, '12-15', 60),
          it('ex_crossover-polia-alta', 3, '12-15', 60),
          it('ex_elevacao-lateral-no-cabo', 4, '15-20', 45),
          it('ex_triceps-na-maquina', 3, '12-15', 60),
        ],
      },
      {
        nome: 'Pull B (volume)', cor: C.pull,
        itens: [
          it('ex_puxada-com-triangulo', 4, '10-12', 90),
          it('ex_remada-cavalinho-t-bar', 3, '10-12', 90),
          it('ex_remada-baixa-no-cabo', 3, '12-15', 60),
          it('ex_pulldown-com-bracos-estendidos', 3, '12-15', 60),
          it('ex_crucifixo-inverso-com-halteres', 3, '15-20', 45),
          it('ex_rosca-scott', 3, '10-12', 60),
        ],
      },
      {
        nome: 'Legs B (volume)', cor: C.legs,
        itens: [
          it('ex_agachamento-frontal', 3, '8-12', 150),
          it('ex_elevacao-pelvica-hip-thrust', 4, '10-12', 90),
          it('ex_cadeira-extensora', 4, '12-15', 60),
          it('ex_cadeira-flexora-sentada', 4, '12-15', 60),
          it('ex_panturrilha-sentado', 4, '15-20', 45),
          it('ex_abdominal-na-polia-ajoelhado', 3, '12-15', 45),
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ppl-3',
    nome: 'Push / Pull / Legs 3x',
    nivel: 'iniciante',
    dias: 3,
    foco: 'Hipertrofia',
    resumo: 'O PPL classico em tres dias, uma volta por semana.',
    porque:
      'Mesma logica do PPL de 6, mas cabe em tres dias. Cada sessao e mais longa e cada musculo '
      + 'so e treinado 1x por semana, entao rende menos que o Full Body de 3 dias pra iniciante - '
      + 'mas muita gente prefere pela divisao mais clara.',
    sugestaoDias: [1, 3, 5],
    treinos: [
      {
        nome: 'Push (peito, ombro, triceps)', cor: C.push,
        itens: [
          it('ex_supino-reto-com-barra', 4, '6-10', 150),
          it('ex_supino-inclinado-com-halteres', 3, '8-12', 90),
          it('ex_desenvolvimento-com-halteres', 3, '8-12', 90),
          it('ex_elevacao-lateral-com-halteres', 4, '12-20', 45),
          it('ex_triceps-pulley-com-corda', 3, '10-15', 60),
          it('ex_triceps-frances-com-halter', 3, '10-12', 60),
        ],
      },
      {
        nome: 'Pull (costas, biceps)', cor: C.pull,
        itens: [
          it('ex_barra-fixa-pronada', 4, '6-10', 120),
          it('ex_remada-curvada-com-barra', 4, '8-10', 120),
          it('ex_puxada-frontal-na-polia', 3, '10-12', 90),
          it('ex_remada-baixa-no-cabo', 3, '10-12', 90),
          it('ex_face-pull-no-cabo', 3, '15-20', 45),
          it('ex_rosca-alternada-com-halteres', 3, '10-12', 60),
        ],
      },
      {
        nome: 'Legs (pernas e abdomen)', cor: C.legs,
        itens: [
          it('ex_agachamento-livre', 4, '6-10', 180),
          it('ex_stiff-com-barra', 3, '8-12', 120),
          it('ex_leg-press-45', 3, '10-15', 120),
          it('ex_mesa-flexora', 3, '12-15', 60),
          it('ex_panturrilha-em-pe-na-maquina', 4, '15-20', 45),
          it('ex_prancha', 3, '45s', 45),
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'phul-4',
    nome: 'PHUL 4x',
    apelido: 'Power Hypertrophy Upper Lower',
    nivel: 'intermediario',
    dias: 4,
    foco: 'Forca e hipertrofia',
    resumo: 'Dois dias de forca pesada e dois de volume, dividido em superior e inferior.',
    porque:
      'Resolve a briga entre ficar forte e ficar grande: os dois primeiros dias sao de carga baixa '
      + 'em repeticao (3-5), os dois ultimos de volume (8-15). Voce puxa a forca nos basicos e '
      + 'constroi tamanho nos acessorios, sem escolher um dos dois.',
    sugestaoDias: [1, 2, 4, 5],
    treinos: [
      {
        nome: 'Upper Power', cor: C.upper,
        descricao: 'Carga pesada, 3 a 5 repeticoes. Descanso longo e obrigatorio.',
        itens: [
          it('ex_supino-reto-com-barra', 4, '3-5', 180),
          it('ex_remada-curvada-com-barra', 4, '3-5', 180),
          it('ex_supino-inclinado-com-halteres', 3, '6-10', 120),
          it('ex_puxada-frontal-na-polia', 3, '6-10', 120),
          it('ex_desenvolvimento-militar-com-barra', 3, '5-8', 120),
          it('ex_rosca-direta-com-barra', 3, '6-10', 60),
          it('ex_supino-fechado', 3, '6-10', 90),
        ],
      },
      {
        nome: 'Lower Power', cor: C.lower,
        descricao: 'Mesma logica embaixo: pesado e com descanso longo.',
        itens: [
          it('ex_agachamento-livre', 4, '3-5', 210),
          it('ex_levantamento-terra', 3, '3-5', 210),
          it('ex_leg-press-45', 3, '8-12', 120),
          it('ex_cadeira-flexora-sentada', 3, '8-12', 60),
          it('ex_panturrilha-em-pe-na-maquina', 4, '8-12', 45),
        ],
      },
      {
        nome: 'Upper Hypertrophy', cor: C.upper,
        descricao: 'Carga menor, 8 a 15 repeticoes, descanso curto.',
        itens: [
          it('ex_supino-inclinado-com-barra', 3, '8-12', 90),
          it('ex_voador-peck-deck', 3, '12-15', 60),
          it('ex_remada-baixa-no-cabo', 3, '10-15', 60),
          it('ex_puxada-com-triangulo', 3, '10-15', 60),
          it('ex_elevacao-lateral-com-halteres', 4, '12-20', 45),
          it('ex_rosca-scott', 3, '10-15', 60),
          it('ex_triceps-pulley-com-corda', 3, '12-15', 60),
        ],
      },
      {
        nome: 'Lower Hypertrophy', cor: C.lower,
        itens: [
          it('ex_agachamento-frontal', 3, '8-12', 120),
          it('ex_stiff-com-barra', 3, '10-15', 90),
          it('ex_agachamento-bulgaro', 3, '10-15', 90),
          it('ex_cadeira-extensora', 3, '12-20', 60),
          it('ex_mesa-flexora', 3, '12-20', 60),
          it('ex_panturrilha-sentado', 4, '15-20', 45),
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'abcde-5',
    nome: 'ABCDE 5x',
    apelido: 'Bro split',
    nivel: 'intermediario',
    dias: 5,
    foco: 'Hipertrofia por grupo',
    resumo: 'Um grupo muscular por dia, do jeito que se treina em academia no Brasil.',
    porque:
      'Todo o volume de um musculo cai num dia so, entao da pra atacar de varios angulos e sentir '
      + 'muito o treino. E o split mais facil de seguir e o mais divertido pra quem gosta de treinar. '
      + 'A frequencia de 1x por semana rende um pouco menos que 2x, mas volume alto compensa boa parte.',
    cuidado: 'Faltou um dia, o musculo daquele dia fica 2 semanas sem estimulo. Exige presenca.',
    sugestaoDias: [1, 2, 3, 4, 5],
    treinos: [
      {
        nome: 'A - Peito e triceps', cor: C.push,
        itens: [
          it('ex_supino-reto-com-barra', 4, '6-10', 150),
          it('ex_supino-inclinado-com-halteres', 4, '8-12', 90),
          it('ex_crossover-polia-alta', 3, '12-15', 60),
          it('ex_voador-peck-deck', 3, '12-15', 60),
          it('ex_triceps-testa-com-barra-w', 4, '8-12', 60),
          it('ex_triceps-pulley-com-corda', 3, '12-15', 60),
          it('ex_mergulho-no-banco', 3, '10-15', 60),
        ],
      },
      {
        nome: 'B - Costas e biceps', cor: C.pull,
        itens: [
          it('ex_barra-fixa-pronada', 4, '6-10', 120),
          it('ex_remada-curvada-com-barra', 4, '8-10', 120),
          it('ex_puxada-frontal-na-polia', 3, '10-12', 90),
          it('ex_remada-unilateral-com-halter', 3, '10-12', 60),
          it('ex_rosca-direta-com-barra', 4, '8-12', 60),
          it('ex_rosca-martelo', 3, '10-12', 60),
          it('ex_rosca-concentrada', 3, '12-15', 45),
        ],
      },
      {
        nome: 'C - Pernas', cor: C.legs,
        itens: [
          it('ex_agachamento-livre', 4, '6-10', 180),
          it('ex_leg-press-45', 4, '10-15', 120),
          it('ex_cadeira-extensora', 3, '12-15', 60),
          it('ex_stiff-com-barra', 4, '8-12', 120),
          it('ex_mesa-flexora', 3, '12-15', 60),
          it('ex_elevacao-pelvica-hip-thrust', 3, '10-12', 90),
          it('ex_panturrilha-em-pe-na-maquina', 4, '15-20', 45),
        ],
      },
      {
        nome: 'D - Ombro e trapezio', cor: C.upper,
        itens: [
          it('ex_desenvolvimento-militar-com-barra', 4, '6-10', 120),
          it('ex_desenvolvimento-arnold', 3, '10-12', 90),
          it('ex_elevacao-lateral-com-halteres', 4, '12-20', 45),
          it('ex_elevacao-frontal-com-halteres', 3, '12-15', 45),
          it('ex_crucifixo-inverso-com-halteres', 4, '15-20', 45),
          it('ex_face-pull-no-cabo', 3, '15-20', 45),
          it('ex_encolhimento-com-halteres', 4, '12-15', 60),
        ],
      },
      {
        nome: 'E - Bracos e abdomen', cor: C.extra,
        itens: [
          it('ex_rosca-direta-com-barra-w', 4, '8-12', 60),
          it('ex_triceps-frances-com-halter', 4, '10-12', 60),
          it('ex_rosca-scott', 3, '10-12', 60),
          it('ex_triceps-pulley-com-barra', 3, '10-15', 60),
          it('ex_rosca-inversa', 3, '12-15', 45),
          it('ex_abdominal-na-polia-ajoelhado', 4, '12-15', 45),
          it('ex_elevacao-de-pernas-na-barra', 3, '10-15', 45),
          it('ex_prancha', 3, '45s', 45),
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'arnold-6',
    nome: 'Arnold Split 6x',
    nivel: 'avancado',
    dias: 6,
    foco: 'Hipertrofia classica',
    resumo: 'Peito+costas, ombro+braco, pernas - duas voltas na semana.',
    porque:
      'Junta musculos antagonistas no mesmo dia (peito com costas, biceps com triceps), '
      + 'o que enche a regiao de sangue e deixa o treino bem intenso. Frequencia 2x por semana '
      + 'com volume alto. E o programa que o Arnold usava, e ainda funciona.',
    cuidado: 'Volume muito alto. So faz sentido com anos de treino, sono e comida em dia.',
    sugestaoDias: [1, 2, 3, 4, 5, 6],
    treinos: [
      {
        nome: 'Peito e costas A', cor: C.push,
        itens: [
          it('ex_supino-reto-com-barra', 4, '6-10', 120),
          it('ex_barra-fixa-pronada', 4, '8-12', 120),
          it('ex_supino-inclinado-com-halteres', 3, '8-12', 90),
          it('ex_remada-curvada-com-barra', 3, '8-12', 90),
          it('ex_crucifixo-reto-com-halteres', 3, '12-15', 60),
          it('ex_pullover-com-halter', 3, '12-15', 60),
        ],
      },
      {
        nome: 'Ombro e bracos A', cor: C.upper,
        itens: [
          it('ex_desenvolvimento-militar-com-barra', 4, '6-10', 120),
          it('ex_elevacao-lateral-com-halteres', 4, '12-20', 45),
          it('ex_crucifixo-inverso-com-halteres', 3, '15-20', 45),
          it('ex_rosca-direta-com-barra', 4, '8-12', 60),
          it('ex_triceps-testa-com-barra-w', 4, '8-12', 60),
          it('ex_rosca-martelo', 3, '10-12', 45),
          it('ex_triceps-pulley-com-corda', 3, '12-15', 45),
        ],
      },
      {
        nome: 'Pernas A', cor: C.legs,
        itens: [
          it('ex_agachamento-livre', 5, '6-10', 180),
          it('ex_leg-press-45', 4, '10-15', 120),
          it('ex_stiff-com-barra', 4, '8-12', 120),
          it('ex_mesa-flexora', 3, '12-15', 60),
          it('ex_panturrilha-em-pe-na-maquina', 5, '12-20', 45),
        ],
      },
      {
        nome: 'Peito e costas B', cor: C.push,
        itens: [
          it('ex_supino-inclinado-com-barra', 4, '8-12', 120),
          it('ex_puxada-com-triangulo', 4, '10-12', 90),
          it('ex_voador-peck-deck', 3, '12-15', 60),
          it('ex_remada-baixa-no-cabo', 3, '10-12', 90),
          it('ex_crossover-polia-baixa', 3, '12-15', 60),
          it('ex_remada-unilateral-com-halter', 3, '10-12', 60),
        ],
      },
      {
        nome: 'Ombro e bracos B', cor: C.upper,
        itens: [
          it('ex_desenvolvimento-com-halteres', 4, '10-12', 90),
          it('ex_elevacao-lateral-no-cabo', 4, '15-20', 45),
          it('ex_voador-inverso-na-maquina', 3, '15-20', 45),
          it('ex_rosca-scott', 4, '10-12', 60),
          it('ex_triceps-na-maquina', 4, '10-15', 60),
          it('ex_rosca-concentrada', 3, '12-15', 45),
          it('ex_mergulho-nas-paralelas', 3, '8-12', 60),
        ],
      },
      {
        nome: 'Pernas B', cor: C.legs,
        itens: [
          it('ex_agachamento-frontal', 4, '8-12', 150),
          it('ex_hack-squat', 4, '10-15', 120),
          it('ex_cadeira-extensora', 4, '12-20', 60),
          it('ex_cadeira-flexora-sentada', 4, '12-20', 60),
          it('ex_elevacao-pelvica-hip-thrust', 3, '10-12', 90),
          it('ex_panturrilha-sentado', 5, '15-20', 45),
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'forca-5x5',
    nome: 'Forca 5x5',
    apelido: 'StrongLifts / Starting Strength',
    nivel: 'iniciante',
    dias: 3,
    foco: 'Forca pura',
    resumo: 'Cinco exercicios, 5 series de 5. Subir carga toda semana e o programa inteiro.',
    porque:
      'O programa mais simples que existe e um dos que mais entrega pra quem esta comecando. '
      + 'So movimentos compostos, e a unica regra e adicionar 2,5 kg por treino enquanto conseguir. '
      + 'Constroi a base de forca que faz todo o resto render depois.',
    cuidado: 'Pouco volume pra braco e ombro. E um programa de forca, nao de estetica - use por alguns meses e migre.',
    sugestaoDias: [1, 3, 5],
    treinos: [
      {
        nome: 'Treino A', cor: C.full,
        descricao: 'Suba 2,5 kg no agachamento a cada treino enquanto fizer as 5x5 limpo.',
        itens: [
          it('ex_agachamento-livre', 5, '5', 180),
          it('ex_supino-reto-com-barra', 5, '5', 180),
          it('ex_remada-curvada-com-barra', 5, '5', 180),
        ],
      },
      {
        nome: 'Treino B', cor: C.full,
        descricao: 'O terra e serie unica de 5. Nao precisa de mais.',
        itens: [
          it('ex_agachamento-livre', 5, '5', 180),
          it('ex_desenvolvimento-militar-com-barra', 5, '5', 180),
          it('ex_levantamento-terra', 1, '5', 210, 'Serie unica pesada, apos aquecimento'),
        ],
      },
    ],
  },
]

export const NIVEIS = {
  iniciante: { nome: 'Iniciante', cor: '#4caf87' },
  intermediario: { nome: 'Intermediario', cor: '#c9a049' },
  avancado: { nome: 'Avancado', cor: '#c25f70' },
} as const

export const getPrograma = (id: string) => PROGRAMAS.find(p => p.id === id)
