import { error, fail, type Actions } from '@sveltejs/kit'
import { done as made, lent, type Done, type Joining } from '@cella/org-db'
import { scope } from '@cella/org-log/api'
import { using } from '#lib/server/db.ts'
import { answered, proof, relay } from '#lib/server/relay.ts'
import { keep } from '#lib/server/session.ts'
import { joining } from '#lib/server/slices.ts'
import { reason, step } from '#lib/server/write.ts'
import type { PageServerLoad } from './$types'

const gone = 'This invitation link is taken up already, or is no one’s'

// The slice that serves invitations (`joins`, the membership feat's); with
// none mounted, every link is no one's.
const serving = (): Joining => joining ?? error(404, gone)

// An invitation's link: whom it invites, while they have not taken it up.
export const load: PageServerLoad = async ({ params }) => {
  const join = serving()
  const invited = await using(null, (db) => join.invited(db, params.secret))
  if (!invited) {
    error(404, gone)
  }
  return { invited }
}

const refused = (join: Joining, reason: string) => fail(400, { done: { op: join.op, state: 'failed', reason, then: [] } satisfies Done })

// Taking it up: the browser made the invitee's first device and posts its
// public key; the acceptance is signed by that device through the relay,
// as any write is, and once it settles the device is signed in. The run
// is the link's holder's, as no session is open yet.
export const actions = {
  accept: async ({ params, request, cookies, url }) => {
    const join = serving()
    const secret = params.secret ?? ''
    const data = await request.formData()
    const owner = `join ${secret}`
    const id = data.get('cella-run')
    let run
    if (typeof id === 'string') {
      run = answered(id, owner)
      const p = proof(String(data.get('cella-proof') ?? ''))
      if (!run || !p) {
        return refused(join, 'this acceptance is over; open the link again')
      }
      run.give(p)
    } else {
      const invited = await using(null, (db) => join.invited(db, secret))
      const address = await using(null, scope)
      const key = String(data.get('key') ?? '')
      if (!invited || !address) {
        return refused(join, 'this invitation link is taken up already, or is no one’s')
      }
      const input = { member: invited.member, secret, key, label: String(data.get('label') ?? '') }
      const started = relay(owner, { scope: address, actor: invited.member, device: key }, async (sign) => {
        try {
          const done = made(join.op, await join.accept(input, { ...lent((fn) => using(null, fn)), actor: invited.member, sign }))
          return done.state === 'settled' ? { done } : fail(422, { done })
        } catch (e) {
          return refused(join, reason(e))
        }
      })
      if (typeof started === 'string') {
        return refused(join, started)
      }
      run = started
    }
    const out = await step(run)
    if (out && typeof out === 'object' && 'done' in out && (out.done as Done).state === 'settled') {
      keep(cookies, { actor: run.signs.actor, device: run.signs.device }, url.protocol === 'https:')
    }
    return out
  },
} satisfies Actions
