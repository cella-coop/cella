import { browserIdle, copy, lifetime } from './device.ts'

// A room's member leases, a visiting demo alone: a fixture member is one
// browser's at a time, `id` the room's front hands it
// (`x-cella-browser`), never its cookie, so two browsers of the same
// room never sign in as the same member at once. A browser unseen
// `browserIdle` seconds is forgotten, freeing the member it held, so one
// that leaves without signing out does not keep it from everyone else.
// Kept in memory alone, one process's, which a room's server is; gated on
// `copy`, not `demo`, since a shared demo's single copy is no room and
// its front hands no id, where a grant with none would otherwise let any
// caller through unleased. Outside a room every call lets its caller
// through, since no room asks; inside one, a grant with no id is refused
// outright, never let through as if no one asked.
//
// This process alone decides when the room's lifetime starts: at the
// first member ever granted here, never at `/_demo/start`. The front
// learns of it from `ends()`, which every response carries once it holds
// (`hooks.server.ts`), and times the room's end from that, never guessing
// it on its own (`tools/demo-serve.mjs`).

const held = new Map<string, string>() // member address -> browser id
const seen = new Map<string, number>() // browser id -> last seen
// The browser each member was last granted to, kept through an idle
// sweep and a release alike: only that browser's session is renewed
// (`renew`), so once another browser took the member, the session that
// held it before stays ended, even after the taker lets it go, and a
// kept session cookie never renews under another browser's id.
const last = new Map<string, string>() // member address -> browser id
// The browsers that signed out since they last signed in, whose sessions
// are never renewed, so a cookie kept past a sign-out opens nothing.
const left = new Set<string>()
// The member another browser took from a browser while it was away, and
// when its session was found ended for it: what its sign-in says, the
// server's own record, never a link's say-so (`lost`).
const away = new Map<string, { member: string; at: number }>() // browser id -> member
// How long a sign-in goes on saying so: ten minutes, long past the
// redirect that lands the browser on it.
const telling = 10 * 60 * 1000
// When the room's lifetime ends, in seconds since 1970; 0 before the
// first sign-in, outside a room, or where `lifetime` names none.
let endsAt = 0
// When this room's server started, about when the front made the room:
// the front ends a room at its making plus twice its lifetime, signed in
// or not, so the lifetime this server names never runs past that.
const born = Date.now()

function sweep(now: number) {
  for (const [id, record] of away) {
    if (now - record.at > telling) {
      away.delete(id)
    }
  }
  for (const [id, at] of seen) {
    if (now - at > browserIdle * 1000) {
      seen.delete(id)
      for (const [member, holder] of held) {
        if (holder === id) {
          held.delete(member)
        }
      }
    }
  }
}

// Marks `id` seen now, so it is not found idle; call on every request a
// signed-in browser makes. Does nothing outside a room or with no id.
export function touch(id: string | null | undefined) {
  if (!copy || !id) {
    return
  }
  const now = Date.now()
  seen.set(id, now)
  sweep(now)
}

// Grants `member` to browser `id`, or refuses where another browser
// holds it; outside a room, every grant is let through. Inside one, a
// sign-in naming no browser id, which only a request bypassing the
// room's own front could, is refused outright, never let through as a
// browser nobody else could ever be told apart from.
export function grant(member: string, id: string | null | undefined): boolean {
  if (!copy) {
    return true
  }
  if (!id) {
    return false
  }
  const now = Date.now()
  sweep(now)
  const holder = held.get(member)
  if (holder && holder !== id) {
    return false
  }
  held.set(member, id)
  last.set(member, id)
  seen.set(id, now)
  away.delete(id)
  left.delete(id)
  // The room's lifetime starts at its first sign-in ever, never again:
  // it runs on even once everyone signs out.
  if (!endsAt && lifetime) {
    endsAt = Math.min(now + lifetime * 1000, born + 2 * lifetime * 1000)
  }
  return true
}

// When the room's lifetime ends, in seconds since 1970; 0 before the
// first sign-in, outside a room, or where `lifetime` names none. What
// the banner counts down to, once it holds.
export function ends(): number {
  return endsAt ? Math.floor(endsAt / 1000) : 0
}

// Whether `member` is leased to a browser other than `id`.
export function taken(member: string, id: string | null | undefined): boolean {
  if (!copy) {
    return false
  }
  sweep(Date.now())
  const holder = held.get(member)
  return !!holder && holder !== id
}

// Whether `id` currently holds `member`'s lease: outside a room there is
// none to hold, so every browser does; inside one, only the browser
// `held` names, which a sign-in sets (`grant`) and an eject, a sign-out
// or the front's own join (switching rooms) clears (`release`). Call it
// on every authenticated request, not only a sign-in, by way of `renew`:
// once a lease moves on, the session that opened it authorizes nothing
// more, whoever still holds its cookie.
export function holds(member: string, id: string | null | undefined): boolean {
  if (!copy) {
    return true
  }
  if (!id) {
    return false
  }
  sweep(Date.now())
  return held.get(member) === id
}

// Keeps `id`'s lease on `member` for a session that opened it: whether
// `id` still holds it, or holds it again because it lapsed by idleness
// alone and no other browser was granted it since (`last`), so a
// visitor back from a pause carries on where they were. False where
// another browser took it since, whether or not it holds it still, or,
// inside a room, where no id names this browser: never two browsers
// acting as one member, never one the room cannot tell apart, and never
// a kept session cookie under a browser id that did not open it. Where
// another browser took it, this one's sign-in says so (`lost`). A
// browser that signed out is renewed nothing until it signs in again
// (`left`), and a switch of rooms changes the browser's id.
export function renew(member: string, id: string | null | undefined): boolean {
  if (holds(member, id)) {
    return true
  }
  if (id && last.get(member) === id && !left.has(id)) {
    return grant(member, id)
  }
  if (copy && id && last.has(member) && last.get(member) !== id) {
    away.set(id, { member, at: Date.now() })
  }
  return false
}

// The member another browser took from `id` while it was away, as
// `renew` found it, or `''`: what its sign-in names, until it signs in
// again or ten minutes pass (`telling`). Only this browser's own record,
// so no link can make the sign-in say it of anyone.
export function lost(id: string | null | undefined): string {
  if (!copy || !id) {
    return ''
  }
  sweep(Date.now())
  return away.get(id)?.member ?? ''
}

// Releases every member `id` holds, as signing out does, and marks it
// signed out (`left`), so the session it signed out of is never renewed
// by a cookie kept past it.
export function release(id: string | null | undefined) {
  if (!id) {
    return
  }
  seen.delete(id)
  away.delete(id)
  left.add(id)
  for (const [member, holder] of held) {
    if (holder === id) {
      held.delete(member)
    }
  }
}
