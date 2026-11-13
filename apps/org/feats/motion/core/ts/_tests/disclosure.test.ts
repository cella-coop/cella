// Open books on the assembly's page, alone, on a database holding only
// the app's core and this feat: the rule a `disclose` proposes is worded
// as core reads it, each value marked once with the way it is stricter,
// so the defaults are sound and a value out of range is core's to refuse,
// saying why; and each value the page shows is marked as exposing
// personal data, weaker than the default, or a precaution, by the
// disclosure study's words, before it is proposed; and a withholding ends
// the rule in force and nothing else. Run by `cella test slice motion`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Db } from '@cella/org-db'
import { disclosed, putting } from '../src/handlers/put.ts'
import { defaults, exposure } from '../src/models/disclosure.ts'

const db = new pg.Client()

before(async () => {
  await db.connect()
})

after(async () => {
  await db.end()
})

const flaw = async (wording: string) =>
  (
    await db.query<{ r: string | null }>(
      `SELECT circle_policy.disclosure_flaw(
         (SELECT jsonb_object_agg(p.name, jsonb_build_object('literal', p.literal, 'stricter', p.stricter)) FROM policy.marks($1) p),
         circle.assembly()) AS r`,
      [wording],
    )
  ).rows[0].r

test('the rule a disclose proposes is worded as core reads it: the defaults are sound, and a value out of range is core\'s to refuse', async () => {
  assert.equal(await flaw(disclosed({ ...defaults })), null)
  assert.equal(await flaw(disclosed({ contributors: 7, largest: 40, two: 70 })), null)
  assert.match((await flaw(disclosed({ contributors: 1, largest: 50, two: 80 }))) ?? '', /from 2 to 200, as 5, not 1/)
  assert.match((await flaw(disclosed({ contributors: 5, largest: 60, two: 50 }))) ?? '', /is no less than disclosure_largest/)
  assert.throws(() => disclosed({ contributors: 5, largest: 50 }), /say the most two people may put in/)
})

test('each value is marked by what it exposes before it is proposed, and none is called safe', () => {
  const level = (s: Parameters<typeof exposure>[0], v: number | boolean) => exposure(s, v).level
  assert.equal(level('share', true), 'exposes')
  assert.equal(level('share', false), 'precaution')
  assert.deepEqual([2, 3, 4, 5, 12].map((n) => level('contributors', n)), ['exposes', 'weaker', 'weaker', 'precaution', 'precaution'])
  assert.deepEqual([20, 50, 51, 99, 100].map((n) => level('largest', n)), ['precaution', 'precaution', 'weaker', 'weaker', 'exposes'])
  assert.deepEqual([40, 80, 81, 100].map((n) => level('two', n)), ['precaution', 'precaution', 'weaker', 'exposes'])
  assert.match(exposure('contributors', 2).words, /each of the two can work out the other’s exact amount/)
  assert.match(exposure('largest', 100).words, /turns this check off/)
  for (const s of ['share', 'contributors', 'largest', 'two'] as const) {
    for (const v of [true, false, 2, 5, 50, 80, 100]) {
      assert.doesNotMatch(exposure(s, v).words, /\b(safe|anonymous)\b/i)
    }
  }
})

// A withholding, put alone in a transaction rolled back: the assembly's
// disclosure rule in force, with a publication beside it.
test('a withholding ends the disclosure rule in force and nothing else: one naming another policy, put in another circle or where no rule stands is refused by the SQL, naming the rule, with nothing proposed', async () => {
  await db.query('BEGIN')
  try {
    await db.query(`SET LOCAL cella.clock = '2026-11-21'`)
    await db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('ag', 'Assembly', true), ('operations', 'Operations', false) ON CONFLICT DO NOTHING`)
    const withhold = (circle: string, policy: string) =>
      putting({ circle, kind: 'withhold', args: { policy }, deadline: '2026-12-05', body: '' }, db as unknown as Db)
    await assert.rejects(withhold('ag', 'p-none'), /no disclosure rule stands on 2026-11-21, so there is none to withhold/)
    const adopt = async (wording: string, n: number) => {
      const { id } = (
        await db.query<{ id: string }>(`SELECT policy.adopt('ag', 'rule', $1, NULL, 'm-2026-020', $2, cella.verdict_date(), NULL, NULL) AS id`, [wording, n])
      ).rows[0]
      await db.query('SELECT circle_policy.mandate_from($1)', [id])
      return id
    }
    const rule = await adopt(disclosed({ ...defaults }), 1)
    const publication = await adopt('The co-op publishes its {publish: circles and roles} to every person signed in to the scope, member or not', 2)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM circle.publication WHERE policy = $1', [publication])).rows[0].n, 1)
    const withholdings = async () => (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM motion.motion WHERE title LIKE 'Share no total%'")).rows[0].n
    const proposed = await withholdings()

    await assert.rejects(withhold('ag', publication), (e: Error) => {
      assert.equal(e.message, `withholding open books ends the disclosure rule in force, ${rule}, and nothing else, not ${publication}: name ${rule}`)
      return true
    })
    await assert.rejects(withhold('operations', rule), /disclosure rule is the assembly's: withhold it on the page of ag, not of operations/)
    assert.equal(await withholdings(), proposed, 'nothing is proposed')

    const put = await withhold('ag', rule)
    assert.equal(put.circle, 'ag')
    assert.deepEqual(put.actions, [{ kind: 'end', args: { policy: rule } }])
    assert.equal(put.title, "Share no total of members' own figures beyond each reader's own rights")
  } finally {
    await db.query('ROLLBACK')
  }
})
