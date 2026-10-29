import { usePodeInstalar, instalar, ehIOS, instalado } from '../lib/instalar'
import { useUI } from '../state/ui'
import { Card, Btn } from './ui'
import { Icone } from './Icone'

/**
 * Convite pra instalar. Some sozinho quando ja esta instalado ou quando o
 * navegador nao tem como instalar (desktop sem suporte, por exemplo).
 *
 * `motivo` e a frase de por que instalar AQUI - na tela de lembretes e
 * "receber com o app fechado", que e o que a pessoa foi buscar la.
 */
export function CardInstalar({ motivo, className = '' }: { motivo: string; className?: string }) {
  const pode = usePodeInstalar()
  const { toast } = useUI()

  if (instalado()) return null
  const ios = ehIOS()
  if (!pode && !ios) return null

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 shrink-0 rounded-xl grad-accent flex items-center justify-center text-white">
          <Icone nome="casa" tamanho={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold">Instale o OneMore no celular</p>
          <p className="text-[12px] text-muted leading-relaxed mt-1">{motivo}</p>
          {ios ? (
            <ol className="text-[12px] text-muted leading-relaxed mt-2 space-y-0.5 list-decimal pl-4">
              <li>No Safari, toque em <b className="text-txt">Compartilhar</b> (o quadrado com a seta pra cima)</li>
              <li>Escolha <b className="text-txt">Adicionar à Tela de Início</b></li>
              <li>Abra o OneMore pelo ícone novo</li>
            </ol>
          ) : (
            <Btn variant="primary" size="sm" className="mt-3" onClick={async () => {
              if (await instalar()) toast('Instalado', 'ok', 'Abra pelo ícone na tela de início')
            }}>Instalar</Btn>
          )}
        </div>
      </div>
    </Card>
  )
}
