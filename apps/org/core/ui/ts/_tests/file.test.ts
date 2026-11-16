// A file picker's judgement, alone: whether a field's `accept` takes a
// file, and its size as a reader reads it. Run by `cella test slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accepts, offered, sized } from '../src/models/file.ts'

const pdf = { name: 'sncf-1023.PDF', type: 'application/pdf', size: 24_000 }
const csv = { name: 'members.csv', type: '', size: 812 }
const png = { name: 'receipt.png', type: 'image/png', size: 1_234_567 }

test('accept takes a media type, a family of them or an extension, as the browser reads it', () => {
  assert.ok(accepts(undefined, pdf), 'no accept takes every file')
  assert.ok(accepts('', csv))
  assert.ok(accepts('image/*,application/pdf', pdf))
  assert.ok(accepts('image/*,application/pdf', png))
  assert.ok(!accepts('image/*,application/pdf', csv))
  assert.ok(accepts('.csv,.txt,text/csv,text/plain', csv), 'by its extension, though the browser names no type')
  assert.ok(accepts('.pdf', pdf), 'an extension in any case')
  assert.ok(!accepts('.csv', pdf))
  assert.equal(offered(' image/*, application/pdf'), 'image/*, application/pdf')
})

test('a size reads in bytes, KB and MB', () => {
  assert.equal(sized(1), '1 byte')
  assert.equal(sized(812), '812 bytes')
  assert.equal(sized(24_000), '24 KB')
  assert.equal(sized(2_400), '2.4 KB')
  assert.equal(sized(1_234_567), '1.2 MB')
  assert.equal(sized(3_000_000_000), '3 GB')
})
