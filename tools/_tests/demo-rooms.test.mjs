// demo-rooms's own logic, apart from any server: a join code is 128 bits
// and compared in constant time; a browser idle past its span is ejected
// from its room and the member it leased is freed; a room with more than
// one browser present is not alone.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EJECT_IDLE_MS, alone, eject, joinCode, lease, leased, present, release, sameCode, stale } from '../demo-rooms.mjs'

test('a join code is 16 random bytes, over 128 bits, and two are never alike', () => {
  const a = joinCode()
  const b = joinCode()
  assert.notEqual(a, b)
  assert.ok(Buffer.from(a, 'base64url').length * 8 >= 128, `${a} is short of 128 bits`)
})

test('a code is itself, compared in constant time; never a near miss, a prefix or absent', () => {
  const code = joinCode()
  assert.ok(sameCode(code, code))
  assert.equal(sameCode(code, `${code}x`), false)
  assert.equal(sameCode(code, code.slice(0, -1)), false)
  assert.equal(sameCode(code, code.slice(1) + code[0]), false)
  assert.equal(sameCode(code, ''), false)
  assert.equal(sameCode(code, undefined), false)
  assert.equal(sameCode('', ''), false)
})

test('present and stale split a room’s browsers by EJECT_IDLE_MS, and a room of one present is alone', () => {
  const now = Date.now()
  const browsers = new Map([
    ['a', now],
    ['b', now - EJECT_IDLE_MS - 1],
  ])
  assert.deepEqual(present(browsers, now), ['a'])
  assert.deepEqual(stale(browsers, now), ['b'])
  assert.ok(alone(browsers, 'a', now), 'a is alone once b is stale')
  assert.equal(alone(browsers, 'b', now), false, 'a stale browser is not alone; it is gone')
})

test('present, stale and alone take their own span, for a front tested with one shorter than EJECT_IDLE_MS', () => {
  const now = Date.now()
  const browsers = new Map([
    ['a', now],
    ['b', now - 5_001],
  ])
  assert.deepEqual(present(browsers, now, 5_000), ['a'])
  assert.deepEqual(stale(browsers, now, 5_000), ['b'])
  assert.ok(alone(browsers, 'a', now, 5_000))
  // The same two, read by the default span, are both still present.
  assert.deepEqual(present(browsers, now).sort(), ['a', 'b'])
})

test('a room is not alone while a second browser is still present', () => {
  const now = Date.now()
  const browsers = new Map([
    ['a', now],
    ['b', now],
  ])
  assert.equal(alone(browsers, 'a', now), false)
  assert.equal(alone(browsers, 'b', now), false)
})

test('a browser never seen, or whose room it is not in, is alone to no one', () => {
  const now = Date.now()
  assert.equal(alone(new Map(), 'a', now), false)
})

test('eject forgets every stale browser and frees the member each leased, keeping the rest', () => {
  const now = Date.now()
  const browsers = new Map([
    ['a', now],
    ['b', now - EJECT_IDLE_MS - 1],
    ['c', now - EJECT_IDLE_MS - 1],
  ])
  const leases = new Map([
    ['camille', 'a'],
    ['sasha', 'b'],
  ])
  const gone = eject(browsers, leases, now)
  assert.deepEqual(gone.sort(), ['b', 'c'])
  assert.deepEqual([...browsers.keys()], ['a'])
  assert.equal(leases.get('camille'), 'a', 'a kept their lease; they were not stale')
  assert.equal(leases.has('sasha'), false, 'b’s lease was freed when b was ejected')
})

test('a member is leased to the first browser that takes it, and refused to a second', () => {
  const leases = new Map()
  assert.equal(lease(leases, 'camille', 'a'), null, 'the first browser is granted the lease')
  assert.equal(lease(leases, 'camille', 'b'), 'a', 'a second browser is refused, told who holds it')
  assert.equal(lease(leases, 'camille', 'a'), null, 'the same browser may renew its own lease')
  assert.ok(leased(leases, 'camille', 'b'), 'camille is leased to someone other than b')
  assert.equal(leased(leases, 'camille', 'a'), false, 'camille is not leased against a, who holds it')
})

test('releasing a browser frees every member it held and none other', () => {
  const leases = new Map([
    ['camille', 'a'],
    ['sasha', 'a'],
    ['toussaint', 'b'],
  ])
  release(leases, 'a')
  assert.deepEqual([...leases.keys()], ['toussaint'])
})
