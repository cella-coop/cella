// fixture check, governance: a mock co-op's decisions decide what can be
// decided. A motion names a kind a graft registers, and its arguments
// resolve: a member to admit is invited and subscribes shares, one to
// suspend or let go is a member; a seat names a circle and a member. Every
// invited member's invitation carries a first device, without which their
// admission is refused, and only an invited member's does.

const kinds = new Set(['admit', 'suspend', 'exit', 'seat', 'unseat', 'nest', 'grant', 'revoke'])

export function governance(read, fail) {
  const members = new Map((read('member').member ?? []).map((m) => [m.address, m]))
  const circles = new Set((read('circle').circle ?? []).map((c) => c.id))
  for (const d of read('decision').decision ?? []) {
    for (const m of d.motion ?? []) {
      const where = `decision ${d.id}, motion ${m.kind}`
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
  for (const i of read('graft.key-member').invitation ?? []) {
    if (members.get(i.member)?.status !== 'invited') {
      fail(`invitation of ${i.member}: carries a device for no one invited`)
    }
    if (!i.label) {
      fail(`invitation of ${i.member}: names its device`)
    }
    carried.add(i.member)
  }
  for (const m of members.values()) {
    if (m.status === 'invited' && !carried.has(m.address)) {
      fail(`member ${m.address}: invited, with no first device in graft.key-member.toml`)
    }
  }
}
