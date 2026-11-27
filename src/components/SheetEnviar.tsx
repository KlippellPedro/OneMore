import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet, Btn, Campo, Input } from './ui'
import { Icone } from './Icone'
import { useUI, vibrar } from '../state/ui'
import { listarAmigos, type Amigo } from '../lib/amigos'
import { enviarParaAmigos, type TipoEnvio } from '../lib/envios'
import type { PacoteTreino, PacoteDieta } from '../lib/pacotes'
import { pl } from '../lib/format'

/**
 * Manda um treino (ou dieta) pra um ou mais amigos. Quem recebe ve na tela de
 * Treino e escolhe se adiciona, guarda ou recusa - nada entra sozinho na conta
 * de ninguem. `children` e o espaco de cima, pra quem chama deixar escolher O
 * QUE mandar (semana inteira ou uma rotina).
 */
interface Props {
  aberto: boolean
  fechar: () => void
  titulo?: string
  tipo: TipoEnvio
  nomeInicial: string
  /** Monta o pacote na hora de mandar - assim vai o que esta valendo naquele instante. */
  montar: (nome: string) => Promise<PacoteTreino | PacoteDieta>
  children?: ReactNode
}

export function SheetEnviar(p: Props) {
  // o miolo so existe com a sheet aberta: cada abertura comeca do zero
  return (
    <Sheet aberto={p.aberto} fechar={p.fechar} titulo={p.titulo ?? 'Mandar pra amigo'}>
      {p.aberto && <Miolo {...p} />}
    </Sheet>
  )
}

function Miolo({ fechar, tipo, nomeInicial, montar, children }: Props) {
  const nav = useNavigate()
  const { toast } = useUI()
  const [amigos, setAmigos] = useState<Amigo[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [marcados, setMarcados] = useState<string[]>([])
  const [nome, setNome] = useState(nomeInicial)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let vivo = true
    listarAmigos()
      .then(r => { if (vivo) setAmigos(r?.amigos ?? []) })
      .catch(e => { if (vivo) setErro((e as Error).message) })
    return () => { vivo = false }
  }, [])

  const alternar = (id: string) =>
    setMarcados(m => (m.includes(id) ? m.filter(x => x !== id) : [...m, id]))

  async function enviar() {
    if (!marcados.length) return toast('Escolha pelo menos um amigo', 'erro')
    setEnviando(true)
    try {
      const n = nome.trim() || nomeInicial
      const r = await enviarParaAmigos(marcados, tipo, n, await montar(n))
      vibrar(20)
      toast(`Mandado pra ${pl(r?.enviados ?? marcados.length, 'amigo')}`, 'ok', 'Aparece na tela de Treino de quem recebeu')
      fechar()
    } catch (e) {
      toast('Não deu pra mandar', 'erro', (e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      {children}
      <Campo label="Nome que aparece pra quem recebe">
        <Input value={nome} maxLength={80} onChange={e => setNome(e.target.value)} />
      </Campo>

      <p className="text-[12px] font-medium text-muted mb-1.5">Pra quem</p>
      {erro ? (
        <p className="text-[12.5px] text-muted mb-4 leading-relaxed">
          {erro.includes('Entre') ? 'Mandar pra amigos precisa de conta.' : 'Sem conexão com o servidor agora.'}
        </p>
      ) : amigos == null ? (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 rounded-full border-2 border-line border-t-accent animate-spin" />
        </div>
      ) : amigos.length === 0 ? (
        <div className="mb-4">
          <p className="text-[12.5px] text-muted mb-3 leading-relaxed">
            Você ainda não tem amigos no app. Adicione alguém pelo código e volte aqui.
          </p>
          <Btn className="w-full" onClick={() => { fechar(); nav('/amigos') }}>Ir pra Amigos</Btn>
        </div>
      ) : (
        <div className="rounded-xl border border-line overflow-hidden mb-4">
          {amigos.map(a => {
            const marcado = marcados.includes(a.id)
            return (
              <button key={a.id} onClick={() => alternar(a.id)}
                className="w-full flex items-center gap-3 px-3.5 py-3 border-b border-line/40 last:border-0 text-left active:bg-surface-2">
                <span className={`w-5 h-5 shrink-0 rounded-md border flex items-center justify-center ${
                  marcado ? 'grad-accent border-transparent text-white' : 'border-line'}`}>
                  {marcado && <Icone nome="check" tamanho={14} traco={2.6} />}
                </span>
                <span className="flex-1 text-[14px] font-semibold truncate">{a.cartao?.nome ?? 'Amigo sem cartão'}</span>
              </button>
            )
          })}
        </div>
      )}

      <Btn variant="primary" size="lg" className="w-full" onClick={enviar}
        disabled={enviando || !marcados.length}>
        {marcados.length > 1 ? `Mandar pra ${marcados.length}` : 'Mandar'}
      </Btn>
    </>
  )
}
