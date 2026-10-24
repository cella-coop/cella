// fixture check: a mock co-op is consistent. Every journal entry balances,
// every link a graft holds resolves, every address is a member's, and the
// books agree with the invoices.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'

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

  const member = read('member')
  const circle = read('circle')
  const decision = read('decision')
  const document = read('document')
  const client = read('client')
  const invoice = read('invoice')
  const ledger = read('ledger')
  const key = read('key')

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
  }

  for (const d of key.device ?? []) {
    known(d.address, 'device')
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
  for (const c of document.comment ?? []) {
    has(versions, c.version, 'version', 'comment')
    known(c.author, 'comment')
  }

  const clients = ids(client.client)
  const invoices = new Map((invoice.invoice ?? []).map((i) => [i.id, i]))
  const accounts = ids(ledger.account, 'code')
  const entries = new Map((ledger.entry ?? []).map((e) => [e.id, e]))

  // Each graft's links resolve on both sides
  for (const p of read('graft.circle-member').position ?? []) {
    has(circles, p.circle, 'circle', 'position')
    known(p.member, 'position')
    if (p.role) {
      has(roles, p.role, 'role', 'position')
    }
  }
  for (const a of read('graft.decision-member').admission ?? []) {
    has(decisions, a.decision, 'decision', 'admission')
    known(a.member, 'admission')
  }
  for (const a of read('graft.decision-document').adoption ?? []) {
    has(decisions, a.decision, 'decision', 'adoption')
    has(documents, a.document, 'document', 'adoption')
    has(versions, a.version, 'version', 'adoption')
  }
  for (const b of read('graft.client-invoice').billing ?? []) {
    has(new Set(invoices.keys()), b.invoice, 'invoice', 'billing')
    has(clients, b.client, 'client', 'billing')
  }
  for (const p of read('graft.invoice-ledger').posting ?? []) {
    has(new Set(invoices.keys()), p.invoice, 'invoice', 'posting')
    has(new Set(entries.keys()), p.entry, 'entry', 'posting')
  }

  // The books balance, entry by entry
  for (const e of entries.values()) {
    const debit = e.line.reduce((s, l) => s + (l.debit ?? 0), 0)
    const credit = e.line.reduce((s, l) => s + (l.credit ?? 0), 0)
    if (debit !== credit) {
      fail(`entry ${e.id} debits ${debit} and credits ${credit}`)
    }
    for (const l of e.line) {
      has(accounts, l.account, 'account', `entry ${e.id}`)
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
}

const names = existsSync(root) ? readdirSync(root) : []
names.forEach(check)
if (errors.length) {
  console.error(errors.map((e) => `fixture check: ${e}`).join('\n'))
  process.exit(1)
}
console.log(`fixture check: ${names.join(', ')} consistent`)
