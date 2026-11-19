// The SQL check's rule on owner-rights views: a view a slice's or core's
// migrations make reads as its reader, WITH (security_invoker = true),
// unless its comment declares it shared, and then it keeps what it declares: it sums
// by exactly the columns it names and by no column that says whose a row
// is, or keeps its rows by its reader's test. Its options are read through
// a later ALTER VIEW or CREATE OR REPLACE, its comment through both; a
// contract's views, read as their owner by design, are the contract
// rule's. A query, a view commented 'query: …', reads as its reader
// whatever else its comment says, and reads only what its slice may.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkSql, unshared } from '../sql-check.mjs'

const table = `CREATE SCHEMA ledger;
CREATE TABLE ledger.line (circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle, member text, account text, amount bigint);
DROP POLICY circle ON ledger.line;
CREATE POLICY reads ON ledger.line FOR SELECT TO cella_app USING ((SELECT cella.sees('ledger')) OR circle = ANY ((SELECT cella.circles('ledger'))::text[]) OR member = cella.reader());
`

// The check's errors and the view rule's, over one feat's migrations.
async function check(sql, more = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'cella-views-'))
  try {
    const dir = join(repo, 'apps/org/feats/ledger/core/sql')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(repo, 'apps/org/feats/ledger/feat.toml'), 'name = "ledger"\n')
    writeFileSync(join(repo, 'apps/org/feat.toml'), 'name = "org"\n')
    writeFileSync(join(dir, '001.sql'), table + sql)
    for (const [file, text] of Object.entries(more)) {
      writeFileSync(join(dir, file), text)
    }
    // A contract's views, each declared a published query, as a slice
    // declares them.
    const published = [...(more['analytics.sql'] ?? '').matchAll(/CREATE VIEW ([a-z_]+\.[a-z_]+)/g)].map((m) => `{ view: '${m[1]}', published: true }`)
    mkdirSync(join(dir, '../ts/src/api'), { recursive: true })
    writeFileSync(join(dir, '../ts/src/api/contract.ts'), `export const contract = [${published.join(', ')}]\n`)
    const found = { powers: [], guards: [], cites: [], stances: [], personal: [], impersonal: [], columns: [], foreign: [] }
    const errors = await checkSql(repo, ['apps/org'], new Set(['cella', 'ledger', 'circle']), found)
    return [...errors, ...unshared(found)].join('\n')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

const lines = 'SELECT l.member, l.account, l.amount FROM ledger.line l'

test('a view that reads as its owner is refused unless declared shared', async () => {
  assert.match(await check(`CREATE VIEW ledger.lines AS ${lines};`), /ledger.lines reads as its owner, past every row-level policy/)
  assert.match(
    await check(`CREATE VIEW ledger.lines AS ${lines};\nCOMMENT ON VIEW ledger.lines IS 'audience: scoped by circle: each line';`),
    /ledger.lines reads as its owner/,
    'scoped is a contract\'s audience, not an owner-rights view\'s',
  )
  assert.match(
    await check(`CREATE VIEW ledger.totals AS SELECT l.account, sum(l.amount) AS total FROM ledger.line l GROUP BY l.account;\nCOMMENT ON VIEW ledger.totals IS 'audience: shared by account';`),
    /ledger.totals reads as its owner/,
    'a declaration without its why is none',
  )
})

test('a view that reads as its reader takes no declaration, however it came to', async () => {
  assert.equal(await check(`CREATE VIEW ledger.lines WITH (security_invoker = true) AS ${lines};`), '')
  assert.equal(await check(`CREATE VIEW ledger.lines AS ${lines};\nALTER VIEW ledger.lines SET (security_invoker = true);`), '')
  assert.equal(await check(`CREATE VIEW ledger.lines AS ${lines};`, { '002.sql': 'ALTER VIEW ledger.lines SET (security_invoker = on);' }), '')
  assert.match(
    await check(`CREATE VIEW ledger.lines WITH (security_invoker = true) AS ${lines};`, { '002.sql': `CREATE OR REPLACE VIEW ledger.lines AS ${lines};` }),
    /ledger.lines reads as its owner/,
    'a replacement without the option reads as its owner, as Postgres replaces a view\'s options',
  )
  assert.match(
    await check(`CREATE VIEW ledger.lines AS ${lines};\nALTER VIEW ledger.lines SET (security_invoker = true);\nALTER VIEW ledger.lines RESET (security_invoker);`),
    /ledger.lines reads as its owner/,
  )
  assert.match(await check(`CREATE VIEW ledger.lines WITH (security_invoker = false) AS ${lines};`), /ledger.lines reads as its owner/)
})

test('a shared view that sums by the columns it names passes; one that sums by whose a row is, or finer, does not', async () => {
  const totals = (by, group = 'l.account', show = 'l.account') =>
    `CREATE VIEW ledger.totals AS SELECT ${show}, sum(l.amount) AS total, count(DISTINCT l.member) AS members FROM ledger.line l GROUP BY ${group};\nCOMMENT ON VIEW ledger.totals IS 'audience: shared by ${by}: the coop''s totals';`
  assert.equal(await check(totals('account')), '')
  assert.match(await check(totals('member', 'l.member', 'l.member')), /ledger.totals is declared shared, but shows or groups by ledger.line.member, which says whose a row is/)
  assert.match(await check(totals('account', 'l.account, l.member')), /ledger.totals groups by member, which it does not show|ledger.totals groups by l.member/)
  assert.match(await check(totals('kind')), /ledger.totals names kind in its audience, which it does not show/)
  // Its comment outlives a replacement, as the view does.
  assert.equal(await check(totals('account'), { '002.sql': 'CREATE OR REPLACE VIEW ledger.totals AS SELECT l.account, sum(l.amount) AS total, count(DISTINCT l.member) AS members FROM ledger.line l GROUP BY l.account;' }), '')
})

test('a shared view that shows the rows of a circle\'s records is refused, unless it keeps them by its reader\'s test', async () => {
  const filtered = (where) => `CREATE VIEW ledger.shares AS ${lines} WHERE l.amount > 0 AND (${where});\nCOMMENT ON VIEW ledger.shares IS 'audience: shared: a share that needs the whole to divide';`
  assert.equal(await check(filtered(`(SELECT cella.sees('ledger')) OR l.circle = ANY ((SELECT cella.circles('ledger'))::text[]) OR l.member = cella.reader()`)), '')
  assert.match(await check(filtered('l.account IS NOT NULL')), /ledger.shares shows the rows of ledger.line, which are a circle's records/)
  assert.match(await check(filtered(`l.member = cella.reader() OR l.amount > 100`)), /ledger.shares shows the rows of ledger.line/)
})

test('a shared view shows through its star, its WITH and the subqueries in its FROM', async () => {
  const declared = (body, by = 'who') => `CREATE VIEW ledger.totals AS ${body};\nCOMMENT ON VIEW ledger.totals IS 'audience: shared by ${by}: the coop''s totals';`
  for (const body of [
    'WITH w AS (SELECT l.member AS who, l.amount FROM ledger.line l) SELECT w.who, sum(w.amount) AS total FROM w GROUP BY w.who',
    'SELECT x.who, sum(x.amount) AS total FROM (SELECT l.member AS who, l.amount FROM ledger.line l) x GROUP BY x.who',
  ]) {
    assert.match(await check(declared(body)), /ledger.totals is declared shared, but shows or groups by ledger.line.member, which says whose a row is/, body)
  }
  const filtered = `CREATE VIEW ledger.shares AS SELECT * FROM ledger.line l WHERE l.amount > 0 AND (l.member = cella.reader() OR l.amount > 100);\nCOMMENT ON VIEW ledger.shares IS 'audience: shared: a share that needs the whole to divide';`
  assert.match(await check(filtered), /ledger.shares is declared shared, but shows or groups by ledger.line.member/)
  assert.equal(await check(declared('WITH w AS (SELECT l.account, l.amount FROM ledger.line l) SELECT w.account, sum(w.amount) AS total FROM w GROUP BY w.account', 'account')), '')
})

test('a contract\'s views are the contract rule\'s, never this one\'s', async () => {
  const contract = `CREATE VIEW ledger.accounts AS SELECT l.account, sum(l.amount) AS total FROM ledger.line l GROUP BY l.account;\nCOMMENT ON VIEW ledger.accounts IS 'audience: shared by account';\n`
  assert.equal(await check('', { 'analytics.sql': contract }), '')
})

test('a view core\'s migrations make keeps the same rule, since the app role reads it as a slice\'s', async () => {
  const repo = mkdtempSync(join(tmpdir(), 'cella-views-'))
  const core = async (sql) => {
    const dir = join(repo, 'apps/org/core/ledger/sql')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(repo, 'apps/org/feat.toml'), 'name = "org"\n')
    writeFileSync(join(dir, '001.sql'), `CREATE SCHEMA ledger;\nCREATE TABLE ledger.line (member text, amount bigint);\nALTER TABLE ledger.line ENABLE ROW LEVEL SECURITY;\n${sql}`)
    const found = { powers: [], guards: [], cites: [], stances: [], personal: [], impersonal: [], columns: [], foreign: [] }
    const errors = await checkSql(repo, ['apps/org'], new Set(['cella', 'ledger', 'circle']), found)
    return [...errors, ...unshared(found)].join('\n')
  }
  try {
    assert.match(await core('CREATE VIEW ledger.lines AS SELECT l.member, l.amount FROM ledger.line l;'), /ledger.lines reads as its owner, past every row-level policy/)
    assert.equal(await core('CREATE VIEW ledger.lines WITH (security_invoker = true) AS SELECT l.member, l.amount FROM ledger.line l;'), '')
    assert.equal(await core(`CREATE VIEW ledger.total AS SELECT sum(l.amount) AS total FROM ledger.line l;\nCOMMENT ON VIEW ledger.total IS 'audience: shared: the whole, which every member reads';`), '')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('a query written in SQL reads as its reader, and reads only what its slice may', async () => {
  const query = (options = ' WITH (security_invoker = true)', from = 'ledger.line l') =>
    `CREATE VIEW ledger.lines${options} AS SELECT l.member, l.account, l.amount FROM ${from};\nCOMMENT ON VIEW ledger.lines IS 'query: each line, for its reader';`
  assert.equal(await check(query()), '')
  assert.match(await check(query('')), /ledger.lines is a query and reads as its owner, past every row-level policy: a query reads as its reader/)
  assert.match(
    await check(`${query()}\nALTER VIEW ledger.lines RESET (security_invoker);`),
    /ledger.lines is a query and reads as its owner/,
    'a query whose option is reset reads as its owner',
  )
  assert.match(
    await check(`${query('')}\nCOMMENT ON VIEW ledger.lines IS 'query: audience: shared by account: the totals';`),
    /ledger.lines is a query and reads as its owner/,
    'a query that also names an audience is still a query',
  )
  assert.match(await check(query(undefined, 'bill.bill l')), /reads bill.bill: bill is outside/, 'a query past its slice\'s reach is refused as any of its SQL')
})
