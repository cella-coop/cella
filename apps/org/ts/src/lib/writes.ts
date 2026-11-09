import { invalidate, refreshAll } from '$app/navigation'
import type { Route } from '@cella/org-ui'
import { collection, index, send, write } from '#lib/remote/collection.remote.ts'
import { item } from '#lib/remote/item.remote.ts'
import { accept, prove } from '#lib/remote/session.remote.ts'
import { send as save, write as setting } from '#lib/remote/settings.remote.ts'

// How a page's writes reach the server, which its route names to the UI
// core (`useWrites().serve`): each form an instance of the route's `write`
// form of its own, keyed by the page's address, the write and the form
// (`write.for(key)`); a write its script posts by the route's `send`;
// each proof by `prove`; the queries the page reads, which the write's
// outcome brings back refreshed; and, read again after a write that
// took or reached a verdict, the shell's counts and theme, which its load reads
// (`cella:shell`).
const key = (at: Record<string, string>, name: string, n: string) => JSON.stringify({ at, write: name, n })

const reading = {
  after: () => invalidate('cella:shell'),
  again: () => refreshAll(),
}

const at = (collection: string, id: string | undefined): Record<string, string> => (id ? { collection, id } : { collection })

// A collection's page or an item's, posting to the collection's writes,
// and the item's where it is on one or names one, as a dropped card does.
export const onCollection = (name: () => string, id: () => string | undefined): Route =>
  ({
    form: (w: string, n: string) => write.for(key(at(name(), id()), w, n)),
    send: (w: string, fields: [string, string][], other?: string, owner?: string) => send({ at: at(owner ?? name(), other ?? id()), write: w, fields }),
    prove: (run: string, proof: string) => prove({ run, proof }),
    touched: [collection, item, index],
    ...reading,
  }) as unknown as Route

// A settings page, posting to the writes its slice saves by; it reads
// through its load, which a settled save reads again.
export const onSettings = (page: () => string): Route =>
  ({
    form: (w: string, n: string) => setting.for(key({ settings: page() }, w, n)),
    send: (w: string, fields: [string, string][]) => save({ at: { settings: page() }, write: w, fields }),
    prove: (run: string, proof: string) => prove({ run, proof }),
    touched: [],
    ...reading,
  }) as unknown as Route

// An invitation's link, whose one write is its acceptance, sent and proved
// by the `accept` command for the link's holder, as no session is open
// yet.
export const onJoin = (secret: () => string): Route =>
  ({
    form: () => {
      throw new Error('an invitation’s link has no form')
    },
    send: (_: string, fields: [string, string][]) => {
      const f = new Map(fields)
      return accept({ secret: secret(), key: f.get('key') ?? '', label: f.get('label') ?? '', run: '', proof: '' })
    },
    prove: (run: string, proof: string) => accept({ secret: secret(), key: '', label: '', run, proof }),
    touched: [],
    ...reading,
  }) as unknown as Route
