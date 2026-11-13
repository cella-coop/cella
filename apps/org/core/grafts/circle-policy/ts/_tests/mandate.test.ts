// Mandates and rights, alone, on a database holding only the app's core:
// a mandate is a policy granted to one grantee, a circle or a role, whose
// values this graft holds sound, copies into `circle.mandate` as it is
// adopted and revokes as it ends, and a right one of its own kind, copied
// into `circle.right`, and a publication of the assembly its parts,
// copied into `circle.publication`, which a person who is no member reads
// by while it stands; its guards refuse a mandate policy adopted without
// its mandate, and an end that leaves it standing. Run by `cella test
// slice circle-policy`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const pays = (cap: string) => `The {role: finance} role holds {power: pay-supplier}, to pay suppliers, up to {limit: ${cap}} a write`
const flaw = async (marked: object) => (await db.query<{ r: string | null }>('SELECT circle_policy.mandate_flaw($1) AS r', [marked])).rows[0].r
const guard = async (fn: string, policy: string) => (await db.query<{ r: string | null }>(`SELECT circle_policy.${fn}($1) AS r`, [{ policy }])).rows[0].r
const adopt = async (kind: string, wording: string, motion: string, n: number, replaces: string | null = null) =>
  (
    await db.query<{ id: string }>(`SELECT policy.adopt('ag', $1, $2, NULL, $3, $4, cella.verdict_date(), NULL, $5) AS id`, [
      kind,
      wording,
      motion,
      n,
      replaces,
    ])
  ).rows[0].id
const mandate = async (policy: string) =>
  (
    await db.query<{ grantee: string; power: string; limit: number; from: string; revoked: string | null }>(
      `SELECT grantee, power, cella.cents("limit")::int AS "limit", to_char("from", 'YYYY-MM-DD') AS "from", to_char(revoked, 'YYYY-MM-DD') AS revoked
       FROM circle.mandate WHERE policy = $1`,
      [policy],
    )
  ).rows[0]

// Each test stages its circles and roles in its own transaction, beside
// the circles test's on the same database, and rolls them back.
const staged = async () => {
  await db.query('BEGIN')
  await db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('ag', 'Assembly', true) ON CONFLICT DO NOTHING`)
  await db.query(`INSERT INTO circle.circle (id, name) VALUES ('operations', 'Operations') ON CONFLICT DO NOTHING`)
  await db.query(`INSERT INTO circle.role (id, circle, name) VALUES ('finance', 'operations', 'Finance'), ('lead', '*', 'Circle lead') ON CONFLICT DO NOTHING`)
}

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-11-21'`)
})

after(async () => {
  await db.end()
})

test('a mandate marks one grantee, a role or a circle, a power in lower case and at most one cap, an amount', async () => {
  await staged()
  try {
    assert.equal(await flaw({ role: 'finance', power: 'pay-supplier', limit: '3 000 €' }), null)
    assert.equal(await flaw({ role: 'lead', power: 'approve-expense', budget: '1 000 €', per: 'month' }), null)
    assert.match((await flaw({ power: 'pay-supplier' })) ?? '', /names its grantee/)
    assert.match((await flaw({ role: 'printer', power: 'pay-supplier' })) ?? '', /no role printer/)
    assert.match((await flaw({ role: 'finance', power: 'Pay suppliers' })) ?? '', /power in lower case/)
    assert.match((await flaw({ role: 'finance', power: 'pay-supplier', limit: '3 000 €', budget: '1 000 €', per: 'month' })) ?? '', /not both/)
    assert.match((await flaw({ role: 'finance', power: 'pay-supplier', limit: 'three thousand' })) ?? '', /a limit is an amount/)
    assert.match((await flaw({ role: 'finance', power: 'pay-supplier', budget: '1 000 €' })) ?? '', /per month or per year/)
    assert.match((await flaw({ role: 'finance', power: 'pay-supplier', rate: '20 %' })) ?? '', /not rate/)
    assert.equal(await flaw({ role: 'lead', power: 'manage-project', scope: 'own' }), null)
    assert.equal(await flaw({ role: 'finance', power: 'pay-supplier', scope: 'operations' }), null)
    assert.match((await flaw({ role: 'lead', power: 'manage-project', scope: 'print' })) ?? '', /scope is a circle, as \{scope: web\}, or its holder's own/)
    // A collective mandate marks a circle instead: one grantee, whose kind
    // is the one it is marked as.
    assert.equal(await flaw({ circle: 'operations', power: 'admit-member' }), null)
    assert.match((await flaw({ power: 'admit-member' })) ?? '', /names its grantee, a role, as {role: finance}, or a circle, as {circle: ag}/)
    assert.match((await flaw({ role: 'finance', circle: 'operations', power: 'admit-member' })) ?? '', /one grantee, a role or a circle/)
    assert.match((await flaw({ circle: 'web', power: 'admit-member' })) ?? '', /no circle web/)
    assert.match((await flaw({ role: 'operations', power: 'admit-member' })) ?? '', /no role operations/)
    assert.match((await flaw({ circle: 'finance', power: 'admit-member' })) ?? '', /no circle finance/)
    // A person never holds a mandate, and a right is none.
    assert.match((await flaw({ person: 'julien@lanterne.coop', power: 'pay-supplier' })) ?? '', /a person holds no mandate/)
    assert.match((await flaw({ right: 'employee', power: 'claim-expense' })) ?? '', /a right is no mandate/)
  } finally {
    await db.query('ROLLBACK')
  }
})

test('adopting a mandate policy copies its values into its mandate, and one replacing it revokes it the day it applies', async () => {
  await staged()
  try {
    const first = await adopt('mandate', pays('3 000 €'), 'm-2026-020', 1)
    assert.match((await guard('grants', first)) ?? '', /m-2026-020\/1 grants no mandate: its values are copied as it is adopted/)
    await db.query('SELECT circle_policy.mandate_from($1)', [first])
    assert.equal(await guard('grants', first), null)
    assert.deepEqual(await mandate(first), { grantee: 'finance', power: 'pay-supplier', limit: 300000, from: '2026-11-21', revoked: null })

    const second = await adopt('mandate', pays('4 000 €'), 'm-2026-020', 2, first)
    await db.query('SELECT circle_policy.mandate_from($1)', [second])
    assert.equal(await guard('grants', second), null)
    assert.equal((await mandate(second)).limit, 400000)
    assert.equal((await mandate(first)).revoked, '2026-11-21')

    // A rule grants no mandate.
    const rule = await adopt('rule', 'Refused clients are named in the internal rules', 'm-2026-020', 3)
    assert.equal(await db.query('SELECT mandate AS m FROM circle_policy.mandate_from($1)', [rule]).then((r) => r.rows[0].m), null)
    assert.equal(await guard('grants', rule), null)
  } finally {
    await db.query('ROLLBACK')
  }
})

test('ending a mandate policy revokes its mandate on the day it ends', async () => {
  await staged()
  try {
    const policy = await adopt('mandate', pays('3 000 €'), 'm-2026-020', 1)
    await db.query('SELECT circle_policy.mandate_from($1)', [policy])
    await db.query(`SELECT policy.end($1, 'm-2026-021', 1)`, [policy])
    assert.match((await guard('revokes', policy)) ?? '', /is not revoked the day it ends/)
    await db.query('SELECT circle_policy.mandate_ended($1)', [policy])
    assert.equal(await guard('revokes', policy), null)
    assert.equal((await mandate(policy)).revoked, '2026-11-21')
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a policy whose values grant no mandate is refused as it is copied', async () => {
  await staged()
  try {
    const policy = await adopt('mandate', 'The {role: printer} role holds {power: pay-supplier}', 'm-2026-020', 1)
    await db.query('SAVEPOINT copy')
    await assert.rejects(db.query('SELECT circle_policy.mandate_from($1)', [policy]), (e: Error & { code?: string }) => {
      assert.equal(e.code, '09000', e.message)
      assert.match(e.message, /no role printer/)
      return true
    })
    await db.query('ROLLBACK TO SAVEPOINT copy')
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a collective mandate is on a circle, and the circle holds it itself, not the circle above nor any role', async () => {
  await staged()
  try {
    const holds = async (circle: string, power: string) =>
      (await db.query<{ h: boolean }>(`SELECT circle.holds($1, $2, cella.verdict_date()) AS h`, [circle, power])).rows[0].h
    assert.equal(await holds('operations', 'admit-member'), false)
    const policy = await adopt('mandate', 'The {circle: operations} circle holds {power: admit-member}, to admit members, by motion', 'm-2026-020', 1)
    await db.query('SELECT circle_policy.mandate_from($1)', [policy])
    assert.equal(await guard('grants', policy), null)
    assert.deepEqual(
      (await db.query(`SELECT m.grantee, g.kind, m.power FROM circle.mandate m JOIN circle.grantee g ON g.id = m.grantee WHERE m.policy = $1`, [policy])).rows,
      [{ grantee: 'operations', kind: 'circle', power: 'admit-member' }],
    )
    assert.equal(await holds('operations', 'admit-member'), true)
    assert.equal(await holds('ag', 'admit-member'), false)
    assert.equal(await holds('operations', 'suspend-member'), false)
    await db.query(`SELECT policy.end($1, 'm-2026-021', 1)`, [policy])
    await db.query('SELECT circle_policy.mandate_ended($1)', [policy])
    assert.equal(await holds('operations', 'admit-member'), false)
    // A grantee is a circle or a role, never a person.
    await db.query('SAVEPOINT holder')
    await assert.rejects(
      db.query(`INSERT INTO circle.mandate (grantee, issuer, power, policy, "from") VALUES ('julien@lanterne.coop', 'ag', 'admit-member', 'm-2026-022/1', '2026-01-01')`),
      /mandate_grantee_fkey/,
    )
    await db.query('ROLLBACK TO SAVEPOINT holder')
  } finally {
    await db.query('ROLLBACK')
  }
})

test('every circle and every role is a grantee, and a circle and a role never share an id', async () => {
  await staged()
  try {
    assert.deepEqual(
      (await db.query(`SELECT id, kind FROM circle.grantee WHERE id IN ('ag', 'operations', 'finance', 'lead', 'participant') ORDER BY id`)).rows,
      [
        { id: 'ag', kind: 'circle' },
        { id: 'finance', kind: 'role' },
        { id: 'lead', kind: 'role' },
        { id: 'operations', kind: 'circle' },
        { id: 'participant', kind: 'role' },
      ],
    )
    await db.query('SAVEPOINT shared')
    await assert.rejects(db.query(`INSERT INTO circle.role (id, circle, name) VALUES ('operations', 'operations', 'Operator')`), (e: Error & { code?: string }) => {
      assert.equal(e.code, '09000', e.message)
      assert.match(e.message, /operations is a circle already: a circle and a role never share an id/)
      return true
    })
    await db.query('ROLLBACK TO SAVEPOINT shared')
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a right is a policy of its own kind, copied into circle.right with no grantee, and ending it revokes it', async () => {
  await staged()
  try {
    const right = async (marked: object) => (await db.query<{ r: string | null }>('SELECT circle_policy.right_flaw($1) AS r', [marked])).rows[0].r
    assert.equal(await right({ right: 'employee', power: 'claim-expense' }), null)
    assert.match((await right({ power: 'claim-expense' })) ?? '', /names who it is given to/)
    assert.match((await right({ right: 'visitor', power: 'keep-profile' })) ?? '', /every person, member or employee, as {right: member}, not visitor/)
    assert.match((await right({ right: 'member', role: 'finance', power: 'draw-account' })) ?? '', /not role/)

    const policy = await adopt('right', 'Every {right: employee} holds {power: log-time}, to log, correct and submit their own time', 'm-2026-020', 1)
    assert.match((await guard('grants', policy)) ?? '', /gives no right: its values are copied as it is adopted/)
    assert.equal(await db.query('SELECT mandate AS m FROM circle_policy.mandate_from($1)', [policy]).then((r) => r.rows[0].m), null, 'a right is no mandate')
    assert.equal(await guard('grants', policy), null)
    assert.deepEqual(
      (await db.query(`SELECT "right", power, to_char(revoked, 'YYYY-MM-DD') AS revoked FROM circle.right WHERE policy = $1`, [policy])).rows,
      [{ right: 'employee', power: 'log-time', revoked: null }],
    )
    assert.equal((await db.query('SELECT count(*)::int AS n FROM circle.mandate WHERE policy = $1', [policy])).rows[0].n, 0)

    await db.query(`SELECT policy.end($1, 'm-2026-021', 1)`, [policy])
    assert.match((await guard('revokes', policy)) ?? '', /right \d+ of m-2026-020\/1 is not revoked the day it ends/)
    await db.query('SELECT circle_policy.mandate_ended($1)', [policy])
    assert.equal(await guard('revokes', policy), null)
  } finally {
    await db.query('ROLLBACK')
  }
})

const books = (contributors: string, largest = '50 %', two = '80 %') =>
  `Open books shares a total of members' own figures with every member where at least {disclosure_contributors: ${contributors} | more is stricter} people put into it, none of them more than {disclosure_largest: ${largest} | less is stricter} of it and no two more than {disclosure_two: ${two} | less is stricter}`
const marks = (wording: string) =>
  db
    .query<{ m: object }>(
      `SELECT jsonb_object_agg(p.name, jsonb_build_object('literal', p.literal, 'stricter', p.stricter)) AS m FROM policy.marks($1) p`,
      [wording],
    )
    .then((r) => r.rows[0].m)
const unsound = async (wording: string, issuer = 'ag') =>
  (await db.query<{ r: string | null }>('SELECT circle_policy.disclosure_flaw($1, $2) AS r', [await marks(wording), issuer])).rows[0].r

test('open books\' disclosure rule is the assembly\'s, marks its three values soundly, and is copied as it is adopted and revoked as it is replaced', async () => {
  await staged()
  try {
    assert.equal(await unsound(books('5')), null)
    assert.equal(await unsound('Refused clients are named in the internal rules'), null, 'a rule marking none is no disclosure rule')
    assert.match((await unsound(books('5'), 'web')) ?? '', /only a motion of the assembly adopts it/)
    assert.match((await unsound(books('1'))) ?? '', /disclosure_contributors is the fewest people a total may count, a whole number from 2 to 200, as 5, not 1/)
    assert.match((await unsound(books('5', '10 %'))) ?? '', /disclosure_largest is the most of a total one person may put in, a share from 20 % to 100 %/)
    assert.match((await unsound(books('5', '60 %', '50 %'))) ?? '', /two people put in at least what one does: disclosure_two, 50 %, is no less than disclosure_largest, 60 %/)
    assert.match((await unsound(books('5').replace('| more is stricter', '| less is stricter'))) ?? '', /more people is stricter/)
    assert.match((await unsound('At least {disclosure_contributors: 5 | more is stricter} people')) ?? '', /marks all three/)
    assert.match((await unsound(`${books('5')}, as {disclosure_noise: 2}`)) ?? '', /and nothing else, not disclosure_noise/)

    const first = await adopt('rule', books('5'), 'm-2026-020', 1)
    assert.match((await guard('grants', first)) ?? '', /sets no disclosure values open books reads/)
    await db.query('SELECT circle_policy.mandate_from($1)', [first])
    assert.equal(await guard('grants', first), null)
    const disclosed = async () =>
      (await db.query('SELECT policy, contributors, largest::int AS largest, two::int AS two FROM circle.disclosed(cella.verdict_date())')).rows
    assert.deepEqual(await disclosed(), [{ policy: first, contributors: 5, largest: 50, two: 80 }])

    const second = await adopt('rule', books('7', '40 %', '60 %'), 'm-2026-020', 2, first)
    await db.query('SELECT circle_policy.mandate_from($1)', [second])
    assert.equal(await guard('grants', second), null)
    assert.deepEqual(await disclosed(), [{ policy: second, contributors: 7, largest: 40, two: 60 }])

    await db.query(`SELECT policy.end($1, 'm-2026-021', 1)`, [second])
    assert.match((await guard('revokes', second)) ?? '', /the disclosure values of .* are not revoked the day it ends/)
    await db.query('SELECT circle_policy.mandate_ended($1)', [second])
    assert.equal(await guard('revokes', second), null)
    assert.deepEqual(await disclosed(), [], 'with no rule standing, open books shares nothing')
  } finally {
    await db.query('ROLLBACK')
  }
})

const publishes = (parts: string) => `The co-op publishes its {publish: ${parts}} to every person signed in to the scope, member or not`
const unpublished = async (wording: string, issuer = 'ag') =>
  (await db.query<{ r: string | null }>('SELECT circle.publication_flaw($1, $2) AS r', [await marks(wording), issuer])).rows[0].r

test('a publication is the assembly\'s, names the parts it publishes, and a person signed in who is no member reads exactly those while it stands', async () => {
  await staged()
  try {
    assert.equal(await unpublished(publishes('circles and roles')), null)
    assert.equal(await unpublished(publishes('circles, roles, mandates, seats and register')), null)
    assert.equal(await unpublished('Refused clients are named in the internal rules'), null, 'a rule marking no publish is no publication')
    assert.match((await unpublished(publishes('circles'), 'operations')) ?? '', /only a motion of the assembly adopts it/)
    assert.match((await unpublished(publishes('circles and pay'))) ?? '', /any of circles, roles, mandates, seats and register, as \{publish: circles and roles\}, not pay/)
    assert.match((await unpublished(`${publishes('circles')}, as {publish_noise: 2}`)) ?? '', /marks publish and nothing else, not publish_noise/)

    // Who is signed in, sits nowhere and holds no role reads none of the
    // structure, as the app's role reads it.
    const candidate = 'candidate@denial.example'
    await db.query(`INSERT INTO circle.tenure (holder, role, circle) VALUES ('chloe@lanterne.example', 'finance', 'operations')`)
    const reads = async (actor: string | null = candidate) => {
      await db.query('SAVEPOINT reading')
      try {
        await db.query('SET LOCAL ROLE cella_app')
        await db.query(`SELECT set_config('cella.actor', $1, true)`, [actor ?? ''])
        const n = async (sql: string) => (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${sql}`)).rows[0].n
        return {
          circles: await n('circle.circle'),
          roles: await n('circle.role'),
          grantees: await n('circle.grantee'),
          tenures: await n('circle.tenure'),
          policies: await n('policy.policy'),
        }
      } finally {
        await db.query('ROLLBACK TO SAVEPOINT reading')
      }
    }
    const nothing = { circles: 0, roles: 0, grantees: 0, tenures: 0, policies: 0 }
    assert.deepEqual(await reads(), nothing)

    const ruled = await adopt('rule', publishes('circles and roles'), 'm-2026-030', 1)
    assert.match((await guard('grants', ruled)) ?? '', /publishes nothing the structure's policies read/)
    await db.query('SELECT circle_policy.mandate_from($1)', [ruled])
    assert.equal(await guard('grants', ruled), null)
    const whole = (await db.query<{ circles: number; roles: number; grantees: number }>(
      `SELECT (SELECT count(*) FROM circle.circle)::int AS circles, (SELECT count(*) FROM circle.role)::int AS roles,
              (SELECT count(*) FROM circle.grantee)::int AS grantees`,
    )).rows[0]
    assert.deepEqual(await reads(), { ...whole, tenures: 0, policies: 0 }, 'every circle and role and their grantees, and no seat and no policy')
    assert.deepEqual(await reads(null), nothing, 'no one signed in reads nothing published')

    await db.query(`SELECT policy.end($1, 'm-2026-031', 1)`, [ruled])
    assert.match((await guard('revokes', ruled)) ?? '', /the publication of .* is not revoked the day it ends/)
    await db.query('SELECT circle_policy.mandate_ended($1)', [ruled])
    assert.equal(await guard('revokes', ruled), null)
    assert.deepEqual(await reads(), nothing, 'ended, it publishes nothing')
  } finally {
    await db.query('ROLLBACK')
  }
})

// What adopting a rule refuses, as the write that adopts it would, or
// null where it is copied.
const refused = async (policy: string) => {
  await db.query('SAVEPOINT adopting')
  try {
    await db.query('SELECT circle_policy.mandate_from($1)', [policy])
    await db.query('RELEASE SAVEPOINT adopting')
    return null
  } catch (e) {
    await db.query('ROLLBACK TO SAVEPOINT adopting')
    return (e as Error).message
  }
}

test('one publication and one disclosure rule stand at a time, so ending one revives no earlier one', async () => {
  await staged()
  try {
    const published = async () => {
      await db.query('SAVEPOINT reading')
      try {
        await db.query('SET LOCAL ROLE cella_app')
        await db.query(`SELECT set_config('cella.actor', 'candidate@denial.example', true)`)
        return (await db.query<{ parts: string[] }>(
          `SELECT ARRAY(SELECT p FROM unnest(ARRAY['circles', 'roles', 'mandates', 'seats', 'register']) p WHERE circle.published(p)) AS parts`,
        )).rows[0].parts
      } finally {
        await db.query('ROLLBACK TO SAVEPOINT reading')
      }
    }
    const first = await adopt('rule', publishes('circles'), 'm-2026-040', 1)
    assert.equal(await refused(first), null)
    const beside = await adopt('rule', publishes('circles and roles'), 'm-2026-041', 1)
    assert.match(
      (await refused(beside)) ?? '',
      new RegExp(`^${first} publishes parts of the structure from \\d{4}-\\d{2}-\\d{2}: one publication stands at a time, so one on days that meet its replaces ${first}$`),
    )
    await db.query(`SELECT policy.end($1, 'm-2026-042', 1)`, [beside])
    const next = await adopt('rule', publishes('circles and roles'), 'm-2026-043', 1, first)
    assert.equal(await refused(next), null, 'a publication replacing the one in force stands')
    assert.deepEqual(await published(), ['circles', 'roles'])
    await db.query(`SELECT policy.end($1, 'm-2026-044', 1)`, [next])
    await db.query('SELECT circle_policy.mandate_ended($1)', [next])
    assert.deepEqual(await published(), [], 'ending the later publication publishes nothing the earlier did')

    const disclosed = async () => (await db.query('SELECT policy FROM circle.disclosed(cella.verdict_date())')).rows
    const rule = await adopt('rule', books('5', '50 %', '80 %'), 'm-2026-045', 1)
    assert.equal(await refused(rule), null)
    const other = await adopt('rule', books('7', '40 %', '60 %'), 'm-2026-046', 1)
    assert.match((await refused(other)) ?? '', new RegExp(`^${rule} sets open books' disclosure values from .*: one disclosure rule stands at a time, so one on days that meet its replaces ${rule}$`))
    await db.query(`SELECT policy.end($1, 'm-2026-047', 1)`, [other])
    const stricter = await adopt('rule', books('7', '40 %', '60 %'), 'm-2026-048', 1, rule)
    assert.equal(await refused(stricter), null)
    await db.query(`SELECT policy.end($1, 'm-2026-049', 1)`, [stricter])
    await db.query('SELECT circle_policy.mandate_ended($1)', [stricter])
    assert.deepEqual(await disclosed(), [], 'ending the later rule leaves none standing')
  } finally {
    await db.query('ROLLBACK')
  }
})
