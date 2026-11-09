import { Session } from '@cella/org-body/api'
import type { May } from '@cella/org-db'
import { using } from './db.ts'
import { slices } from './slices.ts'

// Whether a person holds a power, from the one slice that serves it, the
// membership feat; where none does, as in a scope of core alone, no one
// holds any, and every body opens read-only.
const serving = slices.filter((s) => s.may)
if (serving.length > 1) {
  throw new Error(`${serving.map((s) => s.name).join(' and ')} both say who holds a power`)
}
const may: May = serving[0]?.may ?? (async () => false)

// Core body's live session of every open body, which the shell starts
// with its connections and membership's `may`, each collection whose
// records keep a body mounted in it by its kind. It lives in this server
// process, kept on `globalThis` so that a reloaded module in development
// finds the same open bodies.
function start(): Session {
  const session = new Session({ using, may })
  for (const s of slices) {
    for (const [kind, c] of Object.entries(s.collections ?? {})) {
      if (c.body) {
        session.mount({ kind, ...c.body })
      }
    }
  }
  return session
}

const key = Symbol.for('cella.body.session')
export const session = ((globalThis as Record<symbol, unknown>)[key] ??= start()) as Session
