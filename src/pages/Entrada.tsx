import { useState } from 'react'
import { entrar, criarConta, redefinirSenha, sair, donoDosDados, ErroApi } from '../lib/sync'
import { CodigoRecuperacao } from '../components/CodigoRecuperacao'
import { ContaDiferente } from '../components/ContaDiferente'
import { Btn, Campo, Input, Chip } from '../components/ui'
import { Icone } from '../components/Icone'
import { Politica } from './Privacidade'
import { useUI } from '../state/ui'

/**
 * Porta de entrada do app. Aparece uma vez, na primeira abertura, e some assim
 * que a pessoa escolhe - entrando, criando conta ou dispensando.
 *
 * Dispensar e uma opcao de proposito: o OneMore guarda tudo em IndexedDB e
 * funciona sem internet. Exigir login na porta quebraria justamente o cenario
 * pra que ele existe - treinar na academia, onde quase nunca ha sinal.
 */
type Modo = 'entrar' | 'criar' | 'recuperar'

export default function Entrada({ pronto }: { pronto: () => void }) {
  const { toast } = useUI()
  const [modo, setModo] = useState<Modo>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  /** Quando preenchido, a tela para tudo e mostra o codigo. */
  const [mostrarCodigo, setMostrarCodigo] = useState<string | null>(null)
  /** E-mail como o servidor guardou - e o que a marca de dono do aparelho compara. */
  const [conta, setConta] = useState<string | null>(null)
  const [verPolitica, setVerPolitica] = useState(false)
  /** Os dados deste aparelho sao de outra conta: nada sincroniza ate a escolha (ver ContaDiferente). */
  const [conflito, setConflito] = useState<{ dono: string; conta: string } | null>(null)

  /** Entrou: segue pro app, a nao ser que os dados daqui sejam de outra conta. */
  function continuar(emailDaConta: string) {
    const dono = donoDosDados()
    if (dono && dono !== emailDaConta) return setConflito({ dono, conta: emailDaConta })
    pronto()
  }

  const criando = modo === 'criar'
  const recuperando = modo === 'recuperar'

  async function autenticar() {
    if (ocupado) return
    setOcupado(true)
    try {
      if (recuperando) {
        const u = await redefinirSenha(email.trim(), codigo, senha)
        toast('Senha trocada', 'ok', 'Você já entrou na conta')
        setConta(u!.email)
        // o codigo usado queimou: o servidor devolve um novo e ele precisa ser
        // guardado antes de a pessoa sair da tela
        setMostrarCodigo(u!.codigo)
        return
      }
      if (criando) {
        const u = await criarConta(email.trim(), senha)
        setConta(u!.email)
        setMostrarCodigo(u!.codigo)
        return
      }
      const u = await entrar(email.trim(), senha)
      toast(`Bem-vindo, ${u?.email ?? ''}`, 'ok')
      continuar(u!.email)
    } catch (e) {
      // 409 no cadastro: esse e-mail ja tem conta - leva direto pro login
      if (criando && e instanceof ErroApi && e.status === 409) {
        setModo('entrar')
        setSenha('')
        toast('Esse e-mail já tem conta', 'info', 'Entre com a senha dela, ou use "Esqueci a senha".')
        return
      }
      toast('Não deu', 'erro', (e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  // a politica abre aqui mesmo: a tela de entrada vive fora do roteador do app
  if (verPolitica) return <Politica onVoltar={() => setVerPolitica(false)} rotulo="Voltar ao cadastro" />

  if (conflito) {
    return (
      <div className="min-h-full flex flex-col justify-center px-6 py-10 max-w-[420px] mx-auto">
        <ContaDiferente dono={conflito.dono} conta={conflito.conta}
          onFeito={(_, escolha) => {
            pronto()
            // comecar limpo trocou o banco inteiro: recarrega pra nenhuma tela segurar o estado velho
            if (escolha === 'limpo') setTimeout(() => location.reload(), 300)
          }}
          onSair={async () => {
            await sair().catch(() => {})
            setConflito(null)
            setSenha('')
          }} />
      </div>
    )
  }

  if (mostrarCodigo) {
    return (
      <div className="min-h-full flex flex-col justify-center px-6 py-10 max-w-[420px] mx-auto">
        <h1 className="text-[20px] font-black leading-tight mb-1">Conta pronta</h1>
        <p className="text-[13px] text-muted mb-5">{email.trim()}</p>
        <CodigoRecuperacao codigo={mostrarCodigo} email={email.trim()}
          onPronto={() => { setMostrarCodigo(null); continuar(conta ?? email.trim().toLowerCase()) }} />
      </div>
    )
  }

  return (
    <div className="min-h-full flex flex-col justify-center px-6 py-10 max-w-[420px] mx-auto">
      <div className="text-center mb-7">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl grad-accent glow-accent flex items-center justify-center text-white">
          <Icone nome="halter" tamanho={30} />
        </div>
        <h1 className="text-[26px] font-black leading-tight">OneMore</h1>
        <p className="text-[13px] text-muted mt-1.5 leading-relaxed">
          Treino, dieta e progresso no mesmo lugar.
        </p>
      </div>

      <div className="flex gap-1.5 mb-4">
        <Chip ativo={modo === 'entrar'} onClick={() => setModo('entrar')}>Já tenho conta</Chip>
        <Chip ativo={criando} onClick={() => setModo('criar')}>Criar conta</Chip>
      </div>

      <Campo label="E-mail">
        <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
          autoComplete="email" placeholder="voce@email.com" inputMode="email" />
      </Campo>
      {recuperando && (
        <Campo label="Código de recuperação" hint="Aquele que apareceu quando você criou a conta.">
          <Input value={codigo} onChange={e => setCodigo(e.target.value)}
            placeholder="ABCD-2345-EFGH" autoCapitalize="characters" autoComplete="off" />
        </Campo>
      )}

      <Campo label={recuperando ? 'Nova senha' : 'Senha'}
        hint={criando || recuperando ? 'Mínimo 8 caracteres.' : undefined}>
        <Input type="password" value={senha} onChange={e => setSenha(e.target.value)}
          autoComplete={criando || recuperando ? 'new-password' : 'current-password'}
          onKeyDown={e => { if (e.key === 'Enter') autenticar() }} />
      </Campo>

      <Btn variant="primary" size="lg" className="w-full" disabled={ocupado} onClick={autenticar}>
        {ocupado
          ? 'Um instante...'
          : recuperando ? 'Trocar a senha' : criando ? 'Criar conta' : 'Entrar'}
      </Btn>

      {criando && (
        <p className="text-[11px] text-muted leading-relaxed mt-2.5 text-center">
          Você vai receber um código de recuperação pra guardar - e o único jeito
          de voltar se esquecer a senha.
        </p>
      )}
      {criando && (
        <p className="text-[11px] text-muted leading-relaxed mt-2 text-center">
          Ao criar a conta você concorda com o tratamento dos seus dados descrito na{' '}
          <button onClick={() => setVerPolitica(true)} className="underline font-semibold text-txt/80">
            política de privacidade
          </button>.
        </p>
      )}

      <button onClick={() => { setModo(recuperando ? 'entrar' : 'recuperar'); setSenha('') }}
        className="toque w-full text-[12px] font-semibold text-muted mt-3 py-1 active:text-accent">
        {recuperando ? 'Voltar pro login' : 'Esqueci a senha'}
      </button>

      <div className="flex items-center gap-3 my-6">
        <span className="flex-1 h-px bg-line" />
        <span className="text-[11px] text-muted">ou</span>
        <span className="flex-1 h-px bg-line" />
      </div>

      <button onClick={pronto}
        className="toque w-full h-12 rounded-2xl border border-line text-[14px] font-semibold text-txt/90 active:bg-surface-2">
        Usar só neste aparelho
      </button>
      <p className="text-[11.5px] text-muted leading-relaxed mt-3 text-center">
        Tudo funciona sem conta e sem internet - os dados ficam neste aparelho.
        A conta serve pra ter backup e usar o mesmo perfil no celular e no PC.
        Dá pra criar depois em Perfil.
      </p>
    </div>
  )
}
