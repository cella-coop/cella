// fixture check: a mock co-op is consistent. Every journal entry balances,
// every surplus distribution splits the whole surplus, every link a graft holds
// resolves, every device and every membership and employment is a person's,
// every vote and seat a member's, the books agree with the invoices,
// and every document version is an outline of blocks the document model
// takes, whose embeds name what exists and whose comments quote text one of
// its blocks holds.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { work } from './fixture/work.mjs'
import { finance } from './fixture/finance.mjs'
import { governance } from './fixture/governance.mjs'
import { meeting, meetingIds } from './fixture/meeting.mjs'
import { people } from './fixture/people.mjs'
import { embedded, outline } from '../apps/org/feats/document/core/ts/src/models/outline.ts'

const root = join(process.argv[2] ?? process.cwd(), 'apps/org/fixtures')
const errors = []

const check = (name) => {
  const dir = join(root, name)
  const read = (file) => {
    const path = join(dir, `${file}.toml`)
    return existsSync(path) ? parse(readFileSync(path, 'utf8')) : {}
  }
  const fail = (msg) => errors.push(`${name}: ${msg}`)
  const ids = (list, key = 'id') => new Set((list ?? []).map((x) => x[key]))

  const member = read('membership')
  const circle = read('circle')
  const decision = read('decision')
  const document = read('document')
  const client = read('client')
  const invoice = read('invoice')
  const account = read('account')
  const patronage = read('patronage')
  const transaction = read('transaction')
  const person = read('person')

  const addresses = ids(member.member, 'address')
  const known = (addr, where) => {
    if (!addresses.has(addr)) {
      fail(`${where}: ${addr} is no member`)
    }
  }
  const has = (set, id, what, where) => {
    if (!set.has(id)) {
      fail(`${where}: no ${what} ${id}`)
    }
  }

  const circles = ids(circle.circle)
  const roles = ids(circle.role)
  for (const c of circle.circle ?? []) {
    if (c.parent) {
      has(circles, c.parent, 'circle', `circle ${c.id}`)
    }
  }
  for (const r of circle.role ?? []) {
    if (r.circle !== '*') {
      has(circles, r.circle, 'circle', `role ${r.id}`)
    }
  }
  for (const m of circle.mandate ?? []) {
    has(roles, m.role, 'role', 'mandate')
    if (!/^[a-z]+(-[a-z]+)*$/.test(m.power ?? '')) {
      fail(`mandate of ${m.role}: power ${m.power} is no id`)
    }
  }

  const everyone = ids(person.person, 'address')
  for (const p of [...(member.member ?? []), ...(read('employment').worker ?? [])]) {
    if (!everyone.has(p.address)) {
      fail(`${p.address}: no person holds their membership or employment`)
    }
  }
  for (const d of person.device ?? []) {
    if (!everyone.has(d.address)) {
      fail(`device: ${d.address} is no person`)
    }
  }

  const decisions = ids(decision.decision)
  for (const d of decision.decision ?? []) {
    has(circles, d.circle, 'circle', `decision ${d.id}`)
    for (const v of d.vote ?? []) {
      known(v.member, `vote on ${d.id}`)
    }
  }

  const documents = ids(document.document)
  const versions = new Set((document.document ?? []).flatMap((d) => (d.version ?? []).map((v) => v.id)))
  const outlines = new Map()
  for (const v of (document.document ?? []).flatMap((d) => d.version ?? [])) {
    try {
      outlines.set(v.id, outline(v.block ?? [], v.id))
    } catch (e) {
      fail(e.message)
      continue
    }
    const drawn = { decision: decisions, meeting: meetingIds(read) }
    for (const e of embedded(outlines.get(v.id))) {
      if (!drawn[e.embed]) {
        fail(`${v.id}: embeds a ${e.embed}, which nothing draws`)
      } else {
        has(drawn[e.embed], e.ref, e.embed, `${v.id}'s embed`)
      }
    }
  }
  const texts = (fs) => fs.flatMap((f) => [f.runs.map((r) => r.text).join(''), ...texts(f.children)])
  for (const c of (document.document ?? []).flatMap((d) => d.comment ?? [])) {
    has(versions, c.version, 'version', 'comment')
    known(c.author, 'comment')
    if (outlines.has(c.version) && !texts(outlines.get(c.version)).some((t) => t.includes(c.quote))) {
      fail(`comment on ${c.version}: no block holds “${c.quote}”`)
    }
  }

  const clients = ids(client.client)
  const invoices = new Map((invoice.invoice ?? []).map((i) => [i.id, i]))
  const accounts = ids(account.account, 'code')
  const periods = ids(account.period, 'month')
  const distributions = ids(patronage.distribution)

  // A surplus distribution splits the whole surplus, each share at its
  // percent
  for (const a of patronage.distribution ?? []) {
    const shares = a.share ?? []
    const percent = shares.reduce((s, x) => s + x.percent, 0)
    const amount = shares.reduce((s, x) => s + x.amount, 0)
    if (percent !== 100 || amount !== a.surplus) {
      fail(`distribution ${a.id}: shares make ${percent} % and ${amount}, not 100 % of ${a.surplus}`)
    }
    for (const x of shares) {
      if (x.amount * 100 !== a.surplus * x.percent) {
        fail(`distribution ${a.id}: the ${x.kind} share is not ${x.percent} % of the surplus`)
      }
    }
  }
  const entries = new Map((transaction.entry ?? []).map((e) => [e.id, e]))

  // Each graft's links resolve on both sides
  for (const p of read('graft.circle-member').position ?? []) {
    has(circles, p.circle, 'circle', 'position')
    known(p.member, 'position')
    if (p.role) {
      has(roles, p.role, 'role', 'position')
    }
  }
  for (const a of read('graft.decision-document').adoption ?? []) {
    has(decisions, a.decision, 'decision', 'adoption')
    has(documents, a.document, 'document', 'adoption')
    has(versions, a.version, 'version', 'adoption')
  }
  for (const a of read('graft.decision-patronage').approval ?? []) {
    has(distributions, a.distribution, 'distribution', 'approval')
    has(decisions, a.decision, 'decision', 'approval')
  }
  for (const b of read('graft.client-invoice').billing ?? []) {
    has(new Set(invoices.keys()), b.invoice, 'invoice', 'billing')
    has(clients, b.client, 'client', 'billing')
  }
  for (const p of read('graft.invoice-transaction').posting ?? []) {
    has(new Set(invoices.keys()), p.invoice, 'invoice', 'posting')
    has(new Set(entries.keys()), p.entry, 'entry', 'posting')
  }

  // The account-transaction graft: each line's code is an account, and each
  // entry falls in a period the accounts keep
  for (const e of entries.values()) {
    has(periods, e.date.toISOString().slice(0, 7), 'period', `entry ${e.id}`)
    for (const l of e.line) {
      has(accounts, l.account, 'account', `entry ${e.id}`)
    }
  }

  // The books balance, entry by entry, and a line's side carries its
  // direction: its amount is positive, on exactly one side
  for (const e of entries.values()) {
    for (const l of e.line) {
      const sides = [l.debit, l.credit].filter((x) => x !== undefined)
      if (sides.length !== 1 || !(sides[0] > 0)) {
        fail(`entry ${e.id}: a line on account ${l.account} needs one positive amount, debit or credit`)
      }
    }
    const debit = e.line.reduce((s, l) => s + (l.debit ?? 0), 0)
    const credit = e.line.reduce((s, l) => s + (l.credit ?? 0), 0)
    if (debit !== credit) {
      fail(`entry ${e.id} debits ${debit} and credits ${credit}`)
    }
  }

  // Invoices add up, and what clients owe in the books is what is unpaid
  let owed = 0
  for (const i of invoices.values()) {
    if (i.net + i.vat !== i.total) {
      fail(`invoice ${i.id}: net and VAT do not make the total`)
    }
    const paid = (i.payment ?? []).reduce((s, p) => s + p.amount, 0)
    if (paid > i.total) {
      fail(`invoice ${i.id}: paid more than its total`)
    }
    owed += i.voided ? 0 : i.total - paid
  }
  const receivable = [...entries.values()].flatMap((e) => e.line)
    .filter((l) => l.account === '411')
    .reduce((s, l) => s + (l.debit ?? 0) - (l.credit ?? 0), 0)
  if (receivable !== owed) {
    fail(`the books say clients owe ${receivable}, the invoices ${owed}`)
  }

  work(read, fail)
  finance(read, fail)
  governance(read, fail)
  meeting(read, fail)
  people(read, fail)
}

const names = existsSync(root) ? readdirSync(root) : []
names.forEach(check)
if (errors.length) {
  console.error(errors.map((e) => `fixture check: ${e}`).join('\n'))
  process.exit(1)
}
console.log(`fixture check: ${names.join(', ')} consistent`)
