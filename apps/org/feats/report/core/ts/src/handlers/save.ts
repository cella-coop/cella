import { check, type Analytics } from '@cella/org-analytics'
import type { Outcome } from '@cella/org-ops'
import { write, type Deps, type Write } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Save, Stored } from '../models/report.ts'

const op = 'report:report:save' satisfies keyof typeof ops

// Saves the actor's custom report on the verdict date, or saves it again
// over their own; a built-in report or another member's keeps its row,
// which the guard refuses.
export const saving = (input: Save, actor: string): Write<Stored> => ({
  op,
  request: { id: input.id, title: input.title, caption: input.caption, definition: input.definition },
  state: async (tx) => {
    await tx.query(
      `INSERT INTO report.report (id, title, caption, kind, definition, owner, saved)
       VALUES ($1, $2, $3, 'custom', $4, $5, cella.verdict_date())
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, caption = EXCLUDED.caption, definition = EXCLUDED.definition, saved = EXCLUDED.saved
       WHERE report.report.kind = 'custom' AND report.report.owner = EXCLUDED.owner`,
      [input.id, input.title, input.caption, JSON.stringify(input.definition), actor],
    )
    return { report: input.id }
  },
  payload: (v) => ({ ...v, title: input.title }),
})

// Saves a custom report once the port's catalog allows its definition: one
// the port would refuse is refused with every reason, and never saved.
export async function save(port: Analytics, input: Save, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Stored>> {
  const { chart, ...report } = input.definition
  const reasons = check(report, await port.catalog())
  const shown = [...(report.fields ?? []), ...Object.keys(report.measures ?? {})]
  for (const [what, field] of chart ? Object.entries(chart) : []) {
    if (!shown.includes(field)) {
      reasons.push(`chart ${what} ${field}: a chart reads a field or a measure the report shows`)
    }
  }
  if (reasons.length) {
    throw new Error(`the analytics port refuses this report: ${reasons.join('; ')}`)
  }
  return write(deps, saving(input, deps.actor))
}
