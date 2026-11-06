import type { Analytics, Reader } from './report.ts'

// What the port asks of the reader's connection: the server's, which
// reads as the signed-in person.
export interface Asked {
  query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: R[] }>
}

// The reader of `db` and, for each view, the owning circles their mandates
// open its rows in: those `circle.reads` names for the feats its schema is
// of, the row-level policies' own test; for each feat that names powers
// reading its rows, the circles those of the reader's cover, which open a
// counted view's contributions; and open books' disclosure values on the
// verdict date, null where no rule stands.
const READER = `
  SELECT cella.reader() AS person,
         (SELECT coalesce(jsonb_object_agg(v, to_jsonb(circle.reads(string_to_array(split_part(v, '.', 1), '_')))), '{}')
          FROM unnest($1::text[]) v) AS circles,
         (SELECT coalesce(jsonb_object_agg(g.what, to_jsonb(cella.circles(g.what))), '{}')
          FROM (SELECT DISTINCT r.what FROM cella.reading r WHERE r.key IS NULL) g) AS opens,
         (SELECT jsonb_build_object('contributors', d.contributors, 'largest', d.largest, 'two', d.two)
          FROM circle.disclosed(cella.verdict_date()) d) AS disclosure`

export async function reader(db: Asked, views: string[]): Promise<Reader> {
  const { rows } = await db.query<Reader>(READER, [[...new Set(views)]])
  const r = rows[0]
  return {
    ...r,
    disclosure: r.disclosure ? { contributors: Number(r.disclosure.contributors), largest: Number(r.disclosure.largest), two: Number(r.disclosure.two) } : null,
  }
}

// The port as the reader of `db` reads it: each run names them, the
// circles they read each of its views in, asked of Postgres as them, so a
// scoped view reads only the rows the app would show them, and what opens
// a counted view's cells to them, so it reads only those it may.
export function scoped(port: Analytics, db: Asked): Analytics {
  return {
    catalog: () => port.catalog(),
    run: async (report) => port.run({ ...report, reader: await reader(db, Object.values(report.from ?? {})) }),
  }
}
