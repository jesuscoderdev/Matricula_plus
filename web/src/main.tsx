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

// Proli vive fuera de las pantallas: la conversación sigue aunque el visitante cambie de pantalla o de demo
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Inicio />
    <Asistente />
  </StrictMode>,
)
