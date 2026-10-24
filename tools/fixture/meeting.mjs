// fixture check, meetings: a mock co-op's meetings are consistent. A
// meeting is a circle's that exists; one held met on or before the
// scope's day and one scheduled meets after it; every link a meeting graft
// holds resolves; a mark is an active member's, recorded by the circle's
// secretary or a lead only for those seated in the circle, any other
// marking themselves as a guest; an item tables a decision proposed by the
// meeting's day; a circle's setting is a share between 1 and 100 %.

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)

// The meetings, for the document check's embeds.
export const meetingIds = (read) => new Set((read('meeting').meeting ?? []).map((m) => m.id))

export function meeting(read, fail) {
  const today = iso(read('scope').today)
  const circles = new Set((read('circle').circle ?? []).map((c) => c.id))
  const active = new Set((read('member').member ?? []).filter((m) => m.status === 'active').map((m) => m.address))
  const decisions = new Map((read('decision').decision ?? []).map((d) => [d.id, d]))
  const documents = new Set((read('document').document ?? []).map((d) => d.id))
  const meetings = new Map((read('meeting').meeting ?? []).map((m) => [m.id, m]))
  const positions = read('graft.circle-member').position ?? []
  const seated = (circle, member, day) =>
    positions.some((p) => p.circle === circle && p.member === member && (!p.since || iso(p.since) <= day) && (!p.until || iso(p.until) > day))
  const keeps = (circle, member, day) =>
    positions.some((p) => p.circle === circle && p.member === member && ['secretary', 'lead'].includes(p.role) && (!p.until || iso(p.until) > day))

  for (const m of meetings.values()) {
    const where = `meeting ${m.id}`
    if (!circles.has(m.circle)) {
      fail(`${where}: no circle ${m.circle}`)
    }
    if (!m.id.startsWith(`${m.circle}-${iso(m.at)}`)) {
      fail(`${where}: is named for its circle and day, ${m.circle}-${iso(m.at)}`)
    }
    if (!['scheduled', 'held', 'cancelled'].includes(m.status)) {
      fail(`${where}: is scheduled, held or cancelled, not ${m.status}`)
    }
    if (m.status === 'held' && iso(m.at) > today) {
      fail(`${where}: held, but it meets after ${today}`)
    }
    if (m.status === 'scheduled' && iso(m.at) <= today) {
      fail(`${where}: still scheduled on ${today}, the day it met or after`)
    }
  }

  for (const a of read('graft.meeting-member').attendance ?? []) {
    const m = meetings.get(a.meeting)
    if (!m) {
      fail(`attendance: no meeting ${a.meeting}`)
      continue
    }
    if (m.status !== 'held') {
      fail(`attendance at ${a.meeting}: marked, though it was not held`)
    }
    for (const member of [...(a.present ?? []), ...(a.excused ?? []), ...(a.absent ?? [])]) {
      const where = `attendance of ${member} at ${a.meeting}`
      if (!active.has(member)) {
        fail(`${where}: no active member`)
      }
      if (a.by !== member && !seated(m.circle, member, iso(m.at))) {
        fail(`${where}: recorded by ${a.by}, though they hold no seat in ${m.circle}; a guest marks themselves`)
      }
      if (a.by !== member && !keeps(m.circle, a.by, iso(m.at))) {
        fail(`${where}: recorded by ${a.by}, who is neither ${m.circle}'s secretary nor its lead`)
      }
    }
  }

  for (const t of read('graft.decision-meeting').tabled ?? []) {
    const m = meetings.get(t.meeting)
    const d = decisions.get(t.decision)
    const where = `${t.meeting}, item ${t.item}`
    if (!m || !(t.item >= 1 && t.item <= (m.item ?? []).length)) {
      fail(`${where}: no such item on the agenda`)
    }
    if (!d) {
      fail(`${where}: no decision ${t.decision}`)
    } else if (m && iso(d.proposed) > iso(m.at)) {
      fail(`${where}: tables ${t.decision}, proposed on ${iso(d.proposed)}, after the meeting`)
    }
  }

  for (const n of read('graft.document-meeting').minutes ?? []) {
    if (!meetings.has(n.meeting)) {
      fail(`minutes: no meeting ${n.meeting}`)
    }
    if (!documents.has(n.document)) {
      fail(`minutes of ${n.meeting}: no document ${n.document}`)
    }
  }

  for (const s of read('graft.circle-meeting').setting ?? []) {
    if (!circles.has(s.circle)) {
      fail(`setting: no circle ${s.circle}`)
    }
    if (!(s.quorum >= 1 && s.quorum <= 100)) {
      fail(`setting of ${s.circle}: a quorum is a share of 1 to 100 %`)
    }
  }
}
