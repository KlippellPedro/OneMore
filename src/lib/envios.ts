import { db, uid, salvarPerfil } from '../db'
import type { Rotina, SemanaSalva, DietaSalva, Exercicio } from '../db/types'
import { chamar } from './sync'
import { retratoDaSemana } from './semana'
import { retratoDoPlano } from './dietas'
import { restaurarSemana, trocarPlano } from './acoes'
import {
  pacoteDeTreino, pacoteDeDieta, lerPacoteTreino, lerPacoteDieta, rotinasParaAdicionar, comIdsNovos,
  type PacoteTreino, type PacoteDieta,
} from './pacotes'

/**
 * Treinos e dietas que chegam de outra conta (amigo ou treinador) e o que a
 * pessoa faz com eles. Nada aqui apaga treino: adicionar cria copias novas,
 * guardar vira semana/dieta salva, e usar o do treinador guarda antes a semana
 * (ou o cardapio) de agora como copia automatica - tem volta.
 */

export type TipoEnvio = 'treino' | 'dieta'

export interface Envio {
  id: string
  de: { id: string; nome: string }
  origem: 'amigo' | 'treinador'
  tipo: TipoEnvio
  nome: string
  conteudo: unknown
  criadoEm: string
}

export const listarRecebidos = async () => (await chamar<{ envios: Envio[] }>('/envios'))?.envios ?? []

export const enviarParaAmigos = (para: string[], tipo: TipoEnvio, nome: string, conteudo: PacoteTreino | PacoteDieta) =>
  chamar<{ enviados: number }>('/envios', { method: 'POST', body: JSON.stringify({ para, tipo, nome, conteudo }) })

/** Tira da caixa (usou ou recusou). */
export const resolverEnvio = (id: string) => chamar('/envios', { method: 'DELETE', body: JSON.stringify({ id }) })

/* ------------------------------------------------------------------ */
/* MONTAR O QUE VAI                                                    */
/* ------------------------------------------------------------------ */

/** A semana em uso agora, ou so algumas rotinas dela. */
export async function pacoteDaSemanaAtual(nome: string, soRotinas?: string[]): Promise<PacoteTreino> {
  const rotinas = await db.rotinas.toArray()
  const escolhidas = soRotinas ? rotinas.filter(r => soRotinas.includes(r.id)) : rotinas
  return pacoteDeTreino(nome, retratoDaSemana(escolhidas, await db.exercicios.toArray()))
}

/** O cardapio padrao de agora, com os alimentos criados que ele usa. */
export async function pacoteDoPlanoAtual(nome: string): Promise<PacoteDieta> {
  return pacoteDeDieta(nome, retratoDoPlano(await db.planos.toArray()), await db.alimentos.toArray())
}

/* ------------------------------------------------------------------ */
/* RECEBER                                                             */
/* ------------------------------------------------------------------ */

async function gravarExerciciosQueFaltam(exercicios: Exercicio[]) {
  const existentes = new Set((await db.exercicios.toCollection().primaryKeys()) as string[])
  const novos = exercicios.filter(e => !existentes.has(e.id))
  if (novos.length) await db.exercicios.bulkPut(novos.map(e => ({ ...e, custom: true, atualizadoEm: Date.now() })))
}

/** Treino de amigo: as rotinas entram como copias novas, do lado das que ja existem. */
export async function adicionarTreinoRecebido(conteudo: unknown): Promise<Rotina[]> {
  const lida = lerPacoteTreino(conteudo)
  const ativas = await db.rotinas.where('arquivada').equals(0).toArray()
  const novas = rotinasParaAdicionar(lida, ativas, Date.now(), uid)
  await db.transaction('rw', db.rotinas, db.exercicios, async () => {
    await gravarExerciciosQueFaltam(lida.exercicios)
    await db.rotinas.bulkPut(novas)
  })
  return novas
}

/** Guarda o treino recebido em Semanas salvas, sem mexer na semana em uso. */
export async function guardarTreinoRecebido(conteudo: unknown, nome: string, manterIds = false): Promise<SemanaSalva> {
  const lida = lerPacoteTreino(conteudo)
  const s = manterIds ? lida : comIdsNovos(lida, uid)
  const agora = Date.now()
  const semana: SemanaSalva = {
    id: uid(), nome: nome.slice(0, 80), rotinas: s.rotinas, exercicios: s.exercicios, criadoEm: agora, atualizadoEm: agora,
  }
  await db.semanas.put(semana)
  return semana
}

/**
 * Treino do treinador: vira a semana em uso (restaurarSemana guarda a de agora
 * como copia automatica antes). Os ids sao os do treinador de proposito: a
 * proxima versao que ele mandar substitui ESSAS rotinas, e o historico de
 * treino continua ligado a elas.
 */
export async function usarTreinoDoTreinador(conteudo: unknown, nome: string) {
  const lida = lerPacoteTreino(conteudo)
  return restaurarSemana({ ...lida, nome })
}

/**
 * Dieta recebida vira o cardapio em uso. O de agora vai pras dietas salvas
 * (copia automatica) e volta com um toque. Metas so mudam se vieram junto
 * (o treinador definiu) - e a tela avisa antes.
 */
export async function usarDietaRecebida(conteudo: unknown, quem: string): Promise<DietaSalva | null> {
  const lida = lerPacoteDieta(conteudo)
  const existentes = new Set((await db.alimentos.toCollection().primaryKeys()) as string[])
  const novos = lida.alimentos.filter(a => !existentes.has(a.id))
  if (novos.length) await db.alimentos.bulkPut(novos.map(a => ({ ...a, atualizadoEm: Date.now() })))
  const copia = await trocarPlano(lida.refeicoes, { nome: `Antes da dieta de ${quem}`, auto: 'carregar' })
  if (lida.metas) {
    await salvarPerfil({
      metaKcal: lida.metas.kcal, metaProt: lida.metas.prot, metaCarb: lida.metas.carb, metaGord: lida.metas.gord,
    })
  }
  return copia
}

/** Guarda a dieta recebida nas dietas salvas, sem trocar o cardapio de agora. */
export async function guardarDietaRecebida(conteudo: unknown, nome: string): Promise<DietaSalva> {
  const lida = lerPacoteDieta(conteudo)
  const existentes = new Set((await db.alimentos.toCollection().primaryKeys()) as string[])
  const novos = lida.alimentos.filter(a => !existentes.has(a.id))
  if (novos.length) await db.alimentos.bulkPut(novos.map(a => ({ ...a, atualizadoEm: Date.now() })))
  const agora = Date.now()
  const dieta: DietaSalva = { id: uid(), nome: nome.slice(0, 80), refeicoes: lida.refeicoes, criadoEm: agora, atualizadoEm: agora }
  await db.dietas.put(dieta)
  return dieta
}
