// The kit's own format helpers, alone: a figure, a fraction, a duration,
// a day's name, a day and its time together, and a size in bytes. One
// place a figure or a date is formatted, which every kind `Value` draws
// reads. Run by `cella test slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bytes, count, hours, percent, show, weekday, when } from '../src/models/format.ts'

test('count groups a whole figure by thousands, in the locale', () => {
  assert.equal(count(0), '0')
  assert.equal(count(1234), '1,234')
  assert.equal(count(1_000_000), '1,000,000')
  assert.equal(count(null), '—')
  assert.equal(count(undefined), '—')
  assert.equal(count(''), '—')
})

test('percent reads a figure already in hundreds, suffixed %', () => {
  assert.equal(percent(0), '0%')
  assert.equal(percent(12.5), '12.5%')
  assert.equal(percent(100), '100%')
  assert.equal(percent(33.333), '33.3%')
  assert.equal(percent(null), '—')
})

test('hours reads a duration, suffixed h', () => {
  assert.equal(hours(2), '2 h')
  assert.equal(hours(2.5), '2.5 h')
  assert.equal(hours(0), '0 h')
  assert.equal(hours(null), '—')
})

test('weekday names a day alone, short, in the locale', () => {
  assert.equal(weekday('2026-11-16'), 'Mon')
  assert.equal(weekday('2026-11-19T09:00'), 'Thu')
  assert.equal(weekday(null), '—')
})

test('when reads a day and its wall-clock time together, never shifted by a time zone', () => {
  assert.equal(when('2026-11-19T14:30'), '19 Nov 2026, 14:30')
  assert.equal(when('2026-11-19'), '19 Nov 2026')
  assert.equal(when(null), '—')
})

test('bytes reads a size as a reader reads it: bytes, KB and MB', () => {
  assert.equal(bytes(1), '1 byte')
  assert.equal(bytes(812), '812 bytes')
  assert.equal(bytes(24_000), '24 KB')
  assert.equal(bytes(2_400), '2.4 KB')
  assert.equal(bytes(1_234_567), '1.2 MB')
  assert.equal(bytes(3_000_000_000), '3 GB')
  assert.equal(bytes(null), '—')
})

test('show dispatches percent and hours as Value does', () => {
  assert.equal(show(12.5, 'percent'), '12.5%')
  assert.equal(show(2.5, 'hours'), '2.5 h')
})
