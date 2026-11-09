// The SQL check holds a core library's SQL to the rules a slice's keeps:
// it creates and grants only in its own schema, named for it, never
// reads the clock in a guard and never a policy's wording. The notary's
// SQL, which makes cella.* and the vault and stamps what it notarises,
// is the one exemption.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkSql } from '../sql-check.mjs'

const register = `CREATE SCHEMA policy;
CREATE TABLE policy.policy (id text PRIMARY KEY, kind text);
CREATE TABLE policy.wording (policy text PRIMARY KEY REFERENCES policy.policy, legal text);`

// Org's core with the register, the notary's SQL and one core library,
// `ledger`, its package depending on the libraries named.
async function check(sql, { notary = '', uses = [] } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'cella-core-'))
  try {
    const write = (dir, file, text) => {
      mkdirSync(join(repo, dir), { recursive: true })
      writeFileSync(join(repo, dir, file), text)
    }
    write('apps/org', 'feat.toml', 'name = "org"\n')
    write('apps/org/core/policy/sql', '001.sql', register)
    if (notary) {
      write('apps/org/core/notary/sql', '001.sql', notary)
    }
    write('apps/org/core/ledger/sql', '001.sql', `CREATE SCHEMA ledger;\n${sql}`)
    const dependencies = Object.fromEntries(uses.map((u) => [`@cella/org-${u}`, 'workspace:*']))
    write('apps/org/core/ledger/ts', 'package.json', JSON.stringify({ name: '@cella/org-ledger', dependencies }))
    return (await checkSql(repo, ['apps/org'], new Set(['cella', 'policy', 'ledger']))).join('\n')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

test('a core library making, granting and guarding in its own schema passes', async () => {
  const errors = await check(`CREATE TABLE ledger.line (id text PRIMARY KEY, day date);
CREATE FUNCTION ledger.late(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE WHEN l.day < cella.verdict_date() THEN 'the line is past its day' END
  FROM ledger.line l WHERE l.id = payload ->> 'line';
END;
GRANT EXECUTE ON FUNCTION ledger.late(jsonb) TO cella_app;`)
  assert.equal(errors, '')
})

test('a core library creating or granting in cella.* is refused by name', async () => {
  const errors = await check(`CREATE FUNCTION cella.line_amount(quantity numeric, price bigint) RETURNS bigint
LANGUAGE sql IMMUTABLE RETURN round(quantity * price)::bigint;
GRANT EXECUTE ON FUNCTION cella.line_amount(numeric, bigint) TO cella_app;`)
  assert.match(errors, /creates cella\.line_amount: core ledger creates and grants only in its own schema, ledger/)
  assert.match(errors, /grants on cella: core ledger creates and grants only in its own schema, ledger/)
})

test('a core library creating in a core library it does not depend on is refused', async () => {
  const errors = await check('ALTER TABLE policy.policy ENABLE ROW LEVEL SECURITY;')
  assert.match(errors, /reads policy\.policy: policy is outside/)
  assert.match(errors, /alters policy\.policy: core ledger creates and grants only in its own schema, ledger/)
})

test('a core library reading the clock in a guard is refused', async () => {
  const guard = (expr) => `CREATE FUNCTION ledger.late(day date) RETURNS text
LANGUAGE sql STABLE RETURN CASE WHEN day < ${expr} THEN 'past its day' END;`
  assert.match(await check(guard('now()::date')), /calls now\(\): guards read cella\.verdict_date\(\), never the clock/)
  assert.match(await check(guard('current_date')), /reads current_date: guards read cella\.verdict_date\(\), never the clock/)
})

test('a core library reading a policy\'s wording is refused', async () => {
  const errors = await check(`CREATE FUNCTION ledger.solidarity(ref text) RETURNS boolean
LANGUAGE sql STABLE RETURN EXISTS (SELECT FROM policy.wording w WHERE w.policy = ref AND w.legal ~ 'solidarity');`)
  assert.match(errors, /reads policy\.wording: a guard reads a policy's values from its own columns, never its wording/)
})

test('a core library acts in the schema of a core library its package depends on, until core grafts join them', async () => {
  const errors = await check(`ALTER TABLE policy.wording ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION policy.says(ref text) RETURNS text
LANGUAGE sql STABLE RETURN (SELECT w.legal FROM policy.wording w WHERE w.policy = ref);`, { uses: ['policy'] })
  assert.equal(errors, '')
})

test('the register makes and reads its own wording', async () => {
  assert.equal(await check(''), '')
})

test('the notary\'s SQL creates in cella.* and the vault and reads the clock', async () => {
  const errors = await check('', {
    notary: `CREATE FUNCTION cella.line_amount(quantity numeric, price bigint) RETURNS bigint
LANGUAGE sql IMMUTABLE RETURN round(quantity * price)::bigint;
GRANT EXECUTE ON FUNCTION cella.line_amount(numeric, bigint) TO cella_app;
CREATE TABLE vault.swept (day date DEFAULT current_date, at timestamptz DEFAULT now());`,
  })
  assert.equal(errors, '')
})
