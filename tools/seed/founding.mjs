// seed, founding: a co-op as it is founded from nothing but its legal
// form, as a fixture in memory for `found.mjs` to found: the founders,
// each a person with one device, an active member since the founding day
// and seated in the root circle, the form's assembly; and the root's
// founding motion, which the scope names as its `founding`, which the
// founders decide by consent on that day, each with a stance, and which
// adopts the form's defaults in its order, each worded and
// protected as it reads and taking it, the procedures among them. `keep`
// chooses which defaults it adopts, every one by default. Each device's
// key is the TEST-ONLY key derived from its address and label.

// The fixture's files, as `read` answers them, for a founding of `scope`
// ({ address, name, legal_form }) by `founders` ([{ address, name, label }]),
// whose assembly is `root`, on `day`.
export async function founding(db, { scope, founders, day, root = 'ag', keep = () => true }) {
  const { rows } = await db.query(
    'SELECT id, key, kind, legal, friendly, protected FROM policy.default WHERE form = $1 ORDER BY n',
    [scope.legal_form],
  )
  const year = day.slice(0, 4)
  const motion = `m-${year}-001`
  const files = {
    scope: { ...scope, founding: motion },
    person: {
      person: founders.map((f) => ({ address: f.address, name: f.name })),
      device: founders.map((f) => ({ address: f.address, label: f.label, enrolled: day })),
    },
    membership: { member: founders.map((f) => ({ address: f.address, status: 'active', since: day, shares: 1, invited: day })) },
    circle: {
      circle: [{ id: root, name: 'Assembly', assembly: true, purpose: 'every member, one vote' }],
      member: founders.map((f) => ({ circle: root, person: f.address, since: day })),
    },
    motion: {
      motion: [
        {
          id: motion,
          circle: root,
          title: `Found ${scope.name} and adopt its statutes`,
          procedure: 'consent',
          proposed: day,
          deadline: day,
          closed: day,
          body: `The founders adopt the statutes of ${scope.name}, as its legal form's defaults read.`,
          action: rows.filter(keep).map((d) => ({
            kind: 'policy',
            args: {
              kind: d.kind,
              wording: d.legal,
              ...(d.friendly ? { friendly: d.friendly } : {}),
              ...(d.protected ? { protected: d.protected } : {}),
              takes: d.id,
            },
          })),
          vote: founders.map((f) => ({ member: f.address, stance: 'consent', at: day })),
        },
      ],
    },
  }
  return (file) => files[file] ?? {}
}
