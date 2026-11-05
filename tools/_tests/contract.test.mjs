// The SQL check's analytical contracts: a slice's sql/analytics.sql holds
// only views in its own schema, read as their owner; it shows a personal
// column only where it declares it, and a table under row-level security
// only as sums over everyone, or as the rows its policy opens by their
// circle alone; each view declares its audience, scoped by the circle
// that owns each row or shared as sums by the columns it names; nothing
// else grants the analytics role anything; and no core publishes a
// contract but the analytics port, in its own schema.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkSql } from '../sql-check.mjs'

// Two feats, a person's and a ledger's, each with a migration, and a
// contract for any slice named in `contracts`. `extra` replaces a feat's
// migration, and `extra.core` adds a core library's migration and contract.
const migrations = {
  person: `CREATE SCHEMA person;
CREATE TABLE person.person (address text PRIMARY KEY, name text, city text);
INSERT INTO cella.personal (schema, tab, col, class, subject, owner) VALUES ('person', 'person', 'name', 'profile', 'address', 'person');`,
  ledger: `CREATE SCHEMA ledger;
CREATE TABLE ledger.account (code text PRIMARY KEY, holder text, label text);
CREATE TABLE ledger.line (account text, member text, day date, amount bigint);
ALTER TABLE ledger.account ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger.line ENABLE ROW LEVEL SECURITY;
CREATE POLICY reads ON ledger.account FOR SELECT TO cella_app USING (holder IS NULL OR holder = cella.reader());
CREATE POLICY reads ON ledger.line FOR SELECT TO cella_app USING ((SELECT cella.sees('ledger')) OR member = cella.reader() OR cella.reaches('ledger', account));
CREATE VIEW ledger.days AS SELECT l.day, l.member, l.amount FROM ledger.line l;`,
  claim: `CREATE SCHEMA claim;
CREATE TABLE claim.claim (id text PRIMARY KEY, circle text NOT NULL REFERENCES circle.circle, member text, kind text, amount bigint);
CREATE POLICY own ON claim.claim FOR SELECT TO cella_app USING (member = cella.reader());
CREATE VIEW claim.rows AS SELECT c.id, c.kind, c.circle FROM claim.claim c;
CREATE VIEW claim.kinds AS SELECT c.kind, sum(c.amount)::bigint AS amount FROM claim.claim c GROUP BY c.kind;`,
}

// A view's audience, as its contract comments it.
const as = (view, audience = 'shared') => `\nCOMMENT ON VIEW ${view} IS 'audience: ${audience}';`

async function check(contracts, extra = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'cella-contract-'))
  try {
    for (const feat of ['person', 'ledger', 'claim']) {
      const dir = join(repo, 'apps/org/feats', feat, 'core/sql')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(repo, 'apps/org/feats', feat, 'feat.toml'), `name = "${feat}"\n`)
      writeFileSync(join(dir, '001.sql'), extra[feat] ?? migrations[feat])
      if (contracts[feat]) {
        writeFileSync(join(dir, 'analytics.sql'), contracts[feat])
      }
    }
    for (const [lib, sql] of Object.entries(extra.core ?? {})) {
      const dir = join(repo, 'apps/org/core', lib, 'sql')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, '001.sql'), sql.migration)
      writeFileSync(join(dir, 'analytics.sql'), sql.contract)
    }
    writeFileSync(join(repo, 'apps/org/feat.toml'), 'name = "org"\n')
    const known = new Set(['cella', 'person', 'ledger', 'claim'])
    return (await checkSql(repo, ['apps/org'], known)).join('\n')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

test('a contract of plain views, its personal column declared, passes', async () => {
  const errors = await check({
    person: `CREATE VIEW person.people AS SELECT p.address, p.name, p.city FROM person.person p;
COMMENT ON COLUMN person.people.name IS 'personal: shown on statements';${as('person.people')}`,
  })
  assert.equal(errors, '')
})

test('a contract holds only views and comments on them, in its own schema, read as their owner', async () => {
  const table = await check({ person: 'CREATE TABLE person.extra (x text);' })
  assert.match(table, /analytics.sql: holds Create: an analytical contract holds only views and comments on them/)
  const fn = await check({ person: 'CREATE FUNCTION person.f() RETURNS int LANGUAGE sql RETURN 1;' })
  assert.match(fn, /holds CreateFunction/)
  const other = await check({ person: 'CREATE VIEW ledger.people AS SELECT 1 AS one;' })
  assert.match(other, /creates ledger.people: feat person creates and grants only in its own schema/)
  const invoker = await check({ person: 'CREATE VIEW person.people WITH (security_invoker) AS SELECT p.address FROM person.person p;' })
  assert.match(invoker, /person.people is security_invoker/)
})

test('a personal column is shown only where the view declares it, personal or not', async () => {
  const bare = await check({ person: 'CREATE VIEW person.people AS SELECT p.address, p.name FROM person.person p;' })
  assert.match(bare, /person.people.name shows person.person.name, which is personal/)
  const renamed = await check({ person: 'CREATE VIEW person.people AS SELECT address, upper(name) AS shout FROM person.person;' })
  assert.match(renamed, /person.people.shout shows person.person.name/)
  const declared = await check({
    person: `CREATE VIEW person.people AS SELECT p.name FROM person.person p;
COMMENT ON COLUMN person.people.name IS 'not personal: only companies here';${as('person.people')}`,
  })
  assert.equal(declared, '')
  const counted = await check({ person: 'CREATE VIEW person.named AS SELECT count(p.name)::bigint AS n FROM person.person p;' + as('person.named') })
  assert.equal(counted, '', 'a sum over everyone shows no one\'s name')
})

test('a secured table shows only as sums, or as the rows its policy opens by their circle alone', async () => {
  const rows = await check({ ledger: 'CREATE VIEW ledger.lines AS SELECT l.day, l.amount FROM ledger.line l;' })
  assert.match(rows, /ledger.lines shows the rows of ledger.line, which is under row-level security/)
  const summed = await check({ ledger: 'CREATE VIEW ledger.months AS SELECT l.day, sum(l.amount)::bigint AS amount FROM ledger.line l GROUP BY l.day;' + as('ledger.months', 'shared by day') })
  assert.equal(summed, '')
  const counted = await check({ ledger: 'CREATE VIEW ledger.size AS SELECT count(*)::bigint AS lines FROM ledger.line;' + as('ledger.size') })
  assert.equal(counted, '')
  const open = await check({ ledger: 'CREATE VIEW ledger.chart AS SELECT a.code, a.label FROM ledger.account a WHERE a.holder IS NULL;' + as('ledger.chart', 'shared by code') })
  assert.equal(open, '')
  const shut = await check({ ledger: 'CREATE VIEW ledger.chart AS SELECT a.code, a.label FROM ledger.account a WHERE a.label IS NULL;' })
  assert.match(shut, /ledger.chart shows the rows of ledger.account/)
  const through = await check({ ledger: 'CREATE VIEW ledger.seen AS SELECT d.day FROM ledger.days d;' })
  assert.match(through, /ledger.seen shows the rows of ledger.days, which is under row-level security/, 'a view over a secured table is secured')
})

test('a sum by whose a row is is declared, through a view too', async () => {
  const mine = await check({ ledger: 'CREATE VIEW ledger.each AS SELECT l.member, sum(l.amount)::bigint AS amount FROM ledger.line l GROUP BY l.member;' })
  assert.match(mine, /ledger.each sums by ledger.line.member, which says whose a row is/)
  const reached = await check({ ledger: 'CREATE VIEW ledger.each AS SELECT l.account, sum(l.amount)::bigint AS amount FROM ledger.line l GROUP BY l.account;' })
  assert.match(reached, /sums by ledger.line.account/)
  const viewed = await check({ ledger: 'CREATE VIEW ledger.each AS SELECT d.member, sum(d.amount)::bigint AS amount FROM ledger.days d GROUP BY d.member;' })
  assert.match(viewed, /sums by ledger.days.member/)
  const declared = await check({
    ledger: `CREATE VIEW ledger.each AS SELECT l.member, sum(l.amount)::bigint AS amount FROM ledger.line l GROUP BY l.member;
COMMENT ON COLUMN ledger.each.member IS 'personal: a member''s own statement, which the port filters by reader';${as('ledger.each', 'shared by member')}`,
  })
  assert.equal(declared, '')
})

test('every view declares its audience, naming only columns it shows', async () => {
  const bare = await check({ claim: 'CREATE VIEW claim.claims AS SELECT c.id, c.circle FROM claim.claim c;' })
  assert.match(bare, /claim.claims declares no audience/)
  const said = await check({ claim: "CREATE VIEW claim.claims AS SELECT c.id, c.circle FROM claim.claim c;\nCOMMENT ON VIEW claim.claims IS 'every member reads it';" })
  assert.match(said, /claim.claims declares no audience/, 'a comment that is no audience declares none')
  const absent = await check({ claim: 'CREATE VIEW claim.claims AS SELECT c.id, c.circle FROM claim.claim c;' + as('claim.claims', 'scoped by owner') })
  assert.match(absent, /claim.claims names owner in its audience, which it does not show/)
})

test('a scoped view shows one row per record with its owning circle, and names whose a row is', async () => {
  const rows = await check({ claim: 'CREATE VIEW claim.claims AS SELECT c.id, c.amount, c.circle, c.member FROM claim.claim c;' + as('claim.claims', 'scoped by circle and member') })
  assert.equal(rows, '')
  const through = await check({ claim: 'CREATE VIEW claim.each AS SELECT r.id, r.circle FROM claim.rows r;' + as('claim.each', 'scoped by circle') })
  assert.equal(through, '', 'a circle shown through a view is still the record\'s')
  const unnamed = await check({ claim: 'CREATE VIEW claim.claims AS SELECT c.id, c.circle, c.member FROM claim.claim c;' + as('claim.claims', 'scoped by circle') })
  assert.match(unnamed, /claim.claims.member says whose a row is: name it, 'audience: scoped by circle and member'/)
  const stranger = await check({ claim: 'CREATE VIEW claim.claims AS SELECT c.id, c.circle, c.kind FROM claim.claim c;' + as('claim.claims', 'scoped by circle and kind') })
  assert.match(stranger, /claim.claims.kind does not say whose a row is/)
  const uncircled = await check({ claim: 'CREATE VIEW claim.claims AS SELECT c.id, c.kind FROM claim.claim c;' + as('claim.claims', 'scoped by kind') })
  assert.match(uncircled, /claim.claims.kind is no record's owning circle/)
  const summed = await check({ claim: 'CREATE VIEW claim.claims AS SELECT c.circle, count(*)::bigint AS claims FROM claim.claim c GROUP BY c.circle;' + as('claim.claims', 'scoped by circle') })
  assert.match(summed, /claim.claims is scoped and sums/)
})

test('a shared view sums by exactly the columns it names, and shows no row of a circle\'s records', async () => {
  const rows = await check({ claim: 'CREATE VIEW claim.claims AS SELECT c.id, c.amount FROM claim.claim c;' + as('claim.claims', 'shared by id') })
  assert.match(rows, /claim.claims shows the rows of claim.claim, which are a circle's records/)
  const viewed = await check({ claim: 'CREATE VIEW claim.claims AS SELECT r.id, r.kind FROM claim.rows r;' + as('claim.claims', 'shared by id') })
  assert.match(viewed, /claim.claims shows the rows of claim.rows, which are a circle's records/, 'a view over a circle\'s records holds them too')
  const summed = await check({ claim: 'CREATE VIEW claim.sums AS SELECT c.kind, sum(c.amount)::bigint AS amount FROM claim.claim c GROUP BY c.kind;' + as('claim.sums', 'shared by kind') })
  assert.equal(summed, '')
  const unnamed = await check({ claim: 'CREATE VIEW claim.sums AS SELECT c.kind, sum(c.amount)::bigint AS amount FROM claim.claim c GROUP BY c.kind;' + as('claim.sums') })
  assert.match(unnamed, /claim.sums groups by kind, which its audience does not name: 'audience: shared by kind'/)
  const ungrouped = await check({ claim: 'CREATE VIEW claim.sums AS SELECT c.kind, sum(c.amount)::bigint AS amount FROM claim.claim c GROUP BY c.kind;' + as('claim.sums', 'shared by kind, amount') })
  assert.match(ungrouped, /claim.sums names amount in its audience and does not group by it/)
  const finer = await check({ claim: 'CREATE VIEW claim.sums AS SELECT c.kind, sum(c.amount)::bigint AS amount FROM claim.claim c GROUP BY c.kind, c.id;' + as('claim.sums', 'shared by kind') })
  assert.match(finer, /claim.sums groups by c.id, which it does not show: a shared view groups by the columns it names, and no finer/)
  const kinds = await check({ claim: 'CREATE VIEW claim.sums AS SELECT k.kind, k.amount FROM claim.kinds k;' + as('claim.sums', 'shared by kind') })
  assert.equal(kinds, '', 'the rows of a view that sums are sums, by its grouping')
  const hidden = await check({ claim: 'CREATE VIEW claim.sums AS SELECT k.amount FROM claim.kinds k;' + as('claim.sums') })
  assert.match(hidden, /claim.sums shows claim.kinds, which sums by kind: show it and name it/)
  const nested = await check({ claim: 'CREATE VIEW claim.claims AS SELECT c.id, (SELECT count(*) FROM claim.claim x WHERE x.kind = c.kind)::bigint AS alike, c.circle FROM claim.claim c;' + as('claim.claims', 'scoped by circle') })
  assert.equal(nested, '', 'a count in a subquery is no sum of the view\'s own rows')
  const unowned = await check({ person: 'CREATE VIEW person.people AS SELECT p.address FROM person.person p;' + as('person.people', 'shared by address') })
  assert.equal(unowned, '', 'the rows of a table no circle owns are every reader\'s')
})

test('nothing grants the analytics role anything but cella migrate', async () => {
  const granted = await check({}, { person: `${migrations.person}\nGRANT SELECT ON person.person TO cella_analytics;` })
  assert.match(granted, /001.sql: grants to cella_analytics: cella migrate grants it the views each slice's analytics.sql publishes/)
})

test('no core publishes a contract but the analytics port and the circles, each in its own schema', async () => {
  const head = `CREATE VIEW analytics.head AS SELECT h.n, encode(h.hash, 'hex') AS hash FROM cella.head h;${as('analytics.head')}`
  const port = await check({}, { core: { analytics: { migration: 'CREATE SCHEMA analytics;', contract: head } } })
  assert.equal(port, '')
  const other = await check({}, { core: { vat: { migration: 'SELECT 1;', contract: 'CREATE VIEW cella.rates AS SELECT 1 AS one;' } } })
  assert.match(other, /core\/vat\/sql\/analytics.sql: an analytical contract is a feat's or a graft's, never a core's but the analytics port's and the circles'/)
  const outside = await check({}, { core: { analytics: { migration: 'CREATE SCHEMA analytics;', contract: 'CREATE VIEW cella.log_view AS SELECT n FROM cella.log;' } } })
  assert.match(outside, /log_view: a core library publishes only in its own schema, analytics/)
  const circles = await check({}, { core: { circle: { migration: 'CREATE SCHEMA circle;\nCREATE TABLE circle.circle (id text PRIMARY KEY);', contract: 'CREATE VIEW circle.circles AS SELECT c.id FROM circle.circle c;' + as('circle.circles', 'shared by id') } } })
  assert.equal(circles, '')
  const astray = await check({}, { core: { circle: { migration: 'CREATE SCHEMA circle;', contract: 'CREATE VIEW cella.circles AS SELECT n FROM cella.log;' } } })
  assert.match(astray, /circles: a core library publishes only in its own schema, circle/)
  const reached = await check({}, { person: `${migrations.person}\nCREATE VIEW person.stamp AS SELECT n FROM analytics.head;` })
  assert.match(reached, /analytics is outside/, 'a slice reads no head')
})
