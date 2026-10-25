import type { Db } from '@cella/org-db'
import { summaries } from '@cella/org-decision/api'
import { shown } from '@cella/org-document/api'
import type { Adopting, Asked, OnDecision, OnDocument } from '../models/adoption.ts'

// What decisions ask to adopt: a decision's, or those on a document.
export async function asked(db: Db, by: { decision?: string; document?: string }): Promise<Asked[]> {
  const { rows } = await db.query<Asked>(
    `SELECT a.decision || '/' || a.document AS id, a.decision, d.title, a.document, a.version, encode(a.hash, 'hex') AS hash,
            (SELECT to_char(x.adopted, 'YYYY-MM-DD') FROM document.adoption x
             JOIN document.version v ON v.id = x.version
             WHERE x.document = a.document AND v.hash = a.hash
             ORDER BY x.receipt DESC LIMIT 1) AS adopted
     FROM decision_document.adoption a JOIN decision.decision d ON d.id = a.decision
     WHERE ($1::text IS NULL OR a.decision = $1) AND ($2::text IS NULL OR a.document = $2)
     ORDER BY a.decision DESC`,
    [by.decision ?? null, by.document ?? null],
  )
  return rows
}

// The versions a new decision may adopt, as its New form offers them:
// every saved version of every document, newest first, by its document's
// title.
export async function versions(db: Db): Promise<{ value: string; label: string }[]> {
  const { rows } = await db.query<{ value: string; label: string }>(
    `SELECT v.id AS value, d.title || ', version ' || v.n AS label
     FROM document.version v JOIN document.document d ON d.id = v.document
     ORDER BY d.title, v.n DESC`,
  )
  return rows
}

export async function onDocument(db: Db, document: string): Promise<OnDocument> {
  return { asked: await asked(db, { document }), decisions: await summaries(db) }
}

// A decision's adoptions, each version in full and the version it would
// replace.
export async function onDecision(db: Db, decision: string): Promise<OnDecision> {
  const adopting: Adopting[] = []
  for (const a of await asked(db, { decision })) {
    const v = await shown(db, a.version)
    const { rows } = await db.query<{ title: string; current: string | null }>(
      `SELECT d.title, (SELECT version FROM document.adopted x WHERE x.document = d.id) AS current
       FROM document.document d WHERE d.id = $1`,
      [a.document],
    )
    if (v && rows[0]) {
      adopting.push({ ...a, name: rows[0].title, canonical: v.canonical, current: rows[0].current })
    }
  }
  return { adopting, decisions: await summaries(db), linked: await linked(db, decision) }
}

// The documents a decision's messages link, by the reference each gives:
// a document's id or a version's.
export async function linked(db: Db, decision: string): Promise<OnDecision['linked']> {
  const { rows } = await db.query<{ ref: string; document: string; title: string }>(
    `SELECT DISTINCT l.ref, d.id AS document, d.title
     FROM decision.message m
     CROSS JOIN LATERAL unnest(m.links) AS l(ref)
     JOIN document.document d ON d.id = decision_document.linked(l.ref)
     WHERE m.decision = $1`,
    [decision],
  )
  return Object.fromEntries(rows.map((r) => [r.ref, { document: r.document, title: r.title }]))
}
