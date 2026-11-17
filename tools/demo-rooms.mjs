// demo-rooms: the room logic `cella demo serve`'s front (`demo-serve.mjs`)
// uses so a visitor's copy can hold more than one browser. A copy is a
// room from here on: a join code, 16 random bytes and nothing else (over
// 128 bits), names it, compared in constant time so a wrong guess costs
// no more than a near one, and never logged or kept past the room itself.
// A browser given the code joins the room, its own fresh cookie set,
// never the room's or the code; the front knows a room's browsers by an
// id of their own, never a cookie. One unseen past `EJECT_IDLE_MS` is
// ejected: forgotten from the room, and the member it leased, if any,
// freed for another. A room with at most one browser present is alone,
// which Reset now requires.
//
// Every function here is pure: it reads and writes the maps it is given
// and nothing else, so it is tested without a server, a socket or
// Postgres.

import { randomBytes, timingSafeEqual } from 'node:crypto'

// Fifteen minutes: how long a browser may go unseen before its room
// forgets it and, with it, any member it leased.
export const EJECT_IDLE_MS = 15 * 60 * 1000

// A fresh join code: 16 random bytes, over 128 bits, as a URL-safe token
// a link can carry.
export function joinCode() {
  return randomBytes(16).toString('base64url')
}

// Whether `given` is `code`, compared in constant time once their
// lengths, which say nothing a guess could use, are found equal.
export function sameCode(code, given) {
  if (!code || !given) {
    return false
  }
  const a = Buffer.from(code)
  const b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}

// The browsers of a room (`Map<id, seen>`, `id` never a cookie) not idle
// past `ms` (`EJECT_IDLE_MS` unless a deployment is tested with its own),
// by when each was last seen.
export function present(browsers, now = Date.now(), ms = EJECT_IDLE_MS) {
  return [...browsers.entries()].filter(([, seen]) => now - seen <= ms).map(([id]) => id)
}

// Those idle past it, to be ejected.
export function stale(browsers, now = Date.now(), ms = EJECT_IDLE_MS) {
  return [...browsers.entries()].filter(([, seen]) => now - seen > ms).map(([id]) => id)
}

// Whether `id` is alone in its room: present, and no other browser is.
export function alone(browsers, id, now = Date.now(), ms = EJECT_IDLE_MS) {
  const here = present(browsers, now, ms)
  return here.includes(id) && here.every((h) => h === id)
}

// Ejects every browser idle past its span: forgotten from `browsers`,
// its lease, if any, released from `leases`. Returns who was ejected.
export function eject(browsers, leases, now = Date.now(), ms = EJECT_IDLE_MS) {
  const gone = stale(browsers, now, ms)
  for (const id of gone) {
    browsers.delete(id)
    release(leases, id)
  }
  return gone
}

// --- a room's member leases ---------------------------------------

// A lease (`Map<member, id>`): a fixture member is one browser's until
// that browser is forgotten, by an eject or the room's own end.

// Grants `member` to `id`, or refuses, naming who holds it, where
// another browser does already.
export function lease(leases, member, id) {
  const held = leases.get(member)
  if (held && held !== id) {
    return held
  }
  leases.set(member, id)
  return null
}

// Whether `member` is leased to a browser other than `except`.
export function leased(leases, member, except) {
  const held = leases.get(member)
  return !!held && held !== except
}

// Releases every member `id` holds.
export function release(leases, id) {
  for (const [member, held] of leases) {
    if (held === id) {
      leases.delete(member)
    }
  }
}
