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
  anterior: '#c96a4a', posterior: '#5a8cbf',
}

/**
 * Aquecimento do Metodo Hibrido: antes da primeira serie valendo de cada
 * agrupamento, 3 series subindo a carga. Marque essas como aquecimento (A)
 * na sessao pra elas nao entrarem no volume nem virarem recorde.
 */
const AQUECER = 'Aquecimento antes: 50% x9, 75% x5, 90% x2. Marque como série A.'

/* ================================================================== */

export const PROGRAMAS: Programa[] = [
  /* ------------------------------------------------------------------ */
  {
    id: 'hibrido-5',
    nome: 'Metodo Hibrido',
    apelido: 'Treino do Hibrido - Edição 01',
    nivel: 'intermediario',
    dias: 5,
    foco: 'Força e hipertrofia',
    resumo: 'Cinco dias, 2 séries por exercício, a base toda entre 5 e 9 repetições.',
    porque:
      'E o oposto de um treino de volume: pouca série, mas cada uma perto da falha e com '
      + 'carga que cabe em 5 a 9 repetições. Duas séries bem feitas nessa faixa dao o '
      + 'estimulo de força e hipertrofia sem encher a semana de trabalho pra recuperar. '
      + 'Os cinco dias batem cada grupo duas vezes - push/pull/legs na primeira metade, '
      + 'anterior/posterior na segunda - que e a frequencia com mais evidencia a favor. '
      + 'Antes da primeira série de cada agrupamento entram 3 séries de aquecimento '
      + 'subindo a carga (50% x9, 75% x5, 90% x2), pra chegar na série valendo já pronto. '
      + 'Os exercícios marcados como "Extra" na observacao não existem na edição original '
      + 'e foram somados pra tapar buracos que a conta de volume denunciou. Panturrilha: '
      + 'em pe no Legs e sentada no Anterior - em pe pega o gastrocnemio, sentada pega o '
      + 'soleo, sao dois músculos e não dois nomes. Antebraço: punho no Pull e punho '
      + 'inverso no Posterior, pra nao treinar so o flexor num programa cheio de rosca. '
      + 'Face pull no Pull e no Posterior, que era o único grupo com zero série na semana. '
      + 'E no Push, que era o dia mais curto: um desenvolvimento, porque o dia de empurrar '
      + 'não tinha nenhum, e o tríceps testa, porque o tríceps levava 2 séries por semana '
      + 'contra 6 do bíceps - sendo que ele e dois tercos do braço. Os extras pequenos vao '
      + 'de 8 a 20 repetições: músculo pequeno e tendao curto respondem a tempo sob tensao, '
      + 'não a carga maxima.',
    cuidado:
      'Duas séries só funcionam se forem levadas perto da falha - se você parar com 3 '
      + 'repetições na reserva, o volume vira baixo demais e você não cresce. E mesmo com '
      + 'os extras a semana continua puxando mais do que empurrando (12 séries de costas '
      + 'contra 8 de peito, 6 de bíceps contra 4 de tríceps): se o seu objetivo e peito e '
      + 'braço, troque o pull around por mais uma série de empurrar.',
    sugestaoDias: [1, 2, 3, 5, 6],
    treinos: [
      {
        nome: 'Push (peito, ombro, tríceps)', cor: C.push,
        descricao: 'Empurrar. A elevação lateral vem primeiro de proposito: o ombro chega descansado.',
        itens: [
          it('ex_elevacao-lateral-com-halteres', 2, '5-9', 120, 'No metodo e com caneleira no punho'),
          it('ex_supino-inclinado-no-smith', 2, '5-9', 150, AQUECER),
          it('ex_desenvolvimento-com-halteres', 2, '5-9', 150, 'Extra: o Push original não tinha desenvolvimento nenhum'),
          it('ex_voador-peck-deck', 2, '5-9', 120),
          it('ex_triceps-testa-com-barra-w', 2, '8-12', 90, 'Extra: cotovelo acima da cabeca - e o único jeito de pegar a cabeca longa'),
          it('ex_triceps-pulley-com-barra', 2, '5-9', 120, AQUECER),
        ],
      },
      {
        nome: 'Pull (costas, bíceps)', cor: C.pull,
        descricao: 'Puxar. Toda repetição começa pela escapula, não pelo braço.',
        itens: [
          it('ex_remada-curvada-com-barra', 2, '5-9', 150, AQUECER),
          it('ex_puxada-com-triangulo', 2, '5-9', 150),
          it('ex_pulldown-com-bracos-estendidos', 2, '5-9', 120),
          it('ex_rosca-direta-com-barra', 2, '5-9', 120, AQUECER),
          it('ex_face-pull-no-cabo', 2, '15-20', 60, 'Extra: saúde do ombro. Carga leve, puxa na altura do rosto.'),
          it('ex_rosca-de-punho', 2, '12-20', 60, 'Extra: só o punho se move, antebraço apoiado'),
        ],
      },
      {
        nome: 'Legs (pernas e core)', cor: C.legs,
        descricao: 'Posterior e glúteo antes do agachamento: o joelho entra no Smith já aquecido.',
        itens: [
          it('ex_cadeira-flexora-sentada', 2, '5-9', 120, AQUECER),
          it('ex_elevacao-pelvica-hip-thrust', 2, '5-9', 150),
          it('ex_agachamento-no-smith', 2, '5-9', 180),
          it('ex_cadeira-extensora', 2, '5-9', 120),
          it('ex_panturrilha-em-pe-na-maquina', 2, '10-15', 60, 'Extra: 2s alongando embaixo, sem quicar'),
          it('ex_abdominal-na-polia-ajoelhado', 2, '5-9', 90),
        ],
      },
      {
        nome: 'Anterior (ombro, peito, quadríceps)', cor: C.anterior,
        descricao: 'Segunda passada na cadeia da frente, com exercícios diferentes dos do Push e do Legs.',
        itens: [
          it('ex_elevacao-lateral-no-cabo', 2, '5-9', 120, 'Em Y: uma polia em cada mao, cruzadas na frente'),
          it('ex_desenvolvimento-no-smith', 2, '5-9', 150, AQUECER),
          it('ex_crossover-polia-alta', 2, '5-9', 120),
          it('ex_supino-reto-com-halteres', 2, '5-9', 150),
          it('ex_agachamento-bulgaro', 2, '5-9', 120, 'Cada perna'),
          it('ex_cadeira-extensora', 2, '5-9', 120),
          it('ex_panturrilha-sentado', 2, '10-15', 60, 'Extra: joelho dobrado pega o soleo, o outro músculo'),
        ],
      },
      {
        nome: 'Posterior (costas, bíceps, isquiotibiais)', cor: C.posterior,
        descricao: 'Segunda passada na cadeia de tras, fechando a semana.',
        itens: [
          it('ex_remada-na-maquina', 2, '5-9', 150, AQUECER),
          it('ex_remada-baixa-no-cabo', 2, '5-9', 150),
          it('ex_rosca-martelo', 2, '5-9', 120),
          it('ex_pull-around-na-polia', 2, '5-9', 120, 'Cada lado'),
          it('ex_rosca-scott', 2, '5-9', 120),
          it('ex_mesa-flexora', 2, '5-9', 120),
          it('ex_face-pull-no-cabo', 2, '15-20', 60, 'Extra: segunda dose de deltoide posterior na semana'),
          it('ex_rosca-de-punho-inversa', 2, '12-20', 60, 'Extra: carga leve. Equilibra o punho contra tanta rosca.'),
        ],
      },
    ],
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'ppl-ul-5',
    nome: 'Push / Pull / Legs + Upper / Lower',
    apelido: 'PPL + UL',
    nivel: 'intermediario',
    dias: 5,
    foco: 'Hipertrofia',
    resumo: 'Cinco dias, cada músculo estimulado duas vezes por semana.',
    porque:
      'Cinco dias e onde o split de 3 (PPL) e o de 4 (Upper/Lower) se encontram. '
      + 'Você começa a semana com os três dias pesados e fecha com dois dias de volume, '
      + 'batendo cada grupo 2x - que e a frequencia com mais evidencia a favor pra hipertrofia. '
      + 'E o melhor uso possível de 5 dias.',
    cuidado: 'Exige comer e dormir de verdade. Com 5 dias mal recuperados você rende menos que com 3 bem feitos.',
    sugestaoDias: [1, 2, 3, 5, 6],
    treinos: [
      {
        nome: 'A - Push (peito, ombro, tríceps)', cor: C.push,
        descricao: 'Dia pesado de empurrar. Comece forte no supino, a carga cai nos acessorios.',
        itens: [
          it('ex_supino-reto-com-barra', 4, '6-8', 150, 'Série mais pesada da semana pro peito'),
          it('ex_supino-inclinado-com-halteres', 3, '8-12', 120),
          it('ex_desenvolvimento-militar-com-barra', 3, '6-10', 120),
          it('ex_crucifixo-inclinado-com-halteres', 3, '12-15', 60),
          it('ex_elevacao-lateral-com-halteres', 4, '12-20', 45, 'Peso leve, foco em sentir o deltoide'),
          it('ex_triceps-pulley-com-corda', 3, '10-15', 60),
          it('ex_triceps-testa-com-barra-w', 3, '8-12', 60),
        ],
      },
      {
        nome: 'B - Pull (costas, bíceps)', cor: C.pull,
        descricao: 'Dia pesado de puxar. Toda repetição começa pela escapula, não pelo braço.',
        itens: [
          it('ex_barra-fixa-pronada', 4, '6-10', 150, 'Se sobrar fácil, adicione peso'),
          it('ex_remada-curvada-com-barra', 4, '6-10', 150),
          it('ex_puxada-frontal-na-polia', 3, '10-12', 90),
          it('ex_remada-baixa-no-cabo', 3, '10-12', 90),
          it('ex_face-pull-no-cabo', 3, '15-20', 45, 'Saúde do ombro. Não pule.'),
          it('ex_rosca-direta-com-barra', 3, '8-12', 60),
          it('ex_rosca-martelo', 3, '10-12', 60),
        ],
      },
      {
        nome: 'C - Legs (pernas completo)', cor: C.legs,
        descricao: 'O treino que a maioria pula. Não pule.',
        itens: [
          it('ex_agachamento-livre', 4, '5-8', 180, 'Aqueca com 2 séries leves antes'),
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
        descricao: 'Segunda passada no superior. Carga menor, mais repetição, mais sangue no músculo.',
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
        descricao: 'Segunda passada nas pernas, com mais glúteo e posterior.',
        itens: [
          it('ex_agachamento-frontal', 3, '8-12', 150),
          it('ex_elevacao-pelvica-hip-thrust', 4, '8-12', 120),
          it('ex_agachamento-bulgaro', 3, '10-12', 90, 'Cada perna'),
          it('ex_cadeira-flexora-sentada', 3, '12-15', 60),
          it('ex_leg-press-45', 3, '15-20', 90, 'Pes altos na plataforma, foco posterior/glúteo'),
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
    resumo: 'Dois dias sem equipamento, pra fechar a semana sem atrapalhar a recuperação.',
    porque:
      'Serve pra somar movimento e trabalhar o core sem cansar as pernas nem os ombros '
      + 'antes do próximo treino pesado. Cardio de baixa intensidade ainda ajuda a recuperação '
      + 'em vez de atrapalhar. Encaixa depois de qualquer programa de academia.',
    sugestaoDias: [4, 0],
    treinos: [
      {
        nome: 'Casa 1 - Cardio e core', cor: C.casa, emCasa: true,
        descricao: 'Circuito curto. Faca os exercícios em sequência, descanse 60s e repita.',
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
    foco: 'Base e força',
    resumo: 'Corpo inteiro em cada treino, três vezes por semana.',
    porque:
      'Pra quem está comecando ou voltando, e imbativel: cada músculo recebe estimulo 3x por semana '
      + 'e você pratica os movimentos principais com mais frequencia - e tecnica se constroi com repetição. '
      + 'Três dias também e fácil de manter quando a rotina aperta.',
    cuidado: 'Depois de uns 6 meses o volume por sessão vira o limite. Ai vale migrar pra Upper/Lower.',
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
    foco: 'Hipertrofia e força',
    resumo: 'Superior e inferior, duas vezes cada por semana.',
    porque:
      'O melhor custo-beneficio pra maioria das pessoas. Frequencia 2x por músculo, '
      + 'volume dividido em sessões que cabem em 1 hora, e ainda sobram 3 dias de folga. '
      + 'Se você só consegue 4 dias, comece por aqui.',
    sugestaoDias: [1, 2, 4, 5],
    treinos: [
      {
        nome: 'Upper A (força)', cor: C.upper,
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
        nome: 'Lower A (força)', cor: C.lower,
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
      'Agrupa os músculos que trabalham juntos, entao nada e treinado duas vezes por acidente. '
      + 'Rodando 2x na semana você chega em volume alto sem sessão gigante. '
      + 'E o padrão da academia hoje por um motivo: funciona e e fácil de entender.',
    cuidado: 'Seis dias e muita coisa. Se você falta 2 dias por semana, o de 4 dias te da mais resultado.',
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
    resumo: 'O PPL classico em três dias, uma volta por semana.',
    porque:
      'Mesma logica do PPL de 6, mas cabe em três dias. Cada sessão e mais longa e cada músculo '
      + 'só e treinado 1x por semana, entao rende menos que o Full Body de 3 dias pra iniciante - '
      + 'mas muita gente prefere pela divisao mais clara.',
    sugestaoDias: [1, 3, 5],
    treinos: [
      {
        nome: 'Push (peito, ombro, tríceps)', cor: C.push,
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
        nome: 'Pull (costas, bíceps)', cor: C.pull,
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
    foco: 'Força e hipertrofia',
    resumo: 'Dois dias de força pesada e dois de volume, dividido em superior e inferior.',
    porque:
      'Resolve a briga entre ficar forte e ficar grande: os dois primeiros dias sao de carga baixa '
      + 'em repetição (3-5), os dois últimos de volume (8-15). Você puxa a força nos basicos e '
      + 'constroi tamanho nos acessorios, sem escolher um dos dois.',
    sugestaoDias: [1, 2, 4, 5],
    treinos: [
      {
        nome: 'Upper Power', cor: C.upper,
        descricao: 'Carga pesada, 3 a 5 repetições. Descanso longo e obrigatório.',
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
        descricao: 'Carga menor, 8 a 15 repetições, descanso curto.',
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
      'Todo o volume de um músculo cai num dia só, entao da pra atacar de varios angulos e sentir '
      + 'muito o treino. E o split mais fácil de seguir e o mais divertido pra quem gosta de treinar. '
      + 'A frequencia de 1x por semana rende um pouco menos que 2x, mas volume alto compensa boa parte.',
    cuidado: 'Faltou um dia, o músculo daquele dia fica 2 semanas sem estimulo. Exige presenca.',
    sugestaoDias: [1, 2, 3, 4, 5],
    treinos: [
      {
        nome: 'A - Peito e tríceps', cor: C.push,
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
        nome: 'B - Costas e bíceps', cor: C.pull,
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
        nome: 'E - Braços e abdomen', cor: C.extra,
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
    resumo: 'Peito+costas, ombro+braço, pernas - duas voltas na semana.',
    porque:
      'Junta músculos antagonistas no mesmo dia (peito com costas, bíceps com tríceps), '
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
        nome: 'Ombro e braços A', cor: C.upper,
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
        nome: 'Ombro e braços B', cor: C.upper,
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
    nome: 'Força 5x5',
    apelido: 'StrongLifts / Starting Strength',
    nivel: 'iniciante',
    dias: 3,
    foco: 'Força pura',
    resumo: 'Cinco exercícios, 5 séries de 5. Subir carga toda semana e o programa inteiro.',
    porque:
      'O programa mais simples que existe e um dos que mais entrega pra quem está comecando. '
      + 'So movimentos compostos, e a única regra e adicionar 2,5 kg por treino enquanto conseguir. '
      + 'Constroi a base de força que faz todo o resto render depois.',
    cuidado: 'Pouco volume pra braço e ombro. E um programa de força, não de estetica - use por alguns meses e migre.',
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
        descricao: 'O terra e série única de 5. Não precisa de mais.',
        itens: [
          it('ex_agachamento-livre', 5, '5', 180),
          it('ex_desenvolvimento-militar-com-barra', 5, '5', 180),
          it('ex_levantamento-terra', 1, '5', 210, 'Série única pesada, após aquecimento'),
        ],
      },
    ],
  },
]

export const NIVEIS = {
  iniciante: { nome: 'Iniciante', cor: '#4caf87' },
  intermediario: { nome: 'Intermediário', cor: '#c9a049' },
  avancado: { nome: 'Avançado', cor: '#c25f70' },
} as const

export const getPrograma = (id: string) => PROGRAMAS.find(p => p.id === id)
