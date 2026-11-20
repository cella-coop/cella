import type { Keep } from '@cella/org-db'
import { PAGE, type Field, type Sort, type Spec } from '@cella/org-ui/models'

// How many rows a list, a table or a gallery draws at most: "Show more"
// asks for the next page in the address (`n`).
const MOST = 5000

// How many rows the address asks to draw.
export const drawn = (query: URLSearchParams): number => {
  const n = Number(query.get('n'))
  return Number.isInteger(n) && n > PAGE ? Math.min(n, MOST) : PAGE
}

// The rows a view keeps: its conditions, its text filter over every
// column the collection shows, and the order it sorts them in, then the
// tiebreak the collection's look declares, where it is one of its fields.
export const keeping = (spec: Pick<Spec, 'where' | 'q' | 'sort'>, fs: Field[], then?: Sort): Keep => ({
  where: spec.where,
  ...(spec.q.trim() ? { q: { text: spec.q, keys: fs.map((f) => f.key) } } : {}),
  ...(spec.sort ? { sort: spec.sort } : {}),
  ...(then && fs.some((f) => f.key === then.field) ? { then } : {}),
})
