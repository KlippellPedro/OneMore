import { useEffect, useState, type ReactNode } from 'react'
import { HashRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { rodarSeed } from './db/seed'
import { Feedback } from './components/Feedback'
import { Icone } from './components/Icone'
import { useSessaoAtiva, usePerfil } from './state/hooks'
import { Link } from 'react-router-dom'

import Home from './pages/Home'
import Treinos from './pages/Treinos'
import Programas from './pages/Programas'
import EditorRotina from './pages/EditorRotina'
import Sessao from './pages/Sessao'
import Exercicios from './pages/Exercicios'
import DetalheExercicio from './pages/DetalheExercicio'
import Dieta from './pages/Dieta'
import PlanoAlimentar from './pages/PlanoAlimentar'
import Alimentos from './pages/Alimentos'
import Diario from './pages/Diario'
import ImprimirDiario from './pages/ImprimirDiario'
import ImprimirDieta from './pages/ImprimirDieta'
import Progresso from './pages/Progresso'
import Perfil from './pages/Perfil'

const TABS_BASE = [
  { to: '/', label: 'Inicio', icone: 'casa' },
  { to: '/treinos', label: 'Treino', icone: 'halter' },
  { to: '/dieta', label: 'Dieta', icone: 'prato' },
  { to: '/progresso', label: 'Progresso', icone: 'barras' },
  { to: '/perfil', label: 'Perfil', icone: 'pessoa' },
]

const TAB_DIARIO = { to: '/diario', label: 'Diario', icone: 'sangue' }

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
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${isActive ? 'text-accent' : 'text-muted'}`}>
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

/** Paginas de impressao (PDF) usam layout proprio, sem a moldura de app nem padding pra nav. */
function Miolo({ children }: { children: ReactNode }) {
  const loc = useLocation()
  if (loc.pathname.includes('/imprimir')) return <>{children}</>
  return <div className="max-w-[560px] mx-auto pb-24 min-h-full">{children}</div>
}

export default function App() {
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    rodarSeed().then(() => setPronto(true)).catch(e => setErro(String(e)))
  }, [])

  if (erro) {
    return (
      <div className="min-h-full flex items-center justify-center p-8 text-center">
        <div>
          <div className="flex justify-center mb-4 text-bad"><Icone nome="alerta" tamanho={40} /></div>
          <p className="font-bold mb-2">Nao consegui abrir o banco local</p>
          <p className="text-[13px] text-muted">{erro}</p>
        </div>
      </div>
    )
  }

  if (!pronto) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-line border-t-accent animate-spin" />
      </div>
    )
  }

  return (
    <HashRouter>
      <AoTrocarDeRota />
      <Miolo>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/treinos" element={<Treinos />} />
          <Route path="/treinos/programas" element={<Programas />} />
          <Route path="/treinos/:id" element={<EditorRotina />} />
          <Route path="/sessao/:id" element={<Sessao />} />
          <Route path="/exercicios" element={<Exercicios />} />
          <Route path="/exercicios/:id" element={<DetalheExercicio />} />
          <Route path="/dieta" element={<Dieta />} />
          <Route path="/dieta/plano" element={<PlanoAlimentar />} />
          <Route path="/dieta/imprimir" element={<ImprimirDieta />} />
          <Route path="/alimentos" element={<Alimentos />} />
          <Route path="/diario" element={<Diario />} />
          <Route path="/diario/imprimir" element={<ImprimirDiario />} />
          <Route path="/progresso" element={<Progresso />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Miolo>
      <BarraSessao />
      <TabBar />
      <Feedback />
    </HashRouter>
  )
}
