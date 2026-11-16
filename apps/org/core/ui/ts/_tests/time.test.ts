// A time field's figures, alone: the times its list offers, what is typed
// read as a time, where its list opens, and the time typed figures reach.
// Run by `cella test slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nearest, parsedTime, reached, times } from '../src/models/time.ts'

const list = times()

test('the list offers a time every quarter of an hour, on the 24-hour clock', () => {
  assert.equal(list.length, 96)
  assert.deepEqual(list.slice(0, 3), ['00:00', '00:15', '00:30'])
  assert.equal(list.at(-1), '23:45')
  assert.equal(times(30).length, 48)
})

test('what is typed reads as a time, the French way too', () => {
  for (const [typed, want] of [
    ['9', '09:00'],
    ['09:30', '09:30'],
    ['930', '09:30'],
    ['1430', '14:30'],
    ['9.30', '09:30'],
    ['9h30', '09:30'],
    ['14h', '14:00'],
    [' 7:05 ', '07:05'],
  ]) {
    assert.equal(parsedTime(typed), want, typed)
  }
  for (const typed of ['', '24:00', '9:60', 'noon', '12345', '9:3']) {
    assert.equal(parsedTime(typed), null, typed)
  }
})

test('the list opens on the field\'s time, else the one before it, else nine', () => {
  assert.equal(list[nearest(list, '14:30')], '14:30')
  assert.equal(list[nearest(list, '14:40')], '14:30')
  assert.equal(list[nearest(list, '')], '09:00')
})

test('typed figures reach the time they start, an hour without its nought too', () => {
  assert.equal(list[reached(list, '14')], '14:00')
  assert.equal(list[reached(list, '143')], '14:30')
  assert.equal(list[reached(list, '14:3')], '14:30')
  assert.equal(list[reached(list, '9')], '09:00')
  assert.equal(list[reached(list, '93')], '09:30')
  assert.equal(list[reached(list, '1')], '10:00')
  assert.equal(reached(list, '7'), list.indexOf('07:00'))
  assert.equal(reached(list, '99'), -1)
  assert.equal(reached(list, 'h'), -1)
})
