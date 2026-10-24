// Writes the fact base as Soufflé .facts files, runs rules.dl and formats
// the derived relations into the shared output.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const here = new URL('.', import.meta.url).pathname
const souffle = process.env.SOUFFLE ?? 'souffle'
const read = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'))
const facts = read('../facts/lanterne.json')
const cases = read('../facts/cases.json')
const work = join(process.env.SCRATCH ?? here, 'souffle')
const [inDir, outDir] = [join(work, 'facts'), join(work, 'out')]
mkdirSync(inDir, { recursive: true })
mkdirSync(outDir, { recursive: true })

const num = (d, none) => (d == null ? none : Number(d.replaceAll('-', '')))
const big = 2000000000
const rel = {
  today: [[num(facts.today)]],
  position: facts.positions.map((p) => [p.member, p.circle, p.role ?? '', num(p.since, 0), num(p.until, 99991231)]),
  mandate: facts.mandates.map((m) => [m.role, m.action, m.max ?? big, m.own_circle ? 1 : 0]),
  decision: facts.decisions.map((d) => [d.id, d.circle, d.rule, num(d.deadline), d.closed ? 1 : 0]),
  vote: facts.decisions.flatMap((d) => d.votes.map((v) => [d.id, v.seq, v.member, v.stance, num(v.at)])),
  period: facts.periods.map((p) => [p.month, p.closed ? 1 : 0]),
  entry: [],
  line: [],
  invoice: facts.invoices.map((i) => [i.id, i.total, i.voided ? 1 : 0]),
  payment: facts.invoices.flatMap((i) => i.payments.map((p, n) => [i.id, n, p.amount])),
  request: cases.requests.map((r) => [
    r.id, r.member, r.action, r.amount ?? 0, r.circle ?? '', r.decision ?? '', num(r.at),
  ]),
  proposed: [],
  write_payment: [],
  split: cases.splits.map((s) => [s.id, s.surplus, s.work, s.reserves, s.interest]),
}
const addEntry = (id, date, lines) => {
  rel.entry.push([id, date.slice(0, 7)])
  lines.forEach((l, n) => rel.line.push([id, n, l.debit, l.credit]))
}
facts.entries.forEach((e) => addEntry(e.id, e.date, e.lines))
for (const w of cases.writes) {
  if (w.kind === 'entry') {
    rel.proposed.push([w.id])
    addEntry(w.id, w.date, w.lines)
  } else {
    rel.write_payment.push([w.id, w.invoice, w.amount])
  }
}
for (const [name, rows] of Object.entries(rel)) {
  writeFileSync(join(inDir, `${name}.facts`), rows.map((r) => r.join('\t')).join('\n') + (rows.length ? '\n' : ''))
}

writeFileSync(
  join(here, 'analysis.txt'),
  execFileSync(souffle, ['-F', inDir, '-D', outDir, join(here, 'rules.dl')], { encoding: 'utf8' }),
)
const rows = (name) =>
  readFileSync(join(outDir, `${name}.csv`), 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t'))

const out = []
const allowed = new Set(rows('allow').map((r) => r[0]))
for (const r of cases.requests) {
  out.push(`request ${r.id} ${allowed.has(r.id) ? 'allow' : 'deny'}`)
}
const faults = Map.groupBy(rows('fault'), (r) => r[0])
const listOf = (id) => (faults.get(id) ?? []).map((r) => r[1]).sort()
for (const w of cases.writes) {
  const f = listOf(w.id)
  out.push(`write ${w.id} ${f.length ? `refused ${f.join(',')}` : 'ok'}`)
}
const listed = (ids) => (ids.length ? ids.sort().join(',') : 'ok')
out.push(`check balance ${listed(facts.entries.filter((e) => listOf(e.id).includes('unbalanced')).map((e) => e.id))}`)
out.push(`check overpaid ${listed(rows('overpaid').map((r) => r[0]))}`)
out.push(`check voided ${listed(rows('void_paid').map((r) => r[0]))}`)

const passes = new Set(rows('passes').map((r) => r[0]))
const open = new Set(rows('open').map((r) => r[0]))
for (const d of facts.decisions) {
  out.push(`decision ${d.id} ${passes.has(d.id) ? 'passes' : 'fails'} ${open.has(d.id) ? 'open' : 'closed'}`)
}
const alloc = new Map(rows('allocation').map((r) => [r[0], r]))
const violations = Map.groupBy(rows('violation'), (r) => r[0])
for (const s of cases.splits) {
  const [, w, r, i] = alloc.get(s.id)
  const v = (violations.get(s.id) ?? []).map((x) => x[1]).sort()
  out.push(`split ${s.id} work=${w} reserves=${r} interest=${i} ${v.length ? `violations=${v.join(',')}` : 'ok'}`)
}
console.log(out.sort().join('\n'))
