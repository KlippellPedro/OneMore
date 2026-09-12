import { useState } from 'react'
import { entrar, criarConta } from '../lib/sync'
import { Btn, Campo, Input, Chip } from '../components/ui'
import { Icone } from '../components/Icone'
import { useUI } from '../state/ui'

/**
 * Porta de entrada do app. Aparece uma vez, na primeira abertura, e some assim
 * que a pessoa escolhe - entrando, criando conta ou dispensando.
 *
 * Dispensar e uma opcao de proposito: o OneMore guarda tudo em IndexedDB e
 * funciona sem internet. Exigir login na porta quebraria justamente o cenario
 * pra que ele existe - treinar na academia, onde quase nunca ha sinal.
 */
export default function Entrada({ pronto }: { pronto: () => void }) {
  const { toast } = useUI()
  const [criando, setCriando] = useState(false)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [ocupado, setOcupado] = useState(false)

  async function autenticar() {
    if (ocupado) return
    setOcupado(true)
    try {
      const u = await (criando ? criarConta : entrar)(email.trim(), senha)
      toast(criando ? 'Conta criada' : `Bem-vindo, ${u?.email ?? ''}`, 'ok',
        criando ? 'Use Perfil > Sua conta pra sincronizar' : undefined)
      pronto()
    } catch (e) {
      toast('Nao deu', 'erro', (e as Error).message)
    } finally {
      setOcupado(false)
    }
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
        <Chip ativo={!criando} onClick={() => setCriando(false)}>Ja tenho conta</Chip>
        <Chip ativo={criando} onClick={() => setCriando(true)}>Criar conta</Chip>
      </div>

      <Campo label="E-mail">
        <Input type="email" value={email} onChange={e => setEmail(e.target.value)}
          autoComplete="email" placeholder="voce@email.com" inputMode="email" />
      </Campo>
      <Campo label="Senha" hint={criando ? 'Minimo 8 caracteres.' : undefined}>
        <Input type="password" value={senha} onChange={e => setSenha(e.target.value)}
          autoComplete={criando ? 'new-password' : 'current-password'}
          onKeyDown={e => { if (e.key === 'Enter') autenticar() }} />
      </Campo>

      <Btn variant="primary" size="lg" className="w-full" disabled={ocupado} onClick={autenticar}>
        {ocupado
          ? (criando ? 'Criando...' : 'Entrando...')
          : (criando ? 'Criar conta' : 'Entrar')}
      </Btn>

      {criando && (
        <p className="text-[11px] text-muted leading-relaxed mt-2.5 text-center">
          Ainda nao da pra recuperar senha por e-mail - anote a sua.
        </p>
      )}

      <div className="flex items-center gap-3 my-6">
        <span className="flex-1 h-px bg-line" />
        <span className="text-[11px] text-muted">ou</span>
        <span className="flex-1 h-px bg-line" />
      </div>

      <button onClick={pronto}
        className="toque w-full h-12 rounded-2xl border border-line text-[14px] font-semibold text-txt/90 active:bg-surface-2">
        Usar so neste aparelho
      </button>
      <p className="text-[11.5px] text-muted leading-relaxed mt-3 text-center">
        Tudo funciona sem conta e sem internet - os dados ficam neste aparelho.
        A conta serve pra ter backup e usar o mesmo perfil no celular e no PC.
        Da pra criar depois em Perfil.
      </p>
    </div>
  )
}
