<script lang="ts">
  import { arrangement, Section, Settings, type Declared } from '@cella/org-ui'
  import type { Featuring } from '../../models/asking.ts'

  // A circle's features page in Settings. The root's arranges the co-op's
  // layout: the tree of the features it enables, in its order, each under
  // a group, and the rest of those the co-op installed, not enabled, each
  // placed by dragging. Any other circle's lists the layout's groups in
  // its order, each with a switch showing it in the circle, and under
  // each its features, each with a switch showing it, off where the
  // circle hides it: the circle drops what it does not show, never moves
  // or renames it. A reader holding `arrange-features` over the circle
  // saves each drop and each turn at once; for anyone else it joins the
  // changes to propose to the circle that holds the power over it, the
  // circle itself where it does: the layout as an `arrange-features`
  // action, a group's switch as a `show-group`, a feature's as a
  // `hide-feature`.
  let { data }: { data: Featuring } = $props()

  // A feature by its name, as its schema is named.
  const named = (feat: string) => feat.charAt(0).toUpperCase() + feat.slice(1)
  const and = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : (names[0] ?? ''))
  const feats = (listing: string) => arrangement.listed(listing).map((p) => p.value)
  const toggle = [
    { value: 'yes', label: 'Shown' },
    { value: 'no', label: 'Hidden' },
  ]
  const write = (name: string) => (data.may ? { write: name } : { refused: data.refused })

  // What the layout's motion title says: what it enables and disables, or
  // that it rearranges the co-op's features where it does neither.
  function says(value: string, was: string): string {
    const now = feats(value)
    const before = feats(was)
    const on = now.filter((f) => !before.includes(f)).map(named)
    const off = before.filter((f) => !now.includes(f)).map(named)
    const parts = [on.length ? `enable ${and(on)}` : '', off.length ? `disable ${and(off)}` : ''].filter(Boolean)
    const said = parts.join(' and ')
    return said ? `${said.charAt(0).toUpperCase()}${said.slice(1)} across the co-op` : `Rearrange the co-op's features`
  }

  const layout: Declared[] = $derived([
    {
      name: 'features',
      label: 'Features',
      value: data.features,
      choices: data.installed.map((f) => ({ value: f, label: named(f) })),
      grouped: true,
      ...write('arrange'),
      motion: { kind: 'arrange-features', args: (value) => ({ circle: data.circle, features: value }), labels: { features: 'New features' }, says },
    },
  ])

  const rows: Declared[] = $derived(
    data.groups.flatMap((g, i): Declared[] => {
      const shown = data.shown.includes(g.id)
      return [
        {
          name: `group:${g.id}`,
          label: g.name,
          type: 'toggle',
          value: shown ? 'yes' : 'no',
          options: toggle,
          ...(i === 0
            ? { help: `The co-op's features sit in its groups, in the co-op's order. ${data.name} shows the groups switched on, and of each the features switched on; what it does not show is left out of its sidebar, never moved.` }
            : {}),
          ...write('show'),
          post: (v) => ({ group: g.id, shown: v }),
          motion: {
            kind: 'show-group',
            args: (v) => ({ circle: data.circle, group: g.id, shown: v }),
            says: (v) => `${v === 'yes' ? 'Show' : 'Hide'} ${g.name} in ${data.name}`,
          },
        },
        ...g.features.map(
          (f): Declared => ({
            name: `feature:${f}`,
            label: named(f),
            type: 'toggle',
            depth: 1,
            disabled: !shown,
            value: data.hidden.includes(f) ? 'no' : 'yes',
            options: toggle,
            ...write('hide'),
            post: (v) => ({ feature: f, hidden: v === 'yes' ? 'no' : 'yes' }),
            motion: {
              kind: 'hide-feature',
              args: (v) => ({ circle: data.circle, feature: f, hidden: v === 'yes' ? 'no' : 'yes' }),
              says: (v) => `${v === 'yes' ? 'Show' : 'Hide'} ${named(f)} in ${data.name}`,
            },
          }),
        ),
      ]
    }),
  )
</script>

<Section title={data.name}>
  <Settings settings={data.root ? layout : rows} decider={data.decider} where={data.name} />
</Section>
