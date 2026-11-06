import { defaults, exposure, levels, residual, settings, type Disclosure, type Setting } from '../models/disclosure.ts'

// The Open books form's values as typed, starting at those in force or
// else the study's defaults, and each setting said in full: its value in
// force, the value proposed, and whether that exposes personal data and
// why, so a value that exposes is marked before it is proposed; last,
// the rule no value turns off.
export class DisclosureState {
  readonly #disclosure: () => Disclosure
  contributors = $state<number | string>(defaults.contributors)
  largest = $state<number | string>(defaults.largest)
  two = $state<number | string>(defaults.two)

  constructor(disclosure: () => Disclosure) {
    this.#disclosure = disclosure
    const v = disclosure().values ?? defaults
    this.contributors = v.contributors
    this.largest = v.largest
    this.two = v.two
  }

  items = $derived.by(() => {
    const standing = this.#disclosure().values
    const typed: Record<Setting, number | boolean> = {
      share: true,
      contributors: Number(this.contributors),
      largest: Number(this.largest),
      two: Number(this.two),
    }
    const shown = (s: Setting, v: number | boolean | null) =>
      s === 'share' ? (v ? 'On' : 'Off') : v === null ? '—' : s === 'contributors' ? `${v}` : `${v} %`
    return [
      ...settings.map(({ setting, label, range }) => {
        const { level, words } = exposure(setting, typed[setting])
        return {
          key: setting,
          label,
          sub: range,
          values: [
            { label: 'In force', value: shown(setting, setting === 'share' ? standing !== null : (standing?.[setting] ?? null)) },
            { label: 'Proposed', value: shown(setting, typed[setting]) },
          ],
          badge: levels[level],
          text: words,
        }
      }),
      residual,
    ]
  })
}
