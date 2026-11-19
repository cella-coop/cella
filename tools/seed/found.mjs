// seed, found: founds a coop from a fixture, as the log's first entry,
// the founding (the import feat's `membership-motion:scope:found`), which the first
// device the fixture enrols in force signs, as its founder seated in the
// root: the scope's address, its circles and roles, which every record
// names one of, people, their memberships, employments and candidacies,
// their devices, seats, motions with their
// stances and what they decide, the policies the closed ones adopted, the
// founding motion's among them (the scope's `founding` names it), the
// mandates among them copied into the
// circles' mandates, invitations' first devices, documents with their
// versions, those generated from a circle's policies generated at each
// day they changed, comments, adoptions and who read them, contacts, the
// chart, periods and journal, invoices with their payments, files and
// what holds them, and the grafts' links. Stances, document updates,
// adoptions and payments take receipt numbers in file order, unsigned,
// from before the log; a closed motion's cutoff is the number after its
// last stance. Seats load before motions, whose rolls are fixed from them
// as membership-motion's proposal fixes them; a closed motion
// counts its roll as membership-motion's close does; and periods
// close after the journal is in. Each device's key is the TEST-ONLY key
// derived from its address and label (`@cella/org-sign`'s `fixture`), so
// the tests sign with the keys enrolled here.
//
// `read(file)` answers a fixture's file, such as `person` for
// person.toml, or `{}`; `dir` is where its files' bytes are, if any. A
// fixture is a directory (tools/seed.mjs) or a founding built in memory
// (`founding.mjs`).

import { anchor, createDoc, edits, outline } from '../../apps/org/core/body/ts/src/models/index.ts'
import { fill } from '../../apps/org/feats/document/core/ts/src/models/index.ts'
import { departures, inOrder } from '../../apps/org/core/policy/ts/src/index.ts'
import { fixture, signer } from '../../apps/org/core/sign/ts/src/index.ts'
import { found } from '../../apps/org/grafts/membership-motion/ts/src/handlers/found.ts'
import { snapshot, work } from './work.mjs'
import { finance } from './finance.mjs'
import { invitations, actions, adopted } from './governance.mjs'
import { meetings } from './meeting.mjs'
import { files } from './file.mjs'

const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
const receipt = `nextval('cella.receipt_seq')`

// The coop's particulars as a rule of its assembly, worded from
// scope.toml: what it is called, and its legal name, form, capital, seat,
// SIREN, registry, VAT number and logo where it names them, each marked once
// ([the coop's particulars](../../apps/org/core/circle/index.md#the-coops-particulars)).
// The founding motion adopts it as its last action, protected by the
// procedure that amends the statutes where the motion adopts one
// (`{procedure: extraordinary}`), as Lanterne's does. Answers the
// motions, the founding's with it; a scope that names no coop adopts
// none.
export function particulars(scope, motions) {
  if (!scope.name) {
    return motions
  }
  const mark = (name, value) => `{particulars_${name}: ${value}}`
  const wording = [
    `The coop is called ${mark('name', scope.name)}`,
    scope.legal_name ? `, its legal name ${mark('legal_name', scope.legal_name)}` : '',
    scope.form ? `, a ${mark('form', scope.form)}` : '',
    scope.capital ? ` with a capital of ${mark('capital', scope.capital)}` : '',
    scope.seat ? `, whose seat is ${mark('seat', scope.seat)}` : '',
    scope.siren ? `, registered under SIREN ${mark('siren', scope.siren)}` : '',
    scope.rcs ? `${scope.siren ? '' : ', registered'} at the trade register of ${mark('rcs', scope.rcs)}` : '',
    scope.vat ? `, with the VAT number ${mark('vat', scope.vat)}` : '',
    // The logo, an SVG, on one line: the sentence reads as one.
    scope.logo ? `, and bears the mark ${mark('logo', scope.logo.trim().replace(/>\s+</g, '><').replace(/\s+/g, ' '))}` : '',
  ].join('')
  return motions.map((d) => {
    if (d.id !== scope.founding) {
      return d
    }
    const amends = (d.action ?? []).some(
      (a) => a.kind === 'policy' && a.args?.kind === 'procedure' && /\{\s*procedure\s*:\s*extraordinary\s*\}/.test(a.args.wording),
    )
    const args = { kind: 'rule', wording, ...(amends ? { protected: 'extraordinary' } : {}) }
    return { ...d, action: [...(d.action ?? []), { kind: 'policy', args }] }
  })
}

// Founds the fixture `read` reads on `db`, an empty log, named `from`;
// answers the founding's outcome and what it wrote, in words.
export async function seed(db, read, { from, dir }) {
  // Every write signature names the scope; a new connection reads it. Its
  // timezone rides beside it, whose day the notary dates every verdict
  // by. What the coop is called and what its papers print are no
  // setting: they are its particulars, which its founding motion adopts.
  const scope = read('scope')
  const settings = {
    'cella.scope': scope.address,
    'cella.timezone': scope.timezone,
  }
  // The seed's own connection reads them too, so the founding names the
  // scope and dates its verdicts by its day.
  for (const [setting, value] of Object.entries(settings)) {
    if (value) {
      await db.query(`ALTER DATABASE ${db.escapeIdentifier(db.database)} SET ${setting} = ${db.escapeLiteral(value)}`)
      await db.query('SELECT set_config($1, $2, false)', [setting, value])
    }
  }

  // The founding is one write, the log's first entry, which the first
  // device the fixture enrols in force signs, as its founder:
  // membership-motion lets it settle only on an empty log, naming the
  // scope's `founding`, the root's motion its founders, each seated
  // there with a vote, decided, and with its signer one of them. Every
  // row below is written inside it.
  const carrier = (read('person').device ?? []).find((d) => !d.revoked)
  if (!carrier) {
    throw new Error(`${from} enrols no device in force to sign its founding`)
  }
  const deps = { db, actor: carrier.address, sign: signer(scope.address, carrier.address, fixture(carrier.address, carrier.label)) }
  let said = ''
  async function load() {
    // The circles and their roles first: every record names its owning
    // circle, the root's where it names none.
    const structure = read('circle')
    for (const c of structure.circle ?? []) {
      // its own icon too, a slug of the curated set (`record-icons.ts`), or none
      await db.query('INSERT INTO circle.circle (id, name, assembly, purpose, procedure, icon) VALUES ($1, $2, $3, $4, $5, $6)', [
        c.id,
        c.name,
        c.assembly ?? false,
        c.purpose ?? '',
        c.procedure ?? 'consent',
        c.icon ?? null,
      ])
    }
    for (const r of structure.role ?? []) {
      await db.query('INSERT INTO circle.role (id, circle, name, duty, holders) VALUES ($1, $2, $3, $4, $5)', [
        r.id,
        r.circle,
        r.name,
        r.duty ?? '',
        r.holders ?? null,
      ])
    }
    // The coop's layout, the root's listing, each group's id minted from
    // its name; then what each other circle shows of it, the groups it
    // shows and the features it hides inside them.
    if (structure.layout?.features) {
      await db.query('SELECT circle.lay($1, circle.grouped($1))', [structure.layout.features])
    }
    const each = (list) => (list ?? '').split(',').map((v) => v.trim()).filter(Boolean)
    const sound = async (circle, group, feature) => {
      const { rows } = await db.query('SELECT circle.row_flaw($1, $2, $3) AS flaw', [circle, group, feature])
      if (rows[0].flaw) {
        throw new Error(`${from}: ${rows[0].flaw}`)
      }
    }
    for (const s of structure.show ?? []) {
      for (const g of each(s.groups)) {
        await sound(s.circle, g, null)
        await db.query('SELECT circle.show($1, $2, true)', [s.circle, g])
      }
      for (const f of each(s.hides)) {
        await sound(s.circle, null, f)
        await db.query('SELECT circle.hide($1, $2, true)', [s.circle, f])
      }
    }

    // Everyone the coop knows, then the memberships they hold.
    const people = read('person').person ?? []
    for (const p of people) {
      await db.query('INSERT INTO person.person (address, name, email, phone) VALUES ($1, $2, $3, $4)', [p.address, p.name, p.email ?? null, p.phone ?? null])
    }
    const named = new Map(people.map((p) => [p.address, p.name]))
    const members = read('membership').member ?? []
    for (const m of members) {
      await db.query(
        'INSERT INTO membership.member (address, status, since, shares, invited, exited, exit) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [m.address, m.status, day(m.since), m.shares, day(m.invited), day(m.exited), m.exit ?? null],
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

    // Everyone the coop employs, member or not, and their candidacies for
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

    // A circle's members, people and roles, and the tenures of its roles;
    // the seats are read from them.
    const sitting = read('circle')
    for (const m of sitting.member ?? []) {
      await db.query('INSERT INTO circle.member (circle, person, role, since, until) VALUES ($1, $2, $3, $4, $5)', [
        m.circle,
        m.person ?? null,
        m.role ?? null,
        day(m.since),
        day(m.until),
      ])
    }
    for (const t of sitting.tenure ?? []) {
      await db.query('INSERT INTO circle.tenure (circle, holder, role, since, until) VALUES ($1, $2, $3, $4, $5)', [
        t.circle,
        t.holder,
        t.role,
        day(t.since),
        day(t.until),
      ])
    }
    const seats = [...(sitting.member ?? []), ...(sitting.tenure ?? [])]

    // The motions, the founding's adopting the coop's particulars last.
    const motions = particulars(scope, read('motion').motion ?? [])
    let votes = 0
    let moved = 0
    let policies = 0
    let messages = 0
    for (const d of motions) {
      const taken = await db.query(
        `INSERT INTO motion.motion (id, circle, proposer, title, method, procedure, proposed, deadline, body)
         SELECT $1, $2, $8, $3, p.method, p.id, $5, $6, $7 FROM motion.procedure p WHERE p.id = $4`,
        [d.id, d.circle, d.title, d.procedure, day(d.proposed), day(d.deadline), d.body ?? '', d.proposer],
      )
      if (!taken.rowCount) {
        throw new Error(`${d.id} is taken by ${d.procedure}, which is no procedure`)
      }
      await db.query('SELECT motion.fix($1)', [d.id])
      moved += await actions(db, d)
      for (const v of d.vote ?? []) {
        await db.query(
          `INSERT INTO motion.vote (receipt, motion, member, stance, at) VALUES (${receipt}, $1, $2, $3, $4)`,
          [d.id, v.member, v.stance, day(v.at)],
        )
        votes++
      }
      // Its deliberation, carried in with the motion, before it closes:
      // each message under a receipt in file order, a reply naming its
      // place among the motion's own messages.
      const posted = []
      for (const m of d.message ?? []) {
        const { rows } = await db.query(
          `INSERT INTO motion.message (receipt, motion, member, reply, body, at)
           VALUES (${receipt}, $1, $2, $3, $4, $5) RETURNING receipt`,
          [d.id, m.author, m.reply ? posted[m.reply - 1] : null, m.text, day(m.at)],
        )
        posted.push(rows[0].receipt)
        messages++
      }
      if (d.closed) {
        await db.query(`UPDATE motion.motion SET closed = $2, cutoff = ${receipt} WHERE id = $1`, [d.id, day(d.closed)])
        await db.query('SELECT motion.count($1)', [d.id])
        policies += await adopted(db, d)
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
      await db.query('INSERT INTO document.document (id, title, circle) VALUES ($1, $2, coalesce($3, circle.assembly()))', [d.id, d.title, d.circle ?? null])
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
      // A document generated from its circle's policies, one with a
      // template, as the statutes are, is carried over with its template
      // and generated at each day its circle's policies changed, from
      // those in force that day, patched onto the version before, citing
      // each motion whose change it first reads and the day, and adopted
      // that day, as the document feat's `generate` does once a motion
      // adopts or ends one.
      if (d.template) {
        const template = outline(d.template ?? [], `${d.id}'s template`)
        await db.query('INSERT INTO document.generated (document, circle, template) VALUES ($1, $2, $3)', [d.id, d.circle, JSON.stringify(template)])
        const { rows: days } = await db.query(
          `SELECT DISTINCT to_char(d, 'YYYY-MM-DD') AS d FROM (
             SELECT adopted AS d FROM policy.policy WHERE circle = $1
             UNION SELECT ends FROM policy.policy WHERE circle = $1 AND ended_by IS NOT NULL
           ) x ORDER BY d`,
          [d.circle],
        )
        for (const { d: on } of days) {
          const from = loro.version()
          edits.patch(loro, undefined, fill(template, await inOrder(db, d.circle, on), await departures(db, d.circle, on)))
          loro.commit()
          await db.query(
            `INSERT INTO document.update (receipt, document, author, at, bytes) VALUES (${receipt}, $1, NULL, $2, $3)`,
            [d.id, on, loro.export({ mode: 'update', from })],
          )
          const { rows } = await db.query(
            'INSERT INTO document.version (document, saved, snapshot, frontier, vv) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [d.id, on, loro.export({ mode: 'snapshot' }), JSON.stringify(loro.frontiers()), JSON.stringify(Object.fromEntries(loro.version().toJSON()))],
          )
          await db.query(
            `INSERT INTO document.generation (document, version, motion, day)
             SELECT $1, $2, m, $4 FROM (
               SELECT motion AS m FROM policy.policy WHERE circle = $3 AND adopted = $4
               UNION SELECT split_part(ended_by, '/', 1) FROM policy.policy WHERE circle = $3 AND ends = $4 AND ended_by IS NOT NULL
             ) x
             WHERE NOT EXISTS (SELECT FROM document.generation g WHERE g.document = $1 AND g.motion = x.m)`,
            [d.id, rows[0].id, d.circle, on],
          )
          await db.query(
            `INSERT INTO document.adoption (receipt, document, version, base, adopted)
             VALUES (${receipt}, $1, $2, (SELECT version FROM document.adopted WHERE document = $1), $3)`,
            [d.id, rows[0].id, on],
          )
          versions++
        }
      }
    }
    // A comment anchors where its version holds its quote, as the comment
    // write does.
    for (const c of (documents.document ?? []).flatMap((d) => d.comment ?? [])) {
      const { rows } = await db.query('SELECT snapshot FROM document.version WHERE id = $1', [c.version])
      const doc = createDoc()
      doc.import(new Uint8Array(rows[0].snapshot))
      await db.query(
        'INSERT INTO document.comment (version, author, at, quote, anchor, text, resolved) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [c.version, c.author, day(c.at), c.quote, JSON.stringify(anchor(doc, c.quote)), c.text, c.resolved ?? false],
      )
    }

    // The adoptions already made, each from the version adopted before it;
    // what a motion asks to adopt is its action.
    const adoptions = read('graft.document-motion').adoption ?? []
    for (const a of adoptions) {
      await db.query(
        `INSERT INTO document.adoption (receipt, document, version, base, adopted)
         VALUES (${receipt}, $1, $2, (SELECT version FROM document.adopted WHERE document = $1), $3)`,
        [a.document, a.version, day(a.adopted)],
      )
    }

    // Who read which binding version of the texts, once each version is in.
    const readings = read('graft.document-membership').reading ?? []
    for (const r of readings) {
      await db.query('INSERT INTO document_membership.reading (version, member, read) VALUES ($1, $2, $3)', [r.version, r.member, day(r.read)])
    }

    // Each contact with its notes, its body, as one Loro snapshot.
    const contacts = read('contact').contact ?? []
    for (const c of contacts) {
      await db.query(
        'INSERT INTO contact.contact (id, kind, person, name, form, email, phone, parent, client, body) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        [c.id, c.kind ?? 'company', c.person ?? null, c.name ?? null, c.form ?? null, c.email ?? null, c.phone ?? null, c.parent ?? null, c.client ?? null, c.body ? snapshot(c.body, `contact ${c.id}'s body`) : null],
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
        `INSERT INTO invoice.invoice (id, series, number, issued, due, bill_to, bill_address, label, net, vat, total, voided, reason, circle)
         VALUES ($1, $2, $3, $4, $5, $6, $13, $7, cella.amount($8), cella.amount($9), cella.amount($10), $11, $12, coalesce($14, circle.assembly()))`,
        [i.id, invoicing.series, number, day(i.issued), day(i.due), i.bill_to, i.label, i.net, i.vat || null, i.total, day(i.voided), i.reason ?? null, i.bill_address ?? null, i.circle ?? null],
      )
      // The fixture keeps totals; each invoice carries them as one line,
      // its lines and payments the circle the invoice names.
      await db.query(
        `INSERT INTO invoice.line (invoice, n, description, quantity, unit_price, amount, vat_rate, circle)
         VALUES ($1, 1, $2, 1, cella.amount($3), cella.amount($3), $4, coalesce($5, circle.assembly()))`,
        [i.id, i.label, i.net, (i.vat * 100) / i.net, i.circle ?? null],
      )
      const ids = []
      for (const [n, p] of (i.payment ?? []).entries()) {
        const { rows } = await db.query(
          `INSERT INTO invoice.payment (invoice, receipt, at, amount, method, reference, circle)
           VALUES ($1, ${receipt}, $2, cella.amount($3), $4, $5, coalesce($6, circle.assembly())) RETURNING id`,
          [i.id, day(p.at), p.amount, p.method ?? 'transfer', p.reference ?? `${i.id}/${n + 1}`, i.circle ?? null],
        )
        ids.push(rows[0].id)
      }
      payments.set(i.id, ids)
    }

    const billings = read('graft.contact-invoice').billing ?? []
    for (const b of billings) {
      await db.query('INSERT INTO contact_invoice.billing (invoice, contact) VALUES ($1, $2)', [b.invoice, b.contact])
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
      `${people.length} people, ${members.length} members, ${workers.length} workers, ${candidacies.length} candidacies, ${devices.length} devices, ${seats.length} seats, ` +
      `${motions.length} motions, ${votes} stances, ${messages} messages, ` +
      `${moved} actions, ${policies} policies, ${invited} invitations, ${versions} versions, ${adoptions.length} adoptions, ${readings.length} readings, ${contacts.length} contacts, ${entries.length} entries, ${invoices.length} invoices, ` +
      `${postings.length} postings, ${worked}, ${financed}, ${met}, ${filed}`
    return {
      people: people.length, members: members.length, workers: workers.length, devices: devices.length, seats: seats.length,
      motions: motions.length, stances: votes, versions, contacts: contacts.length, entries: entries.length, invoices: invoices.length,
    }
  }
  const outcome = await found({ form: scope.legal_form, motion: scope.founding, from, load }, deps)
  return { outcome, said }
}
