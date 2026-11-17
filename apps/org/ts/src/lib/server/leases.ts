import { browserIdle, copy } from './device.ts'

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

const held = new Map<string, string>() // member address -> browser id
const seen = new Map<string, number>() // browser id -> last seen

function sweep(now: number) {
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
  seen.set(id, now)
  return true
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

// Releases every member `id` holds, as signing out does.
export function release(id: string | null | undefined) {
  if (!id) {
    return
  }
  seen.delete(id)
  for (const [member, holder] of held) {
    if (holder === id) {
      held.delete(member)
    }
  }
}
