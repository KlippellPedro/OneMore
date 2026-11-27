import { useState } from 'react'
import { baixarBackup, comecarLimpoNaConta, juntarNaConta, type ResultadoSync } from '../lib/sync'
import { Btn, Card } from './ui'
import { Icone } from './Icone'
import { useUI } from '../state/ui'

/**
 * Aparece quando a conta que acabou de entrar nao e a dona dos dados deste
 * aparelho (ver donoDosDados em lib/sync.ts) - o celular ou o PC compartilhado
 * em que outra pessoa usou o app e saiu. Sem esta pergunta, a primeira
 * sincronizacao levava os treinos, a dieta, o peso e a glicemia da outra conta
 * pra dentro desta.
 *
 * Nada acontece sem escolha: a sincronizacao fica parada ate a pessoa decidir.
 */
export function ContaDiferente({ dono, conta, onFeito, onSair }: {
  /** E-mail da conta de quem sao os dados deste aparelho. */
  dono: string
  /** E-mail da conta que acabou de entrar. */
  conta: string
  onFeito: (r: ResultadoSync, escolha: 'limpo' | 'juntar') => void
  /** Desistir: sai da conta nova e deixa tudo como estava. */
  onSair: () => void
}) {
  const { toast } = useUI()
  const [ocupado, setOcupado] = useState<null | 'limpo' | 'juntar' | 'backup'>(null)

  async function fazer(qual: 'limpo' | 'juntar') {
    if (ocupado) return
    setOcupado(qual)
    try {
      onFeito(qual === 'limpo' ? await comecarLimpoNaConta(conta) : await juntarNaConta(conta), qual)
    } catch (e) {
      toast('Não deu', 'erro', (e as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  return (
    <Card className="p-4 border-warn/40">
      <div className="flex items-start gap-3 mb-3">
        <Icone nome="alerta" tamanho={20} className="text-warn shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[14px] font-bold leading-tight">Este aparelho tem dados de outra conta</p>
          <p className="text-[12.5px] text-muted leading-relaxed mt-1.5">
            Os treinos, a dieta e as medidas que estão aqui são de <b className="text-txt break-all">{dono}</b>.
            Você entrou como <b className="text-txt break-all">{conta}</b>. Nada foi misturado - escolha o que fazer.
          </p>
        </div>
      </div>

      <Btn variant="primary" className="w-full mb-1.5" disabled={!!ocupado} onClick={() => fazer('limpo')}>
        {ocupado === 'limpo' ? 'Trazendo sua conta...' : 'Usar só a minha conta aqui'}
      </Btn>
      <p className="text-[11.5px] text-muted leading-relaxed mb-3 px-1">
        Tira deste aparelho os dados de {dono} e traz os seus. Os de {dono} continuam
        salvos na conta de origem. O que não chegou a sincronizar se perde - baixe o
        backup antes se tiver dúvida.
      </p>

      <Btn className="w-full mb-1.5" disabled={!!ocupado} onClick={async () => {
        setOcupado('backup')
        try { await baixarBackup(); toast('Backup baixado', 'ok') } finally { setOcupado(null) }
      }}>
        {ocupado === 'backup' ? 'Gerando...' : 'Baixar backup deste aparelho'}
      </Btn>

      <Btn variant="ghost" className="w-full mt-2 mb-1" disabled={!!ocupado} onClick={() => fazer('juntar')}>
        {ocupado === 'juntar' ? 'Juntando...' : `Juntar tudo em ${conta}`}
      </Btn>
      <p className="text-[11.5px] text-muted leading-relaxed mb-3 px-1">
        Leva pra sua conta tudo que está aqui, inclusive peso, medidas e glicemia de {dono}.
        Só faça isso se as duas contas forem suas.
      </p>

      <button onClick={onSair} disabled={!!ocupado}
        className="toque w-full text-[12px] font-semibold text-muted py-2 disabled:opacity-40">
        Cancelar e sair de {conta}
      </button>
    </Card>
  )
}
