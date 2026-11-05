// The effects scenario, end to end on a seeded Lanterne, through the
// built shell: a write commits whole, a decision with all its effects or
// none of them. The assembly passes a motion admitting Nadia and
// suspending Chloé. The server, killed by its TEST-ONLY crash point
// (`crash.ts`) between the close's verdict and what it carries, and again
// between Nadia's admission and the subscription it requires, commits
// nothing of either: the log verifies and the motion is still open, and
// closing it again commits the close, the admission, its subscription and
// the suspension, Camille's browser asked for one signature. A motion
// admitting Yara with the founding minimum of 20 shares, sound when it
// was proposed, closes once the assembly has raised the minimum to 30:
// her subscription is refused and forgoes her admission and seat with it,
// both forgone under the close in the outcome its post returns, naming no
// one, and no one is admitted without their capital. A motion suspending
// Chloé and Sofia, closed after Chloé's suspension, forgoes hers with its
// reason and carries Sofia's, the close standing. Run by `cella test e2e
// effects`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { propose } from '@cella/org-graft-membership-motion/api'
import { vote } from '@cella/org-motion/api'
import { accept, invite } from '@cella/org-membership/api'
import type { Deps } from '@cella/org-db'
import { fixture, random, sha256, signer } from '@cella/org-sign'
import { reader, scope, sign } from './lanterne.ts'
import { reacting } from '../src/lib/server/slices.ts'
import { Shell, type Done } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)
let app: pg.Client | undefined

const camille = 'camille@lanterne.example'
const thomas = 'thomas@lanterne.example'
const chloe = 'chloe@lanterne.example'
const sofia = 'sofia@lanterne.example'
const nadia = 'nadia@lanterne.example'
const yara = 'yara@lanterne.example'
// Invited here, each signs from the laptop their invitation enrolls.
const invitees = [nadia, yara]
// The capital's terms the founding assembly adopted, as the rule.
const founding = 'm-2021-001/43'

async function on(date: string) {
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps =>
  reacting({ db: reader(app as pg.Client, actor), actor, sign: invitees.includes(actor) ? signer(scope, actor, fixture(actor, 'laptop')) : sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const head = async () => Number((await one<{ n: string }>('SELECT n FROM cella.head')).n)
const verified = async () => (await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v
const status = async (m: string) => (await one<{ status: string }>('SELECT status FROM membership.member WHERE address = $1', [m])).status
const count = async (sql: string, values: unknown[]) => Number((await one<{ n: string }>(sql, values)).n)
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? out.reason ?? '' : '')
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}
// The log from entry `from` on: each entry's op, the entry it follows,
// whether it settled, and a forgone one's reason.
const logged = (from: number) =>
  all<{ op: string; cause: string | null; settled: boolean; reason: string | null }>(
    `SELECT op, cause, settled, form ->> 'reason' AS reason FROM cella.log WHERE n >= $1 ORDER BY n`,
    [from],
  )

// The motions the assembly is put on 24 October, each closing a week on.
const motions = { admitting: '', raising: '', yara: '', suspending: '' }

// Closes a motion through its page, as Camille.
const closing = (motion: string) => shell.act(`/motions/${motion}`, 'close', {}, camille)

before(async () => {
  await su.connect()
})

after(async () => {
  await shell.stop()
  await app?.end()
  await su.end()
})

test('Nadia and Yara take up their invitations, and the assembly passes four motions: admitting Nadia and suspending Chloé, raising the minimum to 30 shares, admitting Yara with 20, and suspending Chloé and Sofia', async () => {
  await on('2026-10-24')
  for (const [who, name] of [
    [nadia, 'Nadia Benali'],
    [yara, 'Yara Haddad'],
  ]) {
    const secret = random()
    settled(await invite({ address: who, name, link: await sha256(secret) }, as(thomas)))
    settled(await accept({ member: who, secret, key: (await fixture(who, 'laptop')).key, label: 'laptop' }, as(who)))
  }
  const put = async (title: string, actions: { kind: string; args: Record<string, string | number> }[]) =>
    settled(await propose({ circle: 'ag', title, procedure: 'consent', deadline: '2026-10-31', body: '', actions }, as(camille))).motion
  const wording =
    'A share is worth {account_share: 50 € | more is stricter}. Each associate subscribes at least {account_minimum: 30 | more is stricter} shares, ' +
    'and may pay them in at most {account_instalments: 10 | less is stricter} monthly instalments. An associate who leaves is repaid their shares ' +
    'at their nominal value from {account_delay: 12 | more is stricter} months after the exit, in {account_repayments: 3 | more is stricter} yearly repayments'
  motions.admitting = await put('Admit Nadia and suspend Chloé', [
    { kind: 'admit', args: { member: nadia, shares: 20 } },
    { kind: 'suspend', args: { member: chloe } },
  ])
  motions.raising = await put('Raise the minimum to 30 shares', [{ kind: 'policy', args: { kind: 'rule', wording, replaces: founding } }])
  motions.yara = await put('Admit Yara', [{ kind: 'admit', args: { member: yara, shares: 20 } }])
  motions.suspending = await put('Suspend Chloé and Sofia', [
    { kind: 'suspend', args: { member: chloe } },
    { kind: 'suspend', args: { member: sofia } },
  ])
  for (const motion of Object.values(motions)) {
    for (const { member } of await all<{ member: string }>('SELECT member FROM membership_motion.roll WHERE motion = $1', [motion])) {
      settled(await vote({ motion, member, stance: 'consent' }, as(member)))
    }
  }
})

// A close the server was killed in the middle of: once the dead server's
// connections end, nothing of it is committed.
async function undone(before: number) {
  for (let i = 0; i < 100 && (await count(`SELECT count(*) AS n FROM pg_stat_activity WHERE application_name LIKE 'cella%'`, [])) > 0; i++) {
    await new Promise((r) => setTimeout(r, 100))
  }
  assert.equal(await head(), before, 'no entry of the close or its effects')
  assert.equal(await verified(), true)
  assert.equal((await one<{ closed: string | null }>('SELECT closed FROM motion.motion WHERE id = $1', [motions.admitting])).closed, null, 'the motion is still open')
  assert.deepEqual([await status(nadia), await status(chloe)], ['invited', 'active'])
  assert.equal(await count('SELECT count(*) AS n FROM circle.seat WHERE member = $1', [nadia]), 0, 'Nadia is not seated')
  assert.equal(await count('SELECT count(*) AS n FROM account.account WHERE holder = $1', [nadia]), 0, 'nor holds a capital account')
}

test('the server killed between the close\'s verdict and what it carries commits neither', async () => {
  await shell.start('2026-10-31', {}, 'motion:motion:close')
  const before = await head()
  await assert.rejects(closing(motions.admitting), TypeError, 'the post dies with the server')
  await undone(before)
})

test('the server killed between Nadia\'s admission and the subscription it requires commits nothing of the close', async () => {
  await shell.start('2026-10-31', {}, 'membership:member:admit')
  const before = await head()
  await assert.rejects(closing(motions.admitting), TypeError, 'the post dies with the server')
  await undone(before)
})

test('closed again, the motion commits its close with every effect, Camille signing it once', async () => {
  await shell.start('2026-10-31')
  const before = await head()
  const closed = await closing(motions.admitting)
  assert.equal(closed.state, 'settled', closed.reason)
  assert.equal(shell.signed, 1, 'one signature, whatever the motion carries')
  const shape = (d: Done): unknown[] => [d.op, d.state, d.then.map(shape)]
  assert.deepEqual(closed.then.map(shape), [
    ['membership:member:admit', 'settled', [['account:capital:subscribe', 'settled', []]]],
    ['membership:member:suspend', 'settled', []],
  ])
  const close = String(before + 1)
  assert.deepEqual(await logged(before + 1), [
    { op: 'motion:motion:close', cause: null, settled: true, reason: null },
    { op: 'membership:member:admit', cause: close, settled: true, reason: null },
    { op: 'account:capital:subscribe', cause: String(before + 2), settled: true, reason: null },
    { op: 'membership:member:suspend', cause: close, settled: true, reason: null },
  ])
  assert.deepEqual([await status(nadia), await status(chloe)], ['active', 'suspended'])
  assert.equal(await count('SELECT count(*) AS n FROM account.account WHERE holder = $1', [nadia]), 1, 'Nadia holds her capital account')
  assert.equal(await verified(), true)
})

test('Yara\'s subscription, refused at the close by the terms raised since her motion was proposed, forgoes her admission and seat with it, the close standing', async () => {
  const raised = await closing(motions.raising)
  assert.equal(raised.state, 'settled', raised.reason)
  const before = await head()
  const closed = await closing(motions.yara)
  assert.equal(closed.state, 'settled', closed.reason)
  assert.equal(shell.signed, 1)
  const [admission] = closed.then
  assert.deepEqual([closed.then.length, admission.op, admission.state, admission.forgone], [1, 'membership:member:admit', 'refused', true])
  const [subscription] = admission.then
  assert.deepEqual([admission.then.length, subscription.op, subscription.state, subscription.forgone], [1, 'account:capital:subscribe', 'refused', true])
  const rule = `${motions.raising}/1`
  const sentence = (await one<{ s: string }>('SELECT policy.says($1) AS s', [rule])).s
  assert.equal(subscription.reason, `20 shares are fewer than the 30 the capital's terms ask, by ${rule} ("${sentence}"): ask at least 30 shares`)
  assert.equal(admission.reason, `membership:member:admit is forgone with account:capital:subscribe, which it requires: ${subscription.reason}`)
  const close = before + 1
  assert.deepEqual(await logged(close), [
    { op: 'motion:motion:close', cause: null, settled: true, reason: null },
    { op: 'membership:member:admit', cause: String(close), settled: false, reason: admission.reason },
    { op: 'account:capital:subscribe', cause: String(close + 1), settled: false, reason: subscription.reason },
  ])
  for (const { reason } of await logged(close)) {
    assert.doesNotMatch(reason ?? '', /yara|Yara|Haddad/, 'a reason the log keeps names no one')
  }
  assert.equal(await status(yara), 'invited', 'no one is admitted without the capital the statutes ask')
  assert.equal(await count('SELECT count(*) AS n FROM circle.seat WHERE member = $1', [yara]), 0, 'nor seated')
  assert.equal(await count('SELECT count(*) AS n FROM account.account WHERE holder = $1', [yara]), 0, 'and holds no capital account')
  assert.equal(await verified(), true)
})

test('a motion suspending Chloé, suspended since, and Sofia forgoes Chloé\'s suspension with its reason and carries Sofia\'s, the close standing', async () => {
  await shell.start('2026-11-02')
  const before = await head()
  const closed = await closing(motions.suspending)
  assert.equal(closed.state, 'settled', closed.reason)
  assert.equal(shell.signed, 1)
  const [chloes, sofias] = closed.then
  const why = 'this write suspended no one: the member is suspended since 2026-10-31, and only an active member is suspended'
  assert.deepEqual([closed.then.length, chloes.op, chloes.state, chloes.forgone, chloes.reason], [2, 'membership:member:suspend', 'refused', true, why])
  assert.deepEqual([sofias.op, sofias.state], ['membership:member:suspend', 'settled'])
  const close = String(before + 1)
  assert.deepEqual(await logged(before + 1), [
    { op: 'motion:motion:close', cause: null, settled: true, reason: null },
    { op: 'membership:member:suspend', cause: close, settled: false, reason: why },
    { op: 'membership:member:suspend', cause: close, settled: true, reason: null },
  ])
  assert.deepEqual([await status(chloe), await status(sofia)], ['suspended', 'suspended'])
  assert.equal(await verified(), true)
})
