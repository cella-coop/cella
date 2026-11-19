import type { Component } from 'svelte'
import TextT from 'phosphor-svelte/lib/TextT'
import TextAa from 'phosphor-svelte/lib/TextAa'
import Code from 'phosphor-svelte/lib/Code'
import Money from 'phosphor-svelte/lib/Money'
import CalendarBlank from 'phosphor-svelte/lib/CalendarBlank'
import CalendarCheck from 'phosphor-svelte/lib/CalendarCheck'
import CalendarPlus from 'phosphor-svelte/lib/CalendarPlus'
import CalendarX from 'phosphor-svelte/lib/CalendarX'
import CalendarStar from 'phosphor-svelte/lib/CalendarStar'
import ClockCounterClockwise from 'phosphor-svelte/lib/ClockCounterClockwise'
import Hash from 'phosphor-svelte/lib/Hash'
import Tag from 'phosphor-svelte/lib/Tag'
import CircleHalf from 'phosphor-svelte/lib/CircleHalf'
import CellSignalHigh from 'phosphor-svelte/lib/CellSignalHigh'
import CheckSquare from 'phosphor-svelte/lib/CheckSquare'
import User from 'phosphor-svelte/lib/User'
import CirclesThree from 'phosphor-svelte/lib/CirclesThree'
import Percent from 'phosphor-svelte/lib/Percent'
import Clock from 'phosphor-svelte/lib/Clock'
import type { Kind } from './models/view.ts'

// The icon a field is marked by where it is named, as in the Filter menu:
// one per kind of value it holds, a field of no kind read as text.
export const glyphs: Record<Kind, Component<any>> = {
  text: TextT,
  title: TextAa,
  mono: Code,
  money: Money,
  date: CalendarBlank,
  number: Hash,
  badge: Tag,
  status: CircleHalf,
  priority: CellSignalHigh,
  boolean: CheckSquare,
  person: User,
  circle: CirclesThree,
  percent: Percent,
  hours: Clock,
}

// A day says which day it is by its glyph as its lead word does, read
// from its lead or else its name: when something began (created,
// issued, proposed, started), when it falls due (due, a deadline,
// closes), when it was carried through (completed, adopted), when it
// ended, and when it last changed.
const days: [RegExp, Component<any>][] = [
  [/^(created|issued|dated|proposed|started|opened|submitted|received|joined|invited|member|employed|uploaded|imported|tried|spent|worked|took|since|from|on)\b/i, CalendarPlus],
  [/^(due|deadline|closes|until|contract|by)\b/i, CalendarCheck],
  [/^(completed|adopted|approved|distributed|posted|paid)\b/i, CalendarStar],
  [/^(closed|ended|archived|voided|cancelled|exited|left|suspended)\b/i, CalendarX],
  [/^(updated|changed|last|saved)\b/i, ClockCounterClockwise],
]

export const glyph = (kind?: Kind, label?: string): Component<any> =>
  (kind === 'date' && label ? days.find(([re]) => re.test(label))?.[1] : undefined) ?? glyphs[kind ?? 'text']
