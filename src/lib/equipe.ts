import { chamar } from './sync'
import type { Cartao } from './cartao'
import type { Exercicio, Sessao, Rotina, RegistroCorpo, RegistroDieta, PlanoRefeicao, Agua, Alimento, Perfil } from '../db/types'
import type { PacoteTreino, PacoteDieta } from './pacotes'

/**
 * Equipe: o treinador e os alunos dele. Conversa com /api/equipe
 * (servidor/equipe.js). O que o treinador ve do aluno sai do backup do aluno,
 * filtrado no servidor pelo que o aluno liberou - glicemia e saude nunca.
 */

export interface Permissoes { treinos: true; corpo: boolean; dieta: boolean }

export interface AlunoResumo {
  id: string
  entrouEm: string
  permissoes: Permissoes
  programaEm: string | null
  dietaEm: string | null
  cartao: Cartao | null
  atualizadoEm: string | null
}

export interface MinhaEquipe {
  id: string
  nome: string
  treinador: string
  codigo: string
  criadoEm: string
  alunos: AlunoResumo[]
}

export interface EquipeQueParticipo {
  nome: string
  treinador: string
  entrouEm: string
  permissoes: Permissoes
  programaEm: string | null
  dietaEm: string | null
}

export interface EstadoEquipe { minha: MinhaEquipe | null; participo: EquipeQueParticipo | null }

/** O que o servidor devolve de um aluno - so as partes liberadas vem preenchidas. */
export interface DadosAluno {
  perfil: Partial<Perfil>
  sessoes: Sessao[]
  rotinas: Rotina[]
  exercicios: Exercicio[]
  corpo?: RegistroCorpo[]
  dieta?: RegistroDieta[]
  planos?: PlanoRefeicao[]
  agua?: Agua[]
  alimentos?: Alimento[]
}

export interface DetalheAluno {
  aluno: { id: string; entrouEm: string; permissoes: Permissoes; programaEm: string | null; dietaEm: string | null }
  cartao: Cartao | null
  /** null = o aluno ainda nao sincronizou nada com a conta. */
  dados: DadosAluno | null
  sincronizadoEm: string | null
  programa: PacoteTreino | null
  dieta: PacoteDieta | null
}

export const estadoEquipe = async () =>
  (await chamar<EstadoEquipe>('/equipe')) ?? { minha: null, participo: null }

export const criarEquipe = (nome: string, treinador: string) =>
  chamar<{ minha: MinhaEquipe }>('/equipe', { method: 'POST', body: JSON.stringify({ nome, treinador }) })

export const editarEquipe = (mudanca: { nome?: string; treinador?: string; novoCodigo?: boolean }) =>
  chamar<{ minha: MinhaEquipe }>('/equipe', { method: 'PUT', body: JSON.stringify(mudanca) })

export const desfazerEquipe = () => chamar('/equipe', { method: 'DELETE' })

export const entrarNaEquipe = (codigo: string, permissoes: Omit<Permissoes, 'treinos'>) =>
  chamar<{ participo: EquipeQueParticipo }>('/equipe/entrar', {
    method: 'POST', body: JSON.stringify({ codigo, permissoes }),
  })

export const mudarPermissoes = (permissoes: Omit<Permissoes, 'treinos'>) =>
  chamar<{ permissoes: Permissoes }>('/equipe/permissoes', { method: 'PUT', body: JSON.stringify({ permissoes }) })

export const sairDaEquipe = () => chamar('/equipe/sair', { method: 'DELETE' })

export const lerAluno = (id: string) => chamar<DetalheAluno>(`/equipe/aluno?id=${encodeURIComponent(id)}`)

export const removerAluno = (id: string) =>
  chamar('/equipe/aluno', { method: 'DELETE', body: JSON.stringify({ id }) })

export const prescrever = (aluno: string, tipo: 'treino' | 'dieta', nome: string, conteudo: PacoteTreino | PacoteDieta) =>
  chamar('/equipe/prescricao', { method: 'PUT', body: JSON.stringify({ aluno, tipo, nome, conteudo }) })

/** Link que abre o app na tela de equipe com o codigo preenchido. */
export function linkDaEquipe(codigo: string) {
  return `${location.origin}${location.pathname}#/equipe?codigo=${encodeURIComponent(codigo)}`
}
