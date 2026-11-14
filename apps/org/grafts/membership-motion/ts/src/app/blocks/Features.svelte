<script lang="ts">
  import { arrangement, Section, Settings, type Declared } from '@cella/org-ui'
  import type { Featuring } from '../../models/asking.ts'

  // A circle's features page in Settings: every feature the co-op
  // installed with a toggle, those the circle enabled in its order, under
  // their accordions. None saves directly, since only a motion amends a
  // circle: Save opens the dialog proposing an `amend-circle` motion of
  // the circle that decides about it, carrying the listing as arranged.
  let { data }: { data: Featuring } = $props()

  // A feature by its name, as its schema is named.
  const named = (feat: string) => feat.charAt(0).toUpperCase() + feat.slice(1)
  const and = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : (names[0] ?? ''))
  const feats = (listing: string) => arrangement.listed(listing).map((p) => p.value)

  // What the motion's title says: what it enables and disables, or that it
  // rearranges the circle's features where it does neither.
  function says(value: string, was: string): string {
    const now = feats(value)
    const before = feats(was)
    const on = now.filter((f) => !before.includes(f)).map(named)
    const off = before.filter((f) => !now.includes(f)).map(named)
    const parts = [on.length ? `enable ${and(on)}` : '', off.length ? `disable ${and(off)}` : ''].filter(Boolean)
    const said = parts.join(' and ')
    return said ? `${said.charAt(0).toUpperCase()}${said.slice(1)} for ${data.name}` : `Rearrange ${data.name}'s features`
  }

  const settings: Declared[] = $derived([
    {
      name: 'features',
      label: 'Features',
      value: data.features,
      choices: data.installed.map((f) => ({ value: f, label: named(f) })),
      refused: data.refused,
      motion: { kind: 'amend-circle', args: (value) => ({ circle: data.circle, features: value }), labels: { features: 'New features' }, says },
    },
  ])
</script>

<Section title={data.name}>
  <Settings {settings} decider={data.decider} />
</Section>
