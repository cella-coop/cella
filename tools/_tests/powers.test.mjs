// The feat check's power rules: what an op's label in ops.ts says it needs
// is what its feat registers in cella.power, and only the op's own feat
// registers it.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { agree } from '../powers.mjs'
import { checkSql } from '../sql-check.mjs'

const file = 'apps/org/feats/invoice/core/ts/src/models/ops.ts'
const op = (o, power = null, amount = null) => ({ op: o, power, amount, file })
const row = (o, power, amount = null, owner = 'invoice') => ({ op: o, power, amount, owner })

test('ops.ts and cella.power agree', () => {
  assert.deepEqual(agree([op('invoice:invoice:issue', 'issue-invoice'), op('invoice:invoice:send')], [row('invoice:invoice:issue', 'issue-invoice')]), [])
})

test('a power in ops.ts that no SQL registers is refused', () => {
  const [e] = agree([op('invoice:invoice:issue', 'issue-invoice')], [])
  assert.match(e, /invoice:invoice:issue needs issue-invoice, which no SQL registers in cella.power/)
})

test('a power or amount that differs is refused', () => {
  assert.match(agree([op('invoice:invoice:issue', 'issue-invoice')], [row('invoice:invoice:issue', 'pay-supplier')])[0], /but cella.power registers pay-supplier/)
  assert.match(
    agree([op('transaction:transaction:post', 'pay-supplier', 'amount')], [row('transaction:transaction:post', 'pay-supplier', null, 'transaction')])[0],
    /needs pay-supplier up to its amount, but cella.power registers pay-supplier$/,
  )
})

test('a registered power that ops.ts does not name, or registered twice, is refused', () => {
  assert.match(agree([op('invoice:invoice:send')], [row('invoice:invoice:send', 'issue-invoice')])[0], /which its label does not name/)
  assert.match(agree([], [row('invoice:invoice:lost', 'issue-invoice')])[0], /which no ops.ts declares/)
  const twice = agree([op('invoice:invoice:issue', 'issue-invoice')], [row('invoice:invoice:issue', 'issue-invoice'), row('invoice:invoice:issue', 'issue-invoice')])
  assert.match(twice[0], /registers a power on invoice:invoice:issue twice/)
})

// A throwaway tree with one app and two feats, each with one SQL file.
async function check(sql) {
  const repo = mkdtempSync(join(tmpdir(), 'cella-sql-'))
  try {
    for (const feat of ['invoice', 'member']) {
      mkdirSync(join(repo, 'apps/org/feats', feat, 'core/sql'), { recursive: true })
      writeFileSync(join(repo, 'apps/org/feats', feat, 'feat.toml'), `name = "${feat}"\n`)
    }
    writeFileSync(join(repo, 'apps/org/feat.toml'), 'name = "org"\n')
    for (const [feat, text] of Object.entries(sql)) {
      writeFileSync(join(repo, 'apps/org/feats', feat, 'core/sql/001.sql'), text)
    }
    const powers = []
    const errors = await checkSql(repo, ['apps/org'], new Set(['cella', 'invoice', 'member']), powers)
    return { errors, powers }
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
}

test('a feat registers powers only on its own ops, as literal rows, under its own name', async () => {
  const own = await check({ invoice: `INSERT INTO cella.power (op, power, amount, owner) VALUES ('invoice:invoice:issue', 'issue-invoice', NULL, 'invoice');` })
  assert.deepEqual(own, { errors: [], powers: [row('invoice:invoice:issue', 'issue-invoice')] })

  const other = await check({ member: `INSERT INTO cella.power (op, power, amount, owner) VALUES ('invoice:invoice:issue', 'issue-invoice', NULL, 'member');` })
  assert.match(other.errors.join('\n'), /registers a power on invoice:invoice:issue, an op of invoice: only invoice names what its ops need/)

  const named = await check({ invoice: `INSERT INTO cella.power (op, power, amount, owner) VALUES ('invoice:invoice:issue', 'issue-invoice', NULL, 'member');` })
  assert.match(named.errors.join('\n'), /registers a power as member, not as itself, invoice/)

  const queried = await check({ invoice: `INSERT INTO cella.power (op, power, amount, owner) SELECT 'invoice:invoice:issue', 'issue-invoice', NULL, 'invoice';` })
  assert.match(queried.errors.join('\n'), /a power is a literal row/)
})

test('only a feat registers the keyring, and nothing else in cella is written', async () => {
  const keyring = await check({ member: `INSERT INTO cella.keyring (fn, owner) VALUES ('member.verifies(text, bytea)', 'member');` })
  assert.deepEqual(keyring.errors, [])
  const log = await check({ member: `INSERT INTO cella.receipt (n) VALUES (1);` })
  assert.match(log.errors.join('\n'), /writes cella.receipt: a feat writes cella.\* only to register its rules, its powers or the keyring/)
})
