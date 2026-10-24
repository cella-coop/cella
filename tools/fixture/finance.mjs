// fixture check, finance: a mock co-op's capital, surplus allocations, pay
// and expenses are consistent. A capital account is a member's, under
// 1013, and the journal credits it with their shares at the share's value;
// an allocation honours a SCOP's floors (loi n° 78-763, art. 33); every
// salary is a member's, and they keep within the internal rules' ratio; a
// pay run carried over posted exactly its payslips' pay and charges; an
// expense is an active member's, charged to an account of class 6, and
// billed on to a project that exists.

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)

export function finance(read, fail) {
  const members = new Map((read('member').member ?? []).map((m) => [m.address, m]))
  const value = read('member').share_value
  const books = read('account')
  const accounts = new Map((books.account ?? []).map((a) => [a.code, a]))
  const entries = new Map((read('transaction').entry ?? []).map((e) => [e.id, e]))
  const balance = (code) =>
    [...entries.values()].flatMap((e) => e.line).filter((l) => l.account === code).reduce((s, l) => s + (l.credit ?? 0) - (l.debit ?? 0), 0)

  for (const a of accounts.values()) {
    if (a.parent && !accounts.has(a.parent)) {
      fail(`account ${a.code}: its parent ${a.parent} is no account`)
    }
    if (!a.holder) {
      continue
    }
    const m = members.get(a.holder)
    if (!m) {
      fail(`account ${a.code}: ${a.holder} is no member`)
    } else if (a.parent !== '1013') {
      fail(`account ${a.code}: a member's capital account sits under 1013`)
    } else if (balance(a.code) !== m.shares * value) {
      fail(`account ${a.code}: the journal credits it ${balance(a.code)}, not ${m.address}'s ${m.shares} shares at ${value}`)
    }
  }
  for (const a of read('graft.account-member').allowance ?? []) {
    if (!members.has(a.member)) {
      fail(`allowance: ${a.member} is no member`)
    }
  }

  // Art. 33: the work share at least 25 % (3°), the legal reserve 15 % (1°),
  // and interest no more than the reserves nor the work share (4°)
  for (const a of books.allocation ?? []) {
    const of = (kind) => (a.share ?? []).find((s) => s.kind === kind)?.amount ?? 0
    if (of('work') * 4 < a.surplus) {
      fail(`allocation ${a.id}: the work share is under 25 % of the surplus`)
    }
    if (of('legal') * 100 < a.surplus * 15) {
      fail(`allocation ${a.id}: under 15 % goes to the legal reserve`)
    }
    if (of('interest') > of('legal') + of('development') || of('interest') > of('work')) {
      fail(`allocation ${a.id}: interest on capital exceeds the reserves or the work share`)
    }
  }

  const pay = read('payslip')
  const salaries = pay.salary ?? []
  for (const s of salaries) {
    if (!members.has(s.member)) {
      fail(`salary: ${s.member} is no member`)
    }
  }
  const due = (month) => {
    const first = `${month}-01`
    const latest = new Map()
    for (const s of salaries.filter((s) => iso(s.from) <= first).sort((x, y) => iso(x.from).localeCompare(iso(y.from)))) {
      latest.set(s.member, s.gross)
    }
    return [...latest.values()]
  }
  for (const r of pay.run ?? []) {
    const gross = due(r.month)
    if (gross.length && Math.max(...gross) > Math.min(...gross) * pay.terms.ratio) {
      fail(`run ${r.month}: the highest salary is more than ${pay.terms.ratio} times the lowest`)
    }
    if (r.paid && !r.approved) {
      fail(`run ${r.month}: paid before it was approved`)
    }
  }
  for (const p of read('graft.payslip-transaction').posting ?? []) {
    const e = entries.get(p.entry)
    if (!e) {
      fail(`pay posting: no entry ${p.entry}`)
      continue
    }
    const gross = due(p.month).reduce((s, g) => s + g, 0)
    const employer = due(p.month).reduce((s, g) => s + Math.round((g * pay.terms.employer) / 100), 0)
    const on = (account, side) => e.line.filter((l) => l.account === account).reduce((s, l) => s + (l[side] ?? 0), 0)
    if (p.event === 'carried' && (on('641', 'debit') !== gross || on('645', 'debit') !== employer || on('512', 'credit') !== gross + employer || e.line.length !== 3)) {
      fail(`run ${p.month}: ${p.entry} is not its payslips' gross ${gross} and charges ${employer}, paid from 512`)
    }
  }

  const expenses = new Set()
  for (const e of read('expense').expense ?? []) {
    expenses.add(e.id)
    if (members.get(e.member)?.status !== 'active') {
      fail(`expense ${e.id}: ${e.member} is no active member`)
    }
    if (!/^6\d+$/.test(e.category) || !accounts.has(e.category)) {
      fail(`expense ${e.id}: ${e.category} is no account of class 6 in the chart`)
    }
    if (e.submitted && iso(e.submitted) < iso(e.day)) {
      fail(`expense ${e.id}: submitted before it was spent`)
    }
  }
  const projects = new Set((read('project').project ?? []).map((p) => p.id))
  for (const r of read('graft.expense-project').rebill ?? []) {
    if (!expenses.has(r.expense) || !projects.has(r.project)) {
      fail(`rebill: ${r.expense} or ${r.project} does not exist`)
    }
  }
}
