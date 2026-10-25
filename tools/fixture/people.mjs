// fixture check, people: a mock co-op's workers and their candidacies are
// consistent. A contract runs forward, a fixed-term one or an
// apprenticeship to a day it names, for a plausible week; a candidacy is a
// worker's, its probation within their employment, and a candidate the
// assembly admitted was admitted after their probation ended.

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)
const contracts = new Set(['permanent', 'fixed-term', 'apprenticeship'])

export function people(read, fail) {
  const workers = new Map((read('employment').worker ?? []).map((w) => [w.address, w]))
  const members = new Map((read('membership').member ?? []).map((m) => [m.address, m]))

  for (const w of workers.values()) {
    if (!contracts.has(w.contract)) {
      fail(`worker ${w.address}: no contract ${w.contract}`)
    }
    if (w.until && iso(w.until) < iso(w.start)) {
      fail(`worker ${w.address}: their contract ends before it starts`)
    }
    if (w.contract !== 'permanent' && !w.until) {
      fail(`worker ${w.address}: a ${w.contract} contract names its last day`)
    }
    if (!(w.hours > 0 && w.hours <= 48)) {
      fail(`worker ${w.address}: ${w.hours} hours a week`)
    }
  }

  for (const c of read('graft.employment-membership').candidacy ?? []) {
    const w = workers.get(c.worker)
    if (!w) {
      fail(`candidacy of ${c.worker}: no worker`)
      continue
    }
    if (iso(c.from) < iso(w.start) || iso(c.to) < iso(c.from) || (w.until && iso(c.to) > iso(w.until))) {
      fail(`candidacy of ${c.worker}: the probation is not within their employment`)
    }
    const m = members.get(c.worker)
    if (m?.since && iso(m.since) <= iso(c.to)) {
      fail(`candidacy of ${c.worker}: admitted on ${iso(m.since)}, before their probation ended`)
    }
  }
}
