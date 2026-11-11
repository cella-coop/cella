// The SQL check holds a core library's SQL to the rules a slice's keeps:
// it creates and grants only in its own schema, named for it, never
// reads the clock in a guard and never a policy's wording, and only
// core's circles read the role a session runs as. The notary's
// SQL, which makes cella.* and the vault and stamps what it notarises,
// is the one exemption. A core graft, joining core's feats, keeps the
// same in its own schema, and puts the core feats it joins under the
// circles' row-level policies.

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
// `ledger`, its package depending on the libraries named; given
// `graft`, the SQL of core's graft joining the circles to the register,
// or to another core feat named by `joins`; given `circle`, the circles'
// SQL; and given `slice`, a feat's.
async function check(sql, { notary = '', uses = [], graft = '', joins = 'circle-policy', circle = '', slice = '' } = {}) {
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
    if (graft || circle) {
      write('apps/org/core/circle/sql', '001.sql', `CREATE SCHEMA circle;\nCREATE FUNCTION circle.inside() RETURNS boolean LANGUAGE sql STABLE RETURN true;\n${circle}`)
    }
    if (slice) {
      write('apps/org/feats/pricing', 'feat.toml', 'name = "pricing"\n')
      write('apps/org/feats/pricing/core/sql', '001.sql', `CREATE SCHEMA pricing;\n${slice}`)
    }
    if (graft) {
      write(`apps/org/core/grafts/${joins}/sql`, '001.sql', `CREATE SCHEMA ${joins.replace('-', '_')};\n${graft}`)
    }
    return (await checkSql(repo, ['apps/org'], new Set(['cella', 'policy', 'ledger', 'circle', 'circle_policy', 'circle_ledger', 'pricing']))).join('\n')
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

test('a core feat acting in another core feat is refused', async () => {
  const errors = await check('ALTER TABLE policy.policy ENABLE ROW LEVEL SECURITY;')
  assert.match(errors, /reads policy\.policy: core ledger names no other core feat's schema, policy; a core graft joins core feats/)
  assert.match(errors, /alters policy\.policy: core ledger creates and grants only in its own schema, ledger/)
})

test('a core library reading the clock in a guard is refused', async () => {
  const guard = (expr) => `CREATE FUNCTION ledger.late(day date) RETURNS text
LANGUAGE sql STABLE RETURN CASE WHEN day < ${expr} THEN 'past its day' END;`
  assert.match(await check(guard('now()::date')), /calls now\(\): guards read cella\.verdict_date\(\), never the clock/)
  assert.match(await check(guard('current_date')), /reads current_date: guards read cella\.verdict_date\(\), never the clock/)
})

// A function that lets a superuser's session past row-level security,
// as circle.whole does, reading the role the session runs as.
const whole = (schema, role = 'session_user') => `CREATE FUNCTION ${schema}.whole() RETURNS boolean
LANGUAGE sql STABLE RETURN EXISTS (SELECT FROM pg_catalog.pg_roles r WHERE r.rolsuper AND r.rolname = ${role});`

test('core\'s circles read the role a session runs as', async () => {
  assert.equal(await check('', { circle: whole('circle') }), '')
  assert.equal(await check('', { circle: whole('circle', 'current_user') }), '')
})

test('a core library other than the circles reading the role is refused', async () => {
  assert.match(await check(whole('ledger')), /reads session_user: only core's circles read the role; a slice reads whom it reads for by cella\.reader\(\)/)
  assert.match(await check(whole('ledger', 'current_user')), /reads current_user: only core's circles read the role/)
})

test('a core graft reading the role is refused', async () => {
  assert.match(await check('', { graft: whole('circle_policy') }), /reads session_user: only core's circles read the role/)
})

test('a slice reading the role is refused', async () => {
  assert.match(await check('', { slice: whole('pricing', 'current_role') }), /reads current_role: only core's circles read the role; a slice reads whom it reads for by cella\.reader\(\)/)
})

test('core\'s circles reading the clock in a guard are refused, as any slice is', async () => {
  const guard = (expr) => `CREATE FUNCTION circle.lapsed(day date) RETURNS text
LANGUAGE sql STABLE RETURN CASE WHEN day < ${expr} THEN 'the tenure has lapsed' END;`
  assert.match(await check('', { circle: guard('now()::date') }), /calls now\(\): guards read cella\.verdict_date\(\), never the clock/)
  const errors = await check('', { circle: guard('current_date') })
  assert.match(errors, /reads current_date: guards read cella\.verdict_date\(\), never the clock/)
  assert.doesNotMatch(errors, /only core's circles read the role/)
})

test('a core library reading a policy\'s wording is refused', async () => {
  const errors = await check(`CREATE FUNCTION ledger.solidarity(ref text) RETURNS boolean
LANGUAGE sql STABLE RETURN EXISTS (SELECT FROM policy.wording w WHERE w.policy = ref AND w.legal ~ 'solidarity');`)
  assert.match(errors, /reads policy\.wording: a guard reads a policy's values from its own columns, never its wording/)
})

test('a core feat reads no other core feat\'s schema, its package depending on it or not: a core graft joins them', async () => {
  const errors = await check(`CREATE FUNCTION ledger.kind(ref text) RETURNS text
LANGUAGE sql STABLE RETURN (SELECT p.kind FROM policy.policy p WHERE p.id = ref);`, { uses: ['policy'] })
  assert.match(errors, /reads policy\.policy: core ledger names no other core feat's schema, policy; a core graft joins core feats/)
})

test('a core feat acts in no other core feat\'s schema, its package depending on it or not', async () => {
  const errors = await check(`ALTER TABLE policy.wording ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION policy.says(ref text) RETURNS text
LANGUAGE sql STABLE RETURN (SELECT p.kind FROM policy.policy p WHERE p.id = ref);`, { uses: ['policy'] })
  assert.match(errors, /alters policy\.wording: core ledger creates and grants only in its own schema, ledger/)
  assert.match(errors, /creates policy\.says: core ledger creates and grants only in its own schema, ledger/)
})

test('a core graft makes its functions in its own schema, reads the core feats it joins, and puts the register under the circles\' row-level policies', async () => {
  const errors = await check('', {
    graft: `ALTER TABLE policy.policy ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY structure ON policy.policy TO cella_app USING ((SELECT circle.inside()));
ALTER POLICY structure ON policy.policy USING ((SELECT circle.inside()) OR true);
CREATE FUNCTION circle_policy.kind(ref text) RETURNS text
LANGUAGE sql STABLE RETURN (SELECT p.kind FROM policy.policy p WHERE p.id = ref AND (SELECT circle.inside()));
GRANT USAGE ON SCHEMA circle_policy TO cella_app;`,
  })
  assert.equal(errors, '')
})

test('a core graft creating, altering or granting anything else in a core feat it joins is refused by name', async () => {
  const errors = await check('', {
    graft: `CREATE FUNCTION policy.says(ref text) RETURNS text LANGUAGE sql STABLE RETURN ref;
ALTER TABLE policy.policy ADD COLUMN note text;
ALTER TABLE policy.policy DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON policy.wording TO cella_app;`,
  })
  assert.match(errors, /creates policy\.says: core circle-policy creates and grants only in its own schema, circle_policy/)
  assert.match(errors, /alters policy\.policy: core circle-policy creates and grants only in its own schema, circle_policy/)
  assert.match(errors, /grants on policy: core circle-policy creates and grants only in its own schema, circle_policy/)
})

test('a core graft binds the owning circle of a core feat it joins, and alters nothing else of it', async () => {
  const bound = await check('CREATE TABLE ledger.line (circle text NOT NULL, id text PRIMARY KEY);', {
    joins: 'circle-ledger',
    graft: `ALTER TABLE ledger.line ALTER COLUMN circle SET DEFAULT circle.assembly(), ADD FOREIGN KEY (circle) REFERENCES circle.circle;
ALTER TABLE ledger.line ENABLE ROW LEVEL SECURITY, FORCE ROW LEVEL SECURITY;
CREATE POLICY circle ON ledger.line TO cella_app USING ((SELECT circle.inside()));`,
  })
  assert.equal(bound, '')
  const astray = await check('CREATE TABLE ledger.line (circle text NOT NULL, id text PRIMARY KEY, day date);', {
    joins: 'circle-ledger',
    graft: `ALTER TABLE ledger.line ALTER COLUMN day SET DEFAULT '2026-01-01', ADD FOREIGN KEY (id) REFERENCES circle.circle;
ALTER TABLE ledger.line ALTER COLUMN circle SET DEFAULT circle.inside()::text;`,
  })
  assert.equal(astray.match(/alters ledger\.line: core circle-ledger creates and grants only in its own schema, circle_ledger/g)?.length, 2)
  const unjoined = await check('CREATE TABLE ledger.line (circle text NOT NULL);', {
    graft: 'ALTER TABLE ledger.line ADD FOREIGN KEY (circle) REFERENCES circle.circle;',
  })
  assert.match(unjoined, /core circle-policy joins no ledger/)
})

test('a core graft reads no core feat it does not join, nor a policy\'s wording', async () => {
  const errors = await check('', {
    graft: `CREATE FUNCTION circle_policy.said(ref text) RETURNS text
LANGUAGE sql STABLE RETURN (SELECT w.legal FROM policy.wording w WHERE w.policy = ref);
CREATE FUNCTION circle_policy.booked() RETURNS boolean LANGUAGE sql STABLE RETURN ledger.booked();`,
  })
  assert.match(errors, /reads policy\.wording: a guard reads a policy's values from its own columns, never its wording/)
  assert.match(errors, /names ledger\.booked: core circle-policy joins no ledger; a core graft names only the core feats it joins/)
})

test('the register makes and reads its own wording', async () => {
  assert.equal(await check(''), '')
})

test('the notary\'s SQL creates in cella.* and the vault and reads the clock and the role', async () => {
  const errors = await check('', {
    notary: `CREATE FUNCTION cella.line_amount(quantity numeric, price bigint) RETURNS bigint
LANGUAGE sql IMMUTABLE RETURN round(quantity * price)::bigint;
GRANT EXECUTE ON FUNCTION cella.line_amount(numeric, bigint) TO cella_app;
CREATE TABLE vault.swept (day date DEFAULT current_date, at timestamptz DEFAULT now(), by text DEFAULT session_user);`,
  })
  assert.equal(errors, '')
})
