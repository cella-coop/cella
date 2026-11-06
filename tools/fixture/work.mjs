// fixture check, work: a mock co-op's projects, tasks and timesheets are
// consistent. Every link a work graft holds resolves, and an invoice bills
// a project of the client it bills; shares never exceed
// their project's budget; a done task, and only a done one, has its day; a
// worker logs a plausible day, ten hours at most, on working days; an
// approved month was submitted, and approved by someone else; nothing is
// booked to a project archived or dated before it started; booked time
// has a rate and a cost; time is a worker's, on days of their employment.

import { weekdays } from '../seed/work.mjs'

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)

export function work(read, fail) {
  const addresses = new Set((read('membership').member ?? []).filter((m) => m.status === 'active').map((m) => m.address))
  const clients = new Set((read('client').client ?? []).map((c) => c.id))
  const projects = new Map((read('project').project ?? []).map((p) => [p.id, p]))
  const tasks = new Map((read('task').task ?? []).map((t) => [t.id, t]))
  const time = read('timesheet')
  const runs = new Map((time.run ?? []).map((r) => [r.id, r]))

  const active = (address, where) => {
    if (!addresses.has(address)) {
      fail(`${where}: ${address} is no active member`)
    }
  }
  // Time is a worker's, member or not, on days of their employment.
  const workers = new Map((read('employment').worker ?? []).map((w) => [w.address, w]))
  const employed = (address, from, to, where) => {
    const w = workers.get(address)
    if (!w) {
      fail(`${where}: ${address} is no worker`)
    } else if (from < iso(w.start) || (w.until && to > iso(w.until))) {
      fail(`${where}: ${address} is not employed from ${from} to ${to}`)
    }
  }
  const has = (map, id, what, where) => {
    if (!map.has(id)) {
      fail(`${where}: no ${what} ${id}`)
    }
  }

  for (const p of projects.values()) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id)) {
      fail(`project ${p.id}: an id is a slug`)
    }
    for (const m of p.milestone ?? []) {
      if (m.completed && iso(m.completed) < iso(p.started)) {
        fail(`project ${p.id}: ${m.title} is completed before the project started`)
      }
    }
  }

  for (const c of read('graft.client-project').commission ?? []) {
    has(projects, c.project, 'project', 'commission')
    if (!clients.has(c.client)) {
      fail(`commission of ${c.project}: no client ${c.client}`)
    }
  }

  // An invoice bills a project of the client it bills.
  const invoices = new Set((read('invoice').invoice ?? []).map((i) => i.id))
  const billed = new Map((read('graft.client-invoice').billing ?? []).map((b) => [b.invoice, b.client]))
  const commissioned = new Map((read('graft.client-project').commission ?? []).map((c) => [c.project, c.client]))
  for (const c of read('graft.invoice-project').charge ?? []) {
    has(projects, c.project, 'project', `charge of ${c.invoice}`)
    if (!invoices.has(c.invoice)) {
      fail(`charge of ${c.project}: no invoice ${c.invoice}`)
    } else if (billed.get(c.invoice) !== commissioned.get(c.project)) {
      fail(`charge of ${c.invoice}: it bills ${billed.get(c.invoice)}, and ${c.project} is for ${commissioned.get(c.project)}`)
    }
  }

  const shared = new Map()
  for (const s of read('graft.membership-project').share ?? []) {
    has(projects, s.project, 'project', 'share')
    active(s.member, `share of ${s.project}`)
    shared.set(s.project, (shared.get(s.project) ?? 0) + s.amount)
  }
  for (const [id, total] of shared) {
    const budget = projects.get(id)?.budget
    if (budget === undefined || total > budget) {
      fail(`project ${id}: shares come to ${total}, beyond a budget of ${budget ?? 'none'}`)
    }
  }

  for (const t of tasks.values()) {
    if ((t.status === 'done') !== Boolean(t.completed)) {
      fail(`task ${t.id}: done and its completion day go together`)
    }
    if (t.completed && iso(t.completed) < iso(t.created)) {
      fail(`task ${t.id}: completed before it was created`)
    }
  }
  for (const a of read('graft.membership-task').assignment ?? []) {
    has(tasks, a.task, 'task', 'assignment')
    active(a.member, `assignment of ${a.task}`)
  }
  for (const f of read('graft.project-task').filing ?? []) {
    has(tasks, f.task, 'task', 'filing')
    const p = projects.get(f.project)
    if (!p) {
      fail(`filing of ${f.task}: no project ${f.project}`)
    } else if (f.milestone && !(p.milestone ?? [])[f.milestone - 1]) {
      fail(`filing of ${f.task}: ${f.project} has no milestone ${f.milestone}`)
    }
  }

  // A plausible day: what a member logs on a day comes to ten hours at
  // most, and only on working days.
  const days = new Map()
  for (const r of runs.values()) {
    employed(r.member, iso(r.from), iso(r.to), `run ${r.id}`)
    const span = weekdays(iso(r.from), iso(r.to))
    if (!span.length || !(r.hours > 0)) {
      fail(`run ${r.id}: logs no time`)
    }
    for (const d of span) {
      const key = `${r.member} ${d}`
      days.set(key, (days.get(key) ?? 0) + r.hours)
    }
  }
  for (const [key, hours] of days) {
    if (hours > 10) {
      fail(`${key}: ${hours} hours in a day`)
    }
  }

  // A month is a member's in one circle, the root's where none is named,
  // and holds the runs of that circle.
  const months = new Set()
  for (const r of runs.values()) {
    for (const d of weekdays(iso(r.from), iso(r.to))) {
      months.add(`${r.member} ${r.circle ?? ''} ${d.slice(0, 7)}`)
    }
  }
  for (const p of time.period ?? []) {
    employed(p.member, `${p.month}-01`, `${p.month}-28`, `period ${p.month}`)
    if (!months.has(`${p.member} ${p.circle ?? ''} ${p.month}`)) {
      fail(`period ${p.member} ${p.month}: no time of ${p.circle ?? 'the root'} in it`)
    }
    if (p.approved && !p.submitted) {
      fail(`period ${p.member} ${p.month}: approved, never submitted`)
    }
    if (p.approved && (p.approver === p.member || !addresses.has(p.approver))) {
      fail(`period ${p.member} ${p.month}: approved by ${p.approver}, who may not approve it`)
    }
  }

  const booked = read('graft.project-timesheet')
  if (runs.size && !(booked.rate ?? []).length) {
    fail('project-timesheet: no rate a budget is spent at')
  }
  if (runs.size && !(booked.cost ?? []).length) {
    fail('project-timesheet: no cost an hour of time is costed at')
  }
  for (const b of booked.booking ?? []) {
    const r = runs.get(b.run)
    const p = projects.get(b.project)
    if (!r || !p) {
      fail(`booking of ${b.run}: no ${r ? 'project' : 'run'} ${r ? b.project : b.run}`)
      continue
    }
    if (p.archived && iso(p.archived) <= iso(r.to)) {
      fail(`booking of ${b.run}: ${b.project} was archived on ${iso(p.archived)}`)
    }
    if (iso(r.from) < iso(p.started)) {
      fail(`booking of ${b.run}: ${b.project} started on ${iso(p.started)}`)
    }
  }
}
