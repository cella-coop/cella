import type { Week } from '../models/week.ts'

// Which of the acting worker's weeks the grid shows: this one, or the one
// before.
export class WeekState {
  shown = $state(0)
  readonly #weeks: () => Week[]

  constructor(weeks: () => Week[]) {
    this.#weeks = weeks
  }

  week = $derived.by((): Week | null => this.#weeks()[this.shown] ?? this.#weeks()[0] ?? null)

  show(i: number) {
    this.shown = i
  }
}
