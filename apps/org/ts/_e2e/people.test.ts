// The people scenario, end to end on a seeded Lanterne, through the
// handlers and the built shell: every worker has a contract, and Inès,
// employed but no member, logs her own time by her employment where a
// mandate would refuse her. Camille hires Bastien with his first device,
// and opens no candidacy for him: no one opens another's. Inès's member
// page lists what joining asks of her, the texts, the capital, a device
// and the circles, and reads back what she would own and decide; she
// marks the internal rules and the statutes read, and
// once m-2026-012 admits her every step but a working circle is done. In
// November she submits her October and finance approves it, and Bastien
// logs his first day. Employed eight months, he is refused applying to
// join; a year on, he applies by his right from his own page, which
// opens his candidacy and puts the motion to admit him to the assembly.
// Run by `cella test e2e people`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { apply, close, put } from '@cella/org-graft-membership-motion/api'
import { open } from '@cella/org-graft-employment-membership/api'
import { book } from '@cella/org-graft-project-timesheet/api'
import { hire, hiring } from '@cella/org-employment/api'
import { capture, submit as claim } from '@cella/org-expense/api'
import { enrol, profile } from '@cella/org-person/api'
import { approve, log, submit } from '@cella/org-timesheet/api'
import { write, type Deps } from '@cella/org-db'
import { fixture, generate, signer } from '@cella/org-sign'
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
  const { text } = await shell.page('/people', camille)
  // Her chips: a worker, and invited to be a member.
  for (const says of ['People', 'Inès Haddad', 'worker', 'invited']) {
    assert.ok(text.includes(says), `the people say ${says}`)
  }
})

test('Inès, seated in Web and no member, logs her own time and books it to a Web project, none before her hire; the assembly seats no one who is no member', async () => {
  assert.deepEqual(await all('SELECT circle, role FROM circle.seat WHERE member = $1 AND until IS NULL', [ines]), [{ circle: 'web', role: null }])
  const counts = await all<{ circle: string; counts: boolean }>(
    `SELECT c.id AS circle, membership.counts($1, c.id, '2026-10-24') AS counts FROM circle.circle c WHERE c.id IN ('ag', 'web') ORDER BY c.id`,
    [ines],
  )
  assert.deepEqual(counts, [{ circle: 'ag', counts: false }, { circle: 'web', counts: true }], 'her seat counts in Web; one in the assembly would not')
  assert.equal((await one<{ may: boolean }>(`SELECT membership.may($1, 'discuss', NULL, '2026-10-24') AS may`, [ines])).may, true, 'she holds Web\'s participant mandates')
  const logged = settled(await log({ member: ines, day: '2026-10-24', minutes: 120, billable: false, note: 'Release notes' }, as(ines)))
  assert.equal(logged.minutes, 120)
  const booked = settled(await book({ member: ines, day: '2026-10-24', minutes: 60, billable: true, project: 'halles-shop' }, as(ines)))
  assert.equal((await one<{ circle: string }>('SELECT p.circle FROM project_timesheet.booking b JOIN project.project p ON p.id = b.project WHERE b.entry = $1', [booked.entry])).circle, 'web')
  const early = await log({ member: ines, day: '2025-08-29', minutes: 420, billable: false }, as(ines))
  assert.match(reason(early), /ines@lanterne\.example is not employed on 2025-08-29/)
  const forHer = await log({ member: ines, day: '2026-10-24', minutes: 60, billable: false }, as(thomas))
  assert.match(reason(forHer), /thomas@lanterne\.example may not log time for ines@lanterne\.example/)
  const assembly = await put({ kind: 'seat', args: { circle: 'ag', member: ines }, deadline: '2026-11-07', body: '' }, as(camille))
  assert.match(reason(assembly), /ines@lanterne\.example may not sit in ag: its seats are its active members'/)
  const shown = await shell.page('/people/ines@lanterne.example', ines)
  assert.ok(shown.text.includes('Timesheets') && shown.text.includes('2026-10'), 'her page lists her months')
})

test('Inès, employed and no member, keeps her profile and devices, logs her time and claims an expense by her rights, beside her seat in Web; Paul, gone, holds an employee\'s no longer', async () => {
  // The founding motion gives every person, member and employee their
  // rights, each a policy of its own kind, no mandate, with no seat.
  const rights = await all<{ right: string; powers: string[] }>(
    `SELECT "right", array_agg(power ORDER BY power) AS powers FROM circle.right WHERE revoked IS NULL GROUP BY "right" ORDER BY "right"`,
  )
  assert.deepEqual(rights, [
    { right: 'employee', powers: ['apply-membership', 'claim-expense', 'log-time'] },
    { right: 'member', powers: ['draw-account', 'mark-attendance', 'save-report', 'spread-capital'] },
    { right: 'person', powers: ['accept-invitation', 'erase-own-data', 'file-record', 'keep-devices', 'keep-profile', 'mark-read', 'record-import', 'upload-file', 'withdraw-membership'] },
  ])
  const by = async (entry: number) => (await one<{ op: string; owners: string[] }>(
    `SELECT op, array(SELECT DISTINCT g ->> 'owner' FROM jsonb_array_elements(guards) g ORDER BY 1) AS owners FROM cella.log WHERE n = $1`,
    [entry],
  ))
  const profiled = settled(await profile({ person: ines, phone: '+33 6 00 00 00 12' }, as(ines)))
  assert.equal(profiled.person, ines)
  const tablet = await generate(ines)
  const enrolled = await enrol({ address: ines, label: 'tablet', key: tablet.key }, as(ines))
  assert.equal(enrolled.state, 'settled', reason(enrolled))
  const logged = await log({ member: ines, day: '2026-10-23', minutes: 90, billable: false, note: 'Code review' }, as(ines))
  assert.equal(logged.state, 'settled', reason(logged))
  const claimed = settled(await capture({ member: ines, day: '2026-10-23', label: 'Train to Clairval', category: '6251', net: 42_00, vat: null, receipt: null }, as(ines)))
  const submitted = await claim({ expense: claimed.expense }, as(ines))
  assert.equal(submitted.state, 'settled', reason(submitted))
  for (const [out, op] of [[enrolled, 'person:device:enrol'], [logged, 'timesheet:entry:log'], [submitted, 'expense:expense:submit']] as const) {
    const entry = await by((out as { entry: number }).entry)
    assert.equal(entry.op, op)
    assert.ok(entry.owners.includes('membership'), `${op} is judged by the rights' guard`)
  }
  // A member's right is not hers until she is admitted.
  assert.equal((await one<{ may: boolean }>(`SELECT membership.entitled($1, 'draw-account', NULL, '2026-10-24') AS may`, [ines])).may, false)
  // Paul left on 30 November 2025: he is still a person, but no longer an
  // employee, so the laptop he kept logs no time of his.
  const paul = 'paul@lanterne.example'
  const laptop = await fixture(paul, 'laptop')
  await su.query('SET cella.unbound = on')
  await su.query(`INSERT INTO person.device (key, address, label, enrolled) VALUES (decode($1, 'hex'), $2, 'laptop', '2021-03-01')`, [laptop.key, paul])
  await su.query('SET cella.unbound = off')
  const asPaul = { db: app, actor: paul, sign: signer(scope, paul, laptop) }
  const late = await log({ member: paul, day: '2025-11-28', minutes: 60, billable: false }, asPaul)
  assert.equal(late.state, 'refused')
  assert.match(reason(late), /paul@lanterne\.example holds no mandate for log-time/)
  const held = await all<{ day: string; may: boolean }>(
    `SELECT d::text AS day, membership.entitled($1, 'log-time', NULL, d) AS may FROM unnest(ARRAY['2025-11-28', '2025-12-01']::date[]) d ORDER BY d`,
    [paul],
  )
  assert.deepEqual(held, [{ day: '2025-11-28', may: true }, { day: '2025-12-01', may: false }])
  const kept = await profile({ person: paul, email: 'paul@garnier.example' }, asPaul)
  assert.equal(kept.state, 'settled', reason(kept))
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
  // A hire whose payload names another key than the member signed: the
  // notary refuses it before any guard.
  const other = await fixture(bastien, 'phone')
  const h = hiring({ ...contract, key: laptop.key, label: 'laptop' })
  const swapped = await write(as(camille), { ...h, payload: (v) => ({ ...h.payload(v), key: other.key }) })
  assert.match(reason(swapped), /the payload's key is not what the member signed: employment:worker:hire/)
  // One whose request and payload name another key than the device it
  // enrolled: `employment.carries` refuses it.
  const bare = await write(as(camille), {
    ...h,
    request: { ...contract, key: other.key, label: 'laptop' },
    payload: (v) => ({ ...h.payload(v), key: other.key }),
  })
  assert.match(reason(bare), /bastien@lanterne\.example's first device was not enrolled by this hire/)
  const hired = settled(await hire({ ...contract, key: laptop.key, label: 'laptop' }, as(camille)))
  assert.deepEqual({ hired: hired.hired, until: hired.until, key: hired.key }, { hired: '2026-10-24', until: '2028-08-31', key: laptop.key })
  assert.deepEqual(await one(`SELECT label, to_char(enrolled, 'YYYY-MM-DD') AS enrolled FROM person.device WHERE address = $1`, [bastien]), {
    label: 'laptop',
    enrolled: '2026-10-24',
  })
  const ahead = await log({ member: bastien, day: '2026-10-24', minutes: 60, billable: false }, as(bastien))
  // An employee's right is held from the first day of the contract; the
  // first guard by owner to refuse speaks, employment-timesheet's before the
  // membership feat's.
  assert.match(reason(ahead), /bastien@lanterne\.example is not employed on 2026-10-24/)
})

test('Inès\'s member page lists what joining asks of her and reads back what she would own and decide', async () => {
  const joining = await tab(ines, 'joining', ines)
  for (const says of [
    'Invited to join',
    'Admitted by the assembly',
    'm-2026-012',
    'Read Règlement intérieur',
    'Subscribe capital',
    'at least 20 shares of 50,00',
    'Enrol a device',
    'laptop, enrolled 1 Sept 2025',
    'phone, enrolled 1 Oct 2026 when the invitation was taken up',
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
    'Inès sits in Web.',
    'Web decides by consent',
  ]) {
    assert.ok(rights.includes(says), `owning and deciding says ${says}`)
  }
})

test('Inès marks the internal rules and the statutes read, her own reading and no one else\'s', async () => {
  const forLea = await shell.act(`/people/lea@lanterne.example`, 'read', { version: 'internal-rules@3' }, ines)
  assert.match(forLea.reason ?? '', /ines@lanterne\.example may mark only their own reading/)
  const read = await shell.act(`/people/${ines}`, 'read', { version: 'internal-rules@3' }, ines)
  assert.deepEqual([read.op, read.state], ['document-membership:version:read', 'settled'])
  assert.ok((await tab(ines, 'joining', ines)).includes('internal-rules@3, read 24 Oct 2026'))
  const statutes = await shell.act(`/people/${ines}`, 'read', { version: 'statutes@2' }, ines)
  assert.deepEqual([statutes.op, statutes.state], ['document-membership:version:read', 'settled'])
  assert.ok((await tab(ines, 'joining', ines)).includes('statutes@2, read 24 Oct 2026'))
})

test('once m-2026-012 admits her, every step of joining is done, Web her working circle since her hire, and her page reads back her shares, her seats and her powers', async () => {
  await on('2026-10-31')
  settled(await close({ motion: 'm-2026-012' }, as(camille)))
  const joining = await tab(ines, 'joining', ines)
  assert.equal(joining.match(/to do/g), null, 'nothing is left to join')
  for (const says of ['20 shares of 50,00', 'phone, enrolled 1 Oct 2026 when the invitation was taken up', 'Assemblée générale', 'Web']) {
    assert.ok(joining.includes(says), `joining says ${says}`)
  }
  const rights = await tab(ines, 'rights', ines)
  for (const says of [
    'Inès has been a member since 31 Oct 2026',
    'Inès holds 20 shares of 50,00',
    'Assemblée générale as Member',
    'Assemblée générale and Web decide by consent',
    'Through these seats Inès may',
    'invite someone to join, with their first device',
  ]) {
    assert.ok(rights.includes(says), `owning and deciding says ${says}`)
  }
})

test('in November Inès submits her October by her employment and Julien approves it; Bastien logs his first day', async () => {
  await on('2026-11-02')
  settled(await submit({ member: ines, month: '2026-10' }, as(ines)))
  settled(await approve({ member: ines, month: '2026-10' }, as(julien)))
  assert.equal((await one<{ state: string }>(`SELECT state FROM timesheet.sheet WHERE member = $1 AND month = '2026-10'`, [ines])).state, 'approved')
  settled(await log({ member: bastien, day: '2026-11-02', minutes: 7 * 60, billable: false, note: 'First day' }, as(bastien)))
})

test('Bastien, employed eight months, is refused applying and opening his own candidacy, and no one opens one for him', async () => {
  await on('2027-07-02')
  const early = await apply({ member: bastien, shares: 20, deadline: '2027-07-16', body: '' }, as(bastien))
  assert.match(reason(early), /bastien@lanterne\.example was hired on 2026-11-02: an employee applies to join after a year's employment, from 2027-11-02/)
  const alone = await open({ worker: bastien, shares: 20 }, as(bastien))
  assert.match(reason(alone), /bastien@lanterne\.example has not applied to join today: a candidacy opens on an application/)
  // The employer opens no candidacy: Camille, who hires, holds the right
  // to apply as an employee, for her own alone.
  const byCamille = await open({ worker: bastien, shares: 20 }, as(camille))
  assert.match(reason(byCamille), /camille@lanterne\.example may not open bastien@lanterne\.example's candidacy: only their own, on their application/)
  await assert.rejects(apply({ member: thomas, shares: 20, deadline: '2027-07-16', body: '' }, as(thomas)), /thomas@lanterne\.example is or was a member, or has applied already/)
  const { text } = await shell.page(`/people/${bastien}?tab=joining`, camille)
  assert.ok(!text.includes('Apply to join'), 'the application is offered on his own page alone')
  assert.equal((await one<{ stage: string }>('SELECT stage FROM employment_membership.path WHERE address = $1', [bastien])).stage, 'employee')
})

test('a year on, Bastien applies by his right: his candidacy opens, and the motion to admit him is put to the assembly, which must rule on it', async () => {
  await on('2027-11-02')
  const forHim = await apply({ member: bastien, shares: 20, deadline: '2027-11-16', body: '' }, as(thomas))
  assert.match(reason(forHim), /thomas@lanterne\.example may not apply for bastien@lanterne\.example: only for themselves/)
  const own = await shell.page(`/people/${bastien}`, bastien)
  assert.ok(own.text.includes('Apply to join'), 'his own page offers the application')
  assert.ok(own.text.includes('value="2027-11-16"'), 'its motion two weeks on')
  const applied = await shell.act(`/people/${bastien}`, 'apply', {
    shares: '20',
    deadline: '2027-11-16',
    body: 'I have worked with the co-op for a year and ask to join.',
  }, bastien)
  assert.deepEqual([applied.op, applied.state], ['membership:member:apply', 'settled'], applied.reason)
  assert.deepEqual(applied.then.map((d) => [d.op, d.state]), [['employment-membership:candidacy:open', 'settled']])
  assert.deepEqual(
    await one(`SELECT to_char("from", 'YYYY-MM-DD') AS "from", to_char("to", 'YYYY-MM-DD') AS "to", shares, to_char(opened, 'YYYY-MM-DD') AS opened FROM employment_membership.candidacy WHERE worker = $1`, [bastien]),
    { from: '2026-11-02', to: '2027-11-01', shares: 20, opened: '2027-11-02' },
  )
  const motion = await one<{ id: string; circle: string; title: string; ballot: string; deadline: string; shares: number }>(
    `SELECT d.id, d.circle, d.title, d.ballot, to_char(d.deadline, 'YYYY-MM-DD') AS deadline, a.shares
     FROM membership_motion.action a JOIN motion.motion d ON d.id = a.motion WHERE a.member = $1 AND a.kind = 'admit' AND d.closed IS NULL`,
    [bastien],
  )
  assert.deepEqual({ ...motion, id: undefined }, { id: undefined, circle: 'ag', title: 'Admit Bastien Roux as a member', ballot: 'secret', deadline: '2027-11-16', shares: 20 })
  const roll = await all<{ member: string }>('SELECT member FROM membership_motion.roll WHERE motion = $1', [motion.id])
  assert.ok(roll.length > 0 && !roll.some((r) => r.member === bastien), 'its roll is the assembly\'s seats, and not his')
  const entry = await one<{ op: string; actor: string }>(`SELECT op, actor FROM cella.log WHERE n = $1`, [applied.entry])
  assert.deepEqual(entry, { op: 'membership:member:apply', actor: bastien }, 'one write of his own, no motion proposed by anyone else')
  assert.equal((await one<{ stage: string; applied: string }>(`SELECT stage, to_char(applied, 'YYYY-MM-DD') AS applied FROM employment_membership.path WHERE address = $1`, [bastien])).applied, '2027-11-02')
  const after = await tab(bastien, 'joining', bastien)
  assert.match(after, /moves to admit Bastien; it is open until 16 Nov 2027/)
  assert.ok(!(await shell.page(`/people/${bastien}`, bastien)).text.includes('Apply to join'), 'no second application while it is open')
  await assert.rejects(apply({ member: bastien, shares: 20, deadline: '2027-11-30', body: '' }, as(bastien)), /bastien@lanterne\.example is or was a member, or has applied already: one applies once/)
})

test('Malik revokes his phone from his laptop on his own page; the device signing and anyone else\'s are not his to revoke', async () => {
  const malik = 'malik@lanterne.example'
  const laptop = await fixture(malik, 'laptop')
  const phone = await fixture(malik, 'phone')
  await shell.signIn(malik, laptop)
  const own = await tab(malik, 'overview', malik)
  assert.match(own, /laptop, this device/)
  assert.match(own, /Revoke phone/)
  assert.doesNotMatch(own, /Revoke laptop/)
  assert.doesNotMatch(await tab(camille, 'overview', malik), /Revoke/, 'nothing to revoke on someone else\'s page')
  const itself = await shell.act(`/people/${malik}`, 'revoke', { key: laptop.key }, malik)
  assert.notEqual(itself.state, 'settled', 'a device never revokes itself')
  const theirs = await shell.act(`/people/${camille}`, 'revoke', { key: (await fixture(camille, 'phone')).key }, malik)
  assert.equal(theirs.state, 'refused')
  const revoked = await shell.act(`/people/${malik}`, 'revoke', { key: phone.key }, malik)
  assert.equal(revoked.state, 'settled', revoked.reason)
  assert.deepEqual(
    await all(`SELECT label, revoked IS NOT NULL AS revoked FROM person.device WHERE address = $1 ORDER BY label`, [malik]),
    [{ label: 'laptop', revoked: false }, { label: 'phone', revoked: true }],
  )
  const after = await tab(malik, 'overview', malik)
  assert.doesNotMatch(after, /Revoke/)
  assert.match(after, /This is your only current device/)
})

test('the log the scenario wrote verifies', async () => {
  assert.equal((await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v, true)
})
