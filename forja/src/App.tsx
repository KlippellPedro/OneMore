import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { rodarSeed } from './db/seed'
import { Feedback } from './components/Feedback'
import { useSessaoAtiva } from './state/hooks'
import { Link } from 'react-router-dom'

import Home from './pages/Home'
import Treinos from './pages/Treinos'
import EditorRotina from './pages/EditorRotina'
import Sessao from './pages/Sessao'
import Exercicios from './pages/Exercicios'
import DetalheExercicio from './pages/DetalheExercicio'
import Dieta from './pages/Dieta'
import PlanoAlimentar from './pages/PlanoAlimentar'
import Alimentos from './pages/Alimentos'
import Progresso from './pages/Progresso'
import Perfil from './pages/Perfil'

const TABS = [
  { to: '/', label: 'Inicio', icone: 'casa' },
  { to: '/treinos', label: 'Treino', icone: 'halter' },
  { to: '/dieta', label: 'Dieta', icone: 'prato' },
  { to: '/progresso', label: 'Progresso', icone: 'grafico' },
  { to: '/perfil', label: 'Perfil', icone: 'pessoa' },
]

function Icone({ nome, ativo }: { nome: string; ativo: boolean }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: ativo ? 2.4 : 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<string, React.ReactNode> = {
    casa: <><path {...p} d="M3 10.5 12 3l9 7.5" /><path {...p} d="M5 9.5V21h14V9.5" /></>,
    halter: <><path {...p} d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" /></>,
    prato: <><circle {...p} cx="12" cy="12" r="8" /><circle {...p} cx="12" cy="12" r="3.2" /></>,
    grafico: <><path {...p} d="M4 20V10M10 20V5M16 20v-7M22 20H2" /></>,
    pessoa: <><circle {...p} cx="12" cy="8" r="3.6" /><path {...p} d="M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6" /></>,
  }
  return <svg viewBox="0 0 24 24" className="w-[22px] h-[22px]">{paths[nome]}</svg>
}

function BarraSessao() {
  const sessao = useSessaoAtiva()
  const loc = useLocation()
  if (!sessao || loc.pathname.startsWith('/sessao')) return null
  return (
    <Link to={`/sessao/${sessao.id}`}
      className="fixed left-3 right-3 bottom-[72px] z-40 flex items-center gap-3 px-4 h-12 rounded-2xl bg-accent text-[#12080a] shadow-xl anim-up safe-b">
      <span className="w-2 h-2 rounded-full bg-[#12080a] animate-pulse" />
      <span className="text-[13px] font-bold flex-1 truncate">Treino em andamento - {sessao.nome}</span>
      <span className="text-[13px] font-bold">Voltar {'>'}</span>
    </Link>
  )
}

function TabBar() {
  const loc = useLocation()
  if (loc.pathname.startsWith('/sessao/')) return null
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-bg/95 backdrop-blur-lg border-t border-line safe-b">
      <div className="max-w-[560px] mx-auto flex">
        {TABS.map(t => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${isActive ? 'text-accent' : 'text-muted'}`}>
            {({ isActive }) => (
              <>
                <Icone nome={t.icone} ativo={isActive} />
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
          <p className="text-4xl mb-4">{'⚠️'}</p>
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
      <div className="max-w-[560px] mx-auto pb-24 min-h-full">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/treinos" element={<Treinos />} />
          <Route path="/treinos/:id" element={<EditorRotina />} />
          <Route path="/sessao/:id" element={<Sessao />} />
          <Route path="/exercicios" element={<Exercicios />} />
          <Route path="/exercicios/:id" element={<DetalheExercicio />} />
          <Route path="/dieta" element={<Dieta />} />
          <Route path="/dieta/plano" element={<PlanoAlimentar />} />
          <Route path="/alimentos" element={<Alimentos />} />
          <Route path="/progresso" element={<Progresso />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BarraSessao />
      <TabBar />
      <Feedback />
    </HashRouter>
  )
}
