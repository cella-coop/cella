import { json } from '@sveltejs/kit'
import { scope } from '@cella/org-log/api'
import { reading } from '#lib/server/db.ts'
import { grant, taken } from '#lib/server/leases.ts'
import { challenge, keep, opens } from '#lib/server/session.ts'
import type { RequestHandler } from './$types'

const leased = 'this member is signed in on another browser already'

// A session's opening, by a device's signature: GET is a fresh challenge
// and the scope it is signed for; POST, the device's answer, which opens
// the session or says why not. In a demo's room, a fixture member is one
// browser's at a time (`#lib/server/leases.ts`), known by `x-cella-browser`,
// which the room's front hands every browser it holds.
export const GET: RequestHandler = async () => json({ challenge: challenge(), scope: await reading(null, scope) })

export const POST: RequestHandler = async ({ request, cookies, url }) => {
  const o = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const [actor, device, c, sig] = [o.actor, o.device, o.challenge, o.sig]
  if (typeof actor !== 'string' || typeof device !== 'string' || typeof c !== 'string' || typeof sig !== 'string') {
    return json({ reason: 'a sign-in names the actor, the device, the challenge and its signature' }, { status: 400 })
  }
  const browser = request.headers.get('x-cella-browser')
  if (taken(actor, browser)) {
    return json({ reason: leased }, { status: 409 })
  }
  return reading(null, async (db) => {
    const address = await scope(db)
    const s = address ? await opens(db, address, { actor, device, challenge: c, sig }) : 'the database names no scope'
    if (typeof s === 'string') {
      return json({ reason: s }, { status: 403 })
    }
    if (!grant(s.actor, browser)) {
      return json({ reason: leased }, { status: 409 })
    }
    keep(cookies, s, url.protocol === 'https:')
    return json({ actor: s.actor })
  })
}
