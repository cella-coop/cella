// A member's records on file, on a database holding the app's core, the
// file and member feats and this graft: a member files a record of their
// own, a file of class member-profile about them, committed to in the
// log; never someone else's, nor once they have left. Run by `cella test
// slice file-member`.

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import type { Deps } from '@cella/org-db'
import { fixture, signer } from '@cella/org-sign'
import { attach, records } from '../src/api/index.ts'

const db = new pg.Client()
const scope = 'test.example'
const camille = 'camille@lanterne.example'
const paul = 'paul@lanterne.example'
const as = (who: string): Deps => ({ db, actor: who, sign: signer(scope, who, fixture(who, 'laptop')) })
const form = (subject: string) => ({ class: 'member-profile' as const, subject, name: 'bulletin.pdf', type: 'application/pdf', bytes: new TextEncoder().encode('bulletin') })
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? (out.reason ?? '') : `not refused: ${out.state}`)

before(async () => {
  await db.connect()
  await db.query(`SET cella.clock = '2026-10-24'`)
  await db.query(`SET cella.scope = '${scope}'`)
  await db.query(`CREATE FUNCTION public.anyone(actor text, device bytea) RETURNS text LANGUAGE sql STABLE RETURN NULL`)
  await db.query(`INSERT INTO cella.keyring (fn, owner) VALUES ('public.anyone(text, bytea)', 'test')`)
  await db.query(`INSERT INTO member.member (address, name, status, since, shares) VALUES ($1, 'Camille', 'active', '2021-03-01', 40)`, [camille])
  await db.query(`INSERT INTO member.member (address, name, status, since, shares, exited) VALUES ($1, 'Paul', 'exited', '2021-03-01', 30, '2025-11-30')`, [paul])
})

after(async () => {
  await db.end()
})

test('a member files a record of their own, committed to in the log', async () => {
  const out = await attach({ member: camille, file: form(camille) }, as(camille))
  assert.equal(out.state, 'settled', reason(out))
  const held = await records(db, camille)
  assert.deepEqual(held.map((r) => [r.name, r.uploader]), [['bulletin.pdf', camille]])
  const { rows } = await db.query(`SELECT tableoid::regclass::text AS part FROM file.file WHERE id = $1`, [held[0].id])
  assert.equal(rows[0].part, 'file.record')
  const logged = (await db.query<{ form: Record<string, any> }>(`SELECT form FROM cella.log WHERE op = 'file-member:member:attach'`)).rows[0].form
  assert.match(logged.name.$commit, /^[0-9a-f]{64}$/)
})

test('never a record of someone else, nor once they have left', async () => {
  assert.match(reason(await attach({ member: paul, file: form(paul) }, as(camille))), /camille@lanterne.example may not file a record of paul@lanterne.example/)
  assert.match(reason(await attach({ member: paul, file: form(paul) }, as(paul))), /paul@lanterne.example has left/)
  assert.match(reason(await attach({ member: 'nobody@lanterne.example', file: form('nobody@lanterne.example') }, as(camille))), /no member nobody@lanterne.example/)
})
