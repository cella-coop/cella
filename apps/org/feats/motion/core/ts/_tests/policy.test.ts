// Policies, alone, on a database holding only the app's core and this
// feat: the register in org's core reads the values a legal wording marks,
// each once, hashes a policy as its wordings are kept, refuses a
// wording that marks one twice, and is written only through
// `policy.adopt` and ended through `policy.end`, whose wording no
// guard may read, and holds each ordered value of a rule to the way it
// says is stricter; this feat's guards hold a proposal to a sound policy,
// an adoption to the policy the motion carries and an end to the policy
// it names. Run by `cella test slice motion`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const solidarity = 'Associations and small co-ops pay the solidarity rate, {rate: 20 % | less is stricter} below the rate card'

const refused = async (sql: string, values: unknown[], says: RegExp) => {
  await db.query('SAVEPOINT refused')
  try {
    await assert.rejects(db.query(sql, values), (e: Error & { code?: string }) => {
      assert.equal(e.code, '09000', e.message)
      assert.match(e.message, says)
      return true
    })
  } finally {
    await db.query('ROLLBACK TO SAVEPOINT refused')
  }
}

const adopt = (wording: string, n: number, extra: { replaces?: string; applies?: string } = {}) =>
  db.query<{ id: string }>(`SELECT policy.adopt('ag', 'rule', $1, NULL, 'm-2026-014', $2, $3::date, NULL, $4) AS id`, [
    wording,
    n,
    extra.applies ?? '2026-11-21',
    extra.replaces ?? null,
  ])

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-11-21'`)
  await db.query(
    `INSERT INTO motion.motion (id, circle, proposer, title, method, procedure, proposed, deadline) VALUES
       ('m-2026-014', 'ag', 'camille@lanterne.example', 'The solidarity rate', 'consent', 'consent', '2026-11-07', '2026-11-21')`,
  )
  await db.query(
    `INSERT INTO motion.action (motion, n, kind, args) VALUES
       ('m-2026-014', 1, 'policy', $1),
       ('m-2026-014', 2, 'policy', $2)`,
    [
      { kind: 'rule', wording: solidarity, friendly: 'Associations pay a fifth less than the rate card.' },
      { kind: 'rule', wording: 'Refused clients are named in the internal rules' },
    ],
  )
})

after(async () => {
  await db.end()
})

test('a legal wording\'s values are those it marks, each typed by how it is written', async () => {
  const { rows } = await db.query(
    `SELECT m.n, m.name, m.literal, t.type, t.value
     FROM policy.marks($1) m, policy.typed(m.name, m.literal) t ORDER BY m.n`,
    ['{payer_role: finance} may pay suppliers up to {limit: 3 000 €} a payment, from {from: 1 January 2026} for {months: 24} months at {rate: 2,5 %}, as {power: pay-supplier}'],
  )
  assert.deepEqual(rows, [
    { n: 1, name: 'payer_role', literal: 'finance', type: 'role', value: 'finance' },
    { n: 2, name: 'limit', literal: '3 000 €', type: 'amount', value: 300000 },
    { n: 3, name: 'from', literal: '1 January 2026', type: 'day', value: '2026-01-01' },
    { n: 4, name: 'months', literal: '24', type: 'number', value: 24 },
    { n: 5, name: 'rate', literal: '2,5 %', type: 'share', value: 2.5 },
    { n: 6, name: 'power', literal: 'pay-supplier', type: 'power', value: 'pay-supplier' },
  ])
  const read = (await db.query<{ s: string }>('SELECT policy.sentence($1) AS s', [solidarity])).rows[0].s
  assert.equal(read, 'Associations and small co-ops pay the solidarity rate, 20 % below the rate card')
})

test('a wording that marks a value twice, marks one without a value, or holds a stray brace is flawed; a friendly one marks none', async () => {
  const flaw = async (legal: string, friendly: string | null = null) =>
    (await db.query<{ f: string | null }>('SELECT policy.flaw($1, $2) AS f', [legal, friendly])).rows[0].f
  assert.equal(await flaw(solidarity, 'A fifth less.'), null)
  assert.equal(await flaw('Refused clients are named in the internal rules'), null, 'a rule may bind by its words alone')
  assert.match((await flaw('Pay {rate: 20 %} below, and never more than {rate: 20 %}')) ?? '', /rate is marked twice: each value is marked once in its sentence/)
  assert.match((await flaw('Pay {rate:} below')) ?? '', /rate is marked with no value/)
  assert.match((await flaw('Pay {20 %} below')) ?? '', /a brace in a policy marks a value, as \{name: value\}/)
  assert.match((await flaw(solidarity, 'A fifth, {rate: 20 %}, less')) ?? '', /friendly wording marks no value/)
  assert.match((await flaw('  ')) ?? '', /a policy is a sentence/)
})

test('a rule\'s ordered value says which way is stricter, and a value of no order says none', async () => {
  const flaw = async (kind: string, legal: string) =>
    (await db.query<{ f: string | null }>('SELECT policy.flaw($1, $2, NULL) AS f', [kind, legal])).rows[0].f
  assert.equal(await flaw('rule', solidarity), null)
  assert.equal(await flaw('rule', 'Each associate subscribes at least {minimum: 10 | More  is stricter} shares'), null)
  assert.deepEqual(
    (await db.query(`SELECT name, literal, stricter FROM policy.marks('at least {minimum: 10 | more is stricter}, at most {ratio: 1.6 | less is stricter}')`)).rows,
    [
      { name: 'minimum', literal: '10', stricter: 'more' },
      { name: 'ratio', literal: '1.6', stricter: 'less' },
    ],
  )
  assert.equal((await db.query<{ s: string }>(`SELECT policy.sentence('at least {minimum: 10 | more is stricter} shares') AS s`)).rows[0].s, 'at least 10 shares')
  assert.match((await flaw('rule', 'Each associate subscribes at least {minimum: 10} shares')) ?? '', /minimum is 10: a rule's value says which way is stricter, as \{minimum: 10 \| more is stricter\}/)
  assert.match((await flaw('rule', 'at least {minimum: 10 | higher}')) ?? '', /minimum says "higher": a value says which way is stricter/)
  assert.match((await flaw('rule', 'We refuse {sector: arms makers | more is stricter}')) ?? '', /sector is text, which has no order/)
  assert.equal(await flaw('rule', 'We refuse {sector: arms makers}'), null, 'a text value says no direction')
  assert.equal(await flaw('mandate', 'The {role: finance} role holds {power: pay-supplier}, up to {limit: 3 000 €} a write'), null, 'only a rule must')
  await db.query('BEGIN')
  try {
    await refused(`SELECT policy.adopt('ag', 'rule', $1, NULL, 'm-2026-014', 5, '2026-11-21', NULL, NULL)`, ['at least {minimum: 10} shares'], /a rule's value says which way is stricter/)
  } finally {
    await db.query('ROLLBACK')
  }
})


test('the register is written only through policy.adopt, which only the app may call, and no guard reads a wording', async () => {
  const { rows } = await db.query(`SELECT
      has_function_privilege('cella_app', 'policy.adopt(text, text, text, text, text, integer, date, date, text, text, text)', 'EXECUTE') AS app_adopts,
      has_function_privilege('cella_guards', 'policy.adopt(text, text, text, text, text, integer, date, date, text, text, text)', 'EXECUTE') AS guards_adopt,
      has_table_privilege('cella_app', 'policy.policy', 'INSERT') AS app_inserts,
      has_table_privilege('cella_app', 'policy.wording', 'SELECT') AS app_reads_wording,
      has_table_privilege('cella_guards', 'policy.wording', 'SELECT') AS guards_read_wording,
      has_table_privilege('cella_guards', 'policy.value', 'SELECT') AS guards_read_values,
      has_column_privilege('cella_guards', 'policy.default', 'hash', 'SELECT') AS guards_read_default_hashes,
      has_column_privilege('cella_guards', 'policy.default', 'legal', 'SELECT') AS guards_read_default_wording`)
  assert.deepEqual(rows[0], {
    app_adopts: true,
    guards_adopt: false,
    app_inserts: false,
    app_reads_wording: true,
    guards_read_wording: false,
    guards_read_values: true,
    guards_read_default_hashes: true,
    guards_read_default_wording: false,
  })
})

test('adopting keeps the policy with its motion, its days and its value once; a wording marking one twice is refused', async () => {
  await db.query('BEGIN')
  try {
    assert.equal((await adopt(solidarity, 1)).rows[0].id, 'm-2026-014/1')
    assert.deepEqual(
      (await db.query(`SELECT id, circle, kind, motion, n, to_char(applies, 'YYYY-MM-DD') AS applies, ends FROM policy.policy`)).rows,
      [{ id: 'm-2026-014/1', circle: 'ag', kind: 'rule', motion: 'm-2026-014', n: 1, applies: '2026-11-21', ends: null }],
    )
    assert.deepEqual((await db.query('SELECT policy, name, type, literal, value, stricter FROM policy.value')).rows, [
      { policy: 'm-2026-014/1', name: 'rate', type: 'share', literal: '20 %', value: 20, stricter: 'less' },
    ])
    assert.deepEqual((await db.query(`SELECT id FROM policy.in_force('ag', '2026-11-21')`)).rows, [{ id: 'm-2026-014/1' }])
    assert.deepEqual((await db.query(`SELECT id FROM policy.in_force('ag', '2026-11-20')`)).rows, [], 'not before it applies')
    await refused(`SELECT policy.adopt('ag', 'rule', $1, NULL, 'm-2026-014', 2, '2026-11-21', NULL, NULL)`, ['{rate: 20 %} and {rate: 20 %}'], /rate is marked twice/)
    await refused(`SELECT policy.adopt('ag', 'rule', $1, NULL, 'm-2026-014', 1, '2026-11-21', NULL, NULL)`, [solidarity], /m-2026-014\/1 is adopted already/)
    await refused(`SELECT policy.adopt('ag', 'mandate', $1, NULL, 'm-2026-014', 2, '2026-11-21', NULL, 'm-2026-014/1')`, [solidarity], /replaces no mandate of ag in force/)

    // A replacement ends the policy it replaces the day it applies.
    await adopt('Associations pay the solidarity rate, {rate: 25 % | less is stricter} below the rate card', 2, { replaces: 'm-2026-014/1', applies: '2026-12-01' })
    assert.deepEqual(
      (await db.query(`SELECT id, to_char(ends, 'YYYY-MM-DD') AS ends, replaces FROM policy.policy ORDER BY id`)).rows,
      [
        { id: 'm-2026-014/1', ends: '2026-12-01', replaces: null },
        { id: 'm-2026-014/2', ends: null, replaces: 'm-2026-014/1' },
      ],
    )
    assert.deepEqual((await db.query(`SELECT id FROM policy.in_force('ag', '2026-12-01')`)).rows, [{ id: 'm-2026-014/2' }])
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a proposal adopts only a sound policy of a kind, applying no earlier than its deadline', async () => {
  const asks = async (args: object) => {
    await db.query('BEGIN')
    try {
      await db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ('m-2026-014', 3, 'policy', $1)`, [args])
      return (await db.query<{ r: string | null }>(`SELECT motion.asks('{"motion": "m-2026-014"}') AS r`)).rows[0].r
    } finally {
      await db.query('ROLLBACK')
    }
  }
  assert.equal(await asks({ kind: 'rule', wording: 'Remote work is two days a week' }), null)
  assert.match((await asks({ kind: 'rule', wording: '{rate: 20 %}, then {rate: 20 %}' })) ?? '', /rate is marked twice/)
  assert.match((await asks({ kind: 'rule', wording: 'at least {minimum: 10} shares' })) ?? '', /minimum is 10: a rule's value says which way is stricter/)
  assert.match((await asks({ kind: 'custom', wording: 'x' })) ?? '', /a policy is a mandate, a right, a rule or a procedure, not custom/)
  assert.match((await asks({ kind: 'rule', wording: 'x', from: '2026-11-14' })) ?? '', /applies at the earliest from 2026-11-21/)
  assert.match((await asks({ kind: 'rule', wording: 'x', from: '1 December' })) ?? '', /written YYYY-MM-DD/)
  assert.match((await asks({ kind: 'rule', wording: 'x', replaces: 'm-2026-001/1' })) ?? '', /no rule of ag in force on 2026-11-21 is m-2026-001\/1$/)
  // It ends after the day it would apply were the motion closed at its
  // deadline: its from, or else the deadline; on that day is refused too.
  assert.equal(await asks({ kind: 'rule', wording: 'x', from: '2026-11-25', until: '2026-11-26' }), null)
  assert.match((await asks({ kind: 'rule', wording: 'x', from: '2026-11-25', until: '2026-11-25' })) ?? '', /a policy ends after the day it applies, 2026-11-25 were m-2026-014 closed at its deadline/)
  assert.match((await asks({ kind: 'rule', wording: 'x', until: '2026-11-21' })) ?? '', /a policy ends after the day it applies, 2026-11-21/)
  assert.match((await asks({ kind: 'rule', wording: 'x', until: '2026-11-20' })) ?? '', /a policy ends after the day it applies, 2026-11-21/)
  assert.equal(await asks({ kind: 'rule', wording: 'x', until: '2026-11-22' }), null)
})

test('a publication or a disclosure rule proposed replaces the one standing on days its own meet, and a motion proposes one of a kind', async () => {
  const publishes = (parts: string) => `The co-op publishes its {publish: ${parts}} to every person signed in to the scope, member or not`
  const asks = async (...actions: object[]) => {
    await db.query('SAVEPOINT asking')
    try {
      for (const [i, args] of actions.entries()) {
        await db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ('m-2026-014', $1, 'policy', $2)`, [3 + i, args])
      }
      return (await db.query<{ r: string | null }>(`SELECT motion.circle_asks('{"motion": "m-2026-014"}') AS r`)).rows[0].r
    } finally {
      await db.query('ROLLBACK TO SAVEPOINT asking')
    }
  }
  await db.query('BEGIN')
  try {
    assert.equal(await asks({ kind: 'rule', wording: publishes('circles') }), null)
    assert.match(
      (await asks({ kind: 'rule', wording: publishes('circles') }, { kind: 'rule', wording: publishes('roles'), from: '2026-12-01' })) ?? '',
      /^actions 3 and 4 of m-2026-014 are both a publication on days that meet: one stands at a time, so a motion adopts one$/,
    )
    assert.equal(
      await asks({ kind: 'rule', wording: publishes('circles'), until: '2026-12-01' }, { kind: 'rule', wording: publishes('roles'), from: '2026-12-01' }),
      null,
      'one after the other',
    )
    const standing = (await adopt(publishes('circles'), 9)).rows[0].id
    await db.query('SELECT circle.mandate_from($1)', [standing])
    assert.match(
      (await asks({ kind: 'rule', wording: publishes('roles') })) ?? '',
      new RegExp(`^${standing} publishes parts of the structure from 2026-11-21: one publication stands at a time, so one on days that meet its replaces ${standing}$`),
    )
    assert.equal(await asks({ kind: 'rule', wording: publishes('roles'), replaces: standing }), null)
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a policy replaces only the one in force the day it would apply, and replaced by no other', async () => {
  const asks = async (args: object) => {
    await db.query(`UPDATE motion.action SET args = $1 WHERE motion = 'm-2026-016'`, [args])
    return (await db.query<{ r: string | null }>(`SELECT motion.asks('{"motion": "m-2026-016"}') AS r`)).rows[0].r
  }
  const adopts = async (payload: object) => (await db.query<{ r: string | null }>('SELECT motion.adopts($1) AS r', [payload])).rows[0].r
  const remote = (days: number) => `Remote work is at most {days: ${days} | less is stricter} days a week`
  await db.query('BEGIN')
  try {
    // A applies today; B, adopted today, replaces it from 1 January.
    await adopt(solidarity, 1)
    await adopt('Associations pay the solidarity rate, {rate: 25 % | less is stricter} below the rate card', 2, { replaces: 'm-2026-014/1', applies: '2027-01-01' })
    await db.query(
      `INSERT INTO motion.motion (id, circle, proposer, title, method, procedure, proposed, deadline) VALUES
         ('m-2026-016', 'ag', 'camille@lanterne.example', 'Remote work', 'consent', 'consent', '2026-11-21', '2026-11-28'),
         ('m-2026-017', 'ag', 'camille@lanterne.example', 'Remote work, again', 'consent', 'consent', '2026-11-21', '2026-11-28')`,
    )
    await db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ('m-2026-016', 1, 'policy', '{}'), ('m-2026-017', 1, 'policy', '{}')`)

    // A rule replacing A, from its deadline or from June, is told to replace B.
    const already = /^m-2026-014\/2 replaces m-2026-014\/1 already, from 2027-01-01: a policy replacing it now replaces m-2026-014\/2 and applies on or after that day$/
    assert.match((await asks({ kind: 'rule', wording: solidarity, replaces: 'm-2026-014/1' })) ?? '', already)
    assert.match((await asks({ kind: 'rule', wording: solidarity, replaces: 'm-2026-014/1', from: '2027-06-01' })) ?? '', already)
    // Replacing B, from its day or later, it is accepted; before it, B is not yet in force.
    assert.equal(await asks({ kind: 'rule', wording: solidarity, replaces: 'm-2026-014/2', from: '2027-01-01' }), null)
    assert.equal(await asks({ kind: 'rule', wording: solidarity, replaces: 'm-2026-014/2', from: '2027-03-01' }), null)
    assert.match(
      (await asks({ kind: 'rule', wording: solidarity, replaces: 'm-2026-014/2', from: '2026-12-01' })) ?? '',
      /^no rule of ag in force on 2026-12-01 is m-2026-014\/2: it applies from 2027-01-01$/,
    )
    assert.match((await asks({ kind: 'mandate', wording: solidarity, replaces: 'm-2026-014/2', from: '2027-01-01' })) ?? '', /^no mandate of ag in force on 2027-01-01 is m-2026-014\/2$/)

    // Two motions replace B: the first to close adopts; the second's
    // adoption is refused by the guard, naming the first's policy.
    await db.query(`UPDATE motion.action SET args = $1 WHERE motion IN ('m-2026-016', 'm-2026-017')`, [
      { kind: 'rule', wording: remote(2), replaces: 'm-2026-014/2', from: '2027-02-01' },
    ])
    await db.query(`SET LOCAL cella.clock = '2026-11-28'`)
    assert.equal(await adopts({ motion: 'm-2026-017', n: 1, policy: '' }), 'm-2026-017 adopted no policy  by this write')
    await db.query(`SELECT policy.adopt('ag', 'rule', $1, NULL, 'm-2026-016', 1, '2027-02-01', NULL, 'm-2026-014/2')`, [remote(2)])
    const hash = (await db.query<{ h: string }>(`SELECT encode(policy.hash($1, NULL), 'hex') AS h`, [remote(2)])).rows[0].h
    assert.equal(await adopts({ motion: 'm-2026-016', n: 1, policy: 'm-2026-016/1', hash }), null, 'its own replacement is no other')
    assert.equal(
      await adopts({ motion: 'm-2026-017', n: 1, policy: '' }),
      'm-2026-017/1 does not replace m-2026-014/2: m-2026-016/1 replaces m-2026-014/2 already, from 2027-02-01: a policy replacing it now replaces m-2026-016/1 and applies on or after that day',
    )
    assert.equal(
      (await db.query<{ f: string | null }>(`SELECT motion.replacement_flaw('ag', 'rule', 'm-2026-014/2', '2027-02-01', 'm-2026-017/1') AS f`)).rows[0].f,
      'm-2026-016/1 replaces m-2026-014/2 already, from 2027-02-01: a policy replacing it now replaces m-2026-016/1 and applies on or after that day',
      'the write asks the same SQL before it writes the register',
    )
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a policy ends only after the day it applies, however late its motion closes', async () => {
  const adopts = async (payload: object) => (await db.query<{ r: string | null }>('SELECT motion.adopts($1) AS r', [payload])).rows[0].r
  await db.query('BEGIN')
  try {
    // Proposed with an end after its deadline, the motion closes four days
    // late: the policy would apply on the verdict date, on or after its end.
    await db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES
      ('m-2026-014', 3, 'policy', '{"kind": "rule", "wording": "Remote work is two days a week", "until": "2026-11-25"}'),
      ('m-2026-014', 4, 'policy', '{"kind": "rule", "wording": "Remote work is three days a week", "until": "2026-11-24"}')`)
    await db.query(`SET LOCAL cella.clock = '2026-11-25'`)
    await refused(`SELECT policy.adopt('ag', 'rule', 'Remote work is two days a week', NULL, 'm-2026-014', 3, '2026-11-25', '2026-11-25', NULL)`, [],
      /m-2026-014\/3 would end on 2026-11-25, not after 2026-11-25, the day it applies: a policy ends after the day it applies/)
    await refused(`SELECT policy.adopt('ag', 'rule', 'Remote work is three days a week', NULL, 'm-2026-014', 4, '2026-11-25', '2026-11-24', NULL)`, [],
      /m-2026-014\/4 would end on 2026-11-24, not after 2026-11-25/)
    assert.match((await adopts({ motion: 'm-2026-014', n: 3, policy: 'm-2026-014/3' })) ?? '', /m-2026-014\/3 would end on 2026-11-25, not after 2026-11-25, the day it applies/)
    assert.match((await adopts({ motion: 'm-2026-014', n: 4, policy: 'm-2026-014/4' })) ?? '', /m-2026-014\/4 would end on 2026-11-24, not after 2026-11-25/)
    assert.deepEqual((await db.query('SELECT id FROM policy.policy')).rows, [], 'the register keeps no policy never in force')
    // A day later than it applies, it is adopted, and in force until the day before it ends.
    await db.query(`SELECT policy.adopt('ag', 'rule', 'Remote work is two days a week', NULL, 'm-2026-014', 3, '2026-11-25', '2026-11-26', NULL)`)
    assert.deepEqual((await db.query(`SELECT id FROM policy.in_force('ag', '2026-11-25')`)).rows, [{ id: 'm-2026-014/3' }])
    assert.deepEqual((await db.query(`SELECT id FROM policy.in_force('ag', '2026-11-26')`)).rows, [])
  } finally {
    await db.query('ROLLBACK')
  }
})

test('an adoption is the policy its motion carries, worded as the motion names it', async () => {
  const adopts = async (payload: object) => (await db.query<{ r: string | null }>('SELECT motion.adopts($1) AS r', [payload])).rows[0].r
  await db.query('BEGIN')
  try {
    assert.match((await adopts({ motion: 'm-2026-014', n: 1, policy: 'm-2026-014/1' })) ?? '', /adopted no policy m-2026-014\/1 by this write/)
    await db.query(`SELECT policy.adopt('ag', 'rule', $1, $2, 'm-2026-014', 1, '2026-11-21', NULL, NULL)`, [
      solidarity,
      'Associations pay a fifth less than the rate card.',
    ])
    const hash = (await db.query<{ h: string }>(`SELECT encode(policy.hash($1, $2), 'hex') AS h`, [solidarity, 'Associations pay a fifth less than the rate card.'])).rows[0].h
    assert.equal(await adopts({ motion: 'm-2026-014', n: 1, policy: 'm-2026-014/1', hash }), null)
    assert.match((await adopts({ motion: 'm-2026-014', n: 1, policy: 'm-2026-014/1' })) ?? '', /the entry does not commit to m-2026-014\/1's hash/)
    assert.match((await adopts({ motion: 'm-2026-014', n: 3, policy: 'm-2026-014/3' })) ?? '', /adopts no policy as its action 3/)
    // Worded otherwise than the motion carries: the hash differs.
    await db.query(`SELECT policy.adopt('ag', 'rule', 'Refused clients are named in the rate card', NULL, 'm-2026-014', 2, '2026-11-21', NULL, NULL)`)
    assert.match((await adopts({ motion: 'm-2026-014', n: 2, policy: 'm-2026-014/2' })) ?? '', /m-2026-014\/2 is not the policy m-2026-014 adopts/)
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a policy taking a default with its friendly wording padded or left empty stands taken, hashed as its wordings are kept', async () => {
  const consent = 'By {procedure: consent}, a motion is decided by {method: consent}, with a quorum of {quorum: none}: it passes if no member on its roll objects at its close'
  const twoThirds = 'By {procedure: two-thirds}, a motion is decided by a {method: majority} of {share: 2/3} of the votes cast, with a quorum of {quorum: none}'
  const taking = (legal: string, friendly: string, n: number, takes: string) =>
    db.query(`SELECT policy.adopt('ag', 'procedure', $1, $2, 'm-2026-014', $3, '2026-11-21', NULL, NULL, NULL, $4)`, [legal, friendly, n, takes])
  await db.query('BEGIN')
  try {
    await taking(consent, '  A motion passes if no one objects.  ', 3, 'scop-sarl-fr:consent')
    await taking(twoThirds, '', 4, 'scop-sarl-fr:two-thirds')
    const kept = await db.query(
      `SELECT p.id, w.friendly, p.hash = d.hash AS as_default, p.hash = policy.hash(w.legal, w.friendly) AS as_kept
       FROM policy.policy p JOIN policy.wording w ON w.policy = p.id JOIN policy.default d ON d.id = p.takes ORDER BY p.id`,
    )
    assert.deepEqual(kept.rows, [
      { id: 'm-2026-014/3', friendly: 'A motion passes if no one objects.', as_default: true, as_kept: true },
      { id: 'm-2026-014/4', friendly: null, as_default: true, as_kept: true },
    ])
    const stands = await db.query(`SELECT id, standing FROM policy.standing('ag', '2026-11-21') WHERE policy IS NOT NULL ORDER BY id`)
    assert.deepEqual(stands.rows, [
      { id: 'scop-sarl-fr:consent', standing: 'taken' },
      { id: 'scop-sarl-fr:two-thirds', standing: 'taken' },
    ])
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a policy is ended by a motion of its own circle, on the verdict date, by the action the register records', async () => {
  const ends = async (payload: object) => (await db.query<{ r: string | null }>('SELECT motion.ends($1) AS r', [payload])).rows[0].r
  const asks = async () => (await db.query<{ r: string | null }>(`SELECT motion.asks('{"motion": "m-2026-015"}') AS r`)).rows[0].r
  const may = (await db.query(`SELECT has_function_privilege('cella_app', 'policy.end(text, text, integer)', 'EXECUTE') AS app,
      has_function_privilege('cella_guards', 'policy.end(text, text, integer)', 'EXECUTE') AS guards`)).rows[0]
  assert.deepEqual(may, { app: true, guards: false })
  await db.query('BEGIN')
  try {
    await adopt(solidarity, 1)
    await db.query(
      `INSERT INTO motion.motion (id, circle, proposer, title, method, procedure, proposed, deadline) VALUES
         ('m-2026-015', 'ag', 'camille@lanterne.example', 'No solidarity rate', 'consent', 'consent', '2026-11-07', '2026-11-21')`,
    )
    await db.query(`INSERT INTO motion.action (motion, n, kind, args) VALUES ('m-2026-015', 1, 'end', '{"policy": "m-2026-014/1"}')`)
    assert.equal(await asks(), null)
    await db.query(`UPDATE motion.action SET args = '{"policy": "m-2026-001/9"}' WHERE motion = 'm-2026-015'`)
    assert.match((await asks()) ?? '', /no policy of ag in force is m-2026-001\/9: a policy is ended by its own circle/)
    await db.query(`UPDATE motion.action SET args = '{"policy": "m-2026-014/1"}' WHERE motion = 'm-2026-015'`)

    const payload = { motion: 'm-2026-015', n: 1, policy: 'm-2026-014/1', ends: '2026-11-21' }
    assert.match((await ends(payload)) ?? '', /m-2026-014\/1 was not ended by this write/)
    assert.equal((await db.query(`SELECT to_char(policy.end('m-2026-014/1', 'm-2026-015', 1), 'YYYY-MM-DD') AS e`)).rows[0].e, '2026-11-21')
    assert.equal(await ends(payload), null)
    assert.deepEqual((await db.query(`SELECT ended_by FROM policy.policy WHERE id = 'm-2026-014/1'`)).rows, [{ ended_by: 'm-2026-015/1' }])
    assert.deepEqual((await db.query(`SELECT id FROM policy.in_force('ag', '2026-11-21')`)).rows, [])
    await refused(`SELECT policy.end($1, 'm-2026-015', 1)`, ['m-2026-014/1'], /m-2026-014\/1 is no policy in force on 2026-11-21/)
  } finally {
    await db.query('ROLLBACK')
  }
})
