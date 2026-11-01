import type { Db } from '@cella/org-db'
import { draft } from '@cella/org-document/api'
import type { OnDocument, OnMeeting, Summary } from '../models/minutes.ts'

// Every meeting of the scope, the latest first, as an embed draws it and
// the slash menu offers it.
export async function summaries(db: Db): Promise<Summary[]> {
  const { rows } = await db.query<Summary>(
    `SELECT id, title, circle, to_char(at, 'YYYY-MM-DD"T"HH24:MI') AS at, status FROM meeting.meeting ORDER BY at DESC`,
  )
  return rows
}

// A meeting's minutes: the document, its draft as the database's guards
// read it, how many versions it has, its latest and the one adopted.
export async function onMeeting(db: Db, meeting: string): Promise<OnMeeting> {
  const { rows } = await db.query<{ document: string; title: string; versions: number; latest: string | null; adopted: string | null }>(
    `SELECT n.document, d.title,
            (SELECT count(*)::int FROM document.version v WHERE v.document = d.id) AS versions,
            (SELECT v.id FROM document.version v WHERE v.document = d.id ORDER BY v.n DESC LIMIT 1) AS latest,
            (SELECT a.version FROM document.adopted a WHERE a.document = d.id) AS adopted
     FROM document_meeting.minutes n JOIN document.document d ON d.id = n.document
     WHERE n.meeting = $1`,
    [meeting],
  )
  const status = await db.query<{ status: string }>('SELECT status FROM meeting.meeting WHERE id = $1', [meeting])
  const kept = rows[0]
  return {
    minutes: kept ? { ...kept, draft: await draft(db, kept.document) } : null,
    cancelled: status.rows[0]?.status === 'cancelled',
    meetings: await summaries(db),
  }
}

// The meeting a document minutes, if any, and the meetings it may embed.
export async function onDocument(db: Db, document: string): Promise<OnDocument> {
  const meetings = await summaries(db)
  const { rows } = await db.query<{ meeting: string }>('SELECT meeting FROM document_meeting.minutes WHERE document = $1', [document])
  return { of: meetings.find((m) => m.id === rows[0]?.meeting) ?? null, meetings }
}
