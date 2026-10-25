import type { Db } from '@cella/org-db'
import type { Employed, Figure, Movement, Owed } from '../models/patronage.ts'

// What a worker's part became once it was distributed, by their
// statement's id: the shares it bought and the cash it left, and the lines
// of their capital account with the balance after each.
export async function employed(db: Db, statement: string): Promise<Employed | null> {
  const { rows } = await db.query<{ part: string; worker: string; shares: number | null; capital: string | null; until: string | null; account: string | null; entry: string | null }>(
    `SELECT s.amount AS part, s.worker, c.shares, cella.cents(c.amount) AS capital, to_char(c.until, 'YYYY-MM-DD') AS until, c.account, c.entry
     FROM patronage.statement s
     JOIN patronage.distribution d ON d.id = s.distribution AND d.distributed IS NOT NULL
     LEFT JOIN account_membership_patronage_transaction.credit c ON c.distribution = s.distribution AND c.member = s.worker
     WHERE s.id = $1`,
    [statement],
  )
  const s = rows[0]
  if (!s) {
    return null
  }
  const lines = await db.query<Movement>(
    `SELECT l.entry || '/' || l.n AS id, l.entry, to_char(e.date, 'YYYY-MM-DD') AS date, e.label, l.side, cella.cents(l.amount)::float8 AS amount,
       sum(CASE l.side WHEN 'credit' THEN cella.cents(l.amount) ELSE -cella.cents(l.amount) END)
         OVER (ORDER BY e.date, l.entry, l.n)::float8 AS balance
     FROM transaction.line l
     JOIN transaction.entry e ON e.id = l.entry
     JOIN account.account a ON a.code = l.account AND a.parent = '1013' AND a.holder = $1
     ORDER BY e.date, l.entry, l.n`,
    [s.worker],
  )
  const capital = Number(s.capital ?? 0)
  return {
    part: Number(s.part),
    shares: s.shares ?? 0,
    capital,
    cash: Number(s.part) - capital,
    until: s.until,
    account: s.account,
    entry: s.entry,
    movements: lines.rows,
  }
}

// The figures of a distributed year a SCOP reports to its federation, from
// the books and the members. The surplus and its split answer to loi n°
// 78-763, art. 33, the work share's division and what it employs in shares
// to the Code du travail; which figures the CG SCOP's annual return and the
// révision coopérative ask for was not verified against their forms, and
// the employees' hold on the capital not against the article that sets it.
// They are the co-op's, which `federation` sums whole for every reader.
export async function figures(db: Db, distribution: string): Promise<Figure[]> {
  const { rows } = await db.query<Record<string, string | null>>(
    'SELECT * FROM account_membership_patronage_transaction.federation($1)',
    [distribution],
  )
  const r = rows[0]
  if (!r) {
    return []
  }
  const n = (k: string) => Number(r[k] ?? 0)
  const art33 = 'loi n° 78-763, art. 33'
  const unverified = 'asked for by the federation: not verified against its forms'
  return [
    { id: 'surplus', label: 'Surplus (excédents nets de gestion)', value: n('surplus'), unit: 'cents', source: art33, verified: true },
    { id: 'legal', label: 'To the legal reserve (réserve légale)', value: n('legal'), unit: 'cents', source: `${art33}, 1°`, verified: true },
    { id: 'development', label: 'To the development fund (fonds de développement)', value: n('development'), unit: 'cents', source: `${art33}, 2°`, verified: true },
    { id: 'work', label: 'Work share (part travailleurs)', value: n('work'), unit: 'cents', source: `${art33}, 3°`, verified: true },
    { id: 'interest', label: 'Interest on capital (intérêts aux parts)', value: n('interest'), unit: 'cents', source: `${art33}, 4°; loi n° 47-1775, art. 14`, verified: true },
    { id: 'workers', label: 'Workers sharing the work share', value: n('workers'), unit: 'count', source: `${art33}, 3°; BOI-BIC-PTP-10-30, § 90`, verified: true },
    { id: 'associates_sharing', label: 'Of whom associates', value: n('associates_sharing'), unit: 'count', source: 'Code du travail, art. R3323-11', verified: true },
    { id: 'employed', label: 'Work share employed in shares', value: n('employed'), unit: 'cents', source: 'Code du travail, art. R3323-11', verified: true },
    { id: 'shares', label: 'Shares issued from the work share', value: n('shares'), unit: 'count', source: 'Code du travail, art. R3323-11', verified: true },
    { id: 'until', label: 'Those shares blocked until', value: r.until, unit: 'date', source: 'Code du travail, art. L3324-10', verified: true },
    { id: 'cash', label: 'Work share owed in cash', value: n('work') - n('employed'), unit: 'cents', source: 'Code du travail, art. L3324-10', verified: true },
    { id: 'reserve', label: 'Legal reserve after the distribution', value: n('reserve'), unit: 'cents', source: `${art33}, 1°`, verified: true },
    { id: 'highest', label: 'Highest capital reached', value: n('highest'), unit: 'cents', source: `${art33}, 1°`, verified: true },
    { id: 'associates', label: 'Associates today', value: n('associates'), unit: 'count', source: unverified, verified: false },
    { id: 'capital', label: 'Capital subscribed today', value: n('capital'), unit: 'cents', source: unverified, verified: false },
    {
      id: 'employee_capital',
      label: 'Capital held by associates employed',
      value: n('capital') ? Math.round((n('employee_capital') * 10000) / n('capital')) / 100 : 0,
      unit: 'percent',
      source: 'at least 51 % (justice.fr); its article unverified',
      verified: false,
    },
  ]
}

// A member's statements, the latest year first, for the member alone: a
// member's part of the work share is payroll, theirs to see on their own
// page; finance reads every statement in the collection. What a part
// employs in shares and pays is what was credited once it is distributed,
// and what the terms give it today until then.
export async function owed(db: Db, member: string, actor: string | null): Promise<Owed[]> {
  if (actor !== member) {
    return []
  }
  const { rows } = await db.query<Owed>(
    `SELECT s.distribution || ':' || s.worker AS id, s.distribution, s.year, s.part::float8 AS part,
       coalesce(c.shares, s.shares) AS shares, coalesce(cella.cents(c.amount), s.capital)::float8 AS capital,
       (s.part - coalesce(cella.cents(c.amount), s.capital))::float8 AS cash, d.distributed IS NOT NULL AS distributed
     FROM account_membership_patronage.split s
     JOIN patronage.distribution d ON d.id = s.distribution
     LEFT JOIN account_membership_patronage_transaction.credit c ON c.distribution = s.distribution AND c.member = s.worker
     WHERE s.worker = $1 ORDER BY s.year DESC`,
    [member],
  )
  return rows
}
