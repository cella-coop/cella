import type { Db } from '@cella/org-db'

// Adds, inside another write's transaction, shares to what an active
// member holds, and returns what they hold after; a member who is not
// active on the verdict date is refused. It is no action of its own: the
// write that runs it and its guards decide how many, as a credit of the
// shares a part of the work share buys does.
export async function crediting(tx: Db, member: string, shares: number): Promise<number> {
  const { rows } = await tx.query<{ shares: number }>(
    `UPDATE membership.member SET shares = shares + $2
     WHERE address = $1 AND membership.active(address, cella.verdict_date())
     RETURNING shares`,
    [member, shares],
  )
  if (!rows[0]) {
    throw new Error(`${member} is no active member to credit shares to`)
  }
  return rows[0].shares
}
