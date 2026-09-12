/**
 * Identidade de cor por secao.
 *
 * O app inteiro era roxo: a mesma cor no titulo, na aba ativa, no botao e no
 * grafico de toda tela. Sem contraste entre secoes, tudo parecia a mesma
 * pagina e nada dizia "voce esta na dieta" sem voce ler o texto.
 *
 * As cores saem dos tokens que ja existiam e estavam subaproveitados - nao ha
 * paleta nova aqui, so uso do que a paleta ja tinha:
 *
 *   Treino     roxo     e o coracao do app, entao fica com a cor da marca
 *   Dieta      verde    comida
 *   Progresso  dourado  a mesma cor do XP, que e do que a tela fala
 *   Diario     rosa     sangue, sem ser o vermelho de erro
 *   Perfil     azul     frio e neutro, e o canto de ajuste
 *
 * A Home nao tem cor propria de proposito: ela mostra um pedaco de cada secao,
 * e cada card usa a cor da secao a que pertence. A variedade sai de graca.
 */
export interface Secao {
  id: string
  cor: string
}

export const SECOES: Record<string, Secao> = {
  treino: { id: 'treino', cor: 'var(--color-accent)' },
  dieta: { id: 'dieta', cor: 'var(--color-good)' },
  progresso: { id: 'progresso', cor: 'var(--color-xp)' },
  diario: { id: 'diario', cor: 'var(--color-bad)' },
  perfil: { id: 'perfil', cor: 'var(--color-accent-2)' },
  inicio: { id: 'inicio', cor: 'var(--color-accent)' },
}

/** Da a secao de um caminho. Rotas filhas herdam a da raiz (/dieta/plano -> dieta). */
export function secaoDe(caminho: string): Secao {
  const raiz = caminho.split('/')[1] ?? ''
  if (raiz.startsWith('treino') || raiz === 'exercicios' || raiz === 'sessao' || raiz === 'historico') {
    return SECOES.treino
  }
  if (raiz === 'dieta' || raiz === 'alimentos') return SECOES.dieta
  if (raiz === 'progresso') return SECOES.progresso
  if (raiz === 'diario') return SECOES.diario
  if (raiz === 'perfil' || raiz === 'lembretes') return SECOES.perfil
  return SECOES.inicio
}
