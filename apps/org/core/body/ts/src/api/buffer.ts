import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { b64 } from '../models/body.ts'

// One update merged since a save, and who posted it.
export interface Held {
  author: string
  update: Uint8Array
}

// What a buffer keeps of one body: the snapshot its updates build on and
// the updates, in the order they merged.
export interface Kept {
  key: string
  base: Uint8Array
  updates: Held[]
}

// Where the updates since each body's last save are kept, so a server
// that stops loses none it merged: appended as they merge, the base
// written with a body's first, and cleared at each save.
export interface Buffer {
  append(key: string, base: Uint8Array, held: Held): void
  clear(key: string): void
  held(): Kept[]
}

// A buffer in memory, which a test's restart hands the next session.
export function memory(): Buffer {
  const kept = new Map<string, Kept>()
  return {
    append(key, base, held) {
      const k = kept.get(key) ?? { key, base, updates: [] }
      kept.set(key, k)
      k.updates.push(held)
    },
    clear(key) {
      kept.delete(key)
    },
    held: () => [...kept.values()].map((k) => ({ ...k, updates: [...k.updates] })),
  }
}

// A buffer beside the scope's state, a file a body in `dir`: a line with
// its base, then a line an update, each its author and its bytes in
// base64. Each line is appended whole and flushed before the update is
// relayed; a line a crash cut short has no newline and is left out.
export function files(dir: string): Buffer {
  mkdirSync(dir, { recursive: true })
  const path = (key: string) => join(dir, encodeURIComponent(key))
  return {
    append(key, base, held) {
      const p = path(key)
      const head = existsSync(p) ? '' : `base\t${b64.encode(base)}\n`
      appendFileSync(p, `${head}${encodeURIComponent(held.author)}\t${b64.encode(held.update)}\n`, { flush: true })
    },
    clear(key) {
      rmSync(path(key), { force: true })
    },
    held() {
      const out: Kept[] = []
      for (const name of readdirSync(dir)) {
        const text = readFileSync(join(dir, name), 'utf8')
        const lines = text.split('\n').slice(0, -1)
        const [first, ...rest] = lines.map((l) => l.split('\t'))
        if (first?.[0] !== 'base') {
          continue
        }
        out.push({
          key: decodeURIComponent(name),
          base: b64.decode(first[1]),
          updates: rest.map(([author, bytes]) => ({ author: decodeURIComponent(author), update: b64.decode(bytes) })),
        })
      }
      return out
    },
  }
}
