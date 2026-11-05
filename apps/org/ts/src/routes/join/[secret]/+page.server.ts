import { error, fail, type Actions } from '@sveltejs/kit'
import { done as made, lent, type Done } from '@cella/org-db'
import { scope } from '@cella/org-log/api'
import { accept, invitation } from '@cella/org-membership/api'
import { using } from '#lib/server/db.ts'
import { answered, proof, relay } from '#lib/server/relay.ts'
import { keep } from '#lib/server/session.ts'
import { reason, step } from '#lib/server/write.ts'
import type { PageServerLoad } from './$types'

// An invitation's link: whom it invites, while they have not taken it up.
export const load: PageServerLoad = async ({ params }) => {
  const invited = await using(null, (db) => invitation(db, params.secret))
  if (!invited) {
    error(404, 'This invitation link is taken up already, or is no one’s')
  }
  return { invited }
}

const refused = (reason: string) => fail(400, { done: { op: 'membership:member:accept', state: 'failed', reason, then: [] } satisfies Done })

// Taking it up: the browser made the invitee's first device and posts its
// public key; the acceptance is signed by that device through the relay,
// as any write is, and once it settles the device is signed in. The run
// is the link's holder's, as no session is open yet.
export const actions = {
  accept: async ({ params, request, cookies, url }) => {
    const secret = params.secret ?? ''
    const data = await request.formData()
    const owner = `join ${secret}`
    const id = data.get('cella-run')
    let run
    if (typeof id === 'string') {
      run = answered(id, owner)
      const p = proof(String(data.get('cella-proof') ?? ''))
      if (!run || !p) {
        return refused('this acceptance is over; open the link again')
      }
      run.give(p)
    } else {
      const invited = await using(null, (db) => invitation(db, secret))
      const address = await using(null, scope)
      const key = String(data.get('key') ?? '')
      if (!invited || !address) {
        return refused('this invitation link is taken up already, or is no one’s')
      }
      const input = { member: invited.member, secret, key, label: String(data.get('label') ?? '') }
      run = relay(owner, { scope: address, actor: invited.member, device: key }, async (sign) => {
        try {
          const done = made('membership:member:accept', await accept(input, { ...lent((fn) => using(null, fn)), actor: invited.member, sign }))
          return done.state === 'settled' ? { done } : fail(422, { done })
        } catch (e) {
          return refused(reason(e))
        }
      })
    }
    const out = await step(run)
    if (out && typeof out === 'object' && 'done' in out && (out.done as Done).state === 'settled') {
      keep(cookies, { actor: run.signs.actor, device: run.signs.device }, url.protocol === 'https:')
    }
    return out
  },
} satisfies Actions
