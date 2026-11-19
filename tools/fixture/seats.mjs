// fixture seats: where each person sits in a mock coop, read from its
// circles' members and its tenures as `circle.seat` reads
// them: a person member with no role, a tenure in its circle with its
// role, and a tenure of a role that is a member of a circle there with no
// role, for the days the two overlap.

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)

export function seats(read) {
  const { member = [], tenure = [] } = read('circle')
  const later = (a, b) => (!a ? b : !b ? a : a > b ? a : b)
  const sooner = (a, b) => (!a ? b : !b ? a : a < b ? a : b)
  return [
    ...member.filter((m) => m.person).map((m) => ({ circle: m.circle, member: m.person, role: null, since: iso(m.since), until: iso(m.until) })),
    ...tenure.map((t) => ({ circle: t.circle, member: t.holder, role: t.role, since: iso(t.since), until: iso(t.until) })),
    ...member
      .filter((m) => m.role)
      .flatMap((m) =>
        tenure
          .filter((t) => t.role === m.role)
          .map((t) => ({ circle: m.circle, member: t.holder, role: null, since: later(iso(m.since), iso(t.since)), until: sooner(iso(m.until), iso(t.until)) }))
          .filter((s) => !s.since || !s.until || s.since < s.until),
      ),
  ]
}
