/**
 * Autoriza a Proli a usar el calendario y el correo de hello@proliferante.com, una sola vez y sin clave de
 * cuenta de servicio (la organización las bloquea: iam.managed.disableServiceAccountKeyCreation).
 *
 * Abre el navegador; se inicia sesión con hello@ y se acepta. El permiso (refresh token) se escribe en
 * web/.env.local junto con el ID y el secreto del cliente; nada de eso se imprime. Luego esos tres
 * valores se copian a Vercel (Settings → Environment Variables, Production):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 *
 * Uso (desde web/):  node scripts/google-autorizar.mjs "C:\ruta\client_secret_....json"
 * El cliente debe ser de tipo «App de escritorio» en un proyecto con público «Interno».
 * Para revocar el permiso: myaccount.google.com → Seguridad → Apps de terceros, con la sesión de hello@.
 */
import { createServer } from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'

const ALCANCES = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/gmail.send']
const CUENTA = 'hello@proliferante.com'
const ENV = join(fileURLToPath(import.meta.url), '..', '..', '.env.local')

const ruta = process.argv[2]
if (!ruta || !existsSync(ruta)) { console.error('Indica la ruta del archivo client_secret_….json'); process.exit(1) }
const json = JSON.parse(readFileSync(ruta, 'utf-8'))
const cliente = json.installed
if (!cliente) { console.error('El cliente debe ser de tipo «App de escritorio».'); process.exit(1) }

const verificador = randomBytes(48).toString('base64url')
const reto = createHash('sha256').update(verificador).digest('base64url')
const estado = randomBytes(16).toString('hex')

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1')
  if (url.pathname !== '/') { res.writeHead(404).end(); return }
  const fin = (texto, ok) => { res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' }).end(`<p style="font:18px system-ui;padding:2rem">${texto}</p>`); servidor.close() }
  if (url.searchParams.get('state') !== estado) return fin('Solicitud inválida.', false)
  if (url.searchParams.get('error')) { console.error('Google respondió:', url.searchParams.get('error')); return fin('No se dio el permiso. Puedes cerrar esta pestaña.', false) }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: url.searchParams.get('code'), client_id: cliente.client_id, client_secret: cliente.client_secret,
      redirect_uri: redireccion, grant_type: 'authorization_code', code_verifier: verificador }),
  })
  const t = await r.json()
  if (!r.ok || !t.refresh_token) { console.error('No llegó el permiso:', t.error ?? r.status, t.error_description ?? ''); return fin('Algo falló; revisa la terminal.', false) }
  const concedidos = (t.scope ?? '').split(' ')
  const faltan = ALCANCES.filter((a) => !concedidos.includes(a))
  // ¿Con qué cuenta se autorizó? El calendario principal se llama como la cuenta
  const cal = await (await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', { headers: { Authorization: `Bearer ${t.access_token}` } })).json()
  if (cal.id !== CUENTA) { console.error(`Se autorizó con ${cal.id ?? 'otra cuenta'}, no con ${CUENTA}. Vuelve a ejecutar e inicia sesión con ${CUENTA}.`); return fin(`Debes iniciar sesión con ${CUENTA}.`, false) }
  // Escribe (o reemplaza) las tres variables en .env.local, sin imprimirlas
  const valores = { GOOGLE_CLIENT_ID: cliente.client_id, GOOGLE_CLIENT_SECRET: cliente.client_secret, GOOGLE_REFRESH_TOKEN: t.refresh_token }
  let env = existsSync(ENV) ? readFileSync(ENV, 'utf-8') : ''
  for (const [k, v] of Object.entries(valores)) {
    const linea = `${k}=${v}`
    env = new RegExp(`^${k}=.*$`, 'm').test(env) ? env.replace(new RegExp(`^${k}=.*$`, 'm'), linea) : `${env.replace(/\s*$/, '\n')}${linea}\n`
  }
  writeFileSync(ENV, env)
  console.log(`Listo: Proli quedó autorizado con ${cal.id}.`)
  console.log(faltan.length ? `Ojo: faltó aceptar ${faltan.join(', ')}. Vuelve a ejecutar y marca todos los permisos.` : 'Permisos: calendario y envío de correo.')
  console.log('Se guardaron GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN en web/.env.local (no se muestran aquí).')
  fin('¡Listo! Proli quedó autorizado. Ya puedes cerrar esta pestaña.', true)
})

let redireccion = ''
servidor.listen(0, '127.0.0.1', () => {
  redireccion = `http://127.0.0.1:${servidor.address().port}`
  const autorizar = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: cliente.client_id, redirect_uri: redireccion, response_type: 'code', scope: ALCANCES.join(' '),
    access_type: 'offline', prompt: 'consent', login_hint: CUENTA, state: estado, code_challenge: reto, code_challenge_method: 'S256',
  })}`
  console.log(`Se abrirá el navegador. Inicia sesión con ${CUENTA} y acepta los permisos.`)
  console.log(`Si no se abre, copia esta dirección en el navegador:\n${autorizar}\n`)
  // Sin pasar por la consola: la dirección lleva «&» y la consola de Windows la cortaría
  if (process.platform === 'win32') execFile('rundll32', ['url.dll,FileProtocolHandler', autorizar])
  else execFile('open', [autorizar])
})
