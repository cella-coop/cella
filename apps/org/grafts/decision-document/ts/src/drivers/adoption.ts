import type { Db } from '@cella/org-db'
import type { Asked } from '../models/adoption.ts'

// What decisions ask to adopt: a decision's, or those on a document.
export async function asked(db: Db, by: { decision?: string; document?: string }): Promise<Asked[]> {
  const { rows } = await db.query<Asked>(
    `SELECT a.decision || '/' || a.document AS id, a.decision, d.title, a.document, a.version,
            (SELECT to_char(x.adopted, 'YYYY-MM-DD') FROM document.adoption x WHERE x.document = a.document AND x.version = a.version
             ORDER BY x.receipt DESC LIMIT 1) AS adopted
     FROM decision_document.adoption a JOIN decision.decision d ON d.id = a.decision
     WHERE ($1::text IS NULL OR a.decision = $1) AND ($2::text IS NULL OR a.document = $2)
     ORDER BY a.decision DESC`,
    [by.decision ?? null, by.document ?? null],
  )
  return rows
}
