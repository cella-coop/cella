import { took, type Answer } from '../post.ts'

// A write accepted by the reader, a typed value committed, a pick made,
// but not yet known to have reached the server: kept in this browser the
// moment it is accepted, so a reload right after it, before the signed
// write it still has to make survives such a reload, is posted again
// once the page that made it opens anew. `id` is this browser's own name
// for what it keeps: the signed-in person and the demo copy (its join
// code, fresh on every copy and on every reset of one, so a copy reset
// in place is never mistaken for the one that made the draft), the page
// and the field, so a draft never reaches the wrong person, the wrong
// copy or the wrong write; callers build it, never this module, which
// keeps no identity of its own ([layering](../../../index.md)).
export interface Draft {
  write: string
  fields: [string, string][]
  // What the field read before this change, compared against what the
  // page now shows before replaying it: unmatched, the field moved since
  // and the draft is dropped rather than overwriting it.
  was?: string
  // When this was kept, `Date.now()`: a draft older than a day is never
  // replayed, only dropped.
  ts: number
  // Lets a save's own acknowledgement remove only the draft it carried,
  // never a newer one kept under the same id meanwhile.
  token: string
}

const prefix = 'cella:draft:'
const day = 24 * 60 * 60 * 1000

// A property's own name for its draft: who kept it, on which demo copy,
// on which page and which field, so `PropEdit`'s stash and `Properties`'
// replay, built apart, always agree on it.
export const propertyDraftId = (actor: string, copy: string, pathname: string, field: string): string => `${actor}|${copy}:${pathname}:${field}`

const token = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export function stash(id: string, write: string, fields: [string, string][], was?: string): string {
  const t = token()
  try {
    localStorage.setItem(prefix + id, JSON.stringify({ write, fields, was, ts: Date.now(), token: t } satisfies Draft))
  } catch {
    // A draft kept nowhere is simply not replayed: the write already
    // under way is still tried as before.
  }
  return t
}

// Removes the draft kept for `id`, but only where `token` is not given,
// or names the one still there: a newer draft kept under the same id
// since, by a later edit, is never the one a stale acknowledgement meant
// to clear.
export function unstash(id: string, token?: string): void {
  try {
    if (token !== undefined) {
      const raw = localStorage.getItem(prefix + id)
      if (!raw) {
        return
      }
      const kept = JSON.parse(raw) as Partial<Draft>
      if (kept.token !== token) {
        return
      }
    }
    localStorage.removeItem(prefix + id)
  } catch {
    // Nothing was kept, or it cannot be reached: either way, done.
  }
}

// What is kept for `id`, within the last day; older than that, or
// unreadable, it is dropped and read as none, so a draft decays rather
// than waiting on a page that may never reopen it.
export function peek(id: string): Draft | null {
  try {
    const raw = localStorage.getItem(prefix + id)
    if (!raw) {
      return null
    }
    const kept = JSON.parse(raw) as Draft
    if (typeof kept.ts !== 'number' || Date.now() - kept.ts > day || typeof kept.write !== 'string' || !Array.isArray(kept.fields)) {
      localStorage.removeItem(prefix + id)
      return null
    }
    return kept
  } catch {
    try {
      localStorage.removeItem(prefix + id)
    } catch {
      // Cannot be reached either way: nothing more to do.
    }
    return null
  }
}

// Every draft this origin keeps, of a body's or a property's, dropped at
// once: on sign-out, since an earlier session's name no longer answers
// to this browser, and on a demo reset, since the copy they were kept
// for is gone and a fresh one, sharing the same paths, must never
// replay what an earlier copy held.
export function clear(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith('cella:')) {
        keys.push(k)
      }
    }
    for (const k of keys) {
      try {
        localStorage.removeItem(k)
      } catch {
        // Skipped; the rest still clear.
      }
    }
  } catch {
    // Storage unavailable (private browsing, disabled): nothing was kept
    // that a reload could replay either.
  }
}

// Posts a kept write again through `send`; taken, it is dropped
// (`token`); refused outright, it is dropped too, never retried with the
// same stale value; got no answer (offline), it is left for the next
// opening.
export function retry(id: string, draft: Draft, send: (write: string, fields: [string, string][]) => Promise<Answer>): void {
  send(draft.write, draft.fields).then(
    (a) => {
      if (took(a) || ('done' in a && a.done && a.done.state !== 'unknown')) {
        unstash(id, draft.token)
      }
    },
    () => {
      // No answer at all: left kept, tried again at the next opening.
    },
  )
}

// Who this browser last reconciled its drafts against: who was signed
// in and, on a demo, the copy, as `${actor}|${copy}`; absent until the
// first reconcile.
const identityKey = 'cella:identity'

function storedIdentity(): string | null {
  try {
    return localStorage.getItem(identityKey)
  } catch {
    return null
  }
}

function setIdentity(identity: string): void {
  try {
    localStorage.setItem(identityKey, identity)
  } catch {
    // Not kept: the next call compares against none and clears again,
    // which costs nothing, since there was nothing of this identity's
    // own to lose by it.
  }
}

// Reconciles every draft this origin keeps against who is signed in now
// and, on a demo, which copy: unchanged since the last call, nothing
// happens; changed, including from something to nothing (signed out, a
// session expired, a device revoked) or from nothing to something
// (signed in fresh), every draft is dropped first, before anything that
// might replay one even mounts, since an earlier session's name, or an
// earlier copy's, answers to neither browser nor record again. Call
// this reactively, from the one place that first learns who is signed
// in, so it runs again whenever that changes, not only once.
export function reconcile(actor: string, copy: string): void {
  const identity = `${actor}|${copy}`
  if (storedIdentity() === identity) {
    return
  }
  clear()
  setIdentity(identity)
}

// Calls `onChange` whenever another tab of this browser reconciles to a
// different identity than the one stored when this call was made (the
// `storage` event fires only for another document's writes, never this
// one's own, so a tab need not guard against its own reconcile). A tab
// left open under a session another tab has since signed out of, or
// signed in as someone else from, drops what it held the moment that
// happens, not only the next time it reconciles on its own. Returns how
// to stop listening.
export function watch(onChange: () => void): () => void {
  const listener = (e: StorageEvent) => {
    if (e.key === identityKey && e.newValue !== e.oldValue) {
      onChange()
    }
  }
  try {
    window.addEventListener('storage', listener)
  } catch {
    // No window to watch from: nothing more to do.
    return () => {}
  }
  return () => {
    try {
      window.removeEventListener('storage', listener)
    } catch {
      // Already gone.
    }
  }
}
