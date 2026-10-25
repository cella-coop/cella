import type { Db } from '@cella/org-db'
import type { Figures, Gathered, Rubric, Statements } from '../models/statement.ts'

type Sheet = 'income' | 'balance'
interface Span {
  since: string | null
  until: string
}

// A sheet over a span, rubric by rubric, and each account's figure on it,
// from `account_transaction.statement` and `figures`. The balance sheet
// takes every entry up to the span's last day.
async function sheet(db: Db, kind: Sheet, span: Span) {
  const since = kind === 'balance' ? null : span.since
  const { rows } = await db.query<{ id: string; kind: Rubric['kind']; label: string; amount: string | null }>(
    'SELECT id, kind, label, amount FROM account_transaction.statement($1, $2, $3)',
    [kind, since, span.until],
  )
  const { rows: accounts } = await db.query<{ rubric: string; code: string; label: string; amount: string }>(
    'SELECT rubric, code, label, amount FROM account_transaction.figures($1, $2, $3)',
    [kind, since, span.until],
  )
  return { rows, accounts }
}

// One sheet over the span and the span before, side by side: each rubric
// with its two figures, and a line's accounts with theirs; a line nothing
// posted to in either is left out.
async function compared(db: Db, kind: Sheet, now: Span, before: Span): Promise<Rubric[]> {
  const a = await sheet(db, kind, now)
  const b = await sheet(db, kind, before)
  const was = new Map(b.rows.map((r) => [r.id, r.amount]))
  const gathered = new Map<string, Map<string, Gathered>>()
  for (const [i, set] of [a.accounts, b.accounts].entries()) {
    for (const f of set) {
      const lines = gathered.get(f.rubric) ?? new Map<string, Gathered>()
      const g = lines.get(f.code) ?? { code: f.code, label: f.label, href: `/accounts/${f.code}`, amounts: [0, 0] }
      g.amounts[i] = Number(f.amount)
      lines.set(f.code, g)
      gathered.set(f.rubric, lines)
    }
  }
  return a.rows.flatMap((r) => {
    const accounts = [...(gathered.get(r.id)?.values() ?? [])].sort((x, y) => x.code.localeCompare(y.code))
    const amounts = [r.amount, was.get(r.id) ?? null].map((x) => (x === null ? null : Number(x)))
    if (r.kind === 'line' && !accounts.length) {
      return []
    }
    return [{ id: r.id, kind: r.kind, label: r.label, amounts, ...(r.kind === 'line' ? { accounts } : {}) }]
  })
}

// A span's statements against the span before it.
export async function statements(db: Db, id: string): Promise<Statements | null> {
  const { rows } = await db.query<{ since: string; until: string; before: string; before_since: string; before_until: string }>(
    `SELECT to_char(since, 'YYYY-MM-DD') AS since, to_char(until, 'YYYY-MM-DD') AS until, before,
       to_char(before_since, 'YYYY-MM-DD') AS before_since, to_char(before_until, 'YYYY-MM-DD') AS before_until
     FROM account.report WHERE id = $1`,
    [id],
  )
  const r = rows[0]
  if (!r) {
    return null
  }
  const now = { since: r.since, until: r.until }
  const before = { since: r.before_since, until: r.before_until }
  return { columns: [id, r.before], income: await compared(db, 'income', now, before), balance: await compared(db, 'balance', now, before) }
}

// Each span's result and its total assets, by span, nought where its sheet
// has no such figure.
export const figured = `SELECT r.id,
    coalesce((SELECT s.amount FROM account_transaction.statement('income', r.since, r.until) s WHERE s.id = 'result'), 0) AS result,
    coalesce((SELECT s.amount FROM account_transaction.statement('balance', NULL, r.until) s WHERE s.id = 'assets-total'), 0) AS assets
  FROM account.report r`

export async function figures(db: Db): Promise<Record<string, Figures>> {
  const { rows } = await db.query<{ id: string; result: string; assets: string }>(figured)
  return Object.fromEntries(rows.map((r) => [r.id, { result: Number(r.result), assets: Number(r.assets) }]))
}
