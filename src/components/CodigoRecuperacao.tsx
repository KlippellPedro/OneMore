import { Btn, Card } from './ui'
import { Icone } from './Icone'
import { useUI } from '../state/ui'

/**
 * Mostra o codigo de recuperacao. Aparece no cadastro, ao gerar um novo e
 * depois de redefinir a senha - sempre o mesmo componente, porque o recado tem
 * que ser identico nas tres situacoes.
 *
 * Este app nao manda e-mail, entao o codigo E a recuperacao: sem ele, senha
 * esquecida vira conta perdida. Por isso a tela e barulhenta de proposito e
 * exige um toque pra continuar, em vez de sumir sozinha.
 */
export function CodigoRecuperacao({ codigo, email, onPronto }: {
  codigo: string
  email?: string
  onPronto: () => void
}) {
  const { toast } = useUI()

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo)
      toast('Codigo copiado', 'ok')
    } catch {
      toast('Copie na mao', 'erro', 'O navegador nao deixou copiar sozinho')
    }
  }

  function baixar() {
    const texto =
      `OneMore - codigo de recuperacao\n\n`
      + (email ? `Conta: ${email}\n` : '')
      + `Codigo: ${codigo}\n\n`
      + `Guarde este arquivo. Sem este codigo, senha esquecida = conta perdida,\n`
      + `porque o OneMore nao envia e-mail de recuperacao.\n`
      + `Gerado em ${new Date().toLocaleString('pt-BR')}\n`
    const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'onemore-codigo-recuperacao.txt'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  return (
    <Card className="p-4 border-warn/40">
      <div className="flex items-center gap-2 mb-2 text-warn">
        <Icone nome="escudo" tamanho={16} />
        <h3 className="text-[11px] font-bold uppercase tracking-widest">
          Guarde este codigo agora
        </h3>
      </div>

      <p className="text-[12.5px] text-txt/85 leading-relaxed mb-3">
        Ele aparece <b>uma unica vez</b>. E com ele que voce troca a senha se
        esquecer - o OneMore nao manda e-mail de recuperacao. Sem o codigo, senha
        esquecida vira conta perdida.
      </p>

      <p className="text-center text-[19px] font-black tracking-[0.14em] tabular-nums
        py-3 mb-3 rounded-xl bg-bg border border-line select-all">
        {codigo}
      </p>

      <div className="flex gap-2 mb-3">
        <Btn className="flex-1" onClick={copiar}>Copiar</Btn>
        <Btn className="flex-1" onClick={baixar}>Baixar .txt</Btn>
      </div>

      <Btn variant="primary" size="lg" className="w-full" onClick={onPronto}>
        Anotei, pode continuar
      </Btn>
    </Card>
  )
}
