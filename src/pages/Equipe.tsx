import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Cabecalho } from '../components/Cabecalho'
import { Card, Btn, Input, Campo, Secao, Vazio, Confirmar, Switch, Chip, Sheet } from '../components/ui'
import { Icone } from '../components/Icone'
import { Recebidos } from '../components/Recebidos'
import { useUI, vibrar } from '../state/ui'
import { usePerfil } from '../state/hooks'
import { hoje } from '../db'
import { usuarioAtual } from '../lib/sync'
import { publicarCartao } from '../lib/amigos'
import { codigoDoTexto, quandoFoi } from '../lib/cartao'
import { situacaoDoCartao, ordemDeAtencao, type Situacao } from '../lib/painel'
import {
  estadoEquipe, criarEquipe, editarEquipe, desfazerEquipe, entrarNaEquipe, mudarPermissoes, sairDaEquipe,
  linkDaEquipe, type EstadoEquipe, type MinhaEquipe, type EquipeQueParticipo,
} from '../lib/equipe'
import { compartilharTexto } from '../lib/arquivo'
import { calcNivel, rankDoNivel } from '../lib/xp'
import { pl } from '../lib/format'

/**
 * Equipe: o lado do treinador (alunos, painel, montar treino e dieta) e o lado
 * do aluno (quem e o treinador, o que foi liberado pra ele, sair). Uma conta
 * pode ser as duas coisas - treinador de uma equipe e aluno de outra.
 */
export default function Equipe() {
  const [params, setParams] = useSearchParams()
  const codigoLink = params.get('codigo')
  const [estado, setEstado] = useState<'carregando' | 'sem-conta' | 'offline' | 'ok'>('carregando')
  const [dados, setDados] = useState<EstadoEquipe>({ minha: null, participo: null })

  const carregar = useCallback(async () => {
    try {
      if (!(await usuarioAtual())) return setEstado('sem-conta')
      setDados(await estadoEquipe())
      setEstado('ok')
    } catch {
      setEstado('offline')
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const nav = useNavigate()
  if (estado === 'carregando') {
    return (
      <div>
        <Cabecalho titulo="Equipe" voltarPara="/perfil" />
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-line border-t-accent animate-spin" />
        </div>
      </div>
    )
  }
  if (estado === 'sem-conta' || estado === 'offline') {
    return (
      <div>
        <Cabecalho titulo="Equipe" voltarPara="/perfil" />
        {estado === 'sem-conta'
          ? <Vazio icone="prancheta" titulo="Entre na sua conta"
              texto="A equipe liga a sua conta à do treinador (ou dos alunos), então precisa de conta e internet."
              acao={<Btn variant="primary" onClick={() => nav('/perfil')}>Ir pro Perfil</Btn>} />
          : <Vazio icone="alerta" titulo="Sem conexão com o servidor"
              texto="A equipe vem da internet. Seus treinos continuam aqui normalmente."
              acao={<Btn onClick={() => { setEstado('carregando'); carregar() }}>Tentar de novo</Btn>} />}
      </div>
    )
  }

  const { minha, participo } = dados
  return (
    <div>
      <Cabecalho titulo={minha ? minha.nome : 'Equipe'}
        sub={minha ? `${pl(minha.alunos.length, 'aluno')} - treinador ${minha.treinador}` : participo ? `Treinador: ${participo.treinador}` : 'Treinador e alunos'}
        voltarPara="/perfil" />
      <div className="px-4 pt-4">
        {minha && <PainelTreinador equipe={minha} mudou={carregar} />}
        {participo && <MeuTreinador participo={participo} mudou={carregar} />}
        {!participo && (
          <Entrar codigoInicial={codigoLink ?? ''} discreto={!!minha}
            entrou={() => { setParams({}, { replace: true }); carregar() }} />
        )}
        {!minha && <CriarEquipe discreto={!!participo} criou={carregar} />}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* TREINADOR                                                           */
/* ------------------------------------------------------------------ */

const ROTULO: Record<Situacao, { texto: string; cor: string }> = {
  'em-dia': { texto: 'Em dia', cor: 'var(--color-good)' },
  atencao: { texto: 'Atenção', cor: 'var(--color-warn)' },
  parado: { texto: 'Parado', cor: 'var(--color-bad)' },
  'sem-dados': { texto: 'Sem dados', cor: 'var(--color-muted)' },
}

function PainelTreinador({ equipe, mudou }: { equipe: MinhaEquipe; mudou: () => void }) {
  const nav = useNavigate()
  const { toast } = useUI()
  const hj = hoje()
  const [filtro, setFiltro] = useState<'todos' | 'atencao'>('todos')
  const [editar, setEditar] = useState(false)
  const [nome, setNome] = useState(equipe.nome)
  const [treinador, setTreinador] = useState(equipe.treinador)
  const [confirmar, setConfirmar] = useState<null | 'codigo' | 'desfazer'>(null)

  const alunos = useMemo(() => equipe.alunos
    .map(a => ({ ...a, s: situacaoDoCartao(a.cartao, hj) }))
    .sort((a, b) => ordemDeAtencao(a.s, b.s) || (a.cartao?.nome ?? '').localeCompare(b.cartao?.nome ?? '')),
  [equipe.alunos, hj])
  const precisam = alunos.filter(a => a.s.situacao === 'atencao' || a.s.situacao === 'parado')
  const treinaram = alunos.filter(a => a.s.treinosSemana > 0).length
  const lista = filtro === 'todos' ? alunos : precisam

  async function convidar() {
    const res = await compartilharTexto('OneMore',
      `Entra na minha equipe no OneMore: ${linkDaEquipe(equipe.codigo)}\nOu digite o código ${equipe.codigo} em Perfil > Equipe.`)
    if (res === 'copiado') toast('Convite copiado', 'ok', 'Cole no WhatsApp ou onde quiser')
    else if (res === 'falhou') toast('Não deu pra compartilhar daqui', 'erro')
  }

  async function salvarEdicao() {
    try {
      await editarEquipe({ nome: nome.trim(), treinador: treinador.trim() })
      setEditar(false)
      toast('Equipe atualizada', 'ok')
      mudou()
    } catch (e) { toast((e as Error).message, 'erro') }
  }

  async function executar() {
    const acao = confirmar
    setConfirmar(null)
    try {
      if (acao === 'codigo') {
        await editarEquipe({ novoCodigo: true })
        toast('Código trocado', 'ok', 'O antigo não funciona mais. Quem já está na equipe continua.')
      } else if (acao === 'desfazer') {
        await desfazerEquipe()
        toast('Equipe desfeita', 'ok')
      }
      mudou()
    } catch (e) { toast((e as Error).message, 'erro') }
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 mb-5">
        <Numero valor={String(alunos.length)} rotulo={alunos.length === 1 ? 'aluno' : 'alunos'} />
        <Numero valor={String(treinaram)} rotulo="treinaram na semana" />
        <Numero valor={String(precisam.length)} rotulo="pedem atenção" cor={precisam.length ? 'var(--color-warn)' : undefined} />
      </div>

      <Secao titulo="Alunos" acao={alunos.length > 0 ? (
        <div className="flex gap-1.5">
          <Chip ativo={filtro === 'todos'} onClick={() => setFiltro('todos')}>Todos</Chip>
          <Chip ativo={filtro === 'atencao'} onClick={() => setFiltro('atencao')}>Atenção</Chip>
        </div>
      ) : undefined}>
        {alunos.length === 0 ? (
          <Card className="p-0">
            <Vazio icone="pessoa" titulo="Nenhum aluno ainda"
              texto="Mande o convite da equipe pros seus alunos. Quem entrar aparece aqui, com o treino da semana."
              acao={<Btn variant="primary" onClick={convidar}><Icone nome="compartilhar" tamanho={16} /> Mandar convite</Btn>} />
          </Card>
        ) : lista.length === 0 ? (
          <Card className="p-4 text-[13px] text-muted text-center">Ninguém precisando de atenção agora.</Card>
        ) : (
          <Card className="overflow-hidden">
            {lista.map(a => {
              const nivel = a.cartao ? calcNivel(a.cartao.xp).nivel : null
              const rank = nivel ? rankDoNivel(nivel) : null
              const r = ROTULO[a.s.situacao]
              return (
                <button key={a.id} onClick={() => nav(`/equipe/aluno/${a.id}`)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 border-b border-line/40 last:border-0 text-left active:bg-surface-2">
                  <span className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center border-2 text-[15px] font-black"
                    style={rank ? { borderColor: rank.cor, color: rank.cor, background: rank.cor + '14' } : undefined}>
                    {nivel ?? <Icone nome="pessoa" tamanho={18} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold truncate">{a.cartao?.nome ?? 'Aluno novo'}</p>
                    <p className="text-[11.5px] text-muted truncate">
                      {a.cartao
                        ? `${a.s.meta ? `${a.s.treinosSemana}/${a.s.meta}` : a.s.treinosSemana} na semana - ${
                          a.cartao.dias[0] ? `último ${quandoFoi(a.cartao.dias[0], hj)}` : 'sem treino recente'}`
                        : 'Ainda não abriu o app depois de entrar'}
                    </p>
                  </div>
                  <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{ color: r.cor, background: `color-mix(in srgb, ${r.cor} 14%, transparent)` }}>
                    {r.texto}
                  </span>
                </button>
              )
            })}
          </Card>
        )}
      </Secao>

      <Secao titulo="Convite da equipe">
        <Card className="p-4">
          <p className="text-[12.5px] text-muted mb-3 leading-relaxed">
            Quem usar este código entra na sua equipe. Antes de entrar, o aluno vê e escolhe o que libera pra você.
          </p>
          <p className="text-center text-[22px] font-black font-mono tracking-[0.16em] py-3 mb-3 rounded-xl bg-bg border border-line select-all">
            {equipe.codigo}
          </p>
          <Btn variant="primary" className="w-full mb-2" onClick={convidar}>
            <Icone nome="compartilhar" tamanho={17} /> Mandar convite
          </Btn>
          <div className="flex gap-2">
            <Btn size="sm" className="flex-1" onClick={() => setConfirmar('codigo')}>Trocar código</Btn>
            <Btn size="sm" className="flex-1" onClick={() => setEditar(true)}>Editar equipe</Btn>
          </div>
        </Card>
      </Secao>

      <button onClick={() => setConfirmar('desfazer')}
        className="w-full text-center text-[12.5px] font-semibold text-bad py-3 mb-6">
        Desfazer equipe
      </button>

      <Sheet aberto={editar} fechar={() => setEditar(false)} titulo="Editar equipe">
        <Campo label="Nome da equipe"><Input value={nome} maxLength={60} onChange={e => setNome(e.target.value)} /></Campo>
        <Campo label="Seu nome (o que os alunos veem)"><Input value={treinador} maxLength={60} onChange={e => setTreinador(e.target.value)} /></Campo>
        <Btn variant="primary" size="lg" className="w-full" onClick={salvarEdicao}>Salvar</Btn>
      </Sheet>

      <Confirmar aberto={confirmar != null} perigo={confirmar === 'desfazer'}
        titulo={confirmar === 'codigo' ? 'Trocar o código?' : 'Desfazer a equipe?'}
        texto={confirmar === 'codigo'
          ? 'O código atual para de funcionar na hora. Quem já está na equipe continua.'
          : 'Todos os alunos saem e você deixa de ver os dados deles. O treino e a dieta que eles já usam continuam com eles.'}
        onNao={() => setConfirmar(null)} onSim={executar} />
    </>
  )
}

function Numero({ valor, rotulo, cor }: { valor: string; rotulo: string; cor?: string }) {
  return (
    <Card className="px-2 py-3 text-center">
      <p className="text-[22px] font-black tabular-nums leading-tight" style={cor ? { color: cor } : undefined}>{valor}</p>
      <p className="text-[10.5px] text-muted leading-tight mt-0.5">{rotulo}</p>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* ALUNO                                                               */
/* ------------------------------------------------------------------ */

function Permissao({ titulo, texto, ligado, onChange, fixo }: {
  titulo: string; texto: string; ligado: boolean; onChange?: (v: boolean) => void; fixo?: boolean
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-line/40 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-semibold">{titulo}</p>
        <p className="text-[11.5px] text-muted leading-relaxed mt-0.5">{texto}</p>
      </div>
      {fixo
        ? <span className="text-[10.5px] font-bold text-muted shrink-0 mt-1">SEMPRE</span>
        : <Switch ligado={ligado} onChange={v => onChange?.(v)} rotulo={titulo} />}
    </div>
  )
}

const TEXTO_TREINOS = 'Treinos feitos (séries, cargas, recordes), sua semana de treino, nível e sequência.'
const TEXTO_CORPO = 'Peso, medidas, altura, sexo e idade.'
const TEXTO_DIETA = 'Seu plano alimentar, o que você registra de comida e água, e suas metas de dieta.'

function MeuTreinador({ participo, mudou }: { participo: EquipeQueParticipo; mudou: () => void }) {
  const { toast } = useUI()
  const [perm, setPerm] = useState(participo.permissoes)
  const [sair, setSair] = useState(false)

  async function mudar(p: { corpo: boolean; dieta: boolean }) {
    const antes = perm
    setPerm({ treinos: true, ...p })
    try {
      await mudarPermissoes(p)
      toast('Pronto', 'ok', 'Seu treinador já vê conforme o que você escolheu')
    } catch (e) {
      setPerm(antes)
      toast((e as Error).message, 'erro')
    }
  }

  return (
    <>
      <Card className="p-4 mb-5" destaque>
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 shrink-0 rounded-xl grad-accent flex items-center justify-center text-white">
            <Icone nome="prancheta" tamanho={20} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Seu treinador</p>
            <p className="text-[16px] font-bold truncate leading-tight">{participo.treinador}</p>
            <p className="text-[12px] text-muted truncate">
              {participo.nome} - desde {new Date(participo.entrouEm).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
        <p className="text-[12px] text-muted leading-relaxed mt-3">
          O treino e a dieta montados pelo treinador chegam aqui e nas telas de Treino e Dieta. Você escolhe quando usar,
          e o que você tinha antes fica guardado.
        </p>
      </Card>

      <Recebidos tipo="treino" />
      <Recebidos tipo="dieta" />

      <Secao titulo="O que seu treinador vê">
        <Card className="overflow-hidden">
          <Permissao titulo="Treinos" texto={TEXTO_TREINOS} ligado fixo />
          <Permissao titulo="Corpo" texto={TEXTO_CORPO} ligado={perm.corpo}
            onChange={v => mudar({ corpo: v, dieta: perm.dieta })} />
          <Permissao titulo="Dieta" texto={TEXTO_DIETA} ligado={perm.dieta}
            onChange={v => mudar({ corpo: perm.corpo, dieta: v })} />
        </Card>
        <p className="text-[11px] text-muted/80 leading-relaxed mt-2 px-1">
          Glicemia, diabetes, alergias e restrições nunca vão pro treinador.
        </p>
      </Secao>

      <button onClick={() => setSair(true)} className="w-full text-center text-[12.5px] font-semibold text-bad py-3 mb-6">
        Sair da equipe
      </button>

      <Confirmar aberto={sair} perigo titulo="Sair da equipe?"
        texto={`${participo.treinador} deixa de ver seus dados na hora. O treino e a dieta que você já usa continuam com você.`}
        onNao={() => setSair(false)}
        onSim={async () => {
          setSair(false)
          try { await sairDaEquipe(); toast('Você saiu da equipe', 'ok'); mudou() } catch (e) { toast((e as Error).message, 'erro') }
        }} />
    </>
  )
}

function Entrar({ codigoInicial, entrou, discreto }: { codigoInicial: string; entrou: () => void; discreto?: boolean }) {
  const { toast } = useUI()
  const [aberto, setAberto] = useState(!!codigoInicial || !discreto)
  const [codigo, setCodigo] = useState(codigoInicial)
  const [corpo, setCorpo] = useState(false)
  const [dieta, setDieta] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  async function entrar() {
    if (ocupado) return
    setOcupado(true)
    try {
      const r = await entrarNaEquipe(codigoDoTexto(codigo), { corpo, dieta })
      vibrar(20)
      toast(`Você entrou na equipe de ${r?.participo.treinador ?? 'seu treinador'}`, 'ok')
      // o treinador ve o cartao na lista: manda agora, sem esperar a proxima sincronizacao
      await publicarCartao(true).catch(() => {})
      entrou()
    } catch (e) {
      toast((e as Error).message, 'erro')
    } finally {
      setOcupado(false)
    }
  }

  if (!aberto) {
    return (
      <Card className="p-4 mb-4" onClick={() => setAberto(true)}>
        <p className="text-[14px] font-bold">Tenho um código de treinador</p>
        <p className="text-[12px] text-muted mt-0.5">Entrar na equipe de alguém como aluno</p>
      </Card>
    )
  }

  return (
    <Secao titulo="Entrar numa equipe">
      <Card className="p-4">
        <p className="text-[12.5px] text-muted mb-3 leading-relaxed">
          Com o código do seu treinador (ou personal), seus treinos passam a ser acompanhados e o treinador
          pode montar o seu treino e a sua dieta.
        </p>
        <Input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="K7Q2-XP9M"
          autoCapitalize="characters" autoComplete="off" spellCheck={false}
          className="font-mono tracking-[0.12em] uppercase mb-3" />
        <p className="text-[12px] font-medium text-muted mb-1.5">O que o treinador vai ver</p>
        <div className="rounded-xl border border-line overflow-hidden mb-2">
          <Permissao titulo="Treinos" texto={TEXTO_TREINOS} ligado fixo />
          <Permissao titulo="Corpo" texto={TEXTO_CORPO} ligado={corpo} onChange={setCorpo} />
          <Permissao titulo="Dieta" texto={TEXTO_DIETA} ligado={dieta} onChange={setDieta} />
        </div>
        <p className="text-[11px] text-muted/80 leading-relaxed mb-3">
          Dá pra mudar isso e sair da equipe quando quiser. Glicemia e dados de saúde nunca vão pro treinador.
        </p>
        <Btn variant="primary" size="lg" className="w-full" onClick={entrar} disabled={ocupado || !codigo.trim()}>
          Entrar na equipe
        </Btn>
      </Card>
    </Secao>
  )
}

function CriarEquipe({ criou, discreto }: { criou: () => void; discreto?: boolean }) {
  const { toast } = useUI()
  const perfil = usePerfil()
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [treinador, setTreinador] = useState<string | null>(null)

  async function criar() {
    try {
      await criarEquipe(nome.trim(), (treinador ?? perfil.nome).trim())
      vibrar(20)
      toast('Equipe criada', 'ok', 'Agora mande o convite pros seus alunos')
      setAberto(false)
      criou()
    } catch (e) { toast((e as Error).message, 'erro') }
  }

  return (
    <>
      <Card className={`p-4 mb-6 ${discreto ? '' : 'border-accent/25'}`} onClick={() => setAberto(true)}>
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-accent/12 text-accent flex items-center justify-center">
            <Icone nome="prancheta" tamanho={19} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold">Sou treinador</p>
            <p className="text-[12px] text-muted mt-0.5">Crie sua equipe, acompanhe os alunos e monte treino e dieta pra eles</p>
          </div>
          <span className="text-accent shrink-0">›</span>
        </div>
      </Card>

      <Sheet aberto={aberto} fechar={() => setAberto(false)} titulo="Criar equipe">
        <ul className="text-[12.5px] text-muted leading-relaxed space-y-1.5 mb-4 list-disc pl-4">
          <li>Seus alunos entram com um código e escolhem o que liberam pra você.</li>
          <li>Você vê quem treinou, quem sumiu, cargas, recordes e o histórico de cada um.</li>
          <li>Monta o treino e a dieta de cada aluno e manda direto pro app.</li>
        </ul>
        <Campo label="Nome da equipe" hint="Ex: Studio Força, Turma da manhã, Consultoria Ana">
          <Input value={nome} maxLength={60} onChange={e => setNome(e.target.value)} autoFocus />
        </Campo>
        <Campo label="Seu nome (o que os alunos veem)">
          <Input value={treinador ?? perfil.nome} maxLength={60} onChange={e => setTreinador(e.target.value)} />
        </Campo>
        <Btn variant="primary" size="lg" className="w-full" onClick={criar} disabled={!nome.trim()}>Criar equipe</Btn>
      </Sheet>
    </>
  )
}
