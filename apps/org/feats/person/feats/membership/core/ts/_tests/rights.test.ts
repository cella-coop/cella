// Rights, on a database holding the app's core, its circles, and the person and membership
// feats: `membership.entitled` finds a right, no
// mandate, with no seat, held by whoever person's core says is one of the people
// it names that day: every person, every active member. A right no feat
// registered, every employee's here, where employment is not migrated,
// is held by no one; and `membership.rights` lists a right exactly
// where `entitled` grants it, and, read as the app's reader, answers a
// person for themselves and a member for anyone. Run by `cella test slice
// membership`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()
const amina = 'amina@rights'
const ines = 'ines@rights'
const paul = 'paul@rights'

const holds = async (actor: string, power: string, day = '2026-10-24') =>
  (await db.query<{ m: boolean }>('SELECT membership.may($1, $2, NULL, NULL, $3) OR membership.entitled($1, $2, NULL, $3) AS m', [actor, power, day])).rows[0].m

before(async () => {
  await db.connect()
  await db.query(`INSERT INTO person.person (address, name) VALUES ($1, 'Amina'), ($2, 'Inès'), ($3, 'Paul')`, [amina, ines, paul])
  await db.query(
    `INSERT INTO membership.member (address, status, since, exited) VALUES
       ($1, 'active', '2024-01-10', NULL), ($2, 'invited', NULL, NULL), ($3, 'exited', '2021-03-01', '2025-11-30')`,
    [amina, ines, paul],
  )
  await db.query(
    `INSERT INTO circle.right ("right", power, policy, "from") VALUES
       ('person', 'keep-profile', 'm-2021-001/1', '2021-03-01'),
       ('member', 'draw-account', 'm-2021-001/2', '2021-03-01'),
       ('employee', 'log-time', 'm-2021-001/3', '2021-03-01')`,
  )
})

after(async () => {
  await db.end()
})

test('every person holds a person\'s right, member or not, with no seat; someone unknown holds none', async () => {
  for (const who of [amina, ines, paul]) {
    assert.equal(await holds(who, 'keep-profile'), true, who)
  }
  assert.equal(await holds('nobody@x', 'keep-profile'), false)
  const seats = await db.query('SELECT count(*)::int AS n FROM circle.seat WHERE member = ANY($1)', [[amina, ines, paul]])
  assert.equal(seats.rows[0].n, 0)
})

test('a member\'s right is held by the active members on the day: not by an invitee, nor by one gone since', async () => {
  assert.equal(await holds(amina, 'draw-account'), true)
  assert.equal(await holds(ines, 'draw-account'), false)
  assert.equal(await holds(paul, 'draw-account'), false)
  assert.equal(await holds(paul, 'draw-account', '2025-06-01'), true, 'he was a member then')
})

test('a right\'s function overloaded under its name runs the overload registered', async () => {
  // The function registered for the member's right takes the address as
  // varchar; the overload takes the text a call passes, which a call by
  // name alone would prefer, and would make everyone a member.
  await db.query('BEGIN')
  try {
    await db.query(`CREATE SCHEMA extender`)
    await db.query(`CREATE FUNCTION extender.active(address varchar, day date) RETURNS boolean LANGUAGE sql STABLE RETURN membership.active(address, day)`)
    await db.query(`CREATE FUNCTION extender.active(address text, day date) RETURNS boolean LANGUAGE sql STABLE RETURN true`)
    await db.query(`UPDATE person.rights SET fn = 'extender.active(varchar, date)' WHERE name = 'member'`)
    assert.equal(await holds(amina, 'draw-account'), true)
    assert.equal(await holds(ines, 'draw-account'), false)
    assert.equal(await holds(paul, 'draw-account'), false)
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a right nobody registered is held by no one, and a right grants only its power', async () => {
  assert.equal(await holds(amina, 'log-time'), false)
  assert.equal(await holds(amina, 'approve-time'), false)
})

test('a right is never the authority reads ask: it lets each act on their own, and opens no one else\'s rows', async () => {
  assert.equal((await db.query(`SELECT membership.entitled($1, 'keep-profile', NULL, '2026-10-24') AS m`, [amina])).rows[0].m, true)
  assert.equal((await db.query(`SELECT membership.may($1, 'keep-profile', NULL, NULL, '2026-10-24') AS m`, [amina])).rows[0].m, false)
})

test('rights lists a right exactly where entitled grants its power, as a person\'s page reads it', async () => {
  for (const [who, day] of [[amina, '2026-10-24'], [ines, '2026-10-24'], [paul, '2026-10-24'], [paul, '2025-06-01'], ['nobody@x', '2026-10-24']]) {
    const { rows } = await db.query<{ power: string }>(
      `SELECT power FROM membership.rights($1, $2) ORDER BY power`,
      [who, day],
    )
    const listed = rows.map((r) => r.power)
    for (const power of ['keep-profile', 'draw-account', 'log-time']) {
      const { rows: e } = await db.query<{ m: boolean }>(`SELECT membership.entitled($1, $2, NULL, $3) AS m`, [who, power, day])
      assert.equal(listed.includes(power), e[0].m, `${who} ${power} on ${day}`)
    }
  }
})

test('read as the app\'s reader, rights answers a person for themselves, a member for anyone, and a non-member nothing for another', async () => {
  const app = new pg.Client({ user: 'cella_app' })
  await app.connect()
  const read = async (reader: string, person: string) => {
    await app.query(`SELECT set_config('cella.actor', $1, false)`, [reader])
    return (await app.query<{ power: string }>(
      `SELECT power FROM membership.rights($1, '2026-10-24') ORDER BY power`,
      [person],
    )).rows.map((r) => r.power)
  }
  // Amina sits in the assembly as a member; Inès, invited, is none, and
  // reads no row of `circle.right`.
  await db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('ag', 'ag', true) ON CONFLICT DO NOTHING`)
  const root = (await db.query<{ id: string }>('SELECT circle.assembly() AS id')).rows[0].id
  const role = (await db.query(`INSERT INTO circle.role (id, circle, name) VALUES ('member', $1, 'Member') ON CONFLICT DO NOTHING RETURNING id`, [root])).rowCount
  const tenure = (await db.query<{ id: string }>(`INSERT INTO circle.tenure (circle, holder, role) VALUES ($1, $2, 'member') RETURNING id`, [root, amina])).rows[0].id
  try {
    await app.query(`SELECT set_config('cella.actor', $1, false)`, [ines])
    assert.deepEqual((await app.query('SELECT id FROM circle.right')).rows, [], 'Inès reads no row of circle.right')
    // What the slice's other tests register beside these rights, each
    // holds too: a reader reads exactly what the whole does, or nothing.
    const whole = async (person: string) =>
      (await db.query<{ power: string }>(`SELECT power FROM membership.rights($1, '2026-10-24') ORDER BY power`, [person])).rows.map((r) => r.power)
    assert.ok((await whole(ines)).includes('keep-profile') && !(await whole(ines)).includes('draw-account'))
    assert.ok((await whole(amina)).includes('draw-account'))
    assert.deepEqual(await read(ines, ines), await whole(ines), 'Inès reads her own rights, her person\'s among them')
    assert.deepEqual(await read(ines, amina), [], 'and no one else\'s')
    assert.deepEqual(await read(amina, amina), await whole(amina), 'Amina reads her own')
    assert.deepEqual(await read(amina, ines), await whole(ines), 'and, a member, anyone\'s')
    assert.deepEqual(await read('', ines), [], 'no one signed in reads none')
  } finally {
    await app.end()
    await db.query('DELETE FROM circle.tenure WHERE id = $1', [tenure])
    if (role) await db.query(`DELETE FROM circle.role WHERE id = 'member'`)
  }
})
