// The record scenario, in Chromium, on a seeded Lanterne through the dev
// server: every kind a record page shows keeps a body, since every record
// has one. Camille, a member of the assembly like everyone, opens one
// record of each kind the dev fixture holds, chosen in its circle where
// it has one in the assembly's, else any of its own, and finds the
// body's note under its header: opening, read-only or ready to edit,
// never nothing. Left out: the import and report feats, whose fixture
// seeds no run and no saved report to open, and patronage's statements,
// a view with no row of its own to keep one on. `SHOTS` names where its
// screenshots go. Run by `cella test e2e record`.
// covers: account bill contact expense file invoice meeting patronage payslip project task timesheet transaction

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import pg from 'pg'
import { eachBrowser, serve, signIn } from './browser.ts'

const shots = process.env.SHOTS ?? '/tmp/cella-record-shots'
const camille = 'camille@lanterne.example'

// Each kind a record page shows, with a body mounted: the table its
// record is a row of, the column its body-mounting code keys the record
// by (`id`, or the table's own PK where that differs, as account's and
// payslip's do), and the path its page opens at.
const kinds = [
  { table: 'task.task', id: 'id', path: 'tasks' },
  { table: 'project.project', id: 'id', path: 'projects' },
  { table: 'bill.bill', id: 'id', path: 'bills' },
  { table: 'contact.contact', id: 'id', path: 'contacts' },
  { table: 'expense.expense', id: 'id', path: 'expenses' },
  { table: 'file.file', id: 'id', path: 'files' },
  { table: 'invoice.invoice', id: 'id', path: 'invoices' },
  { table: 'meeting.meeting', id: 'id', path: 'meetings' },
  { table: 'payslip.payslip', id: 'id', path: 'payslips' },
  { table: 'timesheet.entry', id: 'id', path: 'timesheets' },
  { table: 'transaction.entry', id: 'id', path: 'transactions' },
  { table: 'account.account', id: 'code', path: 'accounts' },
  { table: 'account.period', id: 'month', path: 'periods' },
  { table: 'account.terms', id: 'id', path: 'terms' },
  { table: 'patronage.terms', id: 'id', path: 'bases' },
  { table: 'patronage.distribution', id: 'id', path: 'distributions' },
] as const

eachBrowser((name, launch) => {
  test(`${name}: Camille opens one record of every kind the fixture holds and finds its body`, async () => {
    mkdirSync(shots, { recursive: true })
    const su = new pg.Client()
    await su.connect()
    const { base, stop } = await serve()
    const browser = await launch()
    const errors: string[] = []
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { 'x-forwarded-proto': 'http' } })
      await signIn(context, base, camille)
      const page = await context.newPage()
      page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`))

      for (const { table, id, path } of kinds) {
        const found = await su.query<{ id: string }>(
          `SELECT ${id}::text AS id FROM ${table} ORDER BY (circle = 'ag') DESC, ${id} LIMIT 1`,
        )
        const row = found.rows[0]
        assert.ok(row, `${name}: the fixture seeds no ${table} to open`)

        await page.goto(`${base}/${path}/${encodeURIComponent(row.id)}`)
        await page.waitForLoadState('networkidle')
        const body = page.locator('[data-body]')
        await body.waitFor({ timeout: 20_000 })
        assert.equal(await body.count(), 1, `${name}: ${path}/${row.id} shows one body`)
        await page.waitForSelector('[data-body]:not([data-state=opening])', { timeout: 20_000 })
        const state = await body.getAttribute('data-state')
        assert.ok(state, `${name}: ${path}/${row.id}'s body settles to a state`)
      }

      await page.screenshot({ path: `${shots}/record-${name}.png`, fullPage: true })
      assert.deepEqual(errors, [], `${name}: the pages threw nothing`)
      await context.close()
    } finally {
      await browser.close()
      await stop()
      await su.end()
    }
  })
})
