import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Tipografías del brief, empaquetadas localmente (sin Google Fonts)
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/public-sans'
import './estilos.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
