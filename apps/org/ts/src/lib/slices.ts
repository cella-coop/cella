import { type Added, type App, type Column, type Look, type Nav, type Owned, type Preset, type SettingsPage, type Shift, type Widget } from '@cella/org-ui'
import { logged, logging, presets } from '@cella/org-ui/models'
import { app as log } from '@cella/org-log/app'
import { app as person } from '@cella/org-person/app'
import { app as circle } from '@cella/org-circle/app'
import { app as circlePolicy } from '@cella/org-graft-circle-policy/app'
import { feats } from './feats/index.ts'

// The client sides the shell mounts, matching the server's slices by
// name: core's, then every slice above core (`feats/`).
export const apps: App[] = [person, circle, circlePolicy, log, ...feats]

export const collection = (name: string): Owned | undefined => apps.find((a) => a.collections?.[name])?.collections?.[name]

// What each slice adds to a collection, by the slice's name.
export const extensions = (name: string): { slice: string; extension: Added }[] =>
  apps.flatMap((a) => (a.extends?.[name] ? [{ slice: a.name, extension: a.extends[name] }] : []))

// A collection's columns: its owner's, then each extension's over the
// fields it adds to the rows, then the four the core read adds to every
// row from the log, but those of a key it has.
export const columns = (name: string): Column[] =>
  logging([...(collection(name)?.view.columns ?? []), ...extensions(name).flatMap((e) => e.extension.columns ?? [])])

// The dashboard a collection's owner and extensions declare, if they do.
export const dashboard = (name: string): Widget[] | undefined => {
  const declared = [...(collection(name)?.view.dashboard ?? []), ...extensions(name).flatMap((e) => e.extension.dashboard ?? [])]
  return declared.length ? declared : undefined
}

// How a collection looks before a view changes it: its owner's look, each
// extension's overriding it, its table hiding the logged fields it adds
// until a view shows them, and every column each of them hides.
export const look = (name: string): Look => {
  const looks = [collection(name)?.view.look ?? {}, ...extensions(name).map((e) => e.extension.look ?? {})]
  const hide = [...columns(name).filter((c) => logged.includes(c)).map((c) => c.key), ...looks.flatMap((l) => l.hide ?? [])]
  return { ...Object.assign({}, ...looks), hide: [...new Set(hide)] }
}

// The board moves a collection's slices make writes.
export const shifts = (name: string): Shift[] => [
  ...(collection(name)?.view.shifts ?? []),
  ...extensions(name).flatMap((e) => e.extension.shifts ?? []),
]

// The views a collection offers as tabs: its declared presets and All.
export const views = (name: string): Preset[] =>
  presets([...(collection(name)?.view.views ?? []), ...extensions(name).flatMap((e) => e.extension.views ?? [])])

const order = ['home', 'feature', 'platform']

// The sidebar's navigation: what waits on the acting member; every
// feature's collections, each naming the feat that owns it, of which the
// sidebar shows those the circle the member is in enabled; and Settings'
// pages, each first in its group, before its collections. `counts` are
// the counted collections' rows for the acting member, by address, in the
// lensed circle where there is a lens; `waiting`, all of them whatever
// the lens.
export const nav = (counts: Record<string, number> = {}, waiting: Record<string, number> = counts): Nav =>
  order
    .map((group) => ({
      group,
      items: [
        ...(group === 'platform'
          ? apps.flatMap((a) => Object.entries(a.settings ?? {}).map(([name, s]) => ({ href: `/settings/${name}`, title: s.title, icon: s.icon, subgroup: s.subgroup, listed: s.listed })))
          : []),
        ...apps.flatMap((a) =>
          Object.entries(a.collections ?? {})
            .filter(([, c]) => (c.view.group ?? 'feature') === group)
            .map(([name, c]) => ({
              href: `/${name}`,
              title: c.view.title,
              icon: c.view.icon,
              count: counts[`/${name}`],
              waiting: waiting[`/${name}`],
              subgroup: c.view.subgroup,
              listed: c.view.listed,
              feature: a.name,
            })),
        ),
      ],
    }))
    .filter((g) => g.items.length)

// The collections the sidebar counts for the acting member.
export const counted = (): string[] =>
  apps.flatMap((a) => Object.entries(a.collections ?? {}).flatMap(([name, c]) => (c.view.counted ? [name] : [])))

// A settings page, by the name in its address.
export const settings = (name: string): SettingsPage | undefined => apps.find((a) => a.settings?.[name])?.settings?.[name]
