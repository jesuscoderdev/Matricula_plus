// Datos de Movilidad+ incrustados en el build "archivo" (ver vite.config.ts); en el build normal es null
declare module 'virtual:movilidad-embebido' {
  const datos: unknown
  export default datos
}
