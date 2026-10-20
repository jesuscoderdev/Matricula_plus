import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Tipografías empaquetadas localmente (sin Google Fonts): Fraunces para titulares,
// Inter Tight para la interfaz e IBM Plex Mono para cifras y etiquetas.
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/inter-tight'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './estilos.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
