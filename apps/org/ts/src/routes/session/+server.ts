import { json } from '@sveltejs/kit'
import { scope } from '@cella/org-log/api'
import { reading } from '#lib/server/db.ts'
import { challenge, keep, opens } from '#lib/server/session.ts'
import type { RequestHandler } from './$types'

// A session's opening, by a device's signature: GET is a fresh challenge
// and the scope it is signed for; POST, the device's answer, which opens
// the session or says why not.
export const GET: RequestHandler = async () => json({ challenge: challenge(), scope: await reading(null, scope) })

export const POST: RequestHandler = async ({ request, cookies, url }) => {
  const o = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const [actor, device, c, sig] = [o.actor, o.device, o.challenge, o.sig]
  if (typeof actor !== 'string' || typeof device !== 'string' || typeof c !== 'string' || typeof sig !== 'string') {
    return json({ reason: 'a sign-in names the actor, the device, the challenge and its signature' }, { status: 400 })
  }
  return reading(null, async (db) => {
    const address = await scope(db)
    const s = address ? await opens(db, address, { actor, device, challenge: c, sig }) : 'the database names no scope'
    if (typeof s === 'string') {
      return json({ reason: s }, { status: 403 })
    }
    keep(cookies, s, url.protocol === 'https:')
    return json({ actor: s.actor })
  })
}
