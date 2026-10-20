import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Tipografías empaquetadas localmente (sin Google Fonts): Fraunces para titulares,
// Inter Tight para la interfaz e IBM Plex Mono para cifras y etiquetas.
import '@fontsource-variable/fraunces/opsz.css'
import '@fontsource-variable/inter-tight'
// Montserrat Alternates (logo Matrícula+) se declara en index.html: la usa ya la pantalla de carga
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import './estilos.css'
import './tema'  // aplica el tema (claro/oscuro) antes del primer render
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
