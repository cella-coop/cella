import type { Analytics, Reader } from './report.ts'

// What the port asks of the reader's connection: the server's, which
// reads as the signed-in person.
export interface Asked {
  query<R = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: R[] }>
}

// The reader of `db` and, for each view, the owning circles their mandates
// open its rows in: those `circle.reads` names for the feats its schema is
// of, the row-level policies' own test.
const READER = `
  SELECT cella.reader() AS person,
         (SELECT coalesce(jsonb_object_agg(v, to_jsonb(circle.reads(string_to_array(split_part(v, '.', 1), '_')))), '{}')
          FROM unnest($1::text[]) v) AS circles`

export async function reader(db: Asked, views: string[]): Promise<Reader> {
  const { rows } = await db.query<Reader>(READER, [[...new Set(views)]])
  return rows[0]
}

// The port as the reader of `db` reads it: each run names them, and the
// circles they read each of its views in, asked of Postgres as them, so a
// scoped view reads only the rows the app would show them.
export function scoped(port: Analytics, db: Asked): Analytics {
  return {
    catalog: () => port.catalog(),
    run: async (report) => port.run({ ...report, reader: await reader(db, Object.values(report.from ?? {})) }),
  }
}
