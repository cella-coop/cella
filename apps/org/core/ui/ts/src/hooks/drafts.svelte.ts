import { took, type Answer } from '../post.ts'

// A write accepted by the reader, pick, a typed value committed, an
// icon chosen, but not yet known to have reached the server: kept in
// this browser the moment it is accepted, so a reload right after it,
// before the signed write it still has to make survives such a reload,
// finds it posted again once the page that made it opens anew. Keyed by
// where it was made and what it changes, so accepting the same field
// again simply replaces what was kept, and a write that lands is
// dropped; one refused stands, for the write it names to try once more.
const prefix = 'cella:draft:'

export function stash(id: string, write: string, fields: [string, string][]): void {
  try {
    localStorage.setItem(prefix + id, JSON.stringify({ write, fields }))
  } catch {
    // A draft kept nowhere is simply not replayed: the write already
    // under way is still tried as before.
  }
}

export function unstash(id: string): void {
  try {
    localStorage.removeItem(prefix + id)
  } catch {
    // Nothing was kept, or it cannot be reached: either way, done.
  }
}

// Every draft kept under `scope` (a page's path, say), posted again
// through `send`; one taken is dropped. One refused, or that got no
// answer (offline), is left as it was, for the next opening to try
// again; one that cannot even be read is dropped, since trying it again
// unchanged would only fail the same way.
export function replay(scope: string, send: (write: string, fields: [string, string][]) => Promise<Answer>): void {
  const under = prefix + scope
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k?.startsWith(under)) {
      keys.push(k)
    }
  }
  for (const k of keys) {
    const raw = localStorage.getItem(k)
    if (!raw) {
      continue
    }
    let draft: { write: string; fields: [string, string][] }
    try {
      draft = JSON.parse(raw) as { write: string; fields: [string, string][] }
    } catch {
      localStorage.removeItem(k)
      continue
    }
    send(draft.write, draft.fields).then(
      (a) => {
        if (took(a)) {
          localStorage.removeItem(k)
        }
      },
      () => {
        // Got no answer: left kept, tried again at the next opening.
      },
    )
  }
}
