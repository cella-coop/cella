// seed, meetings: loads a mock co-op's meetings with their agendas into
// the meeting schema, and its grafts' rows: how each circle meets
// (the meeting feat), who came (meeting-membership), the motions agenda
// items table (meeting-motion) and the minutes' documents
// (document-meeting). Circles, members, motions and documents load
// first. A held meeting is loaded scheduled, its agenda and its marks put
// in, then held on its own day, as the feat's triggers fix both once it
// is.

const stamp = (d) => new Date(d).toISOString().slice(0, 16).replace('T', ' ')

export async function meetings(db, read, day) {
  for (const s of read('meeting').setting ?? []) {
    await db.query('INSERT INTO meeting.setting (circle, quorum, adopts) VALUES ($1, $2, $3)', [s.circle, s.quorum ?? 50, s.adopts ?? false])
  }

  const list = read('meeting').meeting ?? []
  const items = new Map()
  for (const m of list) {
    await db.query(
      `INSERT INTO meeting.meeting (id, circle, title, at, place, link, scheduled, minuted)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [m.id, m.circle, m.title, stamp(m.at), m.place ?? '', m.link ?? null, day(m.scheduled), day(m.minuted)],
    )
    const ids = []
    for (const [i, it] of (m.item ?? []).entries()) {
      const { rows } = await db.query(
        'INSERT INTO meeting.item (meeting, pos, title, presenter, minutes) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [m.id, i + 1, it.title, it.presenter ?? '', it.minutes ?? null],
      )
      ids.push(rows[0].id)
    }
    items.set(m.id, ids)
  }

  const days = new Map(list.map((m) => [m.id, day(m.at)]))
  let marks = 0
  for (const a of read('graft.meeting-membership').attendance ?? []) {
    for (const status of ['present', 'excused', 'absent']) {
      for (const member of a[status] ?? []) {
        await db.query(
          'INSERT INTO meeting_membership.attendance (meeting, member, status, marked, by) VALUES ($1, $2, $3, $4, $5)',
          [a.meeting, member, status, days.get(a.meeting), a.by ?? null],
        )
        marks++
      }
    }
  }

  const tabled = read('graft.meeting-motion').tabled ?? []
  for (const t of tabled) {
    await db.query('INSERT INTO meeting_motion.tabled (item, meeting, motion) VALUES ($1, $2, $3)', [
      items.get(t.meeting)?.[t.item - 1] ?? null,
      t.meeting,
      t.motion,
    ])
  }

  const minutes = read('graft.document-meeting').minutes ?? []
  for (const n of minutes) {
    await db.query('INSERT INTO document_meeting.minutes (meeting, document) VALUES ($1, $2)', [n.meeting, n.document])
  }

  for (const m of list.filter((m) => m.status !== 'scheduled')) {
    await db.query('UPDATE meeting.meeting SET status = $2, settled = $3 WHERE id = $1', [m.id, m.status, day(m.settled ?? m.at)])
  }

  return `${list.length} meetings, ${marks} marks, ${tabled.length} motions tabled, ${minutes.length} minutes`
}
