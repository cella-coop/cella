import type { Added, App, Column, Look, Nav, Owned, Preset, Shift, Widget } from '@cella/org-ui'
import { presets } from '@cella/org-ui/models'
import { app as log } from '@cella/org-log/app'
import { app as key, Devices } from '@cella/org-key/app'
import { app as member } from '@cella/org-member/app'
import { app as circle } from '@cella/org-circle/app'
import { app as decision } from '@cella/org-decision/app'
import { app as document } from '@cella/org-document/app'
import { app as client } from '@cella/org-client/app'
import { app as invoice } from '@cella/org-invoice/app'
import { app as account } from '@cella/org-account/app'
import { app as transaction } from '@cella/org-transaction/app'
import { app as circleMember } from '@cella/org-graft-circle-member/app'
import { app as circleDecisionMember } from '@cella/org-graft-circle-decision-member/app'
import { app as decisionMember } from '@cella/org-graft-decision-member/app'
import { app as decisionDocument } from '@cella/org-graft-decision-document/app'
import { app as clientInvoice } from '@cella/org-graft-client-invoice/app'
import { app as invoiceTransaction } from '@cella/org-graft-invoice-transaction/app'
import { app as accountTransaction } from '@cella/org-graft-account-transaction/app'

// The client sides the shell mounts, matching the server's slices by
// name: each feat's views and pages, each graft's extensions, and the
// root's own, which joins feats no graft joins, such as a member's
// devices.
const root: App = {
  name: 'org',
  extends: {
    members: { page: { blocks: [Devices] } },
  },
}

export const apps: App[] = [
  member,
  circle,
  decision,
  document,
  client,
  invoice,
  account,
  transaction,
  key,
  log,
  circleMember,
  circleDecisionMember,
  decisionMember,
  decisionDocument,
  clientInvoice,
  invoiceTransaction,
  accountTransaction,
  root,
]

export const collection = (name: string): Owned | undefined => apps.find((a) => a.collections?.[name])?.collections?.[name]

// What each slice adds to a collection, by the slice's name.
export const extensions = (name: string): { slice: string; extension: Added }[] =>
  apps.flatMap((a) => (a.extends?.[name] ? [{ slice: a.name, extension: a.extends[name] }] : []))

// A collection's columns: its owner's, then each extension's over the
// fields it adds to the rows.
export const columns = (name: string): Column[] => [
  ...(collection(name)?.view.columns ?? []),
  ...extensions(name).flatMap((e) => e.extension.columns ?? []),
]

// The dashboard a collection's owner and extensions declare, if they do.
export const dashboard = (name: string): Widget[] | undefined => {
  const declared = [...(collection(name)?.view.dashboard ?? []), ...extensions(name).flatMap((e) => e.extension.dashboard ?? [])]
  return declared.length ? declared : undefined
}

// How a collection looks before a view changes it: its owner's look, each
// extension's overriding it.
export const look = (name: string): Look =>
  Object.assign({}, collection(name)?.view.look, ...extensions(name).map((e) => e.extension.look ?? {}))

// The board moves a collection's slices make writes.
export const shifts = (name: string): Shift[] => [
  ...(collection(name)?.view.shifts ?? []),
  ...extensions(name).flatMap((e) => e.extension.shifts ?? []),
]

// The views a collection offers as tabs: its declared presets and All.
export const views = (name: string): Preset[] => presets(collection(name)?.view.views)

const order = ['governance', 'work', 'finance', 'platform']

export const nav: Nav = order
  .map((group) => ({
    group,
    items: apps.flatMap((a) =>
      Object.entries(a.collections ?? {})
        .filter(([, c]) => c.view.group === group)
        .map(([name, c]) => ({ href: `/${name}`, title: c.view.title, icon: c.view.icon })),
    ),
  }))
  .filter((g) => g.items.length)
