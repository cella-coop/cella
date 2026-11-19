import { icons, type App, type Tone } from '@cella/org-ui'
import { stage, type Detail, type Distribution } from '../models/distribution.ts'
import { divides, type Terms } from '../models/terms.ts'
import type { Sheet, Statement } from '../models/statement.ts'
import Shares from './blocks/Shares.svelte'
import Basis from './blocks/Basis.svelte'
import Divides from './blocks/Divides.svelte'
import Draft from './blocks/Draft.svelte'
import BodyDistribution from './blocks/BodyDistribution.svelte'
import BodyTerms from './blocks/BodyTerms.svelte'

const tones: Record<ReturnType<typeof stage>, Tone> = { draft: 'neutral', approved: 'accent', distributed: 'positive' }
// A row as its collection lists it: its state, and how terms divide, as
// the list shows them.
type Staged = Distribution & { state: ReturnType<typeof stage> }
type Divided = Omit<Terms, 'basis'> & { basis: string; state: string }

// The feat's client side: each year's distribution, opening on its split,
// the statutes' terms for the work share, opening on their clauses, and
// each worker's statement of their part, opening on it basis by basis;
// each page's notes at the foot of its panels.
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
        // One a year: a list, the latest first.
        look: { layout: 'list' },
      },
      page: {
        eyebrow: 'Distribution',
        title: (d: Detail) => `${d.year} distribution`,
        subtitle: (d: Detail) => d.id,
        properties: (d: Detail) => [
          { label: 'State', value: stage(d), kind: 'badge', tone: tones[stage(d)] },
          { label: 'Work share by', value: d.basis, kind: 'badge', lead: 'work share by' },
          { label: 'Approved on', value: d.approved, kind: 'date', lead: 'approved' },
          { label: 'Distributed on', value: d.distributed, kind: 'date', lead: 'distributed' },
        ],
        // Its split on its overview; how the work share would divide by
        // each basis, worker by worker, in a tab its extenders fill.
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'split', label: 'By basis' },
          { id: 'return', label: 'Return' },
        ],
        related: (d: Detail) => (d.approved ? [{ label: `${d.year} statements`, sub: 'each worker’s part', href: '/statements' }] : []),
        layout: 'panels',
        body: BodyDistribution,
        blocks: [Shares],
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
        // Its year is its title's, its day of adoption and its shares the
        // Clauses panel's, said as the statutes say them.
        properties: (t: Terms) => [{ label: 'As the rule', value: t.policy, kind: 'mono', glyph: icons.Scales, lead: 'rule' }],
        layout: 'panels',
        body: BodyTerms,
        blocks: [Divides],
      },
    },
    statements: {
      view: {
        title: 'Statements',
        caption: 'Each worker’s part of each year’s work share',
        icon: icons.Receipt,
        columns: [
          { key: 'name', label: 'Worker', kind: 'title', role: 'title', value: (s: Statement & { name?: string }) => s.name ?? s.worker },
          { key: 'year', label: 'Year', kind: 'badge', role: 'hidden', value: (s: Statement) => String(s.year) },
          { key: 'worker', label: 'Person', kind: 'person', role: 'hidden', value: (s: Statement) => s.worker },
          { key: 'salary', label: 'By pay', kind: 'money', role: 'hidden', value: (s: Statement) => s.salary },
          { key: 'hours', label: 'By time', kind: 'money', role: 'hidden', value: (s: Statement) => s.hours },
          { key: 'equal', label: 'Equal', kind: 'money', role: 'hidden', value: (s: Statement) => s.equal },
          { key: 'amount', label: 'Part', kind: 'money', role: 'meta', value: (s: Statement) => s.amount },
        ],
        // Each year's work share, the latest first, its largest part first.
        look: { layout: 'list', by: 'year', sort: { field: 'amount', dir: 'desc' } },
        empty: 'A statement is drawn for each worker when the assembly approves a year’s distribution.',
      },
      page: {
        eyebrow: 'Statement',
        title: (s: Sheet) => `${s.year} work share statement`,
        subtitle: (s: Sheet) => s.id,
        // Its year is its title's.
        properties: (s: Sheet) => [
          { label: 'Terms', value: s.terms ? `${s.terms.id}, ${divides[s.terms.basis]}` : null, href: s.terms ? `/bases/${s.terms.id}` : undefined, lead: 'under' },
          { label: 'Approved on', value: s.approved, kind: 'date', lead: 'approved' },
          { label: 'Distributed on', value: s.distributed, kind: 'date', lead: 'distributed' },
        ],
        related: (s: Sheet) => [{ label: `${s.year} distribution`, sub: 'the split', href: `/distributions/${s.distribution}` }],
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'employed', label: 'Employed' },
        ],
        layout: 'panels',
        blocks: [Basis],
      },
    },
  },
}
