// The SQL check's reading rule: a slice never takes a table out from
// under row-level security, nor unforces it; a table that drops core's
// policy `circle` reads by a policy of its own; and every policy a slice
// makes that reads is of a known pattern, the owning circle's, the
// reader's own row, a graft's reach or a row of its own table, or opens
// its rows to every reader and is commented 'shared: why'.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkSql, unread } from '../sql-check.mjs'

const table = `CREATE SCHEMA ledger;
CREATE TABLE ledger.line (circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle, member text, account text, amount bigint);
CREATE TABLE ledger.entry (circle text NOT NULL DEFAULT circle.assembly() REFERENCES circle.circle, id text PRIMARY KEY);
CREATE TABLE ledger.kind (id text PRIMARY KEY);
COMMENT ON TABLE ledger.kind IS 'registry: the kinds of line';
`

// The check's errors and the reading rule's, over one feat's migration.
async function check(sql) {
  const repo = mkdtempSync(join(tmpdir(), 'cella-reads-'))
  try {
    const dir = join(repo, 'apps/org/feats/ledger/core/sql')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(repo, 'apps/org/feats/ledger/feat.toml'), 'name = "ledger"\n')
    writeFileSync(join(repo, 'apps/org/feat.toml'), 'name = "org"\n')
    writeFileSync(join(dir, '001.sql'), table + sql)
    const found = { powers: [], guards: [], cites: [], stances: [], personal: [], impersonal: [], columns: [], foreign: [] }
    const errors = await checkSql(repo, ['apps/org'], new Set(['cella', 'ledger', 'circle']), found)
    return [...errors, ...unread(found)].join('\n')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

test('tables under core\'s policies, and policies of the known patterns, pass', async () => {
  const errors = await check(`DROP POLICY circle ON ledger.line;
CREATE POLICY reads ON ledger.line FOR SELECT TO cella_app USING ((SELECT cella.sees('ledger')) OR circle = ANY ((SELECT cella.circles('ledger'))::text[]) OR member = cella.reader() OR cella.reaches('ledger', account));
CREATE POLICY guards ON ledger.line FOR SELECT TO cella_guards USING (true);
DROP POLICY circle ON ledger.entry;
CREATE POLICY reads ON ledger.entry FOR SELECT TO cella_app USING ((member IS NULL AND circle = ANY ((SELECT circle.reads('{ledger}'))::text[])) OR cella.reader() IN (member, account) OR EXISTS (SELECT FROM ledger.line l WHERE l.account = entry.id AND l.member = cella.reader()));
CREATE POLICY writes ON ledger.entry FOR INSERT TO cella_app WITH CHECK (true);
CREATE POLICY own ON ledger.kind FOR SELECT TO cella_app USING ((SELECT cella.writing()) OR member = cella.reader());`)
  assert.equal(errors, '')
})

test('a slice never disables nor unforces row-level security on its table', async () => {
  assert.match(await check('ALTER TABLE ledger.line DISABLE ROW LEVEL SECURITY;'), /disables row-level security on ledger.line/)
  assert.match(await check('ALTER TABLE ledger.line NO FORCE ROW LEVEL SECURITY;'), /unforces row-level security on ledger.line/)
})

test('a table that drops core\'s policy reads by one of its own', async () => {
  const errors = await check(`DROP POLICY circle ON ledger.line;
CREATE POLICY writes ON ledger.line FOR INSERT TO cella_app WITH CHECK (true);
CREATE POLICY guards ON ledger.line FOR SELECT TO cella_guards USING (true);`)
  assert.match(errors, /ledger.line drops core's policy circle and has no read policy of its own/)
})

test('a policy that reads by no known pattern is refused, unless it is declared shared', async () => {
  const open = await check('CREATE POLICY open ON ledger.line FOR SELECT TO cella_app USING (true);')
  assert.match(open, /the policy open on ledger.line reads by no known pattern/)
  const shared = await check(`CREATE POLICY open ON ledger.line FOR SELECT TO cella_app USING (true);
COMMENT ON POLICY open ON ledger.line IS 'shared: every reader reads the lines';`)
  assert.equal(shared, '')
  const anyone = await check('CREATE POLICY open ON ledger.line USING (amount > 0);')
  assert.match(anyone, /the policy open on ledger.line reads by no known pattern/)
  // Another feat's readers, a widening OR and a definer function's rows.
  const other = await check(`CREATE POLICY other ON ledger.line FOR SELECT TO cella_app USING (circle = ANY ((SELECT cella.circles('payslip'))::text[]));`)
  assert.match(other, /the policy other on ledger.line reads by no known pattern/)
  const wide = await check(`CREATE POLICY wide ON ledger.line FOR ALL TO cella_app USING (member = cella.reader() OR amount > 0);`)
  assert.match(wide, /the policy wide on ledger.line reads by no known pattern/)
  const through = await check(`CREATE POLICY through ON ledger.entry FOR SELECT TO cella_app USING (EXISTS (SELECT FROM ledger.lines() l WHERE l.account = entry.id));`)
  assert.match(through, /the policy through on ledger.entry reads by no known pattern/)
  const elsewhere = await check(`CREATE POLICY elsewhere ON ledger.entry FOR SELECT TO cella_app USING (EXISTS (SELECT FROM payslip.payslip p WHERE p.member = cella.reader()));`)
  assert.match(elsewhere, /the policy elsewhere on ledger.entry reads by no known pattern/)
})

test('a restrictive policy, or one that does not read, takes no pattern', async () => {
  const errors = await check(`CREATE POLICY narrow ON ledger.line AS RESTRICTIVE FOR SELECT TO cella_app USING (amount > 0);
CREATE POLICY changes ON ledger.line FOR UPDATE TO cella_app USING (true);`)
  assert.equal(errors, '')
})
