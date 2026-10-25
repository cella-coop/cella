// seed, finance: loads a mock co-op's capital, the statutes' terms, surplus
// distributions, pay and expenses into the account, patronage, payslip and
// expense schemas and their grafts' (decision-patronage, account-member,
// account-member-transaction's repayments, member-payslip,
// payslip-transaction, expense-project). The chart, the
// journal, the members and their time load first: a capital account names
// its holder and its parent once every account is in; a pay run's payslips
// load before it is approved, September's with the minutes of the members'
// approved months; a carried run links the journal entry that posted it.

export async function finance(db, read, day) {
  const books = read('account')
  for (const a of (books.account ?? []).filter((a) => a.parent || a.holder)) {
    await db.query('UPDATE account.account SET parent = $2, holder = $3, frozen = $4 WHERE code = $1', [a.code, a.parent ?? null, a.holder ?? null, a.frozen ?? false])
  }
  for (const a of read('graft.account-member').allowance ?? []) {
    await db.query('INSERT INTO account_member.allowance (member, amount) VALUES ($1, cella.amount($2))', [a.member, a.amount])
  }

  for (const t of books.terms ?? []) {
    await db.query(
      `INSERT INTO account.terms (id, "from", share, minimum, instalments, delay, repayments, adopted)
       VALUES ($1, $2, cella.amount($3), $4, $5, $6, $7, $8)`,
      [t.id, t.from, t.share, t.minimum, t.instalments, t.delay, t.repayments, day(t.adopted)],
    )
  }
  const patronage = read('patronage')
  for (const t of patronage.terms ?? []) {
    await db.query(
      `INSERT INTO patronage.terms (id, "from", salary, hours, equal, capital, adopted) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [t.id, t.from, t.salary ?? 0, t.hours ?? 0, t.equal ?? 0, t.capital ?? 0, day(t.adopted)],
    )
  }
  for (const a of patronage.distribution ?? []) {
    await db.query('INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ($1, $2, cella.amount($3), $4)', [a.id, a.year, a.surplus, a.basis])
    for (const s of a.share ?? []) {
      await db.query('INSERT INTO patronage.share (distribution, kind, percent, amount) VALUES ($1, $2, $3, cella.amount($4))', [a.id, s.kind, s.percent, s.amount])
    }
  }
  for (const r of read('graft.account-member-transaction').repayment ?? []) {
    await db.query(
      'INSERT INTO account_member_transaction.repayment (member, n, due, amount, entry, paid) VALUES ($1, $2, $3, cella.amount($4), $5, $6)',
      [r.member, r.n, day(r.due), r.amount, r.entry ?? null, day(r.paid)],
    )
  }
  for (const a of read('graft.decision-patronage').approval ?? []) {
    await db.query('INSERT INTO decision_patronage.approval (distribution, decision) VALUES ($1, $2)', [a.distribution, a.decision])
  }

  const pay = read('payslip')
  if (pay.terms) {
    await db.query('INSERT INTO payslip.terms (employee, employer, ratio) VALUES ($1, $2, $3)', [pay.terms.employee, pay.terms.employer, pay.terms.ratio])
  }
  for (const s of pay.salary ?? []) {
    await db.query('INSERT INTO payslip.salary (member, "from", gross) VALUES ($1, $2, cella.amount($3))', [s.member, day(s.from), s.gross])
  }
  for (const r of pay.run ?? []) {
    await db.query('INSERT INTO payslip.run (month, generated) VALUES ($1, $2)', [r.month, day(r.generated)])
    await db.query(
      `INSERT INTO payslip.payslip (month, member, minutes, gross, employee, employer, net)
       SELECT $1, d.member, CASE WHEN $2 THEN payslip_timesheet.minutes(d.member, $1) END,
              cella.amount(d.gross), cella.amount(d.employee), cella.amount(d.employer), cella.amount(d.net)
       FROM payslip.due($1) d`,
      [r.month, r.timed ?? false],
    )
    await db.query('UPDATE payslip.run SET approved = $2, approver = $3, paid = $4 WHERE month = $1', [r.month, day(r.approved), r.approver ?? null, day(r.paid)])
  }
  for (const p of read('graft.payslip-transaction').posting ?? []) {
    await db.query('INSERT INTO payslip_transaction.posting (entry, month, event) VALUES ($1, $2, $3)', [p.entry, p.month, p.event])
  }

  const expenses = read('expense').expense ?? []
  for (const e of expenses) {
    await db.query(
      `INSERT INTO expense.expense (id, member, day, label, category, net, vat, receipt)
       VALUES ($1, $2, $3, $4, $5, cella.amount($6), cella.amount($7), $8)`,
      [e.id, e.member, day(e.day), e.label, e.category, e.net, e.vat ?? null, e.receipt ?? null],
    )
    if (e.submitted) {
      await db.query(`UPDATE expense.expense SET status = 'submitted', submitted = $2 WHERE id = $1`, [e.id, day(e.submitted)])
    }
  }
  if (expenses.length) {
    await db.query(`SELECT setval('expense.number', $1)`, [Math.max(...expenses.map((e) => Number(e.id.slice(3))))])
  }
  for (const r of read('graft.expense-project').rebill ?? []) {
    await db.query('INSERT INTO expense_project.rebill (expense, project) VALUES ($1, $2)', [r.expense, r.project])
  }
  return `${(pay.run ?? []).length} pay runs, ${expenses.length} expenses`
}
