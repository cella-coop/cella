import { error } from '@sveltejs/kit'
import { command, getRequestEvent, query } from '$app/server'
import { done as made, lent, texts, type Joining } from '@cella/org-db'
import { scope } from '@cella/org-log/api'
import { safe } from '#lib/server/back.ts'
import { shell as call } from '#lib/server/calls.ts'
import { using } from '#lib/server/db.ts'
import { demo, dev, fixtures } from '#lib/server/device.ts'
import { answered, proof, relay } from '#lib/server/relay.ts'
import { keep } from '#lib/server/session.ts'
import { joining } from '#lib/server/slices.ts'
import { failed, owner, reason, relayed, step, type Answer } from '#lib/server/write.ts'
import { collection, index } from './collection.remote.ts'
import { item } from './item.remote.ts'
import { served } from './serve.ts'
import { answer, poster } from './write.ts'

// What the shell around every page reads, as the root layout awaits it,
// read again after a write that took or reached a verdict, as its counts
// may have moved: with the theme the viewer wears, whether the dev server
// or a demo build serves it, and whether the viewer left the drawer open,
// which the shell's toggle keeps in a cookie. Signed out, the scope and
// whether it is a demo's, which the sign-in page and an invitation's link
// wear.
export const shell = query(() =>
  served(async (db, who) => ({
    ...(await call.run(db, who)),
    dev,
    demo,
    theme: getRequestEvent().locals.theme,
    drawer: who.cookies.get('cella-drawer') !== 'closed',
    sections: (who.cookies.get('cella-sections') ?? '').slice(0, 600),
  })),
)

// The sign-in page: where to go once signed in, the Inbox unless asked,
// and, on the dev server or a demo build alone, the fixture members it
// offers, a demo's each marked as a demo member.
export const signing = query(texts(['back']), async ({ back }) => ({ back: safe(back || '/inbox'), fixtures: await fixtures(), demo }))

// The proof a device signed for a run that asked for it, posted back by
// the session that started the run, which goes on to its next step; with
// its outcome, what the page asked to have refreshed of what it reads.
export const prove = command(texts(['run', 'proof']), async ({ run, proof: p }) => {
  const who = poster()
  if (!who) {
    return failed(401, 'sign in first')
  }
  return answer(await relayed(owner(who), run, p), [collection, item, index, shell])
})

const gone = 'this invitation link is taken up already, or is no one’s'

// The slice that serves invitations (`joins`, the membership feat's); with
// none mounted, every link is no one's.
const serving = (): Joining => joining ?? error(404, gone)

// An invitation's link: whom it invites, while they have not taken it up.
export const invited = query(texts(['secret']), async ({ secret }) => {
  const join = serving()
  return (await using(null, (db) => join.invited(db, secret))) ?? error(404, gone)
})

// Taking up an invitation: the browser made the invitee's first device and
// posts its public key; the acceptance is signed by that device through
// the relay, as any write is, and once it settles the device is signed
// in. The run is the link's holder's, as no session is open yet, so its
// proof comes back here, naming the run, and not by `prove`.
export const accept = command(texts(['secret', 'key', 'label', 'run', 'proof']), async (given): Promise<Answer> => {
  const join = serving()
  const holder = `join ${given.secret}`
  let run
  if (given.run) {
    run = answered(given.run, holder)
    if (!run || !proof(given.proof)) {
      return failed(400, 'this acceptance is over; open the link again', join.op)
    }
    run.give(proof(given.proof)!)
  } else {
    const invited = await using(null, (db) => join.invited(db, given.secret))
    const address = await using(null, scope)
    if (!invited || !address) {
      return failed(400, gone, join.op)
    }
    const input = { member: invited.member, secret: given.secret, key: given.key, label: given.label }
    const started = relay(holder, { scope: address, actor: invited.member, device: given.key }, async (sign): Promise<Answer> => {
      try {
        const done = made(join.op, await join.accept(input, { ...lent((fn) => using(null, fn)), actor: invited.member, sign }))
        return { done, status: done.state === 'settled' ? 200 : 422 }
      } catch (e) {
        return failed(400, reason(e), join.op)
      }
    })
    if (typeof started === 'string') {
      return failed(400, started, join.op)
    }
    run = started
  }
  const out = (await step(run)) as Answer
  if ('done' in out && out.done?.state === 'settled') {
    const { cookies, url } = getRequestEvent()
    keep(cookies, { actor: run.signs.actor, device: run.signs.device }, url.protocol === 'https:')
  }
  return out
})
