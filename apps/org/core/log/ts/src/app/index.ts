import { icons, short, type App } from '@cella/org-ui'
import { said } from '../models/activity.ts'
import type { Detail, Entry, Head } from '../models/log.ts'
import Guards from './blocks/Guards.svelte'

const owners = (e: Entry) => e.guards.map((r) => r.owner).join(', ')

// The log's client side: Activity, a feed of who did what and when, newest
// first, each line linking to its record, and the whole log's verifying;
// and each entry's page, its receipt, signatures and deciding guards.
export const app: App = {
  name: 'log',
  collections: {
    log: {
      view: {
        group: 'home',
        title: 'Activity',
        icon: icons.Notebook,
        caption: 'Who did what, and when, as the notary signed it.',
        // `cella.verify_log()` rechecks every entry, receipt and signature on
        // each load.
        status: (head: Head) =>
          head.verified ? { label: 'log verifies', tone: 'positive' } : { label: 'log broken', tone: 'negative' },
        dashboard: [
          { kind: 'kpi', title: 'Entries', measure: { op: 'count' } },
          { kind: 'kpi', title: 'This month', measure: { op: 'count' }, where: [{ field: 'date', within: 'month' }] },
          { kind: 'chart', title: 'Entries by month', measure: { op: 'count' }, by: 'date' },
        ],
        look: { layout: 'feed' },
        empty: 'No write has reached the notary yet: the seed is the state before the log.',
        columns: [
          { key: 'what', label: 'What', role: 'title', value: (e: Entry) => said(e.op, e.records).text },
          { key: 'actor', label: 'Who', kind: 'person', role: 'sub', value: (e: Entry) => e.actor },
          { key: 'op', label: 'Op', kind: 'mono', role: 'hidden', value: (e: Entry) => e.op },
          { key: 'n', label: 'Entry', kind: 'number', role: 'hidden', value: (e: Entry) => e.n },
          { key: 'guards', label: 'Decided by', role: 'hidden', value: owners },
          { key: 'receipt', label: 'Receipt', kind: 'number', role: 'hidden', value: (e: Entry) => e.receipt },
          { key: 'date', label: 'Verdict date', kind: 'date', role: 'meta', value: (e: Entry) => e.date },
        ],
        // A line opens the record it is about, or the entry where it names
        // none the shell shows.
        href: (e: Entry) => said(e.op, e.records).href ?? `/log/${e.n}`,
      },
      page: {
        eyebrow: 'Log entry',
        title: (e: Detail) => `Entry ${e.n}`,
        subtitle: (e: Detail) => `${e.op} by ${e.actor}`,
        properties: (e: Detail) => [
          { label: 'Op', value: e.op, kind: 'mono' },
          { label: 'Actor', value: e.actor },
          { label: 'Verdict date', value: e.date, kind: 'date' },
          { label: 'Receipt', value: e.receipt, kind: 'number' },
          { label: 'Received', value: e.at },
          { label: 'Device', value: short(e.device, 16), kind: 'mono' },
          { label: 'Nonce', value: short(e.nonce, 16), kind: 'mono' },
          { label: 'Request', value: short(e.request, 16), kind: 'mono' },
          { label: 'Payload', value: short(e.payload, 16), kind: 'mono' },
          { label: 'Previous', value: short(e.prev, 16), kind: 'mono' },
          { label: 'Hash', value: short(e.hash, 16), kind: 'mono' },
        ],
        related: (e: Detail) => [
          ...[said(e.op, e.records)].flatMap((s) => (s.href ? [{ label: s.text, sub: 'the record', href: s.href }] : [])),
          ...(e.n > 1 ? [{ label: `Entry ${e.n - 1}`, sub: 'previous', href: `/log/${e.n - 1}` }] : []),
          { label: e.actor, sub: 'member', href: `/people/${e.actor}` },
        ],
        blocks: [Guards],
      },
    },
  },
}
