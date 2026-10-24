// Lanterne's rules as plain TypeScript functions over the fact base.
// Money is integer cents, percentages are basis points, dates are ISO days.

export type Day = string
export type Position = { member: string; circle: string; role: string | null; since: Day | null; until: Day | null }
export type Mandate = { role: string; action: string; max: number | null; own_circle: boolean }
export type Vote = { seq: number; member: string; stance: string; at: Day }
export type Decision = { id: string; circle: string; rule: string; deadline: Day; closed: Day | null; votes: Vote[] }
export type Line = { account: string; debit: number; credit: number }
export type Entry = { id?: string; date: Day; lines: Line[] }
export type Payment = { at: Day; amount: number }
export type Invoice = { id: string; total: number; voided: Day | null; payments: Payment[] }
export type Facts = {
  today: Day
  positions: Position[]
  mandates: Mandate[]
  decisions: Decision[]
  periods: { month: string; closed: Day | null }[]
  entries: Entry[]
  invoices: Invoice[]
}
export type Request = { member: string; action: string; amount?: number; circle?: string; decision?: string; at: Day }

const holds = (p: Position, at: Day) => (p.since ?? at) <= at && at < (p.until ?? '9999-12-31')

// Rule 1: mandates, and votes by members of the deciding circle
export const allowed = (f: Facts, r: Request): boolean => {
  const mine = f.positions.filter((p) => p.member === r.member && holds(p, r.at))
  if (r.action === 'vote') {
    const d = f.decisions.find((d) => d.id === r.decision)
    return d !== undefined && mine.some((p) => p.circle === d.circle)
  }
  return f.mandates.some(
    (m) =>
      m.action === r.action &&
      (m.max === null || (r.amount ?? 0) <= m.max) &&
      mine.some((p) => p.role === m.role && (!m.own_circle || p.circle === r.circle)),
  )
}

// Rule 2: invariants on a proposed write; returns the broken ones
export const entryFaults = (f: Facts, e: Entry): string[] => {
  const faults: string[] = []
  const period = f.periods.find((p) => p.month === e.date.slice(0, 7))
  if (!period || period.closed !== null) {
    faults.push('closed_period')
  }
  const debit = e.lines.reduce((s, l) => s + l.debit, 0)
  const credit = e.lines.reduce((s, l) => s + l.credit, 0)
  if (debit !== credit) {
    faults.push('unbalanced')
  }
  return faults
}

export const paymentFaults = (inv: Invoice, amount: number): string[] => {
  const faults: string[] = []
  if (inv.voided !== null) {
    faults.push('voided')
  }
  const paid = inv.payments.reduce((s, p) => s + p.amount, 0)
  if (paid + amount > inv.total) {
    faults.push('overpaid')
  }
  return faults
}

// Rule 3: outcomes from each eligible member's latest stance before the deadline
const latest = (f: Facts, d: Decision): Map<string, string> => {
  const voters = new Set(f.positions.filter((p) => p.circle === d.circle).map((p) => p.member))
  const stances = new Map<string, string>()
  const counted = d.votes.filter((v) => v.at <= d.deadline && voters.has(v.member)).sort((a, b) => a.seq - b.seq)
  for (const v of counted) {
    stances.set(v.member, v.stance)
  }
  return stances
}

export const outcome = (f: Facts, d: Decision): { passes: boolean; open: boolean } => {
  const stances = [...latest(f, d).values()]
  const count = (s: string) => stances.filter((x) => x === s).length
  const passes =
    d.rule === 'consent'
      ? count('block') + count('object') === 0
      : count('for') > count('against')
  return { passes, open: d.closed === null && f.today < d.deadline }
}

// Rule 4: the SCOP surplus split; reserves take the rounding remainder
export type Split = { surplus: number; work: number; reserves: number; interest: number }

export const split = (s: Split) => {
  const work = Math.floor((s.surplus * s.work) / 10000)
  const interest = Math.floor((s.surplus * s.interest) / 10000)
  const reserves = s.surplus - work - interest
  const violations: string[] = []
  const rules: [boolean, string][] = [
    [s.work + s.reserves + s.interest === 10000, 'sum'],
    [s.work >= 2500, 'work_min'],
    [s.reserves >= 1600, 'reserves_min'],
    [s.interest <= 3300, 'interest_max'],
    [s.interest <= s.work, 'interest_le_work'],
    [s.interest <= s.reserves, 'interest_le_reserves'],
  ]
  for (const [ok, name] of rules) {
    if (!ok) {
      violations.push(name)
    }
  }
  return { work, reserves, interest, violations }
}
