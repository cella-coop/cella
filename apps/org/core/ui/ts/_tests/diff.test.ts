// A change as a diff, alone: an arrangement's new tree with each choice
// marked added, moved between accordions or reordered within one, its
// new accordions marked and those it drops listed; and the choices that
// stay in their order unmarked. Run by `cella test slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { arranged } from '../src/models/diff.ts'

const was = 'Books: account, transaction, report; Payments: invoice, bill; contact, employment'

const marks = (d: ReturnType<typeof arranged>) =>
  d.lines.map((l) => (l.kind === 'head' ? `[${l.group}${l.added ? '+' : ''}]` : `${l.value}${l.mark ? `:${l.mark}` : ''}${l.kind === 'choice' && l.from !== undefined ? `<${l.from ?? 'top'}` : ''}`))

test('an arrangement unchanged marks nothing', () => {
  const d = arranged(was, was)
  assert.equal(d.changed, false)
  assert.deepEqual(d.removed, [])
  assert.ok(d.lines.every((l) => l.kind === 'head' || l.mark === null))
})

test('a choice added, one dropped, one moved between accordions and one reordered are each marked', () => {
  const d = arranged(was, 'Books: transaction, account, report, contact; Payments: invoice; employment, payslip; People: bill')
  assert.equal(d.changed, true)
  assert.deepEqual(marks(d), [
    '[Books]',
    'transaction',
    'account:reordered',
    'report',
    'contact:moved<top',
    '[Payments]',
    'invoice',
    'employment',
    'payslip:added',
    '[People+]',
    'bill:moved<Payments',
  ])
  assert.deepEqual(d.removed, [])
  assert.deepEqual(arranged(was, 'contact').removed.map((p) => p.value), ['account', 'transaction', 'report', 'invoice', 'bill', 'employment'])
})
