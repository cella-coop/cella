// Runs the same rules.toml in JavaScript with @marcbachmann/cel-js, as a
// browser would: one rule text, two independent CEL implementations.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { Environment } from '@marcbachmann/cel-js'

const here = new URL('.', import.meta.url).pathname
const read = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'))
const rules = parse(readFileSync(join(here, 'rules.toml'), 'utf8'))
const facts = read('../facts/lanterne.json')
const cases = read('../facts/cases.json')

// CEL ints are BigInts here
const big = (v) =>
  typeof v === 'number' ? BigInt(v)
  : Array.isArray(v) ? v.map(big)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, big(x)]))
  : v

const env = new Environment({ unlistedVariablesAreDyn: true, homogeneousAggregateLiterals: false })
  .registerFunction('sum(list): int', (xs) => xs.reduce((a, b) => a + b, 0n))
const f = big(facts)
const run = (group, name, vars) => env.evaluate(rules[group][name], vars)

const out = []
for (const r of cases.requests) {
  const request = big({ amount: 0, circle: '', decision: '', ...r })
  const ok = run('permission', 'allowed', { request, positions: f.positions, mandates: f.mandates, decisions: f.decisions })
  out.push(`request ${r.id} ${ok ? 'allow' : 'deny'}`)
}
const verdict = (xs) => (xs.length ? `refused ${[...xs].sort().join(',')}` : 'ok')
for (const w of cases.writes) {
  const v =
    w.kind === 'entry'
      ? run('invariant', 'entry_faults', { entry: big(w), periods: f.periods })
      : run('invariant', 'payment_faults', { invoice: f.invoices.find((i) => i.id === w.invoice), amount: big(w.amount) })
  out.push(`write ${w.id} ${verdict(v)}`)
}

const listed = (ids) => (ids.length ? ids.join(',') : 'ok')
const openPeriods = f.periods.map((p) => ({ month: p.month, closed: null }))
const unbalanced = f.entries.filter((e) => run('invariant', 'entry_faults', { entry: e, periods: openPeriods }).length)
const faults = (i) => run('invariant', 'payment_faults', { invoice: i, amount: 0n })
out.push(`check balance ${listed(unbalanced.map((e) => e.id))}`)
out.push(`check overpaid ${listed(f.invoices.filter((i) => faults(i).includes('overpaid')).map((i) => i.id))}`)
out.push(`check voided ${listed(f.invoices.filter((i) => faults(i).includes('voided') && i.payments.length).map((i) => i.id))}`)

for (const d of f.decisions) {
  const counted = run('procedure', 'counted', { decision: d, positions: f.positions })
  const passes = run('procedure', 'passes', { decision: d, counted })
  const open = run('procedure', 'open', { decision: d, today: f.today })
  out.push(`decision ${d.id} ${passes ? 'passes' : 'fails'} ${open ? 'open' : 'closed'}`)
}
for (const s of cases.splits) {
  const a = run('computation', 'surplus', { split: big(s) })
  const v = [...a.get?.('violations') ?? a.violations].sort()
  const get = (k) => a.get?.(k) ?? a[k]
  out.push(
    `split ${s.id} work=${get('work')} reserves=${get('reserves')} interest=${get('interest')} ` +
      (v.length ? `violations=${v.join(',')}` : 'ok'),
  )
}
console.log(out.sort().join('\n'))
