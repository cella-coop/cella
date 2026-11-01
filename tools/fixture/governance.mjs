// fixture check, governance: a mock co-op's motions decide what can be
// decided. An action names a kind a graft registers, and its arguments
// resolve: a member to admit is invited and subscribes shares, one to
// suspend or let go is a member; a seat names a circle and a member; the links
// check a version to adopt and a distribution to approve. Every
// invited member has taken up their invitation, with the first device it
// enrolled, without which their admission is refused, and only they have.

const kinds = new Set(['admit', 'suspend', 'exit', 'seat', 'unseat', 'nest', 'grant', 'revoke', 'adopt', 'terms', 'patronage', 'distribution'])

export function governance(read, fail) {
  const members = new Map((read('membership').member ?? []).map((m) => [m.address, m]))
  const circles = new Set((read('circle').circle ?? []).map((c) => c.id))
  for (const d of read('motion').motion ?? []) {
    for (const m of d.action ?? []) {
      const where = `motion ${d.id}, action ${m.kind}`
      const a = m.args ?? {}
      if (!kinds.has(m.kind)) {
        fail(`${where}: no graft registers the kind ${m.kind}`)
      }
      if (['admit', 'suspend', 'exit', 'seat', 'unseat'].includes(m.kind) && !members.has(a.member)) {
        fail(`${where}: ${a.member} is no member`)
      }
      if (m.kind === 'admit' && (members.get(a.member)?.status !== 'invited' || !(a.shares > 0))) {
        fail(`${where}: admits someone invited, with shares`)
      }
      if (['seat', 'unseat', 'nest'].includes(m.kind) && !circles.has(a.circle)) {
        fail(`${where}: no circle ${a.circle}`)
      }
    }
  }
  const carried = new Set()
  for (const i of read('membership').invitation ?? []) {
    if (members.get(i.member)?.status !== 'invited') {
      fail(`invitation of ${i.member}: taken up by no one invited`)
    }
    if (!i.label || !(i.accepted instanceof Date)) {
      fail(`invitation of ${i.member}: names its device and the day it was taken up`)
    }
    carried.add(i.member)
  }
  for (const m of members.values()) {
    if (m.status === 'invited' && !carried.has(m.address)) {
      fail(`member ${m.address}: invited, with no invitation taken up in membership.toml`)
    }
  }
}
