// seed, work: loads a mock co-op's projects with their milestones,
// budgets and shares, their crew, Linear's lead and members, its tasks,
// each its circle's, and its timesheets into the project,
// task and timesheet schemas and their grafts' (contact-project,
// invoice-project, membership-project, membership-task, project-task,
// membership-timesheet, project-timesheet), and the report feat's margin
// thresholds. Invoices load first. A run of time in the fixture is logged as one entry
// on each working day, Monday to Friday, from its first day to its last.
// A task's body is its blocks as one Loro snapshot, carried in with it,
// and its thread its comments, each with its mentions.
// Members and contacts load first; an archived project is archived after
// its milestones are in, and periods are submitted and approved after
// their entries are in.

import { createDoc, edits, outline, thread } from '../../apps/org/core/body/ts/src/models/index.ts'

// The working days from one ISO day to another, both included.
export function weekdays(from, to) {
  const out = []
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) {
      out.push(d.toISOString().slice(0, 10))
    }
  }
  return out
}

export async function work(db, read, day) {
  const projects = read('project').project ?? []
  for (const p of projects) {
    await db.query(
      `INSERT INTO project.project (id, title, circle, summary, started, due, budget)
       VALUES ($1, $2, coalesce($3, circle.assembly()), $4, $5, $6, cella.amount($7))`,
      [p.id, p.title, p.circle ?? null, p.summary ?? '', day(p.started), day(p.due), p.budget ?? null],
    )
    for (const [i, m] of (p.milestone ?? []).entries()) {
      await db.query(
        'INSERT INTO project.milestone (project, n, title, due, completed) VALUES ($1, $2, $3, $4, $5)',
        [p.id, i + 1, m.title, day(m.due), day(m.completed)],
      )
    }
  }

  for (const c of read('graft.contact-project').commission ?? []) {
    await db.query('INSERT INTO contact_project.commission (project, contact) VALUES ($1, $2)', [c.project, c.contact])
  }
  for (const c of read('graft.invoice-project').charge ?? []) {
    await db.query('INSERT INTO invoice_project.charge (invoice, project) VALUES ($1, $2)', [c.invoice, c.project])
  }

  const shares = read('graft.membership-project').share ?? []
  for (const s of shares) {
    await db.query(
      'INSERT INTO membership_project.share (project, member, amount, granted) VALUES ($1, $2, cella.amount($3), $4)',
      [s.project, s.member, s.amount, day(s.granted)],
    )
  }

  for (const c of read('graft.membership-project').crew ?? []) {
    if (c.lead) {
      await db.query('INSERT INTO membership_project.lead (project, member) VALUES ($1, $2)', [c.project, c.lead])
    }
    for (const member of c.members ?? []) {
      await db.query('INSERT INTO membership_project.member (project, member) VALUES ($1, $2)', [c.project, member])
    }
  }

  const tasks = read('task').task ?? []
  for (const t of tasks) {
    await db.query(
      'INSERT INTO task.task (id, title, status, priority, due, created, completed, circle, body) VALUES ($1, $2, $3, $4, $5, $6, $7, coalesce($8, circle.assembly()), $9)',
      [t.id, t.title, t.status, t.priority, day(t.due), day(t.created), day(t.completed), t.circle ?? null, t.body ? body(t) : null],
    )
  }
  // New tasks number on from the fixture's last.
  const last = Math.max(0, ...tasks.map((t) => Number(t.id.slice(2))))
  if (last) {
    await db.query(`SELECT setval('task.number', $1)`, [last])
  }
  // Each task's thread, its comments under receipts in file order, a
  // reply naming its root by its place among the task's comments, and
  // each `@[address]` in a comment's text a mention, in the order given;
  // a comment's reactions, each a person's own emoji, there while it is on.
  let comments = 0
  let reactions = 0
  for (const t of tasks) {
    const posted = []
    for (const c of t.comment ?? []) {
      const { rows } = await db.query(
        `INSERT INTO task.comment (id, task, author, parent, text, posted, resolved)
         VALUES (nextval('cella.receipt_seq'), $1, $2, $3, $4, $5, $6) RETURNING id`,
        [t.id, c.author, c.reply ? posted[c.reply - 1] : null, c.text, day(c.posted), day(c.resolved)],
      )
      posted.push(rows[0].id)
      for (const [i, person] of thread.mentioned(c.text).entries()) {
        await db.query('INSERT INTO task.mention (comment, n, person) VALUES ($1, $2, $3)', [rows[0].id, i + 1, person])
      }
      for (const r of c.reaction ?? []) {
        await db.query('INSERT INTO task.reaction (comment, person, emoji) VALUES ($1, $2, $3)', [rows[0].id, r.person, r.emoji])
        reactions++
      }
      comments++
    }
  }
  for (const a of read('graft.membership-task').assignment ?? []) {
    await db.query('INSERT INTO membership_task.assignment (task, member) VALUES ($1, $2)', [a.task, a.member])
  }
  for (const f of read('graft.project-task').filing ?? []) {
    await db.query('INSERT INTO project_task.filing (task, project, milestone) VALUES ($1, $2, $3)', [f.task, f.project, f.milestone ?? null])
  }

  const booked = read('graft.project-timesheet')
  for (const r of booked.rate ?? []) {
    await db.query('INSERT INTO project_timesheet.rate (since, hourly) VALUES ($1, cella.amount($2))', [day(r.since), r.hourly])
  }
  for (const c of booked.cost ?? []) {
    await db.query('INSERT INTO project_timesheet.cost (since, hourly) VALUES ($1, cella.amount($2))', [day(c.since), c.hourly])
  }
  for (const t of read('report').threshold ?? []) {
    await db.query('INSERT INTO report.threshold (since, burn, margin) VALUES ($1, $2, $3)', [day(t.since), t.burn, t.margin])
  }
  const projectOf = new Map((booked.booking ?? []).map((b) => [b.run, b.project]))
  const time = read('timesheet')
  let entries = 0
  for (const r of time.run ?? []) {
    for (const d of weekdays(day(r.from), day(r.to))) {
      const { rows } = await db.query(
        `INSERT INTO timesheet.entry (member, day, minutes, billable, note, circle)
         VALUES ($1, $2, $3, $4, $5, coalesce($6, circle.assembly())) RETURNING id`,
        [r.member, d, Math.round(r.hours * 60), r.billable ?? true, r.note ?? '', r.circle ?? null],
      )
      if (projectOf.has(r.id)) {
        await db.query('INSERT INTO project_timesheet.booking (entry, project) VALUES ($1, $2)', [rows[0].id, projectOf.get(r.id)])
      }
      entries++
    }
  }
  for (const p of time.period ?? []) {
    await db.query(
      `INSERT INTO timesheet.period (member, month, circle, submitted) VALUES ($1, $2, coalesce($3, circle.assembly()), $4)
       ON CONFLICT (member, month, circle) DO UPDATE SET submitted = excluded.submitted`,
      [p.member, p.month, p.circle ?? null, day(p.submitted)],
    )
    if (p.approved) {
      await db.query(
        'UPDATE timesheet.period SET approved = $4, approver = $5 WHERE member = $1 AND month = $2 AND circle = coalesce($3, circle.assembly())',
        [p.member, p.month, p.circle ?? null, day(p.approved), p.approver],
      )
    }
  }

  for (const p of projects.filter((p) => p.archived)) {
    await db.query('UPDATE project.project SET archived = $2 WHERE id = $1', [p.id, day(p.archived)])
  }

  return `${projects.length} projects, ${shares.length} shares, ${tasks.length} tasks, ${comments} comments, ${reactions} reactions, ${entries} time entries`
}

// A task's body, as the snapshot of one Loro document holding its blocks.
function body(t) {
  const loro = createDoc(1n)
  edits.patch(loro, undefined, outline(t.body, `task ${t.id}'s body`))
  loro.commit()
  return loro.export({ mode: 'snapshot' })
}
