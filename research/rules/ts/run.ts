import { readFileSync } from 'node:fs'
import { allowed, entryFaults, outcome, paymentFaults, split, type Facts } from './rules.ts'

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'))
const facts: Facts = read('../facts/lanterne.json')
const cases = read('../facts/cases.json')
const out: string[] = []
const verdict = (faults: string[]) => (faults.length ? `refused ${faults.sort().join(',')}` : 'ok')

for (const r of cases.requests) {
  out.push(`request ${r.id} ${allowed(facts, r) ? 'allow' : 'deny'}`)
}
for (const w of cases.writes) {
  const faults =
    w.kind === 'entry'
      ? entryFaults(facts, w)
      : paymentFaults(facts.invoices.find((i) => i.id === w.invoice)!, w.amount)
  out.push(`write ${w.id} ${verdict(faults)}`)
}

// the existing books, checked as they stand
const unbalanced = facts.entries.filter((e) => entryFaults(facts, e).includes('unbalanced')).map((e) => e.id)
const overpaid = facts.invoices.filter((i) => i.payments.reduce((s, p) => s + p.amount, 0) > i.total).map((i) => i.id)
const voidPaid = facts.invoices.filter((i) => i.voided !== null && i.payments.length > 0).map((i) => i.id)
out.push(`check balance ${unbalanced.length ? unbalanced.join(',') : 'ok'}`)
out.push(`check overpaid ${overpaid.length ? overpaid.join(',') : 'ok'}`)
out.push(`check voided ${voidPaid.length ? voidPaid.join(',') : 'ok'}`)

for (const d of facts.decisions) {
  const o = outcome(facts, d)
  out.push(`decision ${d.id} ${o.passes ? 'passes' : 'fails'} ${o.open ? 'open' : 'closed'}`)
}
for (const s of cases.splits) {
  const r = split(s)
  const tail = r.violations.length ? `violations=${r.violations.sort().join(',')}` : 'ok'
  out.push(`split ${s.id} work=${r.work} reserves=${r.reserves} interest=${r.interest} ${tail}`)
}
console.log(out.sort().join('\n'))
