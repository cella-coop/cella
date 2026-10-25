import type { Db } from '@cella/org-db'

// Whether a power the acting member holds opens a file the file feat's
// own rule keeps closed to them, by `circle_file_membership.opens`.
export async function opens(db: Db, file: string, actor: string | null): Promise<boolean> {
  if (!actor) {
    return false
  }
  const { rows } = await db.query<{ open: boolean }>('SELECT circle_file_membership.opens($1, $2) AS open', [file, actor])
  return rows[0]?.open ?? false
}
