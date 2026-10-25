// A worker's employment records, on a database holding the app's core,
// the file and worker feats and this graft: a record filed about a
// worker, of class payroll, opening to them and to who filed it; never
// about someone the co-op does not employ. Who may file one is the
// circle-membership graft's, by the hire-worker power, outside this slice.
// Run by `cella test slice employment-file`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Deps } from '@cella/org-db'
import { fixture, signer } from '@cella/org-sign'
import { attach, records } from '../src/api/index.ts'

const db = new pg.Client()
const scope = 'test.example'
const camille = 'camille@lanterne.example'
const ines = 'ines@lanterne.example'
const as = (who: string): Deps => ({ db, actor: who, sign: signer(scope, who, fixture(who, 'laptop')) })
const contract = (subject: string) => ({ class: 'payroll' as const, subject, name: 'contrat.pdf', type: 'application/pdf', bytes: new TextEncoder().encode('contrat') })
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? (out.reason ?? '') : `not refused: ${out.state}`)

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(`SET cella.scope = '${scope}'`)
  await db.query(`CREATE FUNCTION public.anyone(actor text, device bytea) RETURNS text LANGUAGE sql STABLE RETURN NULL`)
  // Any device signs for anyone, in place of the person feat's keyring:
  // this test enrols no devices.
  await db.query('DELETE FROM cella.keyring')
  await db.query(`INSERT INTO cella.keyring (fn, owner) VALUES ('public.anyone(text, bytea)', 'test')`)
  await db.query(
    `WITH person AS (INSERT INTO person.person (address, name) VALUES ($1, 'Inès Haddad') ON CONFLICT DO NOTHING) INSERT INTO employment.worker (address, name, job, contract, start, minutes, hired) VALUES ($1, 'Inès Haddad', 'junior developer', 'permanent', '2025-09-01', 2100, '2025-09-01')`,
    [ines],
  )
})

after(async () => {
  await db.end()
})

test('a record filed about a worker opens to them and to who filed it', async () => {
  const out = await attach({ worker: ines, file: contract(ines) }, as(camille))
  assert.equal(out.state, 'settled', reason(out))
  const [held] = await records(db, ines)
  assert.deepEqual([held.name, held.uploader], ['contrat.pdf', camille])
  const { rows } = await db.query(`SELECT class, subject, file.opens(id, $2) AS her, file.opens(id, $3) AS other FROM file.file WHERE id = $1`, [held.id, ines, 'hugo@lanterne.example'])
  assert.deepEqual(rows[0], { class: 'payroll', subject: ines, her: true, other: false })
})

test('never about someone the co-op does not employ', async () => {
  assert.match(reason(await attach({ worker: 'nobody@lanterne.example', file: contract('nobody@lanterne.example') }, as(camille))), /no worker nobody@lanterne.example/)
})
