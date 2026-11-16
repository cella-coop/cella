<script lang="ts">
  import { Section, Settings, type Declared } from '@cella/org-ui'
  import type { Ruling } from '../../models/asking.ts'

  // A circle's rules page in Settings: each setting core circle registers,
  // on or off, with where its value comes from. None saves directly, since
  // only a rule adopted by motion sets one: Save opens the dialog proposing
  // a motion of the circle that decides, carrying the rule for each
  // setting changed.
  let { data }: { data: Ruling } = $props()

  const labels: Record<string, string> = { reactions: 'Reactions on comments' }
  const from = (s: Ruling['settings'][number]) =>
    s.set_by === 'circle' ? `set by ${s.policy}` : s.set_by === 'assembly' ? `the assembly's, by ${s.policy}` : `the default, ${s.default}`

  const settings: Declared[] = $derived(
    data.settings.map((s) => ({
      name: s.name,
      label: `${labels[s.name] ?? s.name} (${from(s)})`,
      value: s.value,
      options: [
        { value: 'on', label: 'On' },
        { value: 'off', label: 'Off' },
      ],
      refused: data.refused,
      motion: {
        kind: 'policy',
        args: (value: string) => ({ [s.name]: value }),
        labels: { [s.name]: `New ${(labels[s.name] ?? s.name).toLowerCase()}` },
        says: (value: string) => `Turn ${(labels[s.name] ?? s.name).toLowerCase()} ${value} in ${data.name}`,
      },
    })),
  )
</script>

<Section title={data.name}>
  <Settings {settings} decider={data.decider} />
</Section>
