// The SQL check's analytical contracts: a slice's sql/analytics.sql holds
// only views in its own schema, read as their owner; it shows a personal
// column only where it declares it, and a table under row-level security
// only as sums over everyone, or as the rows its policy opens to every
// reader; nothing else grants the analytics role anything; and no core
// publishes a contract but the analytics port, in its own schema.

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
}

async function check(contracts, extra = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'cella-contract-'))
  try {
    for (const feat of ['person', 'ledger']) {
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
    const known = new Set(['cella', 'person', 'ledger'])
    return (await checkSql(repo, ['apps/org'], known)).join('\n')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

test('a contract of plain views, its personal column declared, passes', async () => {
  const errors = await check({
    person: `CREATE VIEW person.people AS SELECT p.address, p.name, p.city FROM person.person p;
COMMENT ON COLUMN person.people.name IS 'personal: shown on statements';`,
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
COMMENT ON COLUMN person.people.name IS 'not personal: only companies here';`,
  })
  assert.equal(declared, '')
  const counted = await check({ person: 'CREATE VIEW person.named AS SELECT count(p.name)::bigint AS n FROM person.person p;' })
  assert.equal(counted, '', 'a sum over everyone shows no one\'s name')
})

test('a secured table shows only as sums, or as the rows its policy opens to everyone', async () => {
  const rows = await check({ ledger: 'CREATE VIEW ledger.lines AS SELECT l.day, l.amount FROM ledger.line l;' })
  assert.match(rows, /ledger.lines shows the rows of ledger.line, which is under row-level security/)
  const summed = await check({ ledger: 'CREATE VIEW ledger.months AS SELECT l.day, sum(l.amount)::bigint AS amount FROM ledger.line l GROUP BY l.day;' })
  assert.equal(summed, '')
  const counted = await check({ ledger: 'CREATE VIEW ledger.size AS SELECT count(*)::bigint AS lines FROM ledger.line;' })
  assert.equal(counted, '')
  const open = await check({ ledger: 'CREATE VIEW ledger.chart AS SELECT a.code, a.label FROM ledger.account a WHERE a.holder IS NULL;' })
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
COMMENT ON COLUMN ledger.each.member IS 'personal: a member''s own statement, which the port filters by reader';`,
  })
  assert.equal(declared, '')
})

test('nothing grants the analytics role anything but cella migrate', async () => {
  const granted = await check({}, { person: `${migrations.person}\nGRANT SELECT ON person.person TO cella_analytics;` })
  assert.match(granted, /001.sql: grants to cella_analytics: cella migrate grants it the views each slice's analytics.sql publishes/)
})

test('no core publishes a contract but the analytics port, in its own schema', async () => {
  const head = `CREATE VIEW analytics.head AS SELECT h.n, encode(h.hash, 'hex') AS hash FROM cella.head h;`
  const port = await check({}, { core: { analytics: { migration: 'CREATE SCHEMA analytics;', contract: head } } })
  assert.equal(port, '')
  const other = await check({}, { core: { vat: { migration: 'SELECT 1;', contract: 'CREATE VIEW cella.rates AS SELECT 1 AS one;' } } })
  assert.match(other, /core\/vat\/sql\/analytics.sql: an analytical contract is a feat's or a graft's, never a core's but the analytics port's/)
  const outside = await check({}, { core: { analytics: { migration: 'CREATE SCHEMA analytics;', contract: 'CREATE VIEW cella.log_view AS SELECT n FROM cella.log;' } } })
  assert.match(outside, /log_view: the analytics port publishes only in its own schema, analytics/)
  const reached = await check({}, { person: `${migrations.person}\nCREATE VIEW person.stamp AS SELECT n FROM analytics.head;` })
  assert.match(reached, /analytics is outside/, 'a slice reads no head')
})
