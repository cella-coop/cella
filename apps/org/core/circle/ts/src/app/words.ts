import { money } from '@cella/org-ui'
import type { Standing } from '../models/circle.ts'

// A mandate's cap in words: a limit a write, a budget a period, or none.
export const cap = (m: Pick<Standing, 'limit' | 'budget' | 'per'>) =>
  m.limit !== null ? `up to ${money(m.limit)} a write` : m.budget !== null ? `within ${money(m.budget)} a ${m.per}` : 'uncapped'

// What a mandate covers in words.
export const covers = (m: Pick<Standing, 'scope'>) => (m.scope === null ? 'the whole co-op' : m.scope === 'own' ? 'its own circle' : m.scope)

// How a link of a chain narrows the one above it, in words: a smaller
// cap, a narrower scope, a later start, an earlier end; none where it is
// as wide.
export function narrows(k: Standing, above: Standing): string[] {
  return [
    ...(cap(k) !== cap(above) ? ['smaller cap'] : []),
    ...(k.scope !== above.scope ? [`${covers(k)} alone`] : []),
    ...(k.from > above.from ? ['starts later'] : []),
    ...(k.until !== null && (above.until === null || k.until < above.until) ? ['ends sooner'] : []),
  ]
}
