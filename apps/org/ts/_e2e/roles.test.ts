// A circle's roles made and changed by motion, end to end on a seeded
// Lanterne. Through the handlers, the proposals to make or change a role
// are refused at the proposal, each naming the role, the value read and
// the fix: a circle there is not, a term no role has,
// no name, a name another role of the circle has, a cap
// that is no whole count above none, a cap below the role's holders on
// the day, `participant`, a change that changes nothing, lifting the cap
// of a role with none among them, Web making its own role, and
// coordination making a role of every working circle. The assembly makes
// an Editor role in Web and seats Léa in it by the same motion, and a
// Brand role, whose key the Brand circle holds, made as brand-2, then
// changes the Editor's duty and cap, each entry saying what it carried
// and what it was. One motion creates a Press circle, makes a Scribe
// role in Brand, a Scribe in Web, which takes scribe-2 and seats Léa, a
// Press role in Web, press-2, and a Trésorier, tresorier, each id given
// at the proposal; of two motions making Archivist, the second carried
// is refused, its id taken since. Then in every browser, light and dark, through the
// dev server: Camille opens Web's Settings tab, presses Add a role…, and
// in the dialog, which asks for no id, types a new role's name, its duty
// and its cap, and proposes it to the assembly: one motion making the
// role with all of them; she empties the Editor role's cap and presses Enter, and
// proposes the motion the dialog offers lifting it, its cap given as
// none; then on the assembly's Settings tab she
// lowers the Member role's cap below its holders, and the dialog shows the
// guard's refusal before anything is proposed. Last, the first motion
// lifting the Editor's cap carries, and the role reads uncapped, its entry
// carrying the cap as none, and a role she proposed carries, made under
// the id its name gives. `SHOTS` names where its screenshots go. Run
// by `cella test e2e roles`.
// covers: membership-motion motion

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import { vote } from '@cella/org-motion/api'
import { carried, close, propose } from '@cella/org-graft-membership-motion/api'
import type { Deps, Done } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'
import { eachBrowser, serve, signIn } from './browser.ts'

const su = new pg.Client()
let app: pg.Client | undefined

const shots = process.env.SHOTS ?? '/tmp/cella-roles-shots'
const camille = 'camille@lanterne.example'
const lea = 'lea@lanterne.example'
let today = '2026-11-09'
// The roles the Settings tab proposed by name alone, each with the id its
// name gives.
const proposed: { role: string; id: string }[] = []

async function on(date: string) {
  today = date
  await su.query(`ALTER ROLE cella_app IN DATABASE ${su.escapeIdentifier(su.database ?? '')} SET cella.clock = '${date}'`)
  await app?.end()
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
}

const as = (actor: string): Deps => ({ db: reader(app as pg.Client, actor), actor, sign: sign(actor) })
const all = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows as R[]
const one = async <R>(sql: string, values: unknown[] = []) => (await all<R>(sql, values))[0]
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? (out.reason ?? '') : '')
const settled = <T>(out: { state: string; value?: T; reason?: string }): T => {
  assert.equal(out.state, 'settled', reason(out))
  return out.value as T
}
const states = (out: Done[]) => out.map((d) => [d.op, d.state, d.reason ?? ''])

type Action = { kind: string; args: Record<string, string | number | null> }

// A motion of `circle` carrying `actions`, proposed by Camille, or its
// refusal.
const fortnight = () => new Date(Date.parse(`${today}T00:00:00Z`) + 14 * 86400000).toISOString().slice(0, 10)
const moving = (actions: Action[], circle = 'ag') =>
  propose({ circle, title: 'Roles', deadline: fortnight(), body: '', actions }, as(camille))

// Every member on the motion's roll consents, and on its deadline Camille
// closes it; what its close carried.
async function decided(motion: string) {
  for (const { member } of await all<{ member: string }>('SELECT member FROM motion.roll WHERE motion = $1', [motion])) {
    settled(await vote({ motion, member, stance: 'consent' }, as(member)))
  }
  const { deadline } = await one<{ deadline: string }>(`SELECT to_char(deadline, 'YYYY-MM-DD') AS deadline FROM motion.motion WHERE id = $1`, [motion])
  await on(deadline)
  settled(await close({ motion }, as(camille)))
  return carried(motion, as(camille))
}

// How many hold the assembly's member role on the day.
const members = async () =>
  (
    await one<{ n: number }>(
      `SELECT count(*)::int AS n FROM circle.tenure WHERE role = 'member' AND circle = 'ag'
       AND coalesce(since, '-infinity') <= $1::date AND coalesce(until, 'infinity') > $1::date`,
      [today],
    )
  ).n

before(async () => {
  await su.connect()
  await on(today)
})

after(async () => {
  await app?.end()
  await su.end()
})

test('a role made or changed is refused at its proposal, naming the role, the value read and the fix', async () => {
  const refused = async (actions: Action[], circle?: string) => reason(await moving(actions, circle))
  const make = (args: Record<string, string | number>) => ({ kind: 'role', args: { circle: 'web', name: 'Editor', ...args } })
  const change = (args: Record<string, string | number | null>) => ({ kind: 'amend-role', args })
  assert.match(await refused([make({ circle: 'nowhere' })]), /no circle nowhere: a role is made in a circle there is, by its id, or in every working circle, \*/)
  assert.match(await refused([make({ circle: 'web', seats: 2 })]), /a role is made with its circle, name, duty and cap, not its seats/)
  assert.match(await refused([{ kind: 'role', args: { circle: 'web' } }]), /a role is made with no name: give it a name/)
  assert.match(await refused([make({ name: ' ' })]), /the new role is given a blank name: give it a name/)
  assert.match(
    await refused([make({ name: ' circle lead ' })]),
    /the lead role is named Circle lead already in every working circle: give the circle-lead role a name no other role of web has/,
  )
  assert.match(await refused([make({ holders: 0 })]), /0 is no cap: give the editor role a whole count of holders above none, or no cap/)
  assert.match(await refused([make({})], 'web'), /web may not decide about web: put the editor role to the assembly, or to another circle holding amend-circle/)
  assert.match(
    await refused([make({ circle: '*' })], 'coordination'),
    /a role of every working circle is the assembly's alone: put the editor role to it/,
  )
  assert.match(await refused([change({ role: 'nobody', name: 'Nobody' })]), /no role nobody: a motion amends a role there is, by its id/)
  assert.match(await refused([change({ role: 'participant', name: 'Seat' })]), /the participant role is built in, every seat's in its circle, and never changed: amend another role/)
  assert.match(await refused([change({ role: 'lead', circle: 'web' })]), /an amendment of the lead role changes its name, its duty or its cap, not its circle/)
  assert.match(await refused([change({ role: 'lead' })]), /the amendment of the lead role gives no new name, duty or cap: give at least one/)
  assert.match(
    await refused([change({ role: 'member', holders: 2 })]),
    new RegExp(`the member role is held by ${await members()} in ag on 2026-11-09: give it a cap of ${await members()} or more, or end a tenure of it first`),
  )
  assert.match(
    await refused([change({ role: 'lead', name: 'Circle lead', holders: 1 })]),
    /the amendment of the lead role changes nothing: it is named Circle lead, capped at 1, with the duty it has already; give a term it does not have/,
  )
  assert.match(
    await refused([change({ role: 'member', holders: null })]),
    /the amendment of the member role changes nothing: it is named Member, capped at no count, with the duty it has already; give a term it does not have/,
  )
  assert.match(await refused([change({ role: 'lead', holders: '' })]), / is no cap: give the lead role a whole count of holders above none, or no cap/)
  assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM motion.action WHERE kind IN ('role', 'amend-role')`)).n, 0, 'nothing was proposed')
})

test('the assembly makes an Editor role in Web and seats Léa in it by one motion, then changes its duty and cap', async () => {
  const { motion } = settled(
    await moving([
      { kind: 'role', args: { circle: 'web', name: 'Editor', duty: 'edits the studio\'s copy', holders: 1 } },
      { kind: 'seat', args: { circle: 'web', member: lea, role: 'editor' } },
      { kind: 'role', args: { circle: 'web', name: 'Brand', duty: 'keeps the studio\'s brand' } },
    ]),
  ) as { motion: string }
  const out = await decided(motion)
  assert.deepEqual(states(out), [
    ['circle:role:make', 'settled', ''],
    ['circle:seat:add', 'settled', ''],
    ['circle:role:make', 'settled', ''],
  ])
  assert.deepEqual(
    await one(`SELECT id, circle FROM circle.role WHERE name = 'Brand'`),
    { id: 'brand-2', circle: 'web' },
    'a name whose key the Brand circle holds takes the -2 suffix',
  )
  const suffixed = await one<{ p: Record<string, unknown> }>(`SELECT cella.opened($1) AS p`, [out[2].entry])
  assert.equal(suffixed.p.role, 'brand-2', 'its entry carries the id it took')
  assert.deepEqual(await one(`SELECT circle, name, duty, holders FROM circle.role WHERE id = 'editor'`), {
    circle: 'web',
    name: 'Editor',
    duty: 'edits the studio\'s copy',
    holders: 1,
  })
  assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM circle.tenure WHERE role = 'editor' AND circle = 'web' AND holder = $1`, [lea])).n, 1, 'Léa holds it')
  const made = await one<{ p: Record<string, unknown> }>(`SELECT cella.opened($1) AS p`, [out[0].entry])
  assert.deepEqual([made.p.role, made.p.circle, made.p.holders], ['editor', 'web', 1], 'its entry carries the role it made')

  const changed = settled(await moving([{ kind: 'amend-role', args: { role: 'editor', duty: 'edits and proofs the studio\'s copy', holders: 2 } }])) as { motion: string }
  const amended = await decided(changed.motion)
  assert.deepEqual(states(amended), [['circle:role:amend', 'settled', '']])
  assert.deepEqual(await one(`SELECT name, duty, holders FROM circle.role WHERE id = 'editor'`), { name: 'Editor', duty: 'edits and proofs the studio\'s copy', holders: 2 })
  const entry = await one<{ p: Record<string, unknown> }>(`SELECT cella.opened($1) AS p`, [amended[0].entry])
  assert.deepEqual(entry.p.was, { duty: 'edits the studio\'s copy', holders: 1 }, 'its entry says what each was')
  assert.match(
    reason(await moving([{ kind: 'amend-role', args: { role: 'editor', holders: 2 } }])),
    /the amendment of the editor role changes nothing/,
  )
})

test('a role\'s id is given at its proposal, past the motion\'s earlier actions, and an id taken since refuses the make', async () => {
  const keys = await all<{ k: string }>(
    `SELECT circle.keyed(n) AS k FROM unnest(ARRAY['Trésorier', 'Ørsted Æble', 'Straße', 'Łódź', 'Đorđe', 'Þórr', 'Œuvre', '  Print buyer! ', '2nd editor', '会计']) n`,
  )
  assert.deepEqual(
    keys.map((r) => r.k),
    ['tresorier', 'orsted-aeble', 'strasse', 'lodz', 'dorde', 'thorr', 'oeuvre', 'print-buyer', 'nd-editor', 'role'],
    'a name\'s key drops its accents and spells out ø, æ, œ, ß, ł, đ and þ',
  )

  const { motion } = settled(
    await moving([
      { kind: 'circle', args: { id: 'press', name: 'Press', purpose: 'the studio\'s printed work' } },
      { kind: 'role', args: { circle: 'brand', name: 'Scribe', id: 'mine' } },
      { kind: 'role', args: { circle: 'web', name: 'Scribe' } },
      { kind: 'seat', args: { circle: 'web', member: lea, role: 'scribe-2' } },
      { kind: 'role', args: { circle: 'web', name: 'Press' } },
      { kind: 'role', args: { circle: 'web', name: 'Trésorier' } },
    ]),
  ) as { motion: string }
  assert.deepEqual(
    (await all<{ id: string }>(`SELECT args ->> 'id' AS id FROM motion.action WHERE motion = $1 AND kind = 'role' ORDER BY n`, [motion])).map((r) => r.id),
    ['scribe', 'scribe-2', 'press-2', 'tresorier'],
    'each role is given its id at the proposal, past the circle and the role made before it, whatever id was named',
  )
  const out = await decided(motion)
  assert.deepEqual(
    states(out).map(([op, state]) => [op, state]),
    [
      ['circle:circle:create', 'settled'],
      ['circle:role:make', 'settled'],
      ['circle:role:make', 'settled'],
      ['circle:seat:add', 'settled'],
      ['circle:role:make', 'settled'],
      ['circle:role:make', 'settled'],
    ],
  )
  assert.deepEqual(
    await all(`SELECT id, circle FROM circle.role WHERE id IN ('scribe', 'scribe-2', 'press-2', 'tresorier') ORDER BY id`),
    [
      { id: 'press-2', circle: 'web' },
      { id: 'scribe', circle: 'brand' },
      { id: 'scribe-2', circle: 'web' },
      { id: 'tresorier', circle: 'web' },
    ],
  )
  assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM circle.seat WHERE circle = 'web' AND member = $1 AND role = 'scribe-2'`, [lea])).n, 1, 'Léa sits as the second Scribe')

  // Two motions each give Archivist's key, as neither is made; the first
  // carried makes it, and the second's make is refused, never renamed.
  const first = settled(await moving([{ kind: 'role', args: { circle: 'web', name: 'Archivist' } }])) as { motion: string }
  const second = settled(await moving([{ kind: 'role', args: { circle: 'web', name: 'Archivist!' } }])) as { motion: string }
  assert.deepEqual(states(await decided(first.motion)), [['circle:role:make', 'settled', '']])
  const late = await decided(second.motion)
  assert.equal(late[0].state, 'refused')
  assert.match(late[0].reason ?? '', /a role archivist is there already, made since the motion gave the new role that id: propose the role again for another/)
  assert.equal((await one<{ n: number }>(`SELECT count(*)::int AS n FROM circle.role WHERE name = 'Archivist!'`)).n, 0, 'no role was made in its place')
})

eachBrowser((name, launch) => {
  test(`${name}: Camille proposes a new role from Web's Settings tab, and sees a cap below the Member role's holders refused, light and dark`, async () => {
    mkdirSync(shots, { recursive: true })
    const browser = await launch()
    try {
      for (const scheme of ['light', 'dark'] as const) {
        const at = `${name}, ${scheme}`
        const role = `Access ${name} ${scheme}`
        const id = `access-${name}-${scheme}`
        const dev = await serve()
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: scheme, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
        try {
          await signIn(context, dev.base, camille)
          const page = await context.newPage()
          const errors: string[] = []
          page.on('pageerror', (e) => errors.push(e.message))
          await page.goto(`${dev.base}/circles/web?tab=settings`)
          await page.waitForLoadState('networkidle')

          const editor = page.locator('section.section', { has: page.getByRole('heading', { name: 'Editor', exact: true }) })
          assert.equal(await editor.getByLabel('Cap').inputValue(), '2', `${at}: the Editor role's cap in force`)
          assert.equal(await editor.getByRole('button', { name: 'Assembly changes this by motion' }).count(), 3, `${at}: each term wears the assembly's motion icon`)
          await page.getByRole('button', { name: 'Add a role…' }).click()
          const fresh = page.getByRole('dialog', { name: 'New role in Web' })
          await fresh.waitFor()
          assert.ok(
            ((await fresh.textContent()) ?? '').includes('Web\'s roles are made and changed only by a motion of Assembly'),
            `${at}: the dialog says why her write makes nothing`,
          )
          await fresh.getByLabel('Name').fill(role)
          assert.equal(await fresh.getByLabel('Id').count(), 0, `${at}: the dialog asks for no id`)
          await fresh.getByLabel('Duty').fill('grants access to the studio\'s tools')
          await fresh.getByLabel('Cap').fill('1')
          await page.screenshot({ path: `${shots}/roles-${name}-${scheme}.png`, fullPage: true })
          await fresh.getByRole('button', { name: 'Propose to Assembly' }).click()
          await fresh.waitFor({ state: 'hidden' })
          assert.deepEqual(
            await all(`SELECT d.circle, d.title, m.args FROM motion.motion d JOIN motion.action m ON m.motion = d.id WHERE m.kind = 'role' AND m.args ->> 'name' = $1`, [role]),
            [{ circle: 'ag', title: `Make the ${role} role in Web`, args: { circle: 'web', id, name: role, duty: 'grants access to the studio\'s tools', holders: 1 } }],
            `${at}: one motion of the assembly makes the role in Web, its name, duty and cap, and the id its name gives`,
          )
          proposed.push({ role, id })

          const dialog = page.getByRole('dialog', { name: 'Assembly changes it by motion' })
          await editor.getByLabel('Cap').fill('')
          await editor.getByLabel('Cap').press('Enter')
          await dialog.waitFor()
          assert.equal(await dialog.getByLabel('Title').inputValue(), 'Lift the Editor role\'s cap of 2', `${at}: its title says the cap is lifted`)
          assert.equal(await dialog.getByLabel('New cap').inputValue(), 'none', `${at}: it gives the cap as none`)
          const lift = `Lift the Editor role's cap of 2, ${at}`
          await dialog.getByLabel('Title').fill(lift)
          await dialog.getByRole('button', { name: 'Propose to Assembly' }).click()
          await dialog.waitFor({ state: 'hidden' })
          assert.equal(
            (await all(`SELECT a.motion FROM motion.action a JOIN motion.motion d ON d.id = a.motion WHERE a.kind = 'amend-role' AND a.args = '{"role": "editor", "holders": null}' AND d.title = $1`, [lift])).length,
            1,
            `${at}: the assembly's motion lifts the Editor role's cap`,
          )

          await page.goto(`${dev.base}/circles/ag?tab=settings`)
          await page.waitForLoadState('networkidle')
          const member = page.locator('section.section', { has: page.getByRole('heading', { name: 'Member', exact: true }) })
          await member.getByLabel('Cap').fill('2')
          await member.getByLabel('Cap').press('Enter')
          await dialog.waitFor()
          assert.equal(await dialog.getByLabel('Title').inputValue(), 'Cap the Member role at 2', `${at}: its title says the change`)
          await dialog.getByRole('button', { name: 'Propose to Assembly' }).click()
          const held = await members()
          await dialog
            .getByRole('alert')
            .filter({ hasText: `the member role is held by ${held} in ag on ${today}: give it a cap of ${held} or more, or end a tenure of it first` })
            .waitFor()
          assert.equal(
            (await one<{ n: number }>(`SELECT count(*)::int AS n FROM motion.action WHERE kind = 'amend-role' AND args ->> 'role' = 'member'`)).n,
            0,
            `${at}: refused before anything is proposed`,
          )
          await page.screenshot({ path: `${shots}/roles-refused-${name}-${scheme}.png` })
          assert.deepEqual(errors, [], `${at}: the page threw nothing`)
        } finally {
          await context.close()
          await dev.stop()
        }
      }
    } finally {
      await browser.close()
    }
  })
})

test('the motion the Settings tab proposed carries and lifts the Editor role\'s cap, its entry carrying the cap as none', async () => {
  const lifting = await one<{ motion: string } | undefined>(
    `SELECT a.motion FROM motion.action a JOIN motion.motion d ON d.id = a.motion
     WHERE a.kind = 'amend-role' AND a.args = '{"role": "editor", "holders": null}' AND d.closed IS NULL
     ORDER BY a.motion LIMIT 1`,
  )
  assert.ok(lifting, 'the Settings tab proposed lifting the Editor role\'s cap')
  const out = await decided(lifting.motion)
  assert.deepEqual(states(out), [['circle:role:amend', 'settled', '']])
  assert.deepEqual(await one(`SELECT name, holders FROM circle.role WHERE id = 'editor'`), { name: 'Editor', holders: null }, 'the Editor role reads uncapped')
  const entry = await one<{ p: Record<string, unknown> }>(`SELECT cella.opened($1) AS p`, [out[0].entry])
  assert.ok('holders' in entry.p && entry.p.holders === null, 'its entry carries the cap as none')
  assert.deepEqual(entry.p.was, { holders: 2 }, 'its entry says what the cap was')
  assert.match(
    reason(await moving([{ kind: 'amend-role', args: { role: 'editor', holders: null } }])),
    /the amendment of the editor role changes nothing: it is named Editor, capped at no count/,
  )
})

test('a role the Settings tab proposed by its name alone is made under the id its name gives', async () => {
  const [first] = proposed
  assert.ok(first, 'the Settings tab proposed a role')
  const making = await one<{ motion: string }>(`SELECT motion FROM motion.action WHERE kind = 'role' AND args ->> 'name' = $1`, [first.role])
  const out = await decided(making.motion)
  assert.deepEqual(states(out), [['circle:role:make', 'settled', '']])
  assert.deepEqual(await one(`SELECT id, circle FROM circle.role WHERE name = $1`, [first.role]), { id: first.id, circle: 'web' }, 'its id is its name in lower case')
})
