export type GrupoMuscular =
  | 'peito' | 'costas' | 'ombro' | 'biceps' | 'triceps' | 'antebraco'
  | 'quadriceps' | 'posterior' | 'gluteo' | 'panturrilha'
  | 'abdomen' | 'lombar' | 'cardio' | 'corpo-inteiro'

export type Equipamento =
  | 'barra' | 'halter' | 'maquina' | 'cabo' | 'peso-corporal'
  | 'kettlebell' | 'elastico' | 'anilha' | 'cardio' | 'outro'

export interface Exercicio {
  id: string
  nome: string
  grupo: GrupoMuscular
  gruposSecundarios?: GrupoMuscular[]
  equipamento: Equipamento
  /** Passo a passo da execucao. Curto, pra ler no meio da serie. */
  execucao: string[]
  /** Erros comuns - o que mais estraga o exercicio. */
  erros?: string[]
  /** Link (YouTube etc). O usuario pode colar o dele. */
  videoUrl?: string
  /** Imagem: data URL do proprio celular ou link. */
  imagemUrl?: string
  /** true = criado pelo usuario (nunca sobrescrito pelo seed). */
  custom?: boolean
  favorito?: boolean
  atualizadoEm: number
}

export interface ItemRotina {
  exercicioId: string
  series: number
  repsAlvo: string        // "8-12", "AMRAP", "30s"
  cargaAlvo?: number
  descansoSeg: number
  obs?: string
  /** Agrupa em bi-set/tri-set: mesmo id = mesmo bloco. */
  supersetId?: string
}

export interface Rotina {
  id: string
  nome: string            // "Treino A - Peito e Triceps"
  descricao?: string
  cor: string
  itens: ItemRotina[]
  /** Dias da semana sugeridos: 0=Dom ... 6=Sab */
  dias?: number[]
  ordem: number
  /**
   * 0/1 e nao boolean: e um indice, e o IndexedDB nao indexa boolean nem
   * undefined - a linha simplesmente ficaria de fora. Obrigatorio pelo mesmo
   * motivo: rotina sem o campo sumiria da lista. Ver `flag()` em db/index.ts.
   */
  arquivada: 0 | 1
  atualizadoEm: number
}

export interface SerieLog {
  exercicioId: string
  serie: number
  reps: number
  carga: number
  feito: boolean
  /** Serie de aquecimento nao conta pro volume nem pro PR. */
  aquecimento?: boolean
  rpe?: number
  ts?: number
}

export interface Sessao {
  id: string
  rotinaId?: string
  nome: string
  inicio: number
  fim?: number
  series: SerieLog[]
  notas?: string
  xpGanho?: number
  /** 0/1 porque e indice - ver a nota em Rotina.arquivada. */
  concluida: 0 | 1
  atualizadoEm: number
}

export interface Medida {
  nome: string            // "colher de sopa", "unidade media", "fatia"
  gramas: number
}

export interface Alimento {
  id: string
  nome: string
  marca?: string
  categoria: string
  /** Macros SEMPRE por 100 g (ou 100 ml). */
  kcal: number
  prot: number
  carb: number
  gord: number
  fibra?: number
  unidadeBase: 'g' | 'ml'
  medidas: Medida[]
  custom?: boolean
  favorito?: boolean
  atualizadoEm: number
}

export type NomeRefeicao = string

export interface ItemRefeicao {
  alimentoId: string
  /** Quantidade na medida escolhida (ex: 2 colheres). */
  qtd: number
  medida: string          // "g" | nome de uma Medida
  gramas: number          // sempre resolvido em gramas
}

export interface PlanoRefeicao {
  id: string
  nome: NomeRefeicao      // "Cafe da manha"
  horario: string         // "07:30"
  itens: ItemRefeicao[]
  ordem: number
  atualizadoEm: number
}

/** Um cardapio inteiro guardado com nome, pra trocar de dieta sem perder a anterior. */
export interface DietaSalva {
  id: string
  nome: string
  /** Snapshot das refeicoes do plano no momento em que foi salva. */
  refeicoes: { nome: NomeRefeicao; horario: string; itens: ItemRefeicao[]; ordem: number }[]
  criadoEm: number
  atualizadoEm: number
}

export interface RegistroDieta {
  id: string
  data: string            // YYYY-MM-DD
  refeicao: NomeRefeicao
  alimentoId: string
  qtd: number
  medida: string
  gramas: number
  /**
   * Id do alimento do plano que esse registro substituiu. Sem isso o item
   * trocado continuaria aparecendo como pendente na refeicao.
   */
  noLugarDe?: string
  ts: number
  atualizadoEm: number
}

export interface RegistroCorpo {
  id: string
  data: string            // YYYY-MM-DD
  peso?: number
  gorduraPct?: number
  cintura?: number
  braco?: number
  peito?: number
  coxa?: number
  quadril?: number
  atualizadoEm: number
}

export interface EventoXP {
  id: string
  ts: number
  tipo: string
  motivo: string
  xp: number
  data: string            // YYYY-MM-DD
}

/* ------------------------------------------------------------------ */
/* LEMBRETES                                                           */
/* ------------------------------------------------------------------ */

export type TipoLembrete = 'agua' | 'refeicao' | 'treino' | 'glicemia'

export interface ConfigLembretes {
  /** Chave geral: desliga tudo sem perder a configuracao de cada um. */
  ativo: boolean
  agua: { ativo: boolean; intervaloMin: number; inicio: string; fim: string }
  /** Usa os horarios do plano alimentar; so escolhe a antecedencia. */
  refeicoes: { ativo: boolean; antecedenciaMin: number }
  treino: { ativo: boolean; horario: string; dias: number[]; antecedenciaMin: number }
  glicemia: { ativo: boolean; horarios: string[] }
}

/**
 * Um aviso agendado. Fica numa tabela propria (nao entra no backup) porque e
 * coisa deste aparelho: o service worker le daqui pra avisar com o app fechado.
 */
export interface Lembrete {
  id: string
  tipo: TipoLembrete
  /** Quando deve tocar. */
  ts: number
  data: string            // YYYY-MM-DD do dia a que se refere
  titulo: string
  corpo: string
  /** Rota que abre ao tocar na notificacao. */
  rota: string
  /** Nome da refeicao, quando for lembrete de refeicao. */
  ref?: string
  /** Meta de agua do dia, pro service worker saber se ainda falta beber. */
  metaMl?: number
  disparadoEm?: number
}

export interface Perfil {
  id: 'me'
  nome: string
  sexo: 'M' | 'F'
  nascimento?: string
  /** Usada quando nao ha data de nascimento. */
  idade?: number
  alturaCm: number
  pesoKg: number
  atividade: 1.2 | 1.375 | 1.55 | 1.725 | 1.9
  objetivo: 'cutting' | 'manutencao' | 'bulking'
  metaKcal: number
  metaProt: number
  metaCarb: number
  metaGord: number
  metaAgua: number        // ml
  metaTreinosSemana: number
  /** Liga os recursos de glicemia e destaque de carboidrato. */
  diabetesTipo1?: boolean
  lembretes?: ConfigLembretes
  xp: number
  streak: number
  melhorStreak: number
  ultimoDiaAtivo?: string
  conquistas: string[]
  atualizadoEm: number
}

/**
 * Lapide de um registro apagado. Sem isso a sincronizacao por fusao traria de
 * volta tudo que voce apagou: o outro aparelho ainda tem a linha, e "existe de
 * um lado, nao existe do outro" e indistinguivel de "foi criado agora".
 */
export interface Apagado {
  id: string              // "tabela:chave", pra ser unico no banco todo
  tabela: string
  chave: string
  ts: number
}

export interface Agua {
  id: string              // data
  data: string
  ml: number
  atualizadoEm: number
}

/* ------------------------------------------------------------------ */
/* DIABETES                                                            */
/* ------------------------------------------------------------------ */

export type MomentoGlicemia =
  | 'jejum' | 'antes-refeicao' | 'depois-refeicao'
  | 'pre-treino' | 'durante-treino' | 'pos-treino'
  | 'antes-dormir' | 'madrugada' | 'hipo' | 'outro'

/**
 * Registro de glicemia. O app SO ANOTA e mostra - nunca calcula dose,
 * razao carbo/insulina nem fator de correcao. Isso e do medico.
 */
export interface RegistroGlicemia {
  id: string
  data: string            // YYYY-MM-DD
  ts: number
  valor: number           // mg/dL
  momento: MomentoGlicemia
  /** Insulina aplicada junto, se houve. Anotacao livre, sem sugestao. */
  insulinaUnidades?: number
  insulinaTipo?: 'rapida' | 'basal'
  /** Carboidrato da refeicao relacionada, em gramas. */
  carboG?: number
  obs?: string
  atualizadoEm: number
}
