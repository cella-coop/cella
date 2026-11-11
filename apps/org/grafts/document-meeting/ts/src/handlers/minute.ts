import type { Refused, Settled } from '@cella/org-actions'
import { write, type Deps } from '@cella/org-db'
import { creating } from '@cella/org-document/api'
import type { Fragment } from '@cella/org-body/models'
import { meeting as read, minuting } from '@cella/org-meeting/api'
import type { Minute, Minuted } from '../models/minutes.ts'

const text = (t: string) => (t ? [{ text: t }] : [])

// The blocks minutes open with: their title, the meeting's card, who was
// present, and a heading for each item of the agenda, each to be written
// under.
function opening(meeting: string, title: string, items: string[]): Fragment[] {
  return [
    { type: 'heading', level: 1, runs: text(`Minutes, ${title}`), children: [] },
    { type: 'embed', embed: 'meeting', ref: meeting, runs: [], children: [] },
    { type: 'heading', level: 2, runs: text('Present'), children: [] },
    { type: 'paragraph', runs: [], children: [] },
    ...items.flatMap((item, i): Fragment[] => [
      { type: 'heading', level: 2, runs: text(`${i + 1}. ${item}`), children: [] },
      { type: 'paragraph', runs: [], children: [] },
    ]),
  ]
}

// Begins a meeting's minutes, the meeting feat's write, in a document
// kept for them: the first time, the document is started, its draft
// opening on the meeting's card and agenda as the actor's edit, and tied
// to the meeting, in the same transaction under the same verdict; after
// that, the minutes are the document already kept. The entry carries the
// creation as the document feat's `creating` would log it, so its fold
// starts the document as this write did.
export async function minute(input: Minute, deps: Deps): Promise<Settled<Minuted> | Refused> {
  const w = minuting(input)
  let created: Record<string, unknown> | null = null
  return write(deps, {
    op: w.op,
    request: input,
    state: async (tx, proof) => {
      const minuted = await w.state(tx, proof)
      const kept = await tx.query<{ document: string }>('SELECT document FROM document_meeting.minutes WHERE meeting = $1', [input.meeting])
      if (kept.rows[0]) {
        return { ...minuted, document: kept.rows[0].document, digest: null }
      }
      const m = await read(tx, input.meeting)
      if (!m) {
        throw new Error(`no meeting ${input.meeting}`)
      }
      const blocks = opening(m.id, m.title, m.agenda.map((i) => i.title))
      const c = creating({ id: `minutes-${m.id}`, title: `Minutes, ${m.title}`, blocks }, deps.actor)
      const started = await c.state(tx, proof)
      created = c.payload(started)
      await tx.query('INSERT INTO document_meeting.minutes (meeting, document) VALUES ($1, $2)', [m.id, started.document])
      return { ...minuted, document: started.document, digest: started.digest }
    },
    payload: (v) => ({ ...w.payload(v), document: v.document, digest: v.digest, created }),
  })
}
