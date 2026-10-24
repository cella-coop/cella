import { icons, short, type App } from '@cella/org-ui'
import type { Detail, Entry } from '../models/log.ts'
import Head from './blocks/Head.svelte'
import Rules from './blocks/Rules.svelte'

const owners = (e: Entry) => e.rules.map((r) => r.owner).join(', ')

// The log's client side: its entries, newest first, whether the whole log
// verifies, and each entry's receipt, signatures and deciding rules.
export const app: App = {
  name: 'log',
  collections: {
    log: {
      view: {
        group: 'platform',
        title: 'Log',
        icon: icons.Notebook,
        summary: Head,
        empty: 'No write has reached the notary yet: the seed is the state before the log.',
        columns: [
          { key: 'n', label: 'Entry', kind: 'number', role: 'title', value: (e: Entry) => e.n },
          { key: 'op', label: 'Op', kind: 'mono', role: 'sub', value: (e: Entry) => e.op },
          { key: 'actor', label: 'Actor', role: 'sub', value: (e: Entry) => e.actor },
          { key: 'rules', label: 'Decided by', role: 'hidden', value: owners },
          { key: 'receipt', label: 'Receipt', kind: 'number', role: 'hidden', value: (e: Entry) => e.receipt },
          { key: 'date', label: 'Verdict date', kind: 'date', role: 'meta', value: (e: Entry) => e.date },
        ],
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
          ...(e.n > 1 ? [{ label: `Entry ${e.n - 1}`, sub: 'previous', href: `/log/${e.n - 1}` }] : []),
          { label: e.actor, sub: 'member', href: `/members/${e.actor}` },
        ],
        blocks: [Rules],
      },
    },
  },
}
