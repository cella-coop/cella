import type { Tone } from '@cella/org-ui'

// Open books' disclosure values, as core copies them from the
// assembly's rule (`circle.disclosed`): the fewest people a total of
// members' own figures may count, and the most of it one person, and two,
// may put in, in percent.
export interface Values {
  contributors: number
  largest: number
  two: number
}

// The rule in force on the verdict date, if any: its policy, the motion
// that adopted it, the day it applies from and its values. None where
// the co-op shares no such total beyond each reader's own rights.
export interface Disclosure {
  policy: string | null
  motion: string | null
  from: string | null
  values: Values | null
}

// What the disclosure study recommends, the values a new rule starts at.
export const defaults: Values = { contributors: 5, largest: 50, two: 80 }

// How a value bears on a member's figures: with it a member can work it
// out from the totals alone; it hides fewer totals than the study
// recommends; or it is the default or stricter, which is still no
// promise. No value is safe.
export type Level = 'exposes' | 'weaker' | 'precaution'

export const levels: Record<Level, { label: string; tone: Tone }> = {
  exposes: { label: 'Exposes personal data', tone: 'warning' },
  weaker: { label: 'Weaker than the default', tone: 'warning' },
  precaution: { label: 'A precaution, not a promise', tone: 'neutral' },
}

export type Setting = 'share' | keyof Values

// Each setting the Open books page shows, its label, and its default and
// range as the study gives them and `circle_policy.disclosure_flaw` holds them.
export const settings: { setting: Setting; label: string; range: string }[] = [
  { setting: 'share', label: 'Share totals of members’ own figures', range: 'off by default' },
  { setting: 'contributors', label: 'Fewest people in a total', range: '5 by default, from 2 to 200' },
  { setting: 'largest', label: 'Most of a total one person may put in', range: '50 % by default, from 20 % to 100 %' },
  { setting: 'two', label: 'Most of a total two people may put in', range: '80 % by default, from 40 % to 100 %' },
]

// Whether a value exposes personal data and why, in the disclosure
// study's plain words (`_corpus/review/2026-11-05/disclosure.md`), for a
// member who is no statistician. `share` is whether a rule stands at all.
export function exposure(setting: Setting, value: number | boolean | null): { level: Level; words: string } {
  if (setting === 'share') {
    return value
      ? {
          level: 'exposes',
          words:
            'Other members may work out a person’s figure from these totals, even when small groups are hidden. Check what is published together before sharing.',
        }
      : { level: 'precaution', words: 'Only figures each member already has a right to see are shown: their own, and their circles’.' }
  }
  const n = Number(value)
  if (setting === 'contributors') {
    if (n <= 2) {
      return { level: 'exposes', words: 'At two, each of the two can work out the other’s exact amount.' }
    }
    if (n < defaults.contributors) {
      return {
        level: 'weaker',
        words: `A total of ${n} people is shown; three or four expose more than five: any of them who know the others’ amounts work out the last one’s.`,
      }
    }
    return {
      level: 'precaution',
      words: `A total fewer than ${n} people put into is hidden from members without a right to its rows. Knowing other people’s amounts can still reveal yours.`,
    }
  }
  const [base, who, whose] = setting === 'largest' ? [defaults.largest, 'one person’s amount is', 'one person’s'] : [defaults.two, 'two people’s amounts together are', 'two people’s']
  if (n >= 100) {
    return {
      level: 'exposes',
      words: `100 % turns this check off: a total that is almost all ${whose} is shown, and the others’ known amounts give it away.`,
    }
  }
  if (n > base) {
    return { level: 'weaker', words: `A total is hidden only where ${who} more than ${n} % of it; ${base} % hides more.` }
  }
  return {
    level: 'precaution',
    words:
      setting === 'largest'
        ? `A total is hidden where one person’s amount is more than ${n} % of it. Use it with the fewest people, never instead.`
        : `A total is hidden where two people’s amounts together are more than ${n} % of it. It does not stop two members who compare amounts from learning the rest.`,
  }
}

// The rule no value turns off, which the page states last.
export const residual = {
  key: 'release',
  label: 'Totals checked against each other',
  sub: 'no setting turns this on',
  values: [] as { label: string; value: string }[],
  badge: { label: 'Not checked', tone: 'warning' as Tone },
  text: 'Hiding a total inside one report is not enough if another report, or the same report another month, lets someone subtract it back. The co-op’s books do not check reports against each other, and no setting stops someone using what they know outside the books.',
}
