// The contacts scenario, end to end on a seeded Lanterne, through the
// handlers and the built shell: a person contact is a core person.
// Camille adds Odile Laurent, Maison Ferrand's buyer, by her address,
// which brings her in as a person in the same write; she is one entry in
// People with no chip, and her contact's page names her and links her
// there. A contact naming a member is the same person, who keeps their
// name. At Odile's request Camille erases her: her contact's data and her
// contact details in core go, and Maison Ferrand keeps its own. The log
// verifies throughout. Run by `cella test e2e contacts`.
// covers: contact

import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { add, erase } from '@cella/org-contact/api'
import type { Deps } from '@cella/org-db'
import { reader, sign } from './lanterne.ts'
import { Shell } from './serve.ts'

const su = new pg.Client()
const shell = new Shell(su)
let app: pg.Client

const camille = 'camille@lanterne.example'
const sofia = 'sofia@lanterne.example'
const odile = 'odile.laurent@maison-ferrand.example'

const as = (actor: string): Deps => ({ db: reader(app, actor), actor, sign: sign(actor) })
const one = async <R>(sql: string, values: unknown[] = []) => (await su.query(sql, values)).rows[0] as R
const reason = (out: { state: string; reason?: string }) => (out.state === 'refused' ? out.reason ?? '' : '')
const settled = (out: { state: string; entry?: number; reason?: string }) => {
  assert.equal(out.state, 'settled', reason(out))
  return out.entry as number
}
const verifies = async () => (await one<{ v: boolean }>('SELECT cella.verify_log() AS v')).v
// A page as Camille sees it, as text, its tags gone.
const text = async (path: string) => {
  const { status, text } = await shell.page(path, camille)
  assert.equal(status, 200, path)
  return text.replace(/<[^>]+>/g, ' ').replace(/&#39;|&rsquo;|’/g, "'").replace(/\s+/g, ' ')
}

before(async () => {
  await su.connect()
  await shell.start('2026-10-24')
  app = new pg.Client({ user: 'cella_app' })
  await app.connect()
})

after(async () => {
  await shell.stop()
  await app.end()
  await su.end()
})

test('a person contact added by address brings a core person in, in the same write, with the details it gives', async () => {
  const n = settled(
    await add({ id: 'ferrand-laurent', kind: 'person', person: odile, parent: 'ferrand', name: 'Odile Laurent', email: odile, phone: '+33 6 18 22 40 07', address: { street: '4 rue du Four', city: 'Tours', postal_code: '37000', country: 'FR' } }, as(camille)),
  )
  assert.deepEqual(await one('SELECT name, email, phone FROM person.person WHERE address = $1', [odile]), {
    name: 'Odile Laurent', email: odile, phone: '+33 6 18 22 40 07',
  })
  assert.deepEqual(await one(`SELECT person, name, email, phone, parent FROM contact.contact WHERE id = 'ferrand-laurent'`), {
    person: odile, name: null, email: null, phone: null, parent: 'ferrand',
  })
  const form = (await one<{ form: Record<string, any> }>('SELECT form FROM cella.log WHERE n = $1', [n])).form
  assert.ok(!JSON.stringify(form).includes('Odile Laurent') && !JSON.stringify(form).includes('+33 6 18'), 'the log commits to her details, never holds them')
  assert.deepEqual(Object.keys(form.entered).sort(), ['email', 'name', 'phone'])
})

test('she is one entry in People, with no chip, holding nothing, and her contact\'s page links her there', async () => {
  const people = (await shell.page('/people', camille)).text
  // Her row in People, grouped by the path: her name, and no chip, as
  // the group's header says whether one is a member or a worker.
  const rows = people.split('<li').filter((r) => /href="\/people\/odile\.laurent(@|%40)maison-ferrand\.example"/.test(r))
  assert.equal(rows.length, 1, 'People lists her once')
  assert.ok(rows[0].includes('Odile Laurent'))
  assert.ok(!/class="badge /.test(rows[0]), 'her row shows no chip')
  assert.equal(rows[0].match(/cell badge/g), null, 'neither Member nor Worker')
  assert.equal(
    (await one<{ n: string }>(
      `SELECT (SELECT count(*) FROM membership.member WHERE address = $1) + (SELECT count(*) FROM employment.worker WHERE address = $1) + (SELECT count(*) FROM person.device WHERE address = $1) AS n`,
      [odile],
    )).n,
    '0',
    'she holds no membership, no employment and no device',
  )
  assert.ok((await text(`/people/${odile}`)).includes('Odile Laurent'), 'her page names her')
  const contact = (await shell.page('/contacts/ferrand-laurent', camille)).text
  assert.ok(contact.includes('Odile Laurent') && contact.includes(odile), 'her contact reads her name and email from core')
  assert.match(contact, /href="\/people\/odile\.laurent(@|%40)maison-ferrand\.example"/, 'and links her entry in People')
})

test('a contact naming a member is the same person, who keeps their name and details', async () => {
  const n = settled(await add({ id: 'nuvola-rossi', kind: 'person', person: sofia, parent: 'nuvola', name: 'S. Rossi', email: 'sofia@elsewhere.example' }, as(camille)))
  assert.equal((await one<{ form: Record<string, any> }>('SELECT form FROM cella.log WHERE n = $1', [n])).form.entered, undefined)
  assert.deepEqual(await one('SELECT name, email FROM person.person WHERE address = $1', [sofia]), { name: 'Sofia Rossi', email: null })
  assert.equal((await one<{ n: string }>('SELECT count(*) AS n FROM person.person WHERE address = $1', [sofia])).n, '1')
  assert.ok((await text('/contacts/nuvola-rossi')).includes('Sofia Rossi'))
})

test('erasing her erases her contact\'s data and her contact details in core; her company keeps its own, and the log verifies', async () => {
  const n = settled(await erase({ id: 'ferrand-laurent' }, as(camille)))
  const form = (await one<{ form: Record<string, any> }>('SELECT form FROM cella.log WHERE n = $1', [n])).form
  assert.deepEqual(form.erasure, { $erasure: { subject: 'ferrand-laurent', erased: ['contact'], restricted: [] } })
  assert.deepEqual(form.details, { $erasure: { subject: odile, erased: ['contact'], restricted: [] } })
  assert.deepEqual(await one('SELECT email, phone FROM person.person WHERE address = $1', [odile]), { email: 'redacted', phone: 'redacted' })
  assert.deepEqual(await one(`SELECT address, archived FROM contact.contact WHERE id = 'ferrand-laurent'`), { address: 'redacted', archived: true })
  assert.equal((await one<{ name: string }>(`SELECT name FROM contact.contact WHERE id = 'ferrand'`)).name, 'Maison Ferrand')
  assert.ok(!(await shell.page('/contacts', camille)).text.includes('href="/contacts/ferrand-laurent"'), 'an erased contact is archived, so no longer listed')
  assert.equal(await verifies(), true)
})
