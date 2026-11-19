// demo-rooms's own logic, apart from any server: a join code is 128 bits
// and compared in constant time; a browser idle past its span is ejected
// from its room and the member it leased is freed; a room with more than
// one browser present is not alone; a room stays in a front's registry
// until it is unregistered, never only until its last browser is;
// joining a room already held is idempotent; a room's lifetime signal is
// accepted only as a safe integer and never clamped past `--lifetime`,
// nor ever moved later once held; and a room passes its age cap at twice
// `--lifetime` past when it was made, signed in or not.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  EJECT_IDLE_MS,
  alone,
  demoEndsAt,
  eject,
  joinCode,
  joining,
  lease,
  leased,
  present,
  register,
  registered,
  release,
  roomFull,
  sameCode,
  stale,
  tooOld,
  unregister,
} from '../demo-rooms.mjs'

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

test('a room is full once as many browsers are present as its cap, an idle one never counted', () => {
  const now = Date.now()
  const browsers = new Map([
    ['a', now],
    ['b', now],
    ['c', now - EJECT_IDLE_MS - 1],
  ])
  assert.equal(roomFull(browsers, 2, now), true, 'two present browsers fill a cap of two')
  assert.equal(roomFull(browsers, 3, now), false, 'the third is stale, not present, so the cap of three still has room')
  assert.equal(roomFull(new Map(), 1, now), false, 'an empty room is never full')
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

test('a room stays in the registry once its last browser’s cookie is gone, until it is explicitly unregistered', () => {
  const registry = new Map()
  const cookies = new Map() // a front's own cookie -> room, apart from the registry
  const room = { name: 'demo_v_abc' }
  register(registry, room.name, room)
  cookies.set('cookie-a', room)
  // A browser gone to another room, as a front's join does: the room keeps
  // no cookie naming it, but the registry still holds it.
  cookies.delete('cookie-a')
  assert.deepEqual(registered(registry), new Set([room]), 'an orphaned room fell out of the registry')
  unregister(registry, room.name)
  assert.deepEqual(registered(registry), new Set(), 'unregistering it leaves the registry empty')
})

test('a registry holds more than one room at once, each by its own id', () => {
  const registry = new Map()
  const a = { name: 'a' }
  const b = { name: 'b' }
  register(registry, 'a', a)
  register(registry, 'b', b)
  assert.deepEqual(registered(registry), new Set([a, b]))
  unregister(registry, 'a')
  assert.deepEqual(registered(registry), new Set([b]))
})

test('joining the room a browser is already in is idempotent; a different one switches it; none is a fresh join', () => {
  const roomA = { name: 'a' }
  const roomB = { name: 'b' }
  assert.equal(joining(roomA, roomA), 'same')
  assert.equal(joining(roomA, roomB), 'switch')
  assert.equal(joining(null, roomB), 'fresh')
})

test('a lifetime signal within --lifetime is taken as told, in milliseconds', () => {
  const now = Date.now()
  const lifetime = 7200
  const until = Math.floor(now / 1000) + 60
  assert.equal(demoEndsAt(String(until), now, lifetime), until * 1000)
})

test('a lifetime signal past --lifetime is clamped to it, never later', () => {
  const now = Date.now()
  const lifetime = 7200
  const until = Math.floor(now / 1000) + lifetime + 3600
  assert.equal(demoEndsAt(String(until), now, lifetime), now + lifetime * 1000)
})

test('a lifetime signal that is not a positive safe integer is refused, null', () => {
  const now = Date.now()
  for (const until of [undefined, '', 'soon', '12.5', '0', '-1', String(Number.MAX_SAFE_INTEGER + 1), 'NaN', 'Infinity']) {
    assert.equal(demoEndsAt(until, now, 7200), null, until)
  }
})

test('a lifetime signal already past is kept, so the room ends at once', () => {
  const now = Date.now()
  const until = Math.floor(now / 1000) - 60
  assert.equal(demoEndsAt(String(until), now, 7200), until * 1000)
})

test('a room is too old at twice --lifetime past when it was made, not before', () => {
  const made = Date.now()
  const lifetime = 7200
  assert.equal(tooOld(made, made + 2 * lifetime * 1000 - 1, lifetime), false)
  assert.equal(tooOld(made, made + 2 * lifetime * 1000 + 1, lifetime), true)
})
