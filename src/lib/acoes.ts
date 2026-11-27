import { db, uid, hoje, getPerfil, salvarPerfil, apagarLinha, apagarLinhas } from '../db'
import { calcularMelhores, dobrarSessao, porExercicio, type SerieAnterior } from '../db/melhores'
import type {
  Rotina, Sessao, SerieLog, Alimento, MomentoGlicemia, EventoXP, SemanaSalva, RegistroDieta, RegistroGlicemia,
  DietaSalva, RefeicaoSalva,
} from '../db/types'
import type { Programa } from '../db/programas'
import {
  retratoDaSemana, mesmaSemana, automaticasDemais, planoDeRestauracao, paraArquivo,
  lerArquivoSemana, type ConteudoSemana,
} from './semana'
import { baixarJSON } from './arquivo'
import { repsIniciais } from './treino'
import { retratoDoPlano, mesmoCardapio } from './dietas'
import { darXP, reconstruirGamificacao, XP, type GanhoXP } from './xp'
import { macrosDe, totalDoDia, diaBatido, paraGramas } from './nutricao'
import { problemaNaGlicemia } from './glicemia'

/* ------------------------------------------------------------------ */
/* TREINO                                                              */
/* ------------------------------------------------------------------ */

/** Cria a sessao a partir de uma rotina, ja com as series planejadas. */
export async function iniciarSessao(rotina?: Rotina, nomeLivre?: string): Promise<string> {
  // so pode existir uma sessao aberta; a anterior vira lixo se estiver vazia
  const abertas = await db.sessoes.where('concluida').equals(0).toArray()
  for (const a of abertas) {
    if (a.series.every(s => !s.feito)) await apagarLinha('sessoes', a.id)
  }

  const series: SerieLog[] = []
  if (rotina) {
    for (const item of rotina.itens) {
      const anteriores = await ultimasSeries(item.exercicioId)
      for (let i = 1; i <= item.series; i++) {
        const ant = serieAnterior(anteriores, i - 1)
        series.push({
          exercicioId: item.exercicioId,
          serie: i,
          // primeira vez: o piso da faixa alvo, em vez de 0 e um "Preencha as repetições" por serie
          reps: ant?.reps ?? repsIniciais(item.repsAlvo),
          carga: ant?.carga ?? item.cargaAlvo ?? 0,
          feito: false,
        })
      }
    }
  }

  const id = uid()
  await db.sessoes.put({
    id,
    rotinaId: rotina?.id,
    nome: nomeLivre ?? rotina?.nome ?? 'Treino livre',
    inicio: Date.now(),
    series,
    concluida: 0,
    atualizadoEm: Date.now(),
  })
  return id
}

/**
 * Ultima carga usada num exercicio (pra ja vir preenchido na proxima).
 * Leitura por chave na tabela `melhores` - antes isso varria todo o historico.
 */
export async function ultimaCarga(exercicioId: string): Promise<{ carga: number; reps: number } | null> {
  const m = await db.melhores.get(exercicioId)
  return m ? { carga: m.ultimaCarga, reps: m.ultimaReps } : null
}

/**
 * As series da ultima vez que o exercicio foi treinado, na ordem. Vazio se
 * nunca foi. Linha antiga (sem `ultimaSeries`) cai na melhor serie, que e o
 * que existia antes - a v8 do banco refaz a tabela, isso e so rede de seguranca.
 */
export async function ultimasSeries(exercicioId: string): Promise<SerieAnterior[]> {
  const m = await db.melhores.get(exercicioId)
  if (!m) return []
  if (m.ultimaSeries?.length) return m.ultimaSeries
  return [{ carga: m.ultimaCarga, reps: m.ultimaReps }]
}

/**
 * O que pre-preencher na serie `indice` (base 0). Se hoje tem mais series do
 * que da ultima vez, as que sobram repetem a ultima serie feita.
 */
export function serieAnterior(anteriores: SerieAnterior[], indice: number): SerieAnterior | null {
  if (!anteriores.length) return null
  return anteriores[Math.min(indice, anteriores.length - 1)]
}

export interface Recorde { carga: number; reps: number; volume: number }

/**
 * Melhor marca historica de um exercicio.
 *
 * O treino em andamento nunca esta aqui: `melhores` so recebe sessao concluida.
 * Por isso quem esta no meio do treino (ou fechando ele) le a marca ANTERIOR,
 * que e exatamente o que a deteccao de recorde precisa.
 */
export async function recordeDe(exercicioId: string): Promise<Recorde> {
  const m = await db.melhores.get(exercicioId)
  if (!m) return { carga: 0, reps: 0, volume: 0 }
  return { carga: m.recordeCarga, reps: m.recordeReps, volume: m.recordeVolume }
}

/** Dobra uma sessao concluida no resumo por exercicio. */
async function registrarMelhores(s: Sessao) {
  for (const [exId, series] of porExercicio(s.series)) {
    const novo = dobrarSessao(await db.melhores.get(exId), exId, series, s.inicio)
    if (novo) await db.melhores.put(novo)
  }
}

/**
 * Refaz a tabela `melhores` do zero. Precisa rodar sempre que as sessoes forem
 * trocadas por fora do fluxo normal - importar backup, baixar da nuvem.
 */
export async function reconstruirMelhores(): Promise<number> {
  const sessoes = await db.sessoes.toArray()
  const linhas = calcularMelhores(sessoes)
  await db.melhores.clear()
  if (linhas.length) await db.melhores.bulkPut(linhas)
  return linhas.length
}

/**
 * `carga` = subiu o peso. `série` = mesma carga (ou menos) mas a melhor serie
 * rendeu mais trabalho que qualquer outra - na pratica, mais repeticoes no
 * mesmo peso. Sem esse segundo tipo, sair de 100x5 pra 100x12 nao era recorde
 * nenhum pro app.
 */
export type TipoPR = 'carga' | 'serie'

export interface PR {
  exercicioId: string
  tipo: TipoPR
  /** kg no tipo 'carga'; carga x reps da melhor serie no tipo 'serie'. */
  valor: number
  anterior: number
  /** So no tipo 'serie': o peso e as reps que formaram o numero. */
  carga?: number
  reps?: number
}

export interface ResumoSessao {
  series: number
  volume: number
  duracaoMs: number
  prs: PR[]
  ganho: GanhoXP
}

/** Fecha o treino: conta volume, detecta recordes e distribui XP. */
export async function concluirSessao(id: string): Promise<ResumoSessao | null> {
  const fim = Date.now()
  /**
   * Confere E marca como concluida na MESMA transacao. Ler, decidir e gravar em
   * passos soltos deixava duas chamadas quase juntas (dois toques no Confirmar
   * antes de o dialogo sumir) passarem ambas pela checagem `concluida` - e o
   * treino era pago duas vezes, com dois eventos de XP e recordes em dobro.
   * Transacoes rw na mesma tabela rodam uma depois da outra: a segunda ja ve
   * a sessao fechada e volta null.
   *
   * Marcar antes de detectar recorde nao muda nada: `recordeDe` le `melhores`,
   * que so recebe esta sessao em registrarMelhores, mais abaixo.
   */
  const s = await db.transaction('rw', db.sessoes, async () => {
    const atual = await db.sessoes.get(id)
    if (!atual || atual.concluida) return null
    // sem nenhuma serie de trabalho nao ha treino: fechar assim dava os 60 XP de
    // treino, contava pra conquista e cumpria a missao do dia sem nada feito -
    // abrir e finalizar em seguida virava fabrica de XP. A tela oferece descartar.
    if (!atual.series.some(g => g.feito && !g.aquecimento)) return null
    await db.sessoes.update(id, { concluida: 1, fim, atualizadoEm: fim })
    return atual
  })
  if (!s) return null

  const feitas = s.series.filter(g => g.feito && !g.aquecimento)
  const volume = feitas.reduce((t, g) => t + g.reps * g.carga, 0)

  // recordes: compara com o historico ANTES de marcar essa sessao como concluida
  const prs: PR[] = []
  for (const [exId, series] of porExercicio(feitas)) {
    const rec = await recordeDe(exId)
    // primeira vez no exercicio nunca e "recorde" - nao ha com o que comparar
    if (rec.carga <= 0) continue

    const melhorCarga = series.reduce((m, g) => Math.max(m, g.carga), 0)
    const melhorSerie = series.reduce((a, b) => (b.carga * b.reps > a.carga * a.reps ? b : a))
    const volume = melhorSerie.carga * melhorSerie.reps

    if (melhorCarga > rec.carga) {
      prs.push({ exercicioId: exId, tipo: 'carga', valor: melhorCarga, anterior: rec.carga })
    } else if (volume > rec.volume) {
      // um so por exercicio: quem subiu a carga quase sempre sobe o volume
      // junto, e contar os dois seria premiar a mesma coisa duas vezes
      prs.push({
        exercicioId: exId, tipo: 'serie', valor: volume, anterior: rec.volume,
        carga: melhorSerie.carga, reps: melhorSerie.reps,
      })
    }
  }

  const baseXP = XP.TREINO + feitas.length * XP.SERIE
    + prs.reduce((t, p) => t + (p.tipo === 'carga' ? XP.PR_CARGA : XP.PR_REPS), 0)

  await registrarMelhores({ ...s, concluida: 1, fim })

  for (const pr of prs) {
    await db.xp.put({
      id: uid(), ts: fim, tipo: 'pr', xp: 0, data: hoje(), sessaoId: id,
      motivo: pr.tipo === 'carga'
        ? `Recorde: ${pr.valor} kg`
        : `Melhor série: ${pr.carga} kg x ${pr.reps}`,
    })
  }

  const motivo = prs.length
    ? `${feitas.length} séries - ${prs.length} recorde${prs.length > 1 ? 's' : ''}!`
    : `${feitas.length} séries concluídas`
  const ganho = await darXP('treino', motivo, baseXP, id)
  await db.sessoes.update(id, { xpGanho: ganho.xp, atualizadoEm: Date.now() })

  return { series: feitas.length, volume, duracaoMs: fim - s.inicio, prs, ganho }
}

export async function descartarSessao(id: string) {
  await apagarLinha('sessoes', id)
}

/**
 * O evento de XP saiu deste treino? Desde que os eventos guardam `sessaoId`,
 * pela referencia. Os de antes so tem o instante: os de recorde sao gravados
 * com ts = fim do treino, e o de treino logo em seguida, no darXP - nenhum
 * outro evento 'treino'/'pr' cai a segundos do fim de um treino.
 */
function eventoDoTreino(e: EventoXP, s: Sessao) {
  if (e.sessaoId) return e.sessaoId === s.id
  if (e.tipo !== 'treino' && e.tipo !== 'pr') return false
  return s.fim != null && e.ts >= s.fim && e.ts - s.fim < 10_000
}

/**
 * Apaga um treino ja concluido - um treino registrado por engano, ou com tanto
 * numero errado que nao vale corrigir. O XP dele sai junto: senao apagar e
 * refazer o mesmo treino viraria fabrica de XP. Conquista ja desbloqueada fica.
 */
export async function apagarSessao(id: string) {
  const s = await db.sessoes.get(id)
  if (!s) return
  const eventos = (await db.xp.toArray()).filter(e => eventoDoTreino(e, s)).map(e => e.id)
  await apagarLinha('sessoes', id)
  await apagarLinhas('xp', eventos)
  // recorde, ultima carga, XP total e streak sao derivados: refaz a partir do
  // que sobrou, senao o recorde de um treino que nao existe mais continuava valendo
  await reconstruirMelhores()
  await reconstruirGamificacao()
}

/**
 * Grava as series corrigidas de um treino ja concluido. Sem isto, um 1000 kg
 * digitado no lugar de 100 virava recorde pra sempre - e o recorde e a
 * referencia de todo PR seguinte daquele exercicio. O XP fica como foi
 * ganho: ele paga as series feitas, e corrigir o numero nao muda quantas foram.
 */
export async function corrigirSessao(id: string, series: SerieLog[]) {
  await db.sessoes.update(id, { series, atualizadoEm: Date.now() })
  await reconstruirMelhores()
}

export interface RefsExercicio { rotinas: number; sessoesAbertas: number }

/** Onde um exercicio esta sendo usado agora (nao conta treino ja finalizado). */
export async function ondeUsam(exercicioId: string): Promise<RefsExercicio> {
  const rotinas = await db.rotinas.filter(
    r => r.itens.some(i => i.exercicioId === exercicioId),
  ).count()
  const sessoesAbertas = await db.sessoes.where('concluida').equals(0)
    .filter(s => s.series.some(g => g.exercicioId === exercicioId)).count()
  return { rotinas, sessoesAbertas }
}

/**
 * Apaga o exercicio do catalogo E de tudo que aponta pra ele agora: rotinas e
 * treino em andamento. Sem isso o item continuava nas rotinas como "Exercicio
 * removido" e so dava pra tirar um por um.
 *
 * Treino ja finalizado NAO e tocado de proposito - e o historico, e mexer nele
 * mudaria volume, recorde e XP que ja foram dados.
 */
export async function apagarExercicio(exercicioId: string) {
  const rotinas = await db.rotinas
    .filter(r => r.itens.some(i => i.exercicioId === exercicioId)).toArray()
  for (const r of rotinas) {
    await db.rotinas.update(r.id, {
      itens: r.itens.filter(i => i.exercicioId !== exercicioId),
      atualizadoEm: Date.now(),
    })
  }

  const abertas = await db.sessoes.where('concluida').equals(0)
    .filter(s => s.series.some(g => g.exercicioId === exercicioId)).toArray()
  for (const s of abertas) {
    await db.sessoes.update(s.id, {
      series: renumerarSeries(s.series.filter(g => g.exercicioId !== exercicioId)),
      atualizadoEm: Date.now(),
    })
  }

  await apagarLinha('exercicios', exercicioId)
  // melhores e derivado: nao sincroniza, nao leva lapide
  await db.melhores.delete(exercicioId)
  return { rotinas: rotinas.length, sessoesAbertas: abertas.length }
}

/** Renumera as series de cada exercicio a partir de 1. */
export function renumerarSeries(series: SerieLog[]): SerieLog[] {
  const cont: Record<string, number> = {}
  return series.map(g => {
    cont[g.exercicioId] = (cont[g.exercicioId] ?? 0) + 1
    return { ...g, serie: cont[g.exercicioId] }
  })
}

/** Volume total de uma sessao (usado em varios lugares). */
export function volumeSessao(s: Sessao) {
  return s.series
    .filter(g => g.feito && !g.aquecimento)
    .reduce((t, g) => t + g.reps * g.carga, 0)
}

/* ------------------------------------------------------------------ */
/* DIETA                                                               */
/* ------------------------------------------------------------------ */

export async function registrarAlimento(
  data: string, refeicao: string, alimento: Alimento, qtd: number, medida: string,
  /** Item do plano que esse lancamento veio substituir, se for uma troca. */
  noLugarDe?: string,
  /**
   * Gramas de verdade, quando quem chama ja sabe - item do plano, registro de
   * ontem. A medida caseira e aproximada ("3 unidades" de ovo = 150 g), mas o
   * plano foi calculado em cima de 160 g e mostra "(160 g)": recalcular pela
   * medida lancava outra quantidade e o diario nao batia com o plano.
   */
  gramasExatas?: number,
) {
  const gramas = gramasExatas != null && Number.isFinite(gramasExatas) && gramasExatas >= 0
    ? gramasExatas
    : paraGramas(alimento, qtd, medida)
  await db.dieta.put({
    id: uid(), data, refeicao, alimentoId: alimento.id,
    qtd, medida, gramas, noLugarDe, ts: Date.now(), atualizadoEm: Date.now(),
  })
  return macrosDe(alimento, gramas)
}

/** Tira um lancamento do diario e devolve ele - e o que o "Desfazer" grava de volta. */
export async function removerRegistro(id: string): Promise<RegistroDieta | undefined> {
  const antes = await db.dieta.get(id)
  await apagarLinha('dieta', id)
  return antes
}

/** Desfaz uma refeicao inteira - tira do diario tudo que foi lancado nela naquele dia. */
export async function removerRefeicaoDoDia(data: string, refeicao: string): Promise<RegistroDieta[]> {
  const linhas = await db.dieta.where('[data+refeicao]').equals([data, refeicao]).toArray()
  await apagarLinhas('dieta', linhas.map(l => l.id))
  return linhas
}

/* ------------------------------------------------------------------ */
/* PLANO ALIMENTAR                                                     */
/* ------------------------------------------------------------------ */

/**
 * Guarda o cardapio em uso como dieta salva automatica - o mesmo "save" das
 * semanas de treino, antes de algo que troca o plano inteiro. Plano vazio nao
 * gera copia; plano igual a uma dieta ja guardada devolve ESSA dieta (nao
 * precisa de outra copia, e o Desfazer volta pra ela do mesmo jeito).
 */
export async function guardarPlanoAtual(nome: string, auto: NonNullable<DietaSalva['auto']>): Promise<DietaSalva | null> {
  const refeicoes = retratoDoPlano(await db.planos.toArray())
  if (!refeicoes.some(r => r.itens.length)) return null
  const dietas = await db.dietas.toArray()
  const igual = dietas.find(d => mesmoCardapio(d.refeicoes, refeicoes))
  if (igual) return igual
  const agora = Date.now()
  const copia: DietaSalva = { id: uid(), nome, refeicoes, auto, criadoEm: agora, atualizadoEm: agora }
  await db.dietas.put(copia)
  await apagarLinhas('dietas', automaticasDemais([...dietas, copia]))
  return copia
}

/**
 * Troca o cardapio inteiro. Com `copiaAntes`, guarda o atual antes (ver
 * guardarPlanoAtual) e devolve a copia - pra quem chamou oferecer o Desfazer.
 * Esvazia com lapide, nunca com clear(): `planos` e sincronizada, e sem lapide
 * as refeicoes antigas voltavam do outro aparelho do lado das novas.
 */
export async function trocarPlano(
  refeicoes: (Omit<RefeicaoSalva, 'ordem'> & { ordem?: number })[],
  copiaAntes?: { nome: string; auto: NonNullable<DietaSalva['auto']> },
): Promise<DietaSalva | null> {
  const copia = copiaAntes ? await guardarPlanoAtual(copiaAntes.nome, copiaAntes.auto) : null
  await apagarLinhas('planos', (await db.planos.toCollection().primaryKeys()) as string[])
  const agora = Date.now()
  await db.planos.bulkPut(refeicoes.map((r, i) => ({
    id: uid(), nome: r.nome, horario: r.horario, itens: r.itens.map(it => ({ ...it })),
    ordem: r.ordem ?? i, atualizadoEm: agora,
  })))
  return copia
}

/**
 * Checa se o dia bateu as metas e concede o XP diario (uma vez por dia).
 * Chamado depois de qualquer alteracao no diario.
 */
export async function checarMetasDoDia(data: string): Promise<GanhoXP[]> {
  if (data !== hoje()) return []   // so premia o dia corrente
  const perfil = await getPerfil()
  const registros = await db.dieta.where('data').equals(data).toArray()
  if (!registros.length) return []

  const alimentos = await db.alimentos.toArray()
  const mapa = new Map(alimentos.map(a => [a.id, a]))
  const total = totalDoDia(registros, mapa)
  const { kcalOk, protOk } = diaBatido(total, perfil)

  const jaDados = await db.xp.where('data').equals(data).toArray()
  const tem = (t: string) => jaDados.some(e => e.tipo === t)

  const ganhos: GanhoXP[] = []

  // uma vez por refeicao lancada, nao por alimento: premia o habito de anotar
  // sem virar caca-niquel de quem lanca item por item
  const jaPremiadas = new Set(
    jaDados.filter(e => e.tipo === 'refeicao').map(e => e.motivo),
  )
  for (const nome of new Set(registros.map(r => r.refeicao))) {
    const motivo = `${nome} anotada`
    if (jaPremiadas.has(motivo)) continue
    ganhos.push(await darXP('refeicao', motivo, XP.REFEICAO))
  }

  if (protOk && !tem('proteina')) {
    ganhos.push(await darXP('proteina', 'Meta de proteína batida', XP.PROTEINA_OK))
  }
  if (kcalOk && protOk && !tem('dieta')) {
    ganhos.push(await darXP('dieta', 'Dia de dieta na régua', XP.DIETA_OK))
  }
  return ganhos
}

/* ------------------------------------------------------------------ */
/* AGUA E CORPO                                                        */
/* ------------------------------------------------------------------ */

export async function addAgua(ml: number, data = hoje()): Promise<GanhoXP | null> {
  const atual = await db.agua.get(data)
  const novo = Math.max(0, (atual?.ml ?? 0) + ml)
  await db.agua.put({ id: data, data, ml: novo, atualizadoEm: Date.now() })

  if (data !== hoje()) return null
  const perfil = await getPerfil()
  const jaDados = await db.xp.where('data').equals(data).toArray()
  if (novo >= perfil.metaAgua && !jaDados.some(e => e.tipo === 'agua')) {
    return darXP('agua', 'Meta de água batida', XP.AGUA_OK)
  }
  return null
}

export async function registrarCorpo(
  data: string, dados: { peso?: number; gorduraPct?: number; cintura?: number; braco?: number; peito?: number; coxa?: number; quadril?: number },
): Promise<GanhoXP | null> {
  const existente = await db.corpo.get(data)
  await db.corpo.put({ id: data, data, ...existente, ...dados, atualizadoEm: Date.now() })

  // o peso do perfil acompanha o ultimo registro (as metas dependem dele)
  if (dados.peso) {
    const perfil = await getPerfil()
    const ultimos = await db.corpo.orderBy('data').toArray()
    const maisRecente = ultimos.filter(r => r.peso).pop()
    if (maisRecente?.data === data && perfil.pesoKg !== dados.peso) {
      await salvarPerfil({ pesoKg: dados.peso })
    }
  }

  if (!existente && data === hoje()) {
    return darXP('peso', 'Medidas registradas', XP.PESO)
  }
  return null
}

/* ------------------------------------------------------------------ */
/* PROGRAMAS DE TREINO                                                 */
/* ------------------------------------------------------------------ */

/**
 * Transforma um programa da biblioteca em rotinas de verdade.
 * As rotinas antigas sao ARQUIVADAS, nunca apagadas - o historico de
 * treinos aponta pra elas e ficaria orfao.
 */
export async function aplicarPrograma(
  prog: Programa,
  opts: { substituir?: boolean; dias?: (number | null)[] } = {},
): Promise<Rotina[]> {
  if (opts.substituir) {
    // a semana montada a mao vai pros Arquivados - a copia deixa voltar ela inteira, com os dias
    await salvarSemana(`Antes de aplicar ${prog.nome}`, 'programa')
    const atuais = await db.rotinas.where('arquivada').equals(0).toArray()
    for (const r of atuais) {
      await db.rotinas.update(r.id, { arquivada: 1, atualizadoEm: Date.now() })
    }
  }

  const base = await db.rotinas.count()
  const dias = opts.dias ?? prog.sugestaoDias
  const rotinas: Rotina[] = prog.treinos.map((t, i) => {
    const d = dias[i]
    return {
      id: uid(),
      nome: t.nome,
      descricao: t.descricao,
      cor: t.cor,
      itens: t.itens,
      dias: d == null ? [] : [d],
      ordem: base + i,
      arquivada: 0,
      atualizadoEm: Date.now(),
    }
  })
  await db.rotinas.bulkPut(rotinas)
  return rotinas
}

/**
 * Traz de volta uma rotina arquivada (ver `aplicarPrograma`). Volta sem dia
 * fixo: o dia dela pode ter sido ocupado por outra rotina nesse meio tempo, e
 * cada dia so tem uma - quem escolhe e a pessoa, em "Semana".
 */
/**
 * "Apagar" uma rotina da lista: ela vai pros Arquivados, nao some. O historico
 * continua apontando pra ela e da pra voltar. Apagar de vez e outro passo, de
 * dentro dos Arquivados - quem ja perdeu treino uma vez nao precisa de mais
 * um botao que apaga sem volta logo do lado do "duplicar".
 */
export async function arquivarRotina(id: string): Promise<Rotina | null> {
  const r = await db.rotinas.get(id)
  if (!r) return null
  await db.rotinas.update(id, { arquivada: 1, atualizadoEm: Date.now() })
  return r
}

/** Desfaz o arquivarRotina: volta com os mesmos dias e no mesmo lugar da lista. */
export async function desarquivarRotina(r: Rotina) {
  await db.rotinas.update(r.id, { arquivada: 0, ordem: r.ordem, atualizadoEm: Date.now() })
  if (r.dias?.length) await definirDias(r.id, r.dias)
}

export async function restaurarRotina(id: string) {
  const ativas = await db.rotinas.where('arquivada').equals(0).count()
  await db.rotinas.update(id, {
    arquivada: 0, dias: [], ordem: ativas, atualizadoEm: Date.now(),
  })
}

/**
 * Coloca uma rotina num dia da semana. Cada dia tem no maximo uma rotina,
 * entao atribuir tira esse dia de quem estava nele antes.
 * rotinaId null = dia de descanso.
 */
export async function atribuirDia(dia: number, rotinaId: string | null) {
  const rotinas = await db.rotinas.where('arquivada').equals(0).toArray()
  for (const r of rotinas) {
    const tinha = r.dias?.includes(dia) ?? false
    const deveTer = r.id === rotinaId
    if (tinha === deveTer) continue
    const dias = deveTer
      ? [...(r.dias ?? []), dia].sort()
      : (r.dias ?? []).filter(d => d !== dia)
    await db.rotinas.update(r.id, { dias, atualizadoEm: Date.now() })
  }
}

/**
 * Os dias de uma rotina de uma vez (Ajustes do treino). Mesma regra do
 * atribuirDia: o dia que ela ganha sai de quem tinha. Gravar so os dias dela
 * deixava duas rotinas no mesmo dia, e a Semana mostrava uma e escondia a outra.
 */
export async function definirDias(rotinaId: string, dias: number[]) {
  const rotinas = await db.rotinas.where('arquivada').equals(0).toArray()
  const agora = Date.now()
  for (const r of rotinas) {
    if (r.id === rotinaId) continue
    const sobra = (r.dias ?? []).filter(d => !dias.includes(d))
    if (sobra.length !== (r.dias ?? []).length) {
      await db.rotinas.update(r.id, { dias: sobra, atualizadoEm: agora })
    }
  }
  await db.rotinas.update(rotinaId, { dias: [...new Set(dias)].sort(), atualizadoEm: agora })
}

/* ------------------------------------------------------------------ */
/* SEMANAS SALVAS                                                      */
/* ------------------------------------------------------------------ */

async function retratoAtual() {
  return retratoDaSemana(await db.rotinas.toArray(), await db.exercicios.toArray())
}

/**
 * Guarda a semana como ela esta agora. Com `auto`, e a copia de seguranca
 * tirada antes de trocar a semana inteira: nao sai se nao ha treino nenhum ou
 * se alguma semana guardada ja e igual a esta, e so as MAX_AUTOMATICAS mais
 * novas ficam. Devolve null quando nao salvou nada.
 */
export async function salvarSemana(nome: string, auto?: SemanaSalva['auto']): Promise<SemanaSalva | null> {
  const retrato = await retratoAtual()
  if (!retrato.rotinas.length) return null
  // copia automatica de uma semana que ja esta guardada nao protege nada a mais - so enche a lista
  if (auto && (await db.semanas.toArray()).some(s => mesmaSemana(s, retrato))) return null
  const agora = Date.now()
  const semana: SemanaSalva = { id: uid(), nome: nome.trim(), ...retrato, auto, criadoEm: agora, atualizadoEm: agora }
  await db.semanas.put(semana)
  if (auto) await apagarLinhas('semanas', automaticasDemais(await db.semanas.toArray()))
  return semana
}

/** Troca o conteudo de uma semana salva pela semana de agora. Copia automatica vira salva pela pessoa. */
export async function atualizarSemana(id: string) {
  await db.semanas.update(id, { ...(await retratoAtual()), auto: undefined, atualizadoEm: Date.now() })
}

/**
 * Volta a semana salva: as rotinas dela voltam como estavam (mesmos ids,
 * mesmos dias), as outras ativas vao pros Arquivados e o exercicio criado
 * pela pessoa que tiver sumido e recriado. Antes de mexer, guarda a semana
 * atual como copia automatica - restaurar a semana errada tem volta.
 */
export async function restaurarSemana(s: ConteudoSemana & { nome: string }) {
  await salvarSemana(`Antes de restaurar "${s.nome}"`, 'restaurar')
  const atuais = await db.rotinas.toArray()
  const existentes = new Set((await db.exercicios.toCollection().primaryKeys()) as string[])
  const agora = Date.now()
  const plano = planoDeRestauracao(atuais, s, existentes, agora)
  await db.transaction('rw', db.rotinas, db.exercicios, async () => {
    if (plano.exercicios.length) await db.exercicios.bulkPut(plano.exercicios)
    for (const id of plano.arquivar) {
      await db.rotinas.update(id, { arquivada: 1, atualizadoEm: agora })
    }
    await db.rotinas.bulkPut(plano.gravar)
  })
  return plano
}

export async function apagarSemana(id: string) {
  await apagarLinha('semanas', id)
}

/** Nome do arquivo, sem caractere que o sistema de arquivos recusa. */
function nomeDeArquivo(nome: string) {
  const limpo = nome.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40)
  return `onemore-semana-${limpo || hoje()}.json`
}

/** Baixa a semana salva (ou, sem argumento, a de agora) como arquivo pra guardar fora do app. */
export async function baixarSemana(s?: ConteudoSemana & { nome: string }) {
  const semana = s ?? { nome: `Semana de ${hoje().split('-').reverse().join('/')}`, ...(await retratoAtual()) }
  baixarJSON(nomeDeArquivo(s ? s.nome : hoje()), paraArquivo(semana.nome, semana))
}

/** Le um arquivo de semana (ou um backup completo) e guarda como semana salva. */
export async function importarSemana(arquivo: File): Promise<SemanaSalva> {
  const lida = lerArquivoSemana(JSON.parse(await arquivo.text()))
  const agora = Date.now()
  const semana: SemanaSalva = { id: uid(), ...lida, criadoEm: agora, atualizadoEm: agora }
  await db.semanas.put(semana)
  return semana
}

/* ------------------------------------------------------------------ */
/* GLICEMIA                                                            */
/* ------------------------------------------------------------------ */

/** Quantas medicoes por dia rendem XP. */
export const MAX_GLICEMIAS_COM_XP = 4

/**
 * Anota uma medicao de glicemia (e, se houver, a insulina aplicada).
 * O app registra e mostra - nao calcula dose, razao nem correcao.
 */
export async function registrarGlicemia(dados: {
  valor: number
  momento: MomentoGlicemia
  insulinaUnidades?: number
  insulinaTipo?: 'rapida' | 'basal'
  carboG?: number
  obs?: string
}): Promise<GanhoXP | null> {
  // a tela ja confere; isto e a ultima barreira pra nenhum caminho gravar lixo no historico
  const problema = problemaNaGlicemia(dados.valor,
    dados.insulinaUnidades != null ? String(dados.insulinaUnidades) : '',
    dados.carboG != null ? String(dados.carboG) : '')
  if (problema) throw new Error(`${problema.titulo}. ${problema.texto}`)
  const agora = Date.now()
  const data = hoje()
  await db.glicemia.put({
    id: uid(), data, ts: agora, atualizadoEm: agora, ...dados,
  })

  /**
   * XP so nas 4 primeiras do dia: recompensa o habito sem incentivar excesso.
   * Conta pelo LEDGER, nao pelas medicoes que existem: contando medicao,
   * registrar, apagar (ou Desfazer) e registrar de novo pagava outra vez a cada
   * volta - o contador nunca passava de 1.
   */
  const pagasHoje = await db.xp.where('data').equals(data).filter(e => e.tipo === 'glicemia').count()
  if (pagasHoje >= MAX_GLICEMIAS_COM_XP) return null
  return darXP('glicemia', 'Glicemia registrada', XP.GLICEMIA)
}

export async function removerGlicemia(id: string): Promise<RegistroGlicemia | undefined> {
  const antes = await db.glicemia.get(id)
  await apagarLinha('glicemia', id)
  return antes
}

/** Faixa de referencia mais usada pra tempo no alvo. Confirmar com o medico. */
export const FAIXA_ALVO = { min: 70, max: 180 }

export function classificarGlicemia(v: number) {
  if (v < 54) return { rotulo: 'Muito baixa', cor: 'var(--color-bad)' }
  if (v < FAIXA_ALVO.min) return { rotulo: 'Baixa', cor: 'var(--color-bad)' }
  if (v <= FAIXA_ALVO.max) return { rotulo: 'No alvo', cor: 'var(--color-good)' }
  if (v <= 250) return { rotulo: 'Alta', cor: 'var(--color-warn)' }
  return { rotulo: 'Muito alta', cor: 'var(--color-bad)' }
}

/**
 * Faixas no padrao internacional de "tempo no alvo" (consenso AGP/ATTD para
 * diabetes tipo 1: <54 muito baixa, 54-69 baixa, 70-180 alvo, 181-250 alta,
 * >250 muito alta). Aqui e "% das medições" - o app nao tem sensor continuo,
 * entao nao da pra falar em "% do tempo" de verdade, so por leitura.
 */
export const BANDAS_GLICEMIA = [
  { id: 'muito-baixa', teste: (v: number) => v < 54, rotulo: 'Muito baixa', legenda: '<54', cor: '#7f1d1d' },
  { id: 'baixa', teste: (v: number) => v >= 54 && v < FAIXA_ALVO.min, rotulo: 'Baixa', legenda: '54-69', cor: 'var(--color-bad)' },
  { id: 'alvo', teste: (v: number) => v >= FAIXA_ALVO.min && v <= FAIXA_ALVO.max, rotulo: 'No alvo', legenda: `${FAIXA_ALVO.min}-${FAIXA_ALVO.max}`, cor: 'var(--color-good)' },
  { id: 'alta', teste: (v: number) => v > FAIXA_ALVO.max && v <= 250, rotulo: 'Alta', legenda: '181-250', cor: 'var(--color-warn)' },
  { id: 'muito-alta', teste: (v: number) => v > 250, rotulo: 'Muito alta', legenda: '>250', cor: '#f97316' },
] as const

export interface EstatisticaGlicemia {
  total: number
  media: number
  desvio: number
  /** Coeficiente de variacao (%) - abaixo de 36% e considerado estavel. */
  cv: number
  minimo: number
  maximo: number
  bandas: { id: string; rotulo: string; legenda: string; cor: string; count: number; pct: number }[]
  pctAlvo: number
  porMomento: { momento: MomentoGlicemia; media: number; count: number }[]
}

/** Estatisticas do periodo, no formato que relatorios de glicemia (AGP, apps de CGM) costumam usar. */
export function estatisticasGlicemia(registros: { valor: number; momento: MomentoGlicemia }[]): EstatisticaGlicemia {
  const total = registros.length
  if (!total) {
    return {
      total: 0, media: 0, desvio: 0, cv: 0, minimo: 0, maximo: 0, pctAlvo: 0,
      bandas: BANDAS_GLICEMIA.map(b => ({ id: b.id, rotulo: b.rotulo, legenda: b.legenda, cor: b.cor, count: 0, pct: 0 })),
      porMomento: [],
    }
  }

  const valores = registros.map(r => r.valor)
  const media = valores.reduce((t, v) => t + v, 0) / total
  const variancia = valores.reduce((t, v) => t + (v - media) ** 2, 0) / total
  const desvio = Math.sqrt(variancia)

  const bandas = BANDAS_GLICEMIA.map(b => {
    const count = valores.filter(b.teste).length
    return { id: b.id, rotulo: b.rotulo, legenda: b.legenda, cor: b.cor, count, pct: count / total }
  })

  const porMomentoMapa = new Map<MomentoGlicemia, number[]>()
  for (const r of registros) {
    if (!porMomentoMapa.has(r.momento)) porMomentoMapa.set(r.momento, [])
    porMomentoMapa.get(r.momento)!.push(r.valor)
  }
  const porMomento = [...porMomentoMapa.entries()]
    .map(([momento, vs]) => ({ momento, media: vs.reduce((t, v) => t + v, 0) / vs.length, count: vs.length }))
    .sort((a, b) => b.count - a.count)

  return {
    total, media, desvio, cv: media ? (desvio / media) * 100 : 0,
    minimo: Math.min(...valores), maximo: Math.max(...valores),
    pctAlvo: bandas.find(b => b.id === 'alvo')!.pct,
    bandas, porMomento,
  }
}
