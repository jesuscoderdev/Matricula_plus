import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Tipografías del manual de marca Proliferante, empaquetadas localmente (sin Google Fonts):
// MuseoModerno para titulares, Poppins para interfaz, cuerpo y cifras, Caveat Brush como acento.
// MuseoModerno 700/800 (logo Matrícula+) también se declara en index.html: la usa ya la pantalla de carga
import '@fontsource/museomoderno/latin-400.css'
import '@fontsource/museomoderno/latin-500.css'
import '@fontsource/museomoderno/latin-600.css'
import '@fontsource/museomoderno/latin-700.css'
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-500.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/poppins/latin-800.css'
import '@fontsource/caveat-brush/latin-400.css'
import './estilos.css'
import './tema'  // aplica el tema (claro/oscuro) antes del primer render
import Inicio from './Inicio'
import Asistente from './proli/Asistente'
import PaginaProli from './proli/PaginaProli'

// govtech.proliferante.com/proli: la página propia de Proli (solo la conversación, sin los demos)
const paginaProli = /^\/proli\/?$/i.test(window.location.pathname)

// Versión nueva publicada: el service worker nuevo toma el control y la página se recarga para
// mostrarla ya, sin esperar a una segunda visita. El visitante sigue en la misma pantalla
// (src/recordar.ts). La primera instalación no recarga. Cada 30 min se busca una versión nueva
// (el tótem pasa el día entero con la página abierta).
if ('serviceWorker' in navigator) {
  const habia = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (habia) window.location.reload() })
  window.setInterval(() => { navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {}) }, 30 * 60 * 1000)
}

// Proli vive fuera de las pantallas: la conversación sigue aunque el visitante cambie de pantalla o de demo
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {paginaProli ? <PaginaProli /> : <><Inicio /><Asistente /></>}
  </StrictMode>,
)
