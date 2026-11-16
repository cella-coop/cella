// An arrangement, alone: a listing read into its choices and spelt back
// as `circle.spell` spells a circle's features; a choice turned on and
// off; the places a lifted choice or accordion may land, in an accordion,
// at the top level or off, and the arrangement once it lands there; and
// an accordion renamed, its choices always together. Run by `cella test
// slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { described, gathered, landed, listed, renamed, runs, spell, targets, toggled } from '../src/models/arrange.ts'

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

test('a lifted choice may land in any accordion, at the top level between runs, or off', () => {
  const t = targets(items, { kind: 'choice', value: 'transaction' })
  assert.deepEqual(
    t.targets.map((x) => (x.kind === 'off' ? 'off' : `${x.group ?? '-'}@${x.index}`)),
    ['-@0', 'Books@0', 'Books@1', 'Books@2', '-@2', 'Payments@2', 'Payments@3', 'Payments@4', '-@4', '-@5', '-@6', 'off'],
    'the end of an accordion and the top level after it are two places',
  )
  assert.equal(t.from, 2, 'it was lifted from its own place')
  const lifted = { kind: 'choice', value: 'transaction' } as const
  assert.equal(spell(landed(items, lifted, t.targets[t.from]!)), operations, 'dropped where it was, nothing changes')
  assert.equal(spell(landed(items, lifted, t.targets[6]!)), 'Books: account, report; Payments: invoice, transaction, bill; contact, employment')
  assert.equal(spell(landed(items, lifted, t.targets[8]!)), 'Books: account, report; Payments: invoice, bill; transaction, contact, employment')
  assert.equal(spell(landed(items, lifted, { kind: 'off' })), 'Books: account, report; Payments: invoice, bill; contact, employment')
  assert.equal(described(items, lifted, t.targets[6]!, (v) => v), 'In Payments, position 2 of 3')
  assert.equal(described(items, lifted, t.targets[8]!, (v) => v), 'At the top level, after Payments')
  assert.equal(described(items, lifted, { kind: 'off' }, (v) => v), 'Not shown')
})

test('a choice at the top level moves into an accordion, and back where it was is no change', () => {
  const lifted = { kind: 'choice', value: 'contact' } as const
  const t = targets(items, lifted)
  assert.deepEqual(t.targets[t.from], { kind: 'at', group: null, index: 5 })
  assert.equal(spell(landed(items, lifted, t.targets[t.from]!)), operations)
  assert.equal(spell(landed(items, lifted, t.targets[4]!)), 'Books: account, transaction, report, contact; Payments: invoice, bill; employment')
})

test('an accordion moves as a whole between the runs, or off with all its choices', () => {
  const lifted = { kind: 'accordion', group: 'Payments' } as const
  const t = targets(items, lifted)
  assert.deepEqual(
    t.targets.map((x) => (x.kind === 'off' ? 'off' : `${x.group ?? '-'}@${x.index}`)),
    ['-@0', '-@3', '-@4', '-@5', 'off'],
  )
  assert.equal(t.from, 1)
  assert.equal(spell(landed(items, lifted, t.targets[0]!)), 'Payments: invoice, bill; Books: account, transaction, report; contact, employment')
  assert.equal(spell(landed(items, lifted, t.targets[3]!)), 'Books: account, transaction, report; contact, employment; Payments: invoice, bill')
  assert.equal(spell(landed(items, lifted, { kind: 'off' })), 'Books: account, transaction, report; contact, employment')
})

test('a choice alone in its accordion keeps it while lifted; one not shown lands in a new accordion', () => {
  const alone = listed('Work: project; file')
  const t = targets(alone, { kind: 'choice', value: 'project' })
  assert.deepEqual(t.targets[t.from], { kind: 'at', group: 'Work', index: 0 })
  assert.equal(spell(landed(alone, { kind: 'choice', value: 'project' }, t.targets[t.from]!)), 'Work: project; file')
  const off = targets(items, { kind: 'choice', value: 'payslip' }, ['People'])
  assert.equal(off.from, off.targets.length - 1, 'a choice not shown was lifted from off')
  assert.deepEqual(off.targets.at(-2), { kind: 'at', group: 'People', index: 7 })
  assert.equal(spell(landed(items, { kind: 'choice', value: 'payslip' }, off.targets.at(-2)!)), `${operations}; People: payslip`)
})

test('an accordion renamed renames each of its choices, joining another of that name', () => {
  assert.equal(spell(renamed(items, 'Books', 'Ledger')), operations.replace('Books', 'Ledger'))
  assert.equal(spell(renamed(items, 'Payments', 'Books')), 'Books: account, transaction, report, invoice, bill; contact, employment')
  assert.equal(spell(renamed(items, 'Payments', '')), 'Books: account, transaction, report; invoice, bill, contact, employment')
  assert.equal(spell(gathered(listed('Work: project; file; Work: task'))), 'Work: project, task; file')
})
