import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { restaurarTemaSalvo } from './lib/tema'

// antes do primeiro render: senao o app abre roxo e muda de cor em seguida
restaurarTemaSalvo()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
