// A TEST-ONLY trace of what a scenario reaches, which `cella test e2e
// --overlap` loads into the scenario and every server it starts
// (`NODE_OPTIONS=--import`), never `cella serve`: named a file by
// `CELLA_E2E_TRACE`, each process appends to it, once each, a line
// `command <op>` for each write it submits to the notary, `cella.submit`'s
// or `cella.follow`'s, refused or not; `read <schema>.<name>` for each
// relation a query's text names, of which the run keeps those the
// database holds; and `route <method> <path>` for each request its server
// answers, a remote function by its id, its assets left out, which the run
// matches against the shell's route tree.

import { appendFileSync } from 'node:fs'
import http from 'node:http'
import pg from 'pg'

const file = process.env.CELLA_E2E_TRACE

const seen = new Set<string>()
const note = (line: string) => {
  if (seen.has(line) || !file) return
  seen.add(line)
  appendFileSync(file, `${line}\n`)
}

// A path as its route: `/_app/remote/<hash>/<name>` without its payload, a
// page's data as its page.
export function route(url: string): string | undefined {
  const path = url.split('?')[0].replace(/\/__data\.json$/, '') || '/'
  if (path.startsWith('/_app/remote/')) return path.split('/').slice(0, 5).join('/')
  if (path.startsWith('/_app/') || /\.(js|css|map|woff2?|ttf|otf|svg|png|jpe?g|gif|webp|ico|txt|webmanifest)$/i.test(path)) return undefined
  return path
}

if (file) {
  const query = pg.Client.prototype.query as (...args: unknown[]) => unknown
  pg.Client.prototype.query = function (this: pg.Client, ...args: unknown[]) {
    const [first, second] = args
    const config = typeof first === 'object' && first !== null ? (first as { text?: unknown; values?: unknown }) : undefined
    const text = typeof first === 'string' ? first : config?.text
    const values = Array.isArray(second) ? second : config?.values
    if (typeof text === 'string') {
      const op = /cella\.(submit|follow)\(/.test(text) && Array.isArray(values) ? values[0] : undefined
      if (typeof op === 'string') note(`command ${op}`)
      else if (/^\s*(WITH|SELECT)\b/i.test(text)) {
        for (const [, schema, name] of text.matchAll(/\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/g)) note(`read ${schema}.${name}`)
      }
    }
    return query.apply(this, args)
  } as typeof pg.Client.prototype.query

  const emit = http.Server.prototype.emit as (...args: unknown[]) => boolean
  http.Server.prototype.emit = function (this: http.Server, event: string | symbol, ...args: unknown[]) {
    if (event === 'request') {
      const req = args[0] as http.IncomingMessage
      const path = route(req.url ?? '/')
      if (path) note(`route ${req.method} ${path}`)
    }
    return emit.apply(this, [event, ...args])
  } as typeof http.Server.prototype.emit
}
