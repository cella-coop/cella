import { icons, type App, type Tone } from '@cella/org-ui'
import { stage, type Detail, type Distribution } from '../models/distribution.ts'
import { divides, type Terms } from '../models/terms.ts'
import type { Sheet, Statement } from '../models/statement.ts'
import Shares from './blocks/Shares.svelte'
import Basis from './blocks/Basis.svelte'
import Draft from './blocks/Draft.svelte'

const tones: Record<ReturnType<typeof stage>, Tone> = { draft: 'neutral', approved: 'accent', distributed: 'positive' }
// A row as its collection lists it: its state, and how terms divide, as
// the list shows them.
type Staged = Distribution & { state: ReturnType<typeof stage> }
type Divided = Omit<Terms, 'basis'> & { basis: string; state: string }

// The feat's client side: each year's distribution, its split in a tab of
// its own, the statutes' terms for the work share, and each worker's
// statement of their part, basis by basis in a tab of its own.
export const app: App = {
  name: 'patronage',
  collections: {
    distributions: {
      view: {
        title: 'Distributions',
        caption: 'Each year’s surplus, split as the statutes and the law require',
        icon: icons.ChartPie,
        create: Draft,
        columns: [
          { key: 'year', label: 'Year', kind: 'title', role: 'title', value: (d: Distribution) => String(d.year) },
          { key: 'surplus', label: 'Surplus', kind: 'money', role: 'meta', value: (d: Distribution) => d.surplus },
          { key: 'work', label: 'Work share', kind: 'money', role: 'hidden', value: (d: Distribution) => d.work },
          { key: 'legal', label: 'Legal reserve', kind: 'money', role: 'hidden', value: (d: Distribution) => d.legal },
          { key: 'development', label: 'Development fund', kind: 'money', role: 'hidden', value: (d: Distribution) => d.development },
          { key: 'interest', label: 'Interest', kind: 'money', role: 'hidden', value: (d: Distribution) => d.interest },
          { key: 'basis', label: 'Work share by', kind: 'badge', role: 'hidden', value: (d: Distribution) => d.basis },
          { key: 'state', label: 'State', kind: 'badge', role: 'meta', value: (d: Staged) => d.state, tone: (d: Staged) => tones[d.state] },
        ],
        look: { layout: 'table' },
      },
      page: {
        eyebrow: 'Distribution',
        title: (d: Detail) => `${d.year} distribution`,
        subtitle: (d: Detail) => d.id,
        properties: (d: Detail) => [
          { label: 'State', value: stage(d), kind: 'badge', tone: tones[stage(d)] },
          { label: 'Surplus', value: d.surplus, kind: 'money' },
          { label: 'Work share by', value: d.basis, kind: 'badge' },
          { label: 'Approved on', value: d.approved, kind: 'date' },
          { label: 'Distributed on', value: d.distributed, kind: 'date' },
        ],
        // Its split in a tab of its own, where its extenders add how the
        // work share would divide by each basis.
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'split', label: 'Split' },
          { id: 'return', label: 'Return' },
        ],
        related: (d: Detail) => (d.approved ? [{ label: `${d.year} statements`, sub: 'each worker’s part', href: '/statements' }] : []),
        blocks: [{ tab: 'split', block: Shares }],
      },
    },
    bases: {
      view: {
        title: 'Patronage',
        caption: 'The statutes’ terms for the work share: how it divides, what of it buys shares, and the most interest capital earns',
        icon: icons.SealCheck,
        columns: [
          { key: 'from', label: 'From', kind: 'title', role: 'title', value: (t: Terms) => String(t.from) },
          { key: 'basis', label: 'Divides', role: 'sub', value: (t: Divided) => t.basis },
          { key: 'capital', label: 'In shares %', kind: 'number', role: 'hidden', value: (t: Terms) => t.capital },
          { key: 'interest', label: 'Interest at most %', kind: 'number', role: 'hidden', value: (t: Terms) => t.interest },
          { key: 'adopted', label: 'Adopted on', kind: 'date', role: 'hidden', value: (t: Terms) => t.adopted },
          { key: 'state', label: 'State', kind: 'badge', role: 'meta', value: (t: Divided) => t.state, tone: (t: Divided) => (t.state === 'governing' ? 'positive' : 'neutral') },
        ],
      },
      page: {
        eyebrow: 'Patronage terms',
        title: (t: Terms) => `Patronage terms from ${t.from}`,
        subtitle: (t: Terms) => t.id,
        properties: (t: Terms) => [
          { label: 'From', value: String(t.from) },
          { label: 'As the rule', value: t.policy, kind: 'mono' },
          { label: 'By pay %', value: t.salary, kind: 'number' },
          { label: 'By time worked %', value: t.hours, kind: 'number' },
          { label: 'In equal parts %', value: t.equal, kind: 'number' },
          { label: 'Employed in shares %', value: t.capital, kind: 'number' },
          { label: 'Interest on capital at most %', value: t.interest, kind: 'number' },
          { label: 'Adopted on', value: t.adopted, kind: 'date' },
        ],
      },
    },
    statements: {
      view: {
        title: 'Statements',
        caption: 'Each worker’s part of each year’s work share',
        icon: icons.Receipt,
        columns: [
          { key: 'year', label: 'Year', kind: 'title', role: 'title', value: (s: Statement) => String(s.year) },
          { key: 'worker', label: 'Worker', kind: 'person', role: 'sub', value: (s: Statement) => s.worker },
          { key: 'salary', label: 'By pay', kind: 'money', role: 'hidden', value: (s: Statement) => s.salary },
          { key: 'hours', label: 'By time', kind: 'money', role: 'hidden', value: (s: Statement) => s.hours },
          { key: 'equal', label: 'Equal', kind: 'money', role: 'hidden', value: (s: Statement) => s.equal },
          { key: 'amount', label: 'Part', kind: 'money', role: 'meta', value: (s: Statement) => s.amount },
        ],
        look: { layout: 'table' },
        empty: 'A statement is drawn for each worker when the assembly approves a year’s distribution.',
      },
      page: {
        eyebrow: 'Statement',
        title: (s: Sheet) => `${s.year} work share statement`,
        subtitle: (s: Sheet) => s.id,
        properties: (s: Sheet) => [
          { label: 'Year', value: String(s.year) },
          { label: 'Part', value: s.amount, kind: 'money' },
          { label: 'Terms', value: s.terms ? `${s.terms.id}, ${divides[s.terms.basis]}` : null, href: s.terms ? `/bases/${s.terms.id}` : undefined },
          { label: 'Approved on', value: s.approved, kind: 'date' },
          { label: 'Distributed on', value: s.distributed, kind: 'date' },
        ],
        related: (s: Sheet) => [{ label: `${s.year} distribution`, sub: 'the split', href: `/distributions/${s.distribution}` }],
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'basis', label: 'By basis' },
          { id: 'employed', label: 'Employed' },
        ],
        blocks: [{ tab: 'basis', block: Basis }],
      },
    },
  },
}
