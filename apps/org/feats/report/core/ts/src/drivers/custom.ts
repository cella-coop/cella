import type { Analytics, Head } from '@cella/org-analytics'
import type { Custom, Saved } from '../models/report.ts'

// A custom report run as its definition says, and its chart's bars: one
// for each row, labelled by the field it runs over and as long as the
// measure or field it measures.
export async function custom(port: Analytics, definition: Saved): Promise<{ head: Head; custom: Custom }> {
  const { chart, ...report } = definition
  const result = await port.run(report)
  const bars = chart ? result.rows.map((r) => ({ label: String(r[chart.by] ?? '—'), value: Number(r[chart.value] ?? 0) })) : []
  return { head: result.head, custom: { result, bars } }
}
