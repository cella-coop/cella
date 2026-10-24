// Normalises the Lanterne fixture into one JSON fact base that every
// candidate reads. Two things the fixture holds only as prose are mapped
// here by hand, and are gaps in the fixture: mandate powers to action ids,
// and the surplus split of d-2026-006.
import { readFileSync, writeFileSync } from 'node:fs'
import { parse } from 'smol-toml'

const dir = new URL('../../../apps/org/fixtures/lanterne/', import.meta.url)
const load = (name) => parse(readFileSync(new URL(name, dir), 'utf8'))
const day = (d) => (d == null ? null : new Date(d).toISOString().slice(0, 10))

const circle = load('circle.toml')
const graft = load('graft.circle-member.toml')
const decision = load('decision.toml')
const ledger = load('ledger.toml')
const invoice = load('invoice.toml')
const member = load('member.toml')

const powers = {
  'sign contracts and commit spending': ['pay_supplier', 'spend', 'quote'],
  'pay suppliers': ['pay_supplier'],
  'issue invoices and close a period': ['issue_invoice', 'close_period'],
  'spend for the circle': ['spend'],
  'send a quote': ['quote'],
}

const mandates = circle.mandate.flatMap((m) =>
  powers[m.power].map((action) => ({
    role: m.role,
    action,
    max: m.max_amount ?? null,
    // a lead's spending is for the circle they lead
    own_circle: m.role === 'lead' && action === 'spend',
  })),
)

let seq = 0
const facts = {
  today: '2026-10-24',
  circles: circle.circle.map((c) => ({ id: c.id, parent: c.parent ?? null })),
  members: member.member.map((m) => ({ id: m.address, status: m.status })),
  positions: graft.position.map((p) => ({
    member: p.member,
    circle: p.circle,
    role: p.role ?? null,
    since: day(p.since),
    until: day(p.until),
  })),
  mandates,
  decisions: decision.decision.map((d) => ({
    id: d.id,
    circle: d.circle,
    rule: d.rule,
    deadline: day(d.deadline),
    closed: day(d.closed),
    // log order: the fixture lists votes in the order the notary received them
    votes: d.vote.map((v) => ({ seq: ++seq, member: v.member, stance: v.stance, at: day(v.at) })),
  })),
  periods: ledger.period.map((p) => ({ month: p.month, closed: day(p.closed) })),
  entries: ledger.entry.map((e) => ({
    id: e.id,
    date: day(e.date),
    lines: e.line.map((l) => ({ account: l.account, debit: l.debit ?? 0, credit: l.credit ?? 0 })),
  })),
  invoices: invoice.invoice.map((i) => ({
    id: i.id,
    total: i.total,
    voided: day(i.voided),
    payments: (i.payment ?? []).map((p) => ({ at: day(p.at), amount: p.amount })),
  })),
}

writeFileSync(new URL('lanterne.json', import.meta.url), JSON.stringify(facts, null, 2) + '\n')
console.log(
  `facts: ${facts.positions.length} positions, ${facts.mandates.length} mandates, ` +
    `${facts.decisions.length} decisions, ${facts.entries.length} entries, ${facts.invoices.length} invoices`,
)
