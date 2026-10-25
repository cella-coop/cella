// The people scenario, end to end on a seeded Lanterne, through the
// handlers and the built shell: every worker has a contract, and Inès,
// employed but no member, logs her own time by her employment where a
// mandate would refuse her. Camille hires Bastien with his first device
// and opens his candidacy. Inès's member page lists what joining asks of
// her, the texts, the capital, a device and the circles, and reads back
// what she would own and decide; she marks the internal rules read, and
// once d-2026-012 admits her every step but a working circle is done. In
// November she submits her October and finance approves it, and Bastien
// logs his first day. His probation ends, he is invited, and his
// admission is proposed from the form his candidacy filled in. Run by
// `cella test e2e people`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { close } from '@cella/org-graft-circle-decision-membership/api'
import { invite } from '@cella/org-membership/api'
import { open } from '@cella/org-graft-employment-membership/api'
import { log as work, submit } from '@cella/org-graft-employment-timesheet/api'
import { hire, hiring } from '@cella/org-employment/api'
import { approve, log } from '@cella/org-timesheet/api'
import { write, type Deps } from '@cella/org-db'
import { fixture, signer } from '@cella/org-sign'
import { scope, sign } from './lanterne.ts'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)
let app: pg.Client

const camille = 'camille@lanterne.example'
const hugo = 'hugo@lanterne.example'
const julien = 'julien@lanterne.example'
const thomas = 'thomas@lanterne.example'
const ines = 'ines@lanterne.example'
const bastien = 'bastien@lanterne.example'

// The day the notary reads, for the handlers' connection and the shell's.
async function on(date: string) {
  await shell.start(date)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string, label?: string): Deps => ({
  db: app,
  actor,
  sign: actor === bastien ? signer(scope, bastien, fixture(bastien, label ?? 'laptop')) : sign(actor),
})
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? out.reason ?? '' : '')
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}
// A tab of a member's page, as text, its tags gone.
const tab = async (member: string, name: string, actor?: string) => {
  const { status, text } = await shell.page(`/people/${member}?tab=${name}`, actor)
  assert.equal(status, 200)
  return text.replace(/<[^>]+>/g, ' ').replace(/&#39;|&rsquo;|’/g, "'").replace(/\s+/g, ' ')
}

before(async () => {
  await su.connect()
  await on('2026-10-24')
})

after(async () => {
  await shell.stop()
  await app.end()
  await su.end()
})

test('every worker has a contract, the members who work and Inès, who is employed but no member', async () => {
  const rows = await all<{ address: string; stage: string }>(
    `SELECT w.address, p.stage FROM employment.worker w JOIN employment_membership.path p ON p.address = w.address ORDER BY w.address`,
  )
  assert.equal(rows.length, 12)
  assert.deepEqual(rows.filter((r) => r.stage !== 'member'), [
    { address: ines, stage: 'invited' },
    { address: 'paul@lanterne.example', stage: 'gone' },
  ])
  const { text } = await shell.page('/people')
  // Her chips: a worker, and invited to be a member.
  for (const says of ['People', 'Inès Haddad', 'worker', 'invited']) {
    assert.ok(text.includes(says), `the people say ${says}`)
  }
})

test('Inès logs her own time by her employment, where the log-time mandate refuses her, and none before her hire', async () => {
  const byMandate = await log({ member: ines, day: '2026-10-24', minutes: 120, billable: false, note: 'Release notes' }, as(ines))
  assert.match(reason(byMandate), /ines@lanterne\.example holds no mandate for log-time/)
  const logged = settled(await work({ member: ines, day: '2026-10-24', minutes: 120, billable: false, note: 'Release notes' }, as(ines)))
  assert.equal(logged.minutes, 120)
  const early = await work({ member: ines, day: '2025-08-29', minutes: 420, billable: false }, as(ines))
  assert.match(reason(early), /ines@lanterne\.example is not employed on 2025-08-29/)
  const forHer = await work({ member: ines, day: '2026-10-24', minutes: 60, billable: false }, as(thomas))
  assert.match(reason(forHer), /thomas@lanterne\.example may not log time for ines@lanterne\.example/)
  const shown = await shell.page('/people/ines@lanterne.example', ines)
  assert.ok(shown.text.includes('Timesheets') && shown.text.includes('2026-10'), 'her page lists her months')
})

test('a hire needs the manager\'s power and carries a first device; Camille hires Bastien, who signs from his first day', async () => {
  const laptop = await fixture(bastien, 'laptop')
  const contract = {
    worker: bastien,
    name: 'Bastien Roux',
    job: 'apprentice developer',
    contract: 'apprenticeship' as const,
    start: '2026-11-02',
    until: '2028-08-31',
    minutes: 35 * 60,
  }
  const byHugo = await hire({ ...contract, key: laptop.key, label: 'laptop' }, as(hugo))
  assert.match(reason(byHugo), /hugo@lanterne\.example holds no mandate for hire-worker/)
  // A hire whose payload names another key than the device it enrolled.
  const other = await fixture(bastien, 'phone')
  const h = hiring({ ...contract, key: laptop.key, label: 'laptop' })
  const bare = await write(as(camille), { ...h, payload: (v) => ({ ...h.payload(v), key: other.key }) })
  assert.match(reason(bare), /bastien@lanterne\.example's first device was not enrolled by this hire/)
  const hired = settled(await hire({ ...contract, key: laptop.key, label: 'laptop' }, as(camille)))
  assert.deepEqual({ hired: hired.hired, until: hired.until, key: hired.key }, { hired: '2026-10-24', until: '2028-08-31', key: laptop.key })
  assert.deepEqual(await one(`SELECT label, to_char(enrolled, 'YYYY-MM-DD') AS enrolled FROM person.device WHERE address = $1`, [bastien]), {
    label: 'laptop',
    enrolled: '2026-10-24',
  })
  const ahead = await work({ member: bastien, day: '2026-10-24', minutes: 60, billable: false }, as(bastien))
  assert.match(reason(ahead), /bastien@lanterne\.example is not employed on 2026-10-24/)
})

test('Camille opens Bastien\'s candidacy, six months within his contract; none for a member, and none twice', async () => {
  const forYusuf = await open({ worker: 'yusuf@lanterne.example', from: '2026-11-02', to: '2027-04-30', shares: 20 }, as(camille))
  assert.match(reason(forYusuf), /yusuf@lanterne\.example is active as a member: a candidate is not yet one/)
  const byHugo = await open({ worker: bastien, from: '2026-11-02', to: '2027-04-30', shares: 20 }, as(hugo))
  assert.match(reason(byHugo), /holds no mandate for hire-worker/)
  const opened = settled(await open({ worker: bastien, from: '2026-11-02', to: '2027-04-30', shares: 20 }, as(camille)))
  assert.equal(opened.opened, '2026-10-24')
  await assert.rejects(open({ worker: bastien, from: '2026-11-02', to: '2027-04-30', shares: 20 }, as(camille)), /candidacy_pkey/)
  assert.equal((await one<{ stage: string }>('SELECT stage FROM employment_membership.path WHERE address = $1', [bastien])).stage, 'candidate')
})

test('Inès\'s member page lists what joining asks of her and reads back what she would own and decide', async () => {
  const joining = await tab(ines, 'joining', ines)
  for (const says of [
    'Invited to join',
    'Admitted by the assembly',
    'd-2026-012',
    'Read Règlement intérieur',
    'Subscribe capital',
    'at least 20 shares of 50,00',
    'Enrol a device',
    'laptop, enrolled 1 Sept 2025',
    'phone, carried by the invitation, enrolled on admission',
    'Sit in the assembly',
    'the admission seats a new member there',
  ]) {
    assert.ok(joining.includes(says), `joining says ${says}`)
  }
  const rights = await tab(ines, 'rights', ines)
  for (const says of [
    'Inès is invited to join',
    'one vote in the assembly',
    'Inès holds no shares yet',
    'the work share goes to the workers, 100 % by pay, and 50 % of each associate\'s part buys them shares, blocked five years',
    'the first repayment 12 months after they leave, in 3 yearly repayments',
    'Inès sits in no circle yet',
  ]) {
    assert.ok(rights.includes(says), `owning and deciding says ${says}`)
  }
})

test('Inès marks the internal rules read, her own reading and no one else\'s', async () => {
  const forLea = await shell.act(`/people/lea@lanterne.example`, 'read', { version: 'internal-rules@3' }, ines)
  assert.match(forLea.reason ?? '', /ines@lanterne\.example may mark only their own reading/)
  const read = await shell.act(`/people/${ines}`, 'read', { version: 'internal-rules@3' }, ines)
  assert.deepEqual([read.op, read.state], ['document-membership:version:read', 'settled'])
  assert.ok((await tab(ines, 'joining', ines)).includes('internal-rules@3, read 24 Oct 2026'))
})

test('once d-2026-012 admits her, every step of joining is done but a working circle, and her page reads back her shares, her seat and her powers', async () => {
  await on('2026-10-31')
  settled(await close({ decision: 'd-2026-012' }, as(camille)))
  const joining = await tab(ines, 'joining', ines)
  assert.equal(joining.match(/to do/g)?.length, 1, 'only a working circle is left to join')
  assert.ok(joining.includes('a circle seats a member by its own decision'))
  for (const says of ['20 shares of 50,00', 'phone, enrolled 31 Oct 2026', 'Assemblée générale']) {
    assert.ok(joining.includes(says), `joining says ${says}`)
  }
  const rights = await tab(ines, 'rights', ines)
  for (const says of [
    'Inès has been a member since 31 Oct 2026',
    'Inès holds 20 shares of 50,00',
    'Inès sits in Assemblée générale as Member',
    'Assemblée générale decides by consent',
    'Through these seats Inès may',
    'log and submit one\'s own time',
  ]) {
    assert.ok(rights.includes(says), `owning and deciding says ${says}`)
  }
})

test('in November Inès submits her October by her employment and Julien approves it; Bastien logs his first day', async () => {
  await on('2026-11-02')
  settled(await submit({ member: ines, month: '2026-10' }, as(ines)))
  settled(await approve({ member: ines, month: '2026-10' }, as(julien)))
  assert.equal((await one<{ state: string }>(`SELECT state FROM timesheet.sheet WHERE member = $1 AND month = '2026-10'`, [ines])).state, 'approved')
  settled(await work({ member: bastien, day: '2026-11-02', minutes: 7 * 60, billable: false, note: 'First day' }, as(bastien)))
})

test('Bastien\'s probation ends, he is invited, and his admission is proposed from the form his candidacy filled in', async () => {
  await on('2027-05-03')
  const phone = await fixture(bastien, 'phone')
  settled(await invite({ address: bastien, name: 'Bastien Roux', key: phone.key, label: 'phone' }, as(thomas)))
  const { text } = await shell.page(`/people/${bastien}?tab=joining`, camille)
  assert.ok(text.includes('Propose the admission'), 'the proposal is offered')
  assert.ok(text.includes('value="20"'), 'with the shares he pledged')
  assert.ok(text.includes('value="2027-05-17"'), 'and a deadline two weeks on')
  assert.ok(text.includes('Bastien Roux has worked with the co-op since 2 November 2026, and their probation as a candidate ended on 30 April 2027.'))
  const proposed = await shell.act(`/people/${bastien}`, 'propose', {
    kind: 'admit',
    shares: '20',
    deadline: '2027-05-17',
    body: 'Bastien Roux has worked with the co-op since 2 November 2026.',
  }, camille)
  assert.deepEqual([proposed.op, proposed.state], ['decision:decision:propose', 'settled'])
  const after = await tab(bastien, 'joining', camille)
  assert.ok(!after.includes('Propose the admission'), 'no second proposal while it is open')
  assert.match(after, /moves to admit Bastien; it is open until 17 May 2027/)
})

test('the log the scenario wrote verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})
