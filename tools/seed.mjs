// seed: loads a mock co-op into the feat and graft schemas, as the state
// carried over from before the log, in one write that settles as the log's
// first entry (the import feat's `import:state:carry`): the scope's address, people, their
// memberships, employments and candidacies, their devices, circles, roles and mandates,
// seats, decisions with their stances and what they decide, invitations'
// first devices, documents with their versions, comments, adoptions and
// who read them, clients, the chart, periods and journal, invoices with
// their payments, files and what holds them, and the grafts' links. Stances, document updates, adoptions and
// payments take receipt numbers in file order, unsigned, from before the
// log; a closed decision's cutoff is the number after its last stance.
// Seats load before decisions, whose rolls are fixed from them, and periods
// close after the journal is in. Each device's key is the TEST-ONLY key
// derived from its address and label (`@cella/org-sign`'s `fixture`), so
// the tests sign with the keys enrolled here.
// It connects to DATABASE_URL if set, otherwise by the PG* variables.
// Usage: node tools/seed.mjs apps/org/fixtures/<co-op>

import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { anchor, createDoc, edits, outline } from '../apps/org/feats/document/core/ts/src/models/index.ts'
import { parse } from 'smol-toml'
import pg from 'pg'
import { fixture, signer } from '../apps/org/core/sign/ts/src/index.ts'
import { carry } from '../apps/org/feats/import/core/ts/src/api/index.ts'
import { work } from './seed/work.mjs'
import { finance } from './seed/finance.mjs'
import { invitations, motions } from './seed/governance.mjs'
import { meetings } from './seed/meeting.mjs'
import { files } from './seed/file.mjs'

const dir = process.argv[2]
const read = (file) => {
  const path = join(dir, `${file}.toml`)
  return existsSync(path) ? parse(readFileSync(path, 'utf8')) : {}
}
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
const receipt = `nextval('cella.receipt_seq')`

const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()

// Every write signature names the scope; a new connection reads it. Its
// name and legal name ride beside it, for the shell to call the co-op by,
// and the mentions its invoices print: its form, SIREN, registry, VAT
// number, seat and, for a fixed capital, its amount; and its timezone,
// whose day the notary dates every verdict by.
const scope = read('scope')
const settings = {
  'cella.scope': scope.address,
  'cella.scope_name': scope.name,
  'cella.scope_legal_name': scope.legal_name,
  'cella.scope_form': scope.form,
  'cella.scope_siren': scope.siren,
  'cella.scope_rcs': scope.rcs,
  'cella.scope_vat': scope.vat,
  'cella.scope_seat': scope.seat,
  'cella.scope_capital': scope.capital,
  'cella.timezone': scope.timezone,
}
// The seed's own connection reads them too, so the write that carries the
// state in names the scope, and each invoice it issues keeps the seller its
// mentions name (`invoice.seller`).
for (const [setting, value] of Object.entries(settings)) {
  if (value) {
    await db.query(`ALTER DATABASE ${db.escapeIdentifier(db.database)} SET ${setting} = ${db.escapeLiteral(value)}`)
    await db.query('SELECT set_config($1, $2, false)', [setting, value])
  }
}

// The state before the log comes in as one write, the log's first entry,
// which the first device the fixture enrols in force signs, as its
// member: `import:state:carry`, which the import feat lets settle only
// on an empty log. Every row below is written inside it.
const carrier = (read('person').device ?? []).find((d) => !d.revoked)
if (!carrier) {
  throw new Error(`${dir} enrols no device in force to carry its state in`)
}
const deps = { db, actor: carrier.address, sign: signer(scope.address, carrier.address, fixture(carrier.address, carrier.label)) }
let said = ''
async function load() {
  // Everyone the co-op knows, then the memberships they hold.
  const people = read('person').person ?? []
  for (const p of people) {
    await db.query('INSERT INTO person.person (address, name, email, phone) VALUES ($1, $2, $3, $4)', [p.address, p.name, p.email ?? null, p.phone ?? null])
  }
  const named = new Map(people.map((p) => [p.address, p.name]))
  const members = read('membership').member ?? []
  for (const m of members) {
    await db.query(
      'INSERT INTO membership.member (address, status, since, shares, invited, exited) VALUES ($1, $2, $3, $4, $5, $6)',
      [m.address, m.status, day(m.since), m.shares, day(m.invited), day(m.exited)],
    )
  }

  // A first device is enrolled by the seed, before the log, so it names no
  // device that enrolled it.
  const devices = read('person').device ?? []
  for (const d of devices) {
    const { key } = await fixture(d.address, d.label)
    await db.query(
      `INSERT INTO person.device (key, address, label, enrolled, revoked) VALUES (decode($1, 'hex'), $2, $3, $4, $5)`,
      [key, d.address, d.label, day(d.enrolled), day(d.revoked)],
    )
  }

  // Everyone the co-op employs, member or not, and their candidacies for
  // membership, before their time and their pay load. Each hire is recorded
  // on the day its contract starts, the register of the staff copying the
  // person's name.
  const workers = read('employment').worker ?? []
  for (const w of workers) {
    await db.query(
      'INSERT INTO employment.worker (address, name, job, contract, start, until, minutes, hired) VALUES ($1, $2, $3, $4, $5, $6, $7, $5)',
      [w.address, named.get(w.address), w.job, w.contract, day(w.start), day(w.until), Math.round(w.hours * 60)],
    )
  }
  const candidacies = read('graft.employment-membership').candidacy ?? []
  for (const c of candidacies) {
    await db.query('INSERT INTO employment_membership.candidacy (worker, "from", "to", shares, opened) VALUES ($1, $2, $3, $4, $2)', [
      c.worker,
      day(c.from),
      day(c.to),
      c.shares,
    ])
  }

  // The co-op's own procedures, beside the decision feat's built-in ones,
  // before the circles that decide by them.
  const procedures = read('decision').procedure ?? []
  for (const p of procedures) {
    await db.query(
      'INSERT INTO decision.procedure (id, label, rule, share_num, share_den, quorum_num, quorum_den) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [p.id, p.label, p.rule, p.share?.[0] ?? null, p.share?.[1] ?? null, p.quorum?.[0] ?? 0, p.quorum?.[1] ?? 1],
    )
  }

  const structure = read('circle')
  for (const c of structure.circle ?? []) {
    await db.query('INSERT INTO circle.circle (id, name, parent, purpose, procedure) VALUES ($1, $2, $3, $4, $5)', [
      c.id,
      c.name,
      c.parent ?? null,
      c.purpose ?? '',
      c.procedure ?? 'consent',
    ])
  }
  for (const r of structure.role ?? []) {
    await db.query('INSERT INTO circle.role (id, circle, name, duty) VALUES ($1, $2, $3, $4)', [r.id, r.circle, r.name, r.duty ?? ''])
  }
  for (const m of structure.mandate ?? []) {
    await db.query(
      `INSERT INTO circle.mandate (role, power, text, "limit", budget, per, "from", until)
       VALUES ($1, $2, $3, cella.amount($4), cella.amount($5), $6, $7, $8)`,
      [m.role, m.power, m.text, m.limit ?? null, m.budget ?? null, m.per ?? null, day(m.from), day(m.until)],
    )
  }

  const positions = read('graft.circle-membership').position ?? []
  for (const p of positions) {
    await db.query(
      'INSERT INTO circle_membership.position (circle, member, role, since, until) VALUES ($1, $2, $3, $4, $5)',
      [p.circle, p.member, p.role ?? null, day(p.since), day(p.until)],
    )
  }

  const decisions = read('decision').decision ?? []
  let votes = 0
  let moved = 0
  for (const d of decisions) {
    const taken = await db.query(
      `INSERT INTO decision.decision (id, circle, title, rule, procedure, proposed, deadline, body)
       SELECT $1, $2, $3, p.rule, p.id, $5, $6, $7 FROM decision.procedure p WHERE p.id = $4`,
      [d.id, d.circle, d.title, d.procedure, day(d.proposed), day(d.deadline), d.body ?? ''],
    )
    if (!taken.rowCount) {
      throw new Error(`${d.id} is taken by ${d.procedure}, which is no procedure`)
    }
    moved += await motions(db, d)
    for (const v of d.vote ?? []) {
      await db.query(
        `INSERT INTO decision.vote (receipt, decision, member, stance, at) VALUES (${receipt}, $1, $2, $3, $4)`,
        [d.id, v.member, v.stance, day(v.at)],
      )
      votes++
    }
    if (d.closed) {
      await db.query(`UPDATE decision.decision SET closed = $2, cutoff = ${receipt} WHERE id = $1`, [d.id, day(d.closed)])
    }
  }

  const invited = await invitations(db, read)

  // Each document's versions become Loro updates, one per version in order,
  // from one peer: the history before the log, with no author. Each version's
  // outline is patched onto the one before, keeping the blocks that did not
  // change, and saved as a snapshot, which the database canonicalises and
  // hashes; it records the frontier and version vector its update reached.
  const documents = read('document')
  let versions = 0
  for (const d of documents.document ?? []) {
    await db.query('INSERT INTO document.document (id, title) VALUES ($1, $2)', [d.id, d.title])
    const loro = createDoc(1n)
    for (const v of d.version ?? []) {
      const from = loro.version()
      edits.patch(loro, undefined, outline(v.block ?? [], v.id))
      loro.commit()
      await db.query(
        `INSERT INTO document.update (receipt, document, author, at, bytes) VALUES (${receipt}, $1, NULL, $2, $3)`,
        [d.id, day(v.saved), loro.export({ mode: 'update', from })],
      )
      await db.query(
        'INSERT INTO document.version (document, n, saved, snapshot, frontier, vv) VALUES ($1, $2, $3, $4, $5, $6)',
        [d.id, Number(v.id.split('@')[1]), day(v.saved), loro.export({ mode: 'snapshot' }), JSON.stringify(loro.frontiers()), JSON.stringify(Object.fromEntries(loro.version().toJSON()))],
      )
      versions++
    }
  }
  // A comment anchors where its version holds its quote, as the comment
  // write does.
  for (const c of (documents.document ?? []).flatMap((d) => d.comment ?? [])) {
    const { rows } = await db.query('SELECT snapshot FROM document.version WHERE id = $1', [c.version])
    const doc = createDoc()
    doc.import(new Uint8Array(rows[0].snapshot))
    await db.query(
      'INSERT INTO document.comment (version, author, at, quote, anchor, text) VALUES ($1, $2, $3, $4, $5, $6)',
      [c.version, c.author, day(c.at), c.quote, JSON.stringify(anchor(doc, c.quote)), c.text],
    )
  }

  // What decisions ask to adopt, named by the hash the database gave the
  // version, and the adoptions already made, each from the version adopted
  // before it.
  const adoptions = read('graft.decision-document').adoption ?? []
  for (const a of adoptions) {
    await db.query(
      `INSERT INTO decision_document.adoption (decision, document, version, hash)
       SELECT $1, $2, $3, hash FROM document.version WHERE id = $3 AND document = $2`,
      [a.decision, a.document, a.version],
    )
    if (a.adopted) {
      await db.query(
        `INSERT INTO document.adoption (receipt, document, version, base, adopted)
         VALUES (${receipt}, $1, $2, (SELECT version FROM document.adopted WHERE document = $1), $3)`,
        [a.document, a.version, day(a.adopted)],
      )
    }
  }

  // Who read which binding version of the texts, once each version is in.
  const readings = read('graft.document-membership').reading ?? []
  for (const r of readings) {
    await db.query('INSERT INTO document_membership.reading (version, member, read) VALUES ($1, $2, $3)', [r.version, r.member, day(r.read)])
  }

  const clients = read('client').client ?? []
  for (const c of clients) {
    await db.query(
      'INSERT INTO client.client (id, kind, name, form, note, email, phone, parent) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [c.id, c.kind ?? 'company', c.name, c.form ?? null, c.note ?? '', c.email ?? null, c.phone ?? null, c.parent ?? null],
    )
  }

  const books = read('account')
  for (const a of books.account ?? []) {
    await db.query('INSERT INTO account.account (code, label, kind, cash) VALUES ($1, $2, $3, $4)', [a.code, a.label, a.kind, a.cash ?? false])
  }
  for (const p of books.period ?? []) {
    await db.query('INSERT INTO account.period (month) VALUES ($1)', [p.month])
  }

  const entries = read('transaction').entry ?? []
  for (const e of entries) {
    await db.query('INSERT INTO transaction.entry (id, date, label) VALUES ($1, $2, $3)', [e.id, day(e.date), e.label])
    for (const [i, l] of e.line.entries()) {
      const side = l.debit !== undefined ? 'debit' : 'credit'
      await db.query(
        'INSERT INTO transaction.line (entry, n, account, side, amount) VALUES ($1, $2, $3, $4, cella.amount($5))',
        [e.id, i + 1, l.account, side, l.debit ?? l.credit],
      )
    }
  }

  const invoicing = read('invoice')
  const invoices = invoicing.invoice ?? []
  const payments = new Map()
  if (invoicing.series) {
    await db.query('INSERT INTO invoice.series (name, next) VALUES ($1, $2)', [invoicing.series, invoicing.next])
  }
  for (const i of invoices) {
    const number = Number(i.id.slice(invoicing.series.length + 1))
    await db.query(
      `INSERT INTO invoice.invoice (id, series, number, issued, due, bill_to, bill_address, label, net, vat, total, voided, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $13, $7, cella.amount($8), cella.amount($9), cella.amount($10), $11, $12)`,
      [i.id, invoicing.series, number, day(i.issued), day(i.due), i.bill_to, i.label, i.net, i.vat || null, i.total, day(i.voided), i.reason ?? null, i.bill_address ?? null],
    )
    // The fixture keeps totals; each invoice carries them as one line.
    await db.query(
      `INSERT INTO invoice.line (invoice, n, description, quantity, unit_price, amount, vat_rate)
       VALUES ($1, 1, $2, 1, cella.amount($3), cella.amount($3), $4)`,
      [i.id, i.label, i.net, (i.vat * 100) / i.net],
    )
    const ids = []
    for (const [n, p] of (i.payment ?? []).entries()) {
      const { rows } = await db.query(
        `INSERT INTO invoice.payment (invoice, receipt, at, amount, method, reference)
         VALUES ($1, ${receipt}, $2, cella.amount($3), $4, $5) RETURNING id`,
        [i.id, day(p.at), p.amount, p.method ?? 'transfer', p.reference ?? `${i.id}/${n + 1}`],
      )
      ids.push(rows[0].id)
    }
    payments.set(i.id, ids)
  }

  const billings = read('graft.client-invoice').billing ?? []
  for (const b of billings) {
    await db.query('INSERT INTO client_invoice.billing (invoice, client) VALUES ($1, $2)', [b.invoice, b.client])
  }

  const postings = read('graft.invoice-transaction').posting ?? []
  const paid = new Map()
  for (const p of postings) {
    let payment = null
    if (p.event === 'payment') {
      const n = paid.get(p.invoice) ?? 0
      payment = payments.get(p.invoice)?.[n] ?? null
      paid.set(p.invoice, n + 1)
    }
    await db.query(
      'INSERT INTO invoice_transaction.posting (entry, invoice, event, payment) VALUES ($1, $2, $3, $4)',
      [p.entry, p.invoice, p.event, payment],
    )
  }

  for (const p of (books.period ?? []).filter((p) => p.closed)) {
    await db.query('UPDATE account.period SET closed = $2 WHERE month = $1', [p.month, day(p.closed)])
  }

  const worked = await work(db, read, day)
  const financed = await finance(db, read, day)
  const met = await meetings(db, read, day)
  const filed = await files(db, read, day, dir)
  said =
    `${people.length} people, ${members.length} members, ${workers.length} workers, ${candidacies.length} candidacies, ${devices.length} devices, ${(structure.mandate ?? []).length} mandates, ${positions.length} seats, ` +
    `${decisions.length} decisions, ${votes} stances, ` +
    `${moved} motions, ${invited} invitations, ${versions} versions, ${adoptions.length} adoptions, ${readings.length} readings, ${clients.length} clients, ${entries.length} entries, ${invoices.length} invoices, ` +
    `${postings.length} postings, ${worked}, ${financed}, ${met}, ${filed}`
  return {
    people: people.length, members: members.length, workers: workers.length, devices: devices.length, seats: positions.length,
    decisions: decisions.length, stances: votes, versions, clients: clients.length, entries: entries.length, invoices: invoices.length,
  }
}
const carried = await carry({ from: basename(dir), load }, deps)
if (carried.state !== 'settled') {
  throw new Error(`the state before the log was not carried in: ${carried.state === 'refused' ? carried.reason : carried.state}`)
}
await db.end()
console.log(`seed: ${said} into ${db.database}, carried in as log entry ${carried.entry}`)
