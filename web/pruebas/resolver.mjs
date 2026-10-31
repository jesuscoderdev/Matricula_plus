// Las funciones de api/ importan './x.js' (lo que pide Vercel con "type": "module"); en las pruebas el
// archivo es './x.ts'. Igual que en scripts/servidor-local.mjs.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { registerHooks } from 'node:module'

registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith('.') && especificador.endsWith('.js') && contexto.parentURL?.includes('/api/')) {
      const ts = new URL(especificador.replace(/\.js$/, '.ts'), contexto.parentURL)
      if (existsSync(fileURLToPath(ts))) return siguiente(ts.href, contexto)
    }
    return siguiente(especificador, contexto)
  },
})
