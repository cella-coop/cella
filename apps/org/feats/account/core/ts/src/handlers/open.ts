import type { Db } from '@cella/org-db'
import type { Open } from '../models/account.ts'

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
