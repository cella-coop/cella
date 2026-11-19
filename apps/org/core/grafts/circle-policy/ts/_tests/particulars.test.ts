// The coop's particulars, alone, on a database holding only the app's
// core: a rule of the assembly marking what the coop is called and the
// mentions its papers print, each a text, whose values this graft holds
// sound, copies into `circle.particulars` as it is adopted and revokes as
// it is replaced or ends; one stands at a time, and every reader reads
// the one in force, signed in or not. Run by `cella test slice
// circle-policy`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

const db = new pg.Client()

const particulars = (seat: string, siren = '123456789') =>
  `The coop is called {particulars_name: Lanterne}, its legal name {particulars_legal_name: Lanterne Worker Co-operative}, a {particulars_form: Worker co-operative limited company with variable capital}, whose seat is {particulars_seat: ${seat}}, registered under SIREN {particulars_siren: ${siren}} at the trade register of {particulars_rcs: Bobigny}, with the VAT number {particulars_vat: FR12123456789}`
const montreuil = '14 rue des Graviers, 93100 Montreuil, France'
const paris = '3 avenue Gambetta, 75020 Paris, France'

const adopt = async (wording: string, motion: string, replaces: string | null = null) =>
  (
    await db.query<{ id: string }>(`SELECT policy.adopt('ag', 'rule', $1, NULL, $2, 1, cella.verdict_date(), NULL, $3) AS id`, [
      wording,
      motion,
      replaces,
    ])
  ).rows[0].id
const guard = async (fn: string, policy: string) => (await db.query<{ r: string | null }>(`SELECT circle_policy.${fn}($1) AS r`, [{ policy }])).rows[0].r
const marks = (wording: string) =>
  db
    .query<{ m: object }>(
      `SELECT jsonb_object_agg(p.name, jsonb_build_object('literal', p.literal, 'stricter', p.stricter)) AS m FROM policy.marks($1) p`,
      [wording],
    )
    .then((r) => r.rows[0].m)
const unsound = async (wording: string, issuer = 'ag') =>
  (await db.query<{ r: string | null }>('SELECT circle.particulars_flaw($1, $2) AS r', [await marks(wording), issuer])).rows[0].r

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

// The particulars in force as the app's role reads them, for `actor`, or
// for no one signed in.
const read = async (actor: string | null = null) => {
  await db.query('SAVEPOINT reading')
  try {
    await db.query('SET LOCAL ROLE cella_app')
    await db.query(`SELECT set_config('cella.actor', $1, true)`, [actor ?? ''])
    return (await db.query<{ policy: string; name: string; seat: string; siren: string }>('SELECT policy, name, seat, siren FROM circle.particulars()')).rows
  } finally {
    await db.query('ROLLBACK TO SAVEPOINT reading')
  }
}

const staged = async () => {
  await db.query('BEGIN')
  await db.query(`INSERT INTO circle.circle (id, name, assembly) VALUES ('ag', 'Assembly', true) ON CONFLICT DO NOTHING`)
  await db.query(`INSERT INTO circle.circle (id, name) VALUES ('operations', 'Operations') ON CONFLICT DO NOTHING`)
}

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-11-21'`)
})

after(async () => {
  await db.end()
})

test('the particulars are the assembly\'s, name the coop, mark nothing else and a SIREN of nine digits', async () => {
  await staged()
  try {
    assert.equal(await unsound(particulars(montreuil)), null)
    assert.equal(await unsound(particulars(montreuil, '123 456 789')), null, 'a SIREN may be spaced')
    assert.equal(await unsound('The coop is called {particulars_name: Lanterne}'), null, 'a name alone is enough')
    assert.equal(await unsound('Refused clients are named in the internal rules'), null, 'a rule marking none is no particulars')
    assert.match((await unsound(particulars(montreuil), 'operations')) ?? '', /^the coop's particulars are the assembly's: only a motion of the assembly adopts them$/)
    assert.match((await unsound('Its seat is {particulars_seat: Montreuil}')) ?? '', /^the coop's particulars name it, as \{particulars_name: Lanterne\}$/)
    assert.match((await unsound(`${particulars(montreuil)}, with {particulars_motto: light}`)) ?? '', /and nothing else, not particulars_motto$/)
    assert.match((await unsound(particulars(montreuil, '12345'))) ?? '', /^a SIREN is nine digits, as \{particulars_siren: 123 456 789\}, not 12345$/)
  } finally {
    await db.query('ROLLBACK')
  }
})

test('the register types the SIREN and the capital as text, and no other value by their name', async () => {
  const typed = async (name: string, literal: string) =>
    (await db.query<{ type: string }>('SELECT type FROM policy.typed($1, $2)', [name, literal])).rows[0].type
  assert.equal(await typed('particulars_siren', '000000000'), 'text')
  assert.equal(await typed('particulars_capital', '7 500 €'), 'text')
  assert.equal(await typed('patronage_capital', '50 %'), 'share')
  assert.equal(await typed('siren', '000000000'), 'number')
  assert.equal((await db.query<{ r: string | null }>(`SELECT policy.flaw('rule', $1, NULL) AS r`, [particulars(montreuil, '000000000')])).rows[0].r, null)
})

test('the particulars are copied as they are adopted, read by everyone, replaced one at a time, and gone once ended', async () => {
  await staged()
  try {
    const first = await adopt(particulars(montreuil), 'm-2026-050')
    assert.match((await guard('grants', first)) ?? '', /sets no particulars the coop's papers read/)
    assert.equal(await refused(first), null)
    assert.equal(await guard('grants', first), null)
    const lanterne = [{ policy: first, name: 'Lanterne', seat: montreuil, siren: '123456789' }]
    assert.deepEqual(await read(), lanterne, 'no one signed in reads the particulars')
    assert.deepEqual(await read('candidate@denial.example'), lanterne, 'a person who is no member reads them')

    const beside = await adopt(particulars(paris), 'm-2026-051')
    assert.match(
      (await refused(beside)) ?? '',
      new RegExp(`^${first} sets the coop's particulars from 2026-11-21: one particulars rule stands at a time, so one on days that meet its replaces ${first}$`),
    )
    await db.query(`SELECT policy.end($1, 'm-2026-052', 1)`, [beside])

    const moved = await adopt(particulars(paris), 'm-2026-053', first)
    assert.equal(await refused(moved), null, 'particulars replacing those in force stand')
    assert.equal(await guard('grants', moved), null)
    assert.deepEqual(await read(), [{ policy: moved, name: 'Lanterne', seat: paris, siren: '123456789' }])
    assert.equal(
      (await db.query<{ revoked: string }>(`SELECT to_char(revoked, 'YYYY-MM-DD') AS revoked FROM circle.particulars WHERE policy = $1`, [first])).rows[0].revoked,
      '2026-11-21',
      'those replaced are revoked the day the next apply',
    )

    await db.query(`SELECT policy.end($1, 'm-2026-054', 1)`, [moved])
    assert.match((await guard('revokes', moved)) ?? '', /the particulars of .* are not revoked the day it ends/)
    await db.query('SELECT circle_policy.mandate_ended($1)', [moved])
    assert.equal(await guard('revokes', moved), null)
    assert.deepEqual(await read(), [], 'ended, no particulars stand, and none an earlier rule set')
  } finally {
    await db.query('ROLLBACK')
  }
})

test('a logo is one SVG that runs nothing and reaches nothing outside itself, copied with the particulars', async () => {
  const lantern =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><path id="glass" d="M10 12h12v12H10z"/></defs><use href="#glass" fill="url(#glow)"/><rect width="32" height="32" rx="7" fill="#1d4f5c"/></svg>'
  const logo = (svg: string) => `The coop is called {particulars_name: Lanterne}, and bears the mark {particulars_logo: ${svg}}`
  await staged()
  try {
    assert.equal(await unsound(logo(lantern)), null, 'a logo referencing only its own parts is sound')
    const refusals: [string, RegExp][] = [
      ['<svg><script>alert(1)</script></svg>', /^a coop's logo runs no script: drop its <script>$/],
      ['<svg><SCRIPT href="#x"></SCRIPT></svg>', /runs no script/],
      ['<svg onload="alert(1)"></svg>', /^a coop's logo handles no event: drop its onload=…$/],
      ['<svg><rect x="0" onclick="alert(1)"/></svg>', /handles no event: drop its onclick=/],
      ['<svg><a href="javascript:alert(1)"><rect/></a></svg>', /references only its own parts|links nowhere/],
      ['<svg><a xlink:href="https://evil.example/"><rect/></a></svg>', /references only its own parts, as href="#flame", not href="https:/],
      ['<svg><image href="https://evil.example/pixel.png"/></svg>', /references only its own parts/],
      ['<svg><use href=data:image/svg+xml,x /></svg>', /references only its own parts/],
      ['<svg><rect fill="url(https://evil.example/f)"/></svg>', /references only its own parts, as url\(#glow\)/],
      ['<svg><foreignObject><iframe src="https://evil.example"></iframe></foreignObject></svg>', /embeds no HTML/],
      ['<svg><set attributeName="href" to="#x"/></svg>', /animates no reference/],
      ['<!DOCTYPE svg [ <!ENTITY x "y"> ]><svg></svg>', /one SVG, from <svg to <\/svg>/],
      ['<svg><!-- a note --></svg>', /^a coop's logo declares nothing: drop its <!-- a note --$/],
      ['<svg><rect style="fill:red"/><style>@import url(https://evil.example/a.css);</style></svg>', /references only its own parts/],
      ['<img src="x">', /one SVG, from <svg to <\/svg>/],
      [`<svg>${'<rect/>'.repeat(700)}</svg>`, /^a coop's logo is an SVG of at most 4096 characters, not 4911$/],
    ]
    for (const [svg, why] of refusals) {
      assert.match((await unsound(logo(svg))) ?? '', why, svg.slice(0, 60))
    }

    const lit = await adopt(logo(lantern), 'm-2026-060')
    assert.equal(await refused(lit), null)
    assert.equal(await guard('grants', lit), null)
    assert.equal((await db.query<{ logo: string }>('SELECT logo FROM circle.particulars()')).rows[0].logo, lantern, 'the logo is copied as written')

    const scripted = await adopt(logo('<svg onload="alert(1)"></svg>'), 'm-2026-061', lit)
    assert.match((await refused(scripted)) ?? '', /handles no event/, 'a logo the guard refuses is never adopted')
  } finally {
    await db.query('ROLLBACK')
  }
})
