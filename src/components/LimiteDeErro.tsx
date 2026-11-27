import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Icone } from './Icone'

/**
 * Erro de renderizacao em qualquer tela derrubava o app INTEIRO numa tela
 * preta, sem botao nenhum - no meio do treino, sem saber se o que foi anotado
 * ficou salvo. Aqui o erro fica contido: a tela explica, os dados (que moram
 * no IndexedDB, nao na tela) continuam intactos e da pra voltar.
 *
 * O detalhe tecnico vai so pro console - pra quem usa, stack trace e ruido.
 */
export class LimiteDeErro extends Component<{ children: ReactNode }, { erro: Error | null }> {
  state: { erro: Error | null } = { erro: null }

  static getDerivedStateFromError(erro: Error) {
    return { erro }
  }

  componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('[tela] erro ao desenhar', erro, info.componentStack)
  }

  render() {
    if (!this.state.erro) return this.props.children
    // versao nova publicada com o app aberto: o pedaco que a tela pediu nao existe mais
    const desatualizado = /dynamically imported module|Importing a module script failed|Loading chunk/i
      .test(this.state.erro.message)
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    return (
      <div role="alert" className="min-h-[70vh] flex items-center justify-center p-8 text-center">
        <div className="max-w-[320px]">
          <div className="flex justify-center mb-4 text-warn"><Icone nome="alerta" tamanho={40} /></div>
          <p className="font-bold text-[16px] mb-2">
            {desatualizado ? (offline ? 'Sem internet pra abrir esta tela' : 'O app foi atualizado')
              : 'Algo deu errado nesta tela'}
          </p>
          <p className="text-[13px] text-muted leading-relaxed mb-5">
            {desatualizado
              ? offline
                ? 'Ela ainda não foi guardada neste aparelho. Conecte e recarregue - nada do que você anotou se perde.'
                : 'Recarregue pra abrir a versão nova. Nada do que você anotou se perde.'
              : 'Seus treinos e sua dieta continuam salvos neste aparelho. Tente de novo ou volte pro início.'}
          </p>
          <div className="flex flex-col gap-2">
            {!desatualizado && (
              <button onClick={() => this.setState({ erro: null })}
                className="h-11 rounded-xl grad-accent text-white font-bold text-sm">
                Tentar de novo
              </button>
            )}
            <button onClick={() => { location.hash = '#/'; location.reload() }}
              className={`h-11 rounded-xl text-sm font-semibold ${desatualizado
                ? 'grad-accent text-white font-bold' : 'bg-surface-2 border border-line text-txt'}`}>
              {desatualizado ? 'Recarregar' : 'Voltar ao início'}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
