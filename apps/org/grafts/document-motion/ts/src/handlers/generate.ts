import { done, type Deps, type Done } from '@cella/org-db'
import { generate } from '@cella/org-document/api'

// What follows a policy's adoption or ending: each document generated
// from the policies of its circle, as the statutes are from the root
// circle's, is generated anew by the document feat's write, a write of
// its own signed by whoever signed the adoption or the ending and citing
// the motion, from the policies in force on the day the adopted policy
// applies or the ended one ends. A circle no document is generated from
// makes no write.
export async function changed(request: unknown, deps: Deps): Promise<Done[]> {
  const { motion, n } = request as { motion: string; n: number }
  const action = `${motion}/${n}`
  const { rows } = await deps.db.query<{ document: string; day: string }>(
    `SELECT g.document, to_char(CASE WHEN p.id = $1 THEN p.applies ELSE p.ends END, 'YYYY-MM-DD') AS day
     FROM policy.policy p JOIN document.generated g ON g.circle = p.circle
     WHERE p.id = $1 OR p.ended_by = $1
     ORDER BY g.document`,
    [action],
  )
  const out: Done[] = []
  for (const r of rows) {
    const input = { document: r.document, motion, day: r.day }
    out.push(done('document:document:generate', await generate(input, deps), [], input))
  }
  return out
}
