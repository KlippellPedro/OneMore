/** Entrega um objeto como arquivo .json pra pessoa guardar (pasta de downloads, Drive, WhatsApp...). */
export function baixarJSON(nomeArquivo: string, conteudo: unknown) {
  const blob = new Blob([JSON.stringify(conteudo, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/**
 * Manda um texto pelo menu de compartilhar do celular (WhatsApp, Instagram...).
 * Sem esse menu (PC, navegador antigo), copia pra area de transferencia.
 * Fechar o menu sem escolher nada nao e erro - devolve 'cancelado'.
 */
export async function compartilharTexto(titulo: string, texto: string): Promise<'compartilhado' | 'copiado' | 'cancelado' | 'falhou'> {
  if (navigator.share) {
    try {
      await navigator.share({ title: titulo, text: texto })
      return 'compartilhado'
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelado'
    }
  }
  try {
    await navigator.clipboard.writeText(texto)
    return 'copiado'
  } catch {
    return 'falhou'
  }
}
