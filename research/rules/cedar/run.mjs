// Builds Cedar entities from the fact base and asks the cedar CLI for each
// case. The host does what Cedar cannot: it flattens time-bounded positions
// to the ones held on the request day, and sums payments and entry lines.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const here = new URL('.', import.meta.url).pathname
const cedar = process.env.CEDAR ?? 'cedar'
const read = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'))
const facts = read('../facts/lanterne.json')
const cases = read('../facts/cases.json')
const scratch = mkdtempSync(join(process.env.SCRATCH ?? tmpdir(), 'cedar-'))

const uid = (type, id) => ({ type, id })
const sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0)

const entities = (at) => {
  const held = facts.positions.filter((p) => (p.since ?? at) <= at && at < (p.until ?? '9999-12-31'))
  const members = facts.members.map((m) => {
    const mine = held.filter((p) => p.member === m.id)
    const parents = [
      ...new Set(mine.map((p) => p.circle)).values().map((c) => uid('Circle', c)),
      ...new Set(mine.filter((p) => p.role).map((p) => p.role)).values().map((r) => uid('Role', r)),
    ]
    const leads = mine.filter((p) => p.role === 'lead').map((p) => uid('Circle', p.circle))
    return { uid: uid('Member', m.id), attrs: { leads }, parents }
  })
  return [
    ...['manager', 'finance', 'lead'].map((r) => ({ uid: uid('Role', r), attrs: {}, parents: [] })),
    ...facts.circles.map((c) => ({ uid: uid('Circle', c.id), attrs: {}, parents: [] })),
    ...members,
    { uid: uid('Org', 'lanterne'), attrs: {}, parents: [] },
    { uid: uid('Surplus', '2025'), attrs: {}, parents: [] },
    ...facts.decisions.map((d) => ({
      uid: uid('Decision', d.id),
      attrs: { circle: { __entity: uid('Circle', d.circle) } },
      parents: [],
    })),
    ...facts.periods.map((p) => ({ uid: uid('Period', p.month), attrs: { closed: p.closed !== null }, parents: [] })),
    // a month with no period record is treated as closed
    ...['2026-06', '2026-11'].map((m) => ({ uid: uid('Period', m), attrs: { closed: true }, parents: [] })),
    ...facts.invoices.map((i) => ({
      uid: uid('Invoice', i.id),
      attrs: { total: i.total, paid: sum(i.payments, (p) => p.amount), voided: i.voided !== null },
      parents: [],
    })),
  ]
}

let n = 0
const ask = (at, principal, action, resource, context) => {
  const dir = join(scratch, String(n++))
  const files = { e: `${dir}-entities.json`, c: `${dir}-context.json` }
  writeFileSync(files.e, JSON.stringify(entities(at)))
  writeFileSync(files.c, JSON.stringify(context))
  let text
  try {
    text = execFileSync(cedar, [
      'authorize', '-v', '-f', 'plain',
      '--policies', join(here, 'policies.cedar'),
      '--schema', join(here, 'lanterne.cedarschema'),
      '--entities', files.e, '--context', files.c,
      '--principal', `Member::"${principal}"`,
      '--action', `Action::"${action}"`,
      '--resource', resource,
    ], { encoding: 'utf8' })
  } catch (e) {
    // the CLI exits 2 on DENY
    text = e.stdout
  }
  const allow = text.trimStart().startsWith('ALLOW')
  const forbids = [...text.matchAll(/^ {2}(\w+)$/gm)].map((m) => m[1])
  return { allow, forbids, text }
}

const out = []
for (const r of cases.requests) {
  const resource =
    r.action === 'spend' ? `Circle::"${r.circle}"`
    : r.action === 'vote' ? `Decision::"${r.decision}"`
    : 'Org::"lanterne"'
  const context = r.amount !== undefined ? { amount: r.amount } : {}
  out.push(`request ${r.id} ${ask(r.at, r.member, r.action, resource, context).allow ? 'allow' : 'deny'}`)
}

const finance = 'julien@lanterne.example'
const verdict = ({ allow, forbids }) => (allow ? 'ok' : `refused ${forbids.sort().join(',')}`)
for (const w of cases.writes) {
  const res =
    w.kind === 'entry'
      ? ask(facts.today, finance, 'post_entry', `Period::"${w.date.slice(0, 7)}"`, {
          debit: sum(w.lines, (l) => l.debit),
          credit: sum(w.lines, (l) => l.credit),
        })
      : ask(facts.today, finance, 'record_payment', `Invoice::"${w.invoice}"`, { amount: w.amount })
  out.push(`write ${w.id} ${verdict(res)}`)
}
for (const s of cases.splits) {
  const res = ask(facts.today, finance, 'allocate_surplus', 'Surplus::"2025"', {
    work: s.work, reserves: s.reserves, interest: s.interest,
  })
  out.push(`split ${s.id} ${res.allow ? 'ok' : `violations=${res.forbids.sort().join(',')}`}`)
}
console.log(out.sort().join('\n'))
