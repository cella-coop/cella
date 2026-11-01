// The SQL check and the policy register: org's core library `policy`
// makes its own schema; a slice reads its policies and values, and a
// guard that reads a policy's wording, policy.wording, is refused, since a
// guard reads a policy's values from its own columns and never parses the
// sentence.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkSql } from '../sql-check.mjs'

const register = `CREATE SCHEMA policy;
CREATE TABLE policy.policy (id text PRIMARY KEY, circle text, kind text);
CREATE TABLE policy.wording (policy text PRIMARY KEY REFERENCES policy.policy, legal text);
CREATE TABLE policy.value (policy text REFERENCES policy.policy, name text, value jsonb);`

// The register in org's core, and one feat, `pricing`, with a guard.
async function check(guard) {
  const repo = mkdtempSync(join(tmpdir(), 'cella-policy-'))
  try {
    const core = join(repo, 'apps/org/core/policy/sql')
    mkdirSync(core, { recursive: true })
    writeFileSync(join(core, '001.sql'), register)
    const feat = join(repo, 'apps/org/feats/pricing/core/sql')
    mkdirSync(feat, { recursive: true })
    writeFileSync(join(repo, 'apps/org/feats/pricing/feat.toml'), 'name = "pricing"\n')
    writeFileSync(
      join(feat, '001.sql'),
      `CREATE SCHEMA pricing;
CREATE TABLE pricing.rate (client text PRIMARY KEY, discount numeric);
${guard}`,
    )
    writeFileSync(join(repo, 'apps/org/feat.toml'), 'name = "org"\n')
    return (await checkSql(repo, ['apps/org'], new Set(['cella', 'policy', 'pricing']))).join('\n')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

test('the register\'s core makes its own schema, and a guard reading its own columns and which policies are in force passes', async () => {
  const errors = await check(`CREATE TABLE pricing.terms (policy text PRIMARY KEY, solidarity numeric NOT NULL);
CREATE FUNCTION pricing.discounted(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE WHEN r.discount > t.solidarity THEN 'beyond the solidarity rate' END
  FROM pricing.rate r, pricing.terms t JOIN policy.policy p ON p.id = t.policy
  WHERE r.client = payload ->> 'client' AND p.kind = 'rule';
END;`)
  assert.equal(errors, '')
})

test('a guard that reads a policy\'s wording is refused', async () => {
  const errors = await check(`CREATE FUNCTION pricing.discounted(payload jsonb) RETURNS text
LANGUAGE sql STABLE
BEGIN ATOMIC
  SELECT CASE WHEN w.legal ~ 'solidarity rate, 20 %' AND r.discount > 20 THEN 'beyond the solidarity rate' END
  FROM pricing.rate r, policy.wording w WHERE r.client = payload ->> 'client';
END;`)
  assert.match(errors, /reads policy\.wording: a guard reads a policy's values from its own columns, never its wording/)
})

test('a slice makes nothing in the register\'s schema', async () => {
  const errors = await check('CREATE TABLE policy.extra (x text);')
  assert.match(errors, /creates policy\.extra: feat pricing creates and grants only in its own schema, pricing/)
})
