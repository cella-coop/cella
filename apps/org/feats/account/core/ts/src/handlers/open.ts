import type { Db } from '@cella/org-db'
import type { Hold, Open } from '../models/account.ts'

// Opens, inside a write's transaction, the accounts the chart lacks, each
// of the kind its code's class makes it (`account.kind_of`) and under the
// longest code the chart holds that begins its own, as 512 holds 5121; a
// code of no class of the books is left out. Returns the codes opened.
// The write that posts an imported entry opens the accounts it names so.
export async function opening(tx: Db, accounts: Open[]): Promise<string[]> {
  const opened: string[] = []
  for (const a of accounts) {
    const { rows } = await tx.query<{ code: string }>(
      `INSERT INTO account.account (code, label, kind, parent)
       SELECT $1, $2, account.kind_of($1),
              (SELECT p.code FROM account.account p WHERE $1 LIKE p.code || '%' AND p.code <> $1 ORDER BY length(p.code) DESC LIMIT 1)
       WHERE account.kind_of($1) IS NOT NULL AND NOT EXISTS (SELECT FROM account.account a WHERE a.code = $1)
       RETURNING code`,
      [a.code, a.label],
    )
    opened.push(...rows.map((r) => r.code))
  }
  return opened
}

// Opens, inside a write's transaction, a capital account for its holder:
// the next code under `parent`, at least two digits after it (`101312`
// under `1013`, `1013100` after `101399`), of the parent's kind, with
// the label the write gives it.
// Returns its code. A subscription opens a member's account so.
export async function holding(tx: Db, input: Hold): Promise<string> {
  const { rows } = await tx.query<{ code: string }>(
    `INSERT INTO account.account (code, label, kind, parent, holder)
     SELECT p.code || lpad(x.next::text, greatest(2, length(x.next::text)), '0'), $2, p.kind, p.code, $3
     FROM account.account p
     CROSS JOIN LATERAL (
       SELECT coalesce(max(substr(a.code, length(p.code) + 1)::integer), 0) + 1 AS next
       FROM account.account a WHERE a.parent = p.code AND a.code ~ ('^' || p.code || '[0-9]{2,}$')
     ) x
     WHERE p.code = $1
     RETURNING code`,
    [input.parent, input.label, input.holder],
  )
  if (!rows[0]) {
    throw new Error(`the chart holds no ${input.parent} to open a capital account under`)
  }
  return rows[0].code
}
