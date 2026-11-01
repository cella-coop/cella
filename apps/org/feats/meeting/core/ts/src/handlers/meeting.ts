import type { Outcome } from '@cella/org-ops'
import { write, type Deps, type Write } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Add, Added, Minute, Minuted, Move, Moved, Remove, Removed, Schedule, Scheduled, Settle, Settled } from '../models/meeting.ts'

type Op = keyof typeof ops
type Out<O extends Op, T> = Promise<Outcome<(typeof ops)[O], T>>

// Schedules a meeting of a circle. Its id is the circle and the day, with
// a number after it for a second meeting that day. Whether the circle
// exists, and whether the actor's power reaches it, are the grafts' guards
// on the op.
export async function schedule(input: Schedule, deps: Deps): Out<'meeting:meeting:schedule', Scheduled> {
  return write(deps, {
    op: 'meeting:meeting:schedule' satisfies Op,
    request: input,
    state: async (tx) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day) || !/^\d{2}:\d{2}$/.test(input.time)) {
        throw new Error(`“${input.day} ${input.time}” is not a day and a time`)
      }
      const base = `${input.circle}-${input.day}`
      const { rows: taken } = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM meeting.meeting WHERE id = $1 OR id ~ ('^' || $1 || '-[0-9]+$')`,
        [base],
      )
      const id = taken[0].n ? `${base}-${taken[0].n + 1}` : base
      const { rows } = await tx.query<{ at: string }>(
        `INSERT INTO meeting.meeting (id, circle, title, at, place, link, scheduled)
         VALUES ($1, $2, $3, ($4 || ' ' || $5)::timestamp, $6, $7, cella.verdict_date())
         RETURNING to_char(at, 'YYYY-MM-DD"T"HH24:MI') AS at`,
        [id, input.circle, input.title, input.day, input.time, input.place ?? '', input.link || null],
      )
      return { meeting: id, circle: input.circle, at: rows[0].at }
    },
    payload: (v) => ({ ...v }),
  })
}

// Adds an item at the end of the agenda. A graft that ties the item to
// something of its own, as a decision it tables, runs this in its own
// write.
export const adding = (input: Add): Write<Added> => ({
  op: 'meeting:item:add' satisfies Op,
  request: input,
  state: async (tx) => {
    const { rows } = await tx.query<{ id: string }>(
      `INSERT INTO meeting.item (meeting, pos, title, presenter, minutes)
       SELECT $1, coalesce(max(pos), 0) + 1, $2, $3, $4 FROM meeting.item WHERE meeting = $1
       RETURNING id::text AS id`,
      [input.meeting, input.title, input.presenter ?? '', input.minutes ?? null],
    )
    return { meeting: input.meeting, item: Number(rows[0].id) }
  },
  payload: (v) => ({ ...v }),
})

export async function add(input: Add, deps: Deps): Out<'meeting:item:add', Added> {
  return write(deps, adding(input))
}

// Moves an item to an index of the agenda: its position becomes the
// midpoint of its new neighbours', so only its own row changes.
export async function move(input: Move, deps: Deps): Out<'meeting:item:move', Moved> {
  return write(deps, {
    op: 'meeting:item:move' satisfies Op,
    request: input,
    state: async (tx) => {
      const { rows: others } = await tx.query<{ pos: number }>(
        'SELECT pos FROM meeting.item WHERE meeting = $1 AND id <> $2 ORDER BY pos, id',
        [input.meeting, input.item],
      )
      const to = Math.max(0, Math.min(input.to, others.length))
      const before = others[to - 1]?.pos
      const after = others[to]?.pos
      const pos = before !== undefined && after !== undefined ? (before + after) / 2 : before !== undefined ? before + 1 : after !== undefined ? after - 1 : 1
      const { rowCount } = await tx.query('UPDATE meeting.item SET pos = $3 WHERE meeting = $1 AND id = $2', [input.meeting, input.item, pos])
      if (!rowCount) {
        throw new Error(`${input.meeting} has no item ${input.item}`)
      }
      return { meeting: input.meeting, item: input.item, pos }
    },
    payload: (v) => ({ ...v }),
  })
}

export async function remove(input: Remove, deps: Deps): Out<'meeting:item:remove', Removed> {
  return write(deps, {
    op: 'meeting:item:remove' satisfies Op,
    request: input,
    state: async (tx) => {
      const { rowCount } = await tx.query('DELETE FROM meeting.item WHERE meeting = $1 AND id = $2', [input.meeting, input.item])
      if (!rowCount) {
        throw new Error(`${input.meeting} has no item ${input.item}`)
      }
      return { meeting: input.meeting, item: input.item }
    },
    payload: (v) => ({ ...v }),
  })
}

// Holds or cancels a scheduled meeting on the verdict date. Ordered: the
// first to settle stands, and the feat's trigger refuses the second.
function settle(op: 'meeting:meeting:hold' | 'meeting:meeting:cancel', status: 'held' | 'cancelled') {
  return (input: Settle, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Settled>> =>
    write(deps, {
      op,
      request: input,
      state: async (tx) => {
        const { rows } = await tx.query<{ settled: string }>(
          `UPDATE meeting.meeting SET status = $2, settled = cella.verdict_date()
           WHERE id = $1 RETURNING to_char(settled, 'YYYY-MM-DD') AS settled`,
          [input.meeting, status],
        )
        if (!rows[0]) {
          throw new Error(`no meeting ${input.meeting}`)
        }
        return { meeting: input.meeting, status, settled: rows[0].settled }
      },
      payload: (v) => ({ ...v }),
    })
}

export const hold = settle('meeting:meeting:hold', 'held')
export const cancel = settle('meeting:meeting:cancel', 'cancelled')

// Begins the minutes on the verdict date; begun again, the first day
// stands. A graft that keeps the minutes somewhere, as a document, runs
// this in its own write.
export const minuting = (input: Minute): Write<Minuted> => ({
  op: 'meeting:meeting:minute' satisfies Op,
  request: input,
  state: async (tx) => {
    const { rows } = await tx.query<{ minuted: string }>(
      `UPDATE meeting.meeting SET minuted = coalesce(minuted, cella.verdict_date())
       WHERE id = $1 RETURNING to_char(minuted, 'YYYY-MM-DD') AS minuted`,
      [input.meeting],
    )
    if (!rows[0]) {
      throw new Error(`no meeting ${input.meeting}`)
    }
    return { meeting: input.meeting, minuted: rows[0].minuted }
  },
  payload: (v) => ({ ...v }),
})

export async function minute(input: Minute, deps: Deps): Out<'meeting:meeting:minute', Minuted> {
  return write(deps, minuting(input))
}
