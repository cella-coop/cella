import type { Db } from '@cella/org-db'
import type { Instalment, Plan, Withheld } from '../models/plan.ts'

// A member's plan: their instalments and what each month's pay withheld,
// what they still owe, and the most instalments the statutes allow.
export async function plan(db: Db, member: string, actor: string | null): Promise<Plan> {
  const { rows } = await db.query<{ instalments: number | null; each: string | null; since: string | null; unpaid: string | null; allowed: number | null }>(
    `SELECT p.instalments, cella.cents(p.each) AS each, to_char(p.since, 'YYYY-MM-DD') AS since, c.unpaid,
            (SELECT t.instalments FROM account.terms t WHERE t.id = account.capital_for(cella.verdict_date())) AS allowed
     FROM (SELECT $1::text AS member) x
     LEFT JOIN account_member_payslip_transaction.plan p ON p.member = x.member
     LEFT JOIN account_member_transaction.called c ON c.member = x.member`,
    [member],
  )
  const withheld = await db.query<Instalment>(
    `SELECT w.month || '~' || w.member AS id, w.month, cella.cents(w.amount)::float8 AS amount, w.entry
     FROM account_member_payslip_transaction.withheld w WHERE w.member = $1 ORDER BY w.month DESC`,
    [member],
  )
  const p = rows[0]
  return {
    instalments: p?.instalments ?? null,
    each: p?.each == null ? null : Number(p.each),
    since: p?.since ?? null,
    unpaid: Math.max(Number(p?.unpaid ?? 0), 0),
    allowed: p?.allowed ?? null,
    own: actor === member,
    withheld: withheld.rows,
  }
}

// What a payslip's pay withheld, by its id, `<month>~<member>`, and the
// net it was withheld from.
export async function withheld(db: Db, id: string): Promise<Withheld | null> {
  const [month, member] = id.split('~')
  const { rows } = await db.query<Withheld>(
    `SELECT cella.cents(w.amount)::float8 AS amount, w.entry, cella.cents(s.net)::float8 AS net
     FROM account_member_payslip_transaction.withheld w
     LEFT JOIN payslip.payslip s ON s.month = w.month AND s.member = w.member
     WHERE w.month = $1 AND w.member = $2`,
    [month, member],
  )
  return rows[0] ?? null
}
