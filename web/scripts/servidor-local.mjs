/**
 * Servidor local para probar Proli de punta a punta sin Vercel: sirve el sitio compilado (dist/)
 * y las funciones /api/proli (api/proli.ts), /api/conversa y /api/registro (Proli V9) en http://localhost:4174.
 *
 * Sin Supabase en .env.local, lo que guarda Proli V9 va a web/.datos-locales/registros.jsonl (Git lo ignora).
 *
 * Uso (desde web/):
 *   npm run build
 *   node scripts/servidor-local.mjs
 *
 * La clave se lee de web/.env.local (ANTHROPIC_API_KEY=...), que Git ignora. Sin clave, /api/proli
 * responde 503 y Proli funciona con sus respuestas sin conexión.
 */
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { registerHooks } from 'node:module'

const WEB = join(fileURLToPath(import.meta.url), '..', '..')
const DIST = join(WEB, 'dist')
const PUERTO = 4174

// api/ importa './x.js' (lo que pide Vercel con "type": "module"); en local el archivo es './x.ts'
registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith('.') && especificador.endsWith('.js') && contexto.parentURL?.includes('/api/')) {
      const ts = new URL(especificador.replace(/\.js$/, '.ts'), contexto.parentURL)
      if (existsSync(fileURLToPath(ts))) return siguiente(ts.href, contexto)
    }
    return siguiente(especificador, contexto)
  },
})

const env = join(WEB, '.env.local')
if (existsSync(env)) process.loadEnvFile(env)
console.log(process.env.ANTHROPIC_API_KEY ? 'Clave de la API: encontrada en .env.local' : 'Sin clave: Proli funcionará sin conexión')
if (!process.env.SUPABASE_URL && !process.env.PROLI_ALMACEN_LOCAL) {
  mkdirSync(join(WEB, '.datos-locales'), { recursive: true })
  process.env.PROLI_ALMACEN_LOCAL = join(WEB, '.datos-locales', 'registros.jsonl')
  console.log(`Sin Supabase: los registros de Proli V9 van a ${process.env.PROLI_ALMACEN_LOCAL}`)
}
const FUNCIONES = {
  '/api/proli': (await import(pathToFileURL(join(WEB, 'api', 'proli.ts')).href)).POST,
  '/api/conversa': (await import(pathToFileURL(join(WEB, 'api', 'conversa.ts')).href)).POST,
  '/api/registro': (await import(pathToFileURL(join(WEB, 'api', 'registro.ts')).href)).POST,
  '/api/disponibilidad': (await import(pathToFileURL(join(WEB, 'api', 'disponibilidad.ts')).href)).POST,
  '/api/recordatorios': (await import(pathToFileURL(join(WEB, 'api', 'recordatorios.ts')).href)).POST,
}

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.geojson': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json' }

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PUERTO}`)
  const POST = FUNCIONES[url.pathname]
  if (POST && req.method === 'POST') {
    const trozos = []
    for await (const t of req) trozos.push(t)
    const control = new AbortController()
    res.on('close', () => { if (!res.writableEnded) control.abort() })
    const respuesta = await POST(new Request(url, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
      body: Buffer.concat(trozos), signal: control.signal,
    }))
    res.writeHead(respuesta.status, Object.fromEntries(respuesta.headers))
    if (respuesta.body) for await (const t of respuesta.body) res.write(t)
    return res.end()
  }
  let ruta = normalize(join(DIST, decodeURIComponent(url.pathname)))
  if (!ruta.startsWith(DIST) || !existsSync(ruta) || statSync(ruta).isDirectory()) ruta = join(DIST, 'index.html')
  res.writeHead(200, { 'Content-Type': TIPOS[extname(ruta)] ?? 'application/octet-stream' })
  res.end(readFileSync(ruta))
}).listen(PUERTO, '127.0.0.1', () => console.log(`Sitio y Proli en http://localhost:${PUERTO}`))
