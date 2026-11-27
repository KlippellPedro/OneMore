import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Cabecalho } from '../components/Cabecalho'
import { Card, Btn, Input, Secao, Vazio, Confirmar } from '../components/ui'
import { Icone } from '../components/Icone'
import { useUI } from '../state/ui'
import { usePerfil } from '../state/hooks'
import { salvarPerfil, hoje } from '../db'
import { usuarioAtual } from '../lib/sync'
import {
  listarAmigos, gerarConvite, desligarConvite, adicionarAmigo, removerAmigo,
  linkDeConvite, cartaoLocal, publicarCartao, type Amigo, type EstadoAmigos,
} from '../lib/amigos'
import {
  haQuanto, codigoDoTexto, type Cartao,
} from '../lib/cartao'
import { compartilharTexto } from '../lib/arquivo'
import { pl } from '../lib/format'
import { CartaoTreino, BotaoRemover } from '../components/CartaoTreino'

/**
 * Amigos: quem usa o seu codigo de convite (ou de quem voce usa o codigo)
 * passa a ver o seu cartao, e voce o dela. O cartao e um resumo de treino e
 * nada mais - ver lib/cartao.ts. Precisa de conta e de internet: e o servidor
 * que liga uma conta a outra.
 */
export default function Amigos() {
  const { toast } = useUI()
  const perfil = usePerfil()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const doLink = params.get('convite')

  const [estado, setEstado] = useState<'carregando' | 'sem-conta' | 'offline' | 'ok'>('carregando')
  const [dados, setDados] = useState<EstadoAmigos>({ convite: null, amigos: [] })
  const [codigo, setCodigo] = useState(doLink ?? '')
  const [ocupado, setOcupado] = useState(false)
  const [remover, setRemover] = useState<Amigo | null>(null)
  const [confirmarTroca, setConfirmarTroca] = useState(false)
  const [meu, setMeu] = useState<Cartao | null>(null)
  /** null = nao esta editando, o campo mostra o nome do perfil. */
  const [nome, setNome] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    try {
      if (!(await usuarioAtual())) return setEstado('sem-conta')
      setDados((await listarAmigos()) ?? { convite: null, amigos: [] })
      setEstado('ok')
    } catch {
      setEstado('offline')
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])
  // convite aberto com a tela ja aberta (mesma rota, so muda a query): o aviso fica no topo
  useEffect(() => { if (doLink) window.scrollTo(0, 0) }, [doLink])
  // a previa do proprio cartao acompanha o nome (e o XP, que muda ao treinar)
  useEffect(() => { cartaoLocal().then(setMeu).catch(() => {}) }, [perfil.nome, perfil.xp])

  async function tentar(fn: () => Promise<void>) {
    if (ocupado) return
    setOcupado(true)
    try { await fn() } catch (e) { toast((e as Error).message, 'erro') } finally { setOcupado(false) }
  }

  const criarCodigo = () => tentar(async () => {
    const r = await gerarConvite()
    setDados(d => ({ ...d, convite: r?.convite ?? null }))
    // ligou agora: o cartao precisa estar la antes do primeiro amigo chegar
    await publicarCartao(true).catch(() => {})
  })

  const trocarCodigo = () => tentar(async () => {
    setConfirmarTroca(false)
    const r = await gerarConvite()
    setDados(d => ({ ...d, convite: r?.convite ?? null }))
    toast('Código trocado', 'ok', 'O antigo não funciona mais')
  })

  const desligar = () => tentar(async () => {
    await desligarConvite()
    setDados(d => ({ ...d, convite: null }))
    toast('Código desligado', 'ok', 'Ninguém novo consegue te adicionar')
  })

  async function compartilhar() {
    if (!dados.convite) return
    const res = await compartilharTexto('OneMore',
      `Me adiciona como amigo no OneMore: ${linkDeConvite(dados.convite)}\nOu digite o código ${dados.convite} em Perfil > Amigos.`)
    if (res === 'copiado') toast('Convite copiado', 'ok', 'Cole no WhatsApp ou onde quiser')
    else if (res === 'falhou') toast('Não deu pra compartilhar daqui', 'erro')
  }

  /** `texto` vem do campo, ou do link de convite (que pode chegar com a tela ja aberta). */
  const adicionar = (texto: string) => tentar(async () => {
    const r = await adicionarAmigo(codigoDoTexto(texto))
    const quem = r?.amigo?.cartao?.nome
    toast(r?.jaEram ? 'Vocês já estavam ligados' : `${quem ?? 'Pronto'}: agora vocês se veem`, 'ok')
    setCodigo('')
    if (doLink) setParams({}, { replace: true })
    await publicarCartao(true).catch(() => {})
    await carregar()
  })

  const confirmarRemocao = () => tentar(async () => {
    if (!remover) return
    await removerAmigo(remover.id)
    setRemover(null)
    toast('Amizade desfeita', 'ok')
    await carregar()
  })

  async function salvarNome() {
    const limpo = (nome ?? '').trim().slice(0, 40)
    setNome(null)
    if (limpo && limpo !== perfil.nome) await salvarPerfil({ nome: limpo })
  }

  const hj = hoje()

  if (estado === 'carregando') {
    return (
      <div>
        <Cabecalho titulo="Amigos" voltarPara="/perfil" />
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-line border-t-accent animate-spin" />
        </div>
      </div>
    )
  }

  if (estado === 'sem-conta') {
    return (
      <div>
        <Cabecalho titulo="Amigos" voltarPara="/perfil" />
        <Vazio icone="pessoa" titulo="Entre na sua conta"
          texto="Amigos liga a sua conta à de outra pessoa, então precisa de conta e internet. Entre em Perfil > Sua conta e sincronização."
          acao={<Btn variant="primary" onClick={() => nav('/perfil')}>Ir pro Perfil</Btn>} />
      </div>
    )
  }

  if (estado === 'offline') {
    return (
      <div>
        <Cabecalho titulo="Amigos" voltarPara="/perfil" />
        <Vazio icone="alerta" titulo="Sem conexão com o servidor"
          texto="Os amigos vêm da internet. Seus treinos continuam aqui normalmente."
          acao={<Btn onClick={() => { setEstado('carregando'); carregar() }}>Tentar de novo</Btn>} />
      </div>
    )
  }

  return (
    <div>
      <Cabecalho titulo="Amigos" sub={dados.amigos.length ? pl(dados.amigos.length, 'amigo') : 'Veja como seus amigos estão treinando'}
        voltarPara="/perfil" />

      <div className="px-4 pt-4">
        {doLink && (
          <Card className="p-4 mb-5" destaque>
            <p className="text-[14px] font-bold mb-1">Você abriu um convite</p>
            <p className="text-[12.5px] text-muted mb-3 leading-relaxed">
              Adicionando, vocês dois passam a ver o cartão um do outro: nível, sequência e treinos.
            </p>
            <div className="flex gap-2">
              <Btn variant="ghost" className="flex-1" onClick={() => { setParams({}, { replace: true }); setCodigo('') }}>
                Agora não
              </Btn>
              <Btn variant="primary" className="flex-1" onClick={() => adicionar(doLink)} disabled={ocupado}>Adicionar</Btn>
            </div>
          </Card>
        )}

        <Secao titulo="Seus amigos">
          {dados.amigos.length === 0 ? (
            <Card className="p-0">
              <Vazio icone="pessoa" titulo="Nenhum amigo ainda"
                texto="Mande o seu código pra alguém que usa o OneMore, ou digite o código de um amigo aqui embaixo." />
            </Card>
          ) : (
            <div className="space-y-3">
              {dados.amigos.map(a => a.cartao
                ? <CartaoTreino key={a.id} cartao={a.cartao} hoje={hj}
                    atualizado={a.atualizadoEm ? haQuanto(new Date(a.atualizadoEm).getTime()) : null}
                    onRemover={() => setRemover(a)} />
                : (
                  <Card key={a.id} className="p-4 flex items-center gap-3">
                    <div className="w-11 h-11 shrink-0 rounded-xl bg-surface-2 border border-line flex items-center justify-center text-muted">
                      <Icone nome="pessoa" tamanho={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold">Ainda sem cartão</p>
                      <p className="text-[11.5px] text-muted">O cartão aparece quando essa pessoa abrir o app.</p>
                    </div>
                    <BotaoRemover onClick={() => setRemover(a)} />
                  </Card>
                ))}
            </div>
          )}
        </Secao>

        <Secao titulo="Adicionar amigo">
          <Card className="p-4">
            <p className="text-[12.5px] text-muted mb-3 leading-relaxed">
              Peça o código pro seu amigo (fica nesta mesma tela, no app de quem vai te mandar) e digite aqui.
            </p>
            <div className="flex gap-2">
              <Input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="K7Q2-XP9M"
                autoCapitalize="characters" autoComplete="off" spellCheck={false}
                className="font-mono tracking-[0.12em] uppercase"
                onKeyDown={e => { if (e.key === 'Enter' && codigo.trim()) adicionar(codigo) }} />
              <Btn variant="primary" onClick={() => adicionar(codigo)} disabled={ocupado || !codigo.trim()}>Adicionar</Btn>
            </div>
          </Card>
        </Secao>

        <Secao titulo="Seu código">
          <Card className="p-4">
            {dados.convite ? (
              <>
                <p className="text-[12.5px] text-muted mb-3 leading-relaxed">
                  Quem usar este código vira seu amigo, e vocês dois passam a ver o cartão um do outro.
                  Mande só pra quem você quer.
                </p>
                <p className="text-center text-[22px] font-black font-mono tracking-[0.16em] py-3 mb-3 rounded-xl bg-bg border border-line select-all">
                  {dados.convite}
                </p>
                <Btn variant="primary" className="w-full mb-2" onClick={compartilhar}>
                  <Icone nome="compartilhar" tamanho={17} /> Mandar convite
                </Btn>
                <div className="flex gap-2">
                  <Btn size="sm" className="flex-1" onClick={() => setConfirmarTroca(true)} disabled={ocupado}>Trocar código</Btn>
                  <Btn size="sm" variant="ghost" className="flex-1" onClick={desligar} disabled={ocupado}>Desligar</Btn>
                </div>
              </>
            ) : (
              <>
                <p className="text-[12.5px] text-muted mb-3 leading-relaxed">
                  Crie um código pra mandar pros seus amigos. Enquanto você não cria um código
                  nem adiciona ninguém, nada do seu treino fica visível pra outras contas.
                </p>
                <Btn variant="primary" className="w-full" onClick={criarCodigo} disabled={ocupado}>Criar meu código</Btn>
              </>
            )}
          </Card>
        </Secao>

        <Secao titulo="O que seus amigos veem">
          <Card className="p-4 mb-3">
            <label className="block">
              <span className="block text-[12px] font-medium text-muted mb-1.5">Seu nome no cartão</span>
              <Input value={nome ?? perfil.nome} maxLength={40} onChange={e => setNome(e.target.value)} onBlur={salvarNome}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
            </label>
            <p className="text-[11.5px] text-muted mt-3 leading-relaxed">
              Só o que está no cartão abaixo. <b className="text-txt/85">Dieta, peso, medidas, glicemia,
              saúde e seu e-mail nunca vão pros amigos.</b>
            </p>
          </Card>
          {meu && <CartaoTreino cartao={meu} hoje={hj} proprio />}
        </Secao>
      </div>

      <Confirmar aberto={remover != null} perigo titulo="Desfazer amizade?"
        texto={`${remover?.cartao?.nome ?? 'Essa pessoa'} deixa de ver o seu cartão, e você deixa de ver o cartão dessa pessoa. Pra voltar, um dos dois precisa usar o código do outro de novo.`}
        onNao={() => setRemover(null)} onSim={confirmarRemocao} />

      <Confirmar aberto={confirmarTroca} titulo="Trocar o código?"
        texto="O código atual para de funcionar na hora. Quem já é seu amigo continua. Use isso se o código foi parar onde não devia."
        onNao={() => setConfirmarTroca(false)} onSim={trocarCodigo} />
    </div>
  )
}
