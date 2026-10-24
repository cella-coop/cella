import type { Form } from '@cella/org-db'
import type { Add, Move, Remove, Schedule } from '../models/meeting.ts'

// What the shell's forms send, read into the handlers' inputs.

export const schedule = (form: Form): Schedule => ({
  circle: form.get('circle'),
  title: form.get('title'),
  day: form.get('day'),
  time: form.get('time'),
  place: form.get('place') || undefined,
  link: form.get('link') || undefined,
})

const minutes = (typed: string): number | undefined => {
  if (!typed.trim()) {
    return undefined
  }
  const n = Number(typed)
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`“${typed}” is not a number of minutes`)
  }
  return n
}

export const add = (form: Form, meeting: string): Add => ({
  meeting,
  title: form.get('title'),
  presenter: form.get('presenter') || undefined,
  minutes: minutes(form.get('minutes')),
})

// The agenda's drop posts the item and the index it lands at.
export const move = (form: Form, meeting: string): Move => ({ meeting, item: Number(form.get('item')), to: Number(form.get('to')) })

export const remove = (form: Form, meeting: string): Remove => ({ meeting, item: Number(form.get('item')) })
