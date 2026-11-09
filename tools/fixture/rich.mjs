// fixture check, richness: a mock co-op is rich enough to show every
// feature. Every collection the app mounts lists rows of it, enough of
// them, in every lane its board groups by and with every relation its
// pages show; every circle owns rows of each collection a circle's work
// fills, so its lens shows a slice of its own; and a collection whose rows
// spread over the circles owns rows in more than one. A collection whose
// rows are not the fixture's says why, as a lane left empty does. Which
// collections the app mounts is read from the slices' `./api` sources, so
// a collection a feature adds fails here until this file says what of a
// fixture it lists.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { rules } from './finance.mjs'
import { weekdays } from '../seed/work.mjs'

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)

// Every collection a slice's `./api` mounts, by name, with the file that
// mounts it: each key of a `collections: { … }` object, at its top level.
export function mounted(repo) {
  const walk = (dir) =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f)
      return f === 'node_modules' ? [] : statSync(p).isDirectory() ? walk(p) : [p]
    })
  const out = new Map()
  for (const file of walk(join(repo, 'apps/org')).filter((p) => /\/ts\/src\/api\/[a-z]+\.ts$/.test(p))) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/\bcollections: \{/g)) {
      let depth = 1
      let start = true
      for (let i = m.index + m[0].length; i < src.length && depth > 0; i++) {
        const c = src[i]
        if (c === '{') {
          depth++
        } else if (c === '}') {
          depth--
        } else if (c === '\n') {
          start = true
          continue
        }
        const key = depth === 1 && start && /^([a-z][A-Za-z]*):/.exec(src.slice(i))
        if (key) {
          out.set(key[1], relative(repo, file))
        }
        if (/\S/.test(c)) {
          start = false
        }
      }
    }
  }
  return out
}

// A closed motion's outcome, as the motion feat counts the latest stance
// of each member: consent passes with no objection standing, any other
// procedure with more for than against.
function outcome(d) {
  const last = new Map()
  for (const v of [...(d.vote ?? [])].sort((a, b) => iso(a.at).localeCompare(iso(b.at)))) {
    last.set(v.member, v.stance)
  }
  const stances = [...last.values()]
  if (d.procedure === 'consent') {
    return stances.includes('object') ? 'rejected' : 'passed'
  }
  return stances.filter((s) => s === 'for').length > stances.filter((s) => s === 'against').length ? 'passed' : 'rejected'
}

// What each collection lists of a fixture. `rows` reads its rows; `min`
// is how many make it more than trivial, two unless named; `circle` the
// circle that owns a row, the root's where it names none, for a
// collection every circle's work fills (`every`) or one whose rows spread
// over the circles (`spread`); `lanes` the value each lane of its board
// reads, every one of which some row holds unless `empty` says why;
// `relations` what of its pages each row may show, which some row shows;
// and `none`, for a collection whose rows are not the fixture's, why.
export const listing = (read) => {
  const root = (read('circle').circle ?? []).find((c) => c.assembly)?.id
  const owner = (r) => r.circle ?? root
  const motions = read('motion').motion ?? []
  const meetings = read('meeting').meeting ?? []
  const time = read('timesheet')
  const runs = time.run ?? []
  const pay = read('payslip')
  const ids = (file, key, field) => new Set((read(file)[key] ?? []).map((x) => x[field]))
  const holds = (set) => (r) => set.has(r.id)

  // A worker's month in a circle, as the timesheets list it: one for each
  // circle whose runs fall in it, with the period its submission made.
  const months = new Map()
  for (const r of runs) {
    for (const d of weekdays(iso(r.from), iso(r.to))) {
      const key = `${r.member} ${r.circle ?? root} ${d.slice(0, 7)}`
      months.set(key, months.get(key) ?? { id: key, member: r.member, circle: r.circle ?? root, month: d.slice(0, 7), runs: new Set() })
      months.get(key).runs.add(r.id)
    }
  }
  for (const p of time.period ?? []) {
    const m = months.get(`${p.member} ${p.circle ?? root} ${p.month}`)
    if (m) {
      m.period = p
    }
  }
  const booked = ids('graft.project-timesheet', 'booking', 'run')

  return {
    people: { rows: () => read('person').person },
    inbox: {
      none: 'it lists what waits on whoever reads it, the same whatever the lens; the motions, approvals and meetings it lists are checked as theirs',
    },
    devices: { rows: () => read('person').device },
    circles: { rows: () => read('circle').circle },
    mandates: { rows: () => motions.filter((d) => d.closed).flatMap((d) => (d.action ?? []).filter((m) => m.kind === 'policy' && m.args?.kind === 'mandate')) },
    motions: {
      rows: () => motions,
      circle: owner,
      every: true,
      lanes: { state: (d) => (d.closed ? outcome(d) : 'open') },
      relations: {
        stances: (d) => (d.vote ?? []).length > 0,
        'an action': (d) => (d.action ?? []).length > 0,
        'a meeting that tabled it': holds(ids('graft.meeting-motion', 'tabled', 'motion')),
      },
    },
    documents: {
      rows: () => read('document').document,
      circle: owner,
      every: true,
      relations: {
        'more than one version': (d) => (d.version ?? []).length > 1,
        comments: (d) => (d.comment ?? []).length > 0,
        'an adoption': holds(ids('graft.document-motion', 'adoption', 'document')),
        'a meeting it minutes': holds(ids('graft.document-meeting', 'minutes', 'document')),
      },
    },
    meetings: {
      rows: () => meetings,
      circle: owner,
      every: true,
      lanes: { status: (m) => m.status },
      relations: {
        'an agenda': (m) => (m.item ?? []).length > 0,
        attendance: holds(ids('graft.meeting-membership', 'attendance', 'meeting')),
        'a motion tabled': holds(ids('graft.meeting-motion', 'tabled', 'meeting')),
        minutes: holds(ids('graft.document-meeting', 'minutes', 'meeting')),
      },
    },
    contacts: { rows: () => read('contact').contact },
    projects: {
      rows: () => (read('project').project ?? []).filter((p) => !p.archived),
      circle: owner,
      every: true,
      lanes: { state: (p) => ((p.milestone ?? []).length && p.milestone.every((m) => m.completed) ? 'done' : 'active') },
      relations: {
        tasks: holds(ids('graft.project-task', 'filing', 'project')),
        time: holds(new Set((read('graft.project-timesheet').booking ?? []).map((b) => b.project))),
        'a client': holds(ids('graft.contact-project', 'commission', 'project')),
        invoices: holds(ids('graft.invoice-project', 'charge', 'project')),
        'a member\'s share': holds(ids('graft.membership-project', 'share', 'project')),
      },
    },
    tasks: {
      rows: () => read('task').task,
      circle: owner,
      every: true,
      lanes: { status: (t) => t.status, priority: (t) => t.priority },
      relations: {
        'an assignee': holds(ids('graft.membership-task', 'assignment', 'task')),
        'a project': holds(ids('graft.project-task', 'filing', 'task')),
      },
    },
    timesheets: {
      rows: () => [...months.values()],
      circle: (m) => m.circle,
      every: true,
      lanes: { state: (m) => (m.period?.approved ? 'approved' : m.period?.submitted ? 'submitted' : 'open') },
      relations: { 'a project': (m) => [...m.runs].some((r) => booked.has(r)) },
    },
    files: { rows: () => read('file').file },
    imports: {
      none: 'a run is what importing a file records; Lanterne keeps the files to import under import/, and the import scenario records its runs',
    },
    invoices: {
      rows: () => read('invoice').invoice,
      circle: owner,
      spread: true,
      relations: {
        payments: (i) => (i.payment ?? []).length > 0,
        'a client': holds(ids('graft.contact-invoice', 'billing', 'invoice')),
        'a project': holds(ids('graft.invoice-project', 'charge', 'invoice')),
        'an entry in the books': holds(ids('graft.invoice-transaction', 'posting', 'invoice')),
      },
    },
    accounts: { rows: () => read('account').account },
    periods: { rows: () => read('account').period },
    terms: { rows: () => rules(read, 'account'), min: 1 },
    distributions: { rows: () => read('patronage').distribution, min: 1 },
    bases: { rows: () => rules(read, 'patronage'), min: 1 },
    statements: {
      none: 'a worker\'s statement is a part the approval of a distribution makes; Lanterne\'s 2025 distribution is a draft, for the patronage scenario to approve',
    },
    transactions: { rows: () => read('transaction').entry },
    expenses: {
      rows: () => read('expense').expense,
      circle: owner,
      every: true,
      lanes: { status: (e) => (e.reimbursed ? 'reimbursed' : e.decided ? e.status : e.submitted ? 'submitted' : 'draft') },
      relations: {
        'a receipt': (e) => Boolean(e.receipt),
        'a project it is billed on to': holds(ids('graft.expense-project', 'rebill', 'expense')),
        'an entry in the books': holds(ids('graft.expense-transaction', 'posting', 'expense')),
      },
    },
    bills: { rows: () => read('bill').bill, circle: owner, spread: true },
    payslips: {
      rows: () => (pay.run ?? []).flatMap((r) => (pay.salary ?? []).filter((s) => iso(s.from) <= `${r.month}-28`).map((s) => ({ run: r, member: s.member }))),
      lanes: { state: ({ run }) => (run.paid ? 'paid' : run.approved ? 'approved' : 'prepared') },
      empty: {
        state: {
          prepared: 'a run is prepared and approved within days, and October\'s is the payroll scenarios\' to generate',
          approved: 'a run is prepared and approved within days, and October\'s is the payroll scenarios\' to generate',
        },
      },
    },
    reports: { none: 'the report feat draws its reports from the books, which the transactions hold' },
    log: { none: 'a fixture founds the co-op as the log\'s first entry, its only one; the scenarios write the entries after it' },
  }
}

// The lanes a board groups each collection by, as its view's `look`
// declares them; the lenses scenario holds them to the app's own.
export const declared = {
  timesheets: { state: ['open', 'submitted', 'approved'] },
  expenses: { status: ['draft', 'submitted', 'approved', 'reimbursed', 'refused'] },
  projects: { state: ['active', 'done'] },
  meetings: { status: ['scheduled', 'held', 'cancelled'] },
  tasks: { status: ['backlog', 'todo', 'doing', 'done'], priority: ['urgent', 'high', 'normal', 'low'] },
  payslips: { state: ['prepared', 'approved', 'paid'] },
  motions: { state: ['open', 'passed', 'rejected'] },
}

export function rich(read, fail, repo) {
  const circles = (read('circle').circle ?? []).map((c) => c.id)
  const listed = listing(read)
  const mounts = mounted(repo)
  for (const [name, file] of mounts) {
    const c = listed[name]
    if (!c) {
      fail(`collection ${name} (${file}): the fixture check reads none of its rows; say in tools/fixture/rich.mjs what of a fixture it lists`)
      continue
    }
    if (c.none) {
      continue
    }
    const rows = c.rows() ?? []
    const min = c.min ?? 2
    if (rows.length < min) {
      fail(`collection ${name}: ${rows.length} row${rows.length === 1 ? '' : 's'}, fewer than the ${min} that show it`)
    }
    for (const [lane, values] of Object.entries(declared[name] ?? {})) {
      const of = c.lanes?.[lane]
      if (!of) {
        fail(`collection ${name}: its board groups by ${lane}, which the fixture check reads no value of`)
        continue
      }
      const held = new Set(rows.map(of))
      for (const v of values) {
        if (!held.has(v) && !c.empty?.[lane]?.[v]) {
          fail(`collection ${name}: no row is ${lane} ${v}, so its lane shows empty`)
        }
      }
    }
    for (const [relation, holds] of Object.entries(c.relations ?? {})) {
      if (!rows.some(holds)) {
        fail(`collection ${name}: no row has ${relation}`)
      }
    }
    if (c.every) {
      for (const circle of circles) {
        if (!rows.some((r) => c.circle(r) === circle)) {
          fail(`circle ${circle}: owns no row of ${name}, so its lens shows ${name} empty`)
        }
      }
    }
    if (c.spread && new Set(rows.map(c.circle)).size < 2) {
      fail(`collection ${name}: every row is one circle's, so no lens narrows it`)
    }
  }
  for (const name of Object.keys(listed)) {
    if (!mounts.has(name)) {
      fail(`collection ${name}: tools/fixture/rich.mjs lists it, and no slice mounts it`)
    }
  }
}
