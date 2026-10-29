import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { restaurarTemaSalvo } from './lib/tema'
import { escutarInstalacao } from './lib/instalar'

// antes do primeiro render: senao o app abre roxo e muda de cor em seguida
restaurarTemaSalvo()
// o convite de instalar do Chrome dispara uma vez so, logo ao carregar
escutarInstalacao()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
