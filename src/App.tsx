import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { HashRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { rodarSeed } from './db/seed'
import { usuarioAtual, iniciarSyncAutomatico } from './lib/sync'
import { secaoDe } from './lib/secoes'
import { iniciarLembretes, publicarAgenda } from './lib/lembretes'
import { publicarCartao } from './lib/amigos'
import { sanearXP } from './lib/xp'
import { Feedback } from './components/Feedback'
import { AplicarTema } from './components/AplicarTema'
import { Icone } from './components/Icone'
import { LimiteDeErro } from './components/LimiteDeErro'
import { useSessaoAtiva, usePerfil, usePerfilCarregado } from './state/hooks'
import { Link } from 'react-router-dom'

import Home from './pages/Home'
import Entrada from './pages/Entrada'

/**
 * Cada tela (fora o Inicio e a Entrada) e um pedaco separado do JS. Num pacote
 * so eram ~880 KB pra o celular ler e compilar antes do primeiro quadro, mesmo
 * que a pessoa so fosse olhar o Inicio. Os pedacos sao baixados logo depois que
 * o app abre (ver `adiantarPaginas`) e o service worker guarda todos, entao
 * trocar de tela continua instantaneo - e offline, na academia.
 */
const PAGINAS = {
  Treinos: () => import('./pages/Treinos'),
  Programas: () => import('./pages/Programas'),
  EditorRotina: () => import('./pages/EditorRotina'),
  Sessao: () => import('./pages/Sessao'),
  DetalheSessao: () => import('./pages/DetalheSessao'),
  Exercicios: () => import('./pages/Exercicios'),
  DetalheExercicio: () => import('./pages/DetalheExercicio'),
  Dieta: () => import('./pages/Dieta'),
  PlanoAlimentar: () => import('./pages/PlanoAlimentar'),
  Alimentos: () => import('./pages/Alimentos'),
  Diario: () => import('./pages/Diario'),
  ImprimirDiario: () => import('./pages/ImprimirDiario'),
  ImprimirDieta: () => import('./pages/ImprimirDieta'),
  ListaCompras: () => import('./pages/ListaCompras'),
  Progresso: () => import('./pages/Progresso'),
  Perfil: () => import('./pages/Perfil'),
  Lembretes: () => import('./pages/Lembretes'),
  Privacidade: () => import('./pages/Privacidade'),
  Amigos: () => import('./pages/Amigos'),
  Equipe: () => import('./pages/Equipe'),
  Aluno: () => import('./pages/Aluno'),
  ProgramaAluno: () => import('./pages/ProgramaAluno'),
  DietaAluno: () => import('./pages/DietaAluno'),
}

const Treinos = lazy(PAGINAS.Treinos)
const Programas = lazy(PAGINAS.Programas)
const EditorRotina = lazy(PAGINAS.EditorRotina)
const Sessao = lazy(PAGINAS.Sessao)
const DetalheSessao = lazy(PAGINAS.DetalheSessao)
const Exercicios = lazy(PAGINAS.Exercicios)
const DetalheExercicio = lazy(PAGINAS.DetalheExercicio)
const Dieta = lazy(PAGINAS.Dieta)
const PlanoAlimentar = lazy(PAGINAS.PlanoAlimentar)
const Alimentos = lazy(PAGINAS.Alimentos)
const Diario = lazy(PAGINAS.Diario)
const ImprimirDiario = lazy(PAGINAS.ImprimirDiario)
const ImprimirDieta = lazy(PAGINAS.ImprimirDieta)
const ListaCompras = lazy(PAGINAS.ListaCompras)
const Progresso = lazy(PAGINAS.Progresso)
const Perfil = lazy(PAGINAS.Perfil)
const Lembretes = lazy(PAGINAS.Lembretes)
const Privacidade = lazy(PAGINAS.Privacidade)
const Amigos = lazy(PAGINAS.Amigos)
const Equipe = lazy(PAGINAS.Equipe)
const Aluno = lazy(PAGINAS.Aluno)
const ProgramaAluno = lazy(PAGINAS.ProgramaAluno)
const DietaAluno = lazy(PAGINAS.DietaAluno)

/**
 * Baixa as outras telas quando o navegador estiver folgado: a primeira visita
 * a cada tela nao espera rede, e quem abre o app em casa e vai pra academia
 * sem internet ja tem tudo (mesmo antes de o service worker terminar de instalar).
 */
function adiantarPaginas() {
  const carregar = () => { for (const f of Object.values(PAGINAS)) f().catch(() => {}) }
  if ('requestIdleCallback' in window) window.requestIdleCallback(carregar, { timeout: 4000 })
  else setTimeout(carregar, 1500)
}

/** Enquanto o pedaco da tela chega (so na primeira vez, e quase sempre instantaneo). */
function CarregandoTela() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-label="Carregando">
      <div className="w-8 h-8 rounded-full border-2 border-line border-t-accent animate-spin" />
    </div>
  )
}

/** Erro numa tela nao derruba o app; trocar de rota zera o erro (ver LimiteDeErro). */
function RotasProtegidas({ children }: { children: ReactNode }) {
  const loc = useLocation()
  return (
    <LimiteDeErro key={loc.pathname}>
      <Suspense fallback={<CarregandoTela />}>{children}</Suspense>
    </LimiteDeErro>
  )
}

const TABS_BASE = [
  { to: '/', label: 'Início', icone: 'casa' },
  { to: '/treinos', label: 'Treino', icone: 'halter' },
  { to: '/dieta', label: 'Dieta', icone: 'prato' },
  { to: '/progresso', label: 'Progresso', icone: 'barras' },
  { to: '/perfil', label: 'Perfil', icone: 'pessoa' },
]

const TAB_DIARIO = { to: '/diario', label: 'Diário', icone: 'sangue' }

/** A aba acesa usa a cor da propria secao, nao o roxo de sempre. */
const corDaAba = (to: string) => secaoDe(to === '/' ? '/' : to).cor

function BarraSessao() {
  const sessao = useSessaoAtiva()
  const loc = useLocation()
  if (!sessao || loc.pathname.startsWith('/sessao') || loc.pathname.includes('/imprimir')) return null
  return (
    <Link to={`/sessao/${sessao.id}`}
      className="fixed left-3 right-3 bottom-[72px] z-40 flex items-center gap-3 px-4 h-12 rounded-2xl grad-accent glow-accent text-white shadow-xl anim-up safe-b">
      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
      <span className="text-[13px] font-bold flex-1 truncate">Treino em andamento - {sessao.nome}</span>
      <span className="text-[13px] font-bold">Voltar {'>'}</span>
    </Link>
  )
}

function TabBar() {
  const loc = useLocation()
  const perfil = usePerfil()
  if (loc.pathname.startsWith('/sessao/') || loc.pathname.includes('/imprimir')) return null

  const tabs = perfil.diabetesTipo1 === true
    ? [...TABS_BASE.slice(0, 3), TAB_DIARIO, ...TABS_BASE.slice(3)]
    : TABS_BASE

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-bg/95 backdrop-blur-lg border-t border-line safe-b">
      <div className="max-w-[560px] mx-auto flex">
        {tabs.map(t => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}
            className="flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors text-muted"
            style={({ isActive }) => (isActive ? { color: corDaAba(t.to) } : undefined)}>
            {({ isActive }) => (
              <>
                <Icone nome={t.icone} tamanho={22} traco={isActive ? 2.4 : 1.9} />
                <span className={`text-[10px] ${isActive ? 'font-bold' : 'font-medium'}`}>{t.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function AoTrocarDeRota() {
  const loc = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  return null
}

/**
 * Glicemia so existe pra quem ligou diabetes tipo 1 no perfil. Esconder a aba
 * nao basta: sem isso o /diario continua abrindo por link, por atalho da tela
 * inicial ou por historico do navegador.
 */
function SoDiabetes({ children }: { children: ReactNode }) {
  const perfil = usePerfilCarregado()
  if (!perfil) return null
  if (perfil.diabetesTipo1 !== true) return <Navigate to="/" replace />
  return <>{children}</>
}

/** Paginas de impressao (PDF) usam layout proprio, sem a moldura de app nem padding pra nav. */
function Miolo({ children }: { children: ReactNode }) {
  const loc = useLocation()
  if (loc.pathname.includes('/imprimir')) return <>{children}</>
  // --cor-secao desce pra arvore inteira: componente nenhum precisa saber em
  // que pagina esta, so usar a variavel
  return (
    <div className="max-w-[560px] mx-auto pb-24 min-h-full"
      style={{ ['--cor-secao' as string]: secaoDe(loc.pathname).cor }}>
      {children}
    </div>
  )
}

/**
 * Marca que a pessoa ja passou pela porta de entrada - entrando, criando conta
 * ou escolhendo usar sem conta. So a primeira abertura mostra aquela tela.
 */
const CHAVE_ENTRADA = 'onemore:entrada'

export default function App() {
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [entrada, setEntrada] = useState<'vendo' | 'mostrar' | 'ok'>('vendo')

  useEffect(() => {
    rodarSeed()
      .then(() => {
        setPronto(true)
        adiantarPaginas()
        // conserta XP de treino pago em dobro e total fora do ledger (ver sanearXP)
        sanearXP().catch(e => console.error('[xp] nao consegui conferir o ledger', e))
      })
      .catch(e => {
        console.error('[banco] nao abriu', e)
        setErro(String(e))
      })
  }, [])

  useEffect(() => {
    if (localStorage.getItem(CHAVE_ENTRADA) === '1') { setEntrada('ok'); return }
    // ja tem sessao valida (voltou noutro dia, ou outro aparelho): nao pergunta
    // de novo. Offline a chamada falha, e tudo bem - cai na tela, que tem a
    // saida "usar só neste aparelho".
    usuarioAtual()
      .then(u => {
        if (!u) return setEntrada('mostrar')
        localStorage.setItem(CHAVE_ENTRADA, '1')
        setEntrada('ok')
      })
      .catch(() => setEntrada('mostrar'))
  }, [])

  function passouDaEntrada() {
    localStorage.setItem(CHAVE_ENTRADA, '1')
    setEntrada('ok')
  }

  // rodizio dos lembretes: so faz algo depois que o usuario liberou notificacao
  useEffect(() => {
    if (!pronto) return
    return iniciarLembretes()
  }, [pronto])

  // sincroniza sozinho ao abrir, ao voltar pro app e quando a internet volta.
  // So roda depois da porta de entrada: antes disso nao ha sessao pra usar.
  useEffect(() => {
    if (!pronto || entrada !== 'ok') return
    // a primeira sincronizacao que da certo prova que ha conta: e a deixa pra
    // ligar o push e mandar a agenda (lembrete com o app fechado), sem esperar
    // o giro de 15 min dos lembretes
    let publicou = false
    return iniciarSyncAutomatico(() => {
      // o cartao de amigos so sai se mudou, e so fica guardado pra quem usa
      // amigos (ver lib/amigos.ts); falhar aqui nao e motivo de aviso
      publicarCartao().catch(() => {})
      if (publicou) return
      publicou = true
      publicarAgenda()
    })
  }, [pronto, entrada])

  if (erro) {
    // o detalhe tecnico ja foi pro console; pra quem usa, o que fazer
    return (
      <div role="alert" className="min-h-full flex items-center justify-center p-8 text-center">
        <div className="max-w-[320px]">
          <div className="flex justify-center mb-4 text-bad"><Icone nome="alerta" tamanho={40} /></div>
          <p className="font-bold mb-2">Não consegui abrir os dados deste aparelho</p>
          <p className="text-[13px] text-muted leading-relaxed mb-5">
            Costuma acontecer com o navegador em modo anônimo, sem espaço livre, ou com
            o OneMore aberto em outra aba durante uma atualização. Feche as outras abas
            e tente de novo.
          </p>
          <button onClick={() => location.reload()}
            className="h-11 px-6 rounded-xl grad-accent text-white font-bold text-sm">
            Tentar de novo
          </button>
        </div>
      </div>
    )
  }

  if (!pronto || entrada === 'vendo') {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-line border-t-accent animate-spin" />
      </div>
    )
  }

  if (entrada === 'mostrar') {
    return <LimiteDeErro><Entrada pronto={passouDaEntrada} /><Feedback /><AplicarTema /></LimiteDeErro>
  }

  return (
    <LimiteDeErro>
    <HashRouter>
      <AoTrocarDeRota />
      <Miolo>
        <RotasProtegidas>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/treinos" element={<Treinos />} />
          <Route path="/treinos/programas" element={<Programas />} />
          <Route path="/treinos/:id" element={<EditorRotina />} />
          <Route path="/sessao/:id" element={<Sessao />} />
          <Route path="/historico/:id" element={<DetalheSessao />} />
          <Route path="/exercicios" element={<Exercicios />} />
          <Route path="/exercicios/:id" element={<DetalheExercicio />} />
          <Route path="/dieta" element={<Dieta />} />
          <Route path="/dieta/plano" element={<PlanoAlimentar />} />
          <Route path="/dieta/imprimir" element={<ImprimirDieta />} />
          <Route path="/dieta/compras/imprimir" element={<ListaCompras />} />
          <Route path="/alimentos" element={<Alimentos />} />
          <Route path="/diario" element={<SoDiabetes><Diario /></SoDiabetes>} />
          <Route path="/diario/imprimir" element={<SoDiabetes><ImprimirDiario /></SoDiabetes>} />
          <Route path="/progresso" element={<Progresso />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/lembretes" element={<Lembretes />} />
          <Route path="/privacidade" element={<Privacidade />} />
          <Route path="/amigos" element={<Amigos />} />
          <Route path="/equipe" element={<Equipe />} />
          <Route path="/equipe/aluno/:id" element={<Aluno />} />
          <Route path="/equipe/aluno/:id/treino" element={<ProgramaAluno />} />
          <Route path="/equipe/aluno/:id/dieta" element={<DietaAluno />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </RotasProtegidas>
      </Miolo>
      <BarraSessao />
      <TabBar />
      <Feedback />
      <AplicarTema />
    </HashRouter>
    </LimiteDeErro>
  )
}
