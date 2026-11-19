// The SQL check's rule on owner-rights functions: a SECURITY DEFINER
// function a slice makes that returns rows reads past every policy, so it
// is declared in its comment, shared or keyed, and keeps what it
// declares: a shared one sums, or filters its rows by its reader's test;
// a keyed one matches its rows by its argument's digest. A definer
// function that returns a scalar, and an invoker one, take no declaration.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkSql, definers } from '../sql-check.mjs'

const table = `CREATE SCHEMA ledger;
CREATE TABLE ledger.line (circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle, member text, account text, amount bigint, digest bytea);
DROP POLICY circle ON ledger.line;
CREATE POLICY reads ON ledger.line FOR SELECT TO cella_app USING ((SELECT cella.sees('ledger')) OR circle = ANY ((SELECT cella.circles('ledger'))::text[]) OR member = cella.reader());
`

// The check's errors and the definer rule's, over one feat's migration.
async function check(sql) {
  const repo = mkdtempSync(join(tmpdir(), 'cella-definers-'))
  try {
    const dir = join(repo, 'apps/org/feats/ledger/core/sql')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(repo, 'apps/org/feats/ledger/feat.toml'), 'name = "ledger"\n')
    writeFileSync(join(repo, 'apps/org/feat.toml'), 'name = "org"\n')
    writeFileSync(join(dir, '001.sql'), table + sql)
    const found = { powers: [], guards: [], cites: [], stances: [], personal: [], impersonal: [], columns: [], foreign: [] }
    const errors = await checkSql(repo, ['apps/org'], new Set(['cella', 'ledger', 'circle']), found)
    return [...errors, ...definers(found)].join('\n')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

const fn = (head, body, security = 'SECURITY DEFINER') =>
  `CREATE FUNCTION ledger.${head} LANGUAGE sql STABLE ${security} SET search_path = pg_catalog, pg_temp BEGIN ATOMIC ${body}; END;\n`

test('a definer function returning rows is refused unless declared, however it returns them', async () => {
  const lines = 'SELECT l.member, l.amount FROM ledger.line l'
  for (const head of ['lines() RETURNS TABLE (member text, amount bigint)', 'lines(OUT member text, OUT amount bigint)', 'lines() RETURNS SETOF ledger.line']) {
    assert.match(await check(fn(head, head.includes('SETOF') ? 'SELECT * FROM ledger.line' : lines)), /ledger.lines runs as its owner and returns rows, past every policy/, head)
  }
  const altered = `CREATE FUNCTION ledger.lines() RETURNS TABLE (member text) LANGUAGE sql STABLE BEGIN ATOMIC SELECT l.member FROM ledger.line l; END;
ALTER FUNCTION ledger.lines() SECURITY DEFINER SET search_path = pg_catalog, pg_temp;`
  assert.match(await check(altered), /ledger.lines runs as its owner and returns rows/)
})

test('a definer function returning a scalar, or an invoker one returning rows, takes no declaration', async () => {
  assert.equal(await check(fn('holds(who text) RETURNS boolean', 'SELECT EXISTS (SELECT FROM ledger.line l WHERE l.member = who AND who = cella.reader())')), '')
  assert.equal(await check(fn('lines() RETURNS TABLE (member text)', 'SELECT l.member FROM ledger.line l', 'SECURITY INVOKER')), '')
  const back = `${fn('lines() RETURNS TABLE (member text)', 'SELECT l.member FROM ledger.line l')}ALTER FUNCTION ledger.lines() SECURITY INVOKER;`
  assert.equal(await check(back), '')
})

test('a shared function that sums passes; one that shows whose a row is, outside a sum, does not', async () => {
  const sums = `${fn('totals(since date) RETURNS TABLE (account text, total bigint, members bigint)', 'SELECT l.account, sum(l.amount)::bigint, (SELECT count(DISTINCT m.member) FROM ledger.line m) FROM ledger.line l GROUP BY l.account')}
COMMENT ON FUNCTION ledger.totals(date) IS 'audience: shared by account: the coop''s totals by account';`
  assert.equal(await check(sums), '')
  const whose = `${fn('totals() RETURNS TABLE (member text, total bigint)', 'SELECT l.member, sum(l.amount)::bigint FROM ledger.line l GROUP BY l.member')}
COMMENT ON FUNCTION ledger.totals() IS 'audience: shared by member: each member''s total';`
  assert.match(await check(whose), /ledger.totals is declared shared, but shows ledger.line.member, which says whose a row is/)
  const unnamed = `${fn('totals() RETURNS TABLE (account text, total bigint)', 'SELECT l.account, sum(l.amount)::bigint FROM ledger.line l GROUP BY l.account')}
COMMENT ON FUNCTION ledger.totals() IS 'audience: shared by kind: by kind';`
  assert.match(await check(unnamed), /ledger.totals is declared shared by kind, which it neither returns nor takes/)
  const bare = `${fn('totals() RETURNS TABLE (account text, total bigint)', 'SELECT l.account, sum(l.amount)::bigint FROM ledger.line l GROUP BY l.account')}
COMMENT ON FUNCTION ledger.totals() IS 'audience: shared by account';`
  assert.match(await check(bare), /ledger.totals runs as its owner and returns rows/, 'a declaration without its why is none')
})

test('a shared function that filters its rows by its reader\'s test passes, but not by cella.sees', async () => {
  const filtered = (test) => `${fn('lines(ref text) RETURNS TABLE (member text, amount bigint)', `SELECT l.member, l.amount FROM ledger.line l WHERE l.account = ref AND (${test})`)}
COMMENT ON FUNCTION ledger.lines(text) IS 'audience: shared: a share that needs the whole to divide';`
  assert.equal(await check(filtered(`(SELECT circle.whole()) OR l.circle = ANY ((SELECT cella.circles('ledger'))::text[]) OR l.member = cella.reader()`)), '')
  assert.match(await check(filtered(`(SELECT cella.sees('ledger')) OR l.member = cella.reader()`)), /ledger.lines is declared shared, but shows ledger.line.member/)
  assert.match(await check(filtered(`EXISTS (SELECT FROM ledger.line m WHERE m.account = l.account)`)), /ledger.lines is declared shared, but shows ledger.line.member/)
  assert.match(await check(filtered(`l.member = cella.reader() OR l.amount > 0`)), /ledger.lines is declared shared, but shows ledger.line.member/)
})

test('a keyed function matches its rows by its argument\'s digest', async () => {
  const keyed = (where, by = 'secret') => `${fn('found(secret bytea) RETURNS TABLE (member text)', `SELECT l.member FROM ledger.line l WHERE ${where}`)}
COMMENT ON FUNCTION ledger.found(bytea) IS 'audience: keyed by ${by}: for whoever holds the secret';`
  assert.equal(await check(keyed('l.digest = sha256(found.secret)')), '')
  assert.equal(await check(keyed('sha256(secret) = l.digest')), '')
  assert.match(await check(keyed('l.digest = found.secret OR true')), /ledger.found is declared keyed by secret, but compares no column of its rows with its digest/)
  // A digest compared with itself, an expression or another argument
  // matches no row by its own, and returns them all.
  for (const where of ['sha256(found.secret) = sha256(found.secret)', 'sha256(secret) = sha256(secret)', "sha256(found.secret) = '\\x00'::bytea", 'sha256(found.secret) = found.other', 'sha256(found.secret) = other']) {
    const two = `${fn('found(secret bytea, other bytea) RETURNS TABLE (member text)', `SELECT l.member FROM ledger.line l WHERE ${where}`)}
COMMENT ON FUNCTION ledger.found(bytea, bytea) IS 'audience: keyed by secret: for whoever holds the secret';`
    assert.match(await check(two), /ledger.found is declared keyed by secret, but compares no column of its rows with its digest/, where)
  }
  assert.match(await check(keyed('l.digest = sha256(found.secret)', 'key')), /ledger.found is declared keyed by key, which is not one argument it takes/)
})

test('a shared function shows through its star, its WITH and the subqueries in its FROM', async () => {
  const shared = (body) => `${fn('lines() RETURNS SETOF ledger.line', body)}
COMMENT ON FUNCTION ledger.lines() IS 'audience: shared: every line';`
  for (const body of [
    'SELECT * FROM ledger.line',
    'SELECT l.* FROM ledger.line l',
    'WITH w AS (SELECT l.member AS who FROM ledger.line l) SELECT w.who FROM w',
    'WITH w AS (SELECT l.member FROM ledger.line l) SELECT * FROM w',
    'WITH w (who) AS (SELECT l.member FROM ledger.line l), v AS (SELECT who FROM w) SELECT v.who FROM v',
    'SELECT x.who FROM (SELECT l.member AS who FROM ledger.line l) x',
    'SELECT x.* FROM (SELECT l.member, sum(l.amount) FROM ledger.line l GROUP BY l.member) x',
  ]) {
    assert.match(await check(shared(body)), /ledger.lines is declared shared, but shows ledger.line.member, which says whose a row is/, body)
  }
  const sums = `${fn('totals() RETURNS TABLE (account text, total bigint)', 'WITH w AS (SELECT l.account, sum(l.amount)::bigint AS total FROM ledger.line l GROUP BY l.account) SELECT * FROM w')}
COMMENT ON FUNCTION ledger.totals() IS 'audience: shared by account: the coop''s totals by account';`
  assert.equal(await check(sums), '')
})

test('a declared function the check cannot read is refused', async () => {
  const pl = `CREATE FUNCTION ledger.lines() RETURNS TABLE (member text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$ BEGIN RETURN QUERY SELECT l.member FROM ledger.line l; END $$;
COMMENT ON FUNCTION ledger.lines() IS 'audience: shared: every member';`
  assert.match(await check(pl), /ledger.lines is declared shared, but returns no query the check reads: write it LANGUAGE sql/)
})
