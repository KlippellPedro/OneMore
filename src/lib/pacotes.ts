import type { Alimento, ItemRefeicao, Medida, RefeicaoSalva, Rotina } from '../db/types'
// com .ts: o node --test importa este arquivo direto, e sem extensao ele nao acha o vizinho
import { lerArquivoSemana, paraArquivo, type ArquivoSemana, type ConteudoSemana, type SemanaLida } from './semana.ts'

/**
 * Pacote: o treino ou a dieta que viaja de uma conta pra outra (amigo, ou
 * treinador pro aluno). O de treino e EXATAMENTE o arquivo de semana que ja
 * existia (lib/semana.ts) - mesmo formato, mesma validacao campo a campo. O de
 * dieta e o cardapio com os alimentos que a pessoa criou e, se o treinador
 * mandou, as metas.
 *
 * Tudo aqui e puro, pra testar sem Dexie (pacotes.test.mjs). Quem grava e
 * lib/envios.ts.
 */

/* ------------------------------------------------------------------ */
/* TREINO                                                              */
/* ------------------------------------------------------------------ */

export type PacoteTreino = ArquivoSemana

export const pacoteDeTreino = (nome: string, s: ConteudoSemana, agora = new Date()): PacoteTreino =>
  paraArquivo(nome, s, agora)

/** Le e revalida um treino recebido. Joga erro com mensagem legivel se nao prestar. */
export const lerPacoteTreino = (json: unknown): SemanaLida => lerArquivoSemana(json)

/**
 * Rotinas recebidas de um AMIGO viram copias novas: ids novos, ativas, no fim
 * da lista e so nos dias que estao livres. Assim a pessoa edita o que quiser
 * sem mexer em nada que ja tinha, e receber o mesmo treino de novo nao
 * sobrescreve a copia que ela ja ajustou.
 */
export function rotinasParaAdicionar(
  lida: Pick<SemanaLida, 'rotinas'>, ativas: Pick<Rotina, 'dias' | 'ordem'>[], agora: number, novoId: () => string,
): Rotina[] {
  const ocupados = new Set(ativas.flatMap(r => r.dias ?? []))
  const base = ativas.reduce((m, r) => Math.max(m, r.ordem + 1), 0)
  return [...lida.rotinas].sort((a, b) => a.ordem - b.ordem).map((r, i) => {
    const dias = (r.dias ?? []).filter(d => !ocupados.has(d))
    dias.forEach(d => ocupados.add(d))
    const nova: Rotina = {
      id: novoId(), nome: r.nome, cor: r.cor, itens: r.itens.map(it => ({ ...it })),
      dias, ordem: base + i, arquivada: 0, atualizadoEm: agora,
    }
    if (r.descricao) nova.descricao = r.descricao
    return nova
  })
}

/** Mesma semana, com ids novos nas rotinas - pra guardar o treino de um amigo como semana salva. */
export function comIdsNovos<T extends Pick<SemanaLida, 'rotinas'>>(s: T, novoId: () => string): T {
  return { ...s, rotinas: s.rotinas.map(r => ({ ...r, id: novoId() })) }
}

/* ------------------------------------------------------------------ */
/* DIETA                                                               */
/* ------------------------------------------------------------------ */

export interface MetasDieta { kcal: number; prot: number; carb: number; gord: number }

export interface PacoteDieta {
  app: 'onemore'
  tipo: 'dieta'
  versao: 1
  criadoEm: string
  nome: string
  refeicoes: RefeicaoSalva[]
  /** Alimentos criados por quem mandou e que o cardapio usa - sem eles, quem recebe veria "alimento removido". */
  alimentos: Alimento[]
  metas?: MetasDieta
}

export interface DietaLida { nome: string; refeicoes: RefeicaoSalva[]; alimentos: Alimento[]; metas?: MetasDieta }

export function pacoteDeDieta(
  nome: string, refeicoes: RefeicaoSalva[], alimentos: Alimento[], metas?: MetasDieta, agora = new Date(),
): PacoteDieta {
  const usados = new Set(refeicoes.flatMap(r => r.itens.map(i => i.alimentoId)))
  const p: PacoteDieta = {
    app: 'onemore', tipo: 'dieta', versao: 1, criadoEm: agora.toISOString(), nome,
    refeicoes: refeicoes.map((r, i) => ({ nome: r.nome, horario: r.horario, ordem: i, itens: r.itens.map(it => ({ ...it })) })),
    alimentos: alimentos.filter(a => a.custom && usados.has(a.id)).map(a => ({ ...a, favorito: undefined })),
  }
  if (metas) p.metas = { ...metas }
  return p
}

type Bruto = Record<string, unknown>
const obj = (v: unknown): v is Bruto => !!v && typeof v === 'object' && !Array.isArray(v)
const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
const numero = (v: unknown, min: number, max: number) =>
  (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined)

function lerItem(v: unknown): ItemRefeicao | null {
  if (!obj(v)) return null
  const alimentoId = texto(v.alimentoId, 120)
  const gramas = numero(v.gramas, 0, 5000)
  if (!alimentoId || gramas == null) return null
  return {
    alimentoId,
    qtd: numero(v.qtd, 0, 5000) ?? gramas,
    medida: texto(v.medida, 60) ?? 'g',
    gramas,
  }
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/

function lerAlimento(v: unknown): Alimento | null {
  if (!obj(v)) return null
  const id = texto(v.id, 120)
  const nome = texto(v.nome, 120)
  if (!id || !nome) return null
  const macro = (k: string) => numero(v[k], 0, 1000) ?? 0
  const medidas: Medida[] = Array.isArray(v.medidas)
    ? v.medidas.filter(obj).map(m => ({ nome: texto(m.nome, 60) ?? '', gramas: numero(m.gramas, 0, 5000) ?? 0 }))
      .filter(m => m.nome && m.gramas > 0).slice(0, 20)
    : []
  const a: Alimento = {
    id, nome, custom: true,
    categoria: texto(v.categoria, 60) ?? 'Outros',
    kcal: macro('kcal'), prot: macro('prot'), carb: macro('carb'), gord: macro('gord'),
    unidadeBase: v.unidadeBase === 'ml' ? 'ml' : 'g',
    medidas,
    atualizadoEm: numero(v.atualizadoEm, 0, Number.MAX_SAFE_INTEGER) ?? 0,
  }
  const marca = texto(v.marca, 80)
  if (marca) a.marca = marca
  const fibra = numero(v.fibra, 0, 1000)
  if (fibra != null) a.fibra = fibra
  const sodio = numero(v.sodio, 0, 100000)
  if (sodio != null) a.sodio = sodio
  return a
}

/**
 * Le e revalida uma dieta recebida, campo a campo: veio de outra conta, talvez
 * de outra versao do app. Item sem alimento ou com numero estranho cai;
 * refeicao vazia continua (o horario dela tambem e plano).
 */
export function lerPacoteDieta(json: unknown): DietaLida {
  if (!obj(json) || json.app !== 'onemore' || json.tipo !== 'dieta') throw new Error('Isso não é uma dieta do OneMore.')
  const refeicoes = (Array.isArray(json.refeicoes) ? json.refeicoes : []).filter(obj).slice(0, 12)
    .map((r, i): RefeicaoSalva => ({
      nome: texto(r.nome, 60) ?? `Refeição ${i + 1}`,
      horario: typeof r.horario === 'string' && HORA.test(r.horario) ? r.horario : '12:00',
      ordem: i,
      itens: (Array.isArray(r.itens) ? r.itens : []).map(lerItem).filter((x): x is ItemRefeicao => !!x).slice(0, 40),
    }))
  if (!refeicoes.length) throw new Error('Essa dieta não tem nenhuma refeição.')
  const usados = new Set(refeicoes.flatMap(r => r.itens.map(i => i.alimentoId)))
  const alimentos = (Array.isArray(json.alimentos) ? json.alimentos : []).map(lerAlimento)
    .filter((a): a is Alimento => !!a && usados.has(a.id))
  const lida: DietaLida = { nome: texto(json.nome, 80) ?? 'Dieta recebida', refeicoes, alimentos }
  if (obj(json.metas)) {
    // meta fora de 800-8000 kcal e erro de digitacao, nao meta: nao entra (cortar viraria uma meta que ninguem pediu)
    const kcal = json.metas.kcal
    if (typeof kcal === 'number' && kcal >= 800 && kcal <= 8000) {
      lida.metas = {
        kcal: Math.round(kcal),
        prot: Math.round(numero(json.metas.prot, 0, 600) ?? 0),
        carb: Math.round(numero(json.metas.carb, 0, 1200) ?? 0),
        gord: Math.round(numero(json.metas.gord, 0, 400) ?? 0),
      }
    }
  }
  return lida
}
