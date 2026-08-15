// Punto de arranque para hosts que requieren un "archivo de inicio" (Hostinger, cPanel/Passenger, etc.).
// Arranca Next.js en producción usando el build ya compilado (.next). Escucha en el puerto que asigne el host.
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const port = parseInt(process.env.PORT || '3000', 10)
const hostname = process.env.HOST || '0.0.0.0'
const app = next({ dev: false, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer((req, res) => {
    handle(req, res, parse(req.url, true))
  }).listen(port, hostname, () => {
    console.log(`> AyudaCol en producción, escuchando en http://${hostname}:${port}`)
  })
}).catch((err) => {
  console.error('Error al arrancar Next:', err)
  process.exit(1)
})
