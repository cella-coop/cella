// The changes to propose: a setting's change that only a motion makes,
// gathered rather than proposed at once, one basket for each circle that
// decides, since one motion goes to one circle. A basket gathers across
// the settings pages, each change named by its page, the one thing the
// page is of and its setting, and is kept for the session in a cookie
// (`cella-basket`), which a sign-in clears. Review proposes a basket as
// one motion carrying every change, each of which the server turns into
// the action its page proposes.

import type { Decider } from './settings.ts'

// How a change is shown as a diff: an arrangement as its tree, or a value
// from the one in force to the one typed.
export type Shape = 'arrangement' | 'value'

// One change: where it is made, what it changes from and to, what a
// motion's title says of it, and how it is shown; the words its values
// read as where they are a choice's value, as a procedure's.
export interface Change {
  page: string
  id: string
  field: string
  label: string
  // Whose setting it is, as the page heads it, as a circle's name.
  where?: string
  was: string
  value: string
  title: string
  shape: Shape
  shown?: { was: string; value: string }
}

export interface Basket {
  circle: string
  name: string
  deadline: string
  changes: Change[]
}

export const same = (a: Pick<Change, 'page' | 'id' | 'field'>, b: Pick<Change, 'page' | 'id' | 'field'>) =>
  a.page === b.page && a.id === b.id && a.field === b.field

// The baskets with a change put in the deciding circle's, replacing the
// one it made before to the same setting, or taking that one out where
// the value is the one in force again; a basket left empty goes.
export function put(baskets: Basket[], decider: Decider, change: Change): Basket[] {
  const back = change.value === change.was
  const found = baskets.find((b) => b.circle === decider.circle)
  const changes = (found?.changes ?? []).filter((c) => !same(c, change))
  const next = back ? changes : [...changes, change]
  const others = baskets.filter((b) => b.circle !== decider.circle)
  if (!next.length) {
    return others
  }
  const basket = { circle: decider.circle, name: decider.name, deadline: found?.deadline ?? decider.deadline, changes: next }
  return found ? baskets.map((b) => (b.circle === decider.circle ? basket : b)) : [...baskets, basket]
}

// A change taken out of its basket, or a whole basket discarded.
export function removed(baskets: Basket[], circle: string, change?: Change): Basket[] {
  return baskets
    .map((b) => (b.circle === circle ? { ...b, changes: change ? b.changes.filter((c) => !same(c, change)) : [] } : b))
    .filter((b) => b.changes.length > 0)
}

// The change waiting to a setting, wherever it waits.
export function waiting(baskets: Basket[], at: Pick<Change, 'page' | 'id' | 'field'>): Change | null {
  for (const b of baskets) {
    const c = b.changes.find((x) => same(x, at))
    if (c) {
      return c
    }
  }
  return null
}

// The title of a basket's motion: its one change's, or each one's joined
// while they read in one line, else how many changes it proposes.
export function titled(b: Basket): string {
  if (b.changes.length === 1) {
    return b.changes[0]!.title
  }
  const joined = b.changes.map((c, i) => (i === 0 ? c.title : c.title.charAt(0).toLowerCase() + c.title.slice(1))).join('; ')
  return joined.length <= 90 ? joined : `${b.changes.length} changes to ${b.name}'s settings`
}

// What the proposal posts of its changes: where each is made and its
// value, which the server turns into the actions, never the client.
export const posted = (b: Basket) => JSON.stringify(b.changes.map((c) => ({ page: c.page, id: c.id, field: c.field, value: c.value })))

// The baskets as their cookie spells them, and read back; a cookie
// unreadable or of another shape reads as none.
export const spelt = (baskets: Basket[]) => encodeURIComponent(JSON.stringify(baskets))

export function read(cookie: string | undefined): Basket[] {
  if (!cookie) {
    return []
  }
  try {
    const v = JSON.parse(decodeURIComponent(cookie))
    return Array.isArray(v) ? v.filter((b) => b && typeof b.circle === 'string' && Array.isArray(b.changes)) : []
  } catch {
    return []
  }
}
