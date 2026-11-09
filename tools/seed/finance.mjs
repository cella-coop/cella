// seed, finance: loads a mock co-op's capital, its surplus
// distributions, pay, expenses and bills into the account, patronage, payslip,
// expense and bill schemas and their grafts' (account-membership,
// account-membership-transaction's repayments, employment-payslip,
// payslip-transaction, expense-project, expense-transaction). The chart, the
// journal, the members and their time load first: a capital account names
// its holder and its parent once every account is in; a pay run's payslips
// load before it is approved, September's with the minutes of the members'
// approved months; a carried run links the journal entry that posted it;
// an expense is submitted, decided and reimbursed in turn, and its
// postings link the entries its approval and reimbursement posted.

export async function finance(db, read, day) {
  const books = read('account')
  for (const a of (books.account ?? []).filter((a) => a.parent || a.holder)) {
    await db.query('UPDATE account.account SET parent = $2, holder = $3, frozen = $4 WHERE code = $1', [a.code, a.parent ?? null, a.holder ?? null, a.frozen ?? false])
  }
  for (const a of read('graft.account-membership').allowance ?? []) {
    await db.query('INSERT INTO account_membership.allowance (member, amount) VALUES ($1, cella.amount($2))', [a.member, a.amount])
  }

  const patronage = read('patronage')
  for (const a of patronage.distribution ?? []) {
    await db.query('INSERT INTO patronage.distribution (id, year, surplus, basis) VALUES ($1, $2, cella.amount($3), $4)', [a.id, a.year, a.surplus, a.basis])
    for (const s of a.share ?? []) {
      await db.query('INSERT INTO patronage.share (distribution, kind, percent, amount) VALUES ($1, $2, $3, cella.amount($4))', [a.id, s.kind, s.percent, s.amount])
    }
  }
  for (const r of read('graft.account-membership-transaction').repayment ?? []) {
    await db.query(
      'INSERT INTO account_membership_transaction.repayment (member, n, due, amount, entry, paid) VALUES ($1, $2, $3, cella.amount($4), $5, $6)',
      [r.member, r.n, day(r.due), r.amount, r.entry ?? null, day(r.paid)],
    )
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
      `INSERT INTO expense.expense (id, member, day, label, category, net, vat, receipt, circle)
       VALUES ($1, $2, $3, $4, $5, cella.amount($6), cella.amount($7), $8, coalesce($9, circle.assembly()))`,
      [e.id, e.member, day(e.day), e.label, e.category, e.net, e.vat ?? null, e.receipt ?? null, e.circle ?? null],
    )
    if (e.submitted) {
      await db.query(`UPDATE expense.expense SET status = 'submitted', submitted = $2 WHERE id = $1`, [e.id, day(e.submitted)])
    }
    // Decided, approved or refused, then reimbursed, one step at a time
    // as the expense feat's writes move it.
    if (e.decided) {
      await db.query('UPDATE expense.expense SET status = $2, decided = $3, decider = $4 WHERE id = $1', [e.id, e.status, day(e.decided), e.decider])
    }
    if (e.reimbursed) {
      await db.query(`UPDATE expense.expense SET status = 'reimbursed', reimbursed = $2 WHERE id = $1`, [e.id, day(e.reimbursed)])
    }
  }
  for (const p of read('graft.expense-transaction').posting ?? []) {
    await db.query('INSERT INTO expense_transaction.posting (entry, expense, event) VALUES ($1, $2, $3)', [p.entry, p.expense, p.event])
  }
  if (expenses.length) {
    await db.query(`SELECT setval('expense.number', $1)`, [Math.max(...expenses.map((e) => Number(e.id.slice(3))))])
  }
  for (const r of read('graft.expense-project').rebill ?? []) {
    await db.query('INSERT INTO expense_project.rebill (expense, project) VALUES ($1, $2)', [r.expense, r.project])
  }

  // A bill's amounts are its lines', counted as the VAT core library counts
  // them, by `cella.line_amount` and `cella.line_vat`.
  const bills = read('bill').bill ?? []
  for (const b of bills) {
    await db.query(
      `WITH lines AS (
         SELECT x.n::integer AS n, x.description, x.quantity, x.unit_price, x.vat_rate,
                cella.line_amount(x.quantity, x.unit_price) AS amount
         FROM ROWS FROM (jsonb_to_recordset($10::jsonb) AS (description text, quantity numeric, unit_price bigint, vat_rate numeric))
           WITH ORDINALITY AS x (description, quantity, unit_price, vat_rate, n)
       ),
       sums AS (SELECT sum(amount)::bigint AS net, sum(cella.line_vat(amount, vat_rate))::bigint AS vat FROM lines),
       made AS (
         INSERT INTO bill.bill (id, supplier, reference, issued, due, label, category, recorded, recorder, net, vat, total, circle)
         SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, cella.amount(net), CASE WHEN vat > 0 THEN cella.amount(vat) END, cella.amount(net + vat),
                coalesce($11, circle.assembly())
         FROM sums
         RETURNING id, circle
       )
       INSERT INTO bill.line (bill, circle, n, description, quantity, unit_price, amount, vat_rate)
       SELECT made.id, made.circle, n, description, quantity, cella.amount(unit_price), cella.amount(amount), vat_rate FROM made, lines`,
      [b.id, b.supplier, b.reference, day(b.issued), day(b.due), b.label, b.category, day(b.recorded), b.recorder, JSON.stringify(b.line ?? []), b.circle ?? null],
    )
  }
  if (bills.length) {
    await db.query(`SELECT setval('bill.number', $1)`, [Math.max(...bills.map((b) => Number(b.id.slice(3))))])
  }
  return `${(pay.run ?? []).length} pay runs, ${expenses.length} expenses, ${bills.length} bills`
}
