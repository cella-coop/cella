// What an entry says in Activity, alone: its op's verb in the past and its
// thing, and the record it links to, from the ids `cella.records` reads.
// Run by `cella test slice log`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { past, said } from '../src/models/activity.ts'

test('a verb is said in the past, an irregular or a noun one in its own words', () => {
  assert.equal(past('issue'), 'issued')
  assert.equal(past('apply'), 'applied')
  assert.equal(past('employ'), 'employed')
  assert.equal(past('seat'), 'seated')
  assert.equal(past('send'), 'sent')
  assert.equal(past('payment'), 'recorded a payment on')
})

test('a line names the record its thing is, and links to its page', () => {
  assert.deepEqual(said('invoice:invoice:send', { invoice: 'F-2026-004' }), { text: 'sent invoice F-2026-004', href: '/invoices/F-2026-004' })
  assert.deepEqual(said('person:person:profile', { person: 'ines@lanterne.example' }), {
    text: 'updated the profile of person ines@lanterne.example',
    href: '/people/ines%40lanterne.example',
  })
})

test("a thing with no page of its own is said in the feat's record that has one", () => {
  assert.deepEqual(said('circle:role:seat', { role: 'facilitator', circle: 'coordination' }), {
    text: 'seated a role in circle coordination',
    href: '/circles/coordination',
  })
  assert.deepEqual(said('invoice-project:invoice:link', { invoice: 'F-1', project: 'p-1' }), { text: 'linked invoice F-1', href: '/invoices/F-1' })
})

test('a general thing is named with its feat, and an entry about no record the shell shows links nowhere', () => {
  assert.deepEqual(said('payslip:run:approve', { run: 'r-1' }), { text: 'approved a payslip run' })
  assert.deepEqual(said('account:period:close', { period: '2026-10' }), { text: 'closed account period 2026-10', href: '/periods/2026-10' })
  assert.deepEqual(said('meeting:item:add'), { text: 'added a meeting item' })
})
