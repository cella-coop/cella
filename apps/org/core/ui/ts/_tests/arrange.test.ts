// An arrangement, alone: a listing read into its choices and spelt back
// as `circle.spell` spells a circle's features; a choice turned on and
// off, moved past its neighbour in its accordion, a choice under none
// moved past a whole accordion, an accordion moved as a whole, a choice
// put under an accordion and an accordion renamed, its choices always
// together. Run by `cella test slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gathered, listed, movable, moved, regrouped, renamed, runs, shiftable, shifted, spell, toggled } from '../src/models/arrange.ts'

const operations = 'Books: account, transaction, report; Payments: invoice, bill; contact, employment'
const items = listed(operations)

test('a listing is read into its choices in order and spelt back canonically', () => {
  assert.deepEqual(items.slice(0, 4), [
    { value: 'account', group: 'Books' },
    { value: 'transaction', group: 'Books' },
    { value: 'report', group: 'Books' },
    { value: 'invoice', group: 'Payments' },
  ])
  assert.deepEqual(items.at(-1), { value: 'employment', group: null })
  assert.equal(spell(items), operations)
  assert.equal(spell(listed('project,task ;timesheet, file,contact')), 'project, task, timesheet, file, contact', 'runs under none spelt as one')
  assert.equal(spell(listed(' : project; task')), 'project, task', 'an accordion named blank is none')
  assert.equal(spell(listed('')), '')
  assert.deepEqual(
    runs(items).map((r) => [r.group, r.items.map((i) => i.placed.value)]),
    [['Books', ['account', 'transaction', 'report']], ['Payments', ['invoice', 'bill']], [null, ['contact']], [null, ['employment']]],
    'an accordion is one run, each choice under none its own',
  )
})

test('a choice turned on joins the end under none, and off leaves', () => {
  assert.equal(spell(toggled(items, 'payslip', true)), `${operations}, payslip`)
  assert.equal(spell(toggled(items, 'bill', false)), 'Books: account, transaction, report; Payments: invoice; contact, employment')
  assert.equal(spell(toggled(items, 'invoice', true)), operations.replace('invoice, ', '') + ', invoice', 'turned on again it moves to the end')
})

test('a choice moves past its neighbour in its accordion, and no further', () => {
  assert.equal(spell(moved(items, 1, -1)), 'Books: transaction, account, report; Payments: invoice, bill; contact, employment')
  assert.equal(movable(items, 0, -1), false, 'the first of an accordion moves up no further')
  assert.equal(movable(items, 2, 1), false, 'the last of an accordion moves down no further')
  assert.equal(moved(items, 2, 1), items)
})

test('a choice under none moves past the choice or the whole accordion beside it', () => {
  assert.equal(spell(moved(items, 5, -1)), 'Books: account, transaction, report; contact; Payments: invoice, bill; employment')
  assert.equal(spell(moved(items, 6, -1)), 'Books: account, transaction, report; Payments: invoice, bill; employment, contact')
  assert.equal(movable(items, 6, 1), false, 'the last moves down no further')
})

test('an accordion moves as a whole past the run beside it', () => {
  assert.equal(spell(shifted(items, 'Payments', -1)), 'Payments: invoice, bill; Books: account, transaction, report; contact, employment')
  assert.equal(spell(shifted(items, 'Payments', 1)), 'Books: account, transaction, report; contact; Payments: invoice, bill; employment')
  assert.equal(shiftable(items, 'Books', -1), false, 'the first moves up no further')
  assert.equal(shiftable(items, 'Nowhere', 1), false)
})

test('a choice put under an accordion joins it, or makes one, and accordions stay together', () => {
  assert.equal(spell(regrouped(items, 5, 'Books')), 'Books: account, transaction, report, contact; Payments: invoice, bill; employment')
  assert.equal(spell(regrouped(items, 6, 'People')), 'Books: account, transaction, report; Payments: invoice, bill; contact; People: employment')
  assert.equal(spell(regrouped(items, 0, ' ')), 'account; Books: transaction, report; Payments: invoice, bill; contact, employment', 'a blank name puts it under none')
  assert.equal(spell(regrouped(items, 1, 'Payments')), 'Books: account, report; Payments: invoice, bill, transaction; contact, employment')
})

test('an accordion renamed renames each of its choices, joining another of that name', () => {
  assert.equal(spell(renamed(items, 'Books', 'Ledger')), operations.replace('Books', 'Ledger'))
  assert.equal(spell(renamed(items, 'Payments', 'Books')), 'Books: account, transaction, report, invoice, bill; contact, employment')
  assert.equal(spell(renamed(items, 'Payments', '')), 'Books: account, transaction, report; invoice, bill, contact, employment')
  assert.equal(spell(gathered(listed('Work: project; file; Work: task'))), 'Work: project, task; file')
})
