import { refreshAll } from '$app/navigation'
import type { Route } from '@cella/org-ui'
import { collection, index, send, write } from '#lib/remote/collection.remote.ts'
import { item } from '#lib/remote/item.remote.ts'
import { accept, prove, shell } from '#lib/remote/session.remote.ts'
import { page as read, send as save, write as setting } from '#lib/remote/settings.remote.ts'

// How a page's writes reach the server, which its route names to the UI
// core (`useWrites().serve`): each form an instance of the route's `write`
// form of its own, keyed by the page's address, the write and the form
// (`write.for(key)`); a write its script posts by the route's `send`;
// each proof by `prove`; the queries the page reads, which the write's
// outcome brings back refreshed; and, read again after a write that
// took or reached a verdict, the shell's counts and theme, which the
// root layout's `shell` query reads, where the proof does not bring it.
const key = (at: Record<string, string>, name: string, n: string) => JSON.stringify({ at, write: name, n })

const reading = {
  after: () => shell().refresh(),
  again: () => refreshAll(),
}

const at = (collection: string, id: string | undefined): Record<string, string> => (id ? { collection, id } : { collection })

// A collection's page or an item's, posting to the collection's writes,
// and the item's where it is on one or names one, as a dropped card does.
// The shell's query is among those its proof brings back, in the flight
// that carries the outcome, so nothing reads it again after: refreshed
// apart, after the proof's queries land, it throws inside Svelte's flush
// (Svelte 5.57.2).
export const onCollection = (name: () => string, id: () => string | undefined): Route =>
  ({
    form: (w: string, n: string) => write.for(key(at(name(), id()), w, n)),
    send: (w: string, fields: [string, string][], other?: string, owner?: string) => send({ at: at(owner ?? name(), other ?? id()), write: w, fields }),
    prove: (run: string, proof: string) => prove({ run, proof }),
    touched: [collection, item, index, shell],
    ...reading,
    after: async () => {},
  }) as unknown as Route

// A settings page, posting to the writes its slice saves by, with the one
// thing it is of where its address names one (`id`), or to another
// settings page's where a write names it, as the changes to propose are
// posted to the page the first was made on; it reads through its `page`
// query, which a save that took or reached a verdict reads again with the
// shell's, as the theme it wears may have changed; a specimen, which
// reads nothing of its own (`own`), the shell's alone.
const of = (settings: string, id: string): Record<string, string> => (id ? { settings, id } : { settings })

export const onSettings = (page: () => string, own = true, id: () => string = () => ''): Route =>
  ({
    form: (w: string, n: string) => setting.for(key(of(page(), id()), w, n)),
    send: (w: string, fields: [string, string][], other?: string, owner?: string) => save({ at: of(owner ?? page(), other ?? id()), write: w, fields }),
    prove: (run: string, proof: string) => prove({ run, proof }),
    touched: [],
    ...reading,
    after: () => Promise.all([shell().refresh(), own && read({ page: page(), id: id() }).refresh()]).then(() => undefined),
  }) as unknown as Route

// An invitation's link, whose one write is its acceptance, sent and proved
// by the `accept` command for the link's holder, as no session is open
// yet. Once it settles it reads nothing again: the invitee's own page
// loads afresh under the new session, and the shell refreshed here first
// would turn the gate into the signed-in shell and remount this page to
// ask for a link now spent, before the browser leaves it.
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
    after: async () => {},
  }) as unknown as Route
